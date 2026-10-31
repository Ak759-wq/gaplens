import { ApiError, errorResponse, parseId } from "@/server/api/http";
import { getRepositories } from "@/server/db";
import { buildSessionView } from "@/server/pipeline/view";
import { renderMarkdownReport } from "@/lib/report-markdown";

export const dynamic = "force-dynamic";

/** Markdown export (`?format=md`, default). PDF export is the print-friendly page + the browser's Save as PDF. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const format = new URL(req.url).searchParams.get("format") ?? "md";
    if (format !== "md") throw new ApiError(400, "bad_request", "Only format=md is supported; use the Print / PDF view for PDF.");
    const view = await buildSessionView(getRepositories(), id);
    if (!view) throw new ApiError(404, "not_found", "Research session not found.");
    const md = renderMarkdownReport(view);
    const slug = view.session.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "report";
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="gaplens-${slug}.md"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
