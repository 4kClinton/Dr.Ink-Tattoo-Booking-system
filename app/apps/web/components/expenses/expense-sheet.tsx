"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { dateKeyEAT, EXPENSE_CATEGORIES, type ExpenseCategory, fromDateKey } from "@drink/shared";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Sheet } from "@/components/ui/sheet";
import { toAppError } from "@/lib/errors";

export interface ExpenseRow {
  _id: Id<"expenses">;
  category: string;
  amountKes: number;
  incurredAt: number;
  vendor: string | null;
  note: string | null;
  method: "mpesa" | "cash" | null;
}

/** Add or edit a studio expense (R-7). Pass `expense` to edit, omit to create. */
export function ExpenseSheet({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense?: ExpenseRow;
}) {
  const create = useMutation(api.expenses.create);
  const update = useMutation(api.expenses.update);
  const remove = useMutation(api.expenses.remove);

  const [category, setCategory] = useState<ExpenseCategory>((expense?.category as ExpenseCategory) ?? "supplies");
  const [amount, setAmount] = useState<number | null>(expense?.amountKes ?? null);
  const [dateKey, setDateKey] = useState(dateKeyEAT(expense?.incurredAt ?? Date.now()));
  const [method, setMethod] = useState<"" | "mpesa" | "cash">(expense?.method ?? "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  async function save() {
    if (!amount || amount <= 0) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        category,
        amountKes: amount,
        incurredAt: fromDateKey(dateKey),
        vendor: vendor.trim() || undefined,
        note: note.trim() || undefined,
        method: method || undefined,
      };
      if (expense) await update({ expenseId: expense._id, ...payload });
      else await create(payload);
      toast(expense ? "Expense updated" : "Expense added");
      onOpenChange(false);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!expense) return;
    setBusy(true);
    try {
      await remove({ expenseId: expense._id });
      toast("Expense deleted");
      onOpenChange(false);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? "Edit expense" : "Add expense"}
      footer={
        <div className="flex items-center gap-3">
          {expense && (
            <LinkButton onClick={onDelete} className="text-accent-fg">
              <Trash2 className="size-4" /> Delete
            </LinkButton>
          )}
          <Button variant="primary" block onClick={save} loading={busy}>
            {expense ? "Save changes" : "Add expense"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <MoneyInput
          label="Amount"
          value={amount}
          onValueChange={setAmount}
          error={showErrors && (!amount || amount <= 0) ? "Enter the amount in shillings" : null}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          <Select label="Paid by" optional value={method} onChange={(e) => setMethod(e.target.value as "" | "mpesa" | "cash")}>
            <option value="">Not set</option>
            <option value="mpesa">M-Pesa</option>
            <option value="cash">Cash</option>
          </Select>
        </div>
        <Input label="Vendor" optional value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Supplier or payee" />
        <Textarea label="Note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>
  );
}
