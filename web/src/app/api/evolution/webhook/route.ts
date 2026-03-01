import { NextResponse } from "next/server";
import { processMessage } from "@/lib/bot-processor";
import { loadSettings } from "@/lib/bot-processor";
import { tryConfirmBookingFromReminderReply } from "@/lib/booking-reminders";
import type { EvolutionListMessage } from "@/lib/evolution-api";
import { addInboundHandoffMessage } from "@/lib/handoff-chat";
import { isHumanHandoffActive, setHandoffMode } from "@/lib/human-handoff";
import { arePhonesEquivalent, normalizeIncomingPhone } from "@/lib/n8n-phone";
import {
  resolveWhatsAppProvider,
  sendConfiguredWhatsAppMessage,
} from "@/lib/whatsapp-provider";

function extractBearerToken(authHeader: string | null) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

function resolveWebhookToken(req: Request) {
  const bearer = extractBearerToken(req.headers.get("authorization"));
  if (bearer) return bearer;

  const custom =
    req.headers.get("x-evolution-webhook-token") ||
    req.headers.get("x-webhook-token");
  if (!custom) return null;
  return custom.trim() || null;
}

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

type IncomingMessageSource =
  | "conversation"
  | "extended_text"
  | "list_selection"
  | "button_selection"
  | "unknown";

type ReplyTargetCandidateSource =
  | "remote_jid"
  | "remote_jid_alt"
  | "sender_pn"
  | "data_sender"
  | "participant"
  | "body_sender";

interface ReplyTargetCandidate {
  value: unknown;
  source: ReplyTargetCandidateSource;
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
    // URL validation is handled in settings actions.
  }

  return Array.from(new Set(candidates));
}

function uniqueStringList(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function resolveLidReplyTarget({
  evolutionApiUrl,
  evolutionInstanceName,
  evolutionApiToken,
  lidTarget,
  pushName,
}: {
  evolutionApiUrl: string;
  evolutionInstanceName: string;
  evolutionApiToken: string;
  lidTarget: string;
  pushName: string;
}) {
  const normalizedPushName = pushName.trim();
  if (!/@lid$/i.test(lidTarget) || !normalizedPushName) return null;

  const baseCandidates = buildEvolutionApiBaseCandidates(evolutionApiUrl);

  for (const baseUrl of baseCandidates) {
    const url = `${baseUrl}/chat/findContacts/${encodeURIComponent(
      evolutionInstanceName,
    )}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: evolutionApiToken,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          where: { pushName: normalizedPushName },
        }),
      });

      if (!response.ok) continue;

      const payload = await response.json().catch(() => null);
      if (!Array.isArray(payload) || payload.length === 0) continue;

      const contacts = payload.filter(
        (item): item is { id: string; pushName?: string } =>
          !!item &&
          typeof item === "object" &&
          typeof (item as { id?: unknown }).id === "string",
      );
      if (contacts.length === 0) continue;

      const hasLidInSamePushName = contacts.some(
        (contact) => contact.id.toLowerCase() === lidTarget.toLowerCase(),
      );
      if (!hasLidInSamePushName) continue;

      const whatsappIds = uniqueStringList(
        contacts
          .map((contact) => contact.id.trim())
          .filter((id) => /@(s\.whatsapp\.net|c\.us)$/i.test(id)),
      );

      if (whatsappIds.length === 1) {
        return whatsappIds[0];
      }
    } catch {
      // Try next candidate URL.
    }
  }

  return null;
}

function isGroupJid(value: string) {
  return /@g\.us$/i.test(value.trim());
}

function normalizeTargetDigits(raw: string) {
  const noSuffix = raw
    .trim()
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/@lid$/i, "");
  const digits = noSuffix.replace(/\D/g, "");
  return digits || null;
}

function scoreReplyTarget(raw: string, source: ReplyTargetCandidateSource) {
  const value = raw.trim().toLowerCase();
  if (!value) return -1;

  let score = 0;
  if (/@s\.whatsapp\.net$/.test(value)) score += 400;
  else if (/@c\.us$/.test(value)) score += 300;
  else if ((normalizeTargetDigits(value)?.length ?? 0) >= 10) score += 200;
  else if (/@lid$/.test(value)) score += 100;

  if (source === "sender_pn") score += 50;
  else if (source === "remote_jid_alt") score += 45;
  else if (source === "remote_jid") score += 40;
  else if (source === "data_sender") score += 30;
  else if (source === "participant") score += 20;
  else score += 10;

  return score;
}

function isBlockedTarget(value: string, blockedPhones: string[]) {
  if (blockedPhones.length === 0) return false;
  const digits = normalizeTargetDigits(value);
  if (!digits) return false;
  return blockedPhones.some((blockedPhone) =>
    arePhonesEquivalent(digits, blockedPhone),
  );
}

function pickReplyTarget(
  candidates: ReplyTargetCandidate[],
  blockedPhones: string[],
) {
  const ranked = candidates
    .filter(
      (item): item is { value: string; source: ReplyTargetCandidateSource } =>
        typeof item.value === "string",
    )
    .map((item) => ({ ...item, value: item.value.trim() }))
    .filter((item) => !!item.value)
    .filter((item) => !isGroupJid(item.value))
    .filter((item) => !isBlockedTarget(item.value, blockedPhones))
    .map((item) => ({
      value: item.value,
      score: scoreReplyTarget(item.value, item.source),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.value ?? null;
}

function normalizePhoneForState(rawTarget: string) {
  return (
    normalizeIncomingPhone(rawTarget) ||
    rawTarget
      .replace(/@s\.whatsapp\.net$/i, "")
      .replace(/@c\.us$/i, "")
      .replace(/@lid$/i, "")
  );
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

function unwrapInboundMessage(
  messageObj: Record<string, unknown>,
): Record<string, unknown> {
  const wrappers = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
  ];

  let current: Record<string, unknown> = messageObj;
  let advanced = true;

  while (advanced) {
    advanced = false;
    for (const wrapper of wrappers) {
      const wrapped =
        typeof current[wrapper] === "object" && current[wrapper]
          ? (current[wrapper] as Record<string, unknown>)
          : null;
      const nested =
        wrapped && typeof wrapped.message === "object" && wrapped.message
          ? (wrapped.message as Record<string, unknown>)
          : null;
      if (nested) {
        current = nested;
        advanced = true;
        break;
      }
    }
  }

  return current;
}

function extractNativeFlowSelectedId(messageObj: Record<string, unknown>) {
  const interactive =
    typeof messageObj.interactiveResponseMessage === "object" &&
    messageObj.interactiveResponseMessage
      ? (messageObj.interactiveResponseMessage as Record<string, unknown>)
      : null;
  if (!interactive) return null;

  const nativeFlow =
    typeof interactive.nativeFlowResponseMessage === "object" &&
    interactive.nativeFlowResponseMessage
      ? (interactive.nativeFlowResponseMessage as Record<string, unknown>)
      : null;
  if (!nativeFlow) return null;

  const paramsJson = nativeFlow.paramsJson;
  if (typeof paramsJson === "string" && paramsJson.trim()) {
    try {
    const parsed = JSON.parse(paramsJson) as Record<string, unknown>;
      const candidate =
        parsed.id ??
        parsed.selectedId ??
        parsed.selected_id ??
        parsed.rowId ??
        parsed.row_id;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    } catch {
      // Ignore parse failures and try direct fields.
    }
  }

  const directCandidate =
    nativeFlow.id ??
    nativeFlow.selectedId ??
    nativeFlow.selected_id ??
    nativeFlow.rowId ??
    nativeFlow.row_id;
  if (typeof directCandidate === "string" && directCandidate.trim()) {
    return directCandidate.trim();
  }

  return null;
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

    if (resolveWhatsAppProvider(settings.whatsappProvider) !== "EVOLUTION") {
      return NextResponse.json({ received: true, ignored: "PROVIDER_MISMATCH" });
    }

    const configuredWebhookToken = settings.evolutionWebhookToken?.trim();
    if (configuredWebhookToken) {
      const receivedToken = resolveWebhookToken(req);
      if (!receivedToken || receivedToken !== configuredWebhookToken) {
        return NextResponse.json(
          { error: "Token do webhook inválido." },
          { status: 401 },
        );
      }
    }

    const body = await req.json();

    // Accept both "messages.upsert" and "messages_upsert".
    const eventName =
      typeof body?.event === "string" ? body.event.toLowerCase() : "";
    const normalizedEventName = eventName.replace(/_/g, ".");
    if (normalizedEventName !== "messages.upsert") {
      return NextResponse.json({ received: true });
    }

    const data = body?.data;
    if (!data || !data.key) {
      return NextResponse.json({ received: true });
    }

    // Ignore messages sent by the bot itself
    if (data.key.fromMe) {
      return NextResponse.json({ received: true });
    }

    const remoteJid = data.key.remoteJid;
    if (typeof remoteJid === "string" && /@lid$/i.test(remoteJid)) {
      console.info(
        `[LID DEBUG] remoteJid=${remoteJid}, ` +
          `data.senderPn=${data?.senderPn ?? "absent"}, ` +
          `data.key.senderPn=${data?.key?.senderPn ?? "absent"}, ` +
          `data.remoteJidAlt=${data?.remoteJidAlt ?? "absent"}, ` +
          `data.sender=${data?.sender ?? "absent"}, ` +
          `data.key.participant=${data?.key?.participant ?? "absent"}, ` +
          `body.sender=${body?.sender ?? "absent"}, ` +
          `data.pushName=${data?.pushName ?? "absent"}`,
      );
    }
    const ownClinicPhone = normalizeIncomingPhone(settings.whatsappPhone);
    const senderPhoneFromPayload = normalizeIncomingPhone(body?.sender);
    const blockedPhones = uniqueStringList(
      [ownClinicPhone].filter((value): value is string => !!value),
    );
    if (
      senderPhoneFromPayload &&
      ownClinicPhone &&
      arePhonesEquivalent(senderPhoneFromPayload, ownClinicPhone)
    ) {
      blockedPhones.push(senderPhoneFromPayload);
    }
    let replyTarget = pickReplyTarget(
      [
        { value: data?.senderPn, source: "sender_pn" },
        { value: data?.key?.senderPn, source: "sender_pn" },
        { value: data?.remoteJidAlt, source: "remote_jid_alt" },
        { value: remoteJid, source: "remote_jid" },
        { value: data?.sender, source: "data_sender" },
        { value: data?.key?.participant, source: "participant" },
        { value: body?.sender, source: "body_sender" },
      ],
      blockedPhones,
    );
    if (
      replyTarget &&
      /@lid$/i.test(replyTarget) &&
      settings.evolutionApiUrl &&
      settings.evolutionInstanceName &&
      settings.evolutionApiToken &&
      typeof data?.pushName === "string"
    ) {
      const resolvedLidReplyTarget = await resolveLidReplyTarget({
        evolutionApiUrl: settings.evolutionApiUrl,
        evolutionInstanceName: settings.evolutionInstanceName,
        evolutionApiToken: settings.evolutionApiToken,
        lidTarget: replyTarget,
        pushName: data.pushName,
      });
      if (resolvedLidReplyTarget) {
        replyTarget = resolvedLidReplyTarget;
      }
    }
    if (!replyTarget) {
      // Ignore group messages
      return NextResponse.json({ received: true });
    }
    if (/@lid$/i.test(replyTarget)) {
      console.warn(
        `Evolution webhook: reply target is @lid (${replyTarget}). ` +
          `senderPn=${data?.senderPn ?? "absent"}, remoteJidAlt=${data?.remoteJidAlt ?? "absent"}, ` +
          `pushName=${data?.pushName ?? "absent"}. Will attempt to send via @lid directly.`,
      );
    }

    const phone = normalizePhoneForState(replyTarget);

    // Extract message content
    const rawMessageObj = data.message as Record<string, unknown> | null;
    if (!rawMessageObj) {
      return NextResponse.json({ received: true });
    }
    const messageObj = unwrapInboundMessage(rawMessageObj) as Record<string, any>;

    let messageText = "";
    let messageSource: IncomingMessageSource = "unknown";

    if (messageObj.conversation) {
      messageText = messageObj.conversation;
      messageSource = "conversation";
    } else if (messageObj.extendedTextMessage?.text) {
      messageText = messageObj.extendedTextMessage.text;
      messageSource = "extended_text";
    } else if (
      messageObj.listResponseMessage?.singleSelectReply?.selectedRowId
    ) {
      messageText =
        messageObj.listResponseMessage.singleSelectReply.selectedRowId;
      messageSource = "list_selection";
    } else if (messageObj.buttonsResponseMessage?.selectedButtonId) {
      messageText = messageObj.buttonsResponseMessage.selectedButtonId;
      messageSource = "button_selection";
    } else if (messageObj.templateButtonReplyMessage?.selectedId) {
      messageText = messageObj.templateButtonReplyMessage.selectedId;
      messageSource = "button_selection";
    } else {
      const nativeFlowSelectedId = extractNativeFlowSelectedId(messageObj);
      if (nativeFlowSelectedId) {
        messageText = nativeFlowSelectedId;
        messageSource = "button_selection";
      }
    }

    if (!messageText) {
      console.info(
        "Evolution webhook: unsupported inbound message shape keys:",
        Object.keys(messageObj),
      );
    }

    messageText = messageText.trim();
    const storableMessageText = formatInboundMessageForDisplay(
      messageText,
      messageSource,
    );

    if (await isHumanHandoffActive(phone)) {
      console.info(
        "Skipping bot response because HUMAN_HANDOFF is active for phone:",
        phone,
      );
      if (storableMessageText) {
        try {
          await addInboundHandoffMessage(phone, storableMessageText);
        } catch (handoffMessageError) {
          console.error(
            "Error storing inbound handoff message:",
            handoffMessageError,
          );
        }
      }
      return NextResponse.json({ received: true, state: "HUMAN_HANDOFF" });
    }

    const reminderConfirmation = await tryConfirmBookingFromReminderReply(
      phone,
      messageText,
    );
    if (reminderConfirmation.handled) {
      let reminderResponse: string | EvolutionListMessage | undefined =
        reminderConfirmation.responseMessage;
      if (reminderConfirmation.action === "CANCEL_OR_RESCHEDULE") {
        const botReschedule = await processMessage(phone, "remarcar");
        if (botReschedule.state !== "DISABLED" && botReschedule.response) {
          reminderResponse = botReschedule.response;
        } else {
          reminderResponse =
            "Certo! Vamos remarcar. Envie a opcao desejada no menu para continuar.";
        }
      }

      if (
        reminderResponse &&
        settings.evolutionApiUrl &&
        settings.evolutionInstanceName &&
        settings.evolutionApiToken
      ) {
        const typing = normalizeTypingSettings(settings);
        sendConfiguredWhatsAppMessage({
          settings,
          phone: replyTarget,
          content: reminderResponse,
          delay: typing.delay,
          presence: typing.presence,
        }).catch((err) => {
          console.error("Error sending reminder confirmation message:", err);
        });
      }

      return NextResponse.json({
        received: true,
        state: "REMINDER_CONFIRMATION",
        action: reminderConfirmation.action,
        confirmed: reminderConfirmation.confirmed,
      });
    }

    if (!settings.isBotEnabled) {
      return NextResponse.json({ received: true, state: "DISABLED" });
    }

    const result = await processMessage(phone, messageText);

    if (result.state === "HUMAN_HANDOFF") {
      let handoffPersisted = false;
      try {
        await setHandoffMode({
          rawPhone: phone,
          mode: "HUMAN",
          reason: "Solicitacao de atendimento humano via fluxo do bot.",
          actor: "evolution-webhook",
        });
        handoffPersisted = true;
      } catch (handoffError) {
        console.error("Error persisting human handoff state:", handoffError);
      }

      if (handoffPersisted && storableMessageText) {
        try {
          await addInboundHandoffMessage(phone, storableMessageText);
        } catch (handoffMessageError) {
          console.error(
            "Error storing inbound handoff trigger message:",
            handoffMessageError,
          );
        }
      }
    }

    if (result.state !== "DISABLED" && result.response) {
      if (
        settings.evolutionApiUrl &&
        settings.evolutionInstanceName &&
        settings.evolutionApiToken
      ) {
        const typing = normalizeTypingSettings(settings);
        // We do not await this so we can return 200 OK to the webhook quickly
        sendConfiguredWhatsAppMessage({
          settings,
          phone: replyTarget,
          content: result.response,
          delay: typing.delay,
          presence: typing.presence,
        }).catch((err) => {
          console.error("Error sending evolution message:", err);
        });
      } else {
        console.warn(
          "Evolution API credentials not configured in Bot Settings.",
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Evolution Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
