"use client";
import { api } from "@drink/backend/api";
import { addDaysEAT, dateKeyEAT, formatEAT, formatKes, fromDateKey, startOfDayEAT, toEAT } from "@drink/shared";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ExpenseSheet, type ExpenseRow } from "@/components/expenses/expense-sheet";
import { useCan } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Empty, PageTitle, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";

type Period = "week" | "month" | "custom";

function periodRange(p: Period, custom: { from: string; to: string }) {
  const today = startOfDayEAT(Date.now());
  if (p === "week") {
    const mon = addDaysEAT(today, -((toEAT(today).weekday + 6) % 7));
    return { from: mon, to: addDaysEAT(mon, 7) };
  }
  if (p === "month") {
    const t = toEAT(today);
    const from = fromDateKey(`${t.year}-${String(t.month).padStart(2, "0")}-01`);
    const nm = t.month === 12 ? `${t.year + 1}-01-01` : `${t.year}-${String(t.month + 1).padStart(2, "0")}-01`;
    return { from, to: fromDateKey(nm) };
  }
  return { from: fromDateKey(custom.from), to: addDaysEAT(fromDateKey(custom.to), 1) };
}

export default function ExpensesPage() {
  const canManage = useCan("expenses.manage");
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState(() => ({
    from: dateKeyEAT(addDaysEAT(Date.now(), -90)),
    to: dateKeyEAT(Date.now()),
  }));
  const { from, to } = useMemo(() => periodRange(period, custom), [period, custom]);
  const data = useQuery(api.expenses.list, canManage && from < to ? { from, to } : "skip");
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);

  function openSheet(row: ExpenseRow | null) {
    setEditing(row);
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  }

  if (!canManage) return <Empty text="You don't have access to expenses. Ask the artist to turn it on." />;

  const max = Math.max(1, ...(data?.byCategory ?? []).map((c) => c.amountKes));

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <PageTitle>Expenses</PageTitle>
        </div>
        <Button variant="primary" onClick={() => openSheet(null)} className="ml-auto">
          <Plus className="size-4" /> Add expense
        </Button>
      </div>

      <Segmented
        label="Period"
        value={period}
        onChange={setPeriod}
        className="mb-4 max-w-[420px]"
        options={[
          { value: "week", label: "This week" },
          { value: "month", label: "This month" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {period === "custom" && (
        <div className="mb-4 grid max-w-[420px] grid-cols-2 gap-3">
          <Input label="From" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <Input label="To" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
        </div>
      )}

      {!data ? (
        <Skeleton className="h-24" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
              <p className="text-caption text-fg-2">Total spent</p>
              <p className="money mt-1 text-heading">{formatKes(data.total)}</p>
              <p className="mt-0.5 text-caption text-fg-3">{data.rows.length} expense{data.rows.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          {data.byCategory.length > 0 && (
            <Card className="mt-6">
              <SectionLabel className="mb-3">By category</SectionLabel>
              <ul className="flex flex-col gap-3">
                {data.byCategory.map((c) => (
                  <li key={c.key}>
                    <div className="flex justify-between text-label">
                      <span>{c.label}</span>
                      <span className="money text-fg">{formatKes(c.amountKes)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-hover">
                      <div className="h-full rounded-full bg-fg-2" style={{ width: `${(c.amountKes / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="mt-6">
            <SectionLabel className="mb-3">Expenses</SectionLabel>
            {data.rows.length === 0 ? (
              <Empty text="No expenses in this period." />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {data.rows.map((e) => (
                  <li key={e._id}>
                    <button
                      onClick={() => openSheet(e)}
                      className="tap flex w-full items-start justify-between gap-3 py-3 text-left hover:bg-hover"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{e.categoryLabel}</p>
                        <p className="truncate text-label text-fg-2">
                          <span className="tabular">{formatEAT(e.incurredAt, "d MMM")}</span>
                          {e.linkedClient && <> · {e.linkedClient}</>}
                          {e.vendor && <> · {e.vendor}</>}
                          {e.method && <> · {e.method === "mpesa" ? "M-Pesa" : "Cash"}</>}
                          {e.note && <> · {e.note}</>}
                        </p>
                      </div>
                      <span className="money shrink-0 text-fg">{formatKes(e.amountKes)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <ExpenseSheet key={sheetKey} open={sheetOpen} onOpenChange={setSheetOpen} expense={editing ?? undefined} />
    </div>
  );
}
