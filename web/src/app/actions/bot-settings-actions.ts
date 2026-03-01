"use server";

import { revalidatePath } from "next/cache";
import { ensureAdminAccess } from "@/lib/clinic-access";
import { prisma } from "@/lib/prisma";
import {
  BOT_SETTINGS_SINGLETON_KEY,
  DEFAULT_BOT_SETTINGS_VALUES,
} from "@/lib/bot-settings";
import {
  type BookingReminderRule,
  normalizeBookingReminderRules,
  serializeBookingReminderRules,
} from "@/lib/booking-reminder-rules";

export interface SaveClinicBotSettingsInput {
  whatsappProvider?: "EVOLUTION" | "META_CLOUD";
  isBotEnabled: boolean;
  useInteractiveMessages: boolean;
  interactiveMenuTitle: string;
  interactiveMenuButtonText: string;
  interactiveMenuSectionTitle: string;
  interactiveBackLabel: string;
  interactiveBackDescription: string;
  greetingKeywords: string;
  availabilityDaysAhead: number;
  availabilityMaxDates: number;
  availabilityPreviewTimes: number;
  upcomingBookingsLimit: number;
  messageTypingDelayMs: number;
  messageTypingPresence: "composing" | "recording" | "paused";
  whatsappPhone?: string;
  evolutionApiUrl?: string;
  evolutionInstanceName?: string;
  evolutionApiToken?: string;
  evolutionWebhookToken?: string;
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  metaWebhookVerifyToken?: string;
  metaAppSecret?: string;
  metaApiVersion?: string;
  webhookTargetMode?: "system" | "n8n";
  systemWebhookBaseUrl?: string;
  n8nBaseUrl?: string;
  n8nWebhookMode?: "test" | "production";
  n8nWebhookPath?: string;
  welcomeMessage: string;
  firstContactMessage: string;
  fallbackMessage: string;
  businessHoursMessage: string;
  confirmMessage: string;
  cancelMessage: string;
  rescheduleMessage: string;
  humanHandoffMessage: string;
  bookingReminderRules: BookingReminderRule[];
  allowAutoCancel: boolean;
  allowAutoReschedule: boolean;
}

export interface SyncEvolutionInstanceInput {
  evolutionApiUrl?: string;
  evolutionInstanceName?: string;
  evolutionApiToken?: string;
}

export interface GetEvolutionConnectionStateInput {
  evolutionApiUrl?: string;
  evolutionInstanceName?: string;
  evolutionApiToken?: string;
}

export interface ConfigureEvolutionWebhookInput {
  evolutionApiUrl?: string;
  evolutionInstanceName?: string;
  evolutionApiToken?: string;
  evolutionWebhookToken?: string;
  webhookTargetMode?: "system" | "n8n";
  systemWebhookBaseUrl?: string;
  n8nBaseUrl?: string;
  webhookMode?: "test" | "production";
  webhookPath?: string;
}

type EvolutionConnectionState = "open" | "close" | "connecting" | "unknown";

interface EvolutionWebhookConfig {
  enabled: boolean;
  url: string | null;
  events: string[];
  webhookByEvents: boolean;
  webhookBase64: boolean;
}

type SyncEvolutionInstanceResult =
  | {
      success: true;
      connectionState: EvolutionConnectionState;
      qrCodeBase64: string | null;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
    };

type DeleteEvolutionInstanceResult =
  | {
      success: true;
      deleted: boolean;
      alreadyMissing?: boolean;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
    };

type DisconnectEvolutionInstanceResult =
  | {
      success: true;
      disconnected: boolean;
      alreadyMissing?: boolean;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
    };

type GetEvolutionConnectionStateResult =
  | {
      success: true;
      connectionState: EvolutionConnectionState;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
    };

type ConfigureEvolutionWebhookResult =
  | {
      success: true;
      webhook: EvolutionWebhookConfig;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
    };

type FindEvolutionWebhookResult =
  | {
      success: true;
      webhook: EvolutionWebhookConfig;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
    };

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim() || "";
  return normalized || null;
}

function normalizeWhatsAppProvider(
  value?: "EVOLUTION" | "META_CLOUD" | null,
): "EVOLUTION" | "META_CLOUD" {
  return value === "META_CLOUD" ? "META_CLOUD" : "EVOLUTION";
}

function normalizeMessage(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`O campo "${label}" e obrigatorio.`);
  }
  if (normalized.length > 1000) {
    throw new Error(`O campo "${label}" suporta no maximo 1000 caracteres.`);
  }
  return normalized;
}

function normalizeShortText(value: string, label: string, maxLength = 120) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`O campo "${label}" e obrigatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(
      `O campo "${label}" suporta no maximo ${maxLength} caracteres.`,
    );
  }
  return normalized;
}

function normalizeIntegerRange(
  value: number,
  label: string,
  min: number,
  max: number,
) {
  if (!Number.isFinite(value)) {
    throw new Error(`O campo "${label}" deve ser numerico.`);
  }

  const normalized = Math.trunc(value);
  if (normalized < min || normalized > max) {
    throw new Error(`O campo "${label}" deve estar entre ${min} e ${max}.`);
  }

  return normalized;
}

function normalizeTypingPresence(
  value: unknown,
): "composing" | "recording" | "paused" {
  if (value !== "composing" && value !== "recording" && value !== "paused") {
    throw new Error(
      'Presenca de digitacao invalida. Use "composing", "recording" ou "paused".',
    );
  }
  return value;
}

function normalizeWhatsAppPhone(value?: string) {
  const normalized = value?.trim() || "";
  if (!normalized) return null;

  let digits = normalized.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length < 10 || digits.length > 11) {
    throw new Error(
      "Numero de WhatsApp invalido. Use DDD + numero com 10 ou 11 digitos.",
    );
  }

  const ddd = digits.slice(0, 2);
  const localNumber = digits.slice(2);
  const splitIndex = localNumber.length === 9 ? 5 : 4;
  const formattedLocal = `${localNumber.slice(0, splitIndex)}-${localNumber.slice(splitIndex)}`;

  return `+55 (${ddd}) ${formattedLocal}`;
}

function normalizeWhatsAppPhoneForComparison(value?: string | null) {
  if (!value) return null;
  try {
    return normalizeWhatsAppPhone(value);
  } catch {
    const fallback = value.trim();
    return fallback || null;
  }
}

function normalizeEvolutionApiUrl(value?: string) {
  const normalized = value?.trim() || "";
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("URL da Evolution API invalida.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("A URL da Evolution API deve usar http ou https.");
  }

  return normalized.replace(/\/+$/, "");
}

function normalizeEvolutionApiUrlForComparison(value?: string | null) {
  const normalized = value?.trim() || "";
  if (!normalized) return null;
  return normalized.replace(/\/+$/, "");
}

function normalizeMetaApiVersion(value?: string | null) {
  const normalized = (value || "").trim();
  if (!normalized) return DEFAULT_BOT_SETTINGS_VALUES.metaApiVersion;
  if (!/^v\d+\.\d+$/i.test(normalized)) {
    throw new Error('Versao da Meta invalida. Use formato como "v23.0".');
  }
  return normalized.toLowerCase();
}

function buildEvolutionApiBaseCandidates(evolutionApiUrl: string) {
  const normalized = evolutionApiUrl.replace(/\/+$/, "");
  const candidates = [normalized];

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === "evolution-api") {
      const localhostFallback = new URL(parsed.toString());
      localhostFallback.hostname = "localhost";
      candidates.push(localhostFallback.toString().replace(/\/+$/, ""));
    }
  } catch {
    // Ignore URL parse errors here; validation already happens earlier.
  }

  return Array.from(new Set(candidates));
}

function buildEvolutionConnectionErrorMessage(evolutionApiUrl: string) {
  if (evolutionApiUrl.includes("evolution-api")) {
    return `Falha de conexao com a Evolution API (${evolutionApiUrl}). Se o sistema estiver rodando fora do Docker, use http://localhost:8080 na URL da Evolution.`;
  }
  return `Falha de conexao com a Evolution API (${evolutionApiUrl}). Verifique se a URL/porta estao acessiveis.`;
}

async function fetchEvolutionApi(
  evolutionApiUrl: string,
  path: string,
  init: RequestInit,
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = buildEvolutionApiBaseCandidates(evolutionApiUrl);
  let lastError: unknown = null;

  for (const baseUrl of candidates) {
    try {
      return await fetch(`${baseUrl}${normalizedPath}`, {
        ...init,
        cache: "no-store",
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw new Error(buildEvolutionConnectionErrorMessage(evolutionApiUrl));
  }
  throw new Error(buildEvolutionConnectionErrorMessage(evolutionApiUrl));
}

function normalizeN8nBaseUrl(value?: string) {
  const normalized = value?.trim() || "";
  if (!normalized) return DEFAULT_BOT_SETTINGS_VALUES.n8nBaseUrl;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("URL base do n8n invalida.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("A URL base do n8n deve usar http ou https.");
  }

  return normalized.replace(/\/+$/, "");
}

function normalizeWebhookTargetMode(value?: "system" | "n8n") {
  return value === "n8n"
    ? "n8n"
    : DEFAULT_BOT_SETTINGS_VALUES.webhookTargetMode;
}

function normalizeSystemWebhookBaseUrl(value?: string) {
  const normalized = value?.trim() || "";
  if (!normalized) return DEFAULT_BOT_SETTINGS_VALUES.systemWebhookBaseUrl;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("URL base do sistema invalida.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("A URL base do sistema deve usar http ou https.");
  }

  return normalized.replace(/\/+$/, "");
}

function normalizeWebhookPath(value?: string) {
  const normalized =
    value?.trim() || DEFAULT_BOT_SETTINGS_VALUES.n8nWebhookPath;
  return normalized.replace(/^\/+|\/+$/g, "");
}

function normalizeWebhookMode(value?: "test" | "production") {
  return value === "test" ? "test" : DEFAULT_BOT_SETTINGS_VALUES.n8nWebhookMode;
}

function validateEvolutionConnectionInput(input: SyncEvolutionInstanceInput) {
  const evolutionApiUrl = normalizeEvolutionApiUrl(input.evolutionApiUrl);
  const evolutionInstanceName = normalizeOptional(input.evolutionInstanceName);
  const evolutionApiToken = normalizeOptional(input.evolutionApiToken);

  if (!evolutionApiUrl || !evolutionInstanceName || !evolutionApiToken) {
    throw new Error(
      "Preencha URL, nome da instancia e token da Evolution para sincronizar o WhatsApp.",
    );
  }

  return {
    evolutionApiUrl,
    evolutionInstanceName,
    evolutionApiToken,
  };
}

function hasCompleteEvolutionConfig(config: {
  evolutionApiUrl: string | null;
  evolutionInstanceName: string | null;
  evolutionApiToken: string | null;
}) {
  return (
    !!config.evolutionApiUrl &&
    !!config.evolutionInstanceName &&
    !!config.evolutionApiToken
  );
}

function validateAndNormalize(input: SaveClinicBotSettingsInput) {
  const whatsappProvider = normalizeWhatsAppProvider(input.whatsappProvider);
  const evolutionApiUrl = normalizeEvolutionApiUrl(input.evolutionApiUrl);
  const evolutionInstanceName = normalizeOptional(input.evolutionInstanceName);
  const evolutionApiToken = normalizeOptional(input.evolutionApiToken);
  const evolutionWebhookToken = normalizeOptional(input.evolutionWebhookToken);
  const metaPhoneNumberId = normalizeOptional(input.metaPhoneNumberId);
  const metaAccessToken = normalizeOptional(input.metaAccessToken);
  const metaWebhookVerifyToken = normalizeOptional(input.metaWebhookVerifyToken);
  const metaAppSecret = normalizeOptional(input.metaAppSecret);
  const metaApiVersion = normalizeMetaApiVersion(input.metaApiVersion);
  const whatsappPhone = normalizeWhatsAppPhone(input.whatsappPhone);
  const webhookTargetMode = normalizeWebhookTargetMode(input.webhookTargetMode);
  const systemWebhookBaseUrl = normalizeSystemWebhookBaseUrl(
    input.systemWebhookBaseUrl,
  );
  const n8nBaseUrl = normalizeN8nBaseUrl(input.n8nBaseUrl);
  const n8nWebhookMode = normalizeWebhookMode(input.n8nWebhookMode);
  const n8nWebhookPath = normalizeWebhookPath(input.n8nWebhookPath);
  const bookingReminderRules = normalizeBookingReminderRules(
    input.bookingReminderRules,
  );

  const hasEvolutionConfig =
    !!evolutionApiUrl || !!evolutionInstanceName || !!evolutionApiToken;

  if (whatsappProvider === "EVOLUTION") {
    if (
      !evolutionApiUrl ||
      !evolutionInstanceName ||
      !evolutionApiToken ||
      !evolutionWebhookToken
    ) {
      throw new Error(
        "Para integrar com Evolution API, preencha URL, instancia, token da Evolution e token do webhook.",
      );
    }
  } else if (hasEvolutionConfig) {
    if (!evolutionApiUrl || !evolutionInstanceName || !evolutionApiToken) {
      throw new Error(
        "Preencha todos os campos da Evolution ou deixe-os em branco.",
      );
    }
  }

  if (whatsappProvider === "META_CLOUD") {
    if (!metaPhoneNumberId || !metaAccessToken || !metaWebhookVerifyToken) {
      throw new Error(
        "Para integrar com Meta Cloud API, preencha Phone Number ID, Access Token e Verify Token.",
      );
    }
  }

  return {
    whatsappProvider,
    isBotEnabled: !!input.isBotEnabled,
    useInteractiveMessages:
      whatsappProvider === "META_CLOUD" ? !!input.useInteractiveMessages : false,
    interactiveMenuTitle: normalizeShortText(
      input.interactiveMenuTitle,
      "Titulo do menu interativo",
      24,
    ),
    interactiveMenuButtonText: normalizeShortText(
      input.interactiveMenuButtonText,
      "Texto do botao do menu interativo",
      20,
    ),
    interactiveMenuSectionTitle: normalizeShortText(
      input.interactiveMenuSectionTitle,
      "Titulo da secao do menu interativo",
      40,
    ),
    interactiveBackLabel: normalizeShortText(
      input.interactiveBackLabel,
      "Rotulo do botao voltar",
      24,
    ),
    interactiveBackDescription: normalizeShortText(
      input.interactiveBackDescription,
      "Descricao do botao voltar",
      72,
    ),
    greetingKeywords: normalizeMessage(
      input.greetingKeywords,
      "Palavras-chave de saudacao",
    ),
    availabilityDaysAhead: normalizeIntegerRange(
      input.availabilityDaysAhead,
      "Janela de dias para disponibilidade",
      1,
      60,
    ),
    availabilityMaxDates: normalizeIntegerRange(
      input.availabilityMaxDates,
      "Quantidade maxima de dias com horario",
      1,
      10,
    ),
    availabilityPreviewTimes: normalizeIntegerRange(
      input.availabilityPreviewTimes,
      "Quantidade de horarios no resumo",
      1,
      10,
    ),
    upcomingBookingsLimit: normalizeIntegerRange(
      input.upcomingBookingsLimit,
      "Limite de agendamentos exibidos",
      1,
      20,
    ),
    messageTypingDelayMs: normalizeIntegerRange(
      input.messageTypingDelayMs,
      "Delay de digitacao",
      0,
      30000,
    ),
    messageTypingPresence: normalizeTypingPresence(input.messageTypingPresence),
    whatsappPhone,
    evolutionApiUrl,
    evolutionInstanceName,
    evolutionApiToken,
    evolutionWebhookToken,
    metaPhoneNumberId,
    metaAccessToken,
    metaWebhookVerifyToken,
    metaAppSecret,
    metaApiVersion,
    webhookTargetMode,
    systemWebhookBaseUrl,
    n8nBaseUrl,
    n8nWebhookMode,
    n8nWebhookPath,
    welcomeMessage: normalizeMessage(input.welcomeMessage, "Boas-vindas"),
    firstContactMessage: normalizeMessage(
      input.firstContactMessage,
      "Primeiro contato",
    ),
    fallbackMessage: normalizeMessage(input.fallbackMessage, "Fallback"),
    businessHoursMessage: normalizeMessage(
      input.businessHoursMessage,
      "Horario de atendimento",
    ),
    confirmMessage: normalizeMessage(input.confirmMessage, "Confirmacao"),
    cancelMessage: normalizeMessage(input.cancelMessage, "Cancelamento"),
    rescheduleMessage: normalizeMessage(input.rescheduleMessage, "Remarcacao"),
    humanHandoffMessage: normalizeMessage(
      input.humanHandoffMessage,
      "Encaminhamento humano",
    ),
    bookingReminderRulesJson:
      serializeBookingReminderRules(bookingReminderRules),
    allowAutoCancel: !!input.allowAutoCancel,
    allowAutoReschedule: !!input.allowAutoReschedule,
  };
}

function revalidateBotSettingsPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
}

function normalizeConnectionState(rawState: unknown): EvolutionConnectionState {
  if (typeof rawState !== "string") return "unknown";
  const normalized = rawState.trim().toLowerCase();
  if (normalized === "open") return "open";
  if (normalized === "close") return "close";
  if (normalized === "connecting") return "connecting";
  return "unknown";
}

function parsePossibleDataUri(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.startsWith("data:image")) return normalized;
  return `data:image/png;base64,${normalized}`;
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

function buildEvolutionHeaders(token: string) {
  return {
    apikey: token,
    "Content-Type": "application/json",
  };
}

function normalizeWebhookPayload(
  payload: Record<string, unknown> | null,
): EvolutionWebhookConfig {
  // v2 returns flat keys with camelCase; v1 used snake_case
  return {
    enabled: !!payload?.enabled,
    url: typeof payload?.url === "string" ? payload.url : null,
    events: Array.isArray(payload?.events)
      ? payload.events.filter(
          (event): event is string => typeof event === "string",
        )
      : [],
    webhookByEvents: !!(payload?.webhookByEvents ?? payload?.webhook_by_events),
    webhookBase64: !!(payload?.webhookBase64 ?? payload?.webhook_base64),
  };
}

function buildN8nWebhookUrl(input: {
  n8nBaseUrl?: string;
  webhookMode?: "test" | "production";
  webhookPath?: string;
}) {
  const baseUrl = normalizeN8nBaseUrl(input.n8nBaseUrl);
  const webhookPath = normalizeWebhookPath(input.webhookPath);
  const webhookMode = input.webhookMode === "test" ? "test" : "production";
  const webhookPrefix = webhookMode === "test" ? "webhook-test" : "webhook";
  return `${baseUrl}/${webhookPrefix}/${webhookPath}`;
}

function buildSystemWebhookUrl(input: { systemWebhookBaseUrl?: string }) {
  const baseUrl = normalizeSystemWebhookBaseUrl(input.systemWebhookBaseUrl);
  return `${baseUrl}/api/evolution/webhook`;
}

function resolveSystemWebhookBaseForEvolution(input: {
  systemWebhookBaseUrl?: string;
  evolutionApiUrl?: string;
}) {
  const baseUrl = normalizeSystemWebhookBaseUrl(input.systemWebhookBaseUrl);
  const evolutionApiUrl = input.evolutionApiUrl?.trim();
  if (!evolutionApiUrl) return baseUrl;

  try {
    const systemUrl = new URL(baseUrl);
    const evolutionUrl = new URL(evolutionApiUrl);
    const isLocalSystemHost =
      systemUrl.hostname === "localhost" ||
      systemUrl.hostname === "127.0.0.1" ||
      systemUrl.hostname === "::1";
    const isDockerEvolutionHost = evolutionUrl.hostname === "evolution-api";

    if (isLocalSystemHost && isDockerEvolutionHost) {
      systemUrl.hostname = "host.docker.internal";
      return systemUrl.toString().replace(/\/+$/, "");
    }
  } catch {
    // Validation is handled elsewhere; keep original base URL if parse fails.
  }

  return baseUrl;
}

function buildWebhookTargetUrl(input: ConfigureEvolutionWebhookInput) {
  const targetMode = normalizeWebhookTargetMode(input.webhookTargetMode);
  if (targetMode === "n8n") {
    return buildN8nWebhookUrl({
      n8nBaseUrl: input.n8nBaseUrl,
      webhookMode: input.webhookMode,
      webhookPath: input.webhookPath,
    });
  }
  return buildSystemWebhookUrl({
    systemWebhookBaseUrl: resolveSystemWebhookBaseForEvolution({
      systemWebhookBaseUrl: input.systemWebhookBaseUrl,
      evolutionApiUrl: input.evolutionApiUrl,
    }),
  });
}

async function fetchEvolutionConnectionState(config: {
  evolutionApiUrl: string;
  evolutionInstanceName: string;
  evolutionApiToken: string;
}) {
  const headers = buildEvolutionHeaders(config.evolutionApiToken);
  const response = await fetchEvolutionApi(
    config.evolutionApiUrl,
    `/instance/connectionState/${encodeURIComponent(config.evolutionInstanceName)}`,
    {
      method: "GET",
      headers,
    },
  );

  const payload = await safeParseResponse(response);
  if (!response.ok) {
    if (response.status === 404 && isMissingInstanceError(payload)) {
      return "close" as const;
    }

    throw new Error("Falha ao consultar estado da instancia na Evolution.");
  }

  return normalizeConnectionState(
    payload?.instance &&
      typeof payload.instance === "object" &&
      "state" in payload.instance
      ? (payload.instance as { state?: unknown }).state
      : payload?.state,
  );
}

function isMissingInstanceError(payload: Record<string, unknown> | null) {
  if (!payload || typeof payload !== "object") return false;
  if (!("response" in payload) || typeof payload.response !== "object") {
    return false;
  }

  const responseObj = payload.response as { message?: unknown };
  if (!Array.isArray(responseObj.message)) return false;

  return responseObj.message.some((item) => {
    if (typeof item !== "string") return false;
    return item.toLowerCase().includes("instance does not exist");
  });
}

export async function syncEvolutionInstanceAction(
  input: SyncEvolutionInstanceInput,
): Promise<SyncEvolutionInstanceResult> {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const config = validateEvolutionConnectionInput(input);
    const headers = buildEvolutionHeaders(config.evolutionApiToken);

    const stateResponse = await fetchEvolutionApi(
      config.evolutionApiUrl,
      `/instance/connectionState/${encodeURIComponent(config.evolutionInstanceName)}`,
      {
        method: "GET",
        headers,
      },
    );

    const statePayload = await safeParseResponse(stateResponse);

    if (!stateResponse.ok) {
      if (
        stateResponse.status === 404 &&
        isMissingInstanceError(statePayload)
      ) {
        const createResponse = await fetchEvolutionApi(
          config.evolutionApiUrl,
          "/instance/create",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              instanceName: config.evolutionInstanceName,
              integration: "WHATSAPP-BAILEYS",
              qrcode: true,
            }),
          },
        );

        const createPayload = await safeParseResponse(createResponse);
        if (!createResponse.ok) {
          return {
            success: false,
            error: "Falha ao criar instancia na Evolution API.",
            details: createPayload,
          };
        }
      } else {
        return {
          success: false,
          error: "Falha ao consultar estado da instancia na Evolution.",
          details: statePayload,
        };
      }
    }

    const connectionState = normalizeConnectionState(
      statePayload?.instance &&
        typeof statePayload.instance === "object" &&
        "state" in statePayload.instance
        ? (statePayload.instance as { state?: unknown }).state
        : statePayload?.state,
    );

    if (connectionState === "open") {
      return {
        success: true,
        connectionState,
        qrCodeBase64: null,
      };
    }

    // When state is "connecting", the QR was already scanned and pairing is
    // in progress. Calling /instance/connect would reset it and generate a
    // new QR, destroying the ongoing pairing. Instead, poll connectionState
    // until it becomes "open" or we time out.
    if (connectionState === "connecting") {
      const MAX_POLLS = 3;
      const POLL_INTERVAL_MS = 2000;

      for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const polledState = await fetchEvolutionConnectionState(config);

        if (polledState === "open") {
          return {
            success: true,
            connectionState: "open",
            qrCodeBase64: null,
          };
        }

        if (polledState === "close") {
          // Connection was dropped — break, fall through to connect flow
          break;
        }
      }

      // Still connecting after all polls — check one more time
      const finalState = await fetchEvolutionConnectionState(config);
      if (finalState === "open") {
        return {
          success: true,
          connectionState: "open",
          qrCodeBase64: null,
        };
      }

      // Timed out — fall through to /instance/connect to generate a fresh QR
    }

    // State is "close" or "unknown" — need a fresh QR code
    const connectResponse = await fetchEvolutionApi(
      config.evolutionApiUrl,
      `/instance/connect/${encodeURIComponent(config.evolutionInstanceName)}`,
      {
        method: "GET",
        headers,
      },
    );

    const connectPayload = await safeParseResponse(connectResponse);

    if (!connectResponse.ok) {
      return {
        success: false,
        error: "Falha ao gerar QR Code na Evolution.",
        details: connectPayload,
      };
    }

    const qrCodeBase64 = parsePossibleDataUri(connectPayload?.base64);
    if (!qrCodeBase64) {
      // No QR returned — the instance may already be connected.
      const recheckState = await fetchEvolutionConnectionState(config);
      if (recheckState === "open") {
        return {
          success: true,
          connectionState: "open",
          qrCodeBase64: null,
        };
      }

      return {
        success: false,
        error: "A Evolution nao retornou QR Code para essa instancia.",
        details: connectPayload,
      };
    }

    return {
      success: true,
      connectionState:
        connectionState === "unknown" ? "connecting" : connectionState,
      qrCodeBase64,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Falha ao sincronizar WhatsApp pela Evolution.",
    };
  }
}

export async function getEvolutionConnectionStateAction(
  input: GetEvolutionConnectionStateInput,
): Promise<GetEvolutionConnectionStateResult> {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const config = validateEvolutionConnectionInput(input);
    const connectionState = await fetchEvolutionConnectionState(config);

    return {
      success: true,
      connectionState,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Falha ao consultar o estado da instancia na Evolution.",
    };
  }
}

export async function applyEvolutionWebhookAction(
  input: ConfigureEvolutionWebhookInput,
): Promise<ConfigureEvolutionWebhookResult> {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const config = validateEvolutionConnectionInput(input);
    const webhookAuthToken = normalizeOptional(input.evolutionWebhookToken);
    if (!webhookAuthToken) {
      return {
        success: false,
        error:
          "Token do webhook obrigatorio para aplicar webhook seguro na Evolution.",
      };
    }
    const headers = buildEvolutionHeaders(config.evolutionApiToken);
    const targetWebhookUrl = buildWebhookTargetUrl(input);

    const response = await fetchEvolutionApi(
      config.evolutionApiUrl,
      `/webhook/set/${encodeURIComponent(config.evolutionInstanceName)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: targetWebhookUrl,
            headers: {
              Authorization: `Bearer ${webhookAuthToken}`,
              "x-evolution-webhook-token": webhookAuthToken,
              "x-webhook-token": webhookAuthToken,
            },
            webhookByEvents: false,
            webhookBase64: false,
            events: ["MESSAGES_UPSERT"],
          },
        }),
      },
    );

    const payload = await safeParseResponse(response);
    if (!response.ok) {
      return {
        success: false,
        error: "Falha ao aplicar webhook na Evolution.",
        details: payload,
      };
    }

    // v2 returns flat webhook fields directly in the payload
    const webhookPayload = payload;

    return {
      success: true,
      webhook: normalizeWebhookPayload(webhookPayload),
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Falha ao configurar webhook na Evolution.",
    };
  }
}

export async function findEvolutionWebhookAction(
  input: SyncEvolutionInstanceInput,
): Promise<FindEvolutionWebhookResult> {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const config = validateEvolutionConnectionInput(input);
    const headers = buildEvolutionHeaders(config.evolutionApiToken);

    const response = await fetchEvolutionApi(
      config.evolutionApiUrl,
      `/webhook/find/${encodeURIComponent(config.evolutionInstanceName)}`,
      {
        method: "GET",
        headers,
      },
    );

    const payload = await safeParseResponse(response);
    if (!response.ok) {
      return {
        success: false,
        error: "Falha ao consultar webhook da Evolution.",
        details: payload,
      };
    }

    return {
      success: true,
      webhook: normalizeWebhookPayload(payload),
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Falha ao verificar webhook configurado na Evolution.",
    };
  }
}

export async function deleteEvolutionInstanceAction(
  input: SyncEvolutionInstanceInput,
): Promise<DeleteEvolutionInstanceResult> {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const config = validateEvolutionConnectionInput(input);
    const headers = buildEvolutionHeaders(config.evolutionApiToken);
    const encodedInstanceName = encodeURIComponent(
      config.evolutionInstanceName,
    );

    // Best effort logout before deletion.
    try {
      await fetchEvolutionApi(
        config.evolutionApiUrl,
        `/instance/logout/${encodedInstanceName}`,
        {
          method: "DELETE",
          headers,
        },
      );
    } catch {
      // Ignore logout errors and continue deletion.
    }

    const deleteResponse = await fetchEvolutionApi(
      config.evolutionApiUrl,
      `/instance/delete/${encodedInstanceName}`,
      {
        method: "DELETE",
        headers,
      },
    );

    const deletePayload = await safeParseResponse(deleteResponse);
    if (!deleteResponse.ok) {
      if (
        deleteResponse.status === 404 &&
        isMissingInstanceError(deletePayload)
      ) {
        return { success: true, deleted: false, alreadyMissing: true };
      }

      return {
        success: false,
        error: "Falha ao excluir instancia na Evolution API.",
        details: deletePayload,
      };
    }

    return { success: true, deleted: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Falha ao excluir instancia da Evolution.",
    };
  }
}

export async function disconnectEvolutionInstanceAction(
  input: SyncEvolutionInstanceInput,
): Promise<DisconnectEvolutionInstanceResult> {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const config = validateEvolutionConnectionInput(input);
    const headers = buildEvolutionHeaders(config.evolutionApiToken);
    const encodedInstanceName = encodeURIComponent(
      config.evolutionInstanceName,
    );

    const logoutResponse = await fetchEvolutionApi(
      config.evolutionApiUrl,
      `/instance/logout/${encodedInstanceName}`,
      {
        method: "DELETE",
        headers,
      },
    );

    const logoutPayload = await safeParseResponse(logoutResponse);
    if (!logoutResponse.ok) {
      if (
        logoutResponse.status === 404 &&
        isMissingInstanceError(logoutPayload)
      ) {
        return { success: true, disconnected: false, alreadyMissing: true };
      }

      return {
        success: false,
        error: "Falha ao desconectar instancia na Evolution API.",
        details: logoutPayload,
      };
    }

    return { success: true, disconnected: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Falha ao desconectar instancia da Evolution.",
    };
  }
}

export async function saveClinicBotSettingsAction(
  input: SaveClinicBotSettingsInput,
) {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const payload = validateAndNormalize(input);
    const actorUser = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { id: true },
    });
    const updatedByUserRelation = actorUser
      ? { connect: { id: actorUser.id } }
      : { disconnect: true };
    const existingSettings = await prisma.clinicBotSettings.findUnique({
      where: { singletonKey: BOT_SETTINGS_SINGLETON_KEY },
      select: {
        whatsappProvider: true,
        whatsappPhone: true,
        evolutionApiUrl: true,
        evolutionInstanceName: true,
        evolutionApiToken: true,
        metaPhoneNumberId: true,
        metaAccessToken: true,
        metaWebhookVerifyToken: true,
        metaApiVersion: true,
      },
    });

    if (existingSettings) {
      const currentComparable = {
        whatsappProvider: normalizeWhatsAppProvider(
          existingSettings.whatsappProvider as "EVOLUTION" | "META_CLOUD" | null,
        ),
        whatsappPhone: normalizeWhatsAppPhoneForComparison(
          existingSettings.whatsappPhone,
        ),
        evolutionApiUrl: normalizeEvolutionApiUrlForComparison(
          existingSettings.evolutionApiUrl,
        ),
        evolutionInstanceName: normalizeOptional(
          existingSettings.evolutionInstanceName,
        ),
        evolutionApiToken: normalizeOptional(
          existingSettings.evolutionApiToken,
        ),
        metaPhoneNumberId: normalizeOptional(existingSettings.metaPhoneNumberId),
        metaAccessToken: normalizeOptional(existingSettings.metaAccessToken),
        metaWebhookVerifyToken: normalizeOptional(
          existingSettings.metaWebhookVerifyToken,
        ),
        metaApiVersion: normalizeMetaApiVersion(existingSettings.metaApiVersion),
      };

      const nextComparable = {
        whatsappProvider: normalizeWhatsAppProvider(payload.whatsappProvider),
        whatsappPhone: normalizeWhatsAppPhoneForComparison(
          payload.whatsappPhone,
        ),
        evolutionApiUrl: normalizeEvolutionApiUrlForComparison(
          payload.evolutionApiUrl,
        ),
        evolutionInstanceName: normalizeOptional(payload.evolutionInstanceName),
        evolutionApiToken: normalizeOptional(payload.evolutionApiToken),
        metaPhoneNumberId: normalizeOptional(payload.metaPhoneNumberId),
        metaAccessToken: normalizeOptional(payload.metaAccessToken),
        metaWebhookVerifyToken: normalizeOptional(payload.metaWebhookVerifyToken),
        metaApiVersion: normalizeMetaApiVersion(payload.metaApiVersion),
      };

      const integrationOrPhoneChanged =
        currentComparable.whatsappProvider !== nextComparable.whatsappProvider ||
        currentComparable.whatsappPhone !== nextComparable.whatsappPhone ||
        currentComparable.evolutionApiUrl !== nextComparable.evolutionApiUrl ||
        currentComparable.evolutionInstanceName !==
          nextComparable.evolutionInstanceName ||
        currentComparable.evolutionApiToken !==
          nextComparable.evolutionApiToken ||
        currentComparable.metaPhoneNumberId !==
          nextComparable.metaPhoneNumberId ||
        currentComparable.metaAccessToken !== nextComparable.metaAccessToken ||
        currentComparable.metaWebhookVerifyToken !==
          nextComparable.metaWebhookVerifyToken ||
        currentComparable.metaApiVersion !== nextComparable.metaApiVersion;

      if (
        integrationOrPhoneChanged &&
        currentComparable.whatsappProvider === "EVOLUTION" &&
        nextComparable.whatsappProvider === "EVOLUTION" &&
        hasCompleteEvolutionConfig({
          evolutionApiUrl: currentComparable.evolutionApiUrl,
          evolutionInstanceName: currentComparable.evolutionInstanceName,
          evolutionApiToken: currentComparable.evolutionApiToken,
        })
      ) {
        const currentConnectionState = await fetchEvolutionConnectionState({
          evolutionApiUrl: currentComparable.evolutionApiUrl!,
          evolutionInstanceName: currentComparable.evolutionInstanceName!,
          evolutionApiToken: currentComparable.evolutionApiToken!,
        });

        if (currentConnectionState === "open") {
          throw new Error(
            "Instancia conectada. Desconecte ou exclua a instancia antes de alterar numero, URL, nome ou token da Evolution.",
          );
        }
      }
    }

    await prisma.clinicBotSettings.upsert({
      where: { singletonKey: BOT_SETTINGS_SINGLETON_KEY },
      update: {
        ...payload,
        updatedByUser: updatedByUserRelation,
      },
      create: {
        singletonKey: BOT_SETTINGS_SINGLETON_KEY,
        ...DEFAULT_BOT_SETTINGS_VALUES,
        ...payload,
        ...(actorUser
          ? { updatedByUser: { connect: { id: actorUser.id } } }
          : {}),
      },
    });

    revalidateBotSettingsPages();
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao salvar configuracoes do bot." };
  }
}
