"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { FinancialOverview } from "@/components/dashboard/FinancialOverview";
import { ActionRequiredList } from "@/components/dashboard/ActionRequiredList";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import type { DashboardOverviewResponse } from "@/lib/dashboard/types";

export default function HomePage() {
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultProjectId = "demo-project-01";

  const fetchOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/overview");
      if (!res.ok) {
        throw new Error(`Failed to load dashboard: HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900">
                  Accordly
                </h1>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-200">
                  Scope-to-Cash
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Executive Provider Dashboard & Commercial Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchOverview}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-300 disabled:opacity-50"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>

            <Link
              href={`/projects/${defaultProjectId}/baseline`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <span>+ Contract Baseline</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between shadow-sm">
            <span>{error}</span>
            <button
              onClick={fetchOverview}
              className="font-bold underline ml-4 hover:text-rose-950"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !data && (
          <div className="py-20 text-center text-slate-500 text-sm space-y-3">
            <div className="inline-block animate-spin text-3xl">⏳</div>
            <p className="font-semibold text-slate-700">Loading commercial portfolio...</p>
            <p className="text-xs text-slate-400">Aggregating contracts, baselines, proposals, and verified invoices</p>
          </div>
        )}

        {/* Dashboard Content */}
        {data && (
          <div className="space-y-6">
            {/* KPI Cards Row */}
            <KpiCards kpis={data.kpis} />

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (Main Workflows) */}
              <div className="lg:col-span-8 space-y-6">
                {/* Action Required Priority List */}
                <ActionRequiredList items={data.actionRequiredItems} />

                {/* Multi-Currency Financial Overview */}
                <FinancialOverview
                  financialSummaries={data.financialSummaries}
                  currencies={data.currencies}
                />

                {/* Active Engagements Project Grid */}
                <ProjectGrid projects={data.recentProjects} />
              </div>

              {/* Right Column (Recent Activity & Quick Links) */}
              <div className="lg:col-span-4 space-y-6">
                {/* Cross-Project Recent Activity Stream */}
                <RecentActivityFeed activity={data.recentActivity} />

                {/* Quick Workflow Navigation Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Core Workflows
                  </h3>
                  <div className="space-y-2 text-xs">
                    <Link
                      href={`/projects/${defaultProjectId}/proposals`}
                      className="block p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">Commercial Proposals</span>
                      <span className="text-[11px] text-slate-500">Draft, price, and share change orders with clients.</span>
                    </Link>

                    <Link
                      href={`/projects/${defaultProjectId}/requests`}
                      className="block p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">Scope Intelligence</span>
                      <span className="text-[11px] text-slate-500">Tri-state classification against agreed baselines.</span>
                    </Link>

                    <Link
                      href={`/projects/${defaultProjectId}/baseline`}
                      className="block p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">Agreement Ingestion</span>
                      <span className="text-[11px] text-slate-500">PDF/TXT upload and 7-category contract extraction.</span>
                    </Link>

                    <Link
                      href={`/projects/${defaultProjectId}/timeline`}
                      className="block p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">Project Activity Timeline</span>
                      <span className="text-[11px] text-slate-500">Auditable chronological lifecycle history.</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
