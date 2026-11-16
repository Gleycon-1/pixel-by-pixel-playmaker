import { Check } from "lucide-react";
import { STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const DELIVERY_STEPS = ["received", "preparing", "out_for_delivery", "delivered"];
const PICKUP_STEPS = ["received", "preparing", "ready_for_pickup", "delivered"];

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "delivered"
      ? "bg-success text-success-foreground"
      : status === "cancelled"
        ? "bg-destructive text-destructive-foreground"
        : status === "awaiting_payment"
          ? "bg-warning text-warning-foreground"
          : "bg-primary text-primary-foreground";
  return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase", tone)}>{STATUS_LABEL[status] ?? status}</span>;
}

export function StatusTimeline({ status, fulfillment }: { status: string; fulfillment: "delivery" | "pickup" }) {
  const steps = fulfillment === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
  const idx = steps.indexOf(status);
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const done = idx >= i;
        const current = idx === i && status !== "delivered";
        return (
          <li key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold",
                  done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                  current && "animate-pulse",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              {i < steps.length - 1 && <span className={cn("h-6 w-0.5", idx > i ? "bg-primary" : "bg-border")} />}
            </div>
            <p className={cn("pt-1.5 text-sm", done ? "font-bold" : "text-muted-foreground")}>{STATUS_LABEL[s]}</p>
          </li>
        );
      })}
    </ol>
  );
}
