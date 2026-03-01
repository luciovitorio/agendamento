"use client";

import { useMemo, useState, useTransition } from "react";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Ban,
  CalendarIcon,
  CalendarRange,
  Filter,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { createAppointmentTimeOffAction } from "@/app/actions/appointment-actions";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AppointmentTimeOffData, ProfessionalOption } from "./types";
import { DeleteTimeOffModal } from "./delete-timeoff-modal";

interface AppointmentTimeOffPanelProps {
  timeOffs: AppointmentTimeOffData[];
  professionals: ProfessionalOption[];
  userRole: string;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createTimeOptions() {
  const options: string[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }
  return options;
}

const TIME_OPTIONS = createTimeOptions();

export function AppointmentTimeOffPanel({
  timeOffs,
  professionals,
  userRole,
}: AppointmentTimeOffPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(
    professionals[0]?.id || "",
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfDay(new Date()),
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [reason, setReason] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState<string>("ALL");
  const [deletingTimeOff, setDeletingTimeOff] =
    useState<AppointmentTimeOffData | null>(null);
  const router = useRouter();

  const filteredTimeOffs = useMemo(() => {
    if (professionalFilter === "ALL") {
      return timeOffs;
    }
    return timeOffs.filter(
      (timeOff) => timeOff.professionalId === professionalFilter,
    );
  }, [professionalFilter, timeOffs]);

  const canChooseProfessional = userRole !== "DOUTOR";

  const handleCreateTimeOff = () => {
    const dateStr = toInputDate(selectedDate);

    if (!selectedProfessionalId || !dateStr || !startTime || !endTime) {
      toast({
        title: "Preencha os campos",
        description: "Informe profissional, data e faixa de horário.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const result = await createAppointmentTimeOffAction({
        professionalId: selectedProfessionalId,
        dateStr,
        startTime,
        endTime,
        reason: reason || undefined,
      });

      if (result.success) {
        toast({
          title: "Bloqueio criado",
          description: "A indisponibilidade foi registrada na agenda.",
        });
        setReason("");
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao bloquear agenda",
        description: result.error,
        variant: "destructive",
      });
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Bloqueios de Agenda
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Defina períodos de ausência e indisponibilidade por profissional.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
            <ShieldAlert className="size-4" />
            Regras aplicadas em todo o sistema
          </span>
        </div>
      </div>

      <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/30">
        <div className="grid grid-cols-4 xl:grid-cols-[1fr_190px_140px_140px_1.2fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Profissional
            </label>
            <Select
              value={selectedProfessionalId}
              onValueChange={setSelectedProfessionalId}
              disabled={!canChooseProfessional}
            >
              <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Data
            </label>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-300 transition-colors"
                >
                  <span>
                    {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <CalendarIcon className="size-4 text-slate-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto p-0 rounded-xl border-slate-200 dark:border-zinc-700"
              >
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (!date) return;
                    setSelectedDate(startOfDay(date));
                    setIsDatePickerOpen(false);
                  }}
                  locale={ptBR}
                  disabled={(date) => date < startOfDay(new Date())}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Hora Inicial
            </label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700 max-h-72">
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Hora Final
            </label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700 max-h-72">
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Motivo
            </label>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Motivo (opcional)"
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3 py-2.5 outline-none focus:border-indigo-500 dark:text-white"
            />
          </div>

          <button
            onClick={handleCreateTimeOff}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Plus className="size-4" />
            Bloquear
          </button>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Filter className="size-4" />
          <span>Filtrar por profissional</span>
        </div>

        <Select
          value={professionalFilter}
          onValueChange={setProfessionalFilter}
        >
          <SelectTrigger className="w-[240px] rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
            <SelectItem value="ALL">Todos</SelectItem>
            {professionals.map((professional) => (
              <SelectItem key={professional.id} value={professional.id}>
                {professional.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Profissional
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Período
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Motivo
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Criado por
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredTimeOffs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  Nenhum bloqueio registrado para os filtros atuais.
                </td>
              </tr>
            ) : (
              filteredTimeOffs.map((timeOff) => (
                <tr
                  key={timeOff.id}
                  className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-6 py-5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {timeOff.professionalName}
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-slate-700 dark:text-slate-300 inline-flex items-center gap-2">
                      <CalendarRange className="size-4 text-slate-400" />
                      {format(
                        new Date(timeOff.startDateTime),
                        "dd/MM/yyyy HH:mm",
                        {
                          locale: ptBR,
                        },
                      )}{" "}
                      -{" "}
                      {format(new Date(timeOff.endDateTime), "HH:mm", {
                        locale: ptBR,
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                    {timeOff.reason || "-"}
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                    {timeOff.createdByUserName || "Sistema"}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button
                      onClick={() => setDeletingTimeOff(timeOff)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      <Trash2 className="size-3.5" />
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800">
        <p className="text-sm text-slate-500 inline-flex items-center gap-2">
          <Ban className="size-4" />
          Total de bloqueios exibidos:{" "}
          <span className="font-bold">{filteredTimeOffs.length}</span>
        </p>
      </div>

      {deletingTimeOff ? (
        <DeleteTimeOffModal
          open={!!deletingTimeOff}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingTimeOff(null);
            }
          }}
          timeOff={deletingTimeOff}
        />
      ) : null}
    </div>
  );
}
