"use client";

import { useActionState, startTransition, useEffect } from "react";
import Link from "next/link";
import { authenticate } from "@/app/actions/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido, por favor revise."),
  password: z.string().min(1, "A senha é obrigatória."),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { toast } = useToast();
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  useEffect(() => {
    if (errorMessage && !isPending) {
      toast({
        variant: "destructive",
        title: "Falha ao entrar",
        description: errorMessage,
      });
    }
  }, [errorMessage, isPending, toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@clinica.com",
      password: "admin",
    },
  });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Prevent default submission to validate first with RHF
        e.preventDefault();
        const formElement = e.currentTarget;

        handleSubmit(() => {
          // If RHF validation succeeds, trigger the Server Action
          // We pass the FormData directly to the useActionState's bound action
          const formData = new FormData(formElement);
          startTransition(() => {
            formAction(formData);
          });
        })(e);
      }}
      className="space-y-6"
    >
      {/* Email Field */}
      <div>
        <label
          className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2"
          htmlFor="email"
        >
          Endereço de E-mail
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400">
            <Mail className="h-5 w-5" />
          </span>
          <input
            id="email"
            type="email"
            placeholder="admin@clinica.com"
            className="block w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
            {...register("email")}
            disabled={isPending}
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-sm text-red-500 font-medium">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
            htmlFor="password"
          >
            Senha
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Esqueci minha senha
          </Link>
        </div>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400">
            <Lock className="h-5 w-5" />
          </span>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            className="block w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
            {...register("password")}
            disabled={isPending}
          />
        </div>
        {errors.password && (
          <p className="mt-1 text-sm text-red-500 font-medium">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Remember Me */}
      <div className="flex items-center">
        <input
          id="remember-me"
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600"
        />
        <label
          htmlFor="remember-me"
          className="ml-2 block text-sm text-zinc-600 dark:text-zinc-400"
        >
          Manter conectado
        </label>
      </div>

      {/* Login Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full flex justify-center py-3.5 px-4 rounded-lg bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
      >
        {isPending ? "Autenticando..." : "Entrar no Sistema"}
      </button>

      <div className="mt-8 pt-6 border-t border-zinc-200/50 dark:border-zinc-700/50 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Problemas de acesso?{" "}
          <span className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">
            Contate o Suporte
          </span>
        </p>
      </div>
    </form>
  );
}
