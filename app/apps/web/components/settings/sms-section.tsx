"use client";
import { api } from "@drink/backend/api";
import { formatPhone } from "@drink/shared";
import { useAction } from "convex/react";
import { AlertCircle, CheckCircle2, Copy, RefreshCw, Send, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { StatusChip } from "@/components/ui/status-chip";
import { toAppError } from "@/lib/errors";

type Status = Awaited<ReturnType<ReturnType<typeof useAction<typeof api.smsAdmin.status>>>>;

/** Artist-only: Africa's Talking connection status, balance, test send and delivery-report URL. */
export function SmsSection() {
  const getStatus = useAction(api.smsAdmin.status);
  const sendTest = useAction(api.smsAdmin.sendTest);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getStatus({}));
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setLoading(false);
    }
  }, [getStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section id="sms" className="scroll-mt-20">
      <h2 className="text-heading font-semibold tracking-[-0.01em]">SMS</h2>
      <p className="mt-0.5 mb-3 text-label text-fg-2">Africa&apos;s Talking connection for confirmations, reminders and follow-ups.</p>
      <Card>
        {!status ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {status.mode === "dev" ? (
                <StatusChip kind="warning" icon={Wrench}>
                  Not connected · messages are only logged
                </StatusChip>
              ) : status.error ? (
                <StatusChip kind="warning" icon={AlertCircle}>
                  Connection problem
                </StatusChip>
              ) : (
                <StatusChip kind="success" icon={CheckCircle2}>
                  {status.mode === "sandbox" ? "Connected · sandbox" : "Connected · live"}
                </StatusChip>
              )}
              <Button size="sm" variant="ghost" onClick={refresh} loading={loading} aria-label="Refresh status">
                <RefreshCw className="size-3.5" />
              </Button>
            </div>

            <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-label">
              <dt className="text-fg-2">Username</dt>
              <dd>{status.username ?? <span className="text-warning">not set</span>}</dd>
              <dt className="text-fg-2">API key</dt>
              <dd>{status.hasKey ? "set" : <span className="text-warning">not set</span>}</dd>
              <dt className="text-fg-2">Sender ID</dt>
              <dd>{status.senderId ?? <span className="text-fg-3">AT default (until “DR_INK” is approved)</span>}</dd>
              {status.balance && (
                <>
                  <dt className="text-fg-2">Balance</dt>
                  <dd className="money">{status.balance}</dd>
                </>
              )}
            </dl>

            {status.error && (
              <p className="flex items-start gap-2 text-label text-accent-fg" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {status.error}
              </p>
            )}

            {status.mode !== "dev" && !status.error && (
              <Button
                className="self-start"
                loading={sending}
                onClick={async () => {
                  setSending(true);
                  try {
                    const r = await sendTest({});
                    toast(`Test SMS sent to ${formatPhone(r.to)} · check Messages for delivery`);
                  } catch (e) {
                    toast(toAppError(e).message);
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <Send className="size-4" /> Send test SMS to me
              </Button>
            )}

            {status.deliveryCallbackUrl && (
              <div>
                <p className="mb-1 text-label font-medium">Delivery reports callback</p>
                <p className="mb-2 text-caption text-fg-2">
                  Paste this in the Africa&apos;s Talking dashboard → SMS → SMS Callback URLs → Delivery Reports. It contains a secret, so
                  don&apos;t share it.
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-elevated px-3 py-2 text-caption">{status.deliveryCallbackUrl}</code>
                  <Button
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(status.deliveryCallbackUrl!);
                      toast("Callback URL copied");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
