"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { deleteUserAction } from "@/app/actions/auth-actions";
import { toast } from "@/hooks/use-toast";

interface DeleteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
}

export function DeleteUserModal({
  open,
  onOpenChange,
  userName,
  userEmail,
}: DeleteUserModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteUserAction(userEmail);
      if (res.success) {
        toast({
          title: "Usuário excluído",
          description: `${userName} foi removido permanentemente do sistema.`,
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: "Erro",
          description: res.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
        <DialogHeader className="px-8 pt-8 pb-0 space-y-0">
          <div className="mx-auto size-14 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="size-7 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white text-center">
            Excluir Usuário
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-2 text-center">
            Tem certeza que deseja excluir{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {userName}
            </span>
            ? Esta ação é permanente e não poderá ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-6 flex flex-col gap-3">
          <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">
              ⚠️ Todos os dados associados a este usuário serão removidos
              permanentemente, incluindo acessos e registros do sistema.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-md shadow-red-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Sim, Excluir Permanentemente"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
