"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MoreHorizontal,
  Pen,
  Trash,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditPlanModal } from "./edit-plan-modal";
import { DeletePlanModal } from "./delete-plan-modal";
import type { HealthPlanData } from "./types";

interface PlansTableProps {
  plans: HealthPlanData[];
}

export function PlansTable({ plans }: PlansTableProps) {
  const [pageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [editingPlan, setEditingPlan] = useState<HealthPlanData | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<HealthPlanData | null>(null);

  const totalPages = Math.max(1, Math.ceil(plans.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPlans = plans.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nome do Plano
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pacientes Vinculados
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
              {paginatedPlans.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhum plano cadastrado.
                  </td>
                </tr>
              ) : (
                paginatedPlans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {plan.name}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {plan.patientsCount}
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                      {format(new Date(plan.createdAt), "dd/MM/yyyy", {
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
                              setEditingPlan(plan);
                            }}
                            className="cursor-pointer text-slate-700 dark:text-slate-300 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:bg-slate-100 dark:focus:bg-zinc-800 font-medium"
                          >
                            <Pen className="size-4 text-slate-400" />
                            <span>Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.preventDefault();
                              setDeletingPlan(plan);
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
              {Math.min((safePage - 1) * pageSize + 1, plans.length)}
            </span>
            –
            <span className="font-bold">
              {Math.min(safePage * pageSize, plans.length)}
            </span>{" "}
            de <span className="font-bold">{plans.length}</span> planos
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

      {editingPlan ? (
        <EditPlanModal
          open={!!editingPlan}
          onOpenChange={(open) => {
            if (!open) {
              setEditingPlan(null);
            }
          }}
          plan={editingPlan}
        />
      ) : null}

      {deletingPlan ? (
        <DeletePlanModal
          open={!!deletingPlan}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingPlan(null);
            }
          }}
          plan={deletingPlan}
        />
      ) : null}
    </>
  );
}
