export function cn(...parts: (string | false | null | undefined | 0)[]) {
  return parts.filter(Boolean).join(" ");
}
