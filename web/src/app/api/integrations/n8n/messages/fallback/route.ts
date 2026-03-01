import { NextResponse } from "next/server";
import {
  BOT_SETTINGS_SINGLETON_KEY,
  DEFAULT_BOT_SETTINGS_VALUES,
} from "@/lib/bot-settings";
import { resolveEvolutionSendOptions } from "@/lib/evolution-message-options";
import { prisma } from "@/lib/prisma";
import {
  resolveMissingProviderConfigMessage,
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

function resolveN8nToken(req: Request) {
  const bearer = extractBearerToken(req.headers.get("authorization"));
  if (bearer) return bearer;

  const custom = req.headers.get("x-n8n-token");
  if (!custom) return null;
  return custom.trim() || null;
}

function normalizeTargetNumber(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "");
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  return digits || null;
}

export async function POST(req: Request) {
  try {
    const configuredToken = process.env.N8N_APPOINTMENTS_TOKEN?.trim();
    if (!configuredToken) {
      return NextResponse.json(
        {
          error:
            "Integração indisponível: configure N8N_APPOINTMENTS_TOKEN no ambiente.",
        },
        { status: 500 },
      );
    }

    const receivedToken = resolveN8nToken(req);
    if (!receivedToken || receivedToken !== configuredToken) {
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    const body = await req.json();
    const number = normalizeTargetNumber(
      body?.number ?? body?.phone ?? body?.remoteJid ?? body?.to,
    );
    const sendOptions = resolveEvolutionSendOptions(body);

    if (!number) {
      return NextResponse.json(
        {
          error:
            "Número inválido. Envie em number/phone/remoteJid/to (ex.: 5511999999999).",
        },
        { status: 400 },
      );
    }

    const botSettings = await prisma.clinicBotSettings.findUnique({
      where: { singletonKey: BOT_SETTINGS_SINGLETON_KEY },
      select: {
        isBotEnabled: true,
        fallbackMessage: true,
        whatsappProvider: true,
        evolutionApiUrl: true,
        evolutionInstanceName: true,
        evolutionApiToken: true,
        metaPhoneNumberId: true,
        metaAccessToken: true,
        metaApiVersion: true,
      },
    });

    const isBotEnabled =
      botSettings?.isBotEnabled ?? DEFAULT_BOT_SETTINGS_VALUES.isBotEnabled;
    if (!isBotEnabled) {
      return NextResponse.json(
        { error: "Bot desabilitado na configuração da clínica." },
        { status: 409 },
      );
    }

    const fallbackMessage =
      botSettings?.fallbackMessage?.trim() ||
      DEFAULT_BOT_SETTINGS_VALUES.fallbackMessage;

    const providerConfigError = resolveMissingProviderConfigMessage(
      botSettings ?? {},
    );
    if (providerConfigError) {
      return NextResponse.json(
        { error: providerConfigError },
        { status: 409 },
      );
    }

    const providerPayload = await sendConfiguredWhatsAppMessage({
      settings: botSettings ?? {},
      phone: number,
      content: fallbackMessage,
      delay: sendOptions?.delay,
      presence: sendOptions?.presence,
      typingEnabled: !!sendOptions,
    });

    return NextResponse.json({
      result: "SENT",
      number,
      message: fallbackMessage,
      details: providerPayload,
    });
  } catch (error) {
    console.error("n8n fallback message route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao enviar mensagem de fallback." },
      { status: 500 },
    );
  }
}
