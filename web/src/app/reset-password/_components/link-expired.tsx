"use client";

import { ShieldX, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function LinkExpired() {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 min-h-screen flex items-center justify-center font-sans antialiased relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-red-500/5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-red-500/10 blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-6 py-12">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 shadow-xl text-center">
          <div className="bg-red-100 dark:bg-red-500/10 p-4 rounded-2xl inline-flex mb-6">
            <ShieldX className="size-10 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
            Link Expirado
          </h1>

          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-8">
            Este link de configuração de senha já foi utilizado ou expirou. Caso
            precise redefinir sua senha, utilize a opção{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">
              &quot;Esqueci minha senha&quot;
            </strong>{" "}
            na tela de login.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md shadow-indigo-600/20"
          >
            <ArrowLeft className="size-4" />
            Ir para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}
