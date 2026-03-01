import {
  BookingSource,
  BookingStatus,
  Prisma,
} from "@prisma/client";
import { addMinutes, format, isBefore, isValid, parse } from "date-fns";
import {
  DEFAULT_APPOINTMENT_STATUS,
} from "@/lib/appointment-status";
import { syncBookingRemindersForBooking } from "@/lib/booking-reminders";
import { prisma } from "@/lib/prisma";

const DEFAULT_CLINIC_TIMEZONE_OFFSET = "-03:00";
const DATE_STR_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TIMEZONE_OFFSET_PATTERN = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    patient: true;
    professional: true;
    service: true;
  };
}>;

type TxCreateResult =
  | { kind: "created"; bookingId: string }
  | { kind: "idempotent"; bookingId: string }
  | { kind: "conflict" };

export interface CreateAppointmentInput {
  professionalId: string;
  serviceId: string;
  dateStr: string;
  startTime: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string | null;
  source: BookingSource;
  status?: BookingStatus;
  createdByUserId?: string | null;
  externalRequestId?: string | null;
  allowPast?: boolean;
}

export type CreateAppointmentResult =
  | {
      success: true;
      created: boolean;
      idempotent: boolean;
      booking: BookingWithRelations;
    }
  | {
      success: false;
      code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
      message: string;
      httpStatus: number;
    };

export function getClinicTimezoneOffset() {
  const configured = process.env.CLINIC_TIMEZONE_OFFSET?.trim();
  if (configured && TIMEZONE_OFFSET_PATTERN.test(configured)) {
    return configured;
  }

  return DEFAULT_CLINIC_TIMEZONE_OFFSET;
}

function parseTimezoneOffsetToMinutes(offset: string) {
  const sign = offset[0] === "-" ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  return sign * (hours * 60 + minutes);
}

export function toClinicDateStr(date: Date) {
  const offsetMinutes = parseTimezoneOffsetToMinutes(getClinicTimezoneOffset());
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildClinicDateTimeFromDate(date: Date, time: string) {
  return new Date(`${toClinicDateStr(date)}T${time}:00${getClinicTimezoneOffset()}`);
}

function createClinicDayDate(dateStr: string, hour = "00:00:00.000") {
  return new Date(`${dateStr}T${hour}${getClinicTimezoneOffset()}`);
}

function normalizePhone(phone: string) {
  return phone.trim();
}

function normalizeEmail(email?: string | null) {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

function sanitizeExternalRequestId(externalRequestId?: string | null) {
  const value = externalRequestId?.trim();
  return value ? value : null;
}

function getBookingWithRelations(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      patient: true,
      professional: true,
      service: true,
    },
  });
}

function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

async function createBookingTransaction(
  input: Required<
    Omit<
      CreateAppointmentInput,
      "patientEmail" | "createdByUserId" | "externalRequestId" | "status"
    >
  > & {
    patientEmail: string | null;
    createdByUserId: string | null;
    externalRequestId: string | null;
    status: BookingStatus;
    endTime: string;
    startOfDay: Date;
    endOfDay: Date;
  },
) {
  return prisma.$transaction(
    async (tx): Promise<TxCreateResult> => {
      if (input.externalRequestId) {
        const existing = await tx.booking.findUnique({
          where: { externalRequestId: input.externalRequestId },
          select: { id: true },
        });

        if (existing) {
          return { kind: "idempotent", bookingId: existing.id };
        }
      }

      const overlap = await tx.booking.findFirst({
        where: {
          professionalId: input.professionalId,
          date: {
            gte: input.startOfDay,
            lte: input.endOfDay,
          },
          status: { not: BookingStatus.CANCELLED },
          AND: [
            { startTime: { lt: input.endTime } },
            { endTime: { gt: input.startTime } },
          ],
        },
        select: { id: true },
      });

      if (overlap) {
        return { kind: "conflict" };
      }

      const patient = await tx.patient.upsert({
        where: { phone: input.patientPhone },
        update: {
          name: input.patientName,
          email: input.patientEmail,
        },
        create: {
          name: input.patientName,
          email: input.patientEmail,
          phone: input.patientPhone,
        },
      });

      const booking = await tx.booking.create({
        data: {
          date: input.startOfDay,
          startTime: input.startTime,
          endTime: input.endTime,
          status: input.status,
          source: input.source,
          createdByUserId: input.createdByUserId,
          externalRequestId: input.externalRequestId,
          patientId: patient.id,
          professionalId: input.professionalId,
          serviceId: input.serviceId,
        },
        select: { id: true },
      });

      return { kind: "created", bookingId: booking.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createAppointment(
  payload: CreateAppointmentInput,
): Promise<CreateAppointmentResult> {
  const professionalId = payload.professionalId?.trim();
  const serviceId = payload.serviceId?.trim();
  const dateStr = payload.dateStr?.trim();
  const startTime = payload.startTime?.trim();
  const patientName = payload.patientName?.trim();
  const patientPhone = normalizePhone(payload.patientPhone || "");
  const patientEmail = normalizeEmail(payload.patientEmail);
  const source = payload.source;
  const createdByUserId = payload.createdByUserId?.trim() || null;
  const externalRequestId = sanitizeExternalRequestId(payload.externalRequestId);
  const status = payload.status || (DEFAULT_APPOINTMENT_STATUS as BookingStatus);
  const allowPast = payload.allowPast || false;

  if (
    !professionalId ||
    !serviceId ||
    !dateStr ||
    !startTime ||
    !patientName ||
    !patientPhone
  ) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Dados obrigatórios ausentes para criar o agendamento.",
      httpStatus: 400,
    };
  }

  if (!DATE_STR_PATTERN.test(dateStr) || !TIME_PATTERN.test(startTime)) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Formato inválido de data ou hora. Use YYYY-MM-DD e HH:mm.",
      httpStatus: 400,
    };
  }

  const startOfDay = createClinicDayDate(dateStr);
  const endOfDay = createClinicDayDate(dateStr, "23:59:59.999");

  if (!isValid(startOfDay)) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Data inválida para criação do agendamento.",
      httpStatus: 400,
    };
  }

  const [professional, service, schedule, professionalService] =
    await Promise.all([
      prisma.professional.findUnique({
        where: { id: professionalId },
        select: { id: true },
      }),
      prisma.service.findUnique({
        where: { id: serviceId },
        select: { id: true, duration: true },
      }),
      prisma.schedule.findUnique({
        where: {
          professionalId_dayOfWeek: {
            professionalId,
            dayOfWeek: startOfDay.getDay(),
          },
        },
      }),
      prisma.professionalService.findUnique({
        where: {
          professionalId_serviceId: {
            professionalId,
            serviceId,
          },
        },
        select: { professionalId: true },
      }),
    ]);

  if (!professional) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Profissional não encontrado.",
      httpStatus: 404,
    };
  }

  if (!service) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Serviço não encontrado.",
      httpStatus: 404,
    };
  }

  if (!professionalService) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "O profissional selecionado não atende este serviço.",
      httpStatus: 400,
    };
  }

  if (!schedule) {
    return {
      success: false,
      code: "CONFLICT",
      message: "Profissional sem horário de atendimento para esta data.",
      httpStatus: 409,
    };
  }

  const parsedStart = parse(startTime, "HH:mm", startOfDay);
  const scheduleStart = parse(schedule.startTime, "HH:mm", startOfDay);
  const scheduleEnd = parse(schedule.endTime, "HH:mm", startOfDay);

  if (!isValid(parsedStart) || !isValid(scheduleStart) || !isValid(scheduleEnd)) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Hora inválida para criar o agendamento.",
      httpStatus: 400,
    };
  }

  const parsedEnd = addMinutes(parsedStart, service.duration);
  const endTime = format(parsedEnd, "HH:mm");

  if (parsedStart < scheduleStart || parsedEnd > scheduleEnd) {
    return {
      success: false,
      code: "CONFLICT",
      message: "Horário fora da jornada configurada para o profissional.",
      httpStatus: 409,
    };
  }

  const overlappingTimeOff = await prisma.professionalTimeOff.findFirst({
    where: {
      professionalId,
      startDateTime: { lt: parsedEnd },
      endDateTime: { gt: parsedStart },
    },
    select: { reason: true },
  });

  if (overlappingTimeOff) {
    return {
      success: false,
      code: "CONFLICT",
      message: overlappingTimeOff.reason
        ? `Profissional indisponível neste horário (${overlappingTimeOff.reason}).`
        : "Profissional indisponível neste horário.",
      httpStatus: 409,
    };
  }

  if (!allowPast && isBefore(parsedStart, new Date())) {
    return {
      success: false,
      code: "CONFLICT",
      message: "Não é possível criar agendamento para horário passado.",
      httpStatus: 409,
    };
  }

  const maxRetries = 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const txResult = await createBookingTransaction({
        professionalId,
        serviceId,
        dateStr,
        startTime,
        patientName,
        patientPhone,
        patientEmail,
        source,
        createdByUserId,
        externalRequestId,
        status,
        allowPast,
        endTime,
        startOfDay,
        endOfDay,
      });

      if (txResult.kind === "conflict") {
        return {
          success: false,
          code: "CONFLICT",
          message: "Horário já reservado.",
          httpStatus: 409,
        };
      }

      const booking = await getBookingWithRelations(txResult.bookingId);
      if (!booking) {
        return {
          success: false,
          code: "INTERNAL_ERROR",
          message: "Falha ao carregar agendamento criado.",
          httpStatus: 500,
        };
      }

      try {
        await syncBookingRemindersForBooking(booking.id);
      } catch (reminderError) {
        // Reminder creation must not block appointment creation.
        console.error("syncBookingRemindersForBooking failed:", reminderError);
      }

      return {
        success: true,
        created: txResult.kind === "created",
        idempotent: txResult.kind === "idempotent",
        booking,
      };
    } catch (error) {
      lastError = error;

      if (isPrismaKnownError(error)) {
        if (error.code === "P2002" && externalRequestId) {
          const existing = await prisma.booking.findUnique({
            where: { externalRequestId },
            include: {
              patient: true,
              professional: true,
              service: true,
            },
          });

          if (existing) {
            return {
              success: true,
              created: false,
              idempotent: true,
              booking: existing,
            };
          }
        }

        if (error.code === "P2034" && attempt < maxRetries) {
          continue;
        }
      }

      break;
    }
  }

  console.error("createAppointment failed:", lastError);
  return {
    success: false,
    code: "INTERNAL_ERROR",
    message: "Erro interno ao criar agendamento.",
    httpStatus: 500,
  };
}
