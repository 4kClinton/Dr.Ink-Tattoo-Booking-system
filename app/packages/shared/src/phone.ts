/**
 * Kenyan mobile numbers → E.164. Accepts 0712…, 712…, 254712…, +254712…, with spaces/dashes.
 * Safaricom/Airtel/Telkom mobile ranges start with 7 or 1 after the country code.
 */
export function normalizeKenyanPhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("254")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (!/^[17]\d{8}$/.test(d)) return null;
  return `+254${d}`;
}

/** "+254712345678" → "0712 345 678" */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+254(\d{3})(\d{3})(\d{3})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** "+254712345678" → "254712345678" for wa.me links */
export function waNumber(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function waLink(phone: string, text?: string): string {
  const base = `https://wa.me/${waNumber(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** "Wanjiru Kamau" → "Wanjiru K." */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? fullName;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}
