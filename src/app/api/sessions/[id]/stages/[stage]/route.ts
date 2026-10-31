import { analysisStageSchema } from "@/lib/api-schemas";
import { ApiError, errorResponse, json, llmForRequest, parseId } from "@/server/api/http";
import { getRepositories } from "@/server/db";
import { runAnalysisStage } from "@/server/pipeline/analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Freshness rules and report assembly run without an AI key; the other stages require one. */
const AI_OPTIONAL = new Set(["freshness", "report"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string; stage: string }> }) {
  try {
    const p = await params;
    const id = parseId(p.id);
    const stage = analysisStageSchema.safeParse(p.stage);
    if (!stage.success) throw new ApiError(404, "not_found", "Unknown stage.");
    const llm = AI_OPTIONAL.has(stage.data) ? llmForRequest(req, false) : llmForRequest(req, true);
    return json({ stage: stage.data, result: await runAnalysisStage(getRepositories(), id, stage.data, llm ?? undefined) });
  } catch (e) {
    return errorResponse(e);
  }
}
