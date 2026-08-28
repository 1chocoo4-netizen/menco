import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline";

const variantClasses: Record<Variant, string> = {
  primary: "bg-gradient-to-br from-accent to-accent2 text-white hover:opacity-90",
  ghost: "bg-transparent text-white/70 hover:bg-white/5 hover:text-white",
  outline: "border border-border bg-transparent text-white/80 hover:bg-white/5",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
