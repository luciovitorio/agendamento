import { redirect } from "next/navigation";
import { ReportsShell } from "./_components/reports-shell";
import { getReportsData, type ReportsSearchParams } from "./_lib/reports-data";

interface Props {
  searchParams: Promise<ReportsSearchParams>;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function safePercent(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

export default async function AdminReportsPage({ searchParams }: Props) {
  const result = await getReportsData(searchParams);
  if (result.redirectTo || !result.data) {
    redirect(result.redirectTo || "/admin");
  }

  const data = result.data;

  return (
    <ReportsShell data={data} currentPath="/admin/reports">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Agendamentos no período</p>
          <p className="text-2xl font-black">{data.bookingsCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">No-show</p>
          <p className="text-2xl font-black">
            {formatPercent(safePercent(data.statusRange.NO_SHOW, data.bookingsCount))}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Cancelamento</p>
          <p className="text-2xl font-black">
            {formatPercent(safePercent(data.statusRange.CANCELLED, data.bookingsCount))}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Lead time médio</p>
          <p className="text-2xl font-black">
            {data.avgLeadDays.toLocaleString("pt-BR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
            d
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">
            {data.showFinancial ? "Receita (realizado)" : "Realizados"}
          </p>
          <p className="text-2xl font-black">
            {data.showFinancial
              ? formatCurrencyBRL(data.revenueRange)
              : data.statusRange.COMPLETED}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">Funil de confirmação</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div>
              Agendados: <b>{data.bookingsCount}</b>
            </div>
            <div>
              Pendentes: <b>{data.statusRange.PENDING}</b>
            </div>
            <div>
              Confirmados: <b>{data.statusRange.CONFIRMED}</b>
            </div>
            <div>
              Realizados: <b>{data.statusRange.COMPLETED}</b>
            </div>
            <div>
              No-show: <b>{data.statusRange.NO_SHOW}</b>
            </div>
            <div>
              Cancelados: <b>{data.statusRange.CANCELLED}</b>
            </div>
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
                {data.noShowCancelRows.slice(0, 8).map((row) => (
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
