import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness + build identity (commit sha from Vercel's system env), so a deploy can be verified. */
export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return NextResponse.json(
    {
      status: "ok",
      service: "gaplens",
      phase: 6,
      build: { commit: sha, commitShort: sha ? sha.slice(0, 7) : null, deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null, env: process.env.VERCEL_ENV ?? null },
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
