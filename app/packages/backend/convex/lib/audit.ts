import type { Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** AU-1: every create / update / status change logs who, what, when. */
export async function audit(
  ctx: MutationCtx,
  actor: Id<"staff">,
  entity: TableNames,
  entityId: string,
  action: string,
  diff?: unknown,
) {
  await ctx.db.insert("auditLog", { actor, entity, entityId, action, diff, at: Date.now() });
}
