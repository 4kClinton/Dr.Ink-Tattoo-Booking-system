import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { DAY_MS, TIME_ZONE } from "./constants";

/**
 * All instants are UTC epoch ms. Everything human-facing is Africa/Nairobi (EAT).
 * Never use the host's local time — Convex runs in UTC, browsers anywhere.
 */

export interface EATParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

export function toEAT(ms: number): EATParts {
  const z = toZonedTime(ms, TIME_ZONE);
  return {
    year: z.getFullYear(),
    month: z.getMonth() + 1,
    day: z.getDate(),
    hour: z.getHours(),
    minute: z.getMinutes(),
    weekday: z.getDay(),
  };
}

export function fromEATParts(year: number, month: number, day: number, hour = 0, minute = 0): number {
  const pad = (n: number) => String(n).padStart(2, "0");
  return fromZonedTime(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`, TIME_ZONE).getTime();
}

export function startOfDayEAT(ms: number): number {
  const p = toEAT(ms);
  return fromEATParts(p.year, p.month, p.day);
}

/** Add whole calendar days in EAT (DST-safe even though Kenya has none). */
export function addDaysEAT(ms: number, days: number): number {
  const p = toEAT(ms);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return fromEATParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), p.hour, p.minute);
}

/** The instant at `hour:minute` EAT on the EAT calendar day containing `ms`. */
export function atHourEAT(ms: number, hour: number, minute = 0): number {
  const p = toEAT(ms);
  return fromEATParts(p.year, p.month, p.day, hour, minute);
}

/** "YYYY-MM-DD" in EAT. */
export function dateKeyEAT(ms: number): string {
  return formatInTimeZone(ms, TIME_ZONE, "yyyy-MM-dd");
}

export function fromDateKey(key: string, minutesFromMidnight = 0): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return fromEATParts(y, m, d, Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60);
}

export function minutesOfDayEAT(ms: number): number {
  const p = toEAT(ms);
  return p.hour * 60 + p.minute;
}

/** "Thu 16 Oct" */
export function formatDateShort(ms: number): string {
  return formatInTimeZone(ms, TIME_ZONE, "EEE d MMM");
}

/** "Thu 16 Oct 2026" */
export function formatDateLong(ms: number): string {
  return formatInTimeZone(ms, TIME_ZONE, "EEE d MMM yyyy");
}

/** Staff UI: 24h "14:30" */
export function formatTime24(ms: number): string {
  return formatInTimeZone(ms, TIME_ZONE, "HH:mm");
}

/** Client SMS: "2:30 PM" */
export function formatTime12(ms: number): string {
  return formatInTimeZone(ms, TIME_ZONE, "h:mm a");
}

export function formatEAT(ms: number, pattern: string): string {
  return formatInTimeZone(ms, TIME_ZONE, pattern);
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Quiet hours (default 21:00–07:00 EAT): any send time inside the window
 * moves to the next `end` hour.
 */
export function applyQuietHours(sendAt: number, start = 21, end = 7): number {
  const { hour } = toEAT(sendAt);
  const inQuiet = start > end ? hour >= start || hour < end : hour >= start && hour < end;
  if (!inQuiet) return sendAt;
  const base = hour >= start && start > end ? sendAt + DAY_MS : sendAt;
  return atHourEAT(base, end);
}

/** Day-before reminder instant, or null when it is already in the past. */
export function reminderTime(startAt: number, hour: number, now: number): number | null {
  const t = atHourEAT(addDaysEAT(startAt, -1), hour);
  return t > now ? t : null;
}

/** Post-session follow-up at 10:00 EAT, `days` after completion. */
export function followUpTime(completedAt: number, days: number, hour = 10): number {
  return atHourEAT(addDaysEAT(completedAt, days), hour);
}

/** Age in whole years on `atMs`, from "YYYY-MM-DD". */
export function ageOn(dateOfBirth: string, atMs: number): number {
  const [y, m, d] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const now = toEAT(atMs);
  let age = now.year - y;
  if (now.month < m || (now.month === m && now.day < d)) age--;
  return age;
}
