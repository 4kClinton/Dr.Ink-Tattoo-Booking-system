"use client";
import { HEALTH_QUESTIONS } from "@drink/shared";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { submitConsentAction } from "../../actions";
import { LinkState } from "../../public-ui";

interface Session {
  firstName: string;
  date: string;
  time: string;
  weekday?: string;
  location: string;
  termsToken: string | null;
}

const WEEKDAY: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

function Check({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; error?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-md p-1", error && "text-accent-fg")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--text)]" />
      <span>{children}</span>
    </label>
  );
}

function YesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-label">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-md border border-line bg-elevated p-1">
        {[
          { v: false, l: "No" },
          { v: true, l: "Yes" },
        ].map((o) => (
          <button
            key={o.l}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn("h-9 w-12 rounded-sm text-label font-semibold", value === o.v ? "bg-surface text-fg ring-1 ring-line-strong" : "text-fg-2")}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Block({ title, children, optional }: { title: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-2 text-subhead font-semibold">
        {title} {optional && <span className="text-label font-normal text-fg-2">(optional)</span>}
      </h2>
      {children}
    </section>
  );
}

export function ConsentForm({ token, session, whatsapp }: { token: string; session: Session; whatsapp: string }) {
  const [adult, setAdult] = useState(false);
  const [health, setHealth] = useState<Record<string, boolean | null>>(Object.fromEntries(HEALTH_QUESTIONS.map((q) => [q.key, null])));
  const [details, setDetails] = useState("");
  const [aftercare, setAftercare] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [data, setData] = useState(false);
  const [signature, setSignature] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pending, start] = useTransition();

  const anyYes = Object.values(health).some((v) => v === true);
  const unanswered = Object.values(health).some((v) => v === null);
  const missing = !adult || unanswered || !aftercare || !data || signature.trim().length < 3;
  const weekday = WEEKDAY[session.weekday ?? ""] ?? session.date;

  if (done) {
    return (
      <div className="flex flex-col items-start gap-3">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <h1 className="text-heading font-semibold">You&apos;re all set.</h1>
        <p className="text-fg-2">See you {weekday}.</p>
      </div>
    );
  }
  if (expired) return <LinkState title="This link has expired." body="Message us on WhatsApp and we'll sort it out." whatsapp={whatsapp} />;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (missing) {
      setError("Please complete the highlighted items.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await submitConsentAction({
        token,
        confirmedAdult: adult,
        healthAnswers: { ...health, details: details.trim() || undefined },
        aftercareAck: aftercare,
        photoPermission: photos,
        dataProcessingConsent: data,
        signatureName: signature.trim(),
      });
      if (r.ok) setDone(true);
      else if (r.code === "TOKEN_EXPIRED" || r.code === "TOKEN_INVALID") setExpired(true);
      else if (r.code === "TOKEN_USED") setDone(true);
      else setError(r.message);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="mb-2">
        <h1 className="text-heading font-semibold">Hi {session.firstName}</h1>
        <p className="mt-1 text-fg-2">
          Before your session on {session.date} at {session.time} ({session.location}), please confirm a few things.
        </p>
      </div>

      <Block title="Age">
        <Check checked={adult} onChange={setAdult} error={tried && !adult}>
          I am 18 or older and will bring ID.
        </Check>
      </Block>

      <Block title="Health">
        <div className="divide-y divide-line">
          {HEALTH_QUESTIONS.map((q) => (
            <div key={q.key} className={cn(tried && health[q.key] === null && "text-accent-fg")}>
              <YesNo label={q.label} value={health[q.key] ?? null} onChange={(v) => setHealth({ ...health, [q.key]: v })} />
            </div>
          ))}
        </div>
        {anyYes && (
          <div className="mt-2">
            <Textarea label="If yes, tell us more" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
        )}
      </Block>

      <Block title="Aftercare">
        <p className="mb-2 text-label text-fg-2">
          Keep it clean, wash gently twice a day, moisturise thinly, no swimming, sun or scratching for 2 weeks.
        </p>
        <Check checked={aftercare} onChange={setAftercare} error={tried && !aftercare}>
          I&apos;ll follow the aftercare guide.
        </Check>
      </Block>

      <Block title="Photos" optional>
        <Check checked={photos} onChange={setPhotos}>
          Dr.Ink can share photos of my tattoo (not my face) on social media and the portfolio.
        </Check>
      </Block>

      <Block title="Your data">
        <p className="mb-2 text-label text-fg-2">
          We store your name, phone, this form and tattoo photos to run your booking, under the Kenya Data Protection Act 2019. Ask us any time
          to see or delete it.
          {session.termsToken && (
            <>
              {" "}
              <a href={`/t/${session.termsToken}`} className="font-semibold text-fg underline underline-offset-4">
                Read the terms
              </a>
            </>
          )}
        </p>
        <Check checked={data} onChange={setData} error={tried && !data}>
          I consent to Dr.Ink storing my personal data and photos.
        </Check>
      </Block>

      <Block title="Signature">
        <Input
          label="Type your full name"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          autoComplete="name"
          error={tried && signature.trim().length < 3 ? "Type your full name to sign" : null}
        />
        {signature.trim() && (
          <p className="mt-3 border-b border-line-strong pb-1 text-[22px] italic" aria-label="Signature preview">
            {signature}
          </p>
        )}
      </Block>

      {error && (
        <p className="flex items-start gap-2 text-label text-accent-fg" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
      <Button type="submit" variant="primary" block loading={pending}>
        Sign and submit
      </Button>
    </form>
  );
}
