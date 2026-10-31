import type { Claim, EvidenceRef, Source } from "@/server/ai/schemas";
import { verifyQuoteInSource } from "./provenance";
import { hasReliableDate, isOfficialSource } from "./scope";

/**
 * Short aliases for prompts (S1, C1, F1). Models copy short ids far more reliably than UUIDs and they
 * cost fewer tokens. Every alias the model returns is resolved here; unknown aliases are dropped.
 */
export class AliasMap<T extends { id: string }> {
  private readonly byAlias = new Map<string, T>();
  private readonly aliasById = new Map<string, string>();
  constructor(items: T[], prefix: string) {
    items.forEach((it, i) => {
      const a = `${prefix}${i + 1}`;
      this.byAlias.set(a, it);
      this.aliasById.set(it.id, a);
    });
  }
  alias(id: string): string {
    return this.aliasById.get(id) ?? "?";
  }
  resolve(alias: string): T | undefined {
    return this.byAlias.get(alias.trim().toUpperCase()) ?? this.byAlias.get(alias.trim());
  }
  resolveMany(aliases: string[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const a of aliases) {
      const it = this.resolve(a);
      if (it && !seen.has(it.id)) {
        seen.add(it.id);
        out.push(it);
      }
    }
    return out;
  }
}

export function corpusAliases(corpus: { sources: Source[]; claims: Claim[] }) {
  return { sources: new AliasMap(corpus.sources, "S"), claims: new AliasMap(corpus.claims, "C") };
}

/** Evidence built from verified claims (quotes come from our records, never from the model). */
export function evidenceFromClaims(claims: Claim[]): EvidenceRef[] {
  return claims.map((c) => ({ claimId: c.id, sourceId: c.sourceId, quote: c.quote }));
}

/** Keep only evidence whose quote is found in the stored text of its source. */
export function verifyEvidence(evidence: EvidenceRef[], sources: Source[]): EvidenceRef[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return evidence.filter((e) => {
    const text = byId.get(e.sourceId)?.contentText;
    return !!text && verifyQuoteInSource(e.quote, text).verified;
  });
}

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Compact JSON for prompts. */
export function sourcesForPrompt(sources: Source[], aliases: AliasMap<Source>) {
  return JSON.stringify(
    sources.map((s) => ({
      id: aliases.alias(s.id),
      title: s.title,
      host: s.url ? safeHost(s.url) : null,
      file: s.fileName,
      published: s.publishedAt ? s.publishedAt.slice(0, 10) : null,
      updated: s.modifiedAt ? s.modifiedAt.slice(0, 10) : null,
      official: isOfficialSource(s),
      reliableDate: hasReliableDate(s),
    })),
  );
}

export function claimsForPrompt(claims: Claim[], ca: AliasMap<Claim>, sa: AliasMap<Source>, quoteChars = 220) {
  return JSON.stringify(
    claims.map((c) => ({ id: ca.alias(c.id), source: sa.alias(c.sourceId), category: c.category, text: trunc(c.text, 300), quote: trunc(c.quote, quoteChars), ...(c.date ? { date: c.date } : {}) })),
  );
}

export function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
