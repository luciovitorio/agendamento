"use client";

import { useEffect, useMemo, useState } from "react";
import * as z from "zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { sendPasswordRecoveryEmail } from "@/app/actions/auth-actions";

const forgotPasswordSchema = z.object({
  email: z.string().email("Por favor, insira um e-mail válido"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const DEFAULT_RECOVERY_COOLDOWN_MINUTES = 5;
const parsedCooldownMinutes = Number(
  process.env.NEXT_PUBLIC_PASSWORD_RECOVERY_COOLDOWN_MINUTES,
);
const RECOVERY_COOLDOWN_SECONDS =
  Number.isFinite(parsedCooldownMinutes) && parsedCooldownMinutes > 0
    ? parsedCooldownMinutes * 60
    : DEFAULT_RECOVERY_COOLDOWN_MINUTES * 60;
const RECOVERY_COOLDOWN_KEY_PREFIX = "forgot_password_cooldown_until:";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getCooldownStorageKey(email: string) {
  return `${RECOVERY_COOLDOWN_KEY_PREFIX}${email}`;
}

function readCooldownSeconds(email: string) {
  if (!email || typeof window === "undefined") {
    return 0;
  }

  const key = getCooldownStorageKey(email);
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return 0;
  }

  const cooldownUntil = Number(rawValue);
  if (!Number.isFinite(cooldownUntil)) {
    window.localStorage.removeItem(key);
    return 0;
  }

  const remainingMs = cooldownUntil - Date.now();
  if (remainingMs <= 0) {
    window.localStorage.removeItem(key);
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

function setCooldown(email: string) {
  if (!email || typeof window === "undefined") {
    return 0;
  }

  const cooldownUntil = Date.now() + RECOVERY_COOLDOWN_SECONDS * 1000;
  window.localStorage.setItem(
    getCooldownStorageKey(email),
    String(cooldownUntil),
  );
  return RECOVERY_COOLDOWN_SECONDS;
}

function formatCooldown(seconds: number) {
  const minutesPart = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secondsPart = (seconds % 60).toString().padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const emailInputValue = form.watch("email");
  const normalizedEmail = useMemo(
    () => normalizeEmail(emailInputValue ?? ""),
    [emailInputValue],
  );

  useEffect(() => {
    if (!normalizedEmail) {
      setCooldownSeconds(0);
      return;
    }
    setCooldownSeconds(readCooldownSeconds(normalizedEmail));
  }, [normalizedEmail]);

  useEffect(() => {
    if (!normalizedEmail || cooldownSeconds <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCooldownSeconds(readCooldownSeconds(normalizedEmail));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldownSeconds, normalizedEmail]);

  async function onSubmit(data: ForgotPasswordValues) {
    const normalizedTargetEmail = normalizeEmail(data.email);
    const remainingCooldown = readCooldownSeconds(normalizedTargetEmail);

    if (remainingCooldown > 0) {
      setCooldownSeconds(remainingCooldown);
      toast({
        title: "Aguarde para reenviar",
        description: `Você pode solicitar um novo link em ${formatCooldown(remainingCooldown)}.`,
      });
      return;
    }

    setIsLoading(true);

    const res = await sendPasswordRecoveryEmail(data.email);

    setIsLoading(false);

    if (res.success) {
      const newCooldown = setCooldown(normalizedTargetEmail);
      setCooldownSeconds(newCooldown);
      setIsSuccess(true);
      toast({
        title: "Solicitação recebida",
        description:
          "Se o e-mail estiver cadastrado e ativo, você receberá as instruções de recuperação.",
      });
    } else {
      toast({
        title: "Erro ao enviar e-mail",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  }

  if (isSuccess) {
    return (
      <div className="space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h3 className="text-center text-2xl font-bold text-slate-900">
          Solicitação recebida
        </h3>
        <p className="text-center text-sm leading-6 text-slate-500">
          Se existir uma conta ativa para este e-mail, enviaremos as
          instruções para redefinir a senha.
        </p>

        <button
          type="button"
          className="w-full rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.35)] transition-colors hover:bg-indigo-700"
          onClick={() => setIsSuccess(false)}
        >
          Voltar ao formulário
        </button>
        {cooldownSeconds > 0 ? (
          <p className="text-center text-xs font-semibold text-slate-500">
            Você poderá solicitar um novo link em{" "}
            <span className="text-slate-700">
              {formatCooldown(cooldownSeconds)}
            </span>
            .
          </p>
        ) : null}

        <div className="border-t border-slate-200 pt-5 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          E-mail de recuperação
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
            <Mail className="h-4 w-4" />
          </span>
          <input
            {...form.register("email")}
            type="email"
            autoComplete="email"
            placeholder="exemplo@clinicos.com"
            className="w-full rounded-2xl border border-slate-200 bg-slate-100 py-3.5 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            disabled={isLoading}
          />
        </div>
        {form.formState.errors.email && (
          <p className="mt-1 text-xs font-semibold text-red-500">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || cooldownSeconds > 0}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(79,70,229,0.36)] transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : cooldownSeconds > 0 ? (
          `Aguarde ${formatCooldown(cooldownSeconds)}`
        ) : (
          <>
            Enviar link de recuperação
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      {cooldownSeconds > 0 ? (
        <p className="text-center text-xs font-semibold text-slate-500">
          Você poderá solicitar um novo link em{" "}
          <span className="text-slate-700">{formatCooldown(cooldownSeconds)}</span>.
        </p>
      ) : null}

      <div className="mt-7 border-t border-slate-200 pt-5 text-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </Link>
      </div>
    </form>
  );
}
