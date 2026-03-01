"use client";

import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Badge, Loader2, Stethoscope } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserAction } from "@/app/actions/auth-actions";
import { toast } from "@/hooks/use-toast";
import type { UserData } from "./users-table";

const editUserSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  role: z.enum(["RECEPTIONIST", "ADMIN", "PROFESSIONAL"], {
    message: "Selecione um cargo",
  }),
  bio: z.string().optional(),
});

type EditUserValues = z.infer<typeof editUserSchema>;

interface EditUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData;
}

export function EditUserModal({
  open,
  onOpenChange,
  user,
}: EditUserModalProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name,
      role: user.role,
      bio: "",
    },
  });

  const selectedRole = form.watch("role");

  const onSubmit = (data: EditUserValues) => {
    startTransition(async () => {
      const res = await updateUserAction(user.email, {
        name: data.name,
        role: data.role,
        bio: data.bio,
      });

      if (res.success) {
        toast({
          title: "Usuário atualizado",
          description: "As informações foram salvas com sucesso.",
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: "Erro",
          description:
            (res as { error?: string }).error ||
            "Ocorreu um erro ao atualizar o usuário.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
        <DialogHeader className="px-8 py-6 border-b border-slate-100 dark:border-zinc-800 flex flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Editar Usuário
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Atualize as informações do membro da equipe.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-8 space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Nome Completo
              </label>
              <div className="relative">
                <Badge className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5 bg-transparent hover:bg-transparent shadow-none" />
                <input
                  {...form.register("name")}
                  className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
                  placeholder="ex: Dr. Carlos Silva"
                  type="text"
                />
              </div>
              {form.formState.errors.name && (
                <span className="text-xs text-red-500 font-medium">
                  {form.formState.errors.name.message}
                </span>
              )}
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Endereço de E-mail
              </label>
              <input
                value={user.email}
                disabled
                className="w-full bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-slate-500 dark:text-slate-400 border cursor-not-allowed"
              />
              <p className="text-xs text-slate-400">
                O e-mail não pode ser alterado.
              </p>
            </div>

            {/* Role Dropdown */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Cargo (Acesso)
              </label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-6 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all cursor-pointer dark:text-white border shadow-none">
                      <SelectValue placeholder="Selecione um cargo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                      <SelectItem
                        value="RECEPTIONIST"
                        className="rounded-lg cursor-pointer"
                      >
                        Recepcionista
                      </SelectItem>
                      <SelectItem
                        value="ADMIN"
                        className="rounded-lg cursor-pointer"
                      >
                        Administrador
                      </SelectItem>
                      <SelectItem
                        value="PROFESSIONAL"
                        className="rounded-lg cursor-pointer"
                      >
                        Profissional Clínico
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.role && (
                <span className="text-xs text-red-500 font-medium">
                  {form.formState.errors.role.message}
                </span>
              )}
            </div>

            {/* Bio (only for professionals) */}
            {selectedRole === "PROFESSIONAL" && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Especialidade / Bio
                  <span className="text-slate-400 font-normal ml-1">
                    (opcional)
                  </span>
                </label>
                <div className="relative">
                  <Stethoscope className="absolute left-3 top-3 text-slate-400 size-5" />
                  <textarea
                    {...form.register("bio")}
                    className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border resize-none"
                    placeholder="ex: Médica Cirurgiã, especialista em cirurgia plástica"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="px-8 py-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
