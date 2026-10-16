"use client";
import { api } from "@drink/backend/api";
import { dateKeyEAT, fromDateKey } from "@drink/shared";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { MoneyInput, PhoneInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { toAppError } from "@/lib/errors";

const emptyClient = { fullName: "", phone: "", email: "", instagram: "", dateOfBirth: "", notes: "" };
const emptyPay = { method: "cash" as "cash" | "mpesa", amountKes: null as number | null, mpesaCode: "", date: dateKeyEAT(Date.now()) };

export function AddClientSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useMutation(api.clients.create);
  const router = useRouter();
  const canPay = useCan("payments.record");
  const [f, setF] = useState(emptyClient);
  const [addPay, setAddPay] = useState(false);
  const [pay, setPay] = useState(emptyPay);
  const [busy, setBusy] = useState(false);

  function reset() {
    setF(emptyClient);
    setAddPay(false);
    setPay({ ...emptyPay, date: dateKeyEAT(Date.now()) });
  }

  async function submit() {
    setBusy(true);
    try {
      const pastPayment =
        addPay && pay.amountKes
          ? {
              method: pay.method,
              amountKes: pay.amountKes,
              mpesaCode: pay.method === "mpesa" ? pay.mpesaCode.trim().toUpperCase() : undefined,
              paidAt: fromDateKey(pay.date),
            }
          : undefined;
      const id = await create({
        fullName: f.fullName,
        phone: f.phone,
        email: f.email || undefined,
        instagram: f.instagram || undefined,
        dateOfBirth: f.dateOfBirth || undefined,
        notes: f.notes || undefined,
        pastPayment,
      });
      toast("Client added");
      onOpenChange(false);
      reset();
      router.push(`/clients/${id}`);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title="Add client"
      description="Create a client record. You can also log a payment they already made."
      footer={
        <Button variant="primary" block loading={busy} disabled={!f.fullName.trim() || !f.phone.trim()} onClick={submit}>
          Add client
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
        <PhoneInput label="Mobile" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input label="Email" optional type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Instagram" optional prefix="@" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} />
        <Input label="Date of birth" optional type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} />
        <Textarea label="Notes" optional rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />

        {canPay && (
          <div className="rounded-md border border-line p-3">
            <label className="flex items-center gap-2 text-label font-medium">
              <input
                type="checkbox"
                className="size-4 accent-[var(--text)]"
                checked={addPay}
                onChange={(e) => setAddPay(e.target.checked)}
              />
              Record a past payment
            </label>
            {addPay && (
              <div className="mt-3 flex flex-col gap-3">
                <Segmented
                  label="Method"
                  value={pay.method}
                  onChange={(method) => setPay({ ...pay, method })}
                  options={[
                    { value: "mpesa", label: "M-Pesa" },
                    { value: "cash", label: "Cash" },
                  ]}
                />
                <MoneyInput label="Amount" value={pay.amountKes} onValueChange={(v) => setPay({ ...pay, amountKes: v })} />
                {pay.method === "mpesa" && (
                  <Input
                    label="M-Pesa code"
                    value={pay.mpesaCode}
                    onChange={(e) => setPay({ ...pay, mpesaCode: e.target.value })}
                    className="tracking-wide uppercase"
                  />
                )}
                <Input label="Date paid" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
