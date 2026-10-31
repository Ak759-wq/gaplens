"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SessionView } from "@/lib/view-types";
import { ChecklistPanel, ContradictionsPanel, ExtractedPanel, FreshnessPanel, GapsPanel, OverviewPanel, QuestionsPanel, SourcesPanel } from "./panels";
import { DASHBOARD_TABS } from "./tabs-config";

/** Evidence-linked report dashboard (8 tabs). Every finding links to its source and verified quote. */
export function ResearchDashboard({ view, onToggleChecklist }: { view: SessionView; onToggleChecklist: (id: string, done: boolean) => Promise<void> }) {
  const [tab, setTab] = useState("overview");
  const counts: Record<string, number | undefined> = {
    extracted: view.claims.length,
    gaps: view.gaps.length,
    contradictions: view.contradictions.length,
    freshness: view.freshness.filter((f) => f.reason !== "undated").length,
    questions: view.questions.length,
    checklist: view.checklist.filter((c) => !c.done).length,
    sources: view.sources.length,
  };
  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:hidden">
        <TabsList className="h-auto gap-1 rounded-lg border bg-muted/60 p-1" aria-label="Report sections">
          {DASHBOARD_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon aria-hidden="true" />
              {t.label}
              {counts[t.value] !== undefined && <span className="ml-1 rounded-full bg-background px-1.5 text-[11px] tabular-nums text-muted-foreground">{counts[t.value]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="overview"><OverviewPanel view={view} onJump={setTab} /></TabsContent>
      <TabsContent value="extracted"><ExtractedPanel view={view} /></TabsContent>
      <TabsContent value="gaps"><GapsPanel view={view} /></TabsContent>
      <TabsContent value="contradictions"><ContradictionsPanel view={view} /></TabsContent>
      <TabsContent value="freshness"><FreshnessPanel view={view} /></TabsContent>
      <TabsContent value="questions"><QuestionsPanel view={view} /></TabsContent>
      <TabsContent value="checklist"><ChecklistPanel view={view} onToggle={onToggleChecklist} /></TabsContent>
      <TabsContent value="sources"><SourcesPanel view={view} /></TabsContent>
    </Tabs>
  );
}
