import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extractBearerToken(authHeader: string | null) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
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
        { error: "Integração indisponível: configure N8N_APPOINTMENTS_TOKEN." },
        { status: 500 },
      );
    }

    const receivedToken = resolveN8nToken(req);
    if (!receivedToken || receivedToken !== configuredToken) {
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    const services = await prisma.service.findMany({
      select: {
        id: true,
        name: true,
        duration: true,
        price: true,
        professionals: {
          select: {
            professional: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = services
      .filter((s) => s.professionals.length > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        price: s.price,
        professionals: s.professionals.map((ps) => ({
          id: ps.professional.id,
          name: ps.professional.name,
        })),
      }));

    return NextResponse.json({
      result: "OK",
      services: result,
      count: result.length,
    });
  } catch (error) {
    console.error("n8n services route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao listar serviços." },
      { status: 500 },
    );
  }
}
