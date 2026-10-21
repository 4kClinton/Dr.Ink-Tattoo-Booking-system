"use client";
import { api } from "@drink/backend/api";
import { addDaysEAT, dateKeyEAT, formatEAT, formatKes, fromDateKey, startOfDayEAT, toEAT } from "@drink/shared";
import { useConvex, useQuery } from "convex/react";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Empty, PageTitle, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { downloadCsv } from "@/lib/csv";

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

export default function ReportsPage() {
  const canView = useCan("reports.view");
  const canExport = useCan("exports.csv");
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState(() => ({
    from: dateKeyEAT(addDaysEAT(Date.now(), -90)),
    to: dateKeyEAT(Date.now()),
  }));
  const { from, to } = useMemo(() => periodRange(period, custom), [period, custom]);
  const data = useQuery(api.reports.summary, canView && from < to ? { from, to } : "skip");
  const lifetime = useQuery(api.reports.lifetime, canView ? {} : "skip");
  const convex = useConvex();
  const [exporting, setExporting] = useState<string | null>(null);

  // §9: permission-limited — the manager sees nothing here, not disabled ghosts.
  if (!canView) return <Empty text="You don't have access to reports. Ask the artist to turn it on." />;

  async function exportCsv(kind: "clients" | "bookings" | "payments" | "expenses") {
    setExporting(kind);
    try {
      const rows = await convex.query(api.exports.rows, { kind });
      if (!rows.length) return toast(`No ${kind} to export yet.`);
      downloadCsv(`drink-${kind}-${dateKeyEAT(Date.now())}.csv`, rows as Record<string, unknown>[]);
      toast(`${rows.length} ${kind} exported`);
    } finally {
      setExporting(null);
    }
  }

  const maxWeek = Math.max(1, ...(data?.weeks ?? []).map((w) => w.deposits + Math.max(0, w.balances)));

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="hidden lg:block">
        <PageTitle>Reports</PageTitle>
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Collected" value={formatKes(data.collected)} sub={`${formatKes(data.deposits)} deposits`} />
            <Tile label="Outstanding" value={formatKes(data.outstanding)} sub="on confirmed sessions" warn={data.outstanding > 0} />
            <Tile label="Sessions completed" value={String(data.sessionsCompleted)} sub={`${data.sessionsBooked} booked`} />
            <Tile
              label="No-show rate"
              value={`${Math.round(data.noShowRate * 100)}%`}
              sub={`${data.noShows} no-show · ${data.cancellations} cancelled`}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Net profit"
              value={formatKes(data.netProfit)}
              sub={`${Math.round(data.profitMargin * 100)}% margin · ${formatKes(data.expensesTotal)} costs`}
              warn={data.netProfit < 0}
            />
            <Tile label="Avg order value" value={formatKes(data.avgOrderValue)} sub={`${data.sessionsCompleted} completed`} />
            <Tile label="Revenue / hour" value={formatKes(data.revenuePerHour)} sub="chair time, completed" />
            <Tile label="New clients" value={String(data.newClients)} sub="first seen this period" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Tattoos done" value={String(data.tattoosDone)} sub={`${data.sessionsCompleted} sessions completed`} />
            <Tile label="Avg price / tattoo" value={formatKes(data.avgPricePerTattoo)} sub="revenue ÷ tattoos done" />
            <Tile label="Leads value" value={formatKes(data.leadsValue)} sub={`${data.leadsCount} open lead${data.leadsCount === 1 ? "" : "s"}`} />
          </div>

          <Card className="mt-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <SectionLabel>Collected per week</SectionLabel>
              <div className="flex items-center gap-4 text-caption text-fg-2">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-fg" aria-hidden /> Deposits
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-fg-3" aria-hidden /> Balances
                </span>
              </div>
            </div>
            <div className="flex h-48 items-end gap-2 overflow-x-auto" role="img" aria-label="Stacked bar chart of deposits and balances collected per week">
              {data.weeks.map((w) => {
                const bal = Math.max(0, w.balances);
                return (
                  <div key={w.weekStart} className="flex min-w-8 flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 flex-col justify-end" title={`${formatEAT(w.weekStart, "d MMM")}: ${formatKes(w.deposits)} deposits, ${formatKes(bal)} balances`}>
                      <div className="w-full rounded-t-[3px] bg-fg-3" style={{ height: `${(bal / maxWeek) * 100}%` }} />
                      <div className={bal ? "w-full bg-fg" : "w-full rounded-t-[3px] bg-fg"} style={{ height: `${(w.deposits / maxWeek) * 100}%` }} />
                    </div>
                    <span className="text-caption text-fg-3 tabular">{formatEAT(w.weekStart, "d/M")}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Breakdown title="By location" rows={data.byLocation} />
            <Breakdown title="By source" rows={data.bySource} empty="No sources recorded." />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionLabel className="mb-3">Expenses by category</SectionLabel>
              {data.expensesByCategory.length === 0 ? (
                <p className="text-label text-fg-2">No expenses in this period.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {data.expensesByCategory.map((c) => (
                    <li key={c.key} className="flex justify-between text-label">
                      <span>{c.label}</span>
                      <span className="money text-fg">{formatKes(c.amountKes)}</span>
                    </li>
                  ))}
                  <li className="mt-1 flex justify-between border-t border-line pt-2.5 text-label font-semibold">
                    <span>Total</span>
                    <span className="money">{formatKes(data.expensesTotal)}</span>
                  </li>
                </ul>
              )}
            </Card>

            <Card>
              <SectionLabel className="mb-3">Lifetime value (all-time)</SectionLabel>
              {!lifetime ? (
                <Skeleton className="h-28" />
              ) : (
                <dl className="grid grid-cols-2 gap-y-3 text-label">
                  <dt className="text-fg-2">Avg client LTV</dt>
                  <dd className="money text-right text-fg">{formatKes(lifetime.ltv)}</dd>
                  <dt className="text-fg-2">Repeat rate</dt>
                  <dd className="text-right tabular text-fg">{Math.round(lifetime.repeatRate * 100)}%</dd>
                  <dt className="text-fg-2">Avg sessions / client</dt>
                  <dd className="text-right tabular text-fg">{lifetime.avgSessionsPerClient.toFixed(1)}</dd>
                  <dt className="text-fg-2">Paying clients</dt>
                  <dd className="text-right tabular text-fg">{lifetime.payingClients}</dd>
                  <dt className="text-fg-2">Returning clients (via leads)</dt>
                  <dd className="text-right tabular text-fg">{lifetime.returningClients}</dd>
                  <dt className="text-fg-2">Return frequency</dt>
                  <dd className="text-right tabular text-fg">
                    {lifetime.returningFrequency.toFixed(1)}×
                    {lifetime.returningOpen > 0 && <span className="text-fg-3"> · {lifetime.returningOpen} open</span>}
                  </dd>
                </dl>
              )}
            </Card>
          </div>

          <Card className="mt-6">
            <SectionLabel className="mb-2">Deposits</SectionLabel>
            <p className="text-label text-fg-2">
              Retained from no-shows and cancellations: <span className="money text-fg">{formatKes(data.depositsRetained)}</span>
              {data.reversals !== 0 && (
                <>
                  {" "}
                  · Reversals: <span className="money text-fg">{formatKes(data.reversals)}</span>
                </>
              )}
            </p>
          </Card>
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {canExport && (["bookings", "payments", "clients", "expenses"] as const).map((k) => (
          <Button key={k} loading={exporting === k} onClick={() => exportCsv(k)}>
            <Download className="size-4" /> Export {k} CSV
          </Button>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <p className="text-caption text-fg-2">{label}</p>
      <p className={`money mt-1 text-heading ${warn ? "text-warning" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-caption text-fg-3">{sub}</p>}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: string; sessions: number; valueKes: number }[];
  empty?: string;
}) {
  const visible = rows.filter((r) => r.sessions > 0);
  const max = Math.max(1, ...visible.map((r) => r.sessions));
  return (
    <Card>
      <SectionLabel className="mb-3">{title}</SectionLabel>
      {visible.length === 0 ? (
        <p className="text-label text-fg-2">{empty ?? "Nothing in this period."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((r) => (
            <li key={r.key}>
              <div className="flex justify-between text-label">
                <span>{r.label}</span>
                <span className="tabular text-fg-2">
                  {r.sessions} · <span className="money text-fg">{formatKes(r.valueKes)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-hover">
                <div className="h-full rounded-full bg-fg-2" style={{ width: `${(r.sessions / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
