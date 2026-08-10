"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Package,
  Truck,
  Clock3,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { OrderStatus } from "@/features/tracking/lib/tracking";
import { LIFECYCLE } from "@/features/tracking/lib/tracking";

const STEP_ICONS: Record<string, LucideIcon> = {
  pending: Clock3,
  confirmed: CheckCircle2,
  preparing: Package,
  shipped: Truck,
  completed: CheckCircle2,
};

const STEP_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  shipped: "Shipped",
  completed: "Done",
};

const STEP_LABELS_FULL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  shipped: "Shipped",
  completed: "Completed",
};

export function OrderStatusBar({ status }: { status: OrderStatus }) {
  const cancelled = status === "cancelled";
  const currentIndex = LIFECYCLE.indexOf(
    status as (typeof LIFECYCLE)[number],
  );

  if (cancelled) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-destructive sm:h-6 sm:w-6" />
          <div>
            <p className="text-sm font-semibold text-destructive sm:text-base">Order cancelled</p>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              This order has been cancelled and will not be fulfilled.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 sm:gap-2">
      {LIFECYCLE.map((step, index) => {
        const Icon = STEP_ICONS[step];
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1 sm:gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors sm:h-10 sm:w-10",
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground",
                  isCurrent && "ring-2 ring-primary/30",
                )}
              >
                <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
              {/* Short label on mobile, full label on desktop */}
              <span
                className={cn(
                  "text-[9px] font-medium leading-tight sm:text-xs",
                  isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <span className="sm:hidden">{STEP_LABELS[step]}</span>
                <span className="hidden sm:inline">{STEP_LABELS_FULL[step]}</span>
              </span>
            </div>
            {index < LIFECYCLE.length - 1 && (
              <div
                className={cn(
                  "mx-0.5 h-0.5 flex-1 rounded-full sm:mx-2",
                  index < currentIndex
                    ? "bg-primary"
                    : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
