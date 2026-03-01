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
import { createPatientAction } from "@/app/actions/patient-actions";
import {
  PatientFormFields,
  patientSchema,
  type PatientFormValues,
} from "./patient-form-fields";
import type { HealthPlanOption } from "./types";

interface CreatePatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  healthPlans: HealthPlanOption[];
  onCreated?: (patient: {
    name: string;
    phone: string;
    email: string | null;
  }) => void;
}

export function CreatePatientModal({
  open,
  onOpenChange,
  healthPlans,
  onCreated,
}: CreatePatientModalProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      coverageType: "PARTICULAR",
      healthPlanId: undefined,
    },
  });

  const onSubmit = (values: PatientFormValues) => {
    startTransition(async () => {
      const response = await createPatientAction({
        name: values.name,
        phone: values.phone,
        email: values.email,
        coverageType: values.coverageType,
        healthPlanId: values.coverageType === "PLAN" ? values.healthPlanId : undefined,
      });

      if (response.success) {
        onCreated?.({
          name: values.name,
          phone: values.phone,
          email: values.email?.trim() ? values.email.trim() : null,
        });
        toast({
          title: "Paciente cadastrado",
          description: "Paciente adicionado com sucesso.",
        });
        form.reset({
          name: "",
          phone: "",
          email: "",
          coverageType: "PARTICULAR",
          healthPlanId: undefined,
        });
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
              Adicionar Paciente
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Cadastre um novo paciente na base da clínica.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-8">
            <PatientFormFields form={form} healthPlans={healthPlans} />

            <div className="bg-indigo-600/5 p-4 rounded-xl border border-indigo-600/10 flex items-start gap-3 mt-6">
              <Info className="text-indigo-600 size-5 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed font-medium">
                Pacientes com cobertura por plano exigem um plano previamente
                cadastrado no módulo de planos aceitos pela clínica.
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
              {isPending ? "Salvando..." : "Cadastrar Paciente"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
