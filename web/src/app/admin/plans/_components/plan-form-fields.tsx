import type { UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { Building2 } from "lucide-react";

export const planSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome do plano deve ter pelo menos 2 caracteres"),
});

export type PlanFormValues = z.infer<typeof planSchema>;

interface PlanFormFieldsProps {
  form: UseFormReturn<PlanFormValues>;
}

export function PlanFormFields({ form }: PlanFormFieldsProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
        Nome do Plano
      </label>
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
        <input
          {...form.register("name")}
          className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
          placeholder="ex: Unimed"
          type="text"
        />
      </div>
      {form.formState.errors.name ? (
        <span className="text-xs text-red-500 font-medium">
          {form.formState.errors.name.message}
        </span>
      ) : null}
    </div>
  );
}
