"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "@/hooks/use-toast";
import { resetPasswordAction } from "@/app/actions/auth-actions";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ResetPasswordValues) {
    if (!token) {
      toast({
        title: "Token inválido",
        description:
          "O link de redefinição de senha é inválido ou está ausente.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const res = await resetPasswordAction(token, data.password);

    setIsLoading(false);

    if (res.success) {
      toast({
        title: "Senha atualizada",
        description:
          "Sua nova senha foi salva com sucesso. Faça login com sua nova senha.",
      });

      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 2000);
    } else {
      toast({
        title: "Erro",
        description: res.error || "Ocorreu um erro ao redefinir a senha.",
        variant: "destructive",
      });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2 relative">
        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
          Nova Senha
        </label>
        <div className="relative">
          <input
            {...form.register("password")}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-4 pr-12 py-3.5 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all dark:text-white border"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>
        {form.formState.errors.password && (
          <p className="text-xs font-semibold text-red-500 mt-1">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2 relative">
        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
          Confirmar Senha
        </label>
        <div className="relative">
          <input
            {...form.register("confirmPassword")}
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-4 pr-12 py-3.5 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all dark:text-white border"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>
        {form.formState.errors.confirmPassword && (
          <p className="text-xs font-semibold text-red-500 mt-1">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center mt-2"
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          "Salvar Senha"
        )}
      </button>
    </form>
  );
}
