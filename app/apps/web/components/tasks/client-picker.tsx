"use client";
import { api } from "@drink/backend/api";
import { useQuery } from "convex/react";
import { AtSign, Search, X } from "lucide-react";
import { useState } from "react";
import { FieldShell } from "@/components/ui/field";
import { useDebounced } from "@/lib/hooks";

export interface PickedClient {
  _id: string;
  fullName: string;
}

/**
 * Link a task to one or more clients — the "@mentions" from the examples. Type a name/phone,
 * pick from the results, and each stays as a removable @chip. Mirrors the leads/clients search.
 */
export function ClientPicker({
  value,
  onChange,
  label = "Linked clients",
}: {
  value: PickedClient[];
  onChange: (next: PickedClient[]) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const searching = dq.trim().length >= 2;
  const results = useQuery(api.clients.search, searching ? { q: dq } : "skip");

  const chosen = new Set(value.map((c) => c._id));
  const matches = (results ?? []).filter((c) => !chosen.has(c._id));

  function add(c: PickedClient) {
    onChange([...value, { _id: c._id, fullName: c.fullName }]);
    setQ("");
  }
  function remove(id: string) {
    onChange(value.filter((c) => c._id !== id));
  }

  return (
    <FieldShell label={label} optional hint="Who is this task about? They'll show as @mentions.">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {value.map((c) => (
            <span key={c._id} className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface py-1 pr-1 pl-2.5 text-label font-medium">
              <AtSign className="size-3.5 text-fg-3" aria-hidden />
              <span className="max-w-[12rem] truncate">{c.fullName}</span>
              <button
                type="button"
                onClick={() => remove(c._id)}
                aria-label={`Remove ${c.fullName}`}
                className="tap flex size-6 items-center justify-center rounded-full text-fg-3 hover:bg-hover hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a client to @mention"
          aria-label="Search clients to link"
          className="h-12 w-full rounded-md border border-line bg-surface pr-4 pl-11 placeholder:text-fg-3 focus:border-line-strong focus:outline-none"
        />
      </div>

      {searching && (
        <div className="mt-2 overflow-hidden rounded-md border border-line">
          {results === undefined ? (
            <p className="px-4 py-3 text-label text-fg-3">Searching…</p>
          ) : matches.length === 0 ? (
            <p className="px-4 py-3 text-label text-fg-3">No match{results.length ? " left to add" : ""}.</p>
          ) : (
            <ul className="max-h-56 divide-y divide-line overflow-y-auto">
              {matches.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => add(c)}
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
    </FieldShell>
  );
}
