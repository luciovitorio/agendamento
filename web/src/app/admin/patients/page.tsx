import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PatientsClientPage } from "./client-page";
import type { HealthPlanOption, PatientData } from "./_components/types";
import { prisma } from "@/lib/prisma";

export default async function AdminPatientsPage() {
  const session = await auth();
  const userRole = session?.user?.role;

  if (!userRole || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(userRole)) {
    redirect("/admin");
  }

  const [patients, healthPlans] = await Promise.all([
    prisma.patient.findMany({
      include: {
        healthPlan: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.healthPlan.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  const formattedPatients: PatientData[] = patients.map((patient) => ({
    id: patient.id,
    name: patient.name,
    email: patient.email,
    phone: patient.phone,
    coverageType: patient.coverageType as "PARTICULAR" | "PLAN",
    healthPlanId: patient.healthPlanId,
    healthPlanName: patient.healthPlan?.name || null,
    bookingsCount: patient._count.bookings,
    createdAt: patient.createdAt.toISOString(),
  }));

  const planOptions: HealthPlanOption[] = healthPlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
  }));

  return (
    <PatientsClientPage patients={formattedPatients} healthPlans={planOptions} />
  );
}
