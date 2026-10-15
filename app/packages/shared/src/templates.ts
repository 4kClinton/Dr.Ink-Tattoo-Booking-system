/**
 * SMS templates (PRD §5.6, UI-UX-SPEC §6). Artist-editable; these are the defaults seeded on setup.
 * Keep client SMS ≤ 160 GSM-7 chars where possible — 2 segments doubles the cost.
 */
export const TEMPLATE_KEYS = [
  "confirmed_client",
  "confirmed_artist",
  "rescheduled_client",
  "rescheduled_artist",
  "cancelled_client",
  "cancelled_artist",
  "reminder_client",
  "reminder_artist",
  "digest_artist",
  "aftercare_client",
  "healed_client",
  "touchup_client",
  "low_rating_artist",
  "staff_invite",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface TemplateMeta {
  label: string;
  trigger: string;
  recipient: "client" | "artist" | "manager";
  /** Booking status the job requires at send time; if it changed, the job exits. */
  requiresStatus?: "confirmed" | "completed";
  marketing?: boolean;
  variables: readonly string[];
  body: string;
}

export const TEMPLATES: Record<TemplateKey, TemplateMeta> = {
  confirmed_client: {
    label: "Confirmation — client",
    trigger: "M-1 · Booking created",
    recipient: "client",
    requiresStatus: "confirmed",
    variables: ["firstName", "date", "time", "location", "deposit", "link"],
    body: "Hi {firstName}, your Dr.Ink session is booked for {date} {time}, {location}. Deposit KES {deposit} received. Consent & terms: {link}",
  },
  confirmed_artist: {
    label: "Confirmation — artist",
    trigger: "M-1 · Booking created",
    recipient: "artist",
    variables: ["clientName", "date", "time", "location", "tattooShort", "balance"],
    body: "New booking: {clientName}, {date} {time}, {location}. {tattooShort}. Bal KES {balance}.",
  },
  rescheduled_client: {
    label: "Rescheduled — client",
    trigger: "M-2 · Booking rescheduled",
    recipient: "client",
    requiresStatus: "confirmed",
    variables: ["firstName", "date", "time", "location", "whatsapp"],
    body: "Hi {firstName}, your Dr.Ink session has moved to {date} {time}, {location}. Questions? wa.me/{whatsapp}",
  },
  rescheduled_artist: {
    label: "Rescheduled — artist",
    trigger: "M-2 · Booking rescheduled",
    recipient: "artist",
    variables: ["clientName", "date", "time", "location"],
    body: "Rescheduled: {clientName} now {date} {time}, {location}.",
  },
  cancelled_client: {
    label: "Cancelled — client",
    trigger: "M-3 · Booking cancelled",
    recipient: "client",
    variables: ["firstName", "date", "whatsapp"],
    body: "Hi {firstName}, your Dr.Ink session on {date} has been cancelled. To rebook, message us: wa.me/{whatsapp}",
  },
  cancelled_artist: {
    label: "Cancelled — artist",
    trigger: "M-3 · Booking cancelled",
    recipient: "artist",
    variables: ["clientName", "date", "time", "reason"],
    body: "Cancelled: {clientName}, {date} {time}. Reason: {reason}",
  },
  reminder_client: {
    label: "Reminder — client",
    trigger: "M-4 · Day before",
    recipient: "client",
    requiresStatus: "confirmed",
    variables: ["time", "location", "whatsapp"],
    body: "Reminder: Dr.Ink session tomorrow {time}, {location}. Eat well, hydrate, no alcohol. Questions? wa.me/{whatsapp}",
  },
  reminder_artist: {
    label: "Reminder — artist",
    trigger: "M-4 · Day before",
    recipient: "artist",
    requiresStatus: "confirmed",
    variables: ["clientName", "time", "location", "tattooShort", "consent"],
    body: "Tomorrow {time}: {clientName}, {location}. {tattooShort}. Consent: {consent}.",
  },
  digest_artist: {
    label: "Day summary — artist",
    trigger: "M-5 · Morning of",
    recipient: "artist",
    variables: ["count", "sessions"],
    body: "Today: {count} session(s). {sessions}",
  },
  aftercare_client: {
    label: "Aftercare + feedback",
    trigger: "M-6 · Day after",
    recipient: "client",
    requiresStatus: "completed",
    variables: ["firstName", "link"],
    body: "Hi {firstName}, how's the new ink healing? Keep it clean & moisturised. Tell us how it went: {link}",
  },
  healed_client: {
    label: "Healed photo request",
    trigger: "M-7 · Week 3",
    recipient: "client",
    requiresStatus: "completed",
    variables: ["firstName", "whatsapp"],
    body: "Hi {firstName}! Your tattoo should be healed now. Send us a photo on WhatsApp: wa.me/{whatsapp}",
  },
  touchup_client: {
    label: "Touch-up reminder",
    trigger: "M-8 · Week 6",
    recipient: "client",
    requiresStatus: "completed",
    marketing: true,
    variables: ["firstName", "whatsapp"],
    body: "Hi {firstName}, need a touch-up on your Dr.Ink piece? Book a quick slot: wa.me/{whatsapp}",
  },
  low_rating_artist: {
    label: "Low rating alert — artist",
    trigger: "F-2 · Rating ≤ 3",
    recipient: "artist",
    variables: ["clientName", "rating", "comment"],
    body: "Feedback alert: {clientName} rated {rating}/5. {comment}",
  },
  staff_invite: {
    label: "Team invite — manager",
    trigger: "Artist invites a manager",
    recipient: "manager",
    variables: ["firstName", "artistName", "link"],
    body: "Hi {firstName}, {artistName} has added you to Dr.Ink Booking. Set up your account (link valid 7 days): {link}",
  },
};

export const ALL_VARIABLES = [
  "firstName", "clientName", "date", "time", "location", "deposit", "depositPaid",
  "balance", "link", "whatsapp", "tattooShort", "consent", "reason", "count", "sessions",
  "rating", "comment", "artistName",
] as const;

export const SAMPLE_VARS: Record<string, string> = {
  firstName: "Wanjiru",
  clientName: "Wanjiru K.",
  date: "Thu 16 Oct",
  time: "10:00 AM",
  location: "Nairobi",
  deposit: "3,000",
  depositPaid: "3,000",
  balance: "12,000",
  link: "https://drink.co.ke/c/Xk3b9QpL2mN8vR4tY7wZ1aB5cD6eF0gH2iJ3kL4mN5o",
  whatsapp: "254700000000",
  tattooShort: "Fine-line rose, left forearm",
  consent: "signed",
  reason: "Client unwell",
  count: "2",
  sessions: "10:00 Wanjiru K. (Nairobi); 14:30 Brian O. (Nairobi)",
  rating: "3",
  comment: "Took longer than expected.",
  artistName: "Clint",
};

/** Replace {var} placeholders. Unknown variables are left visible so mistakes are caught in preview. */
export function renderTemplate(body: string, vars: Record<string, string | number | undefined>): string {
  return body.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? whole : String(v);
  }).replace(/\s+/g, " ").trim();
}

// GSM 03.38 basic + extension tables. Anything else forces UCS-2 (70 chars/segment).
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

export interface SegmentInfo {
  chars: number;
  segments: number;
  encoding: "GSM-7" | "UCS-2";
  perSegment: number;
}

export function smsSegments(text: string): SegmentInfo {
  let gsmLen = 0;
  let isGsm = true;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) gsmLen += 1;
    else if (GSM_EXT.includes(ch)) gsmLen += 2;
    else { isGsm = false; break; }
  }
  if (isGsm) {
    const segments = gsmLen <= 160 ? 1 : Math.ceil(gsmLen / 153);
    return { chars: gsmLen, segments: Math.max(1, segments), encoding: "GSM-7", perSegment: 160 };
  }
  const len = [...text].length;
  const segments = len <= 70 ? 1 : Math.ceil(len / 67);
  return { chars: len, segments: Math.max(1, segments), encoding: "UCS-2", perSegment: 70 };
}
