"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { FinancialOverview } from "@/components/dashboard/FinancialOverview";
import { ActionRequiredList } from "@/components/dashboard/ActionRequiredList";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { GlassCard } from "@/components/ui/GlassCard";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import type { DashboardOverviewResponse } from "@/lib/dashboard/types";

export default function HomePage() {
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const defaultProjectId = data?.recentProjects?.[0]?.id || "demo-project-01";

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

  const headerActions = (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={fetchOverview}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-white/[0.08] disabled:opacity-50"
      >
        <span>Refresh</span>
      </button>

      <button
        type="button"
        onClick={() => setIsCreateProjectOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] transition-all shadow-sm shadow-[#D4AF65]/15 active:scale-95"
      >
        <span>+ New Project</span>
      </button>

      <Link
        href={`/projects/${defaultProjectId}/baseline`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#D4AF65] hover:text-[#F5F3ED] bg-[#D4AF65]/10 hover:bg-[#D4AF65]/20 transition-all border border-[#D4AF65]/30"
      >
        <span>+ Contract Baseline</span>
      </Link>
    </div>
  );

  return (
    <AppShell
      breadcrumbs={[{ label: "Executive Overview", active: true }]}
      actions={headerActions}
    >
      {/* Welcome Banner */}
      <GlassCard intensity="prominent" className="p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-[#D4AF65] uppercase font-mono">
                ACCORDLY FINANCIAL TERMINAL
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#43B581] animate-pulse" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#F5F3ED] tracking-tight mt-1">
              Executive Commercial Overview
            </h1>
            <p className="text-xs lg:text-sm text-[#9298A3] mt-1.5 max-w-2xl leading-relaxed">
              From agreement to payment, seamlessly. Real-time scope intelligence, client change orders, and authoritative PayPal Sandbox settlements.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <div className="px-4 py-2.5 rounded-xl bg-[#111318]/90 border border-white/[0.08] text-right shadow-sm flex items-center gap-3 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF65]/10 border border-[#D4AF65]/30 flex items-center justify-center text-[#D4AF65] font-black text-xs font-mono">
                PP
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#9298A3] tracking-wider block">
                  Settlement Status
                </span>
                <span className="text-xs font-bold text-[#D4AF65] font-mono flex items-center gap-1.5 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#43B581] animate-pulse" />
                  PayPal v2 Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-[#E06C75]/15 border border-[#E06C75]/30 rounded-xl text-xs text-[#E06C75] flex items-center justify-between shadow-sm">
          <span>{error}</span>
          <button
            onClick={fetchOverview}
            className="font-bold underline ml-4 hover:text-white"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && (
        <div className="py-24 text-center text-[#9298A3] text-sm space-y-3">
          <div className="inline-block animate-spin text-3xl">⏳</div>
          <p className="font-semibold text-[#F5F3ED]">Loading commercial portfolio...</p>
          <p className="text-xs text-[#9298A3]">Aggregating contracts, baselines, proposals, and verified invoices</p>
        </div>
      )}

      {/* Dashboard Content */}
      {data && (
        <div className="space-y-8">
          {/* KPI Cards Row */}
          <KpiCards kpis={data.kpis} />

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (Main Workflows) */}
            <div className="lg:col-span-8 space-y-8">
              {/* Action Required Priority List */}
              <ActionRequiredList items={data.actionRequiredItems} />

              {/* Multi-Currency Financial Overview */}
              <FinancialOverview
                financialSummaries={data.financialSummaries}
                currencies={data.currencies}
              />

              {/* Active Engagements Project Grid */}
              <ProjectGrid
                projects={data.recentProjects}
                onCreateProject={() => setIsCreateProjectOpen(true)}
              />
            </div>

            {/* Right Column (Recent Activity & Quick Links) */}
            <div className="lg:col-span-4 space-y-8">
              {/* Cross-Project Recent Activity Stream */}
              <RecentActivityFeed activity={data.recentActivity} />

              {/* Quick Workflow Navigation Card */}
              <GlassCard intensity="subtle" className="p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A3]">
                    Core Workflows
                  </h3>
                  <span className="text-[10px] text-[#D4AF65] font-mono">QUICK LAUNCH</span>
                </div>
                <div className="space-y-2 text-xs">
                  <Link
                    href={`/projects/${defaultProjectId}/proposals`}
                    className="block p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-[#D4AF65]/40 hover:bg-white/[0.05] transition-all"
                  >
                    <span className="font-bold text-[#F5F3ED] block">Commercial Proposals</span>
                    <span className="text-[11px] text-[#9298A3]">Draft, price, and share change orders with clients.</span>
                  </Link>

                  <Link
                    href={`/projects/${defaultProjectId}/requests`}
                    className="block p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-[#D4AF65]/40 hover:bg-white/[0.05] transition-all"
                  >
                    <span className="font-bold text-[#F5F3ED] block">Scope Intelligence</span>
                    <span className="text-[11px] text-[#9298A3]">Tri-state classification against agreed baselines.</span>
                  </Link>

                  <Link
                    href={`/projects/${defaultProjectId}/baseline`}
                    className="block p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-[#D4AF65]/40 hover:bg-white/[0.05] transition-all"
                  >
                    <span className="font-bold text-[#F5F3ED] block">Agreement Ingestion</span>
                    <span className="text-[11px] text-[#9298A3]">PDF/TXT upload and 7-category contract extraction.</span>
                  </Link>

                  <Link
                    href={`/projects/${defaultProjectId}/timeline`}
                    className="block p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-[#D4AF65]/40 hover:bg-white/[0.05] transition-all"
                  >
                    <span className="font-bold text-[#F5F3ED] block">Project Activity Timeline</span>
                    <span className="text-[11px] text-[#9298A3]">Auditable chronological lifecycle history.</span>
                  </Link>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onProjectCreated={() => {
          fetchOverview();
        }}
      />
    </AppShell>
  );
}
