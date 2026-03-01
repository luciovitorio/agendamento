import { BookingSource, BookingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { createAppointment } from "@/lib/appointments";
import { DEFAULT_APPOINTMENT_STATUS } from "@/lib/appointment-status";

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

function resolveStatus(rawStatus: unknown) {
  if (typeof rawStatus !== "string") {
    return DEFAULT_APPOINTMENT_STATUS as BookingStatus;
  }

  const normalized = rawStatus.trim().toUpperCase();
  if (!normalized) {
    return DEFAULT_APPOINTMENT_STATUS as BookingStatus;
  }

  const accepted = new Set(Object.values(BookingStatus));
  if (!accepted.has(normalized as BookingStatus)) {
    return null;
  }

  return normalized as BookingStatus;
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

    const externalRequestIdHeader = req.headers.get("x-idempotency-key");
    const externalRequestIdBody =
      typeof body?.externalRequestId === "string"
        ? body.externalRequestId
        : null;
    const externalRequestId =
      externalRequestIdHeader?.trim() ||
      externalRequestIdBody ||
      `bot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const status = resolveStatus(body?.status);
    if (!status) {
      return NextResponse.json(
        {
          error:
            "Status inválido. Use: PENDING, CONFIRMED, CANCELLED, COMPLETED ou NO_SHOW.",
        },
        { status: 400 },
      );
    }

    const result = await createAppointment({
      professionalId: body?.professionalId,
      serviceId: body?.serviceId,
      dateStr: body?.dateStr,
      startTime: body?.startTime,
      patientName: body?.patientName ?? body?.name ?? body?.patient?.name,
      patientPhone: body?.patientPhone ?? body?.phone ?? body?.patient?.phone,
      patientEmail: body?.patientEmail ?? body?.email ?? body?.patient?.email,
      status,
      source: BookingSource.BOT_N8N,
      externalRequestId,
    });

    if (!result.success) {
      const resultCode =
        result.code === "CONFLICT"
          ? "CONFLICT"
          : result.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : result.code === "INVALID_INPUT"
              ? "INVALID_DATA"
              : "ERROR";

      return NextResponse.json(
        {
          result: resultCode,
          error: result.message,
          code: result.code,
        },
        { status: result.httpStatus },
      );
    }

    return NextResponse.json(
      {
        result: "BOOKED",
        idempotent: result.idempotent,
        booking: result.booking,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error("n8n appointments route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao processar integração n8n." },
      { status: 500 },
    );
  }
}
