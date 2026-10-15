"use client";
import { api } from "@drink/backend/api";
import { formatEAT, formatKes, isValidMpesaCode, normalizeMpesaCode, parseMpesa } from "@drink/shared";
import { useQuery } from "convex/react";
import { AlertCircle, CheckCircle2, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { useDebounced } from "@/lib/hooks";

export interface PaymentValue {
  method: "mpesa" | "cash";
  amountKes: number;
  mpesaCode?: string;
  mpesaRawMessage?: string;
  payerName?: string;
  payerPhone?: string;
  paidAt?: number;
}

export interface PaymentState {
  value: PaymentValue | null; // null = incomplete
  blocking: string | null; // reason the user can't continue
}

const SAMPLE = "TJ4AB12XYZ Confirmed. You have received Ksh3,000.00 from JOHN DOE 0712345678 on 14/10/26 at 3:41 PM…";

/**
 * Paste-to-parse (P-3/P-4). The manager pastes the M-Pesa SMS received on OUR line; we extract
 * code, amount, payer and time, compare against what's required, and check the code is unused.
 * Parsing never blocks: if it fails, code + amount fields appear.
 */
export function MpesaPaste({
  requiredKes,
  balanceKes,
  defaultAmount,
  onChange,
  amountLabel = "Amount",
}: {
  /** Deposit mode: anything below this blocks continue (B-4). */
  requiredKes: number;
  /** Balance mode: part-payments allowed; shows what's still due. */
  balanceKes?: number;
  defaultAmount?: number;
  onChange: (s: PaymentState) => void;
  amountLabel?: string;
}) {
  const balanceMode = balanceKes !== undefined;
  const [method, setMethod] = useState<"mpesa" | "cash">("mpesa");
  const [raw, setRaw] = useState("");
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState<number | null>(defaultAmount ?? null);
  const parsed = useMemo(() => (raw.trim() ? parseMpesa(raw) : null), [raw]);
  const parseFailed = raw.trim().length > 20 && !parsed;
  const showManual = manual || parseFailed;

  const effectiveCode = method === "mpesa" ? (parsed?.code ?? (showManual ? normalizeMpesaCode(code) : "")) : "";
  const effectiveAmount = method === "cash" ? amount : (parsed?.amountKes ?? (showManual ? amount : null));
  const debouncedCode = useDebounced(effectiveCode, 250);
  const dup = useQuery(api.payments.checkMpesaCode, isValidMpesaCode(debouncedCode) ? { code: debouncedCode } : "skip");

  useEffect(() => {
    let blocking: string | null = null;
    let value: PaymentValue | null = null;
    if (method === "mpesa" && !effectiveCode) blocking = "Paste the M-Pesa message.";
    else if (method === "mpesa" && !isValidMpesaCode(effectiveCode)) blocking = "M-Pesa codes are 10 letters and numbers.";
    else if (method === "mpesa" && dup) blocking = "This M-Pesa code is already recorded.";
    else if (!effectiveAmount) blocking = "Enter the amount received.";
    else if (!balanceMode && effectiveAmount < requiredKes) blocking = `${formatKes(requiredKes - effectiveAmount)} short.`;
    if (!blocking && effectiveAmount) {
      value =
        method === "cash"
          ? { method, amountKes: effectiveAmount }
          : {
              method,
              amountKes: effectiveAmount,
              mpesaCode: effectiveCode,
              mpesaRawMessage: raw.trim() || undefined,
              payerName: parsed?.payerName,
              payerPhone: parsed?.payerPhone,
              paidAt: parsed?.paidAt,
            };
    }
    onChange({ value, blocking });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, effectiveCode, effectiveAmount, dup, requiredKes, raw, parsed, balanceMode]);

  const short = !balanceMode && effectiveAmount !== null && effectiveAmount !== undefined && effectiveAmount < requiredKes;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Payment method"
        value={method}
        onChange={setMethod}
        options={[
          { value: "mpesa", label: "M-Pesa" },
          { value: "cash", label: "Cash" },
        ]}
      />

      {method === "mpesa" ? (
        <>
          <Textarea
            label="Paste the M-Pesa message you received"
            placeholder={SAMPLE}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
            autoFocus
            spellCheck={false}
          />
          {parsed && (
            <div className="pop-in flex items-start gap-3 rounded-md border border-line bg-elevated p-4" aria-live="polite">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold tabular tracking-wide">{parsed.code}</p>
                <p className="text-label text-fg-2">
                  <span className="money text-fg">{formatKes(parsed.amountKes)}</span>
                  {parsed.payerName && <> from {parsed.payerName}</>}
                  {parsed.paidAt && <> · {formatEAT(parsed.paidAt, "d MMM, h:mm a")}</>}
                </p>
              </div>
            </div>
          )}
          {parseFailed && !manual && (
            <p className="flex items-start gap-2 text-label text-accent-fg" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Couldn&apos;t read that message. Enter details manually.
            </p>
          )}
          {!parsed && !showManual && (
            <button type="button" className="self-start text-label font-semibold underline-offset-4 hover:underline" onClick={() => setManual(true)}>
              Enter code manually
            </button>
          )}
          {showManual && !parsed && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="M-Pesa code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={10}
                autoCapitalize="characters"
                autoComplete="off"
                className="tracking-wider uppercase"
                error={code.length === 10 && !isValidMpesaCode(code) ? "10 letters and numbers" : null}
              />
              <MoneyInput label={amountLabel} value={amount} onValueChange={setAmount} />
            </div>
          )}
        </>
      ) : (
        <MoneyInput label={amountLabel} value={amount} onValueChange={setAmount} autoFocus />
      )}

      {dup && (
        <p className="flex items-start gap-2 text-label text-accent-fg" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            This M-Pesa code is already recorded on {dup.clientName}&apos;s booking ({dup.bookingDate}).{" "}
            <Link href={`/bookings/${dup.bookingId}`} className="font-semibold underline underline-offset-4">
              View booking
            </Link>
          </span>
        </p>
      )}
      {effectiveAmount && balanceMode ? (
        effectiveAmount >= balanceKes! ? (
          <p className="flex items-center gap-2 text-label font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Clears the balance
            {effectiveAmount > balanceKes! && <> ({formatKes(effectiveAmount - balanceKes!)} over)</>}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-label font-medium text-warning">
            <Wallet className="size-4" aria-hidden /> {formatKes(balanceKes! - effectiveAmount)} still due after this
          </p>
        )
      ) : effectiveAmount ? (
        short ? (
          <p className="flex items-center gap-2 text-label font-medium text-warning">
            <Wallet className="size-4" aria-hidden /> {formatKes(requiredKes - effectiveAmount)} short of {formatKes(requiredKes)}
          </p>
        ) : (
          requiredKes > 0 && (
            <p className="flex items-center gap-2 text-label font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Covers the {formatKes(requiredKes)} required
            </p>
          )
        )
      ) : null}
    </div>
  );
}
