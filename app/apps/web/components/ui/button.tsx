"use client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

/**
 * UI-UX-SPEC §4.1. Primary = brand red, one per screen. Danger-confirm is outlined red with a warning
 * icon and only appears inside confirmation sheets — destructive actions elsewhere are Secondary.
 */
const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:brightness-90 active:bg-accent-press",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-hover",
  ghost: "bg-transparent text-fg-2 hover:bg-hover hover:text-fg",
  danger: "bg-transparent text-accent-fg border border-accent-fg hover:bg-accent-subtle",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "tap relative inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 ease-out select-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "md" ? "h-12 px-5 text-[15px] lg:h-10" : "h-9 px-3 text-label",
        block && "w-full",
        variants[variant],
        className,
      )}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        {variant === "danger" && <AlertTriangle className="size-4" aria-hidden />}
        {children}
      </span>
      {loading && <Loader2 className="absolute size-5 animate-spin" aria-label="Loading" />}
    </button>
  );
});

export function LinkButton({
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("text-label font-semibold text-fg underline-offset-4 hover:underline disabled:opacity-40", className)}
      {...rest}
    />
  );
}
