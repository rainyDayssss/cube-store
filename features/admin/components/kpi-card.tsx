import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">
          {label}
        </p>
        <span className="rounded-lg bg-muted p-1.5 sm:p-2">
          <Icon className="h-3.5 w-3.5 text-foreground sm:h-4 sm:w-4" />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight sm:mt-3 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
