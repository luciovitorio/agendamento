import type { UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { Clock3, FileText, HandCoins, Stethoscope } from "lucide-react";

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nome do serviço deve ter pelo menos 2 caracteres"),
  description: z
    .string()
    .trim()
    .max(300, "Descrição deve ter no máximo 300 caracteres")
    .optional(),
  duration: z
    .string()
    .trim()
    .refine((value) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 5 && parsed <= 480;
    }, "Duração deve ser um número inteiro entre 5 e 480"),
  price: z
    .string()
    .trim()
    .optional()
    .refine((value) => {
      if (!value) return true;
      const normalized = value.replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Preço inválido"),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;

export function parseOptionalPrice(value?: string) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDuration(value: string) {
  return Number(value.trim());
}

interface ServiceFormFieldsProps {
  form: UseFormReturn<ServiceFormValues>;
}

export function ServiceFormFields({ form }: ServiceFormFieldsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
          Nome do Serviço
        </label>
        <div className="relative">
          <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
          <input
            {...form.register("name")}
            className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
            placeholder="ex: Consulta Dermatológica"
            type="text"
          />
        </div>
        {form.formState.errors.name ? (
          <span className="text-xs text-red-500 font-medium">
            {form.formState.errors.name.message}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
          Descrição
        </label>
        <div className="relative">
          <FileText className="absolute left-3 top-3 text-slate-400 size-5" />
          <textarea
            {...form.register("description")}
            rows={3}
            className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border resize-none"
            placeholder="Opcional. Ex: atendimento de 1a consulta."
          />
        </div>
        {form.formState.errors.description ? (
          <span className="text-xs text-red-500 font-medium">
            {form.formState.errors.description.message}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Duração (minutos)
          </label>
          <div className="relative">
            <Clock3 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
            <input
              {...form.register("duration")}
              className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
              placeholder="30"
              type="number"
              min={5}
              max={480}
              step={1}
            />
          </div>
          {form.formState.errors.duration ? (
            <span className="text-xs text-red-500 font-medium">
              {form.formState.errors.duration.message}
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Preço (R$)
          </label>
          <div className="relative">
            <HandCoins className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
            <input
              {...form.register("price")}
              className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
              placeholder="Opcional"
              type="text"
              inputMode="decimal"
            />
          </div>
          {form.formState.errors.price ? (
            <span className="text-xs text-red-500 font-medium">
              {form.formState.errors.price.message}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
