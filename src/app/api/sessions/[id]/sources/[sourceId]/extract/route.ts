import { errorResponse, json, parseId } from "@/server/api/http";
import { getRepositories } from "@/server/db";
import { extractSourceById } from "@/server/pipeline/sources";
import { toSourceView } from "@/server/pipeline/view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Fetch + extract one URL source. A failed extraction is returned as a source with status "failed" (HTTP 200). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  try {
    const p = await params;
    const source = await extractSourceById(getRepositories(), parseId(p.id), parseId(p.sourceId), { timeoutMs: 20_000 });
    return json({ source: toSourceView(source, 0) });
  } catch (e) {
    return errorResponse(e);
  }
}
