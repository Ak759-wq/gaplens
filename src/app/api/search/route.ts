import { searchRequestSchema } from "@/lib/api-schemas";
import { checkUrl } from "@/lib/url-safety";
import { ApiError, errorResponse, json, readJson } from "@/server/api/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Permitted web search (optional). Suggests URLs the user may add as sources; it never adds them
 * itself and never fabricates results. Requires TAVILY_API_KEY; otherwise "configuration required".
 */
export async function POST(req: Request) {
  try {
    const key = process.env.TAVILY_API_KEY?.trim();
    if (!key) throw new ApiError(503, "config_required", "Web search needs TAVILY_API_KEY on the server.");
    const { query } = await readJson(req, searchRequestSchema);
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, search_depth: "basic", max_results: 8, include_answer: false }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429) throw new ApiError(429, "rate_limited", "Search rate limit reached. Try again shortly.", { retryAfterSec: 30 });
    if (!res.ok) throw new ApiError(502, "internal", `Search provider error (${res.status}).`);
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string; published_date?: string }[] };
    const results = (data.results ?? [])
      .filter((r) => typeof r.url === "string" && checkUrl(r.url).ok)
      .map((r) => ({ title: r.title ?? null, url: r.url!, snippet: (r.content ?? "").slice(0, 300), publishedDate: r.published_date ?? null }));
    return json({ provider: "tavily", results });
  } catch (e) {
    return errorResponse(e);
  }
}
