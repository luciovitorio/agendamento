import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { getClinicTimezoneOffset, toClinicDateStr } from "@/lib/appointments";
import { addMinutes, format, parse, isBefore } from "date-fns";

function extractBearerToken(authHeader: string | null) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function resolveN8nToken(req: Request) {
  const bearer = extractBearerToken(req.headers.get("authorization"));
  if (bearer) return bearer;
  const custom = req.headers.get("x-n8n-token");
  if (!custom) return null;
  return custom.trim() || null;
}

const WEEKDAY_NAMES_PT = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function calculateSlotsForDay(
  scheduleStartTime: string,
  scheduleEndTime: string,
  duration: number,
  dayDate: Date,
  bookings: { startTime: string; endTime: string }[],
  timeOffs: { startDateTime: Date; endDateTime: Date }[],
  isToday: boolean,
): string[] {
  const start = parse(scheduleStartTime, "HH:mm", dayDate);
  const end = parse(scheduleEndTime, "HH:mm", dayDate);
  const now = new Date();
  const slots: string[] = [];
  let currentSlot = start;

  while (addMinutes(currentSlot, duration) <= end) {
    const slotStartTime = format(currentSlot, "HH:mm");
    const slotEndTime = format(addMinutes(currentSlot, duration), "HH:mm");
    const slotEndDateTime = addMinutes(currentSlot, duration);

    if (isToday && isBefore(currentSlot, now)) {
      currentSlot = addMinutes(currentSlot, Math.min(duration, 30));
      continue;
    }

    const isOverlapping = bookings.some((booking) => {
      return (
        (slotStartTime >= booking.startTime &&
          slotStartTime < booking.endTime) ||
        (slotEndTime > booking.startTime && slotEndTime <= booking.endTime) ||
        (slotStartTime <= booking.startTime && slotEndTime >= booking.endTime)
      );
    });

    const isBlocked = timeOffs.some((timeOff) => {
      return (
        currentSlot < timeOff.endDateTime &&
        slotEndDateTime > timeOff.startDateTime
      );
    });

    if (!isOverlapping && !isBlocked) {
      slots.push(slotStartTime);
    }

    currentSlot = addMinutes(currentSlot, duration);
  }

  return slots;
}

export async function GET(req: Request) {
  try {
    const configuredToken = process.env.N8N_APPOINTMENTS_TOKEN?.trim();
    if (!configuredToken) {
      return NextResponse.json(
        { error: "Integração indisponível: configure N8N_APPOINTMENTS_TOKEN." },
        { status: 500 },
      );
    }

    const receivedToken = resolveN8nToken(req);
    if (!receivedToken || receivedToken !== configuredToken) {
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    const url = new URL(req.url);
    const professionalId = url.searchParams.get("professionalId")?.trim();
    const serviceId = url.searchParams.get("serviceId")?.trim();
    const daysParam = parseInt(url.searchParams.get("days") || "7", 10);
    const days = Math.min(Math.max(daysParam, 1), 14);

    if (!professionalId) {
      return NextResponse.json(
        { error: "Query param 'professionalId' é obrigatório." },
        { status: 400 },
      );
    }

    if (!serviceId) {
      return NextResponse.json(
        { error: "Query param 'serviceId' é obrigatório." },
        { status: 400 },
      );
    }

    const [professional, service, professionalService, schedules] =
      await Promise.all([
        prisma.professional.findUnique({
          where: { id: professionalId },
          select: { id: true, name: true },
        }),
        prisma.service.findUnique({
          where: { id: serviceId },
          select: { id: true, name: true, duration: true },
        }),
        prisma.professionalService.findUnique({
          where: {
            professionalId_serviceId: { professionalId, serviceId },
          },
          select: { professionalId: true },
        }),
        prisma.schedule.findMany({
          where: { professionalId },
          select: { dayOfWeek: true, startTime: true, endTime: true },
        }),
      ]);

    if (!professional) {
      return NextResponse.json(
        { result: "NOT_FOUND", error: "Profissional não encontrado." },
        { status: 404 },
      );
    }

    if (!service) {
      return NextResponse.json(
        { result: "NOT_FOUND", error: "Serviço não encontrado." },
        { status: 404 },
      );
    }

    if (!professionalService) {
      return NextResponse.json(
        {
          result: "INVALID",
          error: "O profissional selecionado não atende este serviço.",
        },
        { status: 400 },
      );
    }

    const scheduleMap = new Map(schedules.map((s) => [s.dayOfWeek, s]));

    const tzOffset = getClinicTimezoneOffset();
    const now = new Date();
    const todayStr = toClinicDateStr(now);

    const datesToCheck: {
      dateStr: string;
      dayOfWeek: number;
      dayDate: Date;
    }[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = toClinicDateStr(d);
      const dayDate = new Date(`${dateStr}T00:00:00.000${tzOffset}`);
      const dayOfWeek = dayDate.getDay();

      if (scheduleMap.has(dayOfWeek)) {
        datesToCheck.push({ dateStr, dayOfWeek, dayDate });
      }
    }

    if (datesToCheck.length === 0) {
      return NextResponse.json({
        result: "OK",
        professional: { id: professional.id, name: professional.name },
        service: {
          id: service.id,
          name: service.name,
          duration: service.duration,
        },
        slots: [],
        message: `${professional.name} não tem horários configurados nos próximos ${days} dias.`,
      });
    }

    const firstDate = new Date(
      `${datesToCheck[0].dateStr}T00:00:00.000${tzOffset}`,
    );
    const lastDate = new Date(
      `${datesToCheck[datesToCheck.length - 1].dateStr}T23:59:59.999${tzOffset}`,
    );

    const [bookings, timeOffs] = await Promise.all([
      prisma.booking.findMany({
        where: {
          professionalId,
          date: { gte: firstDate, lte: lastDate },
          status: { not: BookingStatus.CANCELLED },
        },
        select: { date: true, startTime: true, endTime: true },
      }),
      prisma.professionalTimeOff.findMany({
        where: {
          professionalId,
          startDateTime: { lte: lastDate },
          endDateTime: { gte: firstDate },
        },
        select: { startDateTime: true, endDateTime: true },
      }),
    ]);

    const bookingsByDate = new Map<
      string,
      { startTime: string; endTime: string }[]
    >();
    for (const b of bookings) {
      const bDateStr = toClinicDateStr(b.date);
      const arr = bookingsByDate.get(bDateStr) || [];
      arr.push({ startTime: b.startTime, endTime: b.endTime });
      bookingsByDate.set(bDateStr, arr);
    }

    const slots: { date: string; dayOfWeek: string; times: string[] }[] = [];

    for (const { dateStr, dayOfWeek, dayDate } of datesToCheck) {
      const schedule = scheduleMap.get(dayOfWeek)!;
      const dayBookings = bookingsByDate.get(dateStr) || [];

      const startOfDay = new Date(`${dateStr}T00:00:00.000${tzOffset}`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999${tzOffset}`);

      const dayTimeOffs = timeOffs.filter(
        (to) => to.startDateTime < endOfDay && to.endDateTime > startOfDay,
      );

      const availableTimes = calculateSlotsForDay(
        schedule.startTime,
        schedule.endTime,
        service.duration,
        dayDate,
        dayBookings,
        dayTimeOffs,
        dateStr === todayStr,
      );

      if (availableTimes.length > 0) {
        slots.push({
          date: dateStr,
          dayOfWeek: WEEKDAY_NAMES_PT[dayOfWeek],
          times: availableTimes,
        });
      }
    }

    return NextResponse.json({
      result: "OK",
      professional: { id: professional.id, name: professional.name },
      service: {
        id: service.id,
        name: service.name,
        duration: service.duration,
      },
      slots,
    });
  } catch (error) {
    console.error("n8n availability route error:", error);
    return NextResponse.json(
      { result: "ERROR", error: "Falha ao calcular disponibilidade." },
      { status: 500 },
    );
  }
}
