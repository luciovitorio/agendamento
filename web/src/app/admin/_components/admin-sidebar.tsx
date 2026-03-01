"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Stethoscope,
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  FileText,
  Users,
  UserRound,
  MessageSquare,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";

export function AdminSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [handoffCount, setHandoffCount] = useState(0);
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (!userRole || !["ADMIN", "ATENDENTE"].includes(userRole)) {
      setHandoffCount(0);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadHandoffCount = async () => {
      try {
        const response = await fetch("/api/admin/handoff/count", {
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { count?: number };
        if (!active) return;

        const nextCount =
          typeof payload.count === "number" && payload.count >= 0
            ? payload.count
            : 0;
        setHandoffCount(nextCount);
      } catch {
        // Silent: badge can remain with last known value.
      }
    };

    void loadHandoffCount();
    timer = setInterval(loadHandoffCount, 30000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [pathname, userRole]);

  const isActivePath = (href: string) => {
    if (href === "/admin") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const allLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    {
      href: "/admin/schedules",
      label: "Horários",
      icon: CalendarDays,
      roles: ["ADMIN", "DOUTOR"],
    },
    { href: "/admin/appointments", label: "Agendamentos", icon: ClipboardList },
    {
      href: "/admin/reports",
      label: "Relatórios",
      icon: FileText,
      roles: ["ADMIN", "ATENDENTE", "DOUTOR"],
    },
    {
      href: "/admin/patients",
      label: "Pacientes",
      icon: UserRound,
      roles: ["ADMIN", "ATENDENTE", "DOUTOR"],
    },
    {
      href: "/admin/handoff",
      label: "Handoff",
      icon: MessageSquare,
      roles: ["ADMIN", "ATENDENTE"],
      badgeCount: handoffCount,
    },
    {
      href: "/admin/plans",
      label: "Planos",
      icon: ShieldCheck,
      roles: ["ADMIN"],
    },
    { href: "/admin/users", label: "Usuários", icon: Users, roles: ["ADMIN"] },
  ];

  const links = allLinks.filter(
    (link) => !link.roles || link.roles.includes(userRole),
  );
  const canAccessSettings = ["ADMIN", "DOUTOR"].includes(userRole);

  return (
    <aside
      className={cn(
        "flex flex-col items-center py-8 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-300 relative",
        isExpanded ? "w-64 items-stretch px-4" : "w-20",
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors z-20 text-slate-500"
      >
        {isExpanded ? (
          <ChevronLeft className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>

      <div
        className={cn(
          "mb-10 text-indigo-600",
          isExpanded ? "pl-2 flex items-center gap-3" : "",
        )}
      >
        <Stethoscope className="size-10" />
        {isExpanded && (
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
            Clínica Admin
          </span>
        )}
      </div>

      <nav className="flex flex-col gap-4 flex-1 w-full">
        {links.map((link) => {
          const isActive = isActivePath(link.href);
          const Icon = link.icon;
          const badgeCount =
            typeof link.badgeCount === "number" ? link.badgeCount : 0;
          const shouldShowBadge = badgeCount > 0;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "group relative flex items-center p-3 rounded-xl transition-colors",
                isExpanded ? "justify-start gap-4 px-4" : "justify-center",
                isActive
                  ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-medium"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800",
              )}
            >
              <Icon className="size-6 shrink-0" />

              {isExpanded ? (
                <>
                  <span className="whitespace-nowrap">{link.label}</span>
                  {shouldShowBadge ? (
                    <span className="ml-auto inline-flex items-center justify-center min-w-6 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    {link.label}
                  </span>
                  {shouldShowBadge ? (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4 w-full">
        {canAccessSettings ? (
          <Link
            href="/admin/settings"
            className={cn(
              "group relative flex items-center p-3 rounded-xl transition-colors",
              isExpanded ? "justify-start gap-4 px-4" : "justify-center",
              isActivePath("/admin/settings")
                ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-medium"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800",
            )}
          >
            <Settings className="size-6 shrink-0" />
            {isExpanded ? (
              <span className="whitespace-nowrap">Configurações</span>
            ) : (
              <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Configurações
              </span>
            )}
          </Link>
        ) : null}

        <div
          className={cn(
            "flex flex-col gap-4 pt-4 border-t border-slate-200 dark:border-zinc-800",
            isExpanded ? "px-2" : "",
          )}
        >
          {isExpanded && session?.user ? (
            <div className="flex items-center gap-3 mb-2">
              <div className="size-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                {session.user.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-slate-900 dark:text-white">
                  {session.user.name || "Usuário"}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {session.user.email || ""}
                </p>
              </div>
            </div>
          ) : !isExpanded && session?.user ? (
            <div className="flex justify-center mb-2">
              <div className="size-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                {session.user.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?"}
              </div>
            </div>
          ) : null}

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "group relative flex items-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-3 rounded-xl transition-colors",
              isExpanded ? "justify-start gap-4 px-4" : "justify-center",
            )}
          >
            <LogOut className="size-6 shrink-0" />
            {isExpanded ? (
              <span className="whitespace-nowrap">Sair</span>
            ) : (
              <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Sair
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
