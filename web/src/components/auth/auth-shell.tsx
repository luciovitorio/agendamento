import { ReactNode } from "react";
import { Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  cardClassName?: string;
  footer?: ReactNode;
  showPreviewImage?: boolean;
}

export function AuthShell({
  title,
  subtitle,
  children,
  cardClassName,
  footer,
  showPreviewImage = true,
}: AuthShellProps) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 min-h-screen flex items-center justify-center font-sans antialiased relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-6 py-12">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-600/20 mb-4 flex items-center justify-center">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight text-center">
            {title}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium text-center">
            {subtitle}
          </p>
        </div>

        <div
          className={cn(
            "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/40 dark:border-zinc-800/50 rounded-2xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)]",
            cardClassName,
          )}
        >
          {children}
        </div>

        {footer ? <div className="mt-10">{footer}</div> : null}
      </div>

      {showPreviewImage ? (
        <div className="hidden lg:block fixed right-12 bottom-12 w-64 h-64 opacity-20 group z-0">
          <div className="absolute inset-0 bg-indigo-600/20 rounded-full blur-3xl group-hover:bg-indigo-600/30 transition-all duration-700" />
          <div className="relative h-full w-full rounded-2xl overflow-hidden border border-white/20 dark:border-zinc-800/30 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Interior moderno de clínica"
              className="h-full w-full object-cover grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-1000"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD65Etrytb7DGcspK8WLt1pAqSxDsMXhLsGgZlXV2bsqYE1HML30L0NZaC9Lb_2k4MZej-k9Bf4F1t1t3q_hiYQ7lYJuMNWHhi__aeVrRoW0eHrumuxuTomcf4MiFW1UA66fGI6LCUG8MLUZYrdVrjKao3o71UC7TG1cJR4_OFmKFTPwq1TT3CNomMGcVV0Xyao7MGNxWdGmgePXFm-r0p8gp_2k545aQ1hlzOFjAB1eJX5NlejgpaO6zm4jjSHxmhBSpUgZB_GZOU"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
