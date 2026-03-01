"use server";

import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { clearConversation } from "@/lib/bot-state";
import { prisma } from "@/lib/prisma";

type CoverageType = "PARTICULAR" | "PLAN";

interface UpsertPatientInput {
  name: string;
  email?: string;
  phone: string;
  coverageType: CoverageType;
  healthPlanId?: string;
}

function normalizeEmail(email?: string) {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

function normalizePhone(phone: string) {
  return phone.trim();
}

async function ensureCanManagePatients() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session || !role || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(role)) {
    return false;
  }
  return true;
}

async function resolveHealthPlanId(
  coverageType: CoverageType,
  healthPlanId?: string,
) {
  if (coverageType !== "PLAN") {
    return null;
  }

  const normalizedPlanId = healthPlanId?.trim();
  if (!normalizedPlanId) {
    throw new Error("Selecione um plano para pacientes conveniados.");
  }

  const planExists = await prisma.healthPlan.findUnique({
    where: { id: normalizedPlanId },
    select: { id: true },
  });

  if (!planExists) {
    throw new Error("Plano de saúde selecionado não encontrado.");
  }

  return normalizedPlanId;
}

function revalidatePatientPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/patients");
}

export async function createPatientAction(data: UpsertPatientInput) {
  try {
    const canManage = await ensureCanManagePatients();
    if (!canManage) {
      return { success: false, error: "Acesso negado." };
    }

    const healthPlanId = await resolveHealthPlanId(
      data.coverageType,
      data.healthPlanId,
    );

    await prisma.patient.create({
      data: {
        name: data.name.trim(),
        email: normalizeEmail(data.email),
        phone: normalizePhone(data.phone),
        coverageType: data.coverageType,
        healthPlanId,
      },
    });

    revalidatePatientPages();
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "Já existe um paciente com este telefone." };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Falha ao criar paciente." };
  }
}

export async function updatePatientAction(id: string, data: UpsertPatientInput) {
  try {
    const canManage = await ensureCanManagePatients();
    if (!canManage) {
      return { success: false, error: "Acesso negado." };
    }

    const existing = await prisma.patient.findUnique({
      where: { id },
      select: { id: true, phone: true },
    });

    if (!existing) {
      return { success: false, error: "Paciente não encontrado." };
    }

    const healthPlanId = await resolveHealthPlanId(
      data.coverageType,
      data.healthPlanId,
    );

    const nextPhone = normalizePhone(data.phone);

    await prisma.patient.update({
      where: { id },
      data: {
        name: data.name.trim(),
        email: normalizeEmail(data.email),
        phone: nextPhone,
        coverageType: data.coverageType,
        healthPlanId,
      },
    });

    clearConversation(existing.phone);
    if (existing.phone !== nextPhone) {
      clearConversation(nextPhone);
    }

    revalidatePatientPages();
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "Já existe um paciente com este telefone." };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Falha ao atualizar paciente." };
  }
}

export async function deletePatientAction(id: string) {
  try {
    const canManage = await ensureCanManagePatients();
    if (!canManage) {
      return { success: false, error: "Acesso negado." };
    }

    const existing = await prisma.patient.findUnique({
      where: { id },
      select: { id: true, phone: true },
    });

    if (!existing) {
      return { success: false, error: "Paciente não encontrado." };
    }

    const bookingsCount = await prisma.booking.count({
      where: { patientId: id },
    });

    if (bookingsCount > 0) {
      return {
        success: false,
        error:
          "Não é possível excluir um paciente com agendamentos vinculados. Cancele/exclua os agendamentos primeiro.",
      };
    }

    await prisma.patient.delete({ where: { id } });
    clearConversation(existing.phone);
    revalidatePatientPages();
    return { success: true };
  } catch {
    return { success: false, error: "Falha ao excluir paciente." };
  }
}
