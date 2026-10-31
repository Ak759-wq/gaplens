import { claimsStageSchema } from "@/lib/api-schemas";
import { errorResponse, json, llmForRequest, parseId, readJson } from "@/server/api/http";
import { getRepositories } from "@/server/db";
import { runClaimsStage } from "@/server/pipeline/analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Extract verified claims from one chunk of one source. Returns `nextChunk` until the source is done. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const { sourceId, chunk } = await readJson(req, claimsStageSchema);
    const llm = llmForRequest(req, true);
    return json(await runClaimsStage(getRepositories(), id, sourceId, chunk, llm));
  } catch (e) {
    return errorResponse(e);
  }
}
