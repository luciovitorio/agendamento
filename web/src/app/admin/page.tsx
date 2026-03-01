import { BookingStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  DollarSign,
  UserPlus,
  Clock,
  BedDouble,
  TrendingUp,
  UserRoundCheck,
  UserX,
} from "lucide-react";
import { StatCard } from "./_components/stat-card";
import { UpcomingBookingsTable } from "./_components/upcoming-bookings-table";
import { ActivityFeed, type ActivityFeedItem } from "./_components/activity-feed";
import { prisma } from "@/lib/prisma";
import { getClinicTimezoneOffset, toClinicDateStr } from "@/lib/appointments";

type DashboardRole = "ADMIN" | "ATENDENTE" | "DOUTOR";

function parseTimezoneOffsetToMinutes(offset: string) {
  const sign = offset[0] === "-" ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  return sign * (hours * 60 + minutes);
}

function getClinicTimeHHmm(date: Date, timezoneOffset: string) {
  const offsetMinutes = parseTimezoneOffsetToMinutes(timezoneOffset);
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const hours = String(shifted.getUTCHours()).padStart(2, "0");
  const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function createActivityFromBookings(
  bookings: Array<{
    id: string;
    status: BookingStatus;
    createdAt: Date;
    patient: { name: string };
    professional: { name: string };
    service: { name: string };
  }>,
): ActivityFeedItem[] {
  return bookings.map((booking) => {
    const statusLabel =
      booking.status === "PENDING"
        ? "Pendente"
        : booking.status === "CONFIRMED"
          ? "Confirmado"
          : booking.status === "COMPLETED"
            ? "Realizado"
            : booking.status === "NO_SHOW"
              ? "Não compareceu"
              : "Cancelado";

    return {
      id: booking.id,
      title: `Agendamento ${statusLabel.toLowerCase()}`,
      description: `${booking.patient.name} • ${booking.professional.name} • ${booking.service.name}`,
      createdAt: booking.createdAt,
      type:
        booking.status === "CANCELLED" || booking.status === "NO_SHOW"
          ? "warning"
          : booking.status === "COMPLETED"
            ? "success"
            : "info",
    };
  });
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const userRole = session?.user?.role as DashboardRole | undefined;
  const userEmail = session?.user?.email;

  if (!userRole || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(userRole)) {
    redirect("/admin/appointments");
  }

  const now = new Date();
  const clinicTimezoneOffset = getClinicTimezoneOffset();
  const todayStr = toClinicDateStr(now);
  const todayStart = new Date(`${todayStr}T00:00:00.000${clinicTimezoneOffset}`);
  const todayEnd = new Date(`${todayStr}T23:59:59.999${clinicTimezoneOffset}`);
  const currentClinicTime = getClinicTimeHHmm(now, clinicTimezoneOffset);
  const isDoctorRole = userRole === "DOUTOR";

  const doctorProfessional =
    isDoctorRole && userEmail
      ? await prisma.professional.findUnique({
          where: { email: userEmail },
          select: { id: true, name: true },
        })
      : null;

  const professionalScope =
    isDoctorRole
      ? { professionalId: doctorProfessional?.id || "__NO_PROFESSIONAL__" }
      : undefined;

  const upcomingDateWhere = {
    OR: [
      {
        date: { gt: todayEnd },
      },
      {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        startTime: {
          gte: currentClinicTime,
        },
      },
    ],
  };

  const upcomingWhere = {
    ...(professionalScope ?? {}),
    ...upcomingDateWhere,
    status: { not: BookingStatus.CANCELLED },
  };

  const todayWhere = {
    ...(professionalScope ?? {}),
    date: {
      gte: todayStart,
      lte: todayEnd,
    },
    status: { not: BookingStatus.CANCELLED },
  };

  const [upcomingBookings, totalBookingsToday, pendingFuture, noShowToday, recentBookings] =
    await Promise.all([
      prisma.booking.findMany({
        where: upcomingWhere,
        include: {
          patient: true,
          professional: true,
          service: true,
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 5,
      }),
      prisma.booking.count({ where: todayWhere }),
      prisma.booking.count({
        where: {
          ...(professionalScope ?? {}),
          status: BookingStatus.PENDING,
          ...upcomingDateWhere,
        },
      }),
      prisma.booking.count({
        where: {
          ...(professionalScope ?? {}),
          status: BookingStatus.NO_SHOW,
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
      prisma.booking.findMany({
        where: professionalScope ?? undefined,
        include: {
          patient: { select: { name: true } },
          professional: { select: { name: true } },
          service: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

  const completedTodayBookings = await prisma.booking.findMany({
    where: {
      ...(professionalScope ?? {}),
      status: BookingStatus.COMPLETED,
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: {
      service: { select: { price: true } },
    },
  });

  const completedToday = completedTodayBookings.length;
  const revenueToday = completedTodayBookings.reduce(
    (total, booking) => total + (booking.service.price || 0),
    0,
  );

  const newPatientsToday =
    isDoctorRole
      ? (
          await prisma.booking.findMany({
            where: todayWhere,
            select: { patientId: true },
            distinct: ["patientId"],
          })
        ).length
      : await prisma.patient.count({
          where: {
            createdAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        });

  const totalProfessionals =
    isDoctorRole ? (doctorProfessional ? 1 : 0) : await prisma.professional.count();

  const feedItems = createActivityFromBookings(recentBookings);

  const showRevenue = userRole === "ADMIN";
  const isDoctorView = isDoctorRole;
  const canShowGlobalScope = userRole === "ADMIN" || userRole === "ATENDENTE";

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {showRevenue ? (
          <StatCard
            title="Faturamento de Hoje"
            value={formatCurrencyBRL(revenueToday)}
            icon={DollarSign}
            colorClass="emerald"
          />
        ) : (
          <StatCard
            title={isDoctorView ? "Minhas Consultas Hoje" : "Consultas Realizadas Hoje"}
            value={completedToday.toString()}
            icon={UserRoundCheck}
            colorClass="emerald"
          />
        )}

        <StatCard
          title={isDoctorView ? "Pacientes Atendidos Hoje" : "Novos Pacientes Hoje"}
          value={newPatientsToday.toString()}
          icon={UserPlus}
          colorClass="primary"
        />

        <StatCard
          title="Confirmações Pendentes"
          value={pendingFuture.toString()}
          icon={Clock}
          colorClass="orange"
        />

        <StatCard
          title="Agendamentos Hoje"
          value={totalBookingsToday.toString()}
          icon={BedDouble}
          colorClass="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <UpcomingBookingsTable
            bookings={upcomingBookings}
            showProfessionalColumn={canShowGlobalScope}
          />

          <div className="bg-indigo-600/5 dark:bg-indigo-600/10 border border-indigo-600/20 p-6 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                {isDoctorView
                  ? "Resumo da Minha Agenda"
                  : "Panorama da Clínica Hoje"}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isDoctorView
                  ? `${doctorProfessional?.name || "Profissional"} possui ${pendingFuture} confirmações pendentes e ${noShowToday} não comparecimentos hoje.`
                  : `Visão consolidada de ${totalProfessionals} profissionais ativos, com ${noShowToday} não comparecimentos no dia.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-2 text-xs font-bold">
                <UserX className="size-4" />
                No-show: {noShowToday}
              </span>
              <button className="bg-indigo-600 text-white p-2 text-center rounded-lg hover:bg-indigo-700 transition-colors">
                <TrendingUp className="size-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <ActivityFeed
            title={isDoctorView ? "Minhas Atividades" : "Feed de Atividade"}
            items={feedItems}
            emptyMessage="Sem atividades recentes para exibir."
          />
        </div>
      </div>
    </>
  );
}
