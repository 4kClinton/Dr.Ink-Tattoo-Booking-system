"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { formatDateShort, formatPhone, MANAGER_DEFAULTS, PERMISSIONS, type Permission } from "@drink/shared";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, KeyRound, MessageCircle, Plus, Send, ShieldCheck, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { PhoneInput } from "@/components/ui/money-input";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
  try {
    const r = await fn();
    if (ok) toast(ok);
    return r;
  } catch (e) {
    toast(toAppError(e).message);
    return undefined;
  }
}

function copy(text: string, what = "Link copied") {
  void navigator.clipboard.writeText(text);
  toast(what);
}

/** Permission checklist, grouped. The artist's own access is never editable. */
function PermissionPicker({ value, onChange }: { value: Permission[]; onChange: (v: Permission[]) => void }) {
  const toggle = (k: Permission) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <fieldset key={g}>
          <legend className="mb-2 text-caption font-semibold tracking-wider text-fg-2 uppercase">{g}</legend>
          <div className="flex flex-col gap-1">
            {PERMISSIONS.filter((p) => p.group === g).map((p) => (
              <label key={p.key} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-hover">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-[var(--text)]"
                  checked={value.includes(p.key)}
                  onChange={() => toggle(p.key)}
                />
                <span>
                  <span className="block text-label font-medium">{p.label}</span>
                  <span className="block text-caption text-fg-2">{p.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="text-caption text-fg-3">
        Always yours only: team & access, deposit and policy settings, T&Cs, payment reversals, deposit decisions, archiving or
        erasing clients, deleting photos.
      </p>
    </div>
  );
}

export function TeamSection() {
  const data = useQuery(api.staff.list);
  const viewer = useViewer();
  const [inviting, setInviting] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);
  const [invitePerms, setInvitePerms] = useState<{ id: Id<"invites">; perms: Permission[] } | null>(null);
  const resendInvite = useMutation(api.staff.resendInvite);
  const revokeInvite = useMutation(api.staff.revokeInvite);
  const setInvitePermissions = useMutation(api.staff.setInvitePermissions);

  if (!data) return <Skeleton className="h-48" />;
  const member = data.staff.find((s) => s._id === managing);

  return (
    <section id="team" className="scroll-mt-20">
      <h2 className="text-heading font-semibold tracking-[-0.01em]">Team & access</h2>
      <p className="mt-0.5 mb-3 text-label text-fg-2">
        You onboard managers and decide what each one can do. Changes apply immediately.
      </p>
      <Card>
        <ul className="-my-2 flex flex-col divide-y divide-line">
          {data.staff.map((s) => (
            <li key={s._id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {s.name}
                  {s._id === viewer._id && <span className="text-caption font-normal text-fg-3">(you)</span>}
                  {s.role === "artist" ? (
                    <StatusChip kind="neutral" icon={ShieldCheck}>
                      Artist · full access
                    </StatusChip>
                  ) : s.active ? (
                    <StatusChip kind="neutral">
                      Manager · {s.permissions.length}/{PERMISSIONS.length} permissions
                    </StatusChip>
                  ) : (
                    <StatusChip kind="cancelled" icon={UserX}>
                      Deactivated
                    </StatusChip>
                  )}
                </p>
                <p className="truncate text-caption text-fg-3">
                  {s.email} · <span className="tabular">{formatPhone(s.phone)}</span>
                  {s.mustChangePassword && " · temporary password issued"}
                </p>
              </div>
              {s.role === "manager" && (
                <Button size="sm" onClick={() => setManaging(s._id)}>
                  Manage access
                </Button>
              )}
            </li>
          ))}
        </ul>

        {data.invites.length > 0 && (
          <>
            <SectionLabel className="mt-6 mb-2">Pending invites</SectionLabel>
            <ul className="flex flex-col divide-y divide-line">
              {data.invites.map((i) => (
                <li key={i._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {i.name}{" "}
                      {i.expired ? (
                        <StatusChip kind="warning">Expired</StatusChip>
                      ) : (
                        <span className="text-caption font-normal text-fg-3">· link valid until {formatDateShort(i.expiresAt)}</span>
                      )}
                    </p>
                    <p className="truncate text-caption text-fg-3">
                      {i.email} · {i.permissions.length} permissions
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!i.expired && i.link && (
                      <Button size="sm" onClick={() => copy(i.link!)}>
                        <Copy className="size-3.5" /> Copy link
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() =>
                        run(() => resendInvite({ inviteId: i._id }), `New invite link texted to ${i.name.split(" ")[0]}`)
                      }
                    >
                      <Send className="size-3.5" /> {i.expired ? "Send new link" : "Resend"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setInvitePerms({ id: i._id, perms: i.permissions as Permission[] })}>
                      Access
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => run(() => revokeInvite({ inviteId: i._id }), "Invite revoked")}>
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <Button className="mt-4" onClick={() => setInviting(true)}>
          <Plus className="size-4" /> Invite manager
        </Button>
      </Card>

      {inviting && <InviteSheet onClose={() => setInviting(false)} />}
      {member && <ManageAccessSheet key={member._id} member={member} onClose={() => setManaging(null)} />}
      {invitePerms && (
        <Sheet
          open
          onOpenChange={(o) => !o && setInvitePerms(null)}
          title="Invite access"
          description="Applied when they accept the invite."
          footer={
            <Button
              variant="primary"
              block
              onClick={async () => {
                const ok = await run(() => setInvitePermissions({ inviteId: invitePerms.id, permissions: invitePerms.perms }), "Access saved");
                if (ok !== undefined) setInvitePerms(null);
              }}
            >
              Save access
            </Button>
          }
        >
          <PermissionPicker value={invitePerms.perms} onChange={(perms) => setInvitePerms({ ...invitePerms, perms })} />
        </Sheet>
      )}
    </section>
  );
}

function InviteSheet({ onClose }: { onClose: () => void }) {
  const invite = useMutation(api.staff.invite);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [perms, setPerms] = useState<Permission[]>(MANAGER_DEFAULTS);
  const [step, setStep] = useState<"details" | "access" | "done">("details");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = form.name.trim().split(" ")[0] || "them";

  async function send() {
    setBusy(true);
    const r = await run(() => invite({ ...form, permissions: perms, sendSms: true }));
    setBusy(false);
    if (r) {
      setLink(r.link);
      setStep("done");
    }
  }

  const detailsOk = form.name.trim().length > 1 && /\S+@\S+\.\S+/.test(form.email) && form.phone.replace(/\D/g, "").length >= 9;

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      full={step === "access"}
      title={step === "done" ? "Invite sent" : "Invite manager"}
      description={step === "details" ? "Step 1 of 2 · Details" : step === "access" ? "Step 2 of 2 · What they can do" : undefined}
      footer={
        step === "details" ? (
          <Button variant="primary" block disabled={!detailsOk} onClick={() => setStep("access")}>
            Continue
          </Button>
        ) : step === "access" ? (
          <div className="flex gap-3">
            <Button onClick={() => setStep("details")}>Back</Button>
            <Button variant="primary" block loading={busy} onClick={send}>
              Send invite
            </Button>
          </div>
        ) : (
          <Button block onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      {step === "details" && (
        <div className="flex flex-col gap-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          <Input label="Email" type="email" hint="They sign in with this." value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <PhoneInput label="Mobile" hint="The invite link is texted here." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      )}
      {step === "access" && <PermissionPicker value={perms} onChange={setPerms} />}
      {step === "done" && link && (
        <div className="flex flex-col gap-4 pb-4">
          <p className="flex items-start gap-2">
            <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
            We texted {first} a link to set their password. It works once and expires in 7 days.
          </p>
          <div className="rounded-md bg-elevated p-3 text-caption break-all text-fg-2">{link}</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => copy(link)}>
              <Copy className="size-3.5" /> Copy link
            </Button>
            <a
              className="tap inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-label font-semibold hover:bg-hover"
              href={`https://wa.me/?text=${encodeURIComponent(`Hi ${first}, set up your Dr.Ink Booking account: ${link}`)}`}
              target="_blank"
              rel="noopener"
            >
              <MessageCircle className="size-3.5" /> Share on WhatsApp
            </a>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ManageAccessSheet({
  member,
  onClose,
}: {
  member: { _id: Id<"staff">; name: string; email: string | null; active: boolean; permissions: Permission[] };
  onClose: () => void;
}) {
  const setPermissions = useMutation(api.staff.setPermissions);
  const setActive = useMutation(api.staff.setActive);
  const resetPassword = useAction(api.staff.resetPassword);
  const [perms, setPerms] = useState<Permission[]>(member.permissions);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"deactivate" | "reset" | null>(null);
  const [temp, setTemp] = useState<{ tempPassword: string; email: string } | null>(null);
  const first = member.name.split(" ")[0];
  const dirty = perms.slice().sort().join() !== member.permissions.slice().sort().join();

  return (
    <>
      <Sheet
        open={!confirm && !temp}
        onOpenChange={(o) => !o && onClose()}
        full
        title={member.name}
        description={member.active ? `Manager · ${member.email}` : "Deactivated: can't sign in"}
        footer={
          <Button
            variant="primary"
            block
            disabled={!dirty || !member.active}
            loading={busy === "save"}
            onClick={async () => {
              setBusy("save");
              const ok = await run(() => setPermissions({ staffId: member._id, permissions: perms }), `${first}'s access updated`);
              setBusy(null);
              if (ok !== undefined) onClose();
            }}
          >
            Save access
          </Button>
        }
      >
        <div className={cn(!member.active && "pointer-events-none opacity-40")}>
          <PermissionPicker value={perms} onChange={setPerms} />
        </div>
        <SectionLabel className="mt-8 mb-2">Account</SectionLabel>
        <div className="flex flex-col gap-2 pb-4">
          {member.active ? (
            <>
              <Button block onClick={() => setConfirm("reset")}>
                <KeyRound className="size-4" /> Issue temporary password
              </Button>
              <Button block onClick={() => setConfirm("deactivate")}>
                <UserX className="size-4" /> Deactivate {first}
              </Button>
            </>
          ) : (
            <Button
              block
              loading={busy === "activate"}
              onClick={async () => {
                setBusy("activate");
                await run(() => setActive({ staffId: member._id, active: true }), `${first} can sign in again`);
                setBusy(null);
                onClose();
              }}
            >
              Re-activate {first}
            </Button>
          )}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirm === "deactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Deactivate ${first}?`}
        body={`${first} is signed out everywhere straight away and can't sign in until you re-activate them. Their bookings, payments and history stay.`}
        confirmLabel="Deactivate"
        loading={busy === "deactivate"}
        onConfirm={async () => {
          setBusy("deactivate");
          await run(() => setActive({ staffId: member._id, active: false }), `${first} deactivated`);
          setBusy(null);
          onClose();
        }}
      />
      <ConfirmSheet
        open={confirm === "reset"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Issue temporary password?"
        body={`${first}'s current password stops working and they're signed out. You'll see a one-time password to give them; they must choose a new one when they sign in.`}
        confirmLabel="Issue password"
        loading={busy === "reset"}
        onConfirm={async () => {
          setBusy("reset");
          const r = await run(() => resetPassword({ staffId: member._id }));
          setBusy(null);
          setConfirm(null);
          if (r) setTemp(r);
        }}
      />
      <Sheet
        open={!!temp}
        onOpenChange={(o) => {
          if (!o) {
            setTemp(null);
            onClose();
          }
        }}
        title="Temporary password"
        description="Shown once. Give it to them in person or by phone."
      >
        {temp && (
          <div className="flex flex-col gap-4 pb-4">
            <div className="rounded-md bg-elevated p-4">
              <p className="text-caption text-fg-2">Email</p>
              <p className="font-medium">{temp.email}</p>
              <p className="mt-3 text-caption text-fg-2">Temporary password</p>
              <p className="font-mono text-heading tracking-wider select-all">{temp.tempPassword}</p>
            </div>
            <Button onClick={() => copy(temp.tempPassword, "Password copied")}>
              <Copy className="size-4" /> Copy password
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
