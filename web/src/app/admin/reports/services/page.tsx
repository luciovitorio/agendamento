import { redirect } from "next/navigation";
import { ReportsShell } from "../_components/reports-shell";
import { getReportsData, type ReportsSearchParams } from "../_lib/reports-data";

interface Props {
  searchParams: Promise<ReportsSearchParams>;
}

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default async function ReportsServicesPage({ searchParams }: Props) {
  const result = await getReportsData(searchParams);
  if (result.redirectTo || !result.data) {
    redirect(result.redirectTo || "/admin");
  }
  const data = result.data;

  const totalServices = data.serviceRows.length;
  const totalCompleted = data.serviceRows.reduce((acc, row) => acc + row.completed, 0);
  const totalRevenue = data.serviceRows.reduce((acc, row) => acc + row.revenue, 0);

  return (
    <ReportsShell data={data} currentPath="/admin/reports/services">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Serviços com movimento</p>
          <p className="text-2xl font-black">{totalServices}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">Atendimentos realizados</p>
          <p className="text-2xl font-black">{totalCompleted}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-slate-500">
            {data.showFinancial ? "Receita total" : "No-show total"}
          </p>
          <p className="text-2xl font-black">
            {data.showFinancial
              ? formatCurrencyBRL(totalRevenue)
              : data.serviceRows.reduce((acc, row) => acc + row.noShow, 0)}
          </p>
        </div>
      </div>

      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        <h2 className="font-bold">Performance por serviço</h2>
        <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left px-3 py-2">Serviço</th>
                <th className="text-left px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Realizado</th>
                <th className="text-left px-3 py-2">No-show</th>
                <th className="text-left px-3 py-2">Cancel.</th>
                {data.showFinancial ? (
                  <th className="text-left px-3 py-2">Receita</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {data.serviceRows.map((row) => (
                <tr key={row.serviceId} className="border-t border-slate-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.total}</td>
                  <td className="px-3 py-2">{row.completed}</td>
                  <td className="px-3 py-2">{row.noShow}</td>
                  <td className="px-3 py-2">{row.cancelled}</td>
                  {data.showFinancial ? (
                    <td className="px-3 py-2">{formatCurrencyBRL(row.revenue)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ReportsShell>
  );
}
