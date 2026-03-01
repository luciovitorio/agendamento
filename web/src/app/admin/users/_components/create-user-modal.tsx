"use client";

import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Mail, Badge, Info, Stethoscope } from "lucide-react";

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
import { sendPasswordSetupEmail } from "@/app/actions/auth-actions";
import { toast } from "@/hooks/use-toast";

const createUserSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Endereço de e-mail inválido"),
  role: z.enum(["RECEPTIONIST", "ADMIN", "PROFESSIONAL"], {
    message: "Selecione um cargo",
  }),
  bio: z.string().optional(),
});

type CreateUserValues = z.infer<typeof createUserSchema>;

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserModal({ open, onOpenChange }: CreateUserModalProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "RECEPTIONIST",
      bio: "",
    },
  });

  const selectedRole = form.watch("role");

  const onSubmit = (data: CreateUserValues) => {
    startTransition(async () => {
      const res = await sendPasswordSetupEmail(
        data.email,
        data.name,
        data.role,
        data.bio,
      );

      if (res.success) {
        form.reset();
        onOpenChange(false);

        toast({
          title: "Usuário convidado!",
          description:
            "O convite foi enviado para o e-mail do usuário com sucesso.",
        });

        router.refresh();
      } else {
        form.setError("email", {
          type: "manual",
          message:
            (res as { error?: string }).error ||
            "Ocorreu um erro ao tentar criar o usuário.",
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
              Adicionar Novo Usuário
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Convide um novo membro da equipe para o sistema da clínica.
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

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Endereço de E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                <input
                  {...form.register("email")}
                  className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
                  placeholder="email@clinicadomain.com"
                  type="email"
                />
              </div>
              {form.formState.errors.email && (
                <span className="text-xs text-red-500 font-medium">
                  {form.formState.errors.email.message}
                </span>
              )}
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

            {/* Info Box */}
            <div className="bg-indigo-600/5 p-4 rounded-xl border border-indigo-600/10 flex items-start gap-3">
              <Info className="text-indigo-600 size-5 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed font-medium">
                O usuário receberá um convite automático por e-mail para definir
                sua senha e completar o registro. O acesso será concedido
                imediatamente após a ativação.
              </p>
            </div>
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
              className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPending ? "Convidando..." : "Criar Usuário & Convidar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
