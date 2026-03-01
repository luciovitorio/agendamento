"use client";

import { CalendarPlus2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AppointmentsTable } from "./_components/appointments-table";
import type {
  AppointmentData,
  AppointmentFilters,
  AppointmentPagination,
} from "./_components/types";

interface AppointmentsClientPageProps {
  appointments: AppointmentData[];
  userRole: string;
  professionals: Array<{ id: string; name: string }>;
  filters: AppointmentFilters;
  pagination: AppointmentPagination;
}

export function AppointmentsClientPage({
  appointments,
  userRole,
  professionals,
  filters,
  pagination,
}: AppointmentsClientPageProps) {
  return (
    <div className="flex-1 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <Link
              href="/admin"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="size-4" />
            <span className="text-slate-900 dark:text-slate-100 font-medium">
              Gestão de Agendamentos
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Gestão de Agendamentos
          </h1>
          <p className="text-slate-500 mt-2 max-w-lg">
            Acompanhe agendas da clínica, ajuste status e crie encaixes
            manuais quando o paciente entrar em contato direto.
          </p>
        </div>

        <Link
          href="/admin/appointments/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
        >
          <CalendarPlus2 className="size-5" />
          <span>Novo Agendamento</span>
        </Link>
      </div>

      <AppointmentsTable
        appointments={appointments}
        userRole={userRole}
        professionals={professionals}
        filters={filters}
        pagination={pagination}
      />
    </div>
  );
}
