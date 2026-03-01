"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  canDoctorManageProfessional,
  ensureCanManageTimeOff,
} from "@/lib/clinic-access";

function isValidDayOfWeek(dayOfWeek: number) {
  return Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6;
}

function isValidTime(time: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
}

function ensureTimeRange(startTime: string, endTime: string) {
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return "Formato de horário inválido. Use HH:mm.";
  }

  if (startTime >= endTime) {
    return "Horário final deve ser maior que o horário inicial.";
  }

  return null;
}

async function ensureCanManageSchedule(professionalId: string) {
  const access = await ensureCanManageTimeOff();
  if (!access.ok) {
    return { ok: false as const, error: access.error };
  }

  if (!professionalId?.trim()) {
    return { ok: false as const, error: "Profissional inválido." };
  }

  if (access.userRole === "DOUTOR") {
    const permission = await canDoctorManageProfessional(
      professionalId,
      access.userEmail || "",
    );

    if (permission.missing) {
      return { ok: false as const, error: "Profissional não encontrado." };
    }

    if (!permission.allowed) {
      return {
        ok: false as const,
        error: "Acesso negado para alterar a agenda deste profissional.",
      };
    }
  }

  return { ok: true as const };
}

export async function upsertScheduleAction(
  professionalId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) {
  try {
    const access = await ensureCanManageSchedule(professionalId);
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    if (!isValidDayOfWeek(dayOfWeek)) {
      return { success: false, error: "Dia da semana inválido." };
    }

    const timeError = ensureTimeRange(startTime, endTime);
    if (timeError) {
      return { success: false, error: timeError };
    }

    const existing = await prisma.schedule.findFirst({
      where: { professionalId, dayOfWeek },
    });

    if (existing) {
      await prisma.schedule.update({
        where: { id: existing.id },
        data: { startTime, endTime },
      });
    } else {
      await prisma.schedule.create({
        data: { professionalId, dayOfWeek, startTime, endTime },
      });
    }

    revalidatePath("/admin/schedules");
    return { success: true };
  } catch (error) {
    console.error("Error upserting schedule:", error);
    return { success: false, error: "Falha ao salvar horario." };
  }
}

export async function deleteScheduleAction(
  professionalId: string,
  dayOfWeek: number,
) {
  try {
    const access = await ensureCanManageSchedule(professionalId);
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    if (!isValidDayOfWeek(dayOfWeek)) {
      return { success: false, error: "Dia da semana inválido." };
    }

    const existing = await prisma.schedule.findFirst({
      where: { professionalId, dayOfWeek },
    });

    if (existing) {
      await prisma.schedule.delete({ where: { id: existing.id } });
    }

    revalidatePath("/admin/schedules");
    return { success: true };
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return { success: false, error: "Falha ao remover horario." };
  }
}

export async function saveAllSchedulesAction(
  professionalId: string,
  schedules: Array<{
    dayOfWeek: number;
    enabled: boolean;
    startTime: string;
    endTime: string;
  }>,
) {
  try {
    const access = await ensureCanManageSchedule(professionalId);
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    for (const schedule of schedules) {
      if (!isValidDayOfWeek(schedule.dayOfWeek)) {
        return { success: false, error: "Dia da semana inválido." };
      }

      const timeError = ensureTimeRange(schedule.startTime, schedule.endTime);
      if (schedule.enabled && timeError) {
        return { success: false, error: timeError };
      }

      if (schedule.enabled) {
        const existing = await prisma.schedule.findFirst({
          where: { professionalId, dayOfWeek: schedule.dayOfWeek },
        });

        if (existing) {
          await prisma.schedule.update({
            where: { id: existing.id },
            data: {
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            },
          });
        } else {
          await prisma.schedule.create({
            data: {
              professionalId,
              dayOfWeek: schedule.dayOfWeek,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            },
          });
        }
      } else {
        const existing = await prisma.schedule.findFirst({
          where: { professionalId, dayOfWeek: schedule.dayOfWeek },
        });

        if (existing) {
          await prisma.schedule.delete({ where: { id: existing.id } });
        }
      }
    }

    revalidatePath("/admin/schedules");
    return { success: true };
  } catch (error) {
    console.error("Error saving all schedules:", error);
    return { success: false, error: "Falha ao salvar horarios." };
  }
}
