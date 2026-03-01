export interface EvolutionListRow {
  title: string;
  description?: string;
  rowId: string;
}

export interface EvolutionListSection {
  title: string;
  rows: EvolutionListRow[];
}

export interface EvolutionListMessage {
  title: string;
  description: string;
  buttonText: string;
  footerText?: string;
  sections: EvolutionListSection[];
}

export interface SendEvolutionMessageOptions {
  evolutionApiUrl: string;
  evolutionInstanceName: string;
  evolutionApiToken: string;
  phone: string;
  content: string | EvolutionListMessage;
  delay?: number;
  presence?: "composing" | "recording" | "paused";
  typingEnabled?: boolean;
}

interface EvolutionV2ReplyButton {
  type: "reply";
  displayText: string;
  id: string;
}

interface EvolutionButtonsChunk {
  title: string;
  description: string;
  footerText: string;
  buttons: EvolutionV2ReplyButton[];
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

function listSectionsToValues(message: EvolutionListMessage) {
  return (message.sections ?? []).map((section) => ({
    title: section.title,
    rows: (section.rows ?? []).map((row) => ({
      title: row.title,
      // Evolution validation in 2.3.7 rejects empty descriptions.
      description: row.description?.trim() || row.title?.trim() || "Opcao",
      rowId: row.rowId,
    })),
  }));
}

function sanitizeSectionsForLegacyList(message: EvolutionListMessage) {
  return (message.sections ?? []).map((section) => ({
    title: section.title,
    rows: (section.rows ?? []).map((row) => ({
      title: row.title,
      description: row.description?.trim() || row.title?.trim() || "Opcao",
      rowId: row.rowId,
    })),
  }));
}

function flattenListRows(message: EvolutionListMessage) {
  return (message.sections || []).flatMap((section) => section.rows || []);
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function buildButtonsChunksFromListMessage(
  message: EvolutionListMessage,
): EvolutionButtonsChunk[] {
  const rows = flattenListRows(message);
  if (rows.length === 0) return [];

  const rowChunks = chunkArray(rows, 3);
  const totalChunks = rowChunks.length;
  const title = message.title?.trim() || "Opcoes";
  const baseDescription = message.description?.trim() || "Escolha uma opcao";
  const footerText = (message.footerText ?? "").trim();

  return rowChunks.map((rowChunk, chunkIndex) => {
    const page = chunkIndex + 1;
    const pageLabel = totalChunks > 1 ? `\n\nPagina ${page}/${totalChunks}` : "";
    return {
      title,
      description: `${baseDescription}${pageLabel}`.trim(),
      footerText,
      buttons: rowChunk.map((row, rowIndex) => {
        const fallbackId = String(chunkIndex * 3 + rowIndex + 1);
        const id = (row.rowId || fallbackId).trim() || fallbackId;
        const displayText = (row.title?.trim() || `Opcao ${fallbackId}`).slice(0, 20);
        return {
          type: "reply",
          displayText,
          id,
        };
      }),
    };
  });
}

function normalizeEvolutionTargetNumber(rawPhone: string) {
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;

  const isLidOrigin = /@lid$/i.test(trimmed);

  // Strip all JID suffixes including @lid, @s.whatsapp.net, @c.us
  const normalized = trimmed
    .replace(/@lid$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .trim();

  const digits = normalized.replace(/\D/g, "");
  if (!digits) return null;

  // LID internal IDs are long digit sequences (typically 17+) that are NOT
  // phone numbers. Sending them to Evolution API results in 400 Bad Request.
  // Real phone numbers with country code are at most 15 digits (E.164).
  if (isLidOrigin && digits.length > 15) {
    console.warn(
      `normalizeEvolutionTargetNumber: skipping LID-origin digits (${digits.length} digits). ` +
        `This is an internal WhatsApp ID, not a phone number. Original: ${trimmed}`,
    );
    return null;
  }

  // Padrao BR: envia com DDI 55 quando vier apenas DDD+numero.
  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }

  return digits;
}

function extractPayloadErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const responseRecord =
    typeof record.response === "object" && record.response
      ? (record.response as Record<string, unknown>)
      : null;
  const candidates = [
    record.message,
    record.error,
    record.reason,
    record.details,
    responseRecord?.message,
  ];

  const flattenStringCandidate = (value: unknown): string | null => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || null;
    }

    if (Array.isArray(value)) {
      for (const nested of value) {
        const nestedMessage = flattenStringCandidate(nested);
        if (nestedMessage) return nestedMessage;
      }
      return null;
    }

    if (value && typeof value === "object") {
      const objectRecord = value as Record<string, unknown>;
      return flattenStringCandidate(objectRecord.message);
    }

    return null;
  };

  for (const candidate of candidates) {
    const normalized = flattenStringCandidate(candidate);
    if (normalized) return normalized;
  }

  return null;
}

async function safeParseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function buildEvolutionApiBaseCandidates(evolutionApiUrl: string) {
  const normalized = evolutionApiUrl.trim().replace(/\/+$/, "");
  const candidates = [normalized];

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === "evolution-api") {
      const localhostFallback = new URL(parsed.toString());
      localhostFallback.hostname = "localhost";
      candidates.push(localhostFallback.toString().replace(/\/+$/, ""));
    }
  } catch {
    // URL validation is handled by callers/settings validation.
  }

  return Array.from(new Set(candidates));
}

function buildEvolutionConnectionHint(evolutionApiUrl: string) {
  if (evolutionApiUrl.includes("evolution-api")) {
    return `Falha de conexao com a Evolution API (${evolutionApiUrl}). Se o sistema estiver fora do Docker, use http://localhost:8080.`;
  }
  return `Falha de conexao com a Evolution API (${evolutionApiUrl}). Verifique URL, porta e disponibilidade do servico.`;
}

function isEvolutionButtonsFallbackEnabled() {
  return process.env.EVOLUTION_ENABLE_BUTTONS_FALLBACK === "true";
}

function buildEvolutionApiErrorMessage(
  status: number,
  statusText: string,
  payload: unknown,
) {
  const payloadMessage = extractPayloadErrorMessage(payload);
  return payloadMessage
    ? `Evolution API error: ${status} ${statusText} - ${payloadMessage}`
    : `Evolution API error: ${status} ${statusText}`;
}

function buildTypingOptions(
  typingEnabled: boolean,
  delay: number,
  presence: "composing" | "recording" | "paused",
) {
  if (!typingEnabled) return undefined;
  return { delay, presence };
}

function buildSendTextBodyCandidates(input: {
  number: string;
  text: string;
  typingEnabled: boolean;
  delay: number;
  presence: "composing" | "recording" | "paused";
}) {
  const options = buildTypingOptions(
    input.typingEnabled,
    input.delay,
    input.presence,
  );

  const modernBody: Record<string, unknown> = {
    number: input.number,
    text: input.text,
  };
  if (options) modernBody.options = options;

  const legacyBody: Record<string, unknown> = {
    number: input.number,
    textMessage: {
      text: input.text,
    },
  };
  if (options) legacyBody.options = options;

  return [modernBody, legacyBody];
}

function buildSendListBodyCandidates(input: {
  number: string;
  listMessage: EvolutionListMessage;
  typingEnabled: boolean;
  delay: number;
  presence: "composing" | "recording" | "paused";
}) {
  const options = buildTypingOptions(
    input.typingEnabled,
    input.delay,
    input.presence,
  );

  const modernBody: Record<string, unknown> = {
    number: input.number,
    title: input.listMessage.title,
    description: input.listMessage.description,
    buttonText: input.listMessage.buttonText,
    footerText: input.listMessage.footerText ?? "",
    // v2 format (doc.evolution-api.com/v2/.../send-list): uses `values`.
    values: listSectionsToValues(input.listMessage),
    delay: input.typingEnabled ? input.delay : 0,
  };

  const modernSectionsCompatibilityBody: Record<string, unknown> = {
    number: input.number,
    title: input.listMessage.title,
    description: input.listMessage.description,
    buttonText: input.listMessage.buttonText,
    footerText: input.listMessage.footerText ?? "",
    sections: sanitizeSectionsForLegacyList(input.listMessage),
  };
  if (options) modernSectionsCompatibilityBody.options = options;

  const legacyBody: Record<string, unknown> = {
    number: input.number,
    listMessage: input.listMessage,
  };
  if (options) legacyBody.options = options;

  return [modernBody, modernSectionsCompatibilityBody, legacyBody];
}

function buildSendButtonsBodyCandidates(input: {
  number: string;
  chunk: EvolutionButtonsChunk;
  typingEnabled: boolean;
  delay: number;
  presence: "composing" | "recording" | "paused";
}) {
  const options = buildTypingOptions(
    input.typingEnabled,
    input.delay,
    input.presence,
  );

  const modernBody: Record<string, unknown> = {
    number: input.number,
    title: input.chunk.title,
    description: input.chunk.description,
    footerText: input.chunk.footerText,
    buttons: input.chunk.buttons,
  };

  const modernWithOptionsBody: Record<string, unknown> = {
    ...modernBody,
  };
  if (options) modernWithOptionsBody.options = options;

  return [modernBody, modernWithOptionsBody];
}

type EvolutionPostAttemptResult = {
  ok: boolean;
  status: number;
  statusText: string;
  payload: Record<string, unknown> | null;
};

async function postEvolutionWithBodyCandidates(input: {
  url: string;
  token: string;
  bodies: Record<string, unknown>[];
}) {
  let lastResult: EvolutionPostAttemptResult | null = null;

  for (let index = 0; index < input.bodies.length; index++) {
    const response = await fetch(input.url, {
      method: "POST",
      headers: {
        apikey: input.token,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(input.bodies[index]),
    });

    const payload = await safeParseResponse(response);
    const result: EvolutionPostAttemptResult = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      payload,
    };

    if (result.ok) return result;

    lastResult = result;

    // 400 commonly indicates schema mismatch between Evolution versions.
    const hasNextCandidate = index + 1 < input.bodies.length;
    if (result.status !== 400 || !hasNextCandidate) {
      return result;
    }
  }

  return (
    lastResult ?? {
      ok: false,
      status: 500,
      statusText: "Unknown Error",
      payload: null,
    }
  );
}

export async function sendEvolutionMessage({
  evolutionApiUrl,
  evolutionInstanceName,
  evolutionApiToken,
  phone,
  content,
  delay = 1200,
  presence = "composing",
  typingEnabled = true,
}: SendEvolutionMessageOptions) {
  const isList = typeof content !== "string";
  const baseCandidates = buildEvolutionApiBaseCandidates(evolutionApiUrl);
  const normalizedPhone = normalizeEvolutionTargetNumber(phone);

  if (!normalizedPhone) {
    throw new Error("Telefone invalido para envio via Evolution API.");
  }

  let lastNetworkError: unknown = null;

  for (const baseUrl of baseCandidates) {
    try {
      if (isList) {
        const listContent = content as EvolutionListMessage;
        const listUrl = `${baseUrl}/message/sendList/${encodeURIComponent(
          evolutionInstanceName,
        )}`;
        const listResponse = await postEvolutionWithBodyCandidates({
          url: listUrl,
          token: evolutionApiToken,
          bodies: buildSendListBodyCandidates({
            number: normalizedPhone,
            listMessage: listContent,
            typingEnabled,
            delay,
            presence,
          }),
        });

        if (listResponse.ok) {
          return listResponse.payload;
        }

        const buttonChunks = buildButtonsChunksFromListMessage(listContent);
        if (isEvolutionButtonsFallbackEnabled() && buttonChunks.length > 0) {
          const buttonsUrl = `${baseUrl}/message/sendButtons/${encodeURIComponent(
            evolutionInstanceName,
          )}`;

          let failedButtonsResponse: EvolutionPostAttemptResult | null = null;
          let lastButtonsPayload: Record<string, unknown> | null = null;

          for (const chunk of buttonChunks) {
            const buttonsResponse = await postEvolutionWithBodyCandidates({
              url: buttonsUrl,
              token: evolutionApiToken,
              bodies: buildSendButtonsBodyCandidates({
                number: normalizedPhone,
                chunk,
                typingEnabled,
                delay,
                presence,
              }),
            });

            if (!buttonsResponse.ok) {
              failedButtonsResponse = buttonsResponse;
              break;
            }

            lastButtonsPayload = buttonsResponse.payload;
          }

          if (!failedButtonsResponse) {
            return lastButtonsPayload;
          }

          console.warn(
            "Failed to send Evolution API fallback buttons message:",
            failedButtonsResponse.payload,
          );
        }
        if (!isEvolutionButtonsFallbackEnabled()) {
          console.info(
            "Evolution buttons fallback disabled (EVOLUTION_ENABLE_BUTTONS_FALLBACK!=true). Using plain text fallback.",
          );
        }

        console.warn(
          "Failed to send Evolution API list message. Falling back to plain text:",
          listResponse.payload,
        );

        // Fallback: plain text numbered menu.
        const textFallback = listMessageToTextContent(listContent);
        const textUrl = `${baseUrl}/message/sendText/${encodeURIComponent(
          evolutionInstanceName,
        )}`;
        const textFallbackResponse = await postEvolutionWithBodyCandidates({
          url: textUrl,
          token: evolutionApiToken,
          bodies: buildSendTextBodyCandidates({
            number: normalizedPhone,
            text: textFallback,
            typingEnabled,
            delay,
            presence,
          }),
        });

        if (textFallbackResponse.ok) {
          return textFallbackResponse.payload;
        }

        console.error(
          "Failed to send Evolution API fallback text message:",
          textFallbackResponse.payload,
        );
        throw new Error(
          buildEvolutionApiErrorMessage(
            textFallbackResponse.status,
            textFallbackResponse.statusText,
            textFallbackResponse.payload,
          ),
        );
      }

      const textUrl = `${baseUrl}/message/sendText/${encodeURIComponent(
        evolutionInstanceName,
      )}`;
      const textResponse = await postEvolutionWithBodyCandidates({
        url: textUrl,
        token: evolutionApiToken,
        bodies: buildSendTextBodyCandidates({
          number: normalizedPhone,
          text: content as string,
          typingEnabled,
          delay,
          presence,
        }),
      });

      if (!textResponse.ok) {
        console.error("Failed to send Evolution API message:", textResponse.payload);
        throw new Error(
          buildEvolutionApiErrorMessage(
            textResponse.status,
            textResponse.statusText,
            textResponse.payload,
          ),
        );
      }

      return textResponse.payload;
    } catch (error) {
      if (error instanceof TypeError) {
        lastNetworkError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastNetworkError) {
    throw new Error(buildEvolutionConnectionHint(evolutionApiUrl));
  }

  throw new Error("Falha ao enviar mensagem pela Evolution API.");
}
