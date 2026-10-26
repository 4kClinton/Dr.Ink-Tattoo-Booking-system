"use client";
import { formatAmount, parseKes } from "@drink/shared";
import { Input, type InputProps } from "./field";

/** KES prefix in --text-3, right-aligned, tabular, numeric keypad, live thousands separator. */
export function MoneyInput({
  value,
  onValueChange,
  ...rest
}: Omit<InputProps, "value" | "onChange" | "prefix"> & { value: number | null; onValueChange: (v: number | null) => void }) {
  return (
    <Input
      {...rest}
      prefix="KES"
      inputMode="numeric"
      autoComplete="off"
      className="text-right money"
      value={value === null ? "" : formatAmount(value)}
      onChange={(e) => onValueChange(parseKes(e.target.value))}
    />
  );
}

/** Tel keypad. Accepts 0712…, 712…, +254712…, or any +<country code> number — normalised server-side too. */
export function PhoneInput(props: Omit<InputProps, "prefix">) {
  return <Input {...props} inputMode="tel" autoComplete="tel" placeholder="0712 345 678 or +44…" />;
}
