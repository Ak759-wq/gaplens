/**
 * Gap detection hardening (topic planning independent of claims, strict cycle-scoped coverage),
 * contradiction value/cycle checks and AI-freshness reconciliation. All LLM calls are mocked.
 */
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { LlmClient } from "@/server/ai/llm";
import type { ChatMessage } from "@/server/ai/openrouter";
import { AIProviderError } from "@/server/ai/errors";
import type { Claim, Source, TopicCoverage } from "@/server/ai/schemas";
import { AliasMap } from "./corpus";
import { classifyPositions, cycleOfClaim, detectContradictions } from "./contradictionDetector";
import { analyzeFreshness, reconcileAiFreshness } from "./freshnessAnalyzer";
import { assessCoverage, detectGaps } from "./gapDetector";
import { claimScope, differingValues, extractValues, findCycleMentions, inForceDetermination, parseAskedScope, textScope } from "./scope";
import { baselineTopics, detectDomain, mergePlannedTopics, planTopics, questionAspects, type PlannedTopic } from "./topicPlanner";

const NOW = new Date("2026-10-31T00:00:00Z");
const BRIEF = {
  topic: "Central Sector Scheme of Scholarship (CSSS)",
  question: "What should I verify before applying for the Central Sector Scheme of Scholarship in the 2026-27 cycle: eligibility, income limit, amount, deadline and renewal?",
  objective: "Decide whether to apply this cycle and what to prepare.",
};

const GUIDELINES =
  "PM-USP CSSS Guidelines (Applicable for academic year 2022-23 onwards)\nStudents above 80th percentile of successful candidates in Class XII are eligible. Students with gross parental/family income up to Rs. 4.5 lakh per annum are eligible.\nRate and Duration of Scholarship (from financial year 2022-23): Rs. 12,000 per annum at graduation level.\nThe National Scholarships Portal will provide the timelines for opening and closing of the portal.";
const CBSE =
  "Online application for Central Sector Scheme of Scholarship for the year 2025-26 is available on NSP. The last date for submission of online application form for renewal and fresh scholarship 2025-26, is 31.10.2025.";
const AGG = "Central Sector Scholarship 2026-27. Deadline 31 Oct. Income limit up to ₹4.5 Lakh per year. 50% of the scholarships are reserved for girls.";
const NSP = "Closing dates for student application is 31-10-2026 for the 2026-27 academic year.";

const src = (id: string, url: string, text: string, o: Partial<Source> = {}): Source => ({
  id, sourceType: "url", url, fileName: null, title: id, publishedAt: null, retrievedAt: NOW.toISOString(), extractionStatus: "extracted", contentText: text, ...o,
});
const S1 = src("s1", "https://scholarships.gov.in/public/schemeGuidelines/CSSS.pdf", GUIDELINES, { publishedAt: "2024-02-07" });
const S2 = src("s2", "https://www.cbse.gov.in/cbsenew/documents/notice.pdf", CBSE, { publishedAt: "2025-06-27" });
const S4 = src("s4", "https://www.indiascholarships.in/scholarships/csss", AGG, { publishedAt: NOW.toISOString() }); // date = retrieval day (unreliable)
const S5 = src("s5", "https://scholarships.gov.in/ViewMoreAnnouncement", NSP);
const cl = (id: string, sourceId: string, quote: string, o: Partial<Claim> = {}): Claim => ({ id, sourceId, text: quote, quote, category: "fact", ...o });

const c_elig = cl("c_elig", "s1", "Students above 80th percentile of successful candidates in Class XII are eligible.", { category: "requirement" });
const c_income = cl("c_income", "s1", "Students with gross parental/family income up to Rs. 4.5 lakh per annum are eligible.", { category: "requirement" });
const c_rate = cl("c_rate", "s1", "Rate and Duration of Scholarship (from financial year 2022-23): Rs. 12,000 per annum at graduation level.");
const c_nspTimeline = cl("c_nsp", "s1", "The National Scholarships Portal will provide the timelines for opening and closing of the portal.", { category: "date_deadline" });
const c_cbseDeadline = cl("c_cbse", "s2", "The last date for submission of online application form for renewal and fresh scholarship 2025-26, is 31.10.2025.", { category: "date_deadline", date: "2025-10-31" });
const c_aggDeadline = cl("c_agg", "s4", "Deadline 31 Oct.", { category: "date_deadline" });
const c_aggQuota = cl("c_quota", "s4", "50% of the scholarships are reserved for girls.");
const c_aggIncome = cl("c_aggincome", "s4", "Income limit up to ₹4.5 Lakh per year.");
const c_nspDeadline = cl("c_nspd", "s5", "Closing dates for student application is 31-10-2026 for the 2026-27 academic year.", { category: "date_deadline", date: "2026-10-31" });
const ALL = [c_elig, c_income, c_rate, c_nspTimeline, c_cbseDeadline, c_aggDeadline, c_aggQuota, c_aggIncome, c_nspDeadline];

/** Pull the JSON block that follows `label:\n` in the prompt (up to the next blank-line-separated block). */
function block(messages: ChatMessage[], label: string): unknown {
  const text = messages.at(-1)!.content;
  const i = text.lastIndexOf(`${label}:\n`);
  const rest = text.slice(i + label.length + 2);
  const end = rest.search(/\n\n[A-Z][A-Z ]+:\n/);
  return JSON.parse((end === -1 ? rest : rest.slice(0, end)).trim());
}

type Handler = (messages: ChatMessage[]) => unknown;
function mockLlm(handlers: Record<string, Handler>): LlmClient & { calls: { label: string; prompt: string }[] } {
  const calls: { label: string; prompt: string }[] = [];
  return {
    provider: "gemini",
    model: "mock",
    calls,
    async generate<T extends z.ZodTypeAny>(messages: ChatMessage[], schema: T, opts: { label?: string } = {}) {
      const label = opts.label ?? "?";
      calls.push({ label, prompt: messages.map((m) => m.content).join("\n") });
      const h = handlers[label];
      if (!h) throw new Error(`unexpected ${label}`);
      return schema.parse(h(messages));
    },
  };
}

/* ------------------------------- scope helpers ------------------------------- */

describe("asked scope and claim scope", () => {
  it("parses the cycle the question asks about", () => {
    expect(parseAskedScope(BRIEF, NOW)).toMatchObject({ cycleStart: 2026, label: "2026-27", explicit: true });
    expect(parseAskedScope({ ...BRIEF, question: "What is the deadline for the 2027 intake of this programme?" }, NOW)).toMatchObject({ cycleStart: 2027, explicit: true });
    expect(parseAskedScope({ ...BRIEF, question: "What is the deadline for the current cycle?" }, NOW)).toMatchObject({ cycleStart: 2026, explicit: false });
    expect(parseAskedScope({ topic: "x", question: "How does photosynthesis work?", objective: "" }, NOW)).toBeNull();
    // "2022-23 onwards" in the brief is not the asked cycle
    expect(parseAskedScope({ ...BRIEF, objective: "", question: "Do the rules applicable from 2022-23 onwards still hold?" }, NOW)).toBeNull();
  });
  it("treats 'onwards', 'from financial year' and 'until further orders' as in force", () => {
    expect(findCycleMentions("Rate (from financial year 2022-23): Rs. 12,000")[0]!.openEnded).toBe(true);
    expect(findCycleMentions("Applications for 2024-25 are invited")[0]!.openEnded).toBe(false);
    expect(inForceDetermination(GUIDELINES, 2026)).toMatch(/2022-23 onwards/);
    expect(inForceDetermination("These rates apply until further orders.", 2026)).toMatch(/until further orders/);
    expect(inForceDetermination(CBSE, 2026)).toBeNull();
  });
  it("matches claims to the asked cycle; past cycles and year-less deadlines do not match", () => {
    expect(textScope(c_cbseDeadline.quote, c_cbseDeadline.date, 2026).verdict).toBe("mismatch");
    expect(textScope(c_nspDeadline.quote, c_nspDeadline.date, 2026).verdict).toBe("match");
    expect(textScope("Deadline 31 Oct.", undefined, 2026).verdict).toBe("unknown");
    // deadline topics need the year on the claim itself; eligibility may inherit an in-force source
    expect(claimScope(c_aggDeadline, S4, 2026, "claim").verdict).toBe("unknown");
    expect(claimScope(c_elig, S1, 2026, "source")).toMatchObject({ verdict: "match", basis: "source" });
    expect(claimScope(cl("x", "s2", "Applicants must apply online."), S2, 2026, "source").verdict).toBe("mismatch");
  });
});

/* ------------------------------- topic planning ------------------------------- */

describe("topic planning (independent of claims)", () => {
  it("builds the scholarship checklist from the brief, marking what the question asks", () => {
    expect(detectDomain(BRIEF)).toBe("scholarship_scheme");
    expect(questionAspects(BRIEF.question)).toEqual(["eligibility", "income limit", "amount", "deadline", "renewal"]);
    const topics = baselineTopics(BRIEF, parseAskedScope(BRIEF, NOW));
    const keys = topics.map((t) => t.key);
    for (const k of ["eligibility", "income_limit", "amount", "application_deadline", "required_documents", "renewal_conditions", "continuation_conditions", "selection_process", "disbursement", "coverage_scope", "quotas", "official_contact"]) {
      expect(keys).toContain(k);
    }
    expect(topics.find((t) => t.key === "application_deadline")).toMatchObject({ label: "Application deadline for 2026-27", sensitivity: "claim", origin: "question" });
    expect(topics.find((t) => t.key === "quotas")!.origin).toBe("checklist");
  });
  it("derives generic topics from the question's listed aspects", () => {
    const t = baselineTopics({ topic: "Laptop", question: "Compare the laptop on: battery life, warranty and delivery date", objective: "" }, null);
    expect(t.map((x) => x.key)).toEqual(["battery_life", "warranty", "delivery_date"]);
    expect(t[2]!.sensitivity).toBe("claim");
  });
  it("planning prompt never contains claims; AI additions are merged, required topics kept", async () => {
    const llm = mockLlm({
      "Topic planning": () => ({ topics: [
        { key: "eligibility", label: "Eligibility criteria", whyItMatters: "dup", severity: "high", timeSensitive: false },
        { key: "aishe_code", label: "Institution has a valid AISHE code", whyItMatters: "Needed to renew after changing college", severity: "medium", timeSensitive: false },
      ] }),
    });
    const r = await planTopics({ sessionId: "x", brief: BRIEF, llm, now: NOW }, parseAskedScope(BRIEF, NOW));
    expect(r.aiUsed).toBe(true);
    expect(r.topics.filter((t) => t.key === "eligibility")).toHaveLength(1);
    expect(r.topics.at(-1)).toMatchObject({ key: "aishe_code", origin: "ai" });
    expect(llm.calls[0]!.prompt).not.toMatch(/CLAIMS|31\.10\.2025/);
    expect(llm.calls[0]!.prompt).toMatch(/You have NOT seen any sources/);
  });
  it("falls back to the deterministic checklist when the planning call fails", async () => {
    const llm = mockLlm({ "Topic planning": () => { throw new AIProviderError("rate", 429); } });
    const r = await planTopics({ sessionId: "x", brief: BRIEF, llm, now: NOW }, parseAskedScope(BRIEF, NOW));
    expect(r.aiUsed).toBe(false);
    expect(r.topics.length).toBeGreaterThanOrEqual(12);
  });
  it("caps merged topics", () => {
    const req: PlannedTopic[] = Array.from({ length: 14 }, (_, i) => ({ key: `k${i}`, label: `L${i}`, whyItMatters: "", severity: "low", sensitivity: "source", origin: "checklist" }));
    const m = mergePlannedTopics(req, [1, 2, 3].map((i) => ({ key: `n${i}`, label: `N${i}`, whyItMatters: "w", severity: "low" as const, timeSensitive: false })));
    expect(m).toHaveLength(15);
  });
});

/* ----------------------------- strict coverage ----------------------------- */

describe("strict coverage assessment", () => {
  const scope = parseAskedScope(BRIEF, NOW)!;
  const planned = baselineTopics(BRIEF, scope);
  const sources = [S1, S2, S4, S5];

  it("reproduces the live false 'covered' and downgrades it to a potential gap with the partial evidence", () => {
    const ca = new AliasMap([c_aggDeadline, c_cbseDeadline, c_elig, c_aggQuota], "C");
    const r = assessCoverage(
      planned,
      [
        { key: "application_deadline", status: "covered", claimIds: ["C1", "C2"] }, // "Deadline 31 Oct" + 31.10.2025 (2025-26)
        { key: "eligibility", status: "covered", claimIds: ["C3"] },
        { key: "quotas", status: "covered", claimIds: ["C4"] },
      ],
      ca,
      sources,
      scope,
    );
    const dl = r.coverage.find((t) => t.key === "application_deadline")!;
    expect(dl).toMatchObject({ status: "partial", verification: "scope_mismatch", askedScope: "2026-27" });
    expect(dl.scopeNote).toMatch(/none of the cited evidence is stated for 2026-27/);
    expect(dl.scopeNote).toMatch(/indiascholarships\.in: "Deadline 31 Oct\." \(states no year\)/);
    expect(dl.scopeNote).toMatch(/cbse\.gov\.in: .*\(refers to 2025-26\)/);
    const gap = r.gaps.find((g) => g.topicKey === "application_deadline")!;
    expect(gap.label).toBe("potential_gap");
    expect(gap.description).toMatch(/^Potential gap, requires verification/);
    expect(gap.evidence.map((e) => e.claimId).sort()).toEqual(["c_agg", "c_cbse"]);
    expect(gap.whyItMatters).toBeTruthy();
    expect(gap.whatToInvestigate).toMatch(/2026-27/);
    // eligibility from the in-force official guidelines ("2022-23 onwards") stays covered
    expect(r.coverage.find((t) => t.key === "eligibility")!.status).toBe("covered");
    // a claim only an undated aggregator makes needs verification
    expect(r.coverage.find((t) => t.key === "quotas")).toMatchObject({ status: "partial", verification: "aggregator_only" });
    // topics the model did not assess are missing, with honest wording
    const docs = r.gaps.find((g) => g.topicKey === "required_documents")!;
    expect(docs.label).toBe("not_found_in_sources");
    expect(docs.description).toMatch(/does not mean it does not exist/);
    expect(r.coverage).toHaveLength(planned.length);
  });

  it("keeps covered when an official claim states the asked cycle", () => {
    const ca = new AliasMap([c_nspDeadline, c_aggDeadline], "C");
    const r = assessCoverage(planned, [{ key: "application_deadline", status: "covered", claimIds: ["C1", "C2"] }], ca, sources, scope);
    expect(r.coverage.find((t) => t.key === "application_deadline")).toMatchObject({ status: "covered", verification: null });
  });

  it("evidence-free 'covered' becomes missing and 'missing' with evidence becomes partial", () => {
    const ca = new AliasMap([c_income], "C");
    const r = assessCoverage(planned, [
      { key: "amount", status: "covered", claimIds: ["C99"] },
      { key: "income_limit", status: "missing", claimIds: ["C1"] },
    ], ca, sources, scope);
    expect(r.coverage.find((t) => t.key === "amount")!.status).toBe("missing");
    expect(r.coverage.find((t) => t.key === "income_limit")!.status).toBe("partial");
  });

  it("without a named cycle, year-agnostic topics are judged on evidence only", () => {
    const ca = new AliasMap([c_cbseDeadline], "C");
    const r = assessCoverage(baselineTopics(BRIEF, null), [{ key: "application_deadline", status: "covered", claimIds: ["C1"] }], ca, sources, null);
    expect(r.coverage.find((t) => t.key === "application_deadline")!.status).toBe("covered"); // official + dated
  });

  it("detectGaps: two separate calls, planner first without claims, then strict assessment", async () => {
    const llm = mockLlm({
      "Topic planning": () => ({ topics: [] }),
      "Gap detection": (m) => {
        const topics = block(m, "TOPICS") as { key: string }[];
        const claims = block(m, "CLAIMS") as { id: string; quote: string }[];
        const id = (q: string) => claims.find((c) => c.quote.includes(q))!.id;
        expect(topics.map((t) => t.key)).toContain("application_deadline");
        return { assessments: topics.map((t) => (t.key === "application_deadline" ? { key: t.key, status: "covered", claimIds: [id("Deadline 31 Oct")] } : t.key === "income_limit" ? { key: t.key, status: "covered", claimIds: [id("4.5 lakh per annum")] } : { key: t.key, status: "missing", claimIds: [] })) };
      },
    });
    const r = await detectGaps({ sources: [S1, S2, S4], claims: ALL.filter((c) => c.sourceId !== "s5") }, { sessionId: "x", brief: BRIEF, llm, now: NOW });
    expect(llm.calls.map((c) => c.label)).toEqual(["Topic planning", "Gap detection"]);
    expect(llm.calls[1]!.prompt).toMatch(/ASKED SCOPE: The question asks about the 2026-27 cycle/);
    expect(r.askedScope).toBe("2026-27");
    expect(r.coverage.find((t) => t.key === "application_deadline")!.status).toBe("partial");
    expect(r.coverage.find((t) => t.key === "income_limit")!.status).toBe("covered");
    expect(r.gaps.length).toBe(r.coverage.length - 1);
  });
});

/* ----------------------------- contradictions ----------------------------- */

describe("contradiction values and cycles", () => {
  it("extracts amounts, percentages and dates and finds differing values", () => {
    const v = extractValues("Income up to Rs. 4.5 lakh; ₹12,000 per annum; 80th percentile; 50%; last date 31.10.2025; Deadline 31 Oct");
    expect(v.map((x) => `${x.kind}:${x.value}`)).toEqual(["amount:₹450000", "amount:₹12000", "percent:80%", "percent:50%", "date:2025-10-31", "date:--oct-31"]);
    expect(differingValues(extractValues("up to ₹4.5 Lakh"), extractValues("Rs. 4,50,000"))).toEqual([]);
    expect(differingValues(extractValues("Deadline 31 Oct"), extractValues("is 31.10.2025"))).toEqual([]); // same day of year
    expect(differingValues(extractValues("September 30, 2026"), extractValues("31-10-2026"))[0]!.kind).toBe("date");
  });
  it("determines claim cycles from text, dates or a single-cycle source", () => {
    expect(cycleOfClaim(c_cbseDeadline, S2).label).toBe("2025-26");
    expect(cycleOfClaim(c_nspDeadline, S5).label).toBe("2026-27");
    expect(cycleOfClaim(cl("d", "s2", "Applicants must apply online."), S2)).toMatchObject({ label: "2025-26", basis: "source" });
    expect(cycleOfClaim(c_aggDeadline, src("u", "https://x.org", "No cycles here"))).toMatchObject({ start: null });
    expect(cycleOfClaim(c_rate, S1).openEnded).toBe(true);
  });
  it("classifies cross-cycle differences as cycle mismatch, same-cycle ones as contradictions", () => {
    const k = (start: number | null) => ({ start, label: start ? `${start}` : null, openEnded: false, basis: "claim" as const });
    expect(classifyPositions([[k(2025)], [k(2026)]]).kind).toBe("cycle_mismatch");
    expect(classifyPositions([[k(2026)], [k(2026)]], "different").kind).toBe("contradiction");
    expect(classifyPositions([[k(2026)], [k(null)]]).kind).toBe("contradiction");
    expect(classifyPositions([[k(2026)], [k(null)]]).unknown).toEqual([1]);
  });

  it("detectContradictions: sends values + cycles, reclassifies cross-cycle, keeps same-cycle", async () => {
    const aggSep = cl("c_sep", "s4", "The student submission deadline for the 2026-27 academic cycle is September 30, 2026.", { category: "date_deadline", date: "2026-09-30" });
    const claims = [c_cbseDeadline, c_nspDeadline, aggSep];
    const coverage: TopicCoverage[] = [{ id: "t", key: "application_deadline", label: "Deadline", whyItMatters: "", status: "partial", claimIds: claims.map((c) => c.id), sourceIds: [] }];
    let diffs: unknown[] = [];
    const llm = mockLlm({
      "Contradiction detection": (m) => {
        const groups = block(m, "GROUPS") as { claims: { id: string; quote: string; cycle: string; values?: string[] }[] }[];
        diffs = block(m, "VALUE DIFFERENCES") as unknown[];
        const g = groups[0]!.claims;
        const id = (q: string) => g.find((c) => c.quote.includes(q))!.id;
        expect(g.find((c) => c.quote.includes("31.10.2025"))).toMatchObject({ cycle: "2025-26", values: ["31.10.2025"] });
        return { contradictions: [
          { topicKey: "application_deadline", topic: "Deadline", description: "31.10.2025 vs 31-10-2026.", severity: "high", positions: [{ statement: "31 Oct 2025", claimIds: [id("31.10.2025")] }, { statement: "31 Oct 2026", claimIds: [id("31-10-2026")] }], cycleRelation: "same" },
          { topicKey: "application_deadline", topic: "2026-27 deadline", description: "30 Sep 2026 vs 31 Oct 2026.", severity: "high", positions: [{ statement: "30 Sep 2026", claimIds: [id("September 30")] }, { statement: "31 Oct 2026", claimIds: [id("31-10-2026")] }], cycleRelation: "same" },
        ] };
      },
    });
    const r = await detectContradictions({ sources: [S2, S4, S5], claims, coverage }, { sessionId: "x", brief: BRIEF, llm, now: NOW });
    expect(diffs.length).toBeGreaterThan(0);
    expect(r.valueDifferences).toBe(diffs.length);
    expect(r.contradictions.map((c) => c.kind)).toEqual(["cycle_mismatch", "contradiction"]);
    expect(r.contradictions[0]!.description).toMatch(/^Cycle mismatch, not a contradiction/);
    expect(r.contradictions[0]!.severity).toBe("low");
    expect(r.contradictions[0]!.cycles).toEqual(["2025-26", "2026-27"]);
    expect(r.contradictions[1]!.cycles).toEqual(["2026-27", "2026-27"]);
  });
});

/* ------------------------------- AI freshness ------------------------------- */

describe("AI freshness reconciled with rule-based in-force determination", () => {
  const applicable = cl("c_app", "s1", "PM-USP CSSS Guidelines (Applicable for academic year 2022-23 onwards)");
  it("suppresses an AI past-cycle warning resting on 'onwards' wording; downgrades one resting on other claims", () => {
    expect(reconcileAiFreshness("references_past_cycle", "medium", "Refers to 2022-23.", [applicable], S1, 2026)).toBe("suppress");
    const d = reconcileAiFreshness("references_past_cycle", "medium", "Income limit may be old.", [c_income], S1, 2026);
    expect(d).not.toBe("suppress");
    expect(d).toMatchObject({ severity: "low" });
    expect((d as { description: string }).description).toMatch(/^Requires verification: .*2022-23 onwards/);
    // sources without an in-force statement are untouched; other reasons untouched
    expect(reconcileAiFreshness("references_past_cycle", "medium", "x", [c_cbseDeadline], S2, 2026)).toEqual({ severity: "medium", description: "x" });
    expect(reconcileAiFreshness("expired_deadline", "high", "x", [applicable], S1, 2026)).toEqual({ severity: "high", description: "x" });
  });
  it("analyzeFreshness drops the conflicting AI warning and reports it", async () => {
    const llm = mockLlm({
      "Freshness analysis": (m) => {
        const claims = block(m, "CLAIMS") as { id: string; quote: string }[];
        const id = claims.find((c) => c.quote.includes("onwards"))!.id;
        return { warnings: [{ sourceId: "S1", reason: "references_past_cycle", description: "Guidelines refer to 2022-23.", severity: "medium", claimIds: [id] }] };
      },
    });
    const r = await analyzeFreshness({ sources: [S1], claims: [applicable, c_rate] }, { sessionId: "x", brief: BRIEF, llm, now: NOW });
    expect(r.aiSuppressed).toBe(1);
    expect(r.warnings.filter((w) => w.origin === "ai")).toEqual([]);
    expect(r.warnings.filter((w) => w.sourceId === "s1" && w.reason === "references_past_cycle")).toEqual([]);
  });
});
