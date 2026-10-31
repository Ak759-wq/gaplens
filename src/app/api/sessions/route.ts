import { createSessionSchema } from "@/lib/api-schemas";
import { errorResponse, json, readJson } from "@/server/api/http";
import { getRepositories } from "@/server/db";
import { createSession } from "@/server/pipeline/sources";

export const dynamic = "force-dynamic";

/** List research sessions (newest first). */
export async function GET(req: Request) {
  try {
    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50, 200);
    const sessions = await getRepositories().sessions.list({ limit });
    return json({ sessions });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Create a session from a research brief and URL sources (PDFs are uploaded separately). */
export async function POST(req: Request) {
  try {
    const input = await readJson(req, createSessionSchema);
    const { session, sources } = await createSession(getRepositories(), input);
    return json({ session, sources }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
