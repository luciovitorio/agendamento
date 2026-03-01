import { LoginForm } from "./_components/login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell
      title="Clínica OS"
      subtitle="Bem-vindo de volta ao seu espaço"
      footer={
        <div className="flex justify-center space-x-6 text-xs font-medium text-zinc-400 uppercase tracking-widest">
          <a
            className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            href="#"
          >
            Suporte
          </a>
          <span>•</span>
          <a
            className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            href="#"
          >
            Privacidade
          </a>
          <span>•</span>
          <a
            className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            href="#"
          >
            Termos
          </a>
        </div>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
