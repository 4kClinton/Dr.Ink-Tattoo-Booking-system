"use client";
import { api } from "@drink/backend/api";
import { useQuery } from "convex/react";
import { Search, User, X } from "lucide-react";
import { useState } from "react";
import { FieldShell } from "@/components/ui/field";
import { useDebounced } from "@/lib/hooks";

export interface LinkedClient {
  _id: string;
  fullName: string;
  phone?: string;
  phoneDisplay?: string;
  instagram?: string;
}

/**
 * Search the client list and link one to a lead — for returning clients who come back for more
 * work. Linked leads are counted as returning clients in reports.
 */
export function ClientLinkField({
  value,
  onChange,
}: {
  value: LinkedClient | null;
  onChange: (c: LinkedClient | null) => void;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const searching = dq.trim().length >= 2;
  const results = useQuery(api.clients.search, searching && !value ? { q: dq } : "skip");

  return (
    <FieldShell
      label="Existing client"
      optional
      hint="If this is a returning client, link their record — it counts as a returning client in reports."
    >
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-elevated px-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <User className="size-4 shrink-0 text-fg-3" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate font-medium">{value.fullName}</span>
              {value.phoneDisplay && <span className="block truncate text-caption text-fg-3 tabular">{value.phoneDisplay}</span>}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Unlink client"
            className="tap flex size-8 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-hover hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a client to link"
              aria-label="Search clients to link"
              className="h-12 w-full rounded-md border border-line bg-surface pr-4 pl-11 placeholder:text-fg-3 focus:border-line-strong focus:outline-none"
            />
          </div>
          {searching && (
            <div className="mt-2 overflow-hidden rounded-md border border-line">
              {results === undefined ? (
                <p className="px-4 py-3 text-label text-fg-3">Searching…</p>
              ) : results.length === 0 ? (
                <p className="px-4 py-3 text-label text-fg-3">No client matches “{dq}”.</p>
              ) : (
                <ul className="max-h-56 divide-y divide-line overflow-y-auto">
                  {results.map((c) => (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange({ _id: c._id, fullName: c.fullName, phone: c.phone, phoneDisplay: c.phoneDisplay, instagram: c.instagram ?? undefined });
                          setQ("");
                        }}
                        className="tap flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-hover"
                      >
                        <span className="min-w-0 truncate font-medium">{c.fullName}</span>
                        <span className="shrink-0 text-caption text-fg-3 tabular">{c.phoneDisplay}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </FieldShell>
  );
}
