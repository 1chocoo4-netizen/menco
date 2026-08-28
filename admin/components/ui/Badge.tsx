import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeTone = "neutral" | "positive" | "negative" | "accent";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-white/8 text-white/80 border-white/10",
  positive: "bg-positive/15 text-positive border-positive/30",
  negative: "bg-negative/15 text-negative border-negative/30",
  accent: "bg-accent/15 text-accent border-accent/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
