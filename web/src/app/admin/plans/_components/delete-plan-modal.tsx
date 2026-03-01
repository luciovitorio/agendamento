"use client";

import { useTransition } from "react";
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
import { deleteHealthPlanAction } from "@/app/actions/health-plan-actions";
import type { HealthPlanData } from "./types";

interface DeletePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: HealthPlanData;
}

export function DeletePlanModal({
  open,
  onOpenChange,
  plan,
}: DeletePlanModalProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deleteHealthPlanAction(plan.id);

      if (response.success) {
        toast({
          title: "Plano excluído",
          description: `${plan.name} foi removido da lista de planos aceitos.`,
        });
        onOpenChange(false);
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao excluir",
        description: response.error,
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
            Excluir Plano
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-2 text-center">
            Tem certeza que deseja excluir{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {plan.name}
            </span>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-6 flex flex-col gap-3">
          <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">
              Pacientes vinculados permanecerão cadastrados e passarão para
              cobertura sem plano automaticamente.
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
                  Excluindo...
                </>
              ) : (
                "Excluir Plano"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
