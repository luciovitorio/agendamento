import { NextResponse } from "next/server";
import { BookingSource } from "@prisma/client";
import { auth } from "@/auth";
import { createAppointment } from "@/lib/appointments";
import { prisma } from "@/lib/prisma";
import {
  ensureCanManageAppointments,
  getDoctorProfessionalIdByEmail,
  isClinicStaffRole,
} from "@/lib/clinic-access";

// Protected: Get all bookings (Admin/Atendente)
export async function GET() {
  try {
    const access = await ensureCanManageAppointments();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    let professionalFilter: { professionalId?: string } = {};
    if (access.userRole === "DOUTOR") {
      const doctorProfessionalId = await getDoctorProfessionalIdByEmail(
        access.userEmail,
      );
      if (!doctorProfessionalId) {
        return NextResponse.json([]);
      }
      professionalFilter.professionalId = doctorProfessionalId;
    }

    const bookings = await prisma.booking.findMany({
      where: professionalFilter,
      include: {
        patient: true,
        professional: true,
        service: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(bookings);
  } catch (error) {
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }
}

// Public: Create a new booking
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { professionalId, serviceId, dateStr, startTime, name, phone, email } =
      body ?? {};

    const session = await auth();
    const role = session?.user?.role;
    const isStaff = isClinicStaffRole(role);

    const result = await createAppointment({
      professionalId,
      serviceId,
      dateStr,
      startTime,
      patientName: name,
      patientPhone: phone,
      patientEmail: email,
      source: isStaff ? BookingSource.MANUAL : BookingSource.WEB,
      createdByUserId: isStaff ? (session?.user?.id ?? null) : null,
      externalRequestId:
        typeof body?.externalRequestId === "string"
          ? body.externalRequestId
          : null,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.httpStatus },
      );
    }

    return NextResponse.json(
      {
        booking: result.booking,
        created: result.created,
        idempotent: result.idempotent,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error("Booking Error:", error);
    return NextResponse.json({ error: "Erro ao agendar" }, { status: 500 });
  }
}
