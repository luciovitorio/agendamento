"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, Search, Stethoscope, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function getHeaderTitle(pathname: string, role?: string) {
  if (pathname === "/admin") {
    if (role === "DOUTOR") {
      return "Minha Agenda";
    }
    return "Dashboard da Clínica";
  }

  if (pathname.startsWith("/admin/appointments")) {
    return "Agendamentos";
  }

  if (pathname.startsWith("/admin/schedules")) {
    return "Horários";
  }

  if (pathname.startsWith("/admin/patients")) {
    return "Pacientes";
  }

  if (pathname.startsWith("/admin/plans")) {
    return "Planos";
  }

  if (pathname.startsWith("/admin/users")) {
    return "Usuários";
  }

  if (pathname.startsWith("/admin/settings")) {
    return "Configurações";
  }

  if (pathname.startsWith("/admin/reports")) {
    return "Relatórios";
  }

  if (pathname.startsWith("/admin/search")) {
    return "Busca Inteligente";
  }

  if (pathname.startsWith("/admin/handoff")) {
    return "Handoff Humano";
  }

  return "Dashboard";
}

type SearchEntityType = "PATIENT" | "PROFESSIONAL";

interface SearchResult {
  id: string;
  type: SearchEntityType;
  name: string;
  subtitle: string;
}

function HeaderSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let isStale = false;
    setIsLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/search?q=${encodeURIComponent(normalizedQuery)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Falha ao buscar");
        }

        const payload = (await response.json()) as { items?: SearchResult[] };
        if (!isStale) {
          setResults(payload.items || []);
        }
      } catch (error) {
        if (!isStale) {
          setResults([]);
        }
      } finally {
        if (!isStale) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      isStale = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const hasDropdown = isOpen && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5">
        <Search className="size-5 text-slate-400" />
        <input
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-slate-500 text-slate-900 dark:text-white ml-2 outline-none"
          placeholder="Buscar pacientes ou médicos..."
          type="text"
        />
      </div>

      {hasDropdown ? (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-slate-500">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">
              Nenhum paciente ou médico encontrado.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
                    const type = result.type === "PATIENT" ? "patient" : "professional";
                    router.push(`/admin/search?type=${type}&id=${result.id}`);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {result.type === "PATIENT" ? (
                      <UserRound className="size-4 text-indigo-500" />
                    ) : (
                      <Stethoscope className="size-4 text-emerald-500" />
                    )}
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {result.name}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{result.subtitle}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AdminHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [now, setNow] = useState(() => new Date());
  const userRole = session?.user?.role;
  const title = getHeaderTitle(pathname, userRole);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const formattedDate = useMemo(
    () => format(now, "EEEE, dd 'de' MMMM", { locale: ptBR }),
    [now],
  );
  const formattedTime = useMemo(() => format(now, "HH:mm:ss"), [now]);

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shrink-0">
      <div className="flex items-center gap-4 w-full max-w-2xl">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white hidden sm:block">
          {title}
        </h1>
        <div className="ml-0 sm:ml-8 flex-1">
          <HeaderSearch />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-3 py-2 min-w-[240px]">
          <CalendarDays className="size-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">
            {formattedDate}
          </span>
          <span className="text-slate-300 dark:text-zinc-600">•</span>
          <Clock3 className="size-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
            {formattedTime}
          </span>
        </div>
        <div className="w-12">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
