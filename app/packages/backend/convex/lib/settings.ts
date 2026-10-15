import { DEFAULT_SETTINGS } from "@drink/shared";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Settings = Omit<Doc<"settings">, "_id" | "_creationTime"> & { _id?: Doc<"settings">["_id"] };

/** Singleton. Falls back to defaults before setup has run. */
export async function getSettings(ctx: QueryCtx): Promise<Settings> {
  const s = await ctx.db.query("settings").first();
  return s ?? { ...DEFAULT_SETTINGS };
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
