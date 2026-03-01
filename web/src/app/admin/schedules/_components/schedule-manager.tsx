"use client";

import { useState, useTransition, useCallback } from "react";
import { Save, Loader2, CalendarDays, User } from "lucide-react";
import { DayScheduleCard } from "./day-schedule-card";
import { saveAllSchedulesAction } from "@/app/actions/schedule-actions";
import { useToast } from "@/hooks/use-toast";

interface Schedule {
  id: string;
  professionalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Professional {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  schedules: Schedule[];
}

interface ScheduleManagerProps {
  professionals: Professional[];
  isDoctor?: boolean;
}

const DAYS = [
  { dayOfWeek: 1, name: "Segunda-feira", short: "SEG" },
  { dayOfWeek: 2, name: "Terça-feira", short: "TER" },
  { dayOfWeek: 3, name: "Quarta-feira", short: "QUA" },
  { dayOfWeek: 4, name: "Quinta-feira", short: "QUI" },
  { dayOfWeek: 5, name: "Sexta-feira", short: "SEX" },
  { dayOfWeek: 6, name: "Sábado", short: "SÁB" },
  { dayOfWeek: 0, name: "Domingo", short: "DOM" },
];

interface DayState {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function buildDayStates(schedules: Schedule[]): Record<number, DayState> {
  const states: Record<number, DayState> = {};

  for (const day of DAYS) {
    const existing = schedules.find((s) => s.dayOfWeek === day.dayOfWeek);
    states[day.dayOfWeek] = existing
      ? {
          enabled: true,
          startTime: existing.startTime,
          endTime: existing.endTime,
        }
      : { enabled: false, startTime: "08:00", endTime: "18:00" };
  }

  return states;
}

export function ScheduleManager({
  professionals,
  isDoctor,
}: ScheduleManagerProps) {
  const [selectedId, setSelectedId] = useState<string>(
    professionals[0]?.id || "",
  );
  const [dayStates, setDayStates] = useState<Record<number, DayState>>(() => {
    const first = professionals[0];
    return first ? buildDayStates(first.schedules) : {};
  });
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const selectedProfessional = professionals.find((p) => p.id === selectedId);

  const handleSelectProfessional = useCallback(
    (id: string) => {
      if (hasChanges) {
        const confirmed = window.confirm(
          "Existem alterações não salvas. Deseja descartar?",
        );
        if (!confirmed) return;
      }

      setSelectedId(id);
      const prof = professionals.find((p) => p.id === id);
      if (prof) {
        setDayStates(buildDayStates(prof.schedules));
      }
      setHasChanges(false);
    },
    [hasChanges, professionals],
  );

  const updateDayState = useCallback(
    (dayOfWeek: number, updates: Partial<DayState>) => {
      setDayStates((prev) => ({
        ...prev,
        [dayOfWeek]: { ...prev[dayOfWeek], ...updates },
      }));
      setHasChanges(true);
    },
    [],
  );

  const handleSave = () => {
    if (!selectedId) return;

    const schedules = DAYS.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      enabled: dayStates[day.dayOfWeek]?.enabled || false,
      startTime: dayStates[day.dayOfWeek]?.startTime || "08:00",
      endTime: dayStates[day.dayOfWeek]?.endTime || "18:00",
    }));

    startTransition(async () => {
      const result = await saveAllSchedulesAction(selectedId, schedules);

      if (result.success) {
        toast({
          title: "Horários salvos",
          description: `A grade semanal de ${selectedProfessional?.name} foi atualizada com sucesso.`,
        });
        setHasChanges(false);
      } else {
        toast({
          title: "Erro ao salvar",
          description: result.error || "Tente novamente.",
          variant: "destructive",
        });
      }
    });
  };

  const activeDaysCount = Object.values(dayStates).filter(
    (d) => d.enabled,
  ).length;

  if (professionals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CalendarDays className="size-16 text-slate-300 dark:text-zinc-600 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Nenhum profissional cadastrado
        </h2>
        <p className="text-slate-500 dark:text-zinc-400 max-w-md">
          Cadastre profissionais na tela de Usuários para configurar seus
          horários de atendimento.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar — Professional List (hidden for DOUTOR) */}
      {!isDoctor && (
        <div className="lg:w-72 shrink-0">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3 px-2">
              Profissionais
            </h2>
            <nav className="flex flex-col gap-1">
              {professionals.map((prof) => {
                const isSelected = prof.id === selectedId;
                const scheduleCount = prof.schedules.length;

                return (
                  <button
                    key={prof.id}
                    onClick={() => handleSelectProfessional(prof.id)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-800 border border-transparent"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                        isSelected
                          ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                      }`}
                    >
                      {prof.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate transition-colors ${
                          isSelected
                            ? "text-indigo-700 dark:text-indigo-300"
                            : "text-slate-700 dark:text-zinc-300"
                        }`}
                      >
                        {prof.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">
                        {scheduleCount > 0
                          ? `${scheduleCount} dia${scheduleCount > 1 ? "s" : ""} configurado${scheduleCount > 1 ? "s" : ""}`
                          : "Nenhum horário"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content — Weekly Grid */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <User className="size-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {selectedProfessional?.name || "Selecione um profissional"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                {activeDaysCount} dia{activeDaysCount !== 1 ? "s" : ""} de
                atendimento na semana
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isPending || !hasChanges}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              hasChanges
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isPending ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>

        {/* Weekly Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS.map((day) => (
            <DayScheduleCard
              key={day.dayOfWeek}
              dayName={day.name}
              dayShort={day.short}
              enabled={dayStates[day.dayOfWeek]?.enabled || false}
              startTime={dayStates[day.dayOfWeek]?.startTime || "08:00"}
              endTime={dayStates[day.dayOfWeek]?.endTime || "18:00"}
              onToggle={(enabled) => updateDayState(day.dayOfWeek, { enabled })}
              onStartTimeChange={(startTime) =>
                updateDayState(day.dayOfWeek, { startTime })
              }
              onEndTimeChange={(endTime) =>
                updateDayState(day.dayOfWeek, { endTime })
              }
            />
          ))}
        </div>

        {/* Summary Footer */}
        <div className="mt-6 px-5 py-4 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-zinc-400">
              Resumo da semana
            </span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600 dark:text-zinc-300">
                  {activeDaysCount} ativo{activeDaysCount !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-zinc-600" />
                <span className="text-slate-600 dark:text-zinc-300">
                  {7 - activeDaysCount} inativo
                  {7 - activeDaysCount !== 1 ? "s" : ""}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
