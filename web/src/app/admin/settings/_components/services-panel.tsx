"use client";

import { useState } from "react";
import { BriefcaseMedical } from "lucide-react";
import { ServicesTable } from "./services-table";
import { CreateServiceModal } from "./create-service-modal";
import type { ServiceData } from "./types";

interface ServicesPanelProps {
  services: ServiceData[];
  canManageServices: boolean;
}

export function ServicesPanel({
  services,
  canManageServices,
}: ServicesPanelProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Cadastro de Serviços
          </h2>
          <p className="text-slate-500 mt-1 max-w-2xl">
            Gerencie os serviços oferecidos pela clínica, com duração e preço,
            para uso em agendamentos manuais e automáticos.
          </p>
        </div>

        {canManageServices ? (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
          >
            <BriefcaseMedical className="size-5" />
            <span>Novo Serviço</span>
          </button>
        ) : null}
      </div>

      <ServicesTable services={services} canManageServices={canManageServices} />

      {canManageServices ? (
        <CreateServiceModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />
      ) : null}
    </section>
  );
}
