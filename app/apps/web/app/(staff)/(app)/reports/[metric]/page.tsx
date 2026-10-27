"use client";
import { api } from "@drink/backend/api";
import type { FunctionReturnType } from "convex/server";
import { type BookingStatus, formatDuration, formatEAT, formatKes, LOCATION_LABEL } from "@drink/shared";
import { useQuery } from "convex/react";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ExpenseSheet, type ExpenseRow } from "@/components/expenses/expense-sheet";
import { useCan } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Empty, PageTitle, Skeleton } from "@/components/ui/misc";
import { ChoiceChips } from "@/components/ui/segmented";
import { StatusChip } from "@/components/ui/status-chip";
import { useReportRange } from "@/lib/report-range";

type Summary = FunctionReturnType<typeof api.reports.summary>;
type Details = FunctionReturnType<typeof api.reports.details>;
type Session = Details["sessions"][number];
type Section = "pnl" | "sessions" | "payments" | "expenses" | "newClients" | "leads";
type SessionFilter = "all" | "completed" | "confirmed" | "balance" | "missed";

interface MetricDef {
  title: string;
  /** Headline number from the same summary query the Reports cards use, so they always agree. */
  headline: (s: Summary) => { value: string; sub: string };
  sections: Section[];
  sessionFilter?: SessionFilter;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const SESSIONS_FIRST: Section[] = ["sessions", "pnl", "payments", "expenses"];

const METRICS: Record<string, MetricDef> = {
  collected: {
    title: "Collected",
    headline: (s) => ({ value: formatKes(s.collected), sub: `${formatKes(s.deposits)} deposits · ${formatKes(s.balances)} balances` }),
    sections: ["payments", "pnl", "sessions", "expenses"],
  },
  outstanding: {
    title: "Outstanding",
    headline: (s) => ({ value: formatKes(s.outstanding), sub: "still owed on confirmed sessions" }),
    sections: SESSIONS_FIRST,
    sessionFilter: "balance",
  },
  sessions: {
    title: "Sessions completed",
    headline: (s) => ({ value: String(s.sessionsCompleted), sub: `${s.sessionsBooked} booked in this period` }),
    sections: SESSIONS_FIRST,
    sessionFilter: "completed",
  },
  "no-shows": {
    title: "No-shows & cancellations",
    headline: (s) => ({ value: pct(s.noShowRate), sub: `${s.noShows} no-show · ${s.cancellations} cancelled · ${formatKes(s.depositsRetained)} deposits kept` }),
    sections: SESSIONS_FIRST,
    sessionFilter: "missed",
  },
  "net-profit": {
    title: "Net profit",
    headline: (s) => ({ value: formatKes(s.netProfit), sub: `${pct(s.profitMargin)} margin` }),
    sections: ["pnl", "expenses", "payments", "sessions"],
  },
  "avg-order": {
    title: "Avg order value",
    headline: (s) => ({ value: formatKes(s.avgOrderValue), sub: `across ${s.sessionsCompleted} completed sessions` }),
    sections: SESSIONS_FIRST,
    sessionFilter: "completed",
  },
  "revenue-per-hour": {
    title: "Revenue / hour",
    headline: (s) => ({ value: formatKes(s.revenuePerHour), sub: "chair time on completed sessions" }),
    sections: SESSIONS_FIRST,
    sessionFilter: "completed",
  },
  tattoos: {
    title: "Tattoos done",
    headline: (s) => ({ value: String(s.tattoosDone), sub: `over ${s.sessionsCompleted} completed sessions` }),
    sections: SESSIONS_FIRST,
    sessionFilter: "completed",
  },
  "avg-price": {
    title: "Avg price / tattoo",
    headline: (s) => ({ value: formatKes(s.avgPricePerTattoo), sub: `${s.tattoosDone} tattoos done` }),
    sections: SESSIONS_FIRST,
    sessionFilter: "completed",
  },
  "new-clients": {
    title: "New clients",
    headline: (s) => ({ value: String(s.newClients), sub: "first seen in this period" }),
    sections: ["newClients", "sessions", "pnl", "payments", "expenses"],
  },
  leads: {
    title: "Leads value",
    headline: (s) => ({ value: formatKes(s.leadsValue), sub: `${s.leadsCount} open lead${s.leadsCount === 1 ? "" : "s"} · current pipeline, not period-based` }),
    sections: ["leads", "pnl", "sessions", "payments", "expenses"],
  },
};

const SESSION_FILTERS: { value: SessionFilter; label: string; match: (s: Session) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "completed", label: "Completed", match: (s) => s.status === "completed" },
  { value: "confirmed", label: "Upcoming", match: (s) => s.status === "confirmed" },
  { value: "balance", label: "Balance due", match: (s) => s.status === "confirmed" && s.balanceKes > 0 },
  { value: "missed", label: "No-show / cancelled", match: (s) => s.status === "no_show" || s.status === "cancelled" },
];

const PAYMENT_TYPE_LABEL = { deposit: "Deposit", balance: "Balance", reversal: "Reversal" } as const;

export default function ReportDetailPage() {
  return (
    <Suspense>
      <ReportDetail />
    </Suspense>
  );
}

function ReportDetail() {
  const { metric } = useParams<{ metric: string }>();
  const def = METRICS[metric] ?? METRICS["net-profit"]!;
  const canView = useCan("reports.view");
  const canManageExpenses = useCan("expenses.manage");
  const { range, search, from, to, setRange } = useReportRange();
  const summary = useQuery(api.reports.summary, canView ? { from, to } : "skip");
  const details = useQuery(api.reports.details, canView ? { from, to } : "skip");

  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  function openExpense(row: ExpenseRow | null) {
    setEditing(row);
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  }

  if (!canView) return <Empty text="You don't have access to reports. Ask the artist to turn it on." />;

  const headline = summary ? def.headline(summary) : null;

  return (
    <div className="mx-auto max-w-[960px]">
      <Link
        href={`/reports?${search}`}
        className="tap -ml-2 mb-3 inline-flex items-center gap-1 rounded-md px-2 py-2 text-label font-medium text-fg-2 hover:bg-hover"
      >
        <ArrowLeft className="size-4" /> Reports
      </Link>
      <PageTitle>{def.title}</PageTitle>

      <DateRangePicker value={range} onChange={setRange} className="mb-4 w-full max-w-[420px]" />

      {!summary || !details ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-line bg-surface p-4 shadow-card lg:p-6">
            <p className="text-caption text-fg-2">{def.title}</p>
            <p className="money mt-1 font-display text-display leading-none">{headline!.value}</p>
            <p className="mt-1.5 text-caption text-fg-3">{headline!.sub}</p>
          </div>

          {def.sections.map((section) => (
            <div key={section} className="mt-6">
              {section === "pnl" && <ProfitAndLoss summary={summary} />}
              {section === "sessions" && <Sessions key={metric} rows={details.sessions} initial={def.sessionFilter ?? "all"} />}
              {section === "payments" && <Payments rows={details.payments} />}
              {section === "expenses" && (
                <Expenses rows={details.expenses} canManage={canManageExpenses} onAdd={() => openExpense(null)} onEdit={openExpense} />
              )}
              {section === "newClients" && <NewClients rows={details.newClients} />}
              {section === "leads" && <OpenLeads rows={details.openLeads} />}
            </div>
          ))}
        </>
      )}

      {canManageExpenses && <ExpenseSheet key={sheetKey} open={sheetOpen} onOpenChange={setSheetOpen} expense={editing ?? undefined} />}
    </div>
  );
}

function ProfitAndLoss({ summary: s }: { summary: Summary }) {
  return (
    <Card>
      <SectionLabel className="mb-3">Money in vs money out</SectionLabel>
      <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-label">
        <dt className="text-fg-2">Deposits received</dt>
        <dd className="money text-right">{formatKes(s.deposits)}</dd>
        <dt className="text-fg-2">Balances received</dt>
        <dd className="money text-right">{formatKes(s.balances)}</dd>
        {s.reversals !== 0 && (
          <>
            <dt className="text-fg-2">Reversals</dt>
            <dd className="money text-right">{formatKes(s.reversals)}</dd>
          </>
        )}
        <dt className="border-t border-line pt-2 font-semibold">Collected</dt>
        <dd className="money border-t border-line pt-2 text-right font-semibold">{formatKes(s.collected)}</dd>

        {s.expensesByCategory.map((c) => (
          <div key={c.key} className="contents">
            <dt className="text-fg-2">{c.label}</dt>
            <dd className="money text-right">−{formatKes(c.amountKes)}</dd>
          </div>
        ))}
        <dt className="border-t border-line pt-2 font-semibold">Expenses</dt>
        <dd className="money border-t border-line pt-2 text-right font-semibold">−{formatKes(s.expensesTotal)}</dd>

        <dt className="mt-1 border-t-2 border-line-strong pt-2.5 text-body font-semibold">Net profit</dt>
        <dd className={`money mt-1 border-t-2 border-line-strong pt-2.5 text-right text-body font-semibold ${s.netProfit < 0 ? "text-warning" : ""}`}>
          {formatKes(s.netProfit)}
        </dd>
      </dl>
      <p className="mt-3 text-caption text-fg-3">Cash basis: money actually received in this period minus expenses dated in it.</p>
    </Card>
  );
}

function Sessions({ rows, initial }: { rows: Session[]; initial: SessionFilter }) {
  const [filter, setFilter] = useState<SessionFilter>(initial);
  const match = SESSION_FILTERS.find((f) => f.value === filter)!.match;
  const visible = rows.filter(match);
  const value = visible.reduce((s, r) => s + r.finalPriceKes, 0);
  const paid = visible.reduce((s, r) => s + r.paidTotalKes, 0);
  const owed = visible.filter((r) => r.status === "confirmed").reduce((s, r) => s + r.balanceKes, 0);
  const tattoos = visible.reduce((s, r) => s + r.tattooCount, 0);

  return (
    <Card>
      <SectionLabel className="mb-3">Sessions — whose tattoo, for how much</SectionLabel>
      <ChoiceChips
        label="Filter sessions"
        value={filter}
        onChange={setFilter}
        className="mb-3"
        options={SESSION_FILTERS.map((f) => ({ value: f.value, label: `${f.label} · ${rows.filter(f.match).length}` }))}
      />
      {visible.length === 0 ? (
        <p className="py-4 text-label text-fg-2">No sessions match in this period.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {visible.map((r) => (
              <li key={r._id}>
                <Link href={`/bookings/${r._id}`} className="tap -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-3 hover:bg-hover">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.clientName}</span>
                      <StatusChip kind={r.status as BookingStatus} />
                    </div>
                    <p className="mt-0.5 truncate text-label text-fg-2">
                      <span className="tabular">{formatEAT(r.startAt, "EEE d MMM, HH:mm")}</span>
                      {" · "}
                      {r.tattooCount} tattoo{r.tattooCount === 1 ? "" : "s"}
                      {" · "}
                      {formatDuration(r.durationMin)}
                      {" · "}
                      {r.venue === "house_call" ? "House call" : LOCATION_LABEL[r.location as keyof typeof LOCATION_LABEL] ?? "Studio"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <div className="text-right">
                      <p className="money font-medium">{formatKes(r.finalPriceKes)}</p>
                      <p className="text-caption text-fg-3">
                        {r.status === "confirmed" && r.balanceKes > 0 ? (
                          <span className="text-warning">{formatKes(r.balanceKes)} due</span>
                        ) : (
                          <>{formatKes(r.paidTotalKes)} paid</>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="mt-0.5 size-4 text-fg-3" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <dl className="mt-2 grid grid-cols-2 gap-y-1.5 border-t border-line pt-3 text-label sm:grid-cols-4">
            <Stat label="Sessions" value={String(visible.length)} />
            <Stat label="Tattoos" value={String(tattoos)} />
            <Stat label="Value" value={formatKes(value)} />
            <Stat label={owed > 0 ? "Paid · owed" : "Paid"} value={owed > 0 ? `${formatKes(paid)} · ${formatKes(owed)}` : formatKes(paid)} />
          </dl>
        </>
      )}
    </Card>
  );
}

function Payments({ rows }: { rows: Details["payments"] }) {
  const total = rows.reduce((s, p) => s + p.amountKes, 0);
  return (
    <Card>
      <SectionLabel className="mb-3">Payments received</SectionLabel>
      {rows.length === 0 ? (
        <p className="py-4 text-label text-fg-2">No payments in this period.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((p) => (
            <li key={p._id}>
              <Link
                href={p.bookingId ? `/bookings/${p.bookingId}` : `/clients/${p.clientId}`}
                className="tap -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-3 hover:bg-hover"
              >
                <div className="min-w-0">
                  <p className="font-medium">{p.clientName}</p>
                  <p className="truncate text-label text-fg-2">
                    <span className="tabular">{formatEAT(p.paidAt, "EEE d MMM")}</span>
                    {" · "}
                    {PAYMENT_TYPE_LABEL[p.type]}
                    {" · "}
                    {p.method === "mpesa" ? "M-Pesa" : "Cash"}
                    {p.mpesaCode && <span className="tabular"> · {p.mpesaCode}</span>}
                  </p>
                </div>
                <span className={`money shrink-0 ${p.amountKes < 0 ? "text-warning" : ""}`}>{formatKes(p.amountKes)}</span>
              </Link>
            </li>
          ))}
          <li className="flex justify-between pt-3 text-label font-semibold">
            <span>Total collected · {rows.length}</span>
            <span className="money">{formatKes(total)}</span>
          </li>
        </ul>
      )}
    </Card>
  );
}

function Expenses({
  rows,
  canManage,
  onAdd,
  onEdit,
}: {
  rows: Details["expenses"];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (row: ExpenseRow) => void;
}) {
  const total = rows.reduce((s, e) => s + e.amountKes, 0);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel>Expenses</SectionLabel>
        {canManage && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="size-4" /> Add expense
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-label text-fg-2">No expenses in this period.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((e) => {
            const body = (
              <>
                <div className="min-w-0">
                  <p className="font-medium">{e.categoryLabel}</p>
                  <p className="truncate text-label text-fg-2">
                    <span className="tabular">{formatEAT(e.incurredAt, "EEE d MMM")}</span>
                    {e.linkedClient && <> · {e.linkedClient}</>}
                    {e.vendor && <> · {e.vendor}</>}
                    {e.method && <> · {e.method === "mpesa" ? "M-Pesa" : "Cash"}</>}
                    {e.note && <> · {e.note}</>}
                  </p>
                </div>
                <span className="money shrink-0">−{formatKes(e.amountKes)}</span>
              </>
            );
            return (
              <li key={e._id}>
                {canManage ? (
                  <button onClick={() => onEdit(e)} className="tap -mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-3 rounded-md px-2 py-3 text-left hover:bg-hover">
                    {body}
                  </button>
                ) : (
                  <div className="flex items-start justify-between gap-3 py-3">{body}</div>
                )}
              </li>
            );
          })}
          <li className="flex justify-between pt-3 text-label font-semibold">
            <span>Total spent · {rows.length}</span>
            <span className="money">−{formatKes(total)}</span>
          </li>
        </ul>
      )}
    </Card>
  );
}

function NewClients({ rows }: { rows: Details["newClients"] }) {
  return (
    <Card>
      <SectionLabel className="mb-3">New clients</SectionLabel>
      {rows.length === 0 ? (
        <p className="py-4 text-label text-fg-2">No new clients in this period.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((c) => (
            <li key={c._id}>
              <Link href={`/clients/${c._id}`} className="tap -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-hover">
                <span className="font-medium">{c.fullName}</span>
                <span className="text-label text-fg-2 tabular">Added {formatEAT(c.createdAt, "d MMM")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OpenLeads({ rows }: { rows: Details["openLeads"] }) {
  return (
    <Card>
      <SectionLabel className="mb-3">Open leads</SectionLabel>
      {rows.length === 0 ? (
        <p className="py-4 text-label text-fg-2">No open leads right now.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((l) => (
            <li key={l._id}>
              <Link href={`/leads/${l._id}`} className="tap -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-3 hover:bg-hover">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-label text-fg-2">
                    {l.status === "new" ? "New" : "Contacted"} · <span className="tabular">since {formatEAT(l.createdAt, "d MMM")}</span>
                  </p>
                </div>
                <span className="money shrink-0">{l.price ? formatKes(l.price) : "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-fg-3">{label}</dt>
      <dd className="money font-medium">{value}</dd>
    </div>
  );
}
