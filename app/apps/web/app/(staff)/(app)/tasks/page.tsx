"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { addDaysEAT, formatDateShort, startOfDayEAT } from "@drink/shared";
import { useMutation, useQuery } from "convex/react";
import { AtSign, CalendarClock, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { TaskSheet, type TaskLike } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";
import { Empty, ListSkeleton, PageTitle } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

interface Row extends TaskLike {
  createdAt: number;
  done: boolean;
  doneAt: number | null;
  checklistDone: number;
  checklistTotal: number;
}

function TaskCard({ t, i, onEdit }: { t: Row; i: number; onEdit: () => void }) {
  const setDone = useMutation(api.tasks.setDone);
  const setItemDone = useMutation(api.tasks.setItemDone);
  const taskId = t._id as Id<"tasks">;
  const overdue = !t.done && t.due != null && t.due < addDaysEAT(startOfDayEAT(Date.now()), 1);

  async function toggle(done: boolean) {
    try {
      await setDone({ taskId, done });
    } catch (e) {
      toast(toAppError(e).message);
    }
  }
  async function toggleItem(index: number, done: boolean) {
    try {
      await setItemDone({ taskId, index, done });
    } catch (e) {
      toast(toAppError(e).message);
    }
  }

  return (
    <li
      className="enter flex gap-3 rounded-lg border border-line bg-surface p-4 shadow-card"
      style={{ animationDelay: `${Math.min(i, 5) * 30}ms` }}
    >
      <input
        type="checkbox"
        checked={t.done}
        onChange={(e) => toggle(e.target.checked)}
        aria-label={t.done ? "Mark not done" : "Mark done"}
        className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
      />

      <div className="min-w-0 flex-1">
        <button type="button" onClick={onEdit} className="tap block w-full text-left">
          <span className={cn("font-semibold", t.done && "text-fg-3 line-through")}>{t.title}</span>
        </button>

        {/* Meta: due + @clients */}
        {(t.due != null || t.clients.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {t.due != null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium",
                  overdue ? "bg-accent-subtle text-accent-fg" : "border border-line-strong text-fg-2",
                )}
              >
                <CalendarClock className="size-3.5" aria-hidden />
                {formatDateShort(t.due)}
              </span>
            )}
            {t.clients.map((c) => (
              <Link
                key={c._id}
                href={`/clients/${c._id}`}
                className="tap inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-line-strong bg-surface px-2.5 py-1 text-caption font-medium text-fg-2 hover:bg-hover hover:text-fg"
              >
                <AtSign className="size-3 text-fg-3" aria-hidden />
                <span className="truncate">{c.fullName}</span>
              </Link>
            ))}
          </div>
        )}

        {t.note && <p className="mt-2 text-label text-fg-2 whitespace-pre-wrap">{t.note}</p>}

        {/* Checklist */}
        {t.checklistTotal > 0 && (
          <div className="mt-3 space-y-1.5">
            {t.checklist.map((item, idx) => (
              <label key={idx} className="flex items-start gap-2 text-label">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => toggleItem(idx, e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--text)]"
                />
                <span className={cn(item.done && "text-fg-3 line-through")}>{item.text}</span>
              </label>
            ))}
            <p className="pt-0.5 text-caption text-fg-3 tabular">
              {t.checklistDone}/{t.checklistTotal} done
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

const TABS = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
] as const;

export default function TasksPage() {
  const [tab, setTab] = useState<"open" | "done">("open");
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [active, setActive] = useState<Row | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const rows = useQuery(api.tasks.list, { done: tab === "done" }) as Row[] | undefined;

  function openAdd() {
    setAddKey((k) => k + 1);
    setAddOpen(true);
  }
  function openEdit(t: Row) {
    setActive(t);
    setSheetKey((k) => k + 1);
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="hidden lg:block">
        <PageTitle right={<Button onClick={openAdd}><Plus className="size-4" /> Add task</Button>}>Tasks</PageTitle>
      </div>

      <div className="sticky top-14 z-20 -mx-4 bg-bg px-4 pb-3 sm:-mx-6 sm:px-6 lg:top-0 lg:pt-2">
        <div className="flex items-center gap-2">
          <Segmented className="flex-1" label="Show" value={tab} onChange={setTab} options={TABS} />
          <Button onClick={openAdd} className="h-12 shrink-0 lg:hidden" aria-label="Add task">
            <Plus className="size-4" /> <span className="hidden sm:inline">Add task</span>
          </Button>
        </div>
      </div>

      <TaskSheet key={`add-${addKey}`} open={addOpen} onOpenChange={setAddOpen} task={null} />
      <TaskSheet key={sheetKey} open={!!active} onOpenChange={(o) => !o && setActive(null)} task={active} />

      <div className="mt-2">
        {rows === undefined ? (
          <ListSkeleton rows={4} />
        ) : rows.length === 0 ? (
          tab === "done" ? (
            <Empty text="Nothing finished yet." />
          ) : (
            <Empty text="No open tasks. Nice." action={<Button onClick={openAdd}><Plus className="size-4" /> Add task</Button>} />
          )
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((t, i) => (
              <TaskCard key={t._id} t={t} i={i} onEdit={() => openEdit(t)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
