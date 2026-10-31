import { errorResponse, json, parseId, ApiError } from "@/server/api/http";
import { getRepositories } from "@/server/db";
import { buildSessionView } from "@/server/pipeline/view";

export const dynamic = "force-dynamic";

/** Full session state (sources without raw text, claims, findings, checklist, report). Used for status polling too. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const view = await buildSessionView(getRepositories(), id);
    if (!view) throw new ApiError(404, "not_found", "Research session not found.");
    return json(view);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const ok = await getRepositories().sessions.delete(id);
    if (!ok) throw new ApiError(404, "not_found", "Research session not found.");
    return json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
