/**
 * Roles & access control. The artist (owner) can do everything. A manager can do only what the
 * artist grants them; new managers start with MANAGER_DEFAULTS (PRD §3).
 *
 * Some things are never grantable: team & access, deposit/policy/T&C/business settings,
 * payment reversals, deposit decisions, archiving or erasing clients, deleting photos.
 */
export const PERMISSIONS = [
  {
    key: "bookings.manage",
    label: "Create and reschedule bookings",
    description: "New bookings, reschedules, tattoo details and photos.",
    group: "Bookings",
    default: true,
  },
  {
    key: "bookings.cancel",
    label: "Cancel bookings and mark no-shows",
    description: "Deposits are kept per policy; studio-side cancellations still need your decision.",
    group: "Bookings",
    default: true,
  },
  {
    key: "bookings.overrideOverlap",
    label: "Double-book over another session",
    description: "Lets them use “Book anyway” when times overlap.",
    group: "Bookings",
    default: false,
  },
  {
    key: "payments.record",
    label: "Record payments",
    description: "Deposits and balances (M-Pesa or cash). Payments can't be edited, only reversed by you.",
    group: "Money",
    default: true,
  },
  {
    key: "bookings.adjustPrice",
    label: "Adjust final prices",
    description: "Change the price at session end, with a reason.",
    group: "Money",
    default: true,
  },
  {
    key: "reports.view",
    label: "See revenue and reports",
    description: "Reports page, weekly takings and clients' lifetime spend.",
    group: "Money",
    default: false,
  },
  {
    key: "exports.csv",
    label: "Export CSV files",
    description: "Download clients, bookings and payments.",
    group: "Money",
    default: false,
  },
  {
    key: "clients.edit",
    label: "Edit client records",
    description: "Contact details, notes, flags and promo opt-out.",
    group: "Clients",
    default: true,
  },
  {
    key: "messages.resend",
    label: "Resend SMS",
    description: "Resend failed or delivered messages.",
    group: "Messages",
    default: true,
  },
  {
    key: "templates.edit",
    label: "Edit SMS templates",
    description: "Change the wording of automatic messages.",
    group: "Studio",
    default: false,
  },
  {
    key: "availability.manage",
    label: "Manage availability",
    description: "Working hours, blocked dates and tour blocks.",
    group: "Studio",
    default: false,
  },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as Permission[];
export const MANAGER_DEFAULTS: Permission[] = PERMISSIONS.filter((p) => p.default).map((p) => p.key);

export function isPermission(v: string): v is Permission {
  return (PERMISSION_KEYS as string[]).includes(v);
}

/** Effective permissions for a staff member. Artist = everything. */
export function permissionsFor(staff: { role: "artist" | "manager"; permissions?: string[] | null }): Permission[] {
  if (staff.role === "artist") return [...PERMISSION_KEYS];
  return (staff.permissions ?? MANAGER_DEFAULTS).filter(isPermission);
}

export function hasPermission(
  staff: { role: "artist" | "manager"; permissions?: string[] | null },
  permission: Permission,
): boolean {
  return staff.role === "artist" || permissionsFor(staff).includes(permission);
}
