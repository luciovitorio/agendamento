"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pen,
  Trash,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditServiceModal } from "./edit-service-modal";
import { DeleteServiceModal } from "./delete-service-modal";
import type { ServiceData } from "./types";

interface ServicesTableProps {
  services: ServiceData[];
  canManageServices: boolean;
}

function formatCurrency(value: number | null) {
  if (value === null) return "-";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ServicesTable({
  services,
  canManageServices,
}: ServicesTableProps) {
  const [pageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [search, setSearch] = useState("");
  const [editingService, setEditingService] = useState<ServiceData | null>(null);
  const [deletingService, setDeletingService] = useState<ServiceData | null>(null);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return services;
    return services.filter((service) => {
      const haystack = [
        service.name,
        service.description || "",
        `${service.duration}`,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [search, services]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedServices = filteredServices.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/30">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por nome, descrição ou duração..."
            className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-4 py-2.5 outline-none focus:border-indigo-500 dark:text-white"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Serviço
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Duração
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Profissionais
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Agendamentos
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cadastro
                </th>
                {canManageServices ? (
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Ações
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {paginatedServices.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageServices ? 7 : 6}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhum serviço encontrado.
                  </td>
                </tr>
              ) : (
                paginatedServices.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {service.name}
                      </p>
                      {service.description ? (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {service.description}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-6 py-5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {service.duration} min
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-700 dark:text-slate-300">
                      {formatCurrency(service.price)}
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-700 dark:text-slate-300">
                      {service.professionalsCount}
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-700 dark:text-slate-300">
                      {service.bookingsCount}
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                      {format(new Date(service.createdAt), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </td>

                    {canManageServices ? (
                      <td className="px-6 py-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                              <MoreHorizontal className="size-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-36 rounded-2xl border-slate-200 dark:border-zinc-800 p-2 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md"
                          >
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault();
                                setEditingService(service);
                              }}
                              className="cursor-pointer text-slate-700 dark:text-slate-300 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:bg-slate-100 dark:focus:bg-zinc-800 font-medium"
                            >
                              <Pen className="size-4 text-slate-400" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault();
                                setDeletingService(service);
                              }}
                              className="cursor-pointer text-red-600 dark:text-red-400 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors focus:bg-red-50 dark:focus:bg-red-500/10 font-medium mt-1"
                            >
                              <Trash className="size-4 text-red-500 dark:text-red-400" />
                              <span>Excluir</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    ) : null}
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
              {Math.min((safePage - 1) * pageSize + 1, filteredServices.length)}
            </span>
            –
            <span className="font-bold">
              {Math.min(safePage * pageSize, filteredServices.length)}
            </span>{" "}
            de <span className="font-bold">{filteredServices.length}</span> serviços
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
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              className="size-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {editingService ? (
        <EditServiceModal
          open={!!editingService}
          onOpenChange={(open) => {
            if (!open) {
              setEditingService(null);
            }
          }}
          service={editingService}
        />
      ) : null}

      {deletingService ? (
        <DeleteServiceModal
          open={!!deletingService}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingService(null);
            }
          }}
          service={deletingService}
        />
      ) : null}
    </>
  );
}
