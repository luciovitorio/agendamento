import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { loadSettings, processMessage } from "@/lib/bot-processor";
import type { EvolutionListMessage } from "@/lib/evolution-api";
import { tryConfirmBookingFromReminderReply } from "@/lib/booking-reminders";
import { addInboundHandoffMessage } from "@/lib/handoff-chat";
import { isHumanHandoffActive, setHandoffMode } from "@/lib/human-handoff";
import { normalizeIncomingPhone } from "@/lib/n8n-phone";
import {
  resolveWhatsAppProvider,
  sendConfiguredWhatsAppMessage,
} from "@/lib/whatsapp-provider";

export const runtime = "nodejs";

type IncomingMessageSource =
  | "text"
  | "list_selection"
  | "button_selection"
  | "unknown";

function normalizeTypingSettings(
  settings: Awaited<ReturnType<typeof loadSettings>>,
): { delay: number; presence: "composing" | "recording" | "paused" } {
  const delayRaw = settings?.messageTypingDelayMs ?? 1200;
  const delay = Math.max(0, Math.min(30_000, Math.trunc(delayRaw)));
  const rawPresence = settings?.messageTypingPresence;
  const presence =
    rawPresence === "recording" ||
    rawPresence === "paused" ||
    rawPresence === "composing"
      ? rawPresence
      : "composing";
  return { delay, presence };
}

function humanizeSelectionMessage(rawSelectionId: string) {
  const normalized = rawSelectionId.trim();
  if (!normalized) return normalized;

  const knownMainMenu: Record<string, string> = {
    "1": "Agendar consulta",
    "2": "Meus agendamentos",
    "3": "Cancelar agendamento",
    "4": "Planos aceitos",
    "5": "Horario de atendimento",
    "6": "Falar com atendente",
  };

  const knownLabel = knownMainMenu[normalized];
  if (knownLabel) {
    return `Selecionou no menu: ${knownLabel} (${normalized})`;
  }

  if (/^\d+$/.test(normalized)) {
    return `Selecionou opcao ${normalized}`;
  }

  return normalized;
}

function formatInboundMessageForDisplay(
  messageText: string,
  source: IncomingMessageSource,
) {
  if (source === "list_selection" || source === "button_selection") {
    return humanizeSelectionMessage(messageText);
  }
  return messageText;
}

function resolveMetaVerifyToken(settings: Awaited<ReturnType<typeof loadSettings>>) {
  const fromSettings = settings?.metaWebhookVerifyToken?.trim();
  if (fromSettings) return fromSettings;
  const fromEnv = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return null;
}

function resolveMetaAppSecret(settings: Awaited<ReturnType<typeof loadSettings>>) {
  const fromSettings = settings?.metaAppSecret?.trim();
  if (fromSettings) return fromSettings;
  const fromEnv = process.env.META_APP_SECRET?.trim();
  if (fromEnv) return fromEnv;
  return null;
}

function isValidMetaSignature(rawBody: string, signatureHeader: string, secret: string) {
  const normalized = signatureHeader.trim();
  if (!normalized.startsWith("sha256=")) return false;
  const received = normalized.slice("sha256=".length);
  if (!/^[a-fA-F0-9]+$/.test(received)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function extractMessageText(message: Record<string, unknown>): {
  text: string;
  source: IncomingMessageSource;
} {
  const type = typeof message.type === "string" ? message.type : "";

  if (type === "text") {
    const textObj =
      typeof message.text === "object" && message.text
        ? (message.text as Record<string, unknown>)
        : null;
    const body = typeof textObj?.body === "string" ? textObj.body : "";
    return { text: body.trim(), source: "text" };
  }

  if (type === "interactive") {
    const interactive =
      typeof message.interactive === "object" && message.interactive
        ? (message.interactive as Record<string, unknown>)
        : null;

    const listReply =
      interactive &&
      typeof interactive.list_reply === "object" &&
      interactive.list_reply
        ? (interactive.list_reply as Record<string, unknown>)
        : null;
    const listId = typeof listReply?.id === "string" ? listReply.id.trim() : "";
    if (listId) return { text: listId, source: "list_selection" };

    const buttonReply =
      interactive &&
      typeof interactive.button_reply === "object" &&
      interactive.button_reply
        ? (interactive.button_reply as Record<string, unknown>)
        : null;
    const buttonId =
      typeof buttonReply?.id === "string" ? buttonReply.id.trim() : "";
    if (buttonId) return { text: buttonId, source: "button_selection" };
  }

  if (type === "button") {
    const button =
      typeof message.button === "object" && message.button
        ? (message.button as Record<string, unknown>)
        : null;
    const payload =
      typeof button?.payload === "string" ? button.payload.trim() : "";
    if (payload) return { text: payload, source: "button_selection" };
  }

  return { text: "", source: "unknown" };
}

function extractInboundMessages(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const entries = Array.isArray(record.entry)
    ? (record.entry as Array<Record<string, unknown>>)
    : [];

  const extracted: Array<{
    phone: string;
    messageText: string;
    source: IncomingMessageSource;
  }> = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes)
      ? (entry.changes as Array<Record<string, unknown>>)
      : [];
    for (const change of changes) {
      const value =
        typeof change.value === "object" && change.value
          ? (change.value as Record<string, unknown>)
          : null;
      const messages = Array.isArray(value?.messages)
        ? (value?.messages as Array<Record<string, unknown>>)
        : [];
      for (const message of messages) {
        const from = typeof message.from === "string" ? message.from.trim() : "";
        if (!from) continue;
        const phone = normalizeIncomingPhone(from) || from.replace(/\D/g, "");
        if (!phone) continue;

        const { text, source } = extractMessageText(message);
        extracted.push({
          phone,
          messageText: text,
          source,
        });
      }
    }
  }

  return extracted;
}

export async function GET(req: Request) {
  const settings = await loadSettings();
  if (!settings) {
    return NextResponse.json(
      { error: "Configuração do bot não encontrada." },
      { status: 500 },
    );
  }

  if (resolveWhatsAppProvider(settings.whatsappProvider) !== "META_CLOUD") {
    return NextResponse.json({ ok: true, ignored: "PROVIDER_MISMATCH" });
  }

  const verifyToken = resolveMetaVerifyToken(settings);
  if (!verifyToken) {
    return NextResponse.json(
      { error: "Verify Token da Meta nao configurado." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const settings = await loadSettings();
    if (!settings) {
      return NextResponse.json(
        { error: "Configuração do bot não encontrada." },
        { status: 500 },
      );
    }

    if (resolveWhatsAppProvider(settings.whatsappProvider) !== "META_CLOUD") {
      return NextResponse.json({ received: true, ignored: "PROVIDER_MISMATCH" });
    }

    const rawBody = await req.text();
    const appSecret = resolveMetaAppSecret(settings);
    const signature = req.headers.get("x-hub-signature-256");
    if (appSecret) {
      if (!signature || !isValidMetaSignature(rawBody, signature, appSecret)) {
        return NextResponse.json({ error: "Assinatura invalida." }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody) as unknown;
    const inboundMessages = extractInboundMessages(payload);
    if (inboundMessages.length === 0) {
      return NextResponse.json({ received: true });
    }

    const typing = normalizeTypingSettings(settings);
    let processed = 0;

    for (const inbound of inboundMessages) {
      const messageText = inbound.messageText.trim();
      const storableMessageText = formatInboundMessageForDisplay(
        messageText,
        inbound.source,
      );

      if (await isHumanHandoffActive(inbound.phone)) {
        if (storableMessageText) {
          try {
            await addInboundHandoffMessage(inbound.phone, storableMessageText);
          } catch (handoffMessageError) {
            console.error(
              "Error storing inbound handoff message:",
              handoffMessageError,
            );
          }
        }
        processed += 1;
        continue;
      }

      const reminderConfirmation = await tryConfirmBookingFromReminderReply(
        inbound.phone,
        messageText,
      );
      if (reminderConfirmation.handled) {
        let reminderResponse: string | EvolutionListMessage | undefined =
          reminderConfirmation.responseMessage;
        if (reminderConfirmation.action === "CANCEL_OR_RESCHEDULE") {
          const botReschedule = await processMessage(inbound.phone, "remarcar");
          if (botReschedule.state !== "DISABLED" && botReschedule.response) {
            reminderResponse = botReschedule.response;
          } else {
            reminderResponse =
              "Certo! Vamos remarcar. Envie a opcao desejada no menu para continuar.";
          }
        }

        if (reminderResponse) {
          sendConfiguredWhatsAppMessage({
            settings,
            phone: inbound.phone,
            content: reminderResponse,
            delay: typing.delay,
            presence: typing.presence,
          }).catch((err) => {
            console.error("Error sending reminder confirmation message:", err);
          });
        }

        processed += 1;
        continue;
      }

      if (!settings.isBotEnabled) {
        processed += 1;
        continue;
      }

      const result = await processMessage(inbound.phone, messageText);

      if (result.state === "HUMAN_HANDOFF") {
        let handoffPersisted = false;
        try {
          await setHandoffMode({
            rawPhone: inbound.phone,
            mode: "HUMAN",
            reason: "Solicitacao de atendimento humano via fluxo do bot.",
            actor: "meta-webhook",
          });
          handoffPersisted = true;
        } catch (handoffError) {
          console.error("Error persisting human handoff state:", handoffError);
        }

        if (handoffPersisted && storableMessageText) {
          try {
            await addInboundHandoffMessage(inbound.phone, storableMessageText);
          } catch (handoffMessageError) {
            console.error(
              "Error storing inbound handoff trigger message:",
              handoffMessageError,
            );
          }
        }
      }

      if (result.state !== "DISABLED" && result.response) {
        sendConfiguredWhatsAppMessage({
          settings,
          phone: inbound.phone,
          content: result.response,
          delay: typing.delay,
          presence: typing.presence,
        }).catch((err) => {
          console.error("Error sending meta message:", err);
        });
      }

      processed += 1;
    }

    return NextResponse.json({ received: true, processed });
  } catch (error) {
    console.error("Meta Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
