"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIME_OPTIONS = generateTimeOptions();

function generateTimeOptions() {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, "0");
      const min = m.toString().padStart(2, "0");
      options.push(`${hour}:${min}`);
    }
  }
  return options;
}

interface DayScheduleCardProps {
  dayName: string;
  dayShort: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  onToggle: (enabled: boolean) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
}

export function DayScheduleCard({
  dayName,
  dayShort,
  enabled,
  startTime,
  endTime,
  onToggle,
  onStartTimeChange,
  onEndTimeChange,
}: DayScheduleCardProps) {
  return (
    <div
      className={`relative rounded-xl border p-4 sm:p-5 transition-all duration-300 ${
        enabled
          ? "border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md"
          : "border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold transition-colors shrink-0 ${
              enabled
                ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500"
            }`}
          >
            {dayShort}
          </div>
          <div className="min-w-0">
            <h3
              className={`text-sm font-semibold transition-colors truncate ${
                enabled
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-400 dark:text-zinc-500"
              }`}
            >
              {dayName}
            </h3>
            <p
              className={`text-xs transition-colors ${
                enabled
                  ? "text-slate-500 dark:text-zinc-400"
                  : "text-slate-300 dark:text-zinc-600"
              }`}
            >
              {enabled ? "Disponível" : "Sem atendimento"}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
            enabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Time Selects */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          enabled ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 pt-1">
          <div className="min-w-0">
            <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5 block">
              Início
            </label>
            <Select value={startTime} onValueChange={onStartTimeChange}>
              <SelectTrigger className="w-full min-w-[5.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-60">
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center pb-2">
            <span className="text-slate-300 dark:text-zinc-600 text-sm">–</span>
          </div>

          <div className="min-w-0">
            <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5 block">
              Fim
            </label>
            <Select value={endTime} onValueChange={onEndTimeChange}>
              <SelectTrigger className="w-full min-w-[5.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-60">
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Disabled overlay text */}
      {!enabled && (
        <div className="flex items-center justify-center py-4">
          <span className="text-xs text-slate-300 dark:text-zinc-600 italic">
            Clique no toggle para ativar
          </span>
        </div>
      )}
    </div>
  );
}
