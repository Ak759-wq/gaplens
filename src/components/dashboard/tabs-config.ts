import type { LucideIcon } from "lucide-react";
import { CircleDashed, Clock, FileStack, GitCompareArrows, HelpCircle, LayoutDashboard, ListChecks, Quote } from "lucide-react";
import type { FindingKind } from "@/components/evidence/finding-labels";

export type DashboardTab = {
  value: string;
  label: string;
  icon: LucideIcon;
  badge?: FindingKind;
  emptyTitle: string;
  emptyDescription: string;
};

export const DASHBOARD_TABS: DashboardTab[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard, emptyTitle: "No analysis yet", emptyDescription: "Once sources are analysed, this tab summarises coverage: how many sources were reviewed, how many claims were extracted, and how many findings need attention." },
  { value: "extracted", label: "Extracted Information", icon: Quote, badge: "verified", emptyTitle: "No claims extracted", emptyDescription: "Atomic claims from each source will appear here, each with its verbatim quote, category and source." },
  { value: "gaps", label: "Information Gaps", icon: CircleDashed, badge: "gap", emptyTitle: "No gaps detected yet", emptyDescription: "Information your question needs that the reviewed sources don't state. Not found in the reviewed sources doesn't mean it doesn't exist." },
  { value: "contradictions", label: "Contradictions", icon: GitCompareArrows, badge: "contradiction", emptyTitle: "No contradictions detected yet", emptyDescription: "Conflicting statements across sources will be shown side by side with their quotes. GapLens won't pick a side arbitrarily." },
  { value: "freshness", label: "Freshness Warnings", icon: Clock, badge: "outdated", emptyTitle: "No freshness warnings yet", emptyDescription: "Sources tied to old dates or past cycles will be flagged here. Undated sources are labelled undated, not outdated." },
  { value: "questions", label: "Unanswered Questions", icon: HelpCircle, badge: "not_found", emptyTitle: "No open questions yet", emptyDescription: "Concrete questions the sources leave open, each linked to the findings that raised it." },
  { value: "checklist", label: "Verification Checklist", icon: ListChecks, badge: "requires_verification", emptyTitle: "No checklist yet", emptyDescription: "A prioritised (high / medium / low) list of what to confirm, with the reason and linked findings for each item." },
  { value: "sources", label: "Sources & Evidence", icon: FileStack, badge: "info", emptyTitle: "No sources recorded", emptyDescription: "Every source with its title, URL or file, publication and retrieval dates, and extraction status, plus the quotes cited from it." },
];
