"use server";
import { api } from "@drink/backend/api";
import { ConvexError } from "convex/values";
import { fetchMutation } from "convex/nextjs";
import { headers } from "next/headers";

export type ActionResult = { ok: true; rating?: number } | { ok: false; code?: string; message: string };

function toResult(e: unknown): ActionResult {
  if (e instanceof ConvexError) {
    const d = e.data as { code?: string; message?: string };
    return { ok: false, code: d.code, message: d.message ?? "Something went wrong." };
  }
  return { ok: false, message: "Couldn't send that. Check your connection and try again." };
}

export async function submitConsentAction(input: {
  token: string;
  confirmedAdult: boolean;
  healthAnswers: Record<string, unknown>;
  aftercareAck: boolean;
  photoPermission: boolean;
  dataProcessingConsent: boolean;
  signatureName: string;
}): Promise<ActionResult> {
  try {
    const userAgent = (await headers()).get("user-agent") ?? undefined;
    await fetchMutation(api.public.submitConsent, { ...input, userAgent });
    return { ok: true };
  } catch (e) {
    return toResult(e);
  }
}

export async function submitFeedbackAction(input: { token: string; rating: number; comment?: string }): Promise<ActionResult> {
  try {
    const r = await fetchMutation(api.public.submitFeedback, input);
    return { ok: true, rating: r.rating };
  } catch (e) {
    return toResult(e);
  }
}
