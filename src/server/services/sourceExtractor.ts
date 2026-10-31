import "server-only";
import type { Source } from "@/server/ai/schemas";
import { NotImplementedError } from "./errors";
import type { StageContext } from "./types";

export type UrlSourceInput = { kind: "url"; url: string };
export type PdfSourceInput = { kind: "pdf"; fileName: string; bytes: Uint8Array };
export type SourceInput = UrlSourceInput | PdfSourceInput;

export type ExtractionProvider = "firecrawl" | "jina" | "pdf-parse";

export type SourceExtractionResult = {
  source: Source;
  provider: ExtractionProvider;
  /** Non-fatal notes, e.g. "no publication date found". */
  warnings: string[];
};

/**
 * Fetch + extract readable text and metadata from one source.
 *
 * TODO(Phase 2):
 *  - URL: re-run checkUrl(), resolve DNS and reject private IPs (assertPublicHost) to block rebinding.
 *  - Use Firecrawl when FIRECRAWL_API_KEY is set, else Jina Reader (https://r.jina.ai/<url>, keyless; JINA_API_KEY optional).
 *  - PDF: pdf-parse (loaded via dynamic import; listed in serverExternalPackages).
 *  - Title/publishedAt ONLY from source metadata or text; leave null if absent. Never guess.
 *  - Set retrievedAt to the fetch time, extractionStatus to extracted|failed.
 */
export async function extractSource(_input: SourceInput, _ctx: StageContext): Promise<SourceExtractionResult> {
  throw new NotImplementedError("sourceExtractor.extractSource", 2);
}

/**
 * TODO(Phase 2): resolve `hostname` via node:dns and throw if any address isPrivateIp().
 */
export async function assertPublicHost(_hostname: string): Promise<void> {
  throw new NotImplementedError("sourceExtractor.assertPublicHost", 2);
}
