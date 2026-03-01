import { ResetPasswordForm } from "./_components/reset-password-form";
import { LinkExpired } from "./_components/link-expired";
import { verifyPasswordResetToken } from "@/lib/password-reset-token";
import { Stethoscope } from "lucide-react";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  let isExpired = false;

  if (token) {
    const verification = verifyPasswordResetToken(token);
    if (!verification.valid || !verification.payload) {
      isExpired = true;
    } else {
      const { payload } = verification;
      const user = await prisma.user.findUnique({
        where: { email: payload.sub },
        select: { status: true, updatedAt: true },
      });

      if (!user || user.status === "BLOCKED") {
        isExpired = true;
      } else if (user.updatedAt.getTime() !== payload.uv) {
        isExpired = true;
      } else if (payload.purpose === "setup" && user.status !== "PENDING") {
        isExpired = true;
      } else if (
        payload.purpose === "recovery" &&
        user.status !== "ACTIVE"
      ) {
        isExpired = true;
      }
    }
  } else {
    isExpired = true;
  }

  if (isExpired) {
    return <LinkExpired />;
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 min-h-screen flex items-center justify-center font-sans antialiased relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-6 py-12">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-600/20 mb-4 flex items-center justify-center">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight text-center">
            Defina sua nova senha
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium text-center">
            Por favor, insira e confirme sua nova senha de acesso
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-xl">
          <Suspense
            fallback={
              <div className="h-64 flex items-center justify-center text-slate-400">
                Carregando...
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
