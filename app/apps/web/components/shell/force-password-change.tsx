"use client";
import { api } from "@drink/backend/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { LogoTile } from "@/components/ui/misc";
import { toAppError } from "@/lib/errors";

/** Shown after the artist issues a temporary password: the manager must pick their own before continuing. */
export function ForcePasswordChange({ name }: { name: string }) {
  const change = useAction(api.staff.changePassword);
  const { signOut } = useAuthActions();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await change({ newPassword: pw });
      toast("Password updated");
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[400px]">
        <LogoTile size={56} className="mb-6" />
        <h1 className="text-heading font-semibold">Choose a new password</h1>
        <p className="mt-1 mb-6 text-label text-fg-2">Hi {name.split(" ")[0]}, you signed in with a temporary password. Set your own to continue.</p>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Input label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters." />
          <Input label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && (
            <p className="flex items-start gap-2 text-label text-accent-fg" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          <Button type="submit" variant="primary" block loading={busy}>
            Save password
          </Button>
        </form>
        <div className="mt-6 text-center">
          <LinkButton onClick={() => void signOut()}>Sign out</LinkButton>
        </div>
      </Card>
    </main>
  );
}
