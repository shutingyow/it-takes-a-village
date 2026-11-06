import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Best-effort delete of Convex file storage IDs (ignores already-gone files). */
export async function deleteStorageIds(
  ctx: MutationCtx,
  ids: Id<"_storage">[] | undefined | null
): Promise<void> {
  if (!ids || ids.length === 0) return;
  for (const id of ids) {
    try {
      await ctx.storage.delete(id);
    } catch {
      // Storage may already be gone
    }
  }
}
