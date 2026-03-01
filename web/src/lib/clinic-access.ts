import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { type Role } from "@prisma/client";

export interface ClinicAccessContext {
  userId: string;
  userRole: Role;
  userEmail: string | null;
}

const ALLOWED_ROLES: Role[] = ["ADMIN", "ATENDENTE", "DOUTOR"];
const CLINIC_STAFF_ROLES = new Set<Role>(["ADMIN", "ATENDENTE", "DOUTOR"]);
const TIMEOFF_ALLOWED_ROLES = new Set<Role>(["ADMIN", "DOUTOR"]);

function parseRole(role: unknown): Role | null {
  if (typeof role !== "string") return null;
  if (ALLOWED_ROLES.includes(role as Role)) {
    return role as Role;
  }
  return null;
}

async function getSessionContext() {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = parseRole(session?.user?.role);
  const userEmail = session?.user?.email ?? null;
  return { session, userId, userRole, userEmail };
}

export function isClinicStaffRole(role: unknown): role is Role {
  const normalizedRole = parseRole(role);
  return !!normalizedRole && CLINIC_STAFF_ROLES.has(normalizedRole);
}

export async function ensureCanManageAppointments() {
  const context = await getSessionContext();
  if (
    !context.session ||
    !context.userId ||
    !context.userRole ||
    !CLINIC_STAFF_ROLES.has(context.userRole)
  ) {
    return { ok: false as const, error: "Acesso negado." };
  }

  return {
    ok: true as const,
    userId: context.userId,
    userRole: context.userRole,
    userEmail: context.userEmail,
  };
}

export async function ensureCanManageTimeOff() {
  const context = await getSessionContext();
  if (
    !context.session ||
    !context.userId ||
    !context.userRole ||
    !TIMEOFF_ALLOWED_ROLES.has(context.userRole)
  ) {
    return { ok: false as const, error: "Acesso negado." };
  }

  return {
    ok: true as const,
    userId: context.userId,
    userRole: context.userRole,
    userEmail: context.userEmail,
  };
}

export async function ensureAdminAccess() {
  const context = await getSessionContext();
  if (
    !context.session ||
    !context.userId ||
    !context.userRole ||
    context.userRole !== "ADMIN"
  ) {
    return { ok: false as const, error: "Acesso negado." };
  }

  return {
    ok: true as const,
    userId: context.userId,
    userRole: context.userRole,
    userEmail: context.userEmail,
  };
}

export async function getDoctorProfessionalIdByEmail(
  doctorEmail: string | null,
) {
  if (!doctorEmail) return null;

  const professional = await prisma.professional.findUnique({
    where: { email: doctorEmail },
    select: { id: true },
  });

  return professional?.id ?? null;
}

export async function canDoctorManageProfessional(
  professionalId: string,
  doctorEmail: string,
) {
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
    select: { email: true },
  });

  if (!professional) {
    return { allowed: false, missing: true };
  }

  return { allowed: professional.email === doctorEmail, missing: false };
}

export async function canDoctorManageBooking(
  bookingId: string,
  doctorEmail: string,
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      professional: {
        select: { email: true },
      },
    },
  });

  if (!booking) {
    return { allowed: false, missing: true };
  }

  return { allowed: booking.professional.email === doctorEmail, missing: false };
}
