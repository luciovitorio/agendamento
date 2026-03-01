"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MoreHorizontal,
  Pen,
  Trash,
  ChevronLeft,
  ChevronRight,
  Filter,
  Phone,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeletePatientModal } from "./delete-patient-modal";
import { EditPatientModal } from "./edit-patient-modal";
import type { HealthPlanOption, PatientData } from "./types";
import { formatPhoneDisplay } from "@/lib/phone-format";

interface PatientsTableProps {
  patients: PatientData[];
  healthPlans: HealthPlanOption[];
}

export function PatientsTable({ patients, healthPlans }: PatientsTableProps) {
  const [coverageFilter, setCoverageFilter] = useState<string>("ALL");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [editingPatient, setEditingPatient] = useState<PatientData | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<PatientData | null>(
    null,
  );

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      if (coverageFilter !== "ALL" && patient.coverageType !== coverageFilter) {
        return false;
      }
      return true;
    });
  }, [patients, coverageFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPatients = filteredPatients.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((chunk) => chunk[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getAvatarColors = (index: number) => {
    const colors = [
      "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400",
      "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
      "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400",
      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
    ];
    return colors[index % colors.length];
  };

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Filter className="size-4" />
            <span>Filtros</span>
          </div>

          <Select
            value={coverageFilter}
            onValueChange={(value) => {
              setCoverageFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[190px] rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
              <SelectValue placeholder="Tipo de cobertura" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
              <SelectItem value="ALL" className="rounded-lg cursor-pointer">
                Todas as Coberturas
              </SelectItem>
              <SelectItem
                value="PARTICULAR"
                className="rounded-lg cursor-pointer"
              >
                Particular
              </SelectItem>
              <SelectItem value="PLAN" className="rounded-lg cursor-pointer">
                Plano
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Exibir</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[70px] rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                <SelectItem value="5" className="rounded-lg cursor-pointer">
                  5
                </SelectItem>
                <SelectItem value="10" className="rounded-lg cursor-pointer">
                  10
                </SelectItem>
                <SelectItem value="25" className="rounded-lg cursor-pointer">
                  25
                </SelectItem>
                <SelectItem value="50" className="rounded-lg cursor-pointer">
                  50
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-slate-500">por página</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Paciente
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cobertura
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Plano
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Agendamentos
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cadastro
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient, index) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-10 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarColors(
                            index,
                          )}`}
                        >
                          {getInitials(patient.name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {patient.name}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="space-y-1 text-sm">
                        <p className="text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
                          <Phone className="size-3.5 text-slate-400" />
                          {formatPhoneDisplay(patient.phone)}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                          <Mail className="size-3.5 text-slate-400" />
                          {patient.email || "Sem e-mail"}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      {patient.coverageType === "PLAN" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 uppercase">
                          Plano
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase">
                          Particular
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                      {patient.healthPlanName || "-"}
                    </td>

                    <td className="px-6 py-5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {patient.bookingsCount}
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                      {format(new Date(patient.createdAt), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </td>

                    <td className="px-6 py-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            <MoreHorizontal className="size-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-34 rounded-2xl border-slate-200 dark:border-zinc-800 p-2 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md"
                        >
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.preventDefault();
                              setEditingPatient(patient);
                            }}
                            className="cursor-pointer text-slate-700 dark:text-slate-300 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:bg-slate-100 dark:focus:bg-zinc-800 font-medium"
                          >
                            <Pen className="size-4 text-slate-400" />
                            <span>Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.preventDefault();
                              setDeletingPatient(patient);
                            }}
                            className="cursor-pointer text-red-600 dark:text-red-400 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors focus:bg-red-50 dark:focus:bg-red-500/10 font-medium mt-1"
                          >
                            <Trash className="size-4 text-red-500 dark:text-red-400" />
                            <span>Excluir</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando{" "}
            <span className="font-bold">
              {Math.min((safePage - 1) * pageSize + 1, filteredPatients.length)}
            </span>
            –
            <span className="font-bold">
              {Math.min(safePage * pageSize, filteredPatients.length)}
            </span>{" "}
            de <span className="font-bold">{filteredPatients.length}</span>{" "}
            pacientes
            {coverageFilter !== "ALL" && (
              <span className="text-slate-400">
                {" "}
                (filtrado de {patients.length} total)
              </span>
            )}
          </p>

          <div className="flex items-center gap-1">
            <button
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="size-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`size-8 rounded-lg border text-xs font-bold transition-colors ${
                    page === safePage
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {page}
                </button>
              ),
            )}

            <button
              disabled={safePage >= totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className="size-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {editingPatient ? (
        <EditPatientModal
          open={!!editingPatient}
          onOpenChange={(open) => {
            if (!open) {
              setEditingPatient(null);
            }
          }}
          patient={editingPatient}
          healthPlans={healthPlans}
        />
      ) : null}

      {deletingPatient ? (
        <DeletePatientModal
          open={!!deletingPatient}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingPatient(null);
            }
          }}
          patient={deletingPatient}
        />
      ) : null}
    </>
  );
}
