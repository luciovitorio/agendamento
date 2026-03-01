"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Clock3,
  Filter,
  MoreHorizontal,
  Search,
  Trash2,
  UserRoundCheck,
  UserX,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateAppointmentStatusAction } from "@/app/actions/appointment-actions";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import type {
  AppointmentData,
  AppointmentFilters,
  AppointmentPagination,
  AppointmentSource,
  AppointmentStatus,
} from "./types";
import { QuickRescheduleModal } from "./quick-reschedule-modal";
import { getAllowedNextAppointmentStatuses } from "@/lib/appointment-status";
import { DeleteAppointmentModal } from "./delete-appointment-modal";
import { formatPhoneDisplay } from "@/lib/phone-format";

interface AppointmentsTableProps {
  appointments: AppointmentData[];
  userRole: string;
  professionals: Array<{ id: string; name: string }>;
  filters: AppointmentFilters;
  pagination: AppointmentPagination;
}

function getStatusBadge(status: AppointmentStatus) {
  if (status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400";
  }
  if (status === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400";
  }
  if (status === "COMPLETED") {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-400";
  }
  if (status === "NO_SHOW") {
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-900/20 dark:text-violet-400";
  }
  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400";
}

function getStatusLabel(status: AppointmentStatus) {
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "PENDING") return "Pendente";
  if (status === "COMPLETED") return "Realizado";
  if (status === "NO_SHOW") return "Não Compareceu";
  return "Cancelado";
}

function getSourceLabel(source: AppointmentSource) {
  if (source === "MANUAL") return "Manual";
  if (source === "BOT_N8N") return "Bot n8n";
  return "Web";
}

function getSourceBadge(source: AppointmentSource) {
  if (source === "MANUAL") {
    return "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400";
  }
  if (source === "BOT_N8N") {
    return "bg-cyan-600/10 text-cyan-600 dark:text-cyan-400";
  }
  return "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300";
}

function parseBookingDateTime(appointment: AppointmentData) {
  const date = new Date(appointment.date);
  const [hours, minutes] = appointment.startTime.split(":").map(Number);
  const dateTime = new Date(date);
  dateTime.setHours(hours || 0, minutes || 0, 0, 0);
  return dateTime;
}

function getVisiblePaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "ELLIPSIS"> = [];
  for (let index = 0; index < sortedPages.length; index += 1) {
    const page = sortedPages[index];
    if (index === 0) {
      items.push(page);
      continue;
    }

    const previousPage = sortedPages[index - 1];
    const gap = page - previousPage;
    if (gap === 2) {
      items.push(previousPage + 1);
    } else if (gap > 2) {
      items.push("ELLIPSIS");
    }

    items.push(page);
  }

  return items;
}

export function AppointmentsTable({
  appointments,
  userRole,
  professionals,
  filters,
  pagination,
}: AppointmentsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [reschedulingAppointment, setReschedulingAppointment] =
    useState<AppointmentData | null>(null);
  const [deletingAppointment, setDeletingAppointment] =
    useState<AppointmentData | null>(null);
  const [searchInput, setSearchInput] = useState(filters.q);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  function pushQuery(next: {
    q?: string;
    status?: string;
    source?: string;
    professionalId?: string;
    period?: string;
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const qValue = next.q ?? filters.q;
    const statusValue = next.status ?? filters.status;
    const sourceValue = next.source ?? filters.source;
    const professionalValue = next.professionalId ?? filters.professionalId;
    const periodValue = next.period ?? filters.period;
    const pageSizeValue = next.pageSize ?? pagination.pageSize;
    const pageValue = next.page ?? pagination.page;

    if (qValue) params.set("q", qValue);
    else params.delete("q");

    if (statusValue !== "ALL") params.set("status", statusValue);
    else params.delete("status");

    if (sourceValue !== "ALL") params.set("source", sourceValue);
    else params.delete("source");

    if (professionalValue !== "ALL") params.set("professionalId", professionalValue);
    else params.delete("professionalId");

    if (periodValue !== "ALL") params.set("period", periodValue);
    else params.delete("period");

    if (pageSizeValue !== 10) params.set("pageSize", String(pageSizeValue));
    else params.delete("pageSize");

    if (pageValue > 1) params.set("page", String(pageValue));
    else params.delete("page");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    const normalized = searchInput.trim();
    if (normalized === filters.q) return;

    const timeoutId = window.setTimeout(() => {
      pushQuery({ q: normalized, page: 1 });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, filters.q]);

  const canDelete = userRole === "ADMIN" || userRole === "ATENDENTE";
  const visiblePaginationItems = useMemo(
    () => getVisiblePaginationItems(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );

  const handleStatusChange = (appointmentId: string, status: AppointmentStatus) => {
    startTransition(async () => {
      const result = await updateAppointmentStatusAction(appointmentId, status);
      if (result.success) {
        toast({
          title: "Status atualizado",
          description: "O status do agendamento foi atualizado.",
        });
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao atualizar",
        description: result.error,
        variant: "destructive",
      });
    });
  };

  const rangeStart =
    pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(
    pagination.page * pagination.pageSize,
    pagination.totalItems,
  );

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Filter className="size-4" />
          <span>Filtros</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar paciente, telefone, profissional..."
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm py-2.5 pl-9 pr-3 outline-none focus:border-indigo-500 dark:text-white"
            />
          </div>

          <Select
            value={filters.period}
            onValueChange={(value) => pushQuery({ period: value, page: 1 })}
          >
            <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
              <SelectItem value="ALL">Todos os períodos</SelectItem>
              <SelectItem value="TODAY">Hoje</SelectItem>
              <SelectItem value="UPCOMING">Próximos</SelectItem>
              <SelectItem value="PAST">Passados</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            onValueChange={(value) => pushQuery({ status: value, page: 1 })}
          >
            <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
              <SelectItem value="ALL">Todos os status</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="CONFIRMED">Confirmado</SelectItem>
              <SelectItem value="COMPLETED">Realizado</SelectItem>
              <SelectItem value="NO_SHOW">Não compareceu</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.source}
            onValueChange={(value) => pushQuery({ source: value, page: 1 })}
          >
            <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
              <SelectItem value="ALL">Todas as origens</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="BOT_N8N">Bot n8n</SelectItem>
              <SelectItem value="WEB">Web</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.professionalId}
            onValueChange={(value) => pushQuery({ professionalId: value, page: 1 })}
          >
            <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
              <SelectItem value="ALL">Todos profissionais</SelectItem>
              {professionals.map((professional) => (
                <SelectItem key={professional.id} value={professional.id}>
                  {professional.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Data e Hora
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Paciente
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Serviço
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Profissional
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Origem
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                  Nenhum agendamento encontrado com os filtros selecionados.
                </td>
              </tr>
            ) : (
              appointments.map((appointment) => {
                const allowedTransitions = getAllowedNextAppointmentStatuses(
                  appointment.status,
                );
                const bookingHasStarted =
                  parseBookingDateTime(appointment) <= new Date();

                return (
                  <tr
                    key={appointment.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-6 py-5 whitespace-nowrap">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {format(new Date(appointment.date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {appointment.startTime} - {appointment.endTime}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {appointment.patientName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatPhoneDisplay(appointment.patientPhone)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {appointment.patientEmail || "Sem e-mail"}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-700 dark:text-slate-300">
                      {appointment.serviceName}
                    </td>

                    <td className="px-6 py-5 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {appointment.professionalName}
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase ${getSourceBadge(
                          appointment.source,
                        )}`}
                      >
                        {getSourceLabel(appointment.source)}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase border ${getStatusBadge(
                          appointment.status,
                        )}`}
                      >
                        {getStatusLabel(appointment.status)}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            disabled={isPending}
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                          >
                            <MoreHorizontal className="size-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-52 rounded-2xl border-slate-200 dark:border-zinc-800 p-2 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md"
                        >
                          <DropdownMenuItem
                            onClick={() => setReschedulingAppointment(appointment)}
                            className="cursor-pointer flex items-center gap-2"
                          >
                            <CalendarClock className="size-4 text-indigo-500" />
                            Remarcar rapidamente
                          </DropdownMenuItem>

                          {allowedTransitions.includes("CONFIRMED") ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(appointment.id, "CONFIRMED")
                              }
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              Marcar como confirmado
                            </DropdownMenuItem>
                          ) : null}

                          {allowedTransitions.includes("PENDING") ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(appointment.id, "PENDING")
                              }
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <Clock3 className="size-4 text-amber-500" />
                              Marcar como pendente
                            </DropdownMenuItem>
                          ) : null}

                          {allowedTransitions.includes("COMPLETED") &&
                          bookingHasStarted ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(appointment.id, "COMPLETED")
                              }
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <UserRoundCheck className="size-4 text-sky-500" />
                              Marcar como realizado
                            </DropdownMenuItem>
                          ) : null}

                          {allowedTransitions.includes("NO_SHOW") &&
                          bookingHasStarted ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(appointment.id, "NO_SHOW")
                              }
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <UserX className="size-4 text-violet-500" />
                              Marcar não compareceu
                            </DropdownMenuItem>
                          ) : null}

                          {allowedTransitions.includes("CANCELLED") ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(appointment.id, "CANCELLED")
                              }
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <CircleOff className="size-4 text-rose-500" />
                              Cancelar agendamento
                            </DropdownMenuItem>
                          ) : null}

                          {canDelete ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingAppointment(appointment)}
                                className="cursor-pointer text-red-600 dark:text-red-400 flex items-center gap-2"
                              >
                                <Trash2 className="size-4" />
                                Excluir agendamento
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 justify-between">
        <p className="text-sm text-slate-500">
          Mostrando <span className="font-bold">{rangeStart}</span>–
          <span className="font-bold">{rangeEnd}</span> de{" "}
          <span className="font-bold">{pagination.totalItems}</span> agendamentos
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Exibir</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) =>
                pushQuery({ pageSize: Number(value), page: 1 })
              }
            >
              <SelectTrigger className="w-[72px] rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => pushQuery({ page: pagination.page - 1 })}
              className="size-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>

            {visiblePaginationItems.map((item, index) => {
              if (item === "ELLIPSIS") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="size-8 inline-flex items-center justify-center text-slate-400 text-xs"
                  >
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={item}
                  onClick={() => pushQuery({ page: item })}
                  className={`size-8 rounded-lg border text-xs font-bold transition-colors ${
                    item === pagination.page
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {item}
                </button>
              );
            })}

            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pushQuery({ page: pagination.page + 1 })}
              className="size-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {reschedulingAppointment ? (
        <QuickRescheduleModal
          open={!!reschedulingAppointment}
          onOpenChange={(open) => {
            if (!open) {
              setReschedulingAppointment(null);
            }
          }}
          appointment={reschedulingAppointment}
        />
      ) : null}

      {deletingAppointment ? (
        <DeleteAppointmentModal
          open={!!deletingAppointment}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingAppointment(null);
            }
          }}
          appointment={deletingAppointment}
        />
      ) : null}
    </div>
  );
}
