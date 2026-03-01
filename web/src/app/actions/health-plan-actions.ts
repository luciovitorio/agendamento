"use server";

import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

async function ensureAdmin() {
  const session = await auth();
  return !!session && session.user?.role === "ADMIN";
}

function normalizeName(name: string) {
  return name.trim();
}

function revalidatePlanPages() {
  revalidatePath("/admin/patients");
  revalidatePath("/admin/plans");
}

export async function createHealthPlanAction(name: string) {
  try {
    if (!(await ensureAdmin())) {
      return { success: false, error: "Acesso negado." };
    }

    await prisma.healthPlan.create({
      data: { name: normalizeName(name) },
    });

    revalidatePlanPages();
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "Já existe um plano com este nome." };
    }
    return { success: false, error: "Falha ao criar plano." };
  }
}

export async function updateHealthPlanAction(id: string, name: string) {
  try {
    if (!(await ensureAdmin())) {
      return { success: false, error: "Acesso negado." };
    }

    await prisma.healthPlan.update({
      where: { id },
      data: { name: normalizeName(name) },
    });

    revalidatePlanPages();
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "Já existe um plano com este nome." };
    }
    return { success: false, error: "Falha ao atualizar plano." };
  }
}

export async function deleteHealthPlanAction(id: string) {
  try {
    if (!(await ensureAdmin())) {
      return { success: false, error: "Acesso negado." };
    }

    await prisma.$transaction([
      prisma.patient.updateMany({
        where: { healthPlanId: id },
        data: { healthPlanId: null, coverageType: "PARTICULAR" },
      }),
      prisma.healthPlan.delete({ where: { id } }),
    ]);

    revalidatePlanPages();
    return { success: true };
  } catch {
    return { success: false, error: "Falha ao excluir plano." };
  }
}
