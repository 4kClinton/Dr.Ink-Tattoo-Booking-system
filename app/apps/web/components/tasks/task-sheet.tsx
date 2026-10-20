"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { dateKeyEAT, fromDateKey } from "@drink/shared";
import { useMutation } from "convex/react";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ClientPicker, type PickedClient } from "@/components/tasks/client-picker";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input, Textarea } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface TaskLike {
  _id: string;
  title: string;
  note: string | null;
  due: number | null;
  checklist: ChecklistItem[];
  clients: PickedClient[];
}

/** Add a task (when `task` is null) or edit an existing one. Remount via `key` to reset. */
export function TaskSheet({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: TaskLike | null;
}) {
  const create = useMutation(api.tasks.create);
  const update = useMutation(api.tasks.update);
  const remove = useMutation(api.tasks.remove);
  const editing = !!task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [due, setDue] = useState(task?.due ? dateKeyEAT(task.due) : "");
  const [note, setNote] = useState(task?.note ?? "");
  const [clients, setClients] = useState<PickedClient[]>(task?.clients ?? []);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? []);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const taskId = task?._id as Id<"tasks"> | undefined;
  const canSave = title.trim().length >= 2;

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    setChecklist((c) => [...c, { text, done: false }]);
    setNewItem("");
  }

  async function save() {
    setBusy(true);
    try {
      const args = {
        title: title.trim(),
        note: note.trim() || undefined,
        due: due ? fromDateKey(due) : undefined,
        clientIds: clients.map((c) => c._id as Id<"clients">),
        checklist: checklist.filter((i) => i.text.trim()).map((i) => ({ text: i.text.trim(), done: i.done })),
      };
      if (taskId) await update({ taskId, ...args });
      else await create(args);
      toast(editing ? "Task saved" : "Task added");
      onOpenChange(false);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!taskId) return;
    setBusy(true);
    try {
      await remove({ taskId });
      toast("Task deleted");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={editing ? "Edit task" : "Add task"}
        description="A to-do with an optional due date, checklist and the clients it's about."
        footer={
          <Button variant="primary" block loading={busy} disabled={!canSave} onClick={save}>
            {editing ? "Save" : "Add task"}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Task"
            placeholder="e.g. Prepare stencils"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <DatePicker label="Due date" optional value={due} onChange={setDue} />

          <ClientPicker value={clients} onChange={setClients} />

          {/* Checklist editor */}
          <div className="flex flex-col gap-2">
            <p className="text-label font-medium text-fg">
              Checklist <span className="ml-1 font-normal text-fg-3">(optional)</span>
            </p>
            {checklist.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[var(--text)]"
                  checked={item.done}
                  onChange={(e) => setChecklist((c) => c.map((it, i) => (i === idx ? { ...it, done: e.target.checked } : it)))}
                  aria-label={`Mark "${item.text}" done`}
                />
                <input
                  value={item.text}
                  onChange={(e) => setChecklist((c) => c.map((it, i) => (i === idx ? { ...it, text: e.target.value } : it)))}
                  className={cn(
                    "h-10 flex-1 rounded-md border border-line bg-surface px-3 text-label focus:border-line-strong focus:outline-none",
                    item.done && "text-fg-3 line-through",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setChecklist((c) => c.filter((_, i) => i !== idx))}
                  aria-label="Remove item"
                  className="tap flex size-8 shrink-0 items-center justify-center rounded-md text-fg-3 hover:bg-hover hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
                placeholder="Add a step"
                aria-label="Add a checklist step"
                className="h-10 flex-1 rounded-md border border-line bg-surface px-3 text-label placeholder:text-fg-3 focus:border-line-strong focus:outline-none"
              />
              <Button size="sm" onClick={addItem} disabled={!newItem.trim()} aria-label="Add step">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <Textarea label="Note" optional rows={3} value={note} onChange={(e) => setNote(e.target.value)} />

          {editing && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="tap mt-2 inline-flex items-center gap-2 self-start text-label font-medium text-accent-fg hover:underline"
            >
              <Trash2 className="size-4" /> Delete task
            </button>
          )}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        body="This removes the task and its checklist permanently."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={doDelete}
      />
    </>
  );
}
