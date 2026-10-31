"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FindingBadge } from "@/components/evidence/finding-badge";
import { EmptyState } from "./empty-state";
import { DASHBOARD_TABS } from "./tabs-config";

/**
 * Phase 1 dashboard shell. Renders the tab structure with honest empty states only.
 * Phase 3 passes a validated Report and renders real findings in each tab.
 */
export function ResearchDashboard() {
  return (
    <Tabs defaultValue="overview" className="gap-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="h-auto gap-1 rounded-lg border bg-muted/60 p-1" aria-label="Report sections">
          {DASHBOARD_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon aria-hidden="true" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {DASHBOARD_TABS.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          <EmptyState icon={t.icon} title={t.emptyTitle} description={t.emptyDescription}>
            <div className="flex flex-col items-center gap-4">
              {t.badge && <FindingBadge kind={t.badge} />}
              <Button asChild variant="outline" size="sm">
                <Link href="/workspace">Go to research workspace</Link>
              </Button>
            </div>
          </EmptyState>
        </TabsContent>
      ))}
    </Tabs>
  );
}
