"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, ShieldCheck, Unlink2 } from "lucide-react";
import {
  linkServiceToProfessionalAction,
  unlinkServiceFromProfessionalAction,
} from "@/app/actions/service-actions";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfessionalOption } from "@/app/admin/appointments/_components/types";
import type { ServiceData } from "./types";

interface ProfessionalServiceLinksPanelProps {
  professionals: ProfessionalOption[];
  services: ServiceData[];
  canManageLinks: boolean;
}

interface LinkRow {
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
}

export function ProfessionalServiceLinksPanel({
  professionals,
  services,
  canManageLinks,
}: ProfessionalServiceLinksPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(
    professionals[0]?.id || "",
  );
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || "");
  const [professionalFilter, setProfessionalFilter] = useState<string>("ALL");
  const router = useRouter();

  const allLinks = useMemo<LinkRow[]>(() => {
    return professionals
      .flatMap((professional) =>
        professional.services.map((service) => ({
          professionalId: professional.id,
          professionalName: professional.name,
          serviceId: service.id,
          serviceName: service.name,
          serviceDuration: service.duration,
        })),
      )
      .sort((a, b) => {
        const byProfessional = a.professionalName.localeCompare(b.professionalName);
        if (byProfessional !== 0) return byProfessional;
        return a.serviceName.localeCompare(b.serviceName);
      });
  }, [professionals]);

  const filteredLinks = useMemo(() => {
    if (professionalFilter === "ALL") return allLinks;
    return allLinks.filter((entry) => entry.professionalId === professionalFilter);
  }, [allLinks, professionalFilter]);

  const selectedProfessional = professionals.find(
    (professional) => professional.id === selectedProfessionalId,
  );
  const alreadyLinked = !!selectedProfessional?.services.some(
    (service) => service.id === selectedServiceId,
  );

  const handleLink = () => {
    if (!canManageLinks) return;
    if (!selectedProfessionalId || !selectedServiceId) {
      toast({
        title: "Selecione os dados",
        description: "Escolha profissional e serviço para criar o vínculo.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const response = await linkServiceToProfessionalAction({
        professionalId: selectedProfessionalId,
        serviceId: selectedServiceId,
      });

      if (response.success) {
        toast({
          title: "Vínculo criado",
          description: "Serviço liberado para este profissional.",
        });
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao vincular",
        description: response.error,
        variant: "destructive",
      });
    });
  };

  const handleUnlink = (professionalId: string, serviceId: string) => {
    if (!canManageLinks) return;

    const confirmed = window.confirm(
      "Deseja remover este vínculo entre profissional e serviço?",
    );
    if (!confirmed) return;

    startTransition(async () => {
      const response = await unlinkServiceFromProfessionalAction({
        professionalId,
        serviceId,
      });

      if (response.success) {
        toast({
          title: "Vínculo removido",
          description: "O serviço não ficará mais disponível para este profissional.",
        });
        router.refresh();
        return;
      }

      toast({
        title: "Erro ao desvincular",
        description: response.error,
        variant: "destructive",
      });
    });
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Vínculo Serviço x Profissional
        </h2>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Controle quais serviços cada profissional pode atender no fluxo de
          agendamento manual e automatizado.
        </p>
      </div>

      {!canManageLinks ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-700 text-sm font-medium inline-flex items-center gap-2">
          <ShieldCheck className="size-4" />
          Apenas administradores podem vincular e desvincular serviços.
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_auto] gap-3">
            <Select
              value={selectedProfessionalId}
              onValueChange={setSelectedProfessionalId}
            >
              <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700 max-h-80">
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.duration} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={handleLink}
              disabled={
                isPending ||
                alreadyLinked ||
                !selectedProfessionalId ||
                !selectedServiceId
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Link2 className="size-4" />
              {alreadyLinked ? "Já vinculado" : "Vincular"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/30">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
              Filtrar por profissional
            </span>
            <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
              <SelectTrigger className="w-[280px] rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                <SelectItem value="ALL">Todos</SelectItem>
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Profissional
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Serviço
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Duração
                </th>
                {canManageLinks ? (
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Ações
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredLinks.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageLinks ? 4 : 3}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhum vínculo encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((entry) => (
                  <tr
                    key={`${entry.professionalId}-${entry.serviceId}`}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-6 py-5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {entry.professionalName}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700 dark:text-slate-300">
                      {entry.serviceName}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                      {entry.serviceDuration} min
                    </td>
                    {canManageLinks ? (
                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleUnlink(entry.professionalId, entry.serviceId)
                          }
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
                        >
                          <Unlink2 className="size-3.5" />
                          Desvincular
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800">
          <p className="text-sm text-slate-500">
            Total de vínculos exibidos:{" "}
            <span className="font-bold">{filteredLinks.length}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
