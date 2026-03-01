import { Shield, ShieldCheck } from "lucide-react";
import { ForgotPasswordForm } from "./_components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-800 sm:py-14">
      <div className="mx-auto flex w-full max-w-[430px] flex-col items-center">
        <section className="w-full overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
          <div className="relative h-24 bg-[#eeefff]">
            <div className="absolute left-1/2 top-full flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-indigo-600 shadow-[0_10px_20px_rgba(15,23,42,0.12)]">
              <Shield className="h-7 w-7" />
            </div>
          </div>

          <div className="px-8 pb-8 pt-12">
            <h1 className="text-center text-[42px] font-bold leading-none tracking-tight text-slate-900 sm:text-[34px]">
              Esqueceu sua senha?
            </h1>
            <p className="mx-auto mt-4 max-w-72.5 text-center text-[15px] leading-[1.45] text-slate-500">
              Digite seu e-mail cadastrado para receber um link de redefinição
              seguro.
            </p>

            <div className="mt-8">
              <ForgotPasswordForm />
            </div>
          </div>
        </section>

        <p className="mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Segurança de nível hospitalar
        </p>

        <div className="mt-3 flex items-center gap-6 text-[11px] font-semibold text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            HIPAA COMPLIANT
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            SSL ENCRYPTED
          </span>
        </div>

        <p className="mt-20 text-center text-xs text-slate-500">
          © 2024 Clinic OS. Todos os direitos reservados.
        </p>
      </div>
    </main>
  );
}
