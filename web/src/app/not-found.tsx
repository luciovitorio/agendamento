import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 grid place-items-center px-6">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
        <p className="text-sm font-bold tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
          ERRO 404
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          Pagina nao encontrada
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          A rota informada nao existe ou foi removida.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Ir para inicio
          </Link>
          <Link
            href="/admin"
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Ir para admin
          </Link>
        </div>
      </div>
    </main>
  );
}
