import { addUrlSourcesSchema } from "@/lib/api-schemas";
import { MAX_PDF_BYTES, checkPdfFile } from "@/lib/validation";
import { ApiError, errorResponse, json, parseId, readJson } from "@/server/api/http";
import { getRepositories } from "@/server/db";
import { toSourceView } from "@/server/pipeline/view";
import { addPdfSource, addUrlSources, requireSession } from "@/server/pipeline/sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Add sources to a session.
 *  - application/json `{ urls: string[] }` → pending URL sources (extract each via …/extract).
 *  - multipart/form-data with one `file` (PDF ≤ 15 MB) → uploaded, parsed with pdf-parse, stored as text.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const repos = getRepositories();
    await requireSession(repos, id);
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const declared = Number(req.headers.get("content-length") ?? "0");
      if (declared > MAX_PDF_BYTES + 64 * 1024) throw new ApiError(413, "bad_request", "PDF exceeds the 15 MB limit.");
      const form = await req.formData().catch(() => {
        throw new ApiError(400, "bad_request", "Could not read the upload.");
      });
      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(400, "bad_request", "Missing PDF file field 'file'.");
      const check = checkPdfFile({ name: file.name, type: file.type, size: file.size });
      if (!check.ok) throw new ApiError(400, "bad_request", check.reason);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const source = await addPdfSource(repos, id, { name: file.name, bytes });
      return json({ source: toSourceView(source, 0) }, 201);
    }
    const { urls } = await readJson(req, addUrlSourcesSchema);
    const added = await addUrlSources(repos, id, urls);
    return json({ sources: added.map((s, i) => toSourceView(s, i)) }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
