import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trendValue?: string;
  trendDirection?: "up" | "down";
  colorClass: "emerald" | "primary" | "orange" | "indigo" | "red";
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trendValue,
  trendDirection,
  colorClass,
}: StatCardProps) {
  // Custom mapping to preserve the exact Tailwind arbitrary colors
  const colorMap = {
    emerald: "bg-emerald-500/10 text-emerald-500",
    primary: "bg-indigo-600/10 text-indigo-600",
    orange: "bg-orange-500/10 text-orange-500",
    indigo: "bg-indigo-500/10 text-indigo-500",
    red: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${colorMap[colorClass]}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
          {value}
        </h3>
        {trendValue && (
          <span
            className={`${trendDirection === "down" ? "text-orange-500" : "text-emerald-500"} text-xs font-bold flex items-center`}
          >
            {trendDirection === "up" ? "↑" : "↓"} {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
