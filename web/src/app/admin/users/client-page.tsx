"use client";

import { useState } from "react";
import { UserPlus, ChevronRight } from "lucide-react";
import { UsersTable, type UserData } from "./_components/users-table";
import { CreateUserModal } from "./_components/create-user-modal";
import Link from "next/link";

interface UsersClientPageProps {
  users: UserData[];
}

export function UsersClientPage({ users }: UsersClientPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full">
      {/* Header Section */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <Link
              href="/admin/settings"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Configurações
            </Link>
            <ChevronRight className="size-4" />
            <span className="text-slate-900 dark:text-slate-100 font-medium">
              Gestão de Usuários
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Gestão de Usuários
          </h1>
          <p className="text-slate-500 mt-2 max-w-lg">
            Configure o acesso ao sistema e gerencie as permissões e cargos para
            os membros da equipe clínica.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
        >
          <UserPlus className="size-5" />
          <span>Adicionar Novo Usuário</span>
        </button>
      </div>

      <UsersTable users={users} />

      <CreateUserModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
