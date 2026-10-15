"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import {
  dateKeyEAT, formatDateShort, formatEAT, fromDateKey, LOCATION_LABEL, renderTemplate, SAMPLE_VARS,
  settingsInputSchema, smsSegments,
} from "@drink/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction, useMutation, useQuery } from "convex/react";
import { Monitor, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Markdown } from "@/components/markdown";
import { SmsSection } from "@/components/settings/sms-section";
import { TeamSection } from "@/components/settings/team-section";
import { useCan, useIsArtist } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput, PhoneInput } from "@/components/ui/money-input";
import { PageTitle, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

async function run(fn: () => Promise<unknown>, ok: string) {
  try {
    await fn();
    toast(ok);
    return true;
  } catch (e) {
    toast(toAppError(e).message);
    return false;
  }
}

const SECTIONS = [
  ["deposits", "Deposits"],
  ["terms", "Terms & Conditions"],
  ["templates", "Message templates"],
  ["sms", "SMS"],
  ["schedule", "Schedule"],
  ["availability", "Availability"],
  ["business", "Business"],
  ["team", "Team & access"],
  ["appearance", "Appearance"],
  ["profile", "Your profile"],
] as const;

export default function SettingsPage() {
  const isArtist = useIsArtist();
  const canTemplates = useCan("templates.edit");
  const canAvailability = useCan("availability.manage");
  const visible = SECTIONS.filter(
    ([id]) =>
      isArtist ||
      id === "appearance" ||
      id === "profile" ||
      (id === "templates" && canTemplates) ||
      (id === "availability" && canAvailability),
  );
  return (
    <div className="mx-auto max-w-[960px] lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
      <nav className="sticky top-8 hidden self-start lg:block" aria-label="Settings sections">
        <PageTitle>Settings</PageTitle>
        <ul className="flex flex-col gap-1">
          {visible.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-md px-3 py-2 text-label text-fg-2 hover:bg-hover hover:text-fg">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-col gap-8">
        {isArtist && <BusinessSettings />}
        {isArtist && <TermsSection />}
        {canTemplates && <TemplatesSection />}
        {isArtist && <SmsSection />}
        {canAvailability && <AvailabilitySection />}
        {isArtist && <TeamSection />}
        <AppearanceSection />
        <ProfileSection />
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-heading font-semibold tracking-[-0.01em]">{title}</h2>
      {description && <p className="mt-0.5 mb-3 text-label text-fg-2">{description}</p>}
      <Card className={cn(!description && "mt-3")}>{children}</Card>
    </section>
  );
}

// ───────────── Deposits + Schedule + Business (one settings document) ─────────────

type SettingsForm = z.input<typeof settingsInputSchema>;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function BusinessSettings() {
  const s = useQuery(api.settings.get);
  const update = useMutation(api.settings.update);
  const form = useForm<SettingsForm>({ resolver: zodResolver(settingsInputSchema) });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  useEffect(() => {
    if (s)
      reset({
        depositPercent: s.depositPercent,
        minDepositKes: s.minDepositKes,
        rescheduleLimit: s.rescheduleLimit,
        reminderHourDayBefore: s.reminderHourDayBefore,
        artistDigestHour: s.artistDigestHour,
        quietHoursStart: s.quietHoursStart,
        quietHoursEnd: s.quietHoursEnd,
        businessWhatsapp: s.businessWhatsapp,
        googleReviewUrl: s.googleReviewUrl ?? "",
        instagramHandle: s.instagramHandle ?? "",
      });
  }, [s, reset]);

  if (!s) return <Skeleton className="h-64" />;
  const save = handleSubmit((v) => run(() => update(settingsInputSchema.parse(v)), "Settings saved").then(() => reset(v)));
  const pct = watch("depositPercent") ?? s.depositPercent;
  const err = (k: keyof SettingsForm) => formState.errors[k]?.message as string | undefined;

  const saveBar = formState.isDirty && (
    <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-md border border-line bg-elevated p-3 shadow-sheet lg:bottom-4">
      <span className="text-label text-fg-2">Unsaved changes</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => reset()}>
          Discard
        </Button>
        <Button size="sm" variant="primary" onClick={save} loading={formState.isSubmitting}>
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Section id="deposits" title="Deposits" description="Snapshotted onto each booking when it's created.">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-medium">Deposit %</span>
            <div className="flex items-center gap-3">
              <Button size="sm" type="button" aria-label="Decrease" onClick={() => setValue("depositPercent", Math.max(5, pct - 5), { shouldDirty: true })}>
                −
              </Button>
              <span className="money w-16 text-center text-heading">{pct}%</span>
              <Button size="sm" type="button" aria-label="Increase" onClick={() => setValue("depositPercent", Math.min(100, pct + 5), { shouldDirty: true })}>
                +
              </Button>
            </div>
            {err("depositPercent") && <p className="text-caption text-accent-fg">{err("depositPercent")}</p>}
          </div>
          <MoneyInput
            label="Minimum deposit"
            optional
            hint="For small pieces, e.g. KES 2,000."
            value={watch("minDepositKes") ?? null}
            onValueChange={(v) => setValue("minDepositKes", v ?? undefined, { shouldDirty: true })}
          />
          <Input
            label="Reschedules allowed before the deposit is forfeited"
            inputMode="numeric"
            {...register("rescheduleLimit", { valueAsNumber: true })}
            error={err("rescheduleLimit")}
          />
        </div>
      </Section>

      <Section id="schedule" title="Schedule" description="All times are Nairobi time (EAT).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Day-before reminder" {...register("reminderHourDayBefore", { valueAsNumber: true })}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </Select>
          <Select label="Artist day summary" {...register("artistDigestHour", { valueAsNumber: true })}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </Select>
          <Select label="Quiet hours start" hint="No SMS goes out between these times." {...register("quietHoursStart", { valueAsNumber: true })}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </Select>
          <Select label="Quiet hours end" {...register("quietHoursEnd", { valueAsNumber: true })}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section id="business" title="Business">
        <div className="flex flex-col gap-4">
          <Input
            label="Business WhatsApp"
            inputMode="tel"
            hint="Format 2547XXXXXXXX. Used in wa.me links in client SMS."
            {...register("businessWhatsapp")}
            error={err("businessWhatsapp")}
          />
          <Input label="Google review link" optional type="url" {...register("googleReviewUrl")} error={err("googleReviewUrl")} />
          <Input label="Instagram handle" optional prefix="@" {...register("instagramHandle")} error={err("instagramHandle")} />
        </div>
      </Section>
      {saveBar}
    </>
  );
}

// ───────────── Terms (L-1) ─────────────

function TermsSection() {
  const versions = useQuery(api.settings.termsList);
  const publish = useMutation(api.settings.publishTerms);
  const [body, setBody] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  const current = versions?.[0];
  useEffect(() => {
    if (current && body === null) setBody(current.body);
  }, [current, body]);
  if (!versions) return <Skeleton className="h-64" />;
  const changed = body !== null && body.trim() !== current?.body.trim();
  return (
    <Section id="terms" title="Terms & Conditions" description="Each booking links to the version in force when it was booked.">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Segmented
          label="Editor mode"
          size="sm"
          value={tab}
          onChange={setTab}
          className="w-48"
          options={[
            { value: "edit", label: "Edit" },
            { value: "preview", label: "Preview" },
          ]}
        />
        {current && (
          <span className="text-caption text-fg-2">
            v{current.version} · {formatDateShort(current.publishedAt)}
          </span>
        )}
      </div>
      {tab === "edit" ? (
        <Textarea aria-label="Terms (markdown)" rows={14} value={body ?? ""} onChange={(e) => setBody(e.target.value)} className="font-mono text-label" />
      ) : (
        <div className="max-h-[480px] max-w-[65ch] overflow-y-auto rounded-md border border-line p-4">
          <Markdown source={body ?? ""} />
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-caption text-fg-3">{versions.length} version{versions.length === 1 ? "" : "s"} kept</span>
        <Button
          disabled={!changed}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await run(() => publish({ body: body ?? "" }), `Published v${(current?.version ?? 0) + 1}`);
            setBusy(false);
          }}
        >
          Publish v{(current?.version ?? 0) + 1}
        </Button>
      </div>
    </Section>
  );
}

// ───────────── Templates ─────────────

function TemplatesSection() {
  const templates = useQuery(api.settings.templates);
  const [editing, setEditing] = useState<string | null>(null);
  if (!templates) return <Skeleton className="h-64" />;
  const t = templates.find((x) => x.key === editing);
  return (
    <Section id="templates" title="Message templates" description="Keep client messages to one SMS (160 characters) where you can.">
      <ul className="-my-2 flex flex-col divide-y divide-line">
        {templates.map((tp) => {
          const seg = smsSegments(renderTemplate(tp.body, SAMPLE_VARS));
          return (
            <li key={tp.key}>
              <button onClick={() => setEditing(tp.key)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-hover">
                <div className="min-w-0">
                  <p className="font-medium">{tp.label}</p>
                  <p className="text-caption text-fg-3">{tp.trigger}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!tp.enabled && <StatusChip kind="neutral">Off</StatusChip>}
                  <span className={cn("text-caption tabular", seg.segments > 1 ? "text-warning" : "text-fg-2")}>
                    {seg.segments} SMS
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {t && <TemplateEditor key={t.key} t={t} onClose={() => setEditing(null)} />}
    </Section>
  );
}

function TemplateEditor({
  t,
  onClose,
}: {
  t: { key: string; label: string; trigger: string; body: string; defaultBody: string; enabled: boolean; variables: readonly string[] };
  onClose: () => void;
}) {
  const save = useMutation(api.settings.updateTemplate);
  const [body, setBody] = useState(t.body);
  const [enabled, setEnabled] = useState(t.enabled);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const rendered = renderTemplate(body, SAMPLE_VARS);
  const seg = smsSegments(rendered);

  function insert(v: string) {
    const el = ref.current;
    const token = `{${v}}`;
    if (!el) return setBody((b) => b + token);
    const { selectionStart: a, selectionEnd: b } = el;
    const next = body.slice(0, a) + token + body.slice(b);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t.label}
      description={t.trigger}
      footer={
        <Button
          variant="primary"
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            if (await run(() => save({ key: t.key, body, enabled }), "Template saved")) onClose();
            setBusy(false);
          }}
        >
          Save template
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-label">
          <input type="checkbox" className="size-4 accent-[var(--text)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Send this message
        </label>
        <Textarea ref={ref} label="Message" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap gap-2" aria-label="Insert variable">
          {t.variables.map((v) => (
            <button key={v} type="button" onClick={() => insert(v)} className="h-8 rounded-full border border-line-strong px-3 text-caption font-medium tabular hover:bg-hover">
              {`{${v}}`}
            </button>
          ))}
        </div>
        <div>
          <p className={cn("mb-1 text-caption font-medium tabular", seg.chars > seg.perSegment ? "text-warning" : "text-fg-2")} aria-live="polite">
            {seg.chars} / {seg.perSegment} · {seg.segments} SMS{seg.encoding === "UCS-2" ? " · emoji/special characters use more space" : ""}
          </p>
          <div className="rounded-md bg-elevated p-3 text-label">
            <p className="mb-1 text-caption text-fg-3">Preview with sample data</p>
            {rendered}
          </div>
        </div>
        {body !== t.defaultBody && (
          <button type="button" className="self-start text-label font-semibold underline-offset-4 hover:underline" onClick={() => setBody(t.defaultBody)}>
            Reset to default
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ───────────── Availability (A-1/A-2/A-3) ─────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function AvailabilitySection() {
  const data = useQuery(api.availability.list);
  const setWeekly = useMutation(api.availability.setWeekly);
  const addRange = useMutation(api.availability.addRange);
  const remove = useMutation(api.availability.remove);
  const [week, setWeek] = useState<Record<number, { on: boolean; start: string; end: string }> | null>(null);
  const [range, setRange] = useState({ kind: "block" as "block" | "tour", from: dateKeyEAT(Date.now()), to: dateKeyEAT(Date.now()), location: "kericho", note: "" });

  useEffect(() => {
    if (data && !week) {
      const w: Record<number, { on: boolean; start: string; end: string }> = {};
      for (let d = 0; d < 7; d++) {
        const row = data.weekly.find((r) => r.weekday === d);
        w[d] = row ? { on: true, start: toHHMM(row.startMin ?? 600), end: toHHMM(row.endMin ?? 1140) } : { on: false, start: "10:00", end: "19:00" };
      }
      setWeek(w);
    }
  }, [data, week]);

  if (!data || !week) return <Skeleton className="h-64" />;
  const ranges = [...data.blocks, ...data.tours].filter((r) => (r.to ?? 0) > Date.now()).sort((a, b) => (a.from ?? 0) - (b.from ?? 0));

  return (
    <Section id="availability" title="Availability" description="Working hours, off days and tour blocks. Bookings outside these show a warning.">
      <SectionLabel className="mb-2">Weekly hours</SectionLabel>
      <ul className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const w = week[d]!;
          return (
            <li key={d} className="grid grid-cols-[72px_1fr] items-center gap-3">
              <label className="flex items-center gap-2 text-label font-medium">
                <input type="checkbox" className="size-4 accent-[var(--text)]" checked={w.on} onChange={(e) => setWeek({ ...week, [d]: { ...w, on: e.target.checked } })} />
                {DAYS[d]}
              </label>
              {w.on ? (
                <div className="flex items-center gap-2">
                  <input type="time" step={900} value={w.start} onChange={(e) => setWeek({ ...week, [d]: { ...w, start: e.target.value } })} className="h-10 rounded-md border border-line bg-surface px-2 tabular" aria-label={`${DAYS[d]} start`} />
                  <span className="text-fg-3">–</span>
                  <input type="time" step={900} value={w.end} onChange={(e) => setWeek({ ...week, [d]: { ...w, end: e.target.value } })} className="h-10 rounded-md border border-line bg-surface px-2 tabular" aria-label={`${DAYS[d]} end`} />
                </div>
              ) : (
                <span className="text-label text-fg-3">Off</span>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        className="mt-4"
        onClick={() =>
          run(
            () =>
              setWeekly({
                days: Object.entries(week)
                  .filter(([, w]) => w.on)
                  .map(([d, w]) => ({ weekday: Number(d), startMin: fromHHMM(w.start), endMin: fromHHMM(w.end) })),
              }),
            "Working hours saved",
          )
        }
      >
        Save hours
      </Button>

      <SectionLabel className="mt-8 mb-2">Blocked dates & tours</SectionLabel>
      {ranges.length ? (
        <ul className="mb-4 flex flex-col divide-y divide-line">
          {ranges.map((r) => (
            <li key={r._id} className="flex items-center justify-between gap-3 py-2 text-label">
              <span>
                <span className="font-medium">
                  {r.kind === "tour" ? `${LOCATION_LABEL[r.location as keyof typeof LOCATION_LABEL] ?? r.location} tour` : "Off"}
                </span>{" "}
                · {formatEAT(r.from!, "d MMM")} – {formatEAT(r.to! - 1, "d MMM")}
                {r.note && <span className="text-fg-2"> · {r.note}</span>}
              </span>
              <button onClick={() => run(() => remove({ id: r._id as Id<"availability"> }), "Removed")} className="rounded-sm p-2 text-fg-3 hover:bg-hover hover:text-fg" aria-label="Remove">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-label text-fg-2">No upcoming blocks.</p>
      )}
      <div className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-2">
        <Segmented
          label="Block type"
          size="sm"
          className="sm:col-span-2"
          value={range.kind}
          onChange={(kind) => setRange({ ...range, kind })}
          options={[
            { value: "block", label: "Off days" },
            { value: "tour", label: "Tour" },
          ]}
        />
        <Input label="From" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input label="To" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        {range.kind === "tour" && (
          <Select label="Location" value={range.location} onChange={(e) => setRange({ ...range, location: e.target.value })}>
            <option value="kericho">Kericho</option>
            <option value="nairobi">Nairobi</option>
            <option value="other">Other</option>
          </Select>
        )}
        <Input label="Note" optional value={range.note} onChange={(e) => setRange({ ...range, note: e.target.value })} placeholder={range.kind === "tour" ? "Kericho pop-up" : "Travel"} />
        <Button
          className="sm:col-span-2"
          onClick={() =>
            run(
              () =>
                addRange({
                  kind: range.kind,
                  from: fromDateKey(range.from),
                  to: fromDateKey(range.to),
                  location: range.kind === "tour" ? range.location : undefined,
                  note: range.note || undefined,
                }),
              range.kind === "tour" ? "Tour added" : "Dates blocked",
            )
          }
        >
          <Plus className="size-4" /> Add {range.kind === "tour" ? "tour" : "block"}
        </Button>
      </div>
    </Section>
  );
}

// ───────────── Appearance + profile (all staff) ─────────────

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Section id="appearance" title="Appearance">
      <Segmented
        label="Theme"
        value={(mounted ? theme : "system") as "system" | "light" | "dark"}
        onChange={setTheme}
        options={[
          { value: "system", label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-4" /> System</span> },
          { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun className="size-4" /> Light</span> },
          { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon className="size-4" /> Dark</span> },
        ]}
      />
    </Section>
  );
}

function ProfileSection() {
  const me = useQuery(api.staff.me);
  const updateMe = useMutation(api.staff.updateMe);
  const [f, setF] = useState<{ name: string; phone: string } | null>(null);
  useEffect(() => {
    if (me && !f) setF({ name: me.name, phone: me.phone.replace(/^\+254/, "0") });
  }, [me, f]);
  if (!me || !f) return <Skeleton className="h-40" />;
  return (
    <Section id="profile" title="Your profile" description={me.email ?? undefined}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <PhoneInput label="Mobile" hint="Booking SMS for you are sent here." value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Button className="self-start" onClick={() => run(() => updateMe(f), "Profile saved")}>
          Save profile
        </Button>
        <ChangePassword />
      </div>
    </Section>
  );
}

function ChangePassword() {
  const change = useAction(api.staff.changePassword);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const mismatch = f.confirm.length > 0 && f.next !== f.confirm;
  return (
    <>
      <Button className="self-start" variant="ghost" onClick={() => setOpen(true)}>
        Change password
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Change password"
        footer={
          <Button
            variant="primary"
            block
            loading={busy}
            disabled={!f.current || f.next.length < 8 || f.next !== f.confirm}
            onClick={async () => {
              setBusy(true);
              const ok = await run(() => change({ currentPassword: f.current, newPassword: f.next }), "Password changed");
              setBusy(false);
              if (ok) {
                setOpen(false);
                setF({ current: "", next: "", confirm: "" });
              }
            }}
          >
            Save password
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Current password" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
          <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={f.confirm}
            onChange={(e) => setF({ ...f, confirm: e.target.value })}
            error={mismatch ? "The passwords don't match." : null}
          />
        </div>
      </Sheet>
    </>
  );
}
