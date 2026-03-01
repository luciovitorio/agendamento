import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Public: List all professionals
export async function GET() {
  try {
    const professionals = await prisma.professional.findMany({
      include: {
        services: { include: { service: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(professionals);
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao buscar profissionais" },
      { status: 500 },
    );
  }
}

// Protected (ADMIN): Create a professional
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { name, email, bio, avatarUrl } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Nome e email são obrigatórios" },
        { status: 400 },
      );
    }

    const professional = await prisma.professional.create({
      data: { name, email, bio, avatarUrl },
    });

    return NextResponse.json(professional, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao criar profissional" },
      { status: 500 },
    );
  }
}
