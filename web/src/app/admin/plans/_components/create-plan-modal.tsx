"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { createHealthPlanAction } from "@/app/actions/health-plan-actions";
import { PlanFormFields, planSchema, type PlanFormValues } from "./plan-form-fields";

interface CreatePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePlanModal({ open, onOpenChange }: CreatePlanModalProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (values: PlanFormValues) => {
    startTransition(async () => {
      const response = await createHealthPlanAction(values.name);

      if (response.success) {
        toast({
          title: "Plano cadastrado",
          description: "Plano de saúde adicionado com sucesso.",
        });
        form.reset({ name: "" });
        onOpenChange(false);
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao cadastrar",
        description: response.error,
        variant: "destructive",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
        <DialogHeader className="px-8 py-6 border-b border-slate-100 dark:border-zinc-800 flex flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Adicionar Plano
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Cadastre um plano aceito pela clínica.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-8">
            <PlanFormFields form={form} />

            <div className="bg-indigo-600/5 p-4 rounded-xl border border-indigo-600/10 flex items-start gap-3 mt-6">
              <Info className="text-indigo-600 size-5 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed font-medium">
                Estes planos ficarão disponíveis para seleção no cadastro e
                edição de pacientes.
              </p>
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
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPending ? "Salvando..." : "Cadastrar Plano"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
