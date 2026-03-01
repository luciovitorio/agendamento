import { redirect } from "next/navigation";
import { ReportsShell } from "../_components/reports-shell";
import { getReportsData, type ReportsSearchParams } from "../_lib/reports-data";

interface Props {
  searchParams: Promise<ReportsSearchParams>;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function safePercent(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default async function ReportsProfessionalsPage({ searchParams }: Props) {
  const result = await getReportsData(searchParams);
  if (result.redirectTo || !result.data) {
    redirect(result.redirectTo || "/admin");
  }
  const data = result.data;

  const focusedProfessional =
    data.scopeProfessionalId && data.scopeProfessionalId !== "__NO_PROFESSIONAL__"
      ? data.productivityRows.find(
          (row) => row.professionalId === data.scopeProfessionalId,
        ) || null
      : null;

  return (
    <ReportsShell data={data} currentPath="/admin/reports/professionals">
      {focusedProfessional ? (
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
          <h2 className="font-bold mb-3">Médico selecionado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 p-3">
              <p className="text-xs text-slate-500">Médico</p>
              <p className="font-bold">{focusedProfessional.name}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 p-3">
              <p className="text-xs text-slate-500">Agendamentos</p>
              <p className="font-bold">{focusedProfessional.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 p-3">
              <p className="text-xs text-slate-500">Realizados</p>
              <p className="font-bold">{focusedProfessional.completed}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 p-3">
              <p className="text-xs text-slate-500">No-show</p>
              <p className="font-bold">
                {formatPercent(
                  safePercent(focusedProfessional.noShow, focusedProfessional.total),
                )}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 p-3">
              <p className="text-xs text-slate-500">
                {data.showFinancial ? "Receita" : "Cancelamentos"}
              </p>
              <p className="font-bold">
                {data.showFinancial
                  ? formatCurrencyBRL(focusedProfessional.revenue)
                  : focusedProfessional.cancelled}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">Produtividade por médico</h2>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2">Médico</th>
                  <th className="text-left px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Realizado</th>
                  <th className="text-left px-3 py-2">Efetividade</th>
                </tr>
              </thead>
              <tbody>
                {data.productivityRows.map((row) => (
                  <tr
                    key={row.professionalId}
                    className="border-t border-slate-200 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.total}</td>
                    <td className="px-3 py-2">{row.completed}</td>
                    <td className="px-3 py-2">
                      {formatPercent(safePercent(row.completed, row.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">No-show e cancelamento por médico</h2>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2">Médico</th>
                  <th className="text-left px-3 py-2">No-show</th>
                  <th className="text-left px-3 py-2">Cancel.</th>
                  <th className="text-left px-3 py-2">Taxa no-show</th>
                </tr>
              </thead>
              <tbody>
                {data.noShowCancelRows.map((row) => (
                  <tr
                    key={row.professionalId}
                    className="border-t border-slate-200 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.noShow}</td>
                    <td className="px-3 py-2">{row.cancelled}</td>
                    <td className="px-3 py-2">{formatPercent(row.noShowRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ReportsShell>
  );
}
