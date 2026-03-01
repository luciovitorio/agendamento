import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarCheck, CheckCircle2 } from "lucide-react";

export interface ActivityFeedItem {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  type: "info" | "success" | "warning";
}

interface ActivityFeedProps {
  items: ActivityFeedItem[];
  title?: string;
  emptyMessage?: string;
}

function getActivityIcon(type: ActivityFeedItem["type"]) {
  if (type === "success") {
    return {
      icon: CheckCircle2,
      color:
        "bg-emerald-500/10 text-emerald-500 border border-white dark:border-zinc-900",
    };
  }
  if (type === "warning") {
    return {
      icon: AlertTriangle,
      color:
        "bg-amber-500/10 text-amber-500 border border-white dark:border-zinc-900",
    };
  }
  return {
    icon: CalendarCheck,
    color:
      "bg-indigo-600/10 text-indigo-600 border border-white dark:border-zinc-900",
  };
}

export function ActivityFeed({
  items,
  title = "Feed de Atividade",
  emptyMessage = "Sem atividades recentes.",
}: ActivityFeedProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex-1 flex flex-col h-full overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">
            {title}
          </h2>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">{emptyMessage}</p>
          ) : (
            items.map((item, index) => {
              const { icon: Icon, color } = getActivityIcon(item.type);
              const isLast = index === items.length - 1;

              return (
                <div key={item.id} className="flex gap-4 relative">
                  {!isLast ? (
                    <div className="absolute left-[15px] top-[32px] w-[2px] h-[calc(100%+8px)] bg-slate-100 dark:bg-zinc-800" />
                  ) : null}
                  <div
                    className={`size-8 rounded-full flex items-center justify-center shrink-0 z-10 ${color}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-slate-900 dark:text-white font-medium">
                      {item.title}
                    </p>
                    {item.description ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    ) : null}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDistanceToNow(item.createdAt, {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
