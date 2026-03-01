import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CreateAppointmentModal } from "../_components/create-appointment-modal";
import type { ProfessionalOption } from "../_components/types";
import { prisma } from "@/lib/prisma";

export default async function AdminNewAppointmentPage() {
  const session = await auth();
  const userRole = session?.user?.role;
  const userEmail = session?.user?.email;

  if (!userRole || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(userRole)) {
    redirect("/admin");
  }

  const [professionals, healthPlans] = await Promise.all([
    prisma.professional.findMany({
      where:
        userRole === "DOUTOR" && userEmail ? { email: userEmail } : undefined,
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.healthPlan.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const formattedProfessionals: ProfessionalOption[] = professionals.map(
    (professional) => ({
      id: professional.id,
      name: professional.name,
      services: professional.services
        .map((entry) => ({
          id: entry.service.id,
          name: entry.service.name,
          duration: entry.service.duration,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }),
  );

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
          <Link
            href="/admin"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Dashboard
          </Link>
          <ChevronRight className="size-4" />
          <Link
            href="/admin/appointments"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Gestão de Agendamentos
          </Link>
          <ChevronRight className="size-4" />
          <span className="text-slate-900 dark:text-slate-100 font-medium">
            Novo Agendamento
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Novo Agendamento
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Registre o agendamento manual completo em uma página dedicada, com
          seleção de slot e confirmação do paciente no mesmo fluxo.
        </p>
      </div>

      <CreateAppointmentModal
        mode="page"
        professionals={formattedProfessionals}
        healthPlans={healthPlans}
        backHref="/admin/appointments"
      />
    </div>
  );
}
