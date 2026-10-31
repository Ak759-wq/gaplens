import { ApiError, errorResponse, json, parseId } from "@/server/api/http";
import { getRepositories } from "@/server/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  try {
    const p = await params;
    const id = parseId(p.id);
    const sourceId = parseId(p.sourceId);
    const repos = getRepositories();
    const src = await repos.sources.get(sourceId);
    if (!src || src.session_id !== id) throw new ApiError(404, "not_found", "Source not found.");
    await repos.sources.delete(sourceId);
    return json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
