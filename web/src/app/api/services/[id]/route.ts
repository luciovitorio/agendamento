import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminAccess, ensureCanManageAppointments } from "@/lib/clinic-access";

const SERVICE_SELECT = {
  id: true,
  name: true,
  description: true,
  duration: true,
  price: true,
  professionals: {
    select: {
      professionalId: true,
      professional: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await ensureCanManageAppointments();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Identificador inválido." },
        { status: 400 },
      );
    }

    const service = await prisma.service.findUnique({
      where: { id },
      select: SERVICE_SELECT,
    });

    if (!service)
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(service);
  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;
    const description =
      body && Object.prototype.hasOwnProperty.call(body, "description")
        ? typeof body.description === "string"
          ? body.description.trim() || null
          : null
        : undefined;

    const parsedDuration =
      body && Object.prototype.hasOwnProperty.call(body, "duration")
        ? Number(body.duration)
        : undefined;
    const parsedPrice =
      body && Object.prototype.hasOwnProperty.call(body, "price")
        ? body.price === null || body.price === ""
          ? null
          : Number(body.price)
        : undefined;

    const data: {
      name?: string;
      description?: string | null;
      duration?: number;
      price?: number | null;
    } = {};

    if (name !== undefined) {
      if (!name) {
        return NextResponse.json(
          { error: "Nome inválido." },
          { status: 400 },
        );
      }
      data.name = name;
    }

    if (description !== undefined) data.description = description;

    if (parsedDuration !== undefined) {
      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        return NextResponse.json(
          { error: "Duração inválida." },
          { status: 400 },
        );
      }
      data.duration = Math.floor(parsedDuration);
    }

    if (parsedPrice !== undefined) {
      if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
        return NextResponse.json(
          { error: "Preço inválido." },
          { status: 400 },
        );
      }
      data.price = parsedPrice;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualização." },
        { status: 400 },
      );
    }

    const service = await prisma.service.update({
      where: { id },
      data,
      select: SERVICE_SELECT,
    });

    return NextResponse.json(service);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const { id } = await params;
    await prisma.service.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}
