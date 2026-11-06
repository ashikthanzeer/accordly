"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
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
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            PayPal
          </span>
        );
      case "CLIENT":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            Client
          </span>
        );
      case "PROVIDER":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            Provider
          </span>
        );
      case "SYSTEM":
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-900">
              {timelineData?.project.name || "Project"}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-600">Activity Timeline</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${projectId}/baseline`}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Baseline
            </Link>
            <Link
              href={`/projects/${projectId}/requests`}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Requests
            </Link>
            <Link
              href={`/projects/${projectId}/proposals`}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Proposals
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Title & Filter Row */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Project Activity Timeline</h1>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {timelineData?.totalCount || 0} Events
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
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
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    selectedCategory === cat
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="py-20 text-center text-slate-500 text-sm space-y-2">
            <div className="inline-block animate-spin text-2xl">⏳</div>
            <p>Loading project audit history...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredEvents.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm space-y-2">
            <div className="text-3xl">📌</div>
            <h3 className="font-bold text-slate-800">No Events Found</h3>
            <p className="text-xs text-slate-400">
              No historical records match the selected filter category.
            </p>
          </div>
        )}

        {/* Vertical Timeline */}
        {!isLoading && filteredEvents.length > 0 && (
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-6 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-indigo-400 flex items-center justify-center text-xs shadow-sm group-hover:border-indigo-600 transition-colors">
                  {getCategoryIcon(event.category)}
                </div>

                {/* Event Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2 group-hover:border-slate-300 transition-colors ml-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getActorBadge(event.actorType)}
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {event.eventType}
                      </span>
                    </div>

                    <div className="text-right text-[11px] text-slate-400">
                      <span>{event.formattedDate} at {event.formattedTime}</span>
                      <span className="ml-1.5 text-slate-300">({event.relativeTime})</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {event.description}
                  </p>

                  {/* Metadata pill details if available */}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-2.5 text-[11px] font-mono text-slate-600 space-y-0.5 border border-slate-100">
                      {event.metadata.amount && (
                        <div>
                          Amount: <span className="font-bold text-slate-900">{event.metadata.currency || "USD"} {event.metadata.amount}</span>
                        </div>
                      )}
                      {event.metadata.paypalInvoiceId && (
                        <div>
                          PayPal Invoice ID: <span className="font-bold text-indigo-700">{event.metadata.paypalInvoiceId}</span>
                        </div>
                      )}
                      {event.metadata.reconciledStatus && (
                        <div>
                          Status: <span className="font-bold text-emerald-700">{event.metadata.reconciledStatus}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

