"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  buildProposalVersionHistory,
  compareProposalVersions,
  type DiffChangeType,
} from "@/lib/proposals/diff";
import { formatCurrency } from "@/lib/pricing/calculator";

interface ProposalVersionComparisonProps {
  projectId: string;
  proposals: any[];
  currentProposalId?: string;
}

export function ProposalVersionComparison({
  projectId,
  proposals,
  currentProposalId,
}: ProposalVersionComparisonProps) {
  const historyRows = useMemo(
    () => buildProposalVersionHistory(proposals),
    [proposals]
  );

  // Sort ascending by version for selectors
  const sortedAscending = useMemo(
    () => [...proposals].sort((a, b) => Number(a.version || 0) - Number(b.version || 0)),
    [proposals]
  );

  const defaultTargetId =
    currentProposalId ||
    sortedAscending[sortedAscending.length - 1]?.id ||
    "";
  const defaultBaseId =
    sortedAscending.find(
      (p) =>
        p.id !== defaultTargetId &&
        Number(p.version) ===
          Number(
            sortedAscending.find((t) => t.id === defaultTargetId)?.version || 2
          ) -
            1
    )?.id ||
    sortedAscending[0]?.id ||
    "";

  const [baseId, setBaseId] = useState<string>(defaultBaseId);
  const [targetId, setTargetId] = useState<string>(defaultTargetId);

  const baseProposal =
    sortedAscending.find((p) => p.id === baseId) || sortedAscending[0];
  const targetProposal =
    sortedAscending.find((p) => p.id === targetId) ||
    sortedAscending[sortedAscending.length - 1];

  const diffResult = useMemo(() => {
    if (!baseProposal || !targetProposal || proposals.length < 2) return null;
    return compareProposalVersions(baseProposal, targetProposal);
  }, [baseProposal, targetProposal, proposals.length]);

  const getDiffBadgeStyle = (changeType: DiffChangeType) => {
    switch (changeType) {
      case "ADDED":
        return "bg-[#43B581]/15 text-[#43B581] border-[#43B581]/30";
      case "REMOVED":
        return "bg-[#E06C75]/15 text-[#E06C75] border-[#E06C75]/30";
      case "MODIFIED":
        return "bg-[#E5B45C]/15 text-[#E5B45C] border-[#E5B45C]/30";
      case "UNCHANGED":
      default:
        return "bg-white/[0.05] text-[#9298A3] border-white/[0.1]";
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "CLIENT_ACCEPTED":
      case "APPROVED":
      case "PROVIDER_APPROVED":
        return "bg-[#43B581]/15 text-[#43B581] border-[#43B581]/30";
      case "SENT_TO_CLIENT":
        return "bg-[#D4AF65]/15 text-[#D4AF65] border-[#D4AF65]/30";
      case "CLIENT_REJECTED":
      case "WITHDRAWN":
        return "bg-[#E06C75]/15 text-[#E06C75] border-[#E06C75]/30";
      case "SUPERSEDED":
        return "bg-[#111318] text-[#9298A3] border-[#292D35]";
      case "DRAFT":
      default:
        return "bg-[#E5B45C]/15 text-[#E5B45C] border-[#E5B45C]/30";
    }
  };

  if (historyRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* A. Version History Table */}
      <GlassCard variant="surface" intensity="prominent" className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
                IMMUTABLE VERSION LINEAGE
              </span>
              <span className="text-xs font-mono text-[#9298A3]">
                {historyRows.length} version{historyRows.length === 1 ? "" : "s"} recorded
              </span>
            </div>
            <h3 className="text-base font-bold text-[#F5F3ED] mt-1">
              Proposal Version History & Snapshot Audit
            </h3>
            <p className="text-xs text-[#9298A3]">
              Approved versions are cryptographically locked. Subsequent modifications create a new version while preserving historical snapshots.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#090A0C]/70">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-[10px] uppercase font-mono text-[#9298A3] bg-[#111318]/90">
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Created</th>
                <th className="py-3 px-3">Provider Approved</th>
                <th className="py-3 px-3">Client Decision</th>
                <th className="py-3 px-3 text-right">Commercial Value</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {historyRows.map((row) => {
                const isCurrent = row.id === currentProposalId;
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isCurrent ? "bg-[#D4AF65]/[0.07]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#D4AF65]">
                          v{row.version}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D4AF65]/20 text-[#D4AF65] font-bold">
                            Viewing
                          </span>
                        )}
                        {row.hasImmutableSnapshot && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30"
                            title="Protected by immutable SHA-256 commercial snapshot"
                          >
                            Locked Snapshot
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#9298A3] block truncate max-w-[220px]">
                        {row.title}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border whitespace-nowrap ${getStatusBadgeStyle(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-[#9298A3] whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                      {row.providerApprovedAt ? (
                        <span className="text-[#43B581]">
                          {new Date(row.providerApprovedAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-[#9298A3]">Not approved</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                      {row.clientDecision === "ACCEPTED" ? (
                        <span className="text-[#43B581] font-bold">
                          ✓ Accepted{" "}
                          {row.clientDecidedAt
                            ? `(${new Date(row.clientDecidedAt).toLocaleDateString()})`
                            : ""}
                        </span>
                      ) : row.clientDecision === "REJECTED" ? (
                        <span className="text-[#E06C75] font-bold">
                          ✕ Rejected{" "}
                          {row.clientDecidedAt
                            ? `(${new Date(row.clientDecidedAt).toLocaleDateString()})`
                            : ""}
                        </span>
                      ) : row.clientDecision === "AWAITING_CLIENT" ? (
                        <span className="text-[#D4AF65]">Awaiting Decision</span>
                      ) : (
                        <span className="text-[#9298A3]">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-extrabold text-[#F5F3ED] whitespace-nowrap">
                      {row.formattedAmount}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/projects/${projectId}/proposals/${row.id}`}
                        className="text-xs font-bold font-mono text-[#D4AF65] hover:text-[#E2C17F] hover:underline"
                      >
                        {isCurrent ? "Current" : `Open v${row.version} →`}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* B. Side-by-Side Proposal Version Comparison (when 2+ versions exist) */}
      {proposals.length >= 2 && diffResult && (
        <GlassCard
          variant="surface"
          intensity="prominent"
          className="p-6 space-y-6 border-[#D4AF65]/30"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
                  SIDE-BY-SIDE VERSION COMPARISON
                </span>
              </div>
              <h3 className="text-base font-bold text-[#F5F3ED] mt-1">
                Compare Commercial Terms Across Versions (v{diffResult.baseVersion} vs v{diffResult.targetVersion})
              </h3>
              <p className="text-xs text-[#9298A3]">
                Highlights added, removed, and modified deliverables, rates, quantities, timeline impacts, and total price delta.
              </p>
            </div>

            {/* Version Selectors */}
            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[#9298A3]">Base:</span>
                <select
                  aria-label="Select Base Proposal Version"
                  value={baseProposal?.id || ""}
                  onChange={(e) => setBaseId(e.target.value)}
                  className="bg-[#111318] border border-white/[0.12] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65]"
                >
                  {sortedAscending.map((p) => (
                    <option key={p.id} value={p.id}>
                      v{p.version} ({p.status}) — {formatCurrency(Number(p.amount), p.currency)}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[#D4AF65] font-bold">→</span>

              <div className="flex items-center gap-1.5">
                <span className="text-[#9298A3]">Target:</span>
                <select
                  aria-label="Select Target Proposal Version"
                  value={targetProposal?.id || ""}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="bg-[#111318] border border-white/[0.12] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65]"
                >
                  {sortedAscending.map((p) => (
                    <option key={p.id} value={p.id}>
                      v{p.version} ({p.status}) — {formatCurrency(Number(p.amount), p.currency)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Commercial Value & Terms Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#090A0C]/80 border border-white/[0.08] rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[#9298A3] block">
                Base (v{diffResult.baseVersion} &bull; {diffResult.baseStatus})
              </span>
              <span className="text-lg font-mono font-extrabold text-[#F5F3ED] block">
                {diffResult.formattedBaseAmount}
              </span>
              <span className="text-[10px] font-mono text-[#9298A3] block">
                Model: {diffResult.basePricingModel}
              </span>
            </div>

            <div className="bg-[#090A0C]/80 border border-white/[0.08] rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[#D4AF65] block">
                Target (v{diffResult.targetVersion} &bull; {diffResult.targetStatus})
              </span>
              <span className="text-lg font-mono font-extrabold text-[#D4AF65] block">
                {diffResult.formattedTargetAmount}
              </span>
              <span className="text-[10px] font-mono text-[#9298A3] block">
                Model: {diffResult.targetPricingModel}
              </span>
            </div>

            <div className="bg-[#111318]/90 border border-white/[0.1] rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[#9298A3] block">
                Net Price Difference (Δ)
              </span>
              <span
                className={`text-lg font-mono font-extrabold block ${
                  diffResult.amountDelta > 0
                    ? "text-[#43B581]"
                    : diffResult.amountDelta < 0
                    ? "text-[#E06C75]"
                    : "text-[#F5F3ED]"
                }`}
              >
                {diffResult.formattedAmountDelta}
              </span>
              <span className="text-[10px] font-mono text-[#9298A3] block">
                {diffResult.pricingModelChanged
                  ? `Model changed: ${diffResult.basePricingModel} → ${diffResult.targetPricingModel}`
                  : `Currency: ${diffResult.currency}`}
              </span>
            </div>

            <div className="bg-[#111318]/90 border border-white/[0.1] rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[#9298A3] block">
                Deliverable Changes
              </span>
              <div className="flex items-center gap-2 font-mono text-xs font-bold pt-1 flex-wrap">
                <span className="text-[#43B581]">
                  +{diffResult.summaryCounts.addedDeliverables} Added
                </span>
                <span className="text-[#E06C75]">
                  -{diffResult.summaryCounts.removedDeliverables} Removed
                </span>
                <span className="text-[#E5B45C]">
                  ~{diffResult.summaryCounts.modifiedDeliverables} Modified
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#9298A3] block">
                {diffResult.summaryCounts.unchangedDeliverables} unchanged
              </span>
            </div>
          </div>

          {/* Deliverables Diff List */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F5F3ED] font-mono">
              Deliverables Comparison ({diffResult.deliverableDiffs.length})
            </h4>
            <div className="space-y-2">
              {diffResult.deliverableDiffs.map((item) => (
                <div
                  key={item.key}
                  className="bg-[#090A0C]/80 border border-white/[0.08] rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${getDiffBadgeStyle(
                          item.changeType
                        )}`}
                      >
                        {item.changeType}
                      </span>
                      <span className="text-xs font-bold text-[#F5F3ED]">
                        {item.name}
                      </span>
                    </div>
                    {item.changes.length > 0 && (
                      <span className="text-[11px] font-mono text-[#D4AF65]">
                        {item.changes.join(" • ")}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#111318]/80 border border-white/[0.06] rounded-lg p-2.5">
                      <span className="text-[10px] font-mono uppercase text-[#9298A3] block mb-1">
                        v{diffResult.baseVersion} (Before)
                      </span>
                      {item.before ? (
                        <div className="space-y-1">
                          <p className="text-[#F5F3ED]/85">{item.before.description}</p>
                          {item.before.suggestedEffortHours != null && (
                            <span className="text-[10px] font-mono text-[#9298A3] block">
                              Effort: {item.before.suggestedEffortHours}h
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#9298A3] italic">Not present in v{diffResult.baseVersion}</span>
                      )}
                    </div>

                    <div className="bg-[#111318]/80 border border-white/[0.06] rounded-lg p-2.5">
                      <span className="text-[10px] font-mono uppercase text-[#D4AF65] block mb-1">
                        v{diffResult.targetVersion} (After)
                      </span>
                      {item.after ? (
                        <div className="space-y-1">
                          <p className="text-[#F5F3ED]">{item.after.description}</p>
                          {item.after.suggestedEffortHours != null && (
                            <span className="text-[10px] font-mono text-[#D4AF65] block">
                              Effort: {item.after.suggestedEffortHours}h
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#E06C75] italic">Removed in v{diffResult.targetVersion}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Line Items Pricing Diff */}
          {diffResult.lineItemDiffs.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#F5F3ED] font-mono">
                Quantities, Rates & Line Items Comparison ({diffResult.lineItemDiffs.length})
              </h4>
              <div className="space-y-2">
                {diffResult.lineItemDiffs.map((line) => (
                  <div
                    key={line.key}
                    className="bg-[#090A0C]/80 border border-white/[0.08] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${getDiffBadgeStyle(
                          line.changeType
                        )}`}
                      >
                        {line.changeType}
                      </span>
                      <span className="font-semibold text-[#F5F3ED]">
                        {line.description}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 font-mono text-[11px]">
                      {line.before && (
                        <span className="text-[#9298A3]">
                          v{diffResult.baseVersion}: {line.before.quantity} ×{" "}
                          {formatCurrency(line.before.unitPrice, diffResult.currency)} ={" "}
                          {formatCurrency(line.before.subtotal, diffResult.currency)}
                        </span>
                      )}
                      {line.before && line.after && <span className="text-[#D4AF65]">→</span>}
                      {line.after && (
                        <span className="text-[#F5F3ED] font-bold">
                          v{diffResult.targetVersion}: {line.after.quantity} ×{" "}
                          {formatCurrency(line.after.unitPrice, diffResult.currency)} ={" "}
                          {formatCurrency(line.after.subtotal, diffResult.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline, Commercial Justification & Payment Assumptions Diff */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/[0.08] text-xs">
            <div className="bg-[#090A0C]/75 border border-white/[0.08] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#9298A3]">
                  Delivery Timeline & Deadlines
                </span>
                {diffResult.timelineChanged && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E5B45C]/15 text-[#E5B45C] font-bold">
                    MODIFIED
                  </span>
                )}
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="text-[#9298A3]">
                  v{diffResult.baseVersion}: {diffResult.baseTimelineImpact}
                </div>
                <div className="text-[#F5F3ED] font-semibold">
                  v{diffResult.targetVersion}: {diffResult.targetTimelineImpact}
                </div>
              </div>
            </div>

            <div className="bg-[#090A0C]/75 border border-white/[0.08] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#9298A3]">
                  Commercial Justification & Terms
                </span>
                {(diffResult.justificationChanged || diffResult.assumptionsChanged) && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E5B45C]/15 text-[#E5B45C] font-bold">
                    MODIFIED
                  </span>
                )}
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="text-[#9298A3] line-clamp-2">
                  <span className="font-mono">v{diffResult.baseVersion}:</span> {diffResult.baseJustification}
                </div>
                <div className="text-[#F5F3ED] font-semibold line-clamp-2">
                  <span className="font-mono text-[#D4AF65]">v{diffResult.targetVersion}:</span> {diffResult.targetJustification}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

