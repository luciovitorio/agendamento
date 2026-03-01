"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface OptionItem {
  id: string;
  name: string;
}

interface ReportsFiltersProps {
  userRole: string;
  startDateValue: string;
  endDateValue: string;
  dayValue: string;
  professionals: OptionItem[];
  patients: OptionItem[];
  selectedProfessionalId: string | null;
  selectedPatientId: string | null;
  clearHref?: string;
}

function parseInputDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DateField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <label className="text-xs text-slate-500">
      {label}
      <input type="hidden" name={name} value={toInputDate(value)} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mt-1 h-10 w-full inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-slate-700 dark:text-zinc-200 hover:border-indigo-300 transition-colors"
          >
            <span>{format(value, "dd/MM/yyyy", { locale: ptBR })}</span>
            <CalendarIcon className="size-4 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto p-0 rounded-xl border-slate-200 dark:border-zinc-700"
        >
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              if (!date) return;
              onChange(date);
              setOpen(false);
            }}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </label>
  );
}

function SearchableSelectField({
  label,
  name,
  value,
  options,
  onValueChange,
  allLabel = "Todos",
}: {
  label: string;
  name: string;
  value: string;
  options: OptionItem[];
  onValueChange: (value: string) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = value === "ALL"
    ? null
    : options.find((option) => option.id === value) || null;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions =
    normalizedQuery.length === 0
      ? options
      : options.filter((option) =>
          option.name.toLowerCase().includes(normalizedQuery),
        );

  return (
    <label className="text-xs text-slate-500">
      {label}
      <input type="hidden" name={name} value={value} />
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mt-1 h-10 w-full inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-slate-700 dark:text-zinc-200 hover:border-indigo-300 transition-colors"
          >
            <span className="truncate">
              {selectedOption ? selectedOption.name : allLabel}
            </span>
            <ChevronsUpDown className="size-4 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[280px] p-2 rounded-xl border-slate-200 dark:border-zinc-700"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${label.toLowerCase()}...`}
            className="h-9 w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm outline-none focus:border-indigo-500"
          />
          <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
            <button
              type="button"
              onClick={() => {
                onValueChange("ALL");
                setOpen(false);
              }}
              className="w-full h-9 px-2 rounded-lg text-sm flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <span className="truncate">{allLabel}</span>
              {value === "ALL" ? <Check className="size-4 text-indigo-600" /> : null}
            </button>

            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onValueChange(option.id);
                  setOpen(false);
                }}
                className="w-full h-9 px-2 rounded-lg text-sm flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <span className="truncate">{option.name}</span>
                {value === option.id ? (
                  <Check className="size-4 text-indigo-600" />
                ) : null}
              </button>
            ))}

            {filteredOptions.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-500">Nenhum resultado encontrado.</p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </label>
  );
}

export function ReportsFilters({
  userRole,
  startDateValue,
  endDateValue,
  dayValue,
  professionals,
  patients,
  selectedProfessionalId,
  selectedPatientId,
  clearHref = "/admin/reports",
}: ReportsFiltersProps) {
  const [startDate, setStartDate] = useState(() => parseInputDate(startDateValue));
  const [endDate, setEndDate] = useState(() => parseInputDate(endDateValue));
  const [dayDate, setDayDate] = useState(() => parseInputDate(dayValue));
  const [professionalId, setProfessionalId] = useState(
    selectedProfessionalId || "ALL",
  );
  const [patientId, setPatientId] = useState(selectedPatientId || "ALL");

  return (
    <form method="GET" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
      <DateField
        label="Data inicial"
        name="startDate"
        value={startDate}
        onChange={setStartDate}
      />
      <DateField
        label="Data final"
        name="endDate"
        value={endDate}
        onChange={setEndDate}
      />
      <DateField
        label="Dia do relatório diário"
        name="day"
        value={dayDate}
        onChange={setDayDate}
      />

      {userRole !== "DOUTOR" ? (
        <SearchableSelectField
          label="Médico"
          name="professionalId"
          value={professionalId}
          options={professionals}
          onValueChange={setProfessionalId}
          allLabel="Todos"
        />
      ) : (
        <input type="hidden" name="professionalId" value={professionalId} />
      )}

      <SearchableSelectField
        label="Paciente"
        name="patientId"
        value={patientId}
        options={patients}
        onValueChange={setPatientId}
        allLabel="Todos"
      />

      <div className="flex gap-2">
        <button className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">
          Aplicar
        </button>
        <a
          href={clearHref}
          className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 inline-flex items-center text-sm"
        >
          Limpar
        </a>
      </div>
    </form>
  );
}
