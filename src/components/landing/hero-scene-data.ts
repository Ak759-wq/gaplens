/**
 * Illustrative content for the landing hero scene. None of this is real analysis output;
 * the hero labels it as illustrative.
 */
export type HeroPanelKind = "verified" | "gap" | "contradiction" | "outdated" | "ai_suggestion";

export type HeroPanel = {
  kind: HeroPanelKind;
  /** Short topic shown after the label in the tooltip. */
  topic: string;
  /** Vertical offset on the orbit. */
  y: number;
  /** Small roll so the panels don't look stamped out. */
  roll: number;
  /** Panels with a missing block of lines (the "gap"). */
  hasGap?: boolean;
  /** Seed for the text-line layout. */
  seed: number;
};

export const HERO_KIND_META: Record<HeroPanelKind, { label: string; color: string; dot: string }> = {
  verified: { label: "Source-backed", color: "#34d399", dot: "bg-emerald-400" },
  gap: { label: "Potential gap", color: "#fb923c", dot: "bg-orange-400" },
  contradiction: { label: "Possible contradiction", color: "#f87171", dot: "bg-red-400" },
  outdated: { label: "Potentially outdated", color: "#fbbf24", dot: "bg-amber-400" },
  ai_suggestion: { label: "AI suggestion", color: "#a78bfa", dot: "bg-violet-400" },
};

/** Order matters: the first five are the mobile set, and indexes 1 and 4 are the contradiction pair. */
export const HERO_PANELS: HeroPanel[] = [
  { kind: "verified", topic: "eligibility criteria", y: 0.55, roll: 0.05, seed: 3 },
  { kind: "contradiction", topic: "application deadline", y: -0.35, roll: -0.06, seed: 7 },
  { kind: "gap", topic: "renewal conditions", y: 0.15, roll: 0.03, hasGap: true, seed: 11 },
  { kind: "outdated", topic: "2025-26 cycle", y: -0.7, roll: -0.04, seed: 5 },
  { kind: "contradiction", topic: "deadline", y: 0.75, roll: 0.06, seed: 13 },
  { kind: "ai_suggestion", topic: "ask about document format", y: -0.15, roll: -0.03, seed: 17 },
  { kind: "gap", topic: "income certificate validity", y: 0.4, roll: 0.04, hasGap: true, seed: 19 },
  { kind: "verified", topic: "fee amount", y: -0.6, roll: -0.05, seed: 23 },
];

export const CONTRADICTION_PAIR: [number, number] = [1, 4];
