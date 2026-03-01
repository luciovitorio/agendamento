import {
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Pen,
  Trash,
  Clock,
  Ban,
  ShieldAlert,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
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
import { toggleUserBlockAction } from "@/app/actions/auth-actions";
import { DeleteUserModal } from "./delete-user-modal";
import { EditUserModal } from "./edit-user-modal";

// Type definitions matching Prisma schema mapping
export interface UserData {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PROFESSIONAL" | "RECEPTIONIST";
  status: "ACTIVE" | "INACTIVE" | "PENDING" | "BLOCKED";
  lastLogin?: Date | null;
  designation?: string | null;
}

interface UsersTableProps {
  users: UserData[];
}

export function UsersTable({ users }: UsersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [blockingEmail, setBlockingEmail] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);

  // Filter & pagination state
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const handleFilterChange = () => setCurrentPage(1);

  const handleToggleBlock = (email: string, currentStatus: string) => {
    setBlockingEmail(email);
    startTransition(async () => {
      const res = await toggleUserBlockAction(email, currentStatus);
      if (res.success) {
        toast({
          title: "Status atualizado",
          description: `Usuário ${res.newStatus === "BLOCKED" ? "bloqueado" : "desbloqueado"} com sucesso.`,
        });
        router.refresh();
      } else {
        toast({
          title: "Erro",
          description: res.error,
          variant: "destructive",
        });
      }
      setBlockingEmail(null);
    });
  };

  // Helper to extract initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Setup color variants based on Role or designation internally mapping to aesthetic classes
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
        {/* Filter Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Filter className="size-4" />
            <span>Filtros</span>
          </div>

          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setRoleFilter(v);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-[180px] rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
              <SelectValue placeholder="Todos os Cargos" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
              <SelectItem value="ALL" className="rounded-lg cursor-pointer">
                Todos os Cargos
              </SelectItem>
              <SelectItem value="ADMIN" className="rounded-lg cursor-pointer">
                Admin
              </SelectItem>
              <SelectItem
                value="RECEPTIONIST"
                className="rounded-lg cursor-pointer"
              >
                Recepcionista
              </SelectItem>
              <SelectItem
                value="PROFESSIONAL"
                className="rounded-lg cursor-pointer"
              >
                Profissional
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-[180px] rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm shadow-none cursor-pointer">
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
              <SelectItem value="ALL" className="rounded-lg cursor-pointer">
                Todos os Status
              </SelectItem>
              <SelectItem value="ACTIVE" className="rounded-lg cursor-pointer">
                Ativo
              </SelectItem>
              <SelectItem value="PENDING" className="rounded-lg cursor-pointer">
                Aguardando
              </SelectItem>
              <SelectItem value="BLOCKED" className="rounded-lg cursor-pointer">
                Bloqueado
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Exibir</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
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
                  Nome & Designação
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Endereço de Email
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Último Login
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* Name and Designation */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-10 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarColors(
                            index,
                          )}`}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {user.designation || "Membro da Equipe"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email Address */}
                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                      {user.email}
                    </td>

                    {/* Access Role Badge */}
                    <td className="px-6 py-5">
                      {user.role === "ADMIN" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 uppercase">
                          <span className="size-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
                          Admin
                        </span>
                      ) : user.role === "RECEPTIONIST" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase">
                          <span className="size-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                          Recepcionista
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-600/10 text-teal-600 dark:text-teal-400 uppercase">
                          <span className="size-1.5 rounded-full bg-teal-600 dark:bg-teal-400"></span>
                          Doutor(a)
                        </span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400 font-medium">
                      {user.lastLogin
                        ? format(
                            new Date(user.lastLogin),
                            "dd MMM, yyyy • hh:mm a",
                            {
                              locale: ptBR,
                            },
                          )
                        : "Nunca acessou"}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-5">
                      {user.status === "ACTIVE" ? (
                        <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit">
                          <CheckCircle className="size-4" />
                          Ativo
                        </span>
                      ) : user.status === "PENDING" ? (
                        <span className="text-amber-600 dark:text-amber-400 text-sm font-semibold flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full w-fit">
                          <Clock className="size-4" />
                          Aguardando
                        </span>
                      ) : user.status === "BLOCKED" ? (
                        <span className="text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-full w-fit">
                          <Ban className="size-4" />
                          Bloqueado
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 text-sm font-semibold flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full w-fit">
                          <XCircle className="size-4" />
                          Inativo
                        </span>
                      )}
                    </td>

                    {/* Actions Dropdown */}
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
                            onClick={(e) => {
                              e.preventDefault();
                              setEditingUser(user);
                            }}
                            className="cursor-pointer text-slate-700 dark:text-slate-300 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:bg-slate-100 dark:focus:bg-zinc-800 font-medium"
                          >
                            <Pen className="size-4 text-slate-400" />
                            <span>Editar</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            disabled={isPending && blockingEmail === user.email}
                            onClick={(e) => {
                              e.preventDefault();
                              handleToggleBlock(user.email, user.status);
                            }}
                            className="cursor-pointer text-amber-600 dark:text-amber-400 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors focus:bg-amber-50 dark:focus:bg-amber-500/10 font-medium mt-1"
                          >
                            {isPending && blockingEmail === user.email ? (
                              <Loader2 className="size-4 animate-spin text-amber-500" />
                            ) : (
                              <ShieldAlert className="size-4 text-amber-500 dark:text-amber-400" />
                            )}
                            <span>
                              {user.status === "BLOCKED"
                                ? "Desbloquear"
                                : "Bloquear"}
                            </span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              setDeletingUser(user);
                            }}
                            className="cursor-pointer text-red-600 dark:text-red-400 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-700 dark:focus:text-red-300 font-medium mt-1"
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

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando{" "}
            <span className="font-bold">
              {Math.min((safePage - 1) * pageSize + 1, filteredUsers.length)}
            </span>
            –
            <span className="font-bold">
              {Math.min(safePage * pageSize, filteredUsers.length)}
            </span>{" "}
            de <span className="font-bold">{filteredUsers.length}</span>{" "}
            usuários
            {(roleFilter !== "ALL" || statusFilter !== "ALL") && (
              <span className="text-slate-400">
                {" "}
                (filtrado de {users.length} total)
              </span>
            )}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="size-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
            ))}
            <button
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="size-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          open={!!editingUser}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
          user={editingUser}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <DeleteUserModal
          open={!!deletingUser}
          onOpenChange={(open) => {
            if (!open) setDeletingUser(null);
          }}
          userName={deletingUser.name}
          userEmail={deletingUser.email}
        />
      )}
    </>
  );
}
