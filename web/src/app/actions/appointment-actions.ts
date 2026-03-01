"use server";

import {
  BookingStatus,
  BookingSource,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  buildClinicDateTimeFromDate,
  createAppointment,
  getClinicTimezoneOffset,
  toClinicDateStr,
} from "@/lib/appointments";
import { canTransitionAppointmentStatus } from "@/lib/appointment-status";
import {
  cancelBookingRemindersForBooking,
  syncBookingRemindersForBooking,
} from "@/lib/booking-reminders";
import { prisma } from "@/lib/prisma";
import {
  canDoctorManageProfessional,
  ensureCanManageAppointments,
  ensureCanManageTimeOff,
  getDoctorProfessionalIdByEmail,
} from "@/lib/clinic-access";

const RESULT_STATUSES: BookingStatus[] = [
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

function revalidateAppointmentPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/patients");
}

function toDateInputString(date: Date) {
  return toClinicDateStr(date);
}

function buildDateTime(dateStr: string, time: string) {
  return new Date(`${dateStr}T${time}:00${getClinicTimezoneOffset()}`);
}

function buildBookingDateTime(date: Date, time: string) {
  return buildClinicDateTimeFromDate(date, time);
}

export interface CreateManualAppointmentInput {
  professionalId: string;
  serviceId: string;
  dateStr: string;
  startTime: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
}

export async function createManualAppointmentAction(
  payload: CreateManualAppointmentInput,
) {
  try {
    const access = await ensureCanManageAppointments();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    if (access.userRole === "DOUTOR") {
      const doctorProfessionalId = await getDoctorProfessionalIdByEmail(
        access.userEmail,
      );

      if (!doctorProfessionalId || doctorProfessionalId !== payload.professionalId) {
        return {
          success: false,
          error:
            "Médicos só podem criar agendamentos para a própria agenda.",
        };
      }
    }

    const result = await createAppointment({
      professionalId: payload.professionalId,
      serviceId: payload.serviceId,
      dateStr: payload.dateStr,
      startTime: payload.startTime,
      patientName: payload.patientName,
      patientPhone: payload.patientPhone,
      patientEmail: payload.patientEmail,
      source: BookingSource.MANUAL,
      createdByUserId: access.userId,
    });

    if (!result.success) {
      return { success: false, error: result.message };
    }

    revalidateAppointmentPages();
    return { success: true, bookingId: result.booking.id };
  } catch {
    return { success: false, error: "Falha ao criar agendamento." };
  }
}

export async function updateAppointmentStatusAction(
  bookingId: string,
  status: BookingStatus,
) {
  try {
    const access = await ensureCanManageAppointments();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    if (!Object.values(BookingStatus).includes(status)) {
      return { success: false, error: "Status inválido." };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true,
        date: true,
        startTime: true,
        professional: {
          select: { email: true },
        },
      },
    });

    if (!booking) {
      return { success: false, error: "Agendamento não encontrado." };
    }

    if (access.userRole === "DOUTOR") {
      if (!access.userEmail || booking.professional.email !== access.userEmail) {
        return { success: false, error: "Acesso negado para este agendamento." };
      }
    }

    const canTransition = canTransitionAppointmentStatus(
      booking.status,
      status,
    );
    if (!canTransition) {
      return {
        success: false,
        error:
          "Transição de status inválida. Agendamentos cancelados, finalizados ou não comparecidos não podem voltar para pendente/confirmado.",
      };
    }

    const isResultStatus = RESULT_STATUSES.includes(status);
    if (isResultStatus && booking.status !== status) {
      const bookingStartDateTime = buildBookingDateTime(
        booking.date,
        booking.startTime,
      );
      if (bookingStartDateTime > new Date()) {
        return {
          success: false,
          error:
            "Só é possível marcar como realizado ou não compareceu após o início do horário agendado.",
        };
      }
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    if (
      status === BookingStatus.PENDING ||
      status === BookingStatus.CONFIRMED
    ) {
      await syncBookingRemindersForBooking(bookingId);
    } else {
      await cancelBookingRemindersForBooking(
        bookingId,
        `Agendamento atualizado para status ${status}.`,
      );
    }

    revalidateAppointmentPages();
    return { success: true };
  } catch {
    return { success: false, error: "Falha ao atualizar o status." };
  }
}

export async function deleteAppointmentAction(bookingId: string) {
  try {
    const access = await ensureCanManageAppointments();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    if (access.userRole === "DOUTOR") {
      return {
        success: false,
        error: "Médicos não podem excluir agendamentos diretamente.",
      };
    }

    await prisma.booking.delete({
      where: { id: bookingId },
    });

    try {
      await cancelBookingRemindersForBooking(
        bookingId,
        "Agendamento removido manualmente.",
      );
    } catch (reminderError) {
      console.error("deleteAppointmentAction reminder cleanup error:", reminderError);
    }

    revalidateAppointmentPages();
    return { success: true };
  } catch {
    return { success: false, error: "Falha ao excluir agendamento." };
  }
}

export interface RescheduleAppointmentInput {
  dateStr: string;
  startTime: string;
}

export async function rescheduleAppointmentAction(
  bookingId: string,
  input: RescheduleAppointmentInput,
) {
  try {
    const access = await ensureCanManageAppointments();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        patient: true,
        professional: true,
        service: true,
      },
    });

    if (!booking) {
      return { success: false, error: "Agendamento não encontrado." };
    }

    if (access.userRole === "DOUTOR") {
      if (!access.userEmail || booking.professional.email !== access.userEmail) {
        return { success: false, error: "Acesso negado para este agendamento." };
      }
    }

    const currentDateStr = toDateInputString(booking.date);
    if (currentDateStr === input.dateStr && booking.startTime === input.startTime) {
      return { success: true, bookingId: booking.id, unchanged: true };
    }

    const result = await createAppointment({
      professionalId: booking.professionalId,
      serviceId: booking.serviceId,
      dateStr: input.dateStr,
      startTime: input.startTime,
      patientName: booking.patient.name,
      patientPhone: booking.patient.phone,
      patientEmail: booking.patient.email,
      source: BookingSource.MANUAL,
      createdByUserId: access.userId,
    });

    if (!result.success) {
      return { success: false, error: result.message };
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED },
    });

    await cancelBookingRemindersForBooking(
      booking.id,
      "Agendamento original cancelado por remarcacao.",
    );

    revalidateAppointmentPages();
    return { success: true, bookingId: result.booking.id, unchanged: false };
  } catch {
    return { success: false, error: "Falha ao remarcar agendamento." };
  }
}

export interface CreateAppointmentTimeOffInput {
  professionalId: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export async function createAppointmentTimeOffAction(
  input: CreateAppointmentTimeOffInput,
) {
  try {
    const access = await ensureCanManageTimeOff();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    if (access.userRole === "DOUTOR") {
      const permission = await canDoctorManageProfessional(
        input.professionalId,
        access.userEmail || "",
      );
      if (permission.missing) {
        return { success: false, error: "Profissional não encontrado." };
      }
      if (!permission.allowed) {
        return { success: false, error: "Acesso negado para este profissional." };
      }
    }

    const startDateTime = buildDateTime(input.dateStr, input.startTime);
    const endDateTime = buildDateTime(input.dateStr, input.endTime);

    if (!(startDateTime < endDateTime)) {
      return {
        success: false,
        error: "Horário de término deve ser maior que o horário inicial.",
      };
    }

    const existingTimeOff = await prisma.professionalTimeOff.findFirst({
      where: {
        professionalId: input.professionalId,
        startDateTime: { lt: endDateTime },
        endDateTime: { gt: startDateTime },
      },
      select: { id: true },
    });

    if (existingTimeOff) {
      return {
        success: false,
        error: "Já existe um bloqueio para o período informado.",
      };
    }

    const dayStart = new Date(startDateTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startDateTime);
    dayEnd.setHours(23, 59, 59, 999);

    const possibleBookings = await prisma.booking.findMany({
      where: {
        professionalId: input.professionalId,
        status: { not: BookingStatus.CANCELLED },
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    });

    const conflictingBookings = possibleBookings.filter((booking) => {
      const bookingStart = buildBookingDateTime(booking.date, booking.startTime);
      const bookingEnd = buildBookingDateTime(booking.date, booking.endTime);
      return bookingStart < endDateTime && bookingEnd > startDateTime;
    });

    if (conflictingBookings.length > 0) {
      return {
        success: false,
        error:
          "Existem agendamentos ativos no período. Remarque/cancele antes de bloquear.",
      };
    }

    await prisma.professionalTimeOff.create({
      data: {
        professionalId: input.professionalId,
        startDateTime,
        endDateTime,
        reason: input.reason?.trim() || null,
        createdByUserId: access.userId,
      },
    });

    revalidateAppointmentPages();
    revalidatePath("/admin/schedules");
    return { success: true };
  } catch {
    return { success: false, error: "Falha ao criar bloqueio de agenda." };
  }
}

export async function deleteAppointmentTimeOffAction(timeOffId: string) {
  try {
    const access = await ensureCanManageTimeOff();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const timeOff = await prisma.professionalTimeOff.findUnique({
      where: { id: timeOffId },
      include: {
        professional: {
          select: { email: true },
        },
      },
    });

    if (!timeOff) {
      return { success: false, error: "Bloqueio não encontrado." };
    }

    if (access.userRole === "DOUTOR") {
      if (!access.userEmail || timeOff.professional.email !== access.userEmail) {
        return { success: false, error: "Acesso negado para este bloqueio." };
      }
    }

    await prisma.professionalTimeOff.delete({
      where: { id: timeOffId },
    });

    revalidateAppointmentPages();
    revalidatePath("/admin/schedules");
    return { success: true };
  } catch {
    return { success: false, error: "Falha ao remover bloqueio de agenda." };
  }
}
