import { BookingStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type DashboardRole = "ADMIN" | "ATENDENTE" | "DOUTOR";

interface SearchParams {
  type?: string | string[];
  id?: string | string[];
}

interface Props {
  searchParams: Promise<SearchParams>;
}

const weekdayLabels: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getStatusLabel(status: BookingStatus) {
  if (status === "PENDING") return "Pendente";
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "COMPLETED") return "Realizado";
  if (status === "NO_SHOW") return "Não compareceu";
  return "Cancelado";
}

function getStatusBadge(status: BookingStatus) {
  if (status === "PENDING") {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  if (status === "CONFIRMED") {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (status === "COMPLETED") {
    return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
  }
  if (status === "NO_SHOW") {
    return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
  }
  return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function toBookingDateTime(date: Date, startTime: string) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const dateTime = new Date(date);
  dateTime.setHours(hours || 0, minutes || 0, 0, 0);
  return dateTime;
}

function createStatusCounter() {
  return {
    PENDING: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
    NO_SHOW: 0,
  };
}

export default async function AdminSearchPage({ searchParams }: Props) {
  const session = await auth();
  const userRole = session?.user?.role as DashboardRole | undefined;
  const userEmail = session?.user?.email;

  if (!userRole || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(userRole)) {
    redirect("/admin");
  }

  const doctorProfessional =
    userRole === "DOUTOR" && userEmail
      ? await prisma.professional.findUnique({
          where: { email: userEmail },
          select: { id: true, name: true },
        })
      : null;

  if (userRole === "DOUTOR" && !doctorProfessional) {
    redirect("/admin");
  }

  const params = await searchParams;
  const selectedType = getParamValue(params.type)?.toLowerCase();
  const selectedId = getParamValue(params.id);
  const isPatientSearch = selectedType === "patient";
  const isProfessionalSearch = selectedType === "professional";

  if (!selectedType || !selectedId || (!isPatientSearch && !isProfessionalSearch)) {
    return (
      <section className="max-w-5xl">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Busca Inteligente
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Use o campo de busca no cabeçalho para selecionar um paciente ou médico
          e visualizar os dados detalhados de agenda.
        </p>
      </section>
    );
  }

  if (isPatientSearch) {
    const patient = await prisma.patient.findFirst({
      where: {
        id: selectedId,
        ...(userRole === "DOUTOR"
          ? { bookings: { some: { professionalId: doctorProfessional!.id } } }
          : {}),
      },
      include: {
        healthPlan: { select: { name: true } },
      },
    });

    if (!patient) {
      return (
        <section className="max-w-5xl">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Paciente não encontrado
          </h1>
          <p className="text-slate-500 mt-2">
            Esse paciente não existe ou você não tem permissão para visualizar.
          </p>
        </section>
      );
    }

    const bookings = await prisma.booking.findMany({
      where: {
        patientId: patient.id,
        ...(userRole === "DOUTOR" ? { professionalId: doctorProfessional!.id } : {}),
      },
      include: {
        professional: { select: { name: true } },
        service: { select: { name: true, price: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const now = new Date();
    const upcomingBookings = bookings.filter(
      (booking) => toBookingDateTime(booking.date, booking.startTime) >= now,
    );
    const pastBookings = bookings
      .filter((booking) => toBookingDateTime(booking.date, booking.startTime) < now)
      .reverse();

    const statusCounter = createStatusCounter();
    for (const booking of bookings) {
      statusCounter[booking.status] += 1;
    }

    return (
      <div className="space-y-6">
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Histórico do Paciente
          </h1>
          <p className="text-slate-500 mt-2">
            {patient.name} • {patient.phone}
            {patient.email ? ` • ${patient.email}` : ""}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cobertura:{" "}
            {patient.coverageType === "PLAN"
              ? `Plano (${patient.healthPlan?.name || "Sem plano definido"})`
              : "Particular"}
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-2xl font-black">{bookings.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-xs text-slate-500">Pendentes</p>
            <p className="text-2xl font-black">{statusCounter.PENDING}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-xs text-slate-500">Confirmados</p>
            <p className="text-2xl font-black">{statusCounter.CONFIRMED}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-xs text-slate-500">Realizados</p>
            <p className="text-2xl font-black">{statusCounter.COMPLETED}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-xs text-slate-500">Cancel. + No-show</p>
            <p className="text-2xl font-black">
              {statusCounter.CANCELLED + statusCounter.NO_SHOW}
            </p>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
          <h2 className="font-bold text-slate-900 dark:text-white mb-3">
            Próximos agendamentos ({upcomingBookings.length})
          </h2>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2">Data e hora</th>
                  <th className="text-left px-3 py-2">Médico</th>
                  <th className="text-left px-3 py-2">Serviço</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingBookings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500 text-center">
                      Nenhum agendamento futuro para este paciente.
                    </td>
                  </tr>
                ) : (
                  upcomingBookings.map((booking) => (
                    <tr key={booking.id} className="border-t border-slate-200 dark:border-zinc-800">
                      <td className="px-3 py-2">
                        {format(booking.date, "dd/MM/yyyy", { locale: ptBR })} •{" "}
                        {booking.startTime} - {booking.endTime}
                      </td>
                      <td className="px-3 py-2">{booking.professional.name}</td>
                      <td className="px-3 py-2">{booking.service.name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            booking.status,
                          )}`}
                        >
                          {getStatusLabel(booking.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
          <h2 className="font-bold text-slate-900 dark:text-white mb-3">
            Histórico de atendimentos ({pastBookings.length})
          </h2>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2">Data e hora</th>
                  <th className="text-left px-3 py-2">Médico</th>
                  <th className="text-left px-3 py-2">Serviço</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {pastBookings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500 text-center">
                      Este paciente ainda não possui atendimentos passados.
                    </td>
                  </tr>
                ) : (
                  pastBookings.map((booking) => (
                    <tr key={booking.id} className="border-t border-slate-200 dark:border-zinc-800">
                      <td className="px-3 py-2">
                        {format(booking.date, "dd/MM/yyyy", { locale: ptBR })} •{" "}
                        {booking.startTime} - {booking.endTime}
                      </td>
                      <td className="px-3 py-2">{booking.professional.name}</td>
                      <td className="px-3 py-2">{booking.service.name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            booking.status,
                          )}`}
                        >
                          {getStatusLabel(booking.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  const professional = await prisma.professional.findFirst({
    where: {
      id: selectedId,
      ...(userRole === "DOUTOR" ? { id: doctorProfessional!.id } : {}),
    },
    include: {
      services: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              duration: true,
              price: true,
            },
          },
        },
      },
      schedules: {
        orderBy: { dayOfWeek: "asc" },
      },
      timeOffs: {
        where: {
          endDateTime: { gte: new Date() },
        },
        orderBy: { startDateTime: "asc" },
        take: 10,
      },
    },
  });

  if (!professional) {
    return (
      <section className="max-w-5xl">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Médico não encontrado
        </h1>
        <p className="text-slate-500 mt-2">
          Esse médico não existe ou você não tem permissão para visualizar.
        </p>
      </section>
    );
  }

  const bookings = await prisma.booking.findMany({
    where: { professionalId: professional.id },
    include: {
      patient: { select: { name: true, phone: true } },
      service: { select: { name: true, price: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const upcomingBookings = bookings.filter(
    (booking) => toBookingDateTime(booking.date, booking.startTime) >= now,
  );
  const pastBookings = bookings
    .filter((booking) => toBookingDateTime(booking.date, booking.startTime) < now)
    .reverse();
  const next7DaysCount = bookings.filter((booking) => {
    const bookingDateTime = toBookingDateTime(booking.date, booking.startTime);
    return bookingDateTime >= now && bookingDateTime <= nextWeek;
  }).length;

  const statusCounter = createStatusCounter();
  let revenue = 0;
  for (const booking of bookings) {
    statusCounter[booking.status] += 1;
    if (booking.status === "COMPLETED") {
      revenue += booking.service.price || 0;
    }
  }

  const uniquePatients = new Set(bookings.map((booking) => booking.patientId)).size;
  const showFinancial =
    userRole === "ADMIN" ||
    (userRole === "DOUTOR" && professional.id === doctorProfessional?.id);

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Painel do Médico
        </h1>
        <p className="text-slate-500 mt-2">
          {professional.name} • {professional.email}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Total de agendas</p>
          <p className="text-2xl font-black">{bookings.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Próximos</p>
          <p className="text-2xl font-black">{upcomingBookings.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Próximos 7 dias</p>
          <p className="text-2xl font-black">{next7DaysCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Pacientes únicos</p>
          <p className="text-2xl font-black">{uniquePatients}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">No-show + cancel.</p>
          <p className="text-2xl font-black">
            {statusCounter.NO_SHOW + statusCounter.CANCELLED}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Faturamento</p>
          <p className="text-xl font-black">
            {showFinancial
              ? formatCurrencyBRL(revenue)
              : "Visível apenas para admin e médico responsável"}
          </p>
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <h2 className="font-bold text-slate-900 dark:text-white mb-3">
          Serviços vinculados ({professional.services.length})
        </h2>
        {professional.services.length === 0 ? (
          <p className="text-sm text-slate-500">
            Este médico ainda não possui serviços vinculados.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {professional.services.map((link) => (
              <div
                key={link.service.id}
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 p-3"
              >
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {link.service.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Duração: {link.service.duration} min
                </p>
                <p className="text-xs text-slate-500">
                  Preço:{" "}
                  {link.service.price !== null
                    ? formatCurrencyBRL(link.service.price)
                    : "Não definido"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
          <h2 className="font-bold text-slate-900 dark:text-white mb-3">
            Horários disponíveis cadastrados
          </h2>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2">Dia</th>
                  <th className="text-left px-3 py-2">Início</th>
                  <th className="text-left px-3 py-2">Fim</th>
                </tr>
              </thead>
              <tbody>
                {professional.schedules.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-slate-500 text-center">
                      Nenhum horário configurado.
                    </td>
                  </tr>
                ) : (
                  professional.schedules.map((schedule) => (
                    <tr key={schedule.id} className="border-t border-slate-200 dark:border-zinc-800">
                      <td className="px-3 py-2">{weekdayLabels[schedule.dayOfWeek]}</td>
                      <td className="px-3 py-2">{schedule.startTime}</td>
                      <td className="px-3 py-2">{schedule.endTime}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
          <h2 className="font-bold text-slate-900 dark:text-white mb-3">
            Bloqueios futuros de agenda
          </h2>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2">Início</th>
                  <th className="text-left px-3 py-2">Fim</th>
                  <th className="text-left px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {professional.timeOffs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-slate-500 text-center">
                      Sem bloqueios futuros.
                    </td>
                  </tr>
                ) : (
                  professional.timeOffs.map((timeOff) => (
                    <tr key={timeOff.id} className="border-t border-slate-200 dark:border-zinc-800">
                      <td className="px-3 py-2">
                        {format(timeOff.startDateTime, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-2">
                        {format(timeOff.endDateTime, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-2">{timeOff.reason || "Sem motivo informado"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <h2 className="font-bold text-slate-900 dark:text-white mb-3">
          Próximos agendamentos ({upcomingBookings.length})
        </h2>
        <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left px-3 py-2">Data e hora</th>
                <th className="text-left px-3 py-2">Paciente</th>
                <th className="text-left px-3 py-2">Serviço</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingBookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-slate-500 text-center">
                    Nenhum agendamento futuro para este médico.
                  </td>
                </tr>
              ) : (
                upcomingBookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-slate-200 dark:border-zinc-800">
                    <td className="px-3 py-2">
                      {format(booking.date, "dd/MM/yyyy", { locale: ptBR })} •{" "}
                      {booking.startTime} - {booking.endTime}
                    </td>
                    <td className="px-3 py-2">
                      {booking.patient.name} • {booking.patient.phone}
                    </td>
                    <td className="px-3 py-2">{booking.service.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                          booking.status,
                        )}`}
                      >
                        {getStatusLabel(booking.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <h2 className="font-bold text-slate-900 dark:text-white mb-3">
          Histórico de atendimentos ({pastBookings.length})
        </h2>
        <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left px-3 py-2">Data e hora</th>
                <th className="text-left px-3 py-2">Paciente</th>
                <th className="text-left px-3 py-2">Serviço</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {pastBookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-slate-500 text-center">
                    Este médico ainda não possui histórico passado.
                  </td>
                </tr>
              ) : (
                pastBookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-slate-200 dark:border-zinc-800">
                    <td className="px-3 py-2">
                      {format(booking.date, "dd/MM/yyyy", { locale: ptBR })} •{" "}
                      {booking.startTime} - {booking.endTime}
                    </td>
                    <td className="px-3 py-2">
                      {booking.patient.name} • {booking.patient.phone}
                    </td>
                    <td className="px-3 py-2">{booking.service.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                          booking.status,
                        )}`}
                      >
                        {getStatusLabel(booking.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
