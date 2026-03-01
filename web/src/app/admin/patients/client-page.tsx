"use client";

import { useState } from "react";
import { UserRoundPlus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CreatePatientModal } from "./_components/create-patient-modal";
import { PatientsTable } from "./_components/patients-table";
import type { HealthPlanOption, PatientData } from "./_components/types";

interface PatientsClientPageProps {
  patients: PatientData[];
  healthPlans: HealthPlanOption[];
}

export function PatientsClientPage({
  patients,
  healthPlans,
}: PatientsClientPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

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
              Gestão de Pacientes
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Gestão de Pacientes
          </h1>
          <p className="text-slate-500 mt-2 max-w-lg">
            Cadastre e organize pacientes da clínica, com controle de contato e
            vínculo com plano de saúde.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
        >
          <UserRoundPlus className="size-5" />
          <span>Adicionar Paciente</span>
        </button>
      </div>

      <PatientsTable patients={patients} healthPlans={healthPlans} />

      <CreatePatientModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        healthPlans={healthPlans}
      />
    </div>
  );
}
