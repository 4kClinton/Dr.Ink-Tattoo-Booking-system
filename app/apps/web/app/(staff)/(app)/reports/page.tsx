"use client";
import { api } from "@drink/backend/api";
import { dateKeyEAT, formatEAT, formatKes } from "@drink/shared";
import { useConvex, useQuery } from "convex/react";
import { ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Empty, PageTitle, Skeleton } from "@/components/ui/misc";
import { downloadCsv } from "@/lib/csv";
import { useReportRange } from "@/lib/report-range";

export default function ReportsPage() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const canView = useCan("reports.view");
  const canExport = useCan("exports.csv");
  const { range, search, from, to, setRange } = useReportRange();
  const data = useQuery(api.reports.summary, canView ? { from, to } : "skip");
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
      <DateRangePicker value={range} onChange={setRange} className="mb-4 w-full max-w-[420px]" />
      <p className="-mt-2 mb-4 text-caption text-fg-3">Tap any card to see the full breakdown.</p>

      {!data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile search={search} metric="collected" label="Collected" value={formatKes(data.collected)} sub={`${formatKes(data.deposits)} deposits`} />
            <Tile search={search} metric="outstanding" label="Outstanding" value={formatKes(data.outstanding)} sub="on confirmed sessions" warn={data.outstanding > 0} />
            <Tile search={search} metric="sessions" label="Sessions completed" value={String(data.sessionsCompleted)} sub={`${data.sessionsBooked} booked`} />
            <Tile search={search}               metric="no-shows" label="No-show rate"
              value={`${Math.round(data.noShowRate * 100)}%`}
              sub={`${data.noShows} no-show · ${data.cancellations} cancelled`}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile search={search}               metric="net-profit" label="Net profit"
              value={formatKes(data.netProfit)}
              sub={`${Math.round(data.profitMargin * 100)}% margin · ${formatKes(data.expensesTotal)} costs`}
              warn={data.netProfit < 0}
            />
            <Tile search={search} metric="avg-order" label="Avg order value" value={formatKes(data.avgOrderValue)} sub={`${data.sessionsCompleted} completed`} />
            <Tile search={search} metric="revenue-per-hour" label="Revenue / hour" value={formatKes(data.revenuePerHour)} sub="chair time, completed" />
            <Tile search={search} metric="new-clients" label="New clients" value={String(data.newClients)} sub="first seen this period" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile search={search} metric="tattoos" label="Tattoos done" value={String(data.tattoosDone)} sub={`${data.sessionsCompleted} sessions completed`} />
            <Tile search={search} metric="avg-price" label="Avg price / tattoo" value={formatKes(data.avgPricePerTattoo)} sub="revenue ÷ tattoos done" />
            <Tile search={search} metric="leads" label="Leads value" value={formatKes(data.leadsValue)} sub={`${data.leadsCount} open lead${data.leadsCount === 1 ? "" : "s"}`} />
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
            <Breakdown title="Studio vs house call" rows={data.byVenue} empty="No sessions in this period." />
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

function Tile({
  label,
  value,
  sub,
  warn,
  metric,
  search,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  metric: string;
  search: string;
}) {
  return (
    <Link
      href={`/reports/${metric}?${search}`}
      className="tap group relative block rounded-lg border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong hover:bg-hover"
    >
      <ChevronRight className="absolute top-4 right-3 size-4 text-fg-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      <p className="pr-5 text-caption text-fg-2">{label}</p>
      <p className={`money mt-1 text-heading ${warn ? "text-warning" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-caption text-fg-3">{sub}</p>}
    </Link>
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
