import "server-only";
import { MAX_SOURCES } from "@/lib/validation";
import type { CreateSessionInput } from "@/lib/api-schemas";
import { ApiError } from "@/server/api/http";
import type { Repositories } from "@/server/db/repositories";
import type { ResearchSessionRow, SourceMetadata, SourceRow } from "@/server/db/types";
import { ExtractionError, extractPdfUpload, extractUrl, type ExtractDeps, type ExtractedDocument } from "@/server/services/sourceExtractor";

export async function requireSession(repos: Repositories, id: string): Promise<ResearchSessionRow> {
  const s = await repos.sessions.get(id);
  if (!s) throw new ApiError(404, "not_found", "Research session not found.");
  return s;
}

export async function createSession(repos: Repositories, input: CreateSessionInput) {
  const session = await repos.sessions.create({
    owner_id: null,
    topic: input.brief.topic,
    question: input.brief.question,
    objective: input.brief.objective ?? "",
    status: "draft",
    error_message: null,
  } as Parameters<Repositories["sessions"]["create"]>[0]);
  const sources = await repos.sources.addMany(input.urls.map((url) => blankSource(session.id, "url", { url })));
  return { session, sources };
}

function blankSource(sessionId: string, type: "url" | "pdf", loc: { url?: string; fileName?: string }) {
  return {
    session_id: sessionId,
    source_type: type,
    url: loc.url ?? null,
    file_name: loc.fileName ?? null,
    title: null,
    published_at: null,
    retrieved_at: null,
    extraction_status: "pending" as const,
    extraction_provider: null,
    extraction_error: null,
    content_text: null,
    content_sha256: null,
  };
}

async function assertRoom(repos: Repositories, sessionId: string, adding: number) {
  const existing = await repos.sources.listBySession(sessionId);
  if (existing.length + adding > MAX_SOURCES) throw new ApiError(400, "bad_request", `At most ${MAX_SOURCES} sources per session.`);
  return existing;
}

export async function addUrlSources(repos: Repositories, sessionId: string, urls: string[]) {
  const existing = await assertRoom(repos, sessionId, urls.length);
  const have = new Set(existing.map((s) => s.url).filter(Boolean));
  const fresh = [...new Set(urls)].filter((u) => !have.has(u));
  return repos.sources.addMany(fresh.map((url) => blankSource(sessionId, "url", { url })));
}

function docToPatch(doc: ExtractedDocument, extra: Partial<SourceMetadata> = {}) {
  const metadata: SourceMetadata = {
    provider: doc.provider,
    finalUrl: doc.finalUrl,
    modifiedAt: doc.modifiedAt,
    dateEvidence: doc.dateEvidence,
    warnings: doc.warnings,
    pages: doc.pages,
    charCount: doc.text.length,
    claims: { status: "pending", chunksDone: 0, chunksTotal: 0, rejected: 0 },
    ...extra,
  };
  return {
    title: doc.title,
    // published_at holds the source's own publication date, else its stated update date.
    published_at: doc.publishedAt ?? doc.modifiedAt,
    retrieved_at: doc.retrievedAt,
    extraction_status: "extracted" as const,
    extraction_provider: doc.provider,
    extraction_error: null,
    content_text: doc.text,
    content_sha256: doc.contentSha256,
    metadata,
  };
}

/** Upload + extract a PDF in one request (the file itself is not stored, only its text). */
export async function addPdfSource(repos: Repositories, sessionId: string, file: { name: string; bytes: Uint8Array }): Promise<SourceRow> {
  await assertRoom(repos, sessionId, 1);
  const [row] = await repos.sources.addMany([blankSource(sessionId, "pdf", { fileName: file.name.slice(0, 255) })]);
  try {
    const doc = await extractPdfUpload(file.bytes);
    return await repos.sources.update(row!.id, docToPatch(doc, { sizeBytes: file.bytes.byteLength }));
  } catch (e) {
    const message = e instanceof ExtractionError ? e.message : "Could not read this PDF.";
    return repos.sources.update(row!.id, { extraction_status: "failed", extraction_error: message, retrieved_at: new Date().toISOString() });
  }
}

/**
 * Extract one URL source. Failures are recorded on the source (status failed + error) and do not
 * throw, so other sources continue.
 */
export async function extractSourceById(repos: Repositories, sessionId: string, sourceId: string, deps: ExtractDeps = {}): Promise<SourceRow> {
  const src = await repos.sources.get(sourceId);
  if (!src || src.session_id !== sessionId) throw new ApiError(404, "not_found", "Source not found.");
  if (src.source_type !== "url" || !src.url) return src; // PDFs are extracted at upload time
  const session = await requireSession(repos, sessionId);
  if (session.status === "draft") await repos.sessions.updateStatus(sessionId, "extracting");
  await repos.sources.update(sourceId, { extraction_status: "extracting", extraction_error: null });
  try {
    const doc = await extractUrl(src.url, deps);
    return await repos.sources.update(sourceId, docToPatch(doc));
  } catch (e) {
    const message = e instanceof ExtractionError ? e.message : `Extraction failed: ${(e as Error).message}`;
    return repos.sources.update(sourceId, {
      extraction_status: "failed",
      extraction_error: message.slice(0, 1000),
      retrieved_at: new Date().toISOString(),
    });
  }
}
