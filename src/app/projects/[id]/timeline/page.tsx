"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ProjectTimelineResponse, EventCategory } from "@/lib/timeline/service";

interface TimelinePageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectTimelinePage({ params }: TimelinePageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [timelineData, setTimelineData] = useState<ProjectTimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | "ALL">("ALL");

  useEffect(() => {
    async function loadTimeline() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/timeline`);
        if (!res.ok) {
          throw new Error(`Failed to load timeline: HTTP ${res.status}`);
        }
        const data = await res.json();
        setTimelineData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading project timeline");
      } finally {
        setIsLoading(false);
      }
    }

    loadTimeline();
  }, [projectId]);

  const categories: Array<EventCategory | "ALL"> = [
    "ALL",
    "SCOPE",
    "REQUEST",
    "PROPOSAL",
    "INVOICE",
    "PAYMENT",
  ];

  const filteredEvents =
    timelineData?.events.filter((evt) =>
      selectedCategory === "ALL" ? true : evt.category === selectedCategory
    ) || [];

  const getActorBadge = (actorType: string) => {
    switch (actorType) {
      case "PAYPAL":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#111318] text-[#D4AF65] border border-[#D4AF65]/30 font-mono">
            PayPal
          </span>
        );
      case "CLIENT":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30">
            Client
          </span>
        );
      case "PROVIDER":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
            Provider
          </span>
        );
      case "SYSTEM":
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#111318] text-[#9298A3] border border-[#292D35]">
            System
          </span>
        );
    }
  };

  const getCategoryIcon = (category: EventCategory) => {
    switch (category) {
      case "SCOPE":
        return "📄";
      case "REQUEST":
        return "💬";
      case "PROPOSAL":
        return "📝";
      case "INVOICE":
        return "💳";
      case "PAYMENT":
        return "💰";
      default:
        return "📌";
    }
  };

  return (
    <AppShell
      projectId={projectId}
      breadcrumbs={[
        { label: `Project (${projectId.slice(0, 8)}...)`, href: `/projects/${projectId}/baseline` },
        { label: "Activity Timeline", active: true },
      ]}
    >
      <div className="space-y-6">
        {/* Workspace Subnavigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#292D35] pb-3 overflow-x-auto">
          <Link
            href={`/projects/${projectId}/baseline`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Baseline
          </Link>
          <Link
            href={`/projects/${projectId}/requests`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Scope Intelligence
          </Link>
          <Link
            href={`/projects/${projectId}/proposals`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Proposals
          </Link>
          <span className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#D4AF65] bg-[#D4AF65]/10 border border-[#D4AF65]/30">
            Timeline
          </span>
        </div>

        {/* Title & Filter Row */}
        <GlassCard variant="surface" intensity="prominent" className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#F5F3ED]">Project Activity Timeline</h1>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#D4AF65]/10 text-[#D4AF65] border border-[#D4AF65]/30">
                  {timelineData?.totalCount || 0} Events
                </span>
              </div>
              <p className="text-xs text-[#9298A3] mt-1">
                Auditable chronological commercial history from agreement baseline to invoice settlement.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                    selectedCategory === cat
                      ? "bg-[#D4AF65] text-[#090A0C] font-bold shadow-sm shadow-[#D4AF65]/25"
                      : "bg-[#111318]/80 text-[#9298A3] border border-[#292D35] hover:text-[#F5F3ED] hover:border-[#D4AF65]/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Loading state */}
        {isLoading && (
          <div className="py-20 text-center text-[#9298A3] text-sm space-y-2">
            <div className="inline-block animate-spin text-2xl">⏳</div>
            <p className="font-mono">Loading project audit history...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-[#E06C75]/10 border border-[#E06C75]/30 rounded-xl text-xs text-[#E06C75]">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredEvents.length === 0 && (
          <GlassCard variant="surface" intensity="subtle" className="border-dashed border-[#292D35] p-12 text-center text-[#9298A3] text-sm space-y-2">
            <div className="text-3xl">📌</div>
            <h3 className="font-bold text-[#F5F3ED]">No Events Found</h3>
            <p className="text-xs text-[#9298A3]">
              No historical records match the selected filter category.
            </p>
          </GlassCard>
        )}

        {/* Vertical Timeline */}
        {!isLoading && filteredEvents.length > 0 && (
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#292D35]/80">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-6 top-1.5 w-6 h-6 rounded-full bg-[#171A20] border-2 border-[#D4AF65] flex items-center justify-center text-xs shadow-[0_0_10px_rgba(212,175,101,0.25)] group-hover:shadow-[0_0_14px_rgba(212,175,101,0.45)] group-hover:scale-110 transition-all z-10">
                  {getCategoryIcon(event.category)}
                </div>

                {/* Event Card */}
                <GlassCard variant="surface" intensity="subtle" className="p-4 space-y-2.5 ml-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActorBadge(event.actorType)}
                      <span className="text-[11px] font-bold text-[#9298A3] uppercase tracking-wider font-mono">
                        {event.eventType}
                      </span>
                      {event.proposalVersion != null && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
                          Proposal v{event.proposalVersion}
                        </span>
                      )}
                      {event.resourceId && (
                        <span className="text-[10px] font-mono text-[#9298A3] bg-[#090A0C]/80 border border-white/[0.08] px-2 py-0.5 rounded">
                          ID: {event.resourceId}
                        </span>
                      )}
                    </div>

                    <div className="text-right text-[11px] text-[#9298A3] font-mono">
                      <span>{event.formattedDate} at {event.formattedTime}</span>
                      <span className="ml-1.5 text-[#9298A3]/70">({event.relativeTime})</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#F5F3ED] leading-relaxed font-medium">
                    {event.description}
                  </p>

                  {/* Metadata pill details if available */}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="bg-[#111318]/90 rounded-lg p-2.5 text-[11px] font-mono text-[#9298A3] flex flex-wrap items-center gap-x-4 gap-y-1 border border-[#292D35]">
                      {event.metadata.amount != null && (
                        <div>
                          Amount: <span className="font-bold text-[#D4AF65]">{event.metadata.currency || "USD"} {event.metadata.amount}</span>
                        </div>
                      )}
                      {event.metadata.classification && (
                        <div>
                          Classification: <span className="font-bold text-[#F5F3ED]">{event.metadata.classification}</span>
                        </div>
                      )}
                      {event.metadata.paypalInvoiceId && (
                        <div>
                          PayPal Invoice ID: <span className="font-bold text-[#F5F3ED]">{event.metadata.paypalInvoiceId}</span>
                        </div>
                      )}
                      {event.metadata.reconciledStatus && (
                        <div>
                          Status: <span className="font-bold text-[#43B581]">{event.metadata.reconciledStatus}</span>
                        </div>
                      )}
                      {event.metadata.provider && (
                        <div>
                          AI Model: <span className="text-[#F5F3ED]">{event.metadata.provider}{event.metadata.model ? ` (${event.metadata.model})` : ""}</span>
                        </div>
                      )}
                      {event.href && (
                        <Link
                          href={event.href}
                          className="ml-auto text-[#D4AF65] hover:text-[#E2C17F] font-bold hover:underline"
                        >
                          Inspect Resource →
                        </Link>
                      )}
                    </div>
                  )}
                </GlassCard>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
