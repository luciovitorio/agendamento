import { Controller, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { UserRound, Mail, Phone, ShieldCheck, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HealthPlanOption } from "./types";

const optionalEmailSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => {
      if (!value) {
        return true;
      }
      return z.string().email().safeParse(value).success;
    },
    { message: "Endereço de e-mail inválido" },
  );

const phoneSchema = z.string().trim().refine(
  (value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 10 || digits.length === 11;
  },
  { message: "Telefone deve ter 10 ou 11 dígitos" },
);

export const patientSchema = z
  .object({
    name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: optionalEmailSchema,
    phone: phoneSchema,
    coverageType: z.enum(["PARTICULAR", "PLAN"], {
      message: "Selecione o tipo de cobertura",
    }),
    healthPlanId: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.coverageType === "PLAN" && !value.healthPlanId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["healthPlanId"],
        message: "Selecione um plano para pacientes conveniados.",
      });
    }
  });

export type PatientFormValues = z.infer<typeof patientSchema>;

function formatPhoneMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  const areaCode = digits.slice(0, 2);
  const localNumber = digits.slice(2);

  if (localNumber.length <= 4) {
    return `(${areaCode}) ${localNumber}`;
  }

  const splitIndex = localNumber.length <= 8 ? 4 : 5;
  return `(${areaCode}) ${localNumber.slice(0, splitIndex)}-${localNumber.slice(splitIndex)}`;
}

interface PatientFormFieldsProps {
  form: UseFormReturn<PatientFormValues>;
  healthPlans: HealthPlanOption[];
}

export function PatientFormFields({ form, healthPlans }: PatientFormFieldsProps) {
  const coverageType = form.watch("coverageType");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
          Nome Completo
        </label>
        <div className="relative">
          <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
          <input
            {...form.register("name")}
            className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
            placeholder="ex: Maria Souza"
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
          Telefone
        </label>
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => (
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
              <input
                value={field.value ?? ""}
                onChange={(event) =>
                  field.onChange(formatPhoneMask(event.target.value))
                }
                className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
                placeholder="(11) 99999-9999"
                type="text"
                inputMode="numeric"
                maxLength={15}
              />
            </div>
          )}
        />
        {form.formState.errors.phone ? (
          <span className="text-xs text-red-500 font-medium">
            {form.formState.errors.phone.message}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
          E-mail
          <span className="text-slate-400 font-normal ml-1">(opcional)</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
          <input
            {...form.register("email")}
            className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
            placeholder="email@dominio.com"
            type="email"
          />
        </div>
        {form.formState.errors.email ? (
          <span className="text-xs text-red-500 font-medium">
            {form.formState.errors.email.message}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
          Tipo de Cobertura
        </label>
        <Controller
          control={form.control}
          name="coverageType"
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-6 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all cursor-pointer dark:text-white border shadow-none">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-slate-400" />
                  <SelectValue placeholder="Selecione o tipo de cobertura" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                <SelectItem value="PARTICULAR" className="rounded-lg cursor-pointer">
                  Particular
                </SelectItem>
                <SelectItem value="PLAN" className="rounded-lg cursor-pointer">
                  Plano de Saúde
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {form.formState.errors.coverageType ? (
          <span className="text-xs text-red-500 font-medium">
            {form.formState.errors.coverageType.message}
          </span>
        ) : null}
      </div>

      {coverageType === "PLAN" ? (
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Plano de Saúde
          </label>
          <Controller
            control={form.control}
            name="healthPlanId"
            render={({ field }) => (
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={healthPlans.length === 0}
              >
                <SelectTrigger className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-6 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all cursor-pointer dark:text-white border shadow-none disabled:opacity-60">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-slate-400" />
                    <SelectValue
                      placeholder={
                        healthPlans.length === 0
                          ? "Cadastre planos no módulo de planos"
                          : "Selecione o plano"
                      }
                    />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                  {healthPlans.map((plan) => (
                    <SelectItem
                      key={plan.id}
                      value={plan.id}
                      className="rounded-lg cursor-pointer"
                    >
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.healthPlanId ? (
            <span className="text-xs text-red-500 font-medium">
              {form.formState.errors.healthPlanId.message}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
