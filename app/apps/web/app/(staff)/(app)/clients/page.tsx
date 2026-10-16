"use client";
import { api } from "@drink/backend/api";
import { formatDateShort } from "@drink/shared";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Flag, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AddClientSheet } from "@/components/clients/add-client-sheet";
import { Button } from "@/components/ui/button";
import { Empty, ListSkeleton, PageTitle } from "@/components/ui/misc";
import { useDebounced } from "@/lib/hooks";

interface Row {
  _id: string;
  fullName: string;
  phoneDisplay: string;
  flagged?: string;
  lastVisitAt?: number;
  sessionCount: number;
}

function ClientRow({ c, i }: { c: Row; i: number }) {
  return (
    <li>
      <Link
        href={`/clients/${c._id}`}
        className="enter tap flex items-center justify-between gap-3 px-1 py-3 hover:bg-hover"
        style={{ animationDelay: `${Math.min(i, 5) * 30}ms` }}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{c.fullName}</span>
            {c.flagged && <Flag className="size-3.5 shrink-0 text-warning" aria-label="Flagged" />}
          </p>
          <p className="text-label text-fg-2 tabular">{c.phoneDisplay}</p>
        </div>
        <div className="shrink-0 text-right text-label">
          <p className="text-fg-2">{c.lastVisitAt ? formatDateShort(c.lastVisitAt) : "No visits yet"}</p>
          <p className="text-caption text-fg-3">
            {c.sessionCount} session{c.sessionCount === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default function ClientsPage() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const searching = dq.trim().length >= 2;
  const results = useQuery(api.clients.search, searching ? { q: dq } : "skip");
  const { results: all, status, loadMore } = usePaginatedQuery(api.clients.list, searching ? "skip" : {}, { initialNumItems: 30 });
  const [addOpen, setAddOpen] = useState(false);
  const rows: Row[] | undefined = searching ? results : status === "LoadingFirstPage" ? undefined : all;

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="hidden lg:block">
        <PageTitle right={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add client</Button>}>Clients</PageTitle>
      </div>
      <div className="sticky top-14 z-20 -mx-4 bg-bg px-4 pb-3 sm:-mx-6 sm:px-6 lg:top-0 lg:pt-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone or @instagram"
              aria-label="Search clients"
              className="h-12 w-full rounded-md border border-line bg-surface pr-4 pl-11 placeholder:text-fg-3 focus:border-line-strong focus:outline-none"
            />
          </div>
          <Button onClick={() => setAddOpen(true)} className="h-12 shrink-0 lg:hidden" aria-label="Add client">
            <Plus className="size-4" /> <span className="hidden sm:inline">Add client</span>
          </Button>
        </div>
      </div>
      <AddClientSheet open={addOpen} onOpenChange={setAddOpen} />
      {rows === undefined ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        searching ? (
          <Empty text={`No client matches “${dq}”.`} />
        ) : (
          <Empty text="No clients yet." action={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add client</Button>} />
        )
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((c, i) => (
            <ClientRow key={c._id} c={c} i={i} />
          ))}
        </ul>
      )}
      {!searching && status === "CanLoadMore" && (
        <Button block className="mt-4" onClick={() => loadMore(30)}>
          Load more
        </Button>
      )}
    </div>
  );
}
