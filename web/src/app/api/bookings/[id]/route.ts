import { NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";
import { canTransitionAppointmentStatus } from "@/lib/appointment-status";
import { buildClinicDateTimeFromDate } from "@/lib/appointments";
import {
  cancelBookingRemindersForBooking,
  syncBookingRemindersForBooking,
} from "@/lib/booking-reminders";
import { prisma } from "@/lib/prisma";
import { ensureCanManageAppointments } from "@/lib/clinic-access";

const RESULT_STATUSES: BookingStatus[] = [
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

function buildBookingDateTime(date: Date, time: string) {
  return buildClinicDateTimeFromDate(date, time);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await ensureCanManageAppointments();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const { id } = await params;
    const { status } = await req.json();
    const normalizedStatus =
      typeof status === "string" ? status.trim().toUpperCase() : "";

    if (
      !normalizedStatus ||
      !Object.values(BookingStatus).includes(normalizedStatus as BookingStatus)
    ) {
      return NextResponse.json(
        { error: "Status inválido para o agendamento." },
        { status: 400 },
      );
    }

    const currentBooking = await prisma.booking.findUnique({
      where: { id },
      select: {
        status: true,
        date: true,
        startTime: true,
        professional: {
          select: { email: true },
        },
      },
    });

    if (!currentBooking) {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 },
      );
    }

    if (access.userRole === "DOUTOR") {
      if (
        !access.userEmail ||
        currentBooking.professional.email !== access.userEmail
      ) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const nextStatus = normalizedStatus as BookingStatus;
    const canTransition = canTransitionAppointmentStatus(
      currentBooking.status,
      nextStatus,
    );
    if (!canTransition) {
      return NextResponse.json(
        {
          error:
            "Transição de status inválida. Agendamentos cancelados, finalizados ou não comparecidos não podem voltar para pendente/confirmado.",
        },
        { status: 409 },
      );
    }

    const isResultStatus = RESULT_STATUSES.includes(nextStatus);
    if (isResultStatus && currentBooking.status !== nextStatus) {
      const bookingStartDateTime = buildBookingDateTime(
        currentBooking.date,
        currentBooking.startTime,
      );
      if (bookingStartDateTime > new Date()) {
        return NextResponse.json(
          {
            error:
              "Só é possível marcar como realizado ou não compareceu após o início do horário agendado.",
          },
          { status: 409 },
        );
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: nextStatus },
      include: { patient: true, professional: true, service: true },
    });

    if (
      nextStatus === BookingStatus.PENDING ||
      nextStatus === BookingStatus.CONFIRMED
    ) {
      await syncBookingRemindersForBooking(id);
    } else {
      await cancelBookingRemindersForBooking(
        id,
        `Agendamento atualizado para status ${nextStatus}.`,
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await ensureCanManageAppointments();
    // Only ADMIN or ATENDENTE can delete the record physically (usually we just cancel).
    if (!access.ok || access.userRole === "DOUTOR") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.booking.delete({
      where: { id },
    });

    try {
      await cancelBookingRemindersForBooking(
        id,
        "Agendamento removido pela API.",
      );
    } catch (reminderError) {
      console.error("Booking delete reminder cleanup error:", reminderError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}
