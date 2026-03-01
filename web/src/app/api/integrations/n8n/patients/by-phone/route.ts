import { NextResponse } from "next/server";
import {
  arePhonesEquivalent,
  buildPhoneComparableDigits,
  normalizeIncomingPhone,
} from "@/lib/n8n-phone";
import { prisma } from "@/lib/prisma";

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

function resolvePhoneFromBody(body: Record<string, unknown>) {
  return normalizeIncomingPhone(
    body.number ?? body.phone ?? body.remoteJid ?? body.to,
  );
}

function scoreMatch(inputDigits: string, patientPhone: string) {
  const inputComparables = buildPhoneComparableDigits(inputDigits);
  const patientComparables = buildPhoneComparableDigits(patientPhone);
  const patientComparableSet = new Set(patientComparables);

  if (patientComparableSet.has(inputDigits)) return 3;
  if (inputComparables.some((value) => patientComparableSet.has(value))) return 2;
  if (arePhonesEquivalent(inputDigits, patientPhone)) return 1;
  return 0;
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

    const body = (await req.json()) as Record<string, unknown>;
    const inputPhoneDigits = resolvePhoneFromBody(body);
    if (!inputPhoneDigits) {
      return NextResponse.json(
        {
          error:
            "Número inválido. Envie em number/phone/remoteJid/to (ex.: 5511999999999).",
        },
        { status: 400 },
      );
    }

    const comparableDigits = buildPhoneComparableDigits(inputPhoneDigits);
    const whereCandidates = comparableDigits.map((digits) => ({
      phone: { contains: digits },
    }));

    const candidates = await prisma.patient.findMany({
      where: {
        OR:
          whereCandidates.length > 0
            ? whereCandidates
            : [{ phone: { contains: inputPhoneDigits } }],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        coverageType: true,
        healthPlan: {
          select: { id: true, name: true },
        },
        bookings: {
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
          take: 1,
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
            professional: {
              select: { id: true, name: true },
            },
            service: {
              select: { id: true, name: true },
            },
          },
        },
      },
      take: 20,
    });

    const bestMatch = candidates
      .map((candidate) => ({
        candidate,
        score: scoreMatch(inputPhoneDigits, candidate.phone),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!bestMatch) {
      return NextResponse.json({
        result: "NOT_FOUND",
        knownPatient: false,
        normalizedPhone: inputPhoneDigits,
      });
    }

    const lastBooking = bestMatch.candidate.bookings[0] ?? null;

    return NextResponse.json({
      result: "FOUND",
      knownPatient: true,
      normalizedPhone: inputPhoneDigits,
      patient: {
        id: bestMatch.candidate.id,
        name: bestMatch.candidate.name,
        phone: bestMatch.candidate.phone,
        email: bestMatch.candidate.email,
        coverageType: bestMatch.candidate.coverageType,
        healthPlan: bestMatch.candidate.healthPlan,
      },
      lastBooking: lastBooking
        ? {
            id: lastBooking.id,
            date: lastBooking.date,
            startTime: lastBooking.startTime,
            status: lastBooking.status,
            professional: lastBooking.professional,
            service: lastBooking.service,
          }
        : null,
    });
  } catch (error) {
    console.error("n8n patient by-phone route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao consultar paciente por telefone." },
      { status: 500 },
    );
  }
}
