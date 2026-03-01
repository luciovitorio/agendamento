"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { rescheduleAppointmentAction } from "@/app/actions/appointment-actions";
import { toast } from "@/hooks/use-toast";
import type { AppointmentData } from "./types";

interface QuickRescheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentData;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function QuickRescheduleModal({
  open,
  onOpenChange,
  appointment,
}: QuickRescheduleModalProps) {
  const initialDate = useMemo(
    () => startOfDay(new Date(appointment.date)),
    [appointment.date],
  );
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [selectedTime, setSelectedTime] = useState<string>(appointment.startTime);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setSelectedDate(initialDate);
    setSelectedTime(appointment.startTime);
  }, [open, initialDate, appointment.startTime]);

  const dateStr = useMemo(() => toInputDate(selectedDate), [selectedDate]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSlots() {
      if (!open) return;
      setIsLoadingSlots(true);
      setSlotsError(null);
      try {
        const response = await fetch(
          `/api/availability?professionalId=${appointment.professionalId}&serviceId=${appointment.serviceId}&date=${dateStr}`,
        );
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setSlots([]);
          setSlotsError(data?.error || "Falha ao carregar horários.");
          return;
        }

        const fetchedSlots = Array.isArray(data?.slots) ? data.slots : [];
        const currentTimeOnCurrentDay =
          toInputDate(new Date(appointment.date)) === dateStr
            ? [appointment.startTime]
            : [];
        const merged = Array.from(new Set([...currentTimeOnCurrentDay, ...fetchedSlots])).sort();
        setSlots(merged);

        setSelectedTime((current) => (merged.includes(current) ? current : (merged[0] || "")));
      } catch {
        if (cancelled) return;
        setSlots([]);
        setSlotsError("Falha ao carregar horários.");
      } finally {
        if (!cancelled) {
          setIsLoadingSlots(false);
        }
      }
    }

    fetchSlots();

    return () => {
      cancelled = true;
    };
  }, [
    appointment.date,
    appointment.professionalId,
    appointment.serviceId,
    appointment.startTime,
    dateStr,
    open,
  ]);

  const handleConfirm = () => {
    if (!selectedTime) {
      toast({
        title: "Selecione um horário",
        description: "Escolha um novo horário para concluir a remarcação.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const result = await rescheduleAppointmentAction(appointment.id, {
        dateStr,
        startTime: selectedTime,
      });

      if (result.success) {
        toast({
          title: result.unchanged ? "Sem alterações" : "Agendamento remarcado",
          description: result.unchanged
            ? "O horário selecionado já era o atual."
            : "A remarcação foi concluída com sucesso.",
        });
        onOpenChange(false);
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao remarcar",
        description: result.error,
        variant: "destructive",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
        <DialogHeader className="px-8 py-6 border-b border-slate-100 dark:border-zinc-800">
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            Remarcação Rápida
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {appointment.patientName} • {appointment.serviceName} •{" "}
            {appointment.professionalName}
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="size-4 text-indigo-500" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Selecione a nova data
              </p>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(value) => {
                if (!value) return;
                setSelectedDate(startOfDay(value));
              }}
              locale={ptBR}
              className="mx-auto"
              disabled={(date) => date < startOfDay(new Date())}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="size-4 text-indigo-500" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Horários disponíveis
              </p>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              {format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {isLoadingSlots ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : slotsError ? (
                <p className="text-sm text-red-500">{slotsError}</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-slate-500">Sem horários para esta data.</p>
              ) : (
                slots.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="px-8 py-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isPending ? "Remarcando..." : "Confirmar Remarcação"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
