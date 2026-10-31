/**
 * End-to-end pipeline with an in-memory database and a mocked LLM (no network):
 * create session → extract 2 URLs (fixtures via mocked fetch) → claims → gaps → contradictions →
 * freshness → questions → checklist → report → session view → Markdown export.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { renderMarkdownReport } from "@/lib/report-markdown";
import type { LlmClient } from "@/server/ai/llm";
import type { ChatMessage } from "@/server/ai/openrouter";
import { createMemoryRepositories } from "@/server/db/memoryRepositories";
import { runAnalysisStage, runClaimsStage } from "@/server/pipeline/analysis";
import { createSession, extractSourceById } from "@/server/pipeline/sources";
import { buildSessionView } from "@/server/pipeline/view";
import { verifyQuoteInSource } from "@/server/services/provenance";

const NOW = new Date("2026-10-31T00:00:00Z");
const fx = (n: string) => readFileSync(join(process.cwd(), "tests/fixtures", n), "utf8");

/** Pull the JSON block that follows `label:\n` in the prompt. */
function block(messages: ChatMessage[], label: string): unknown {
  const text = messages.at(-1)!.content;
  const i = text.lastIndexOf(`${label}:\n`);
  return JSON.parse(text.slice(i + label.length + 2).trim());
}
type C = { id: string; quote: string };
const idOf = (claims: C[], needle: string) => claims.find((c) => c.quote.includes(needle))?.id ?? "C999";

function mockLlm(): LlmClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    provider: "gemini",
    model: "mock-model",
    calls,
    async generate<T extends z.ZodTypeAny>(messages: ChatMessage[], schema: T, opts: { label?: string } = {}) {
      calls.push(opts.label ?? "?");
      const prompt = messages.at(-1)!.content;
      let out: unknown;
      switch (opts.label) {
        case "Claim extraction":
          out = prompt.includes("Rs. 13,500")
            ? { claims: [
                { text: "Income limit is Rs. 2,50,000.", quote: "Students whose parents' annual income from all sources does not exceed Rs. 2,50,000 are eligible.", category: "requirement" },
                { text: "Hostellers in Group I get Rs. 13,500.", quote: "Group I | Rs. 13,500 | Rs. 7,000", category: "fact" },
                { text: "Deadline 31 Oct 2024.", quote: "The last date for submission is 31 October 2024.", category: "date_deadline", date: "2024-10-31" },
                { text: "Fabricated", quote: "The scholarship is renewed automatically every year.", category: "condition" },
              ] }
            : { claims: [
                { text: "Up to Rs. 20,000 per year.", quote: "The Post Matric Scholarship gives up to Rs. 20,000 per year to eligible students", category: "fact" },
                { text: "Opens in July.", quote: "Applications usually open in July every year on the national portal", category: "date_deadline" },
              ] };
          break;
        case "Gap detection": {
          const claims = block(messages, "CLAIMS") as C[];
          out = { topics: [
            { key: "amount", label: "Scholarship amount", whyItMatters: "Budgeting", status: "covered", claimIds: [idOf(claims, "13,500"), idOf(claims, "20,000")], severity: "high" },
            { key: "income_criteria", label: "Income criteria", whyItMatters: "Eligibility", status: "covered", claimIds: [idOf(claims, "2,50,000")], severity: "high" },
            { key: "renewal", label: "Renewal conditions", whyItMatters: "Continuity", status: "missing", claimIds: [], missingInformation: "Renewal criteria", whatToInvestigate: "Official guidelines", severity: "medium" },
            { key: "deadline", label: "Deadline", whyItMatters: "Timing", status: "partial", claimIds: [idOf(claims, "31 October 2024")], missingInformation: "Current-cycle deadline", severity: "high" },
          ] };
          break;
        }
        case "Contradiction detection": {
          const groups = block(messages, "GROUPS") as { topicKey: string; claims: C[] }[];
          const amount = groups.find((g) => g.topicKey === "amount")!;
          out = { contradictions: [
            { topicKey: "amount", topic: "Scholarship amount", description: "Different amounts stated.", severity: "high",
              positions: [{ statement: "Rs. 13,500 (hostellers, Group I)", claimIds: [idOf(amount.claims, "13,500")] }, { statement: "Up to Rs. 20,000", claimIds: [idOf(amount.claims, "20,000")] }],
              possibleExplanations: ["Different groups or years"] },
            { topicKey: "amount", topic: "Bogus", description: "single side", severity: "low", positions: [{ statement: "x", claimIds: ["C999"] }, { statement: "y", claimIds: [] }] },
          ] };
          break;
        }
        case "Freshness analysis":
          out = { warnings: [{ sourceId: "S9", reason: "old_version", description: "unknown source", severity: "low", claimIds: ["C1"] }] };
          break;
        case "Question generation":
          out = { questions: [
            { question: "What is the 2026-27 deadline?", whyItMatters: "Avoid missing it", relatedFindingIds: ["F1", "F2"], basis: "gap" },
            { question: "Unlinked?", whyItMatters: "x", relatedFindingIds: ["F404"], basis: "ambiguity" },
          ] };
          break;
        case "Checklist generation":
          out = { items: [
            { action: "Confirm the amount with the ministry", priority: "medium", rationale: "Sources disagree", findingIds: ["F3"] },
            { action: "Confirm current deadline", priority: "high", rationale: "Deadline may have passed", findingIds: ["F2"] },
            { action: "No link", priority: "low", rationale: "x", findingIds: [] },
          ] };
          break;
        default:
          throw new Error(`unexpected stage ${opts.label}`);
      }
      return schema.parse(out);
    },
  };
}

describe("GapLens pipeline (mocked LLM, in-memory DB)", () => {
  it("runs every stage, keeps provenance and builds the 10-section report", async () => {
    const repos = createMemoryRepositories();
    const { session, sources } = await createSession(repos, {
      brief: { topic: "Post Matric Scholarship", question: "What are the eligibility, amount and deadline for the current cycle?", objective: "Decide whether to apply" },
      urls: ["https://socialjustice.example.gov.in/pms", "https://blog.example.com/top-10"],
      pdfCount: 0,
    });
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const u = String(input);
      if (u.startsWith("https://r.jina.ai/")) return new Response("blocked", { status: 401 });
      const body = u.includes("gov.in") ? fx("gov-scholarship.html") : fx("undated-blog.html");
      return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    });
    const deps = { fetchImpl, lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }], now: NOW, env: {} as NodeJS.ProcessEnv };
    for (const s of sources) {
      const r = await extractSourceById(repos, session.id, s.id, deps);
      expect(r.extraction_status).toBe("extracted");
    }

    const llm = mockLlm();
    let rejected = 0;
    for (const s of sources) {
      let chunk: number | null = 0;
      while (chunk !== null) {
        const r = await runClaimsStage(repos, session.id, s.id, chunk, llm);
        rejected += r.rejectedUnverified;
        chunk = r.nextChunk;
      }
    }
    expect(rejected).toBe(1); // the fabricated "renewed automatically" quote
    const claims = await repos.claims.listBySession(session.id);
    expect(claims).toHaveLength(5);
    const texts = new Map((await repos.sources.listBySession(session.id, { withContent: true })).map((s) => [s.id, s.content_text!]));
    for (const c of claims) {
      expect(c.quote_verified).toBe(true);
      expect(verifyQuoteInSource(c.quote, texts.get(c.source_id)!).verified).toBe(true);
    }

    expect(await runAnalysisStage(repos, session.id, "gaps", llm, NOW)).toMatchObject({ topics: 4, gaps: 2, covered: 2 });
    expect(await runAnalysisStage(repos, session.id, "contradictions", llm, NOW)).toMatchObject({ contradictions: 1 });
    const fresh = await runAnalysisStage(repos, session.id, "freshness", llm, NOW);
    expect(fresh).toMatchObject({ aiUsed: true });
    expect(await runAnalysisStage(repos, session.id, "questions", llm, NOW)).toEqual({ questions: 1 });
    expect(await runAnalysisStage(repos, session.id, "checklist", llm, NOW)).toEqual({ items: 2 });
    await runAnalysisStage(repos, session.id, "report", llm, NOW);

    const view = (await buildSessionView(repos, session.id))!;
    expect(view.session.status).toBe("complete");
    expect(view.sources.map((s) => s.title)).toEqual(["Post Matric Scholarship for SC Students", "Top 10 Scholarships for Engineering Students"]);
    expect(view.sources[1]!.publishedAt).toBeNull(); // undated stays undated
    expect(view.coverage.map((t) => t.status)).toEqual(["covered", "covered", "missing", "partial"]);
    expect(view.contradictions).toHaveLength(1);
    const c = view.contradictions[0]!;
    expect(new Set(c.positions.flatMap((p) => p.evidence.map((e) => e.sourceId))).size).toBe(2);
    expect(c.authorityNote).toMatch(/official/);
    const reasons = view.freshness.map((f) => f.reason).sort();
    // gov page: stated 2025-03-12 (>1y), past cycle 2024-25, expired deadline; blog: undated. Bogus AI warning (unknown S9) dropped.
    expect(reasons).toEqual(["dated_old", "expired_deadline", "references_past_cycle", "undated"]);
    const undatedRow = (await repos.findings.listBySession(session.id, "freshness")).find((r) => r.title === "undated")!;
    expect(undatedRow.label).toBe("requires_verification"); // never "potentially_outdated"
    expect(view.questions).toHaveLength(1);
    expect(view.checklist.map((i) => i.priority)).toEqual(["high", "medium"]);
    expect(view.claims.every((cl) => cl.context?.match === cl.quote)).toBe(true);
    for (const f of view.freshness) for (const e of f.evidence) expect(view.evidenceContext[`${e.sourceId}:${e.quote.slice(0, 120)}`]).toBeTruthy();

    const md = renderMarkdownReport(view);
    for (const h of ["## 1. Research objective", "## 2. Sources reviewed", "## 3. Key information", "## 4. Information gaps", "## 5. Possible contradictions", "## 6. Potentially outdated", "## 7. Unanswered questions", "## 8. Prioritised verification checklist", "## 9. Evidence & references", "## 10. Limitations & uncertainty"]) {
      expect(md).toContain(h);
    }
    expect(md).toContain("discarded because their quote could not be found verbatim");
    expect(md).not.toContain("renewed automatically");
    expect(llm.calls).toEqual(["Claim extraction", "Claim extraction", "Gap detection", "Contradiction detection", "Freshness analysis", "Question generation", "Checklist generation"]);
  });

  it("refuses to analyse when no source could be read", async () => {
    const repos = createMemoryRepositories();
    const { session, sources } = await createSession(repos, { brief: { topic: "Topic", question: "A question that is long enough?", objective: "" }, urls: ["https://down.example.org/"], pdfCount: 0 });
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("x", { status: 500 }));
    const failed = await extractSourceById(repos, session.id, sources[0]!.id, { fetchImpl, lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }], env: {} as NodeJS.ProcessEnv });
    expect(failed.extraction_status).toBe("failed");
    expect(failed.extraction_error).toMatch(/HTTP 500/);
    await expect(runAnalysisStage(repos, session.id, "gaps", mockLlm(), NOW)).rejects.toMatchObject({ code: "insufficient_sources" });
  });

  it("runs rule-based freshness and the report without any AI key", async () => {
    const repos = createMemoryRepositories();
    const { session, sources } = await createSession(repos, { brief: { topic: "Topic", question: "A question that is long enough?", objective: "" }, urls: ["https://socialjustice.example.gov.in/pms"], pdfCount: 0 });
    const fetchImpl = vi.fn<typeof fetch>(async (input) => (String(input).startsWith("https://r.jina.ai/") ? new Response("", { status: 500 }) : new Response(fx("gov-scholarship.html"), { status: 200, headers: { "content-type": "text/html" } })));
    await extractSourceById(repos, session.id, sources[0]!.id, { fetchImpl, lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }], now: NOW, env: {} as NodeJS.ProcessEnv });
    expect(await runAnalysisStage(repos, session.id, "freshness", undefined, NOW)).toMatchObject({ aiUsed: false, warnings: 3 });
    await runAnalysisStage(repos, session.id, "report", undefined, NOW);
    const view = (await buildSessionView(repos, session.id))!;
    expect(view.report?.model).toMatch(/none/);
    expect(view.report?.limitations.join(" ")).toMatch(/No AI provider was configured/);
  });
});
