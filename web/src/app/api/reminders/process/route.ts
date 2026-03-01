import { NextResponse } from "next/server";
import { processDueBookingReminders } from "@/lib/booking-reminders";

function extractBearerToken(authHeader: string | null) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

function resolveProcessToken(req: Request) {
  const bearer = extractBearerToken(req.headers.get("authorization"));
  if (bearer) return bearer;

  const custom =
    req.headers.get("x-reminders-token") || req.headers.get("x-n8n-token");
  if (!custom) return null;
  return custom.trim() || null;
}

function ensureProcessToken(req: Request) {
  const configuredToken =
    process.env.REMINDERS_PROCESS_TOKEN?.trim() ||
    process.env.N8N_REMINDERS_TOKEN?.trim() ||
    process.env.N8N_APPOINTMENTS_TOKEN?.trim();

  if (!configuredToken) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Integração indisponível: configure REMINDERS_PROCESS_TOKEN (ou N8N_REMINDERS_TOKEN/N8N_APPOINTMENTS_TOKEN).",
        },
        { status: 500 },
      ),
    };
  }

  const receivedToken = resolveProcessToken(req);
  if (!receivedToken || receivedToken !== configuredToken) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Token inválido." }, { status: 401 }),
    };
  }

  return { ok: true as const };
}

function parseLimit(rawValue: unknown) {
  const parsed =
    typeof rawValue === "number"
      ? Math.trunc(rawValue)
      : typeof rawValue === "string"
        ? Number.parseInt(rawValue, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(200, parsed));
}

export async function GET(req: Request) {
  try {
    const tokenCheck = ensureProcessToken(req);
    if (!tokenCheck.ok) return tokenCheck.response;

    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get("limit"));
    const result = await processDueBookingReminders({ limit });

    return NextResponse.json({
      result: "PROCESSED",
      ...result,
    });
  } catch (error) {
    console.error("reminders process route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao processar lembretes." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const tokenCheck = ensureProcessToken(req);
    if (!tokenCheck.ok) return tokenCheck.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const limit = parseLimit(body.limit);
    const result = await processDueBookingReminders({ limit });

    return NextResponse.json({
      result: "PROCESSED",
      ...result,
    });
  } catch (error) {
    console.error("reminders process route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao processar lembretes." },
      { status: 500 },
    );
  }
}
