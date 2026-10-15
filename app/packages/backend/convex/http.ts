import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

/**
 * Africa's Talking delivery reports (TRD §5.4). AT callbacks are unsigned, so the
 * URL registered in the AT dashboard carries ?secret=SMS_WEBHOOK_SECRET.
 */
http.route({
  path: "/sms/delivery",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = new URL(req.url).searchParams.get("secret");
    if (!process.env.SMS_WEBHOOK_SECRET || secret !== process.env.SMS_WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    const ct = req.headers.get("content-type") ?? "";
    const data: Record<string, string> = ct.includes("json")
      ? await req.json()
      : Object.fromEntries(new URLSearchParams(await req.text()));
    if (!data.id || !data.status) return new Response("bad request", { status: 400 });
    await ctx.runMutation(internal.messages.applyDeliveryReport, {
      providerId: data.id,
      status: data.status,
      failureReason: data.failureReason,
    });
    return new Response("ok");
  }),
});

export default http;
