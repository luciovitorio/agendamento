"use server";

import { auth } from "@/auth";
import { BookingStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

interface UpsertServiceInput {
  name: string;
  description?: string;
  duration: number;
  price?: number | null;
}

interface ManageProfessionalServiceInput {
  professionalId: string;
  serviceId: string;
}

function revalidateServicePages() {
  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/settings");
}

async function ensureAdmin() {
  const session = await auth();
  return !!session && session.user?.role === "ADMIN";
}

function normalizeName(name: string) {
  return name.trim();
}

function normalizeDescription(description?: string) {
  const value = description?.trim();
  return value ? value : null;
}

function normalizePrice(price?: number | null) {
  if (price === undefined || price === null) {
    return null;
  }

  if (!Number.isFinite(price)) {
    throw new Error("Preço inválido.");
  }

  return Number(price);
}

function validateInput(data: UpsertServiceInput) {
  const name = normalizeName(data.name);
  if (name.length < 2) {
    throw new Error("Nome do serviço deve ter pelo menos 2 caracteres.");
  }

  if (!Number.isInteger(data.duration) || data.duration < 5 || data.duration > 480) {
    throw new Error("Duração deve ser um número inteiro entre 5 e 480 minutos.");
  }

  const price = normalizePrice(data.price);
  if (price !== null && price < 0) {
    throw new Error("Preço não pode ser negativo.");
  }

  return {
    name,
    description: normalizeDescription(data.description),
    duration: data.duration,
    price,
  };
}

async function ensureUniqueServiceName(name: string, currentServiceId?: string) {
  const existing = await prisma.service.findFirst({
    where: {
      name,
      ...(currentServiceId ? { id: { not: currentServiceId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Já existe um serviço com este nome.");
  }
}

export async function createServiceAction(data: UpsertServiceInput) {
  try {
    if (!(await ensureAdmin())) {
      return { success: false, error: "Acesso negado." };
    }

    const payload = validateInput(data);
    await ensureUniqueServiceName(payload.name);

    await prisma.service.create({
      data: payload,
    });

    revalidateServicePages();
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Já existe um serviço com este nome." };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao criar serviço." };
  }
}

export async function updateServiceAction(id: string, data: UpsertServiceInput) {
  try {
    if (!(await ensureAdmin())) {
      return { success: false, error: "Acesso negado." };
    }

    const payload = validateInput(data);
    await ensureUniqueServiceName(payload.name, id);

    await prisma.service.update({
      where: { id },
      data: payload,
    });

    revalidateServicePages();
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { success: false, error: "Já existe um serviço com este nome." };
      }
      if (error.code === "P2025") {
        return { success: false, error: "Serviço não encontrado." };
      }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao atualizar serviço." };
  }
}

export async function deleteServiceAction(id: string) {
  try {
    if (!(await ensureAdmin())) {
      return { success: false, error: "Acesso negado." };
    }

    const bookingsCount = await prisma.booking.count({
      where: { serviceId: id },
    });

    if (bookingsCount > 0) {
      return {
        success: false,
        error:
          "Não é possível excluir um serviço com agendamentos vinculados. Preserve o histórico ou cancele os agendamentos primeiro.",
      };
    }

    await prisma.service.delete({
      where: { id },
    });

    revalidateServicePages();
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "Serviço não encontrado." };
    }
    return { success: false, error: "Falha ao excluir serviço." };
  }
}

async function validateProfessionalServiceInput(
  input: ManageProfessionalServiceInput,
) {
  const professionalId = input.professionalId?.trim();
  const serviceId = input.serviceId?.trim();

  if (!professionalId || !serviceId) {
    throw new Error("Profissional e serviço são obrigatórios.");
  }

  const [professional, service] = await Promise.all([
    prisma.professional.findUnique({
      where: { id: professionalId },
      select: { id: true },
    }),
    prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    }),
  ]);

  if (!professional) {
    throw new Error("Profissional não encontrado.");
  }

  if (!service) {
    throw new Error("Serviço não encontrado.");
  }

  return { professionalId, serviceId };
}

export async function linkServiceToProfessionalAction(
  input: ManageProfessionalServiceInput,
) {
  try {
    if (!(await ensureAdmin())) {
      return { success: false, error: "Acesso negado." };
    }

    const payload = await validateProfessionalServiceInput(input);

    await prisma.professionalService.create({
      data: payload,
    });

    revalidateServicePages();
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Este vínculo já está cadastrado." };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao vincular serviço ao profissional." };
  }
}

export async function unlinkServiceFromProfessionalAction(
  input: ManageProfessionalServiceInput,
) {
  try {
    if (!(await ensureAdmin())) {
      return { success: false, error: "Acesso negado." };
    }

    const payload = await validateProfessionalServiceInput(input);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeFutureBookings = await prisma.booking.count({
      where: {
        professionalId: payload.professionalId,
        serviceId: payload.serviceId,
        status: { not: BookingStatus.CANCELLED },
        date: { gte: today },
      },
    });

    if (activeFutureBookings > 0) {
      return {
        success: false,
        error:
          "Existem agendamentos ativos/futuros para este vínculo. Remarque ou cancele antes de desvincular.",
      };
    }

    await prisma.professionalService.delete({
      where: {
        professionalId_serviceId: payload,
      },
    });

    revalidateServicePages();
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "Vínculo não encontrado." };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao desvincular serviço do profissional." };
  }
}
