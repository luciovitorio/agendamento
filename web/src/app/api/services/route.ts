import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Public: List all services
export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(services);
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao buscar serviços" },
      { status: 500 },
    );
  }
}

// Protected (ADMIN): Create a service
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { name, description, duration, price } = await req.json();

    if (!name || !duration) {
      return NextResponse.json(
        { error: "Nome e duração são obrigatórios" },
        { status: 400 },
      );
    }

    const service = await prisma.service.create({
      data: {
        name,
        description,
        duration: Number(duration),
        price: price ? Number(price) : null,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao criar serviço" },
      { status: 500 },
    );
  }
}
