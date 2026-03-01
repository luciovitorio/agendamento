"use client";

import { useState } from "react";
import { ShieldPlus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PlansTable } from "./_components/plans-table";
import { CreatePlanModal } from "./_components/create-plan-modal";
import type { HealthPlanData } from "./_components/types";

interface PlansClientPageProps {
  plans: HealthPlanData[];
}

export function PlansClientPage({ plans }: PlansClientPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <Link
              href="/admin/patients"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Pacientes
            </Link>
            <ChevronRight className="size-4" />
            <span className="text-slate-900 dark:text-slate-100 font-medium">
              Planos Aceitos
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Planos Aceitos
          </h1>
          <p className="text-slate-500 mt-2 max-w-lg">
            Cadastre e mantenha a lista de planos de saúde aceitos pela clínica.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
        >
          <ShieldPlus className="size-5" />
          <span>Adicionar Plano</span>
        </button>
      </div>

      <PlansTable plans={plans} />

      <CreatePlanModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
