import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureAdminAccess,
  ensureCanManageAppointments,
  getDoctorProfessionalIdByEmail,
} from "@/lib/clinic-access";

const PROFESSIONAL_SELECT = {
  id: true,
  name: true,
  email: true,
  bio: true,
  avatarUrl: true,
  services: {
    select: {
      serviceId: true,
      service: {
        select: {
          id: true,
          name: true,
          description: true,
          duration: true,
          price: true,
        },
      },
    },
  },
  schedules: {
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
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

    if (access.userRole === "DOUTOR") {
      if (!access.userEmail) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }

      const doctorProfessionalId = await getDoctorProfessionalIdByEmail(
        access.userEmail,
      );

      if (!doctorProfessionalId || doctorProfessionalId !== id) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const professional = await prisma.professional.findUnique({
      where: { id },
      select: PROFESSIONAL_SELECT,
    });

    if (!professional)
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(professional);
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
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;
    const bio =
      body && Object.prototype.hasOwnProperty.call(body, "bio")
        ? typeof body.bio === "string"
          ? body.bio.trim() || null
          : null
        : undefined;
    const avatarUrl =
      body && Object.prototype.hasOwnProperty.call(body, "avatarUrl")
        ? typeof body.avatarUrl === "string"
          ? body.avatarUrl.trim() || null
          : null
        : undefined;

    const data: {
      name?: string;
      email?: string;
      bio?: string | null;
      avatarUrl?: string | null;
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

    if (email !== undefined) {
      if (!email) {
        return NextResponse.json(
          { error: "Email inválido." },
          { status: 400 },
        );
      }
      data.email = email;
    }

    if (bio !== undefined) data.bio = bio;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualização." },
        { status: 400 },
      );
    }

    const professional = await prisma.professional.update({
      where: { id },
      data,
      select: PROFESSIONAL_SELECT,
    });

    return NextResponse.json(professional);
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
    await prisma.professional.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}
