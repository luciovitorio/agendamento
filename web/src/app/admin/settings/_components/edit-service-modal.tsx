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
import { updateServiceAction } from "@/app/actions/service-actions";
import {
  parseDuration,
  parseOptionalPrice,
  serviceSchema,
  ServiceFormFields,
  type ServiceFormValues,
} from "./service-form-fields";
import type { ServiceData } from "./types";

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceData;
}

export function EditServiceModal({
  open,
  onOpenChange,
  service,
}: EditServiceModalProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service.name,
      description: service.description || "",
      duration: String(service.duration),
      price: service.price !== null ? service.price.toFixed(2) : "",
    },
  });

  const onSubmit = (values: ServiceFormValues) => {
    startTransition(async () => {
      const response = await updateServiceAction(service.id, {
        name: values.name,
        description: values.description,
        duration: parseDuration(values.duration),
        price: parseOptionalPrice(values.price),
      });

      if (response.success) {
        toast({
          title: "Serviço atualizado",
          description: "As alterações foram salvas com sucesso.",
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
        <DialogHeader className="px-8 py-6 border-b border-slate-100 dark:border-zinc-800">
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            Editar Serviço
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            Ajuste nome, duração, descrição e preço do serviço.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-8">
            <ServiceFormFields form={form} />
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
