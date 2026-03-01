"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { updatePatientAction } from "@/app/actions/patient-actions";
import {
  PatientFormFields,
  patientSchema,
  type PatientFormValues,
} from "./patient-form-fields";
import type { HealthPlanOption, PatientData } from "./types";

interface EditPatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientData;
  healthPlans: HealthPlanOption[];
}

export function EditPatientModal({
  open,
  onOpenChange,
  patient,
  healthPlans,
}: EditPatientModalProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: patient.name,
      phone: patient.phone,
      email: patient.email || "",
      coverageType: patient.coverageType,
      healthPlanId: patient.healthPlanId || undefined,
    },
  });

  const onSubmit = (values: PatientFormValues) => {
    startTransition(async () => {
      const response = await updatePatientAction(patient.id, {
        name: values.name,
        phone: values.phone,
        email: values.email,
        coverageType: values.coverageType,
        healthPlanId: values.coverageType === "PLAN" ? values.healthPlanId : undefined,
      });

      if (response.success) {
        toast({
          title: "Paciente atualizado",
          description: "As informações foram salvas com sucesso.",
        });
        onOpenChange(false);
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao atualizar",
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
              Editar Paciente
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Atualize os dados cadastrais do paciente.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-8">
            <PatientFormFields form={form} healthPlans={healthPlans} />
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
              className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
