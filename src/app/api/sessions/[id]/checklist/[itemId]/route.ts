import { checklistPatchSchema } from "@/lib/api-schemas";
import { ApiError, errorResponse, json, parseId, readJson } from "@/server/api/http";
import { getRepositories } from "@/server/db";

export const dynamic = "force-dynamic";

/** Persist a checklist checkbox. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const p = await params;
    const { done } = await readJson(req, checklistPatchSchema);
    const ok = await getRepositories().checklist.setDone(parseId(p.id), parseId(p.itemId), done);
    if (!ok) throw new ApiError(404, "not_found", "Checklist item not found.");
    return json({ done });
  } catch (e) {
    return errorResponse(e);
  }
}
