import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { ReportsFilters } from "./reports-filters";
import type { ReportsData } from "../_lib/reports-data";

interface ReportsShellProps {
  data: ReportsData;
  currentPath:
    | "/admin/reports"
    | "/admin/reports/attendance"
    | "/admin/reports/professionals"
    | "/admin/reports/patients"
    | "/admin/reports/services";
  children: ReactNode;
}

function buildQueryString(data: ReportsData) {
  const params = new URLSearchParams();
  params.set("startDate", data.startDateValue);
  params.set("endDate", data.endDateValue);
  params.set("day", data.dayValue);
  params.set("patientId", data.selectedPatientId || "ALL");

  if (data.scopeProfessionalId && data.scopeProfessionalId !== "__NO_PROFESSIONAL__") {
    params.set("professionalId", data.scopeProfessionalId);
  } else {
    params.set("professionalId", "ALL");
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ReportsShell({ data, currentPath, children }: ReportsShellProps) {
  const query = buildQueryString(data);

  const navItems = [
    { href: "/admin/reports", label: "Visão Geral" },
    { href: "/admin/reports/attendance", label: "Atendimentos" },
    { href: "/admin/reports/professionals", label: "Profissionais" },
    { href: "/admin/reports/patients", label: "Pacientes" },
    { href: "/admin/reports/services", label: "Serviços" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <Link href="/admin" className="hover:text-indigo-600 dark:hover:text-indigo-400">
            Dashboard
          </Link>
          <ChevronRight className="size-4" />
          <span className="font-medium text-slate-900 dark:text-zinc-100">Relatórios</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="size-8 text-indigo-600 dark:text-indigo-400" />
          Relatórios Operacionais
        </h1>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <ReportsFilters
          userRole={data.userRole}
          startDateValue={data.startDateValue}
          endDateValue={data.endDateValue}
          dayValue={data.dayValue}
          professionals={data.professionals}
          patients={data.patients.map((patient) => ({
            id: patient.id,
            name: patient.name,
          }))}
          selectedProfessionalId={data.scopeProfessionalId}
          selectedPatientId={data.selectedPatientId}
          clearHref={currentPath}
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-2">
        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <Link
                key={item.href}
                href={`${item.href}${query}`}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {data.isDoctorWithoutProfessional ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
          Seu usuário doutor não está vinculado a um profissional. Os relatórios ficam sem dados.
        </div>
      ) : null}

      {data.dateRangeNotice ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-800 p-3 text-sm">
          {data.dateRangeNotice}
        </div>
      ) : null}

      {children}
    </div>
  );
}
