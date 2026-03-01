import { NextResponse } from "next/server";
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

export async function GET(req: Request) {
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

    const plans = await prisma.healthPlan.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      result: "OK",
      plans,
      count: plans.length,
    });
  } catch (error) {
    console.error("n8n health-plans route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao listar planos de saúde." },
      { status: 500 },
    );
  }
}
