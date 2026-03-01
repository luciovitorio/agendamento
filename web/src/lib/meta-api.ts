import type { EvolutionListMessage } from "@/lib/evolution-api";

export interface SendMetaMessageOptions {
  metaPhoneNumberId: string;
  metaAccessToken: string;
  metaApiVersion?: string;
  phone: string;
  content: string | EvolutionListMessage;
  delay?: number;
  typingEnabled?: boolean;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMetaPhone(rawPhone: string) {
  const digits = rawPhone
    .trim()
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/\D/g, "");
  return digits || null;
}

function trimMax(value: string | undefined, maxLength: number) {
  const normalized = (value || "").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function listMessageToTextContent(message: EvolutionListMessage) {
  const lines: string[] = [];

  if (message.title?.trim()) {
    lines.push(message.title.trim());
  }
  if (message.description?.trim()) {
    lines.push(message.description.trim());
  }

  const rows = (message.sections || []).flatMap(
    (section) => section.rows || [],
  );
  if (rows.length > 0) {
    lines.push("");
    rows.forEach((row, index) => {
      const title = row.title?.trim() || `Opcao ${index + 1}`;
      const description = row.description?.trim();
      lines.push(
        `${index + 1} - ${title}${description ? ` - ${description}` : ""}`,
      );
    });
  }

  return lines.join("\n").trim();
}

function buildMetaInteractiveList(message: EvolutionListMessage) {
  const sections = (message.sections || [])
    .map((section) => ({
      title: trimMax(section.title, 24),
      rows: (section.rows || [])
        .map((row, index) => ({
          id: trimMax(row.rowId, 200) || `opcao_${index + 1}`,
          title: trimMax(row.title, 24) || `Opcao ${index + 1}`,
          description: trimMax(row.description, 72),
        }))
        .filter((row) => !!row.id && !!row.title),
    }))
    .filter((section) => section.rows.length > 0);

  const flattenedCount = sections.reduce(
    (total, section) => total + section.rows.length,
    0,
  );
  if (flattenedCount === 0) return null;

  // Cloud API list supports up to 10 rows.
  let remaining = 10;
  const limitedSections = sections
    .map((section) => {
      if (remaining <= 0) return null;
      const rows = section.rows.slice(0, remaining);
      remaining -= rows.length;
      if (rows.length === 0) return null;
      return {
        title: section.title,
        rows,
      };
    })
    .filter((section) => !!section) as Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;

  if (limitedSections.length === 0) return null;

  return {
    messaging_product: "whatsapp",
    type: "interactive",
    interactive: {
      type: "list",
      header: trimMax(message.title, 60)
        ? { type: "text", text: trimMax(message.title, 60) }
        : undefined,
      body: {
        text:
          trimMax(message.description, 1024) ||
          trimMax(message.title, 60) ||
          "Selecione uma opcao",
      },
      footer: trimMax(message.footerText, 60)
        ? { text: trimMax(message.footerText, 60) }
        : undefined,
      action: {
        button: trimMax(message.buttonText, 20) || "Ver opcoes",
        sections: limitedSections,
      },
    },
  };
}

function buildMetaTextMessage(content: string) {
  return {
    messaging_product: "whatsapp",
    type: "text",
    text: {
      preview_url: false,
      body: content,
    },
  };
}

function extractMetaErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const errorObj =
    typeof record.error === "object" && record.error
      ? (record.error as Record<string, unknown>)
      : null;
  const message = errorObj?.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return null;
}

async function postMetaMessage(input: {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: Record<string, unknown>;
}) {
  const endpoint = `https://graph.facebook.com/${input.apiVersion}/${encodeURIComponent(input.phoneNumberId)}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      ...input.body,
      to: input.to,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = extractMetaErrorMessage(payload);
    throw new Error(
      details
        ? `Meta Cloud API error: ${response.status} ${response.statusText} - ${details}`
        : `Meta Cloud API error: ${response.status} ${response.statusText}`,
    );
  }

  return payload;
}

export async function sendMetaMessage({
  metaPhoneNumberId,
  metaAccessToken,
  metaApiVersion,
  phone,
  content,
  delay = 0,
  typingEnabled = true,
}: SendMetaMessageOptions) {
  const to = normalizeMetaPhone(phone);
  if (!to) {
    throw new Error("Telefone invalido para envio via Meta Cloud API.");
  }

  const apiVersion = trimMax(metaApiVersion || "v23.0", 10) || "v23.0";
  const normalizedDelay = Math.max(0, Math.min(30_000, Math.trunc(delay || 0)));
  if (typingEnabled && normalizedDelay > 0) {
    await wait(normalizedDelay);
  }

  if (typeof content === "string") {
    return postMetaMessage({
      apiVersion,
      phoneNumberId: metaPhoneNumberId,
      accessToken: metaAccessToken,
      to,
      body: buildMetaTextMessage(content),
    });
  }

  const listPayload = buildMetaInteractiveList(content);
  if (!listPayload) {
    return postMetaMessage({
      apiVersion,
      phoneNumberId: metaPhoneNumberId,
      accessToken: metaAccessToken,
      to,
      body: buildMetaTextMessage(listMessageToTextContent(content)),
    });
  }

  try {
    return await postMetaMessage({
      apiVersion,
      phoneNumberId: metaPhoneNumberId,
      accessToken: metaAccessToken,
      to,
      body: listPayload,
    });
  } catch (interactiveError) {
    console.warn(
      "Failed to send Meta interactive list, falling back to text:",
      interactiveError,
    );
    return postMetaMessage({
      apiVersion,
      phoneNumberId: metaPhoneNumberId,
      accessToken: metaAccessToken,
      to,
      body: buildMetaTextMessage(listMessageToTextContent(content)),
    });
  }
}
