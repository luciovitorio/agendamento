import Link from "next/link";

export default function AdminNotFoundPage() {
  return (
    <section className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <p className="text-sm font-bold tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
          ERRO 404
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Tela nao encontrada
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Essa rota do painel administrativo nao existe.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Voltar ao dashboard
          </Link>
          <Link
            href="/admin/settings"
            className="rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Ir para configuracoes
          </Link>
        </div>
      </div>
    </section>
  );
}
