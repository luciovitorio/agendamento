import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PlansClientPage } from "./client-page";
import type { HealthPlanData } from "./_components/types";
import { prisma } from "@/lib/prisma";

export default async function AdminPlansPage() {
  const session = await auth();
  const userRole = session?.user?.role;

  if (userRole !== "ADMIN") {
    redirect("/admin");
  }

  const plans = await prisma.healthPlan.findMany({
    include: {
      _count: { select: { patients: true } },
    },
    orderBy: { name: "asc" },
  });

  const formattedPlans: HealthPlanData[] = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    patientsCount: plan._count.patients,
    createdAt: plan.createdAt.toISOString(),
  }));

  return <PlansClientPage plans={formattedPlans} />;
}
