"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type {
  ScopeDriftFilterInput,
  ScopeDriftRadarData,
} from "@/lib/dashboard/types";

interface ScopeDriftRadarProps {
  radar: ScopeDriftRadarData;
  allProjects: Array<{ id: string; name: string }>;
  filters: ScopeDriftFilterInput;
  onFiltersChange: (nextFilters: ScopeDriftFilterInput) => void;
  isFiltering?: boolean;
}

export function ScopeDriftRadar({
  radar,
  allProjects,
  filters,
  onFiltersChange,
  isFiltering = false,
}: ScopeDriftRadarProps) {
  const currencies = radar.currencies.length > 0 ? radar.currencies : ["USD"];
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currencies[0] || "USD");

  const activeCurrency = currencies.includes(selectedCurrency)
    ? selectedCurrency
    : currencies[0] || "USD";

  const pipeline = radar.pipelineByCurrency[activeCurrency] || {
    currency: activeCurrency,
    additionalProposedValue: 0,
    formattedAdditionalProposedValue: `${activeCurrency} 0.00`,
    providerApprovedValue: 0,
    formattedProviderApprovedValue: `${activeCurrency} 0.00`,
    clientAcceptedValue: 0,
    formattedClientAcceptedValue: `${activeCurrency} 0.00`,
    additionalInvoicedValue: 0,
    formattedAdditionalInvoicedValue: `${activeCurrency} 0.00`,
    additionalRevenueCollected: 0,
    formattedAdditionalRevenueCollected: `${activeCurrency} 0.00`,
    outstandingAdditionalPayments: 0,
    formattedOutstandingAdditionalPayments: `${activeCurrency} 0.00`,
  };

  const { globalMetrics, projectIntelligence, driftAlerts } = radar;
  const totalReq = globalMetrics.totalChangeRequestsCount || 0;
  const inScopePct = totalReq > 0 ? Math.round((globalMetrics.inScopeCount / totalReq) * 100) : 0;
  const outScopePct = totalReq > 0 ? Math.round((globalMetrics.outOfScopeCount / totalReq) * 100) : 0;
  const ambigPct = totalReq > 0 ? Math.max(0, 100 - inScopePct - outScopePct) : 0;

  const hasActiveFilters =
    (filters.projectId && filters.projectId !== "ALL") ||
    (filters.dateRange && filters.dateRange !== "ALL") ||
    (filters.classification && filters.classification !== "ALL") ||
    (filters.proposalStatus && filters.proposalStatus !== "ALL") ||
    (filters.invoiceStatus && filters.invoiceStatus !== "ALL");

  const handleResetFilters = () => {
    onFiltersChange({
      projectId: "ALL",
      dateRange: "ALL",
      classification: "ALL",
      proposalStatus: "ALL",
      invoiceStatus: "ALL",
    });
  };

  return (
    <GlassCard intensity="prominent" className="p-6 lg:p-7 space-y-6 border-[#D4AF65]/25">
      {/* Header & Currency Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF65] animate-pulse" />
              SCOPE DRIFT RADAR
            </span>
            <span className="text-[11px] font-mono text-[#9298A3]">
              Commercial Scope Evolution & Revenue Protection
            </span>
            {isFiltering && (
              <span className="text-[11px] font-mono text-[#D4AF65] animate-pulse">
                Updating radar...
              </span>
            )}
          </div>
          <h2 className="text-xl lg:text-2xl font-extrabold text-[#F5F3ED] tracking-tight">
            Scope Expansion & Multi-Stage Revenue Pipeline
          </h2>
          <p className="text-xs text-[#9298A3] max-w-3xl leading-relaxed">
            Tracks every client request from tri-state contract classification through provider approval, client acceptance, PayPal invoicing, and reconciled cash collection.
          </p>
        </div>

        {/* Currency Selector Pills */}
        {currencies.length > 0 && (
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#9298A3] font-mono">
              Currency:
            </span>
            <div className="inline-flex rounded-xl bg-[#090A0C]/90 p-1 border border-white/[0.08]">
              {currencies.map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setSelectedCurrency(curr)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    activeCurrency === curr
                      ? "bg-[#D4AF65] text-[#090A0C] shadow-sm"
                      : "text-[#9298A3] hover:text-[#F5F3ED]"
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-[#090A0C]/70 border border-white/[0.07] rounded-xl p-3.5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D4AF65] font-mono mr-1">
          <span>Filters:</span>
        </div>

        {/* Project Filter */}
        <select
          aria-label="Filter by Project"
          value={filters.projectId || "ALL"}
          onChange={(e) => onFiltersChange({ ...filters, projectId: e.target.value })}
          className="bg-[#111318] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65]"
        >
          <option value="ALL">All Engagements ({allProjects.length})</option>
          {allProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Date Range Filter */}
        <select
          aria-label="Filter by Date Range"
          value={filters.dateRange || "ALL"}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              dateRange: e.target.value as ScopeDriftFilterInput["dateRange"],
            })
          }
          className="bg-[#111318] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65]"
        >
          <option value="ALL">All Time</option>
          <option value="7D">Last 7 Days</option>
          <option value="30D">Last 30 Days</option>
          <option value="90D">Last 90 Days</option>
        </select>

        {/* Change Classification Filter */}
        <select
          aria-label="Filter by Classification"
          value={filters.classification || "ALL"}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              classification: e.target.value as ScopeDriftFilterInput["classification"],
            })
          }
          className="bg-[#111318] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65]"
        >
          <option value="ALL">All Classifications</option>
          <option value="OUT_OF_SCOPE">OUT_OF_SCOPE Only</option>
          <option value="AMBIGUOUS">AMBIGUOUS Only</option>
          <option value="IN_SCOPE">IN_SCOPE Only</option>
        </select>

        {/* Proposal Status Filter */}
        <select
          aria-label="Filter by Proposal Status"
          value={filters.proposalStatus || "ALL"}
          onChange={(e) => onFiltersChange({ ...filters, proposalStatus: e.target.value })}
          className="bg-[#111318] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65]"
        >
          <option value="ALL">All Proposal Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Provider Approved</option>
          <option value="SENT_TO_CLIENT">Sent to Client</option>
          <option value="CLIENT_ACCEPTED">Client Accepted</option>
          <option value="CLIENT_REJECTED">Client Rejected</option>
          <option value="SUPERSEDED">Superseded</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>

        {/* Invoice Status Filter */}
        <select
          aria-label="Filter by Invoice Status"
          value={filters.invoiceStatus || "ALL"}
          onChange={(e) => onFiltersChange({ ...filters, invoiceStatus: e.target.value })}
          className="bg-[#111318] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65]"
        >
          <option value="ALL">All Invoice Statuses</option>
          <option value="UNPAID">Unpaid / Awaiting Settlement</option>
          <option value="SENT">Sent</option>
          <option value="OVERDUE">Overdue</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid & Reconciled</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="ml-auto text-xs font-semibold text-[#D4AF65] hover:text-[#F5F3ED] underline px-2 py-1"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Global Scope Metrics & Distribution Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-[#111318]/90 border border-white/[0.07] rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9298A3] block">
            Active Engagements
          </span>
          <span className="text-xl font-extrabold font-mono text-[#F5F3ED] mt-1 block">
            {globalMetrics.activeEngagementsCount}
          </span>
        </div>

        <div className="bg-[#111318]/90 border border-white/[0.07] rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9298A3] block">
            Total Requests
          </span>
          <span className="text-xl font-extrabold font-mono text-[#F5F3ED] mt-1 block">
            {globalMetrics.totalChangeRequestsCount}
          </span>
        </div>

        <div className="bg-[#43B581]/[0.07] border border-[#43B581]/25 rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#43B581] block">
            IN_SCOPE
          </span>
          <span className="text-xl font-extrabold font-mono text-[#43B581] mt-1 block">
            {globalMetrics.inScopeCount}
          </span>
        </div>

        <div className="bg-[#E06C75]/[0.07] border border-[#E06C75]/25 rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#E06C75] block">
            OUT_OF_SCOPE
          </span>
          <span className="text-xl font-extrabold font-mono text-[#E06C75] mt-1 block">
            {globalMetrics.outOfScopeCount}
          </span>
        </div>

        <div className="bg-[#E5B45C]/[0.07] border border-[#E5B45C]/25 rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#E5B45C] block">
            AMBIGUOUS
          </span>
          <span className="text-xl font-extrabold font-mono text-[#E5B45C] mt-1 block">
            {globalMetrics.ambiguousCount}
          </span>
        </div>

        <div className="bg-[#111318]/90 border border-white/[0.07] rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9298A3] block">
            Pending Proposals
          </span>
          <span className="text-xl font-extrabold font-mono text-[#E5B45C] mt-1 block">
            {globalMetrics.pendingProposalsCount}
          </span>
        </div>

        <div className="bg-[#111318]/90 border border-white/[0.07] rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9298A3] block">
            Provider Approved
          </span>
          <span className="text-xl font-extrabold font-mono text-[#D4AF65] mt-1 block">
            {globalMetrics.providerApprovedProposalsCount}
          </span>
        </div>

        <div className="bg-[#43B581]/[0.07] border border-[#43B581]/25 rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#43B581] block">
            Client Accepted
          </span>
          <span className="text-xl font-extrabold font-mono text-[#43B581] mt-1 block">
            {globalMetrics.clientAcceptedProposalsCount}
          </span>
        </div>
      </div>

      {/* Scope Classification Distribution Bar */}
      {totalReq > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#9298A3]">
            <span>Scope Classification Distribution ({totalReq} analyzed requests)</span>
            <div className="flex items-center gap-4">
              <span className="text-[#43B581]">In Scope: {inScopePct}%</span>
              <span className="text-[#E06C75]">Out of Scope: {outScopePct}%</span>
              <span className="text-[#E5B45C]">Ambiguous: {ambigPct}%</span>
            </div>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#090A0C] overflow-hidden flex border border-white/[0.08]">
            {inScopePct > 0 && (
              <div
                style={{ width: `${inScopePct}%` }}
                className="bg-[#43B581] h-full transition-all"
                title={`IN_SCOPE: ${globalMetrics.inScopeCount}`}
              />
            )}
            {outScopePct > 0 && (
              <div
                style={{ width: `${outScopePct}%` }}
                className="bg-[#E06C75] h-full transition-all"
                title={`OUT_OF_SCOPE: ${globalMetrics.outOfScopeCount}`}
              />
            )}
            {ambigPct > 0 && (
              <div
                style={{ width: `${ambigPct}%` }}
                className="bg-[#E5B45C] h-full transition-all"
                title={`AMBIGUOUS: ${globalMetrics.ambiguousCount}`}
              />
            )}
          </div>
        </div>
      )}

      {/* 6-Stage Currency-Grouped Commercial Value Pipeline */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF65] font-mono">
            6-Stage Commercial Revenue Pipeline ({activeCurrency})
          </h3>
          <span className="text-[11px] text-[#9298A3]">
            Excludes superseded & withdrawn proposal versions
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="bg-[#111318]/95 border border-white/[0.08] rounded-xl p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9298A3] block">
              1. Proposed Value
            </span>
            <span className="text-base font-extrabold font-mono text-[#F5F3ED] block">
              {pipeline.formattedAdditionalProposedValue}
            </span>
            <span className="text-[10px] text-[#9298A3] block">
              Active drafts & approved orders
            </span>
          </div>

          <div className="bg-[#111318]/95 border border-[#D4AF65]/25 rounded-xl p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF65] block">
              2. Provider-Approved
            </span>
            <span className="text-base font-extrabold font-mono text-[#D4AF65] block">
              {pipeline.formattedProviderApprovedValue}
            </span>
            <span className="text-[10px] text-[#9298A3] block">
              Locked snapshots (approved & accepted)
            </span>
          </div>

          <div className="bg-[#111318]/95 border border-[#43B581]/30 rounded-xl p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#43B581] block">
              3. Client-Accepted
            </span>
            <span className="text-base font-extrabold font-mono text-[#43B581] block">
              {pipeline.formattedClientAcceptedValue}
            </span>
            <span className="text-[10px] text-[#9298A3] block">
              Contractually agreed expansion
            </span>
          </div>

          <div className="bg-[#111318]/95 border border-white/[0.08] rounded-xl p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5F3ED] block">
              4. Invoiced Value
            </span>
            <span className="text-base font-extrabold font-mono text-[#F5F3ED] block">
              {pipeline.formattedAdditionalInvoicedValue}
            </span>
            <span className="text-[10px] text-[#9298A3] block">
              Issued via PayPal Sandbox
            </span>
          </div>

          <div className="bg-[#43B581]/[0.08] border border-[#43B581]/35 rounded-xl p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#43B581] block">
              5. Cash Collected
            </span>
            <span className="text-base font-extrabold font-mono text-[#43B581] block">
              {pipeline.formattedAdditionalRevenueCollected}
            </span>
            <span className="text-[10px] text-[#9298A3] block">
              Authoritative PayPal settlement
            </span>
          </div>

          <div className="bg-[#E5B45C]/[0.08] border border-[#E5B45C]/35 rounded-xl p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#E5B45C] block">
              6. Outstanding
            </span>
            <span className="text-base font-extrabold font-mono text-[#E5B45C] block">
              {pipeline.formattedOutstandingAdditionalPayments}
            </span>
            <span className="text-[10px] text-[#9298A3] block">
              Invoiced awaiting payment
            </span>
          </div>
        </div>
      </div>

      {/* Project-Level Scope Intelligence Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5F3ED] font-mono">
            Project-Level Scope Intelligence ({projectIntelligence.length})
          </h3>
          <span className="text-[11px] text-[#9298A3]">
            Per-engagement scope drift and financial settlement breakdown
          </span>
        </div>

        {projectIntelligence.length === 0 ? (
          <div className="bg-[#090A0C]/60 border border-dashed border-white/[0.08] rounded-xl p-8 text-center text-xs text-[#9298A3]">
            No projects match the current radar filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#090A0C]/70">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] uppercase font-mono text-[#9298A3] bg-[#111318]/90">
                  <th className="py-3 px-4">Project & Baseline</th>
                  <th className="py-3 px-3">Requests Breakdown</th>
                  <th className="py-3 px-3 text-center">Unresolved</th>
                  <th className="py-3 px-3 text-center">Proposals</th>
                  <th className="py-3 px-3 text-right">Accepted Value</th>
                  <th className="py-3 px-3 text-right">Invoiced</th>
                  <th className="py-3 px-3 text-right">Collected</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {projectIntelligence.map((proj) => (
                  <tr
                    key={proj.projectId}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/projects/${proj.projectId}/baseline`}
                        className="font-bold text-[#F5F3ED] hover:text-[#D4AF65] block transition-colors"
                      >
                        {proj.projectName}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#9298A3] flex-wrap">
                        <span>{proj.clientName}</span>
                        <span>&bull;</span>
                        <span className="font-mono text-[#D4AF65]">
                          {proj.hasConfirmedBaseline
                            ? `${proj.baselineDeliverablesCount} Baseline Deliverables`
                            : "Baseline Unconfirmed"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-white/[0.05] text-[#F5F3ED] font-bold">
                          Total: {proj.totalChangeRequests}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded bg-[#43B581]/15 text-[#43B581]"
                          title="In Scope"
                        >
                          IN: {proj.classificationDistribution.inScope}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded bg-[#E06C75]/15 text-[#E06C75]"
                          title="Out of Scope"
                        >
                          OOS: {proj.classificationDistribution.outOfScope}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded bg-[#E5B45C]/15 text-[#E5B45C]"
                          title="Ambiguous"
                        >
                          AMB: {proj.classificationDistribution.ambiguous}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono">
                      {proj.unresolvedRequestsCount > 0 ? (
                        <Link
                          href={`/projects/${proj.projectId}/requests`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30 hover:bg-[#E06C75]/25"
                        >
                          {proj.unresolvedRequestsCount} Unresolved
                        </Link>
                      ) : (
                        <span className="text-[#9298A3]">0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono text-[11px]">
                      <Link
                        href={`/projects/${proj.projectId}/proposals`}
                        className="hover:underline text-[#F5F3ED]"
                      >
                        <span className="text-[#E5B45C]">{proj.pendingProposalsCount} pending</span>
                        {" / "}
                        <span className="text-[#43B581] font-bold">{proj.acceptedChangesCount} accepted</span>
                      </Link>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-[#43B581] whitespace-nowrap">
                      {proj.formattedAdditionalAcceptedValue}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-[#F5F3ED] whitespace-nowrap">
                      {proj.formattedAdditionalInvoicedValue}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-[#43B581] whitespace-nowrap">
                      {proj.formattedAdditionalCollectedValue}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#E5B45C] whitespace-nowrap">
                      {proj.formattedOutstandingPayments}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actionable Scope Drift Alerts */}
      <div className="space-y-3 pt-2 border-t border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5F3ED] font-mono">
              Scope Drift & Revenue Protection Alerts
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
              {driftAlerts.length}
            </span>
          </div>
          <span className="text-[11px] text-[#9298A3]">
            Derived from persisted scope, proposal, and PayPal invoice state
          </span>
        </div>

        {driftAlerts.length === 0 ? (
          <div className="bg-[#43B581]/[0.06] border border-[#43B581]/25 rounded-xl p-4 flex items-center gap-3 text-xs text-[#43B581]">
            <span className="font-bold">✓ No Active Scope Drift Alerts:</span>
            <span className="text-[#F5F3ED]/80">
              All out-of-scope requests have proposals, accepted proposals are invoiced, and no unresolved scope drift was detected.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {driftAlerts.slice(0, 8).map((alert) => {
              const badgeColor =
                alert.severity === "HIGH"
                  ? "bg-[#E06C75]/15 text-[#E06C75] border-[#E06C75]/30"
                  : alert.severity === "MEDIUM"
                  ? "bg-[#E5B45C]/15 text-[#E5B45C] border-[#E5B45C]/30"
                  : "bg-[#D4AF65]/15 text-[#D4AF65] border-[#D4AF65]/30";

              return (
                <div
                  key={alert.id}
                  className="bg-[#111318]/90 border border-white/[0.08] hover:border-[#D4AF65]/40 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border whitespace-nowrap ${badgeColor}`}
                      >
                        {alert.severity} &bull; {alert.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] font-mono text-[#9298A3] truncate">
                        {alert.projectName}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-[#F5F3ED]">{alert.title}</h4>
                    <p className="text-xs text-[#9298A3] leading-relaxed">{alert.description}</p>
                    <p className="text-[11px] text-[#F5F3ED]/70 italic">
                      Why it matters: {alert.rationale}
                    </p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Link
                      href={alert.href}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#D4AF65] hover:text-[#E2C17F] font-mono"
                    >
                      <span>Resolve in Workspace</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

