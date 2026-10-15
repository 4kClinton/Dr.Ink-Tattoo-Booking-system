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

/** Fixed +254 prefix, tel keypad. Accepts 0712…, 712…, +254712… — normalised server-side too. */
export function PhoneInput(props: Omit<InputProps, "prefix">) {
  return <Input {...props} prefix="+254" inputMode="tel" autoComplete="tel" placeholder="712 345 678" />;
}
