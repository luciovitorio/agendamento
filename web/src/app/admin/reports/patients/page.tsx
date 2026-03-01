import { redirect } from "next/navigation";
import { ReportsShell } from "../_components/reports-shell";
import { getReportsData, type ReportsSearchParams } from "../_lib/reports-data";
import { formatPhoneDisplay } from "@/lib/phone-format";

interface Props {
  searchParams: Promise<ReportsSearchParams>;
}

export default async function ReportsPatientsPage({ searchParams }: Props) {
  const result = await getReportsData(searchParams);
  if (result.redirectTo || !result.data) {
    redirect(result.redirectTo || "/admin");
  }
  const data = result.data;

  return (
    <ReportsShell data={data} currentPath="/admin/reports/patients">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">Relatório de paciente específico</h2>
          {!data.selectedPatient ? (
            <p className="text-sm text-slate-500">
              Selecione um paciente no filtro para gerar este relatório.
            </p>
          ) : (
            <>
              <p className="text-sm">
                <b>{data.selectedPatient.name}</b> ·{" "}
                {formatPhoneDisplay(data.selectedPatient.phone)}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  Total histórico: <b>{data.patientHistoryCount}</b>
                </div>
                <div>
                  No-show: <b>{data.statusPatient.NO_SHOW}</b>
                </div>
                <div>
                  Cancelados: <b>{data.statusPatient.CANCELLED}</b>
                </div>
                <div>
                  Realizados: <b>{data.statusPatient.COMPLETED}</b>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">Pacientes novos x recorrentes</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 p-4">
              <p className="text-xs text-slate-500">Novos</p>
              <p className="text-2xl font-black">{data.newCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 p-4">
              <p className="text-xs text-slate-500">Recorrentes</p>
              <p className="text-2xl font-black">{data.recurringCount}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        <h2 className="font-bold">Pacientes em risco</h2>
        <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left px-3 py-2">Paciente</th>
                <th className="text-left px-3 py-2">Telefone</th>
                <th className="text-left px-3 py-2">No-show</th>
                <th className="text-left px-3 py-2">Cancel.</th>
                <th className="text-left px-3 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {data.riskRows.slice(0, 20).map((row) => (
                <tr key={`${row.name}-${row.phone}`} className="border-t border-slate-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{formatPhoneDisplay(row.phone)}</td>
                  <td className="px-3 py-2">{row.noShow}</td>
                  <td className="px-3 py-2">{row.cancelled}</td>
                  <td className="px-3 py-2">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ReportsShell>
  );
}
