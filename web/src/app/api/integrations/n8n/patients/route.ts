import { NextResponse } from "next/server";
import { normalizeIncomingPhone } from "@/lib/n8n-phone";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          error: "Body JSON inválido ou vazio. Envie pelo menos: name, phone.",
        },
        { status: 400 },
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Campo 'name' é obrigatório." },
        { status: 400 },
      );
    }

    const phoneRaw = body.phone ?? body.number ?? body.remoteJid;
    const phone = normalizeIncomingPhone(phoneRaw);
    if (!phone) {
      return NextResponse.json(
        {
          error:
            "Número de telefone inválido. Envie em phone/number/remoteJid (ex.: 5511999999999).",
        },
        { status: 400 },
      );
    }

    const email =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim().toLowerCase()
        : null;

    const coverageType =
      typeof body.coverageType === "string" &&
      ["PARTICULAR", "PLAN"].includes(body.coverageType.toUpperCase())
        ? (body.coverageType.toUpperCase() as "PARTICULAR" | "PLAN")
        : "PARTICULAR";

    let healthPlanId: string | null = null;

    if (coverageType === "PLAN") {
      const planInput =
        typeof body.healthPlanId === "string"
          ? body.healthPlanId.trim()
          : typeof body.healthPlanName === "string"
            ? body.healthPlanName.trim()
            : "";

      if (!planInput) {
        return NextResponse.json(
          {
            error:
              "Para cobertura PLAN, informe healthPlanId ou healthPlanName.",
          },
          { status: 400 },
        );
      }

      const plan = await prisma.healthPlan.findFirst({
        where: {
          OR: [
            { id: planInput },
            { name: { equals: planInput, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true },
      });

      if (!plan) {
        return NextResponse.json(
          {
            result: "PLAN_NOT_FOUND",
            error: `Plano '${planInput}' não encontrado na clínica.`,
            availablePlans: await prisma.healthPlan.findMany({
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            }),
          },
          { status: 404 },
        );
      }

      healthPlanId = plan.id;
    }

    // Idempotência: se já existe paciente com esse telefone, retorna ele
    const existing = await prisma.patient.findUnique({
      where: { phone },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        coverageType: true,
        healthPlan: { select: { id: true, name: true } },
      },
    });

    if (existing) {
      return NextResponse.json({
        result: "ALREADY_EXISTS",
        created: false,
        patient: existing,
      });
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        phone,
        email,
        coverageType,
        healthPlanId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        coverageType: true,
        healthPlan: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      {
        result: "CREATED",
        created: true,
        patient,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          result: "DUPLICATE",
          error: "Já existe paciente com este telefone.",
        },
        { status: 409 },
      );
    }

    console.error("n8n patients create route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao criar paciente." },
      { status: 500 },
    );
  }
}
