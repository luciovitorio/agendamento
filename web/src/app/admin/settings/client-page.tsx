"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppointmentTimeOffPanel } from "@/app/admin/appointments/_components/appointment-timeoff-panel";
import type {
  AppointmentTimeOffData,
  ProfessionalOption,
} from "@/app/admin/appointments/_components/types";
import { ServicesPanel } from "./_components/services-panel";
import { ProfessionalServiceLinksPanel } from "./_components/professional-service-links-panel";
import { BotSettingsPanel } from "./_components/bot-settings-panel";
import type { BotSettingsData, ServiceData } from "./_components/types";

type SettingsTab = "services" | "bot" | "timeoff";

interface SettingsClientPageProps {
  services: ServiceData[];
  professionals: ProfessionalOption[];
  timeOffs: AppointmentTimeOffData[];
  botSettings: BotSettingsData | null;
  userRole: string;
  activeTab: SettingsTab;
}

export function SettingsClientPage({
  services,
  professionals,
  timeOffs,
  botSettings,
  userRole,
  activeTab,
}: SettingsClientPageProps) {
  const canManageServices = userRole === "ADMIN";
  const canManageBotSettings = userRole === "ADMIN";
  const navItems = canManageServices
    ? [
        { tab: "services" as const, label: "Serviços" },
        { tab: "bot" as const, label: "Bot WhatsApp" },
        { tab: "timeoff" as const, label: "Bloqueios de Agenda" },
      ]
    : [{ tab: "timeoff" as const, label: "Bloqueios de Agenda" }];

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full space-y-10">
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
            Configurações
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Configurações da Clínica
        </h1>
        <p className="text-slate-500 mt-2 max-w-3xl">
          Centralize parâmetros de operação da agenda, incluindo serviços
          oferecidos e bloqueios de indisponibilidade dos profissionais.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-2">
        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <Link
                key={item.tab}
                href={`/admin/settings?tab=${item.tab}`}
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

      {activeTab === "services" && canManageServices ? (
        <>
          <ServicesPanel services={services} canManageServices={canManageServices} />
          <ProfessionalServiceLinksPanel
            professionals={professionals}
            services={services}
            canManageLinks={canManageServices}
          />
        </>
      ) : null}

      {activeTab === "bot" && canManageBotSettings && botSettings ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Automacao WhatsApp
            </h2>
            <p className="text-slate-500 mt-1 max-w-2xl">
              Defina o numero da clinica, o provider WhatsApp (Evolution ou
              Meta Cloud API) e os textos que o bot responde para os pacientes.
            </p>
          </div>
          <BotSettingsPanel settings={botSettings} canManageBotSettings />
        </section>
      ) : null}

      {activeTab === "timeoff" ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Bloqueios de Agenda
            </h2>
            <p className="text-slate-500 mt-1 max-w-2xl">
              Defina períodos de ausência dos profissionais. Esses bloqueios são
              aplicados tanto no atendimento manual quanto no agendamento
              automático pelo bot.
            </p>
          </div>
          <AppointmentTimeOffPanel
            timeOffs={timeOffs}
            professionals={professionals}
            userRole={userRole}
          />
        </section>
      ) : null}
    </div>
  );
}
