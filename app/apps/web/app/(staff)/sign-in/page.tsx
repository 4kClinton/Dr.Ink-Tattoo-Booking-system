"use client";
import { api } from "@drink/backend/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { normalizeKenyanPhone } from "@drink/shared";
import { useConvex, useConvexAuth } from "convex/react";
import { AlertCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/money-input";
import { LogoTile } from "@/components/ui/misc";

type Mode = "signIn" | "setup" | "invite";

function SignInInner() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  // One-shot check with retries. A slow backend must never crash the sign-in screen;
  // if it can't answer, we just show normal sign-in.
  const [needsSetup, setNeedsSetup] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const v = await convex.query(api.staff.needsSetup, {});
          if (!cancelled) setNeedsSetup(v);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex]);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const inviteToken = params.get("invite");
  const [invite, setInvite] = useState<
    { state: "ok"; name: string; email: string } | { state: "invalid" | "used" | "expired" } | undefined
  >(undefined);
  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const v = await convex.query(api.staff.inviteInfo, { token: inviteToken });
          if (!cancelled) setInvite(v);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex, inviteToken]);
  const [mode, setMode] = useState<Mode>(inviteToken ? "invite" : "signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (needsSetup && !inviteToken) setMode("setup");
  }, [needsSetup, inviteToken]);
  useEffect(() => {
    if (isAuthenticated) router.replace(next.startsWith("/") ? next : "/");
  }, [isAuthenticated, next, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (mode === "setup") {
      const phone = normalizeKenyanPhone(String(fd.get("phone") ?? ""));
      if (!phone) return setError("Enter a Kenyan mobile number, e.g. 0712 345 678.");
      fd.set("phone", phone);
    }
    if (mode !== "signIn" && String(fd.get("password")).length < 8) {
      return setError("Use at least 8 characters for your password.");
    }
    if (mode === "invite") {
      if (invite?.state !== "ok" || !inviteToken) return setError("This invite link isn't valid any more.");
      fd.set("email", invite.email);
      fd.set("inviteToken", inviteToken);
    }
    fd.set("flow", mode === "signIn" ? "signIn" : "signUp");
    setPending(true);
    try {
      await signIn("password", fd);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/TooManyFailedAttempts/.test(msg)) {
        setError("Too many attempts. Wait a few minutes and try again.");
        return;
      }
      const badCredentials = /InvalidSecret|InvalidAccountId|Invalid credentials/i.test(msg);
      if (!badCredentials && /timed out|Server Error|Failed to fetch|network/i.test(msg) && !/NOT_INVITED|exists/i.test(msg)) {
        setError("The server is busy or unreachable. Wait a few seconds and try again.");
      } else if (mode === "signIn") setError("That email and password don't match.");
      else if (/expired/i.test(msg)) setError("This invite link has expired. Ask the artist to send a new one.");
      else if (/NOT_INVITED|invited|invite/i.test(msg)) setError("This invite link isn't valid. Ask the artist to send a new one.");
      else if (/already exists|exists/i.test(msg)) setError("An account with this email already exists. Sign in instead.");
      else setError("Couldn't create the account. Check your details and try again.");
    } finally {
      setPending(false);
    }
  }

  const heading =
    mode === "setup"
      ? "Set up the studio"
      : mode === "invite"
        ? invite?.state === "ok"
          ? `Welcome, ${invite.name.split(" ")[0]}`
          : "Your invite"
        : "Sign in";
  const inviteProblem =
    mode === "invite" && invite && invite.state !== "ok"
      ? invite.state === "used"
        ? "This invite has already been used. Sign in with your email and password."
        : invite.state === "expired"
          ? "This invite link has expired. Ask the artist to send you a new one."
          : "This invite link isn't valid. Check you opened the whole link, or ask the artist for a new one."
      : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-start gap-4">
          <LogoTile size={56} />
          <div>
            <h1 className="text-heading font-semibold tracking-[-0.01em]">{heading}</h1>
            {mode === "setup" && (
              <p className="mt-1 text-label text-fg-2">The first account is the artist (owner). You&apos;ll invite your manager from Settings.</p>
            )}
            {mode === "invite" && invite?.state === "ok" && (
              <p className="mt-1 text-label text-fg-2">Choose a password to finish setting up your manager account.</p>
            )}
          </div>
        </div>
        {inviteProblem ? (
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 text-label text-fg-2" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {inviteProblem}
            </p>
            <Button block onClick={() => { setMode("signIn"); setError(null); router.replace("/sign-in"); }}>
              Go to sign in
            </Button>
          </div>
        ) : mode === "invite" && invite === undefined ? (
          <p className="text-label text-fg-2">Checking your invite…</p>
        ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {mode === "setup" && (
            <>
              <Input name="name" label="Your name" autoComplete="name" required />
              <PhoneInput name="phone" label="Mobile number" hint="Booking alerts are texted here." required />
            </>
          )}
          {mode === "invite" && invite?.state === "ok" ? (
            <Input label="Email" type="email" autoComplete="username" value={invite.email} readOnly hint="You'll sign in with this." />
          ) : (
            <Input name="email" type="email" label="Email" autoComplete="email" required />
          )}
          <Input
            name="password"
            type="password"
            label="Password"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            hint={mode !== "signIn" ? "At least 8 characters." : undefined}
            required
          />
          {error && (
            <p className="flex items-start gap-2 text-label text-accent-fg" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          <Button type="submit" variant="primary" block loading={pending}>
            {mode === "signIn" ? "Sign in" : "Create account"}
          </Button>
        </form>
        )}
        {mode === "signIn" && !needsSetup && (
          <p className="mt-6 text-center text-caption text-fg-3">New manager? Open the invite link the artist texted you.</p>
        )}
        {mode === "invite" && invite?.state === "ok" && (
          <div className="mt-6 text-center">
            <LinkButton onClick={() => { setMode("signIn"); setError(null); }}>I already have an account</LinkButton>
          </div>
        )}
      </Card>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInInner />
    </Suspense>
  );
}
