import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * M-5 artist day summary. Convex crons run in UTC, and the digest hour is artist-configurable,
 * so we tick hourly and let `digest.run` decide whether this is the configured EAT hour.
 */
crons.hourly("artist day digest", { minuteUTC: 0 }, internal.digest.run, {});

/** Housekeeping: drop expired rate-limit windows. */
crons.daily("prune rate limits", { hourUTC: 0, minuteUTC: 30 }, internal.digest.pruneRateLimits, {});

/** Re-schedule SMS whose send job died (TRD §5.3 belt-and-braces). */
crons.interval("requeue stuck SMS", { minutes: 15 }, internal.messages.requeueStuck, {});

export default crons;
