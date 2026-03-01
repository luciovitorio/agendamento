import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ScheduleManager } from "./_components/schedule-manager";
import { prisma } from "@/lib/prisma";

export default async function SchedulesPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userEmail = session?.user?.email;

  // Only ADMIN and DOUTOR can access schedules
  if (userRole === "ATENDENTE") {
    redirect("/admin");
  }

  let professionals;

  if (userRole === "DOUTOR" && userEmail) {
    // Doctor can only see their own schedule
    professionals = await prisma.professional.findMany({
      where: { email: userEmail },
      include: {
        schedules: {
          orderBy: { dayOfWeek: "asc" },
        },
      },
    });
  } else {
    // ADMIN sees all professionals
    professionals = await prisma.professional.findMany({
      include: {
        schedules: {
          orderBy: { dayOfWeek: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Horários de Atendimento
        </h1>
        <p className="text-slate-500 dark:text-zinc-400 mt-2">
          {userRole === "DOUTOR"
            ? "Gerencie seus horários de atendimento."
            : "Gerencie os horários de atendimento de cada profissional."}
        </p>
      </div>

      <ScheduleManager
        professionals={JSON.parse(JSON.stringify(professionals))}
        isDoctor={userRole === "DOUTOR"}
      />
    </div>
  );
}
