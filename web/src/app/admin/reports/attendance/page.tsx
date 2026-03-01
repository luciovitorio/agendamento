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

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default async function ReportsAttendancePage({ searchParams }: Props) {
  const result = await getReportsData(searchParams);
  if (result.redirectTo || !result.data) {
    redirect(result.redirectTo || "/admin");
  }
  const data = result.data;

  return (
    <ReportsShell data={data} currentPath="/admin/reports/attendance">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">
            Relatório diário de atendimento ({data.dayStart.toLocaleDateString("pt-BR")})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
            <div>
              Total: <b>{data.dailyRows.length}</b>
            </div>
            <div>
              Realizados: <b>{data.statusDaily.COMPLETED}</b>
            </div>
            <div>
              Confirmados: <b>{data.statusDaily.CONFIRMED}</b>
            </div>
            <div>
              Pendentes: <b>{data.statusDaily.PENDING}</b>
            </div>
            <div>
              {data.showFinancial ? "Receita" : "No-show"}:{" "}
              <b>
                {data.showFinancial
                  ? formatCurrencyBRL(data.revenueDaily)
                  : data.statusDaily.NO_SHOW}
              </b>
            </div>
          </div>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2">Hora</th>
                  <th className="text-left px-3 py-2">Paciente</th>
                  <th className="text-left px-3 py-2">Médico</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.dailyRows.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 dark:border-zinc-800">
                    <td className="px-3 py-2">{item.startTime}</td>
                    <td className="px-3 py-2">{item.patientName}</td>
                    <td className="px-3 py-2">{item.professionalName}</td>
                    <td className="px-3 py-2">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">Ocupação de agenda</h2>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2">Médico</th>
                  <th className="text-left px-3 py-2">Disp. (h)</th>
                  <th className="text-left px-3 py-2">Ocup. (h)</th>
                  <th className="text-left px-3 py-2">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {data.occupancyRows.map((row) => (
                  <tr key={row.name} className="border-t border-slate-200 dark:border-zinc-800">
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{(row.available / 60).toFixed(1)}</td>
                    <td className="px-3 py-2">{(row.occupied / 60).toFixed(1)}</td>
                    <td className="px-3 py-2">{formatPercent(row.utilization)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">Picos de demanda</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold mb-1">Dias</p>
              {data.demandDays.slice(0, 6).map(([day, total]) => (
                <p key={day}>
                  {day}: <b>{total}</b>
                </p>
              ))}
            </div>
            <div>
              <p className="font-semibold mb-1">Horários</p>
              {data.demandHours.slice(0, 6).map(([hour, total]) => (
                <p key={hour}>
                  {hour}: <b>{total}</b>
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">Remarcações (indicador)</h2>
          <p className="text-sm">
            Remarcações estimadas no período: <b>{data.possibleReschedules}</b>
          </p>
        </section>
      </div>
    </ReportsShell>
  );
}
