import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/features/admin/lib/orders/orders";
import { cn } from "@/lib/utils";

/** Shared tone per status so the list and detail views can never drift apart. */
export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  confirmed: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  preparing: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  shipped: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        ORDER_STATUS_BADGE_CLASSES[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
