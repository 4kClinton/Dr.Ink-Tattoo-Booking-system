"use client";
import { AlertCircle } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "w-full rounded-md bg-surface border border-line text-fg placeholder:text-fg-3 transition-shadow duration-150 focus:border-line-strong focus:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40";

export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  errorId,
  hintId,
  optional,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  errorId?: string;
  hintId?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-label font-medium text-fg">
          {label}
          {optional && <span className="ml-1 font-normal text-fg-3">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-caption text-accent-fg" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-fg-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  prefix?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, optional, prefix, className, wrapperClassName, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-err`;
  const hintId = `${inputId}-hint`;
  return (
    <FieldShell label={label} htmlFor={inputId} hint={hint} error={error} errorId={errorId} hintId={hintId} optional={optional} className={wrapperClassName}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-fg-3 tabular">{prefix}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(inputBase, "h-12 px-4", prefix && "pl-[calc(1rem+var(--prefix-w,3.25ch)+0.5rem)]", error && "border-accent-fg", className)}
          style={prefix ? ({ "--prefix-w": `${prefix.length}ch` } as React.CSSProperties) : undefined}
          {...rest}
        />
      </div>
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, optional, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldShell label={label} htmlFor={inputId} hint={hint} error={error} errorId={`${inputId}-err`} hintId={`${inputId}-hint`} optional={optional}>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
        className={cn(inputBase, "min-h-24 px-4 py-3 leading-6", error && "border-accent-fg", className)}
        {...rest}
      />
    </FieldShell>
  );
});

export function Select({
  label,
  hint,
  error,
  optional,
  id,
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null; optional?: boolean }) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldShell label={label} htmlFor={inputId} hint={hint} error={error} optional={optional}>
      <select id={inputId} className={cn(inputBase, "h-12 appearance-none px-4", className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}
