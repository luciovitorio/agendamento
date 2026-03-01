import { NextResponse } from "next/server";
import { normalizeIncomingPhone } from "@/lib/n8n-phone";
import { getHandoffStatus, setHandoffMode, type HandoffMode } from "@/lib/human-handoff";

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

function resolvePhone(value: unknown) {
  return normalizeIncomingPhone(value);
}

function resolveMode(rawMode: unknown): HandoffMode | null {
  if (typeof rawMode !== "string") return null;
  const normalized = rawMode.trim().toLowerCase();

  if (
    normalized === "human" ||
    normalized === "humano" ||
    normalized === "handoff" ||
    normalized === "open" ||
    normalized === "start" ||
    normalized === "on"
  ) {
    return "HUMAN";
  }

  if (
    normalized === "bot" ||
    normalized === "close" ||
    normalized === "off" ||
    normalized === "resume" ||
    normalized === "retomar" ||
    normalized === "end"
  ) {
    return "BOT";
  }

  return null;
}

function ensureN8nToken(req: Request) {
  const configuredToken = process.env.N8N_APPOINTMENTS_TOKEN?.trim();
  if (!configuredToken) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Integração indisponível: configure N8N_APPOINTMENTS_TOKEN no ambiente.",
        },
        { status: 500 },
      ),
    };
  }

  const receivedToken = resolveN8nToken(req);
  if (!receivedToken || receivedToken !== configuredToken) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Token inválido." }, { status: 401 }),
    };
  }

  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const tokenCheck = ensureN8nToken(req);
    if (!tokenCheck.ok) return tokenCheck.response;

    const body = (await req.json()) as Record<string, unknown>;
    const phone = resolvePhone(body.number ?? body.phone ?? body.remoteJid ?? body.to);
    if (!phone) {
      return NextResponse.json(
        {
          error:
            "Número inválido. Envie em number/phone/remoteJid/to (ex.: 5511999999999).",
        },
        { status: 400 },
      );
    }

    const mode = resolveMode(body.mode ?? body.state ?? body.action);
    if (!mode) {
      return NextResponse.json(
        {
          error:
            'Modo inválido. Use: "human"/"humano"/"open" para handoff humano ou "bot"/"resume"/"retomar" para retomar o bot.',
        },
        { status: 400 },
      );
    }

    const handoff = await setHandoffMode({
      rawPhone: phone,
      mode,
      reason: typeof body.reason === "string" ? body.reason : null,
      actor:
        typeof body.actor === "string" ? body.actor : "n8n-handoff-endpoint",
      assignedAgent:
        typeof body.assignedAgent === "string"
          ? body.assignedAgent
          : typeof body.agent === "string"
            ? body.agent
            : null,
    });

    return NextResponse.json({
      result: "UPDATED",
      active: handoff.mode === "HUMAN",
      handoff,
    });
  } catch (error) {
    console.error("n8n handoff route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao atualizar estado de handoff." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const tokenCheck = ensureN8nToken(req);
    if (!tokenCheck.ok) return tokenCheck.response;

    const { searchParams } = new URL(req.url);
    const phone = resolvePhone(
      searchParams.get("number") ||
        searchParams.get("phone") ||
        searchParams.get("remoteJid") ||
        searchParams.get("to"),
    );

    if (!phone) {
      return NextResponse.json(
        {
          error:
            "Informe number/phone/remoteJid/to na query string (ex.: ?number=5511999999999).",
        },
        { status: 400 },
      );
    }

    const handoff = await getHandoffStatus(phone);
    if (!handoff) {
      return NextResponse.json({
        result: "NOT_FOUND",
        active: false,
        handoff: {
          phone,
          mode: "BOT",
        },
      });
    }

    return NextResponse.json({
      result: "FOUND",
      active: handoff.mode === "HUMAN",
      handoff,
    });
  } catch (error) {
    console.error("n8n handoff query route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao consultar estado de handoff." },
      { status: 500 },
    );
  }
}
