"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { deleteAppointmentTimeOffAction } from "@/app/actions/appointment-actions";
import type { AppointmentTimeOffData } from "./types";

interface DeleteTimeOffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeOff: AppointmentTimeOffData;
}

export function DeleteTimeOffModal({
  open,
  onOpenChange,
  timeOff,
}: DeleteTimeOffModalProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAppointmentTimeOffAction(timeOff.id);

      if (result.success) {
        toast({
          title: "Bloqueio removido",
          description: "O período voltou a ficar disponível.",
        });
        onOpenChange(false);
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao remover bloqueio",
        description: result.error,
        variant: "destructive",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
        <DialogHeader className="px-8 pt-8 pb-0 space-y-0">
          <div className="mx-auto size-14 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="size-7 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white text-center">
            Remover Bloqueio
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-2 text-center">
            Confirma a remoção do bloqueio de{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {timeOff.professionalName}
            </span>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-6 flex flex-col gap-3">
          <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">
              Período:{" "}
              <strong>
                {format(new Date(timeOff.startDateTime), "dd/MM/yyyy HH:mm", {
                  locale: ptBR,
                })}{" "}
                -{" "}
                {format(new Date(timeOff.endDateTime), "HH:mm", {
                  locale: ptBR,
                })}
              </strong>
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-md shadow-red-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover Bloqueio"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
