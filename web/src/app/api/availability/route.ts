import { NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";
import { addMinutes, format, parse, isBefore, isSameDay } from "date-fns";
import { getClinicTimezoneOffset } from "@/lib/appointments";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const professionalId = searchParams.get("professionalId");
    const serviceId = searchParams.get("serviceId");
    const dateStr = searchParams.get("date"); // Expected Format: YYYY-MM-DD

    if (!professionalId || !serviceId || !dateStr) {
      return NextResponse.json(
        {
          error:
            "Faltam parâmetros requiridos (professionalId, serviceId, date)",
        },
        { status: 400 },
      );
    }

    const timezoneOffset = getClinicTimezoneOffset();
    const date = new Date(`${dateStr}T00:00:00.000${timezoneOffset}`);
    const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday...

    const [professional, service, professionalService, schedule] =
      await Promise.all([
        prisma.professional.findUnique({
          where: { id: professionalId },
          select: { id: true },
        }),
        prisma.service.findUnique({
          where: { id: serviceId },
          select: { id: true, duration: true },
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
        prisma.schedule.findUnique({
          where: {
            professionalId_dayOfWeek: {
              professionalId,
              dayOfWeek,
            },
          },
        }),
      ]);

    if (!professional) {
      return NextResponse.json(
        { error: "Profissional não encontrado" },
        { status: 404 },
      );
    }

    if (!service) {
      return NextResponse.json(
        { error: "Serviço não encontrado" },
        { status: 404 },
      );
    }

    if (!professionalService) {
      return NextResponse.json(
        { error: "O profissional selecionado não atende este serviço." },
        { status: 400 },
      );
    }

    if (!schedule) {
      return NextResponse.json({ slots: [] }); // No schedule for this day
    }

    // 3. Fetch all active bookings for this doctor on this given date
    const startOfDay = new Date(`${dateStr}T00:00:00.000${timezoneOffset}`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999${timezoneOffset}`);

    const bookings = await prisma.booking.findMany({
      where: {
        professionalId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { not: BookingStatus.CANCELLED },
      },
    });
    const timeOffs = await prisma.professionalTimeOff.findMany({
      where: {
        professionalId,
        startDateTime: { lt: endOfDay },
        endDateTime: { gt: startOfDay },
      },
      orderBy: { startDateTime: "asc" },
    });

    // 4. Calculate available slots using the duration block limits
    const start = parse(schedule.startTime, "HH:mm", date);
    const end = parse(schedule.endTime, "HH:mm", date);
    const duration = service.duration;

    const slots: string[] = [];
    let currentSlot = start;
    const now = new Date();

    while (addMinutes(currentSlot, duration) <= end) {
      const slotStartTime = format(currentSlot, "HH:mm");
      const slotEndTime = format(addMinutes(currentSlot, duration), "HH:mm");
      const slotStartDateTime = currentSlot;
      const slotEndDateTime = addMinutes(currentSlot, duration);

      // Prevent generating slots in the past
      if (isSameDay(currentSlot, now) && isBefore(currentSlot, now)) {
        currentSlot = addMinutes(currentSlot, Math.min(duration, 30)); // Move 30 min ahead
        continue;
      }

      // 5. Check overlaps
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
          slotStartDateTime < timeOff.endDateTime &&
          slotEndDateTime > timeOff.startDateTime
        );
      });

      if (!isOverlapping && !isBlocked) {
        slots.push(slotStartTime);
      }

      // Increment slot (typically fixed blocks of service duration)
      // To mimic Cal.com better, we usually allow start intervals of 15, 30, or the service duration.
      // Here, we increment by the exact service block duration to keep it simple and clash-free.
      currentSlot = addMinutes(currentSlot, duration);
    }

    return NextResponse.json({
      slots,
      date: dateStr,
      professionalId,
      serviceId,
    });
  } catch (error) {
    console.error("Availability Error:", error);
    return NextResponse.json(
      { error: "Falha ao buscar horários" },
      { status: 500 },
    );
  }
}
