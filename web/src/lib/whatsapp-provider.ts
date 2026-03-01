import type { EvolutionListMessage } from "@/lib/evolution-api";
import { sendEvolutionMessage } from "@/lib/evolution-api";
import { sendMetaMessage } from "@/lib/meta-api";

export type WhatsAppProvider = "EVOLUTION" | "META_CLOUD";
export type WhatsAppMessageContent = string | EvolutionListMessage;

export interface WhatsAppProviderSettings {
  whatsappProvider?: string | null;
  evolutionApiUrl?: string | null;
  evolutionInstanceName?: string | null;
  evolutionApiToken?: string | null;
  metaPhoneNumberId?: string | null;
  metaAccessToken?: string | null;
  metaApiVersion?: string | null;
}

export interface SendConfiguredWhatsAppMessageOptions {
  settings: WhatsAppProviderSettings;
  phone: string;
  content: WhatsAppMessageContent;
  delay?: number;
  presence?: "composing" | "recording" | "paused";
  typingEnabled?: boolean;
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = (value || "").trim();
  return normalized || null;
}

export function resolveWhatsAppProvider(value: unknown): WhatsAppProvider {
  return value === "META_CLOUD" ? "META_CLOUD" : "EVOLUTION";
}

export function resolveMissingProviderConfigMessage(
  settings: WhatsAppProviderSettings,
) {
  const provider = resolveWhatsAppProvider(settings.whatsappProvider);

  if (provider === "META_CLOUD") {
    const metaPhoneNumberId = normalizeOptional(settings.metaPhoneNumberId);
    const metaAccessToken = normalizeOptional(settings.metaAccessToken);
    const metaApiVersion = normalizeOptional(settings.metaApiVersion);

    if (!metaPhoneNumberId || !metaAccessToken) {
      return "Configuracao Meta Cloud incompleta. Preencha Phone Number ID e Access Token no painel.";
    }
    if (!metaApiVersion) {
      return "Configuracao Meta Cloud incompleta. Preencha a versao da API (ex.: v23.0).";
    }
    return null;
  }

  const evolutionApiUrl = normalizeOptional(settings.evolutionApiUrl);
  const evolutionInstanceName = normalizeOptional(settings.evolutionInstanceName);
  const evolutionApiToken = normalizeOptional(settings.evolutionApiToken);
  if (!evolutionApiUrl || !evolutionInstanceName || !evolutionApiToken) {
    return "Configuracao Evolution incompleta. Preencha URL, instancia e token no painel.";
  }
  return null;
}

export async function sendConfiguredWhatsAppMessage({
  settings,
  phone,
  content,
  delay,
  presence,
  typingEnabled,
}: SendConfiguredWhatsAppMessageOptions) {
  const provider = resolveWhatsAppProvider(settings.whatsappProvider);

  if (provider === "META_CLOUD") {
    const metaPhoneNumberId = normalizeOptional(settings.metaPhoneNumberId);
    const metaAccessToken = normalizeOptional(settings.metaAccessToken);
    const metaApiVersion = normalizeOptional(settings.metaApiVersion);

    if (!metaPhoneNumberId || !metaAccessToken || !metaApiVersion) {
      throw new Error(
        "Configuracao Meta Cloud incompleta. Preencha Phone Number ID, Access Token e versao da API.",
      );
    }

    return sendMetaMessage({
      metaPhoneNumberId,
      metaAccessToken,
      metaApiVersion,
      phone,
      content,
      delay,
      typingEnabled,
    });
  }

  const evolutionApiUrl = normalizeOptional(settings.evolutionApiUrl);
  const evolutionInstanceName = normalizeOptional(settings.evolutionInstanceName);
  const evolutionApiToken = normalizeOptional(settings.evolutionApiToken);

  if (!evolutionApiUrl || !evolutionInstanceName || !evolutionApiToken) {
    throw new Error(
      "Configuracao Evolution incompleta. Preencha URL, instancia e token.",
    );
  }

  return sendEvolutionMessage({
    evolutionApiUrl,
    evolutionInstanceName,
    evolutionApiToken,
    phone,
    content,
    delay,
    presence,
    typingEnabled,
  });
}
