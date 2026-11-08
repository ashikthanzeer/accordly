/**
 * Proposal Version Comparison & Lineage Diff Engine.
 *
 * Implements deterministic side-by-side comparison across immutable approved
 * proposal snapshots and draft versions without mutating historical records.
 */

import { formatCurrency } from "@/lib/pricing/calculator";
import {
  buildApprovedSnapshot,
  type ApprovedProposalSnapshot,
  type SnapshotDeliverable,
  type SnapshotLineItem,
} from "./snapshot";

export interface ProposalVersionHistoryRow {
  id: string;
  version: number;
  title: string;
  status: string;
  createdAt: string;
  providerApprovedAt: string | null;
  clientDecision: "ACCEPTED" | "REJECTED" | "AWAITING_CLIENT" | "NOT_SENT";
  clientDecidedAt: string | null;
  currency: string;
  amount: number;
  formattedAmount: string;
  hasImmutableSnapshot: boolean;
  predecessorVersion: number | null;
  predecessorProposalId: string | null;
}

export type DiffChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";

export interface DeliverableDiffItem {
  key: string;
  changeType: DiffChangeType;
  name: string;
  before?: SnapshotDeliverable | null;
  after?: SnapshotDeliverable | null;
  changes: string[];
}

export interface LineItemDiffItem {
  key: string;
  changeType: DiffChangeType;
  description: string;
  before?: SnapshotLineItem | null;
  after?: SnapshotLineItem | null;
  changes: string[];
}

export interface ProposalVersionDiffResult {
  baseVersion: number;
  targetVersion: number;
  baseStatus: string;
  targetStatus: string;
  currency: string;
  baseAmount: number;
  targetAmount: number;
  amountDelta: number;
  formattedBaseAmount: string;
  formattedTargetAmount: string;
  formattedAmountDelta: string;
  pricingModelChanged: boolean;
  basePricingModel: string;
  targetPricingModel: string;
  timelineChanged: boolean;
  baseTimelineImpact: string;
  targetTimelineImpact: string;
  justificationChanged: boolean;
  baseJustification: string;
  targetJustification: string;
  assumptionsChanged: boolean;
  baseAssumptions: string[];
  targetAssumptions: string[];
  deliverableDiffs: DeliverableDiffItem[];
  lineItemDiffs: LineItemDiffItem[];
  summaryCounts: {
    addedDeliverables: number;
    removedDeliverables: number;
    modifiedDeliverables: number;
    unchangedDeliverables: number;
    addedLineItems: number;
    removedLineItems: number;
    modifiedLineItems: number;
  };
}

/**
 * Extracts a normalized snapshot for comparison, prioritizing the locked
 * approvedSnapshot on non-draft versions so immutable snapshots are always honored.
 */
export function extractNormalizedProposalSnapshot(proposal: any): ApprovedProposalSnapshot {
  const deliv =
    proposal?.deliverables && typeof proposal.deliverables === "object"
      ? (proposal.deliverables as Record<string, any>)
      : {};

  if (deliv.approvedSnapshot && proposal?.status !== "DRAFT") {
    return deliv.approvedSnapshot as ApprovedProposalSnapshot;
  }

  return buildApprovedSnapshot({ proposal });
}

/**
 * Builds an ordered version history table from a list of ChangeOrder records.
 */
export function buildProposalVersionHistory(proposals: any[]): ProposalVersionHistoryRow[] {
  if (!Array.isArray(proposals)) return [];

  return [...proposals]
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
    .map((prop) => {
      const deliv = (prop.deliverables as any) || {};
      const snapshot = deliv.approvedSnapshot as ApprovedProposalSnapshot | undefined;
      const status = String(prop.status || "DRAFT").toUpperCase();
      const currency = String(snapshot?.currency || prop.currency || "USD").toUpperCase();
      const amount = Number(snapshot?.amount ?? prop.amount ?? 0);

      let clientDecision: ProposalVersionHistoryRow["clientDecision"] = "NOT_SENT";
      let clientDecidedAt: string | null = null;

      if (status === "CLIENT_ACCEPTED" || prop.clientAcceptedAt) {
        clientDecision = "ACCEPTED";
        clientDecidedAt = prop.clientAcceptedAt
          ? new Date(prop.clientAcceptedAt).toISOString()
          : null;
      } else if (status === "CLIENT_REJECTED" || prop.clientRejectedAt) {
        clientDecision = "REJECTED";
        clientDecidedAt = prop.clientRejectedAt
          ? new Date(prop.clientRejectedAt).toISOString()
          : null;
      } else if (status === "SENT_TO_CLIENT" || prop.reviewTokenHash) {
        clientDecision = "AWAITING_CLIENT";
      }

      return {
        id: String(prop.id),
        version: Number(prop.version || 1),
        title: String(snapshot?.title || deliv.title || prop.description || `Proposal v${prop.version}`),
        status,
        createdAt: prop.createdAt ? new Date(prop.createdAt).toISOString() : new Date().toISOString(),
        providerApprovedAt: prop.providerApprovedAt
          ? new Date(prop.providerApprovedAt).toISOString()
          : snapshot?.approvedAt || null,
        clientDecision,
        clientDecidedAt,
        currency,
        amount,
        formattedAmount: formatCurrency(amount, currency),
        hasImmutableSnapshot: Boolean(snapshot),
        predecessorVersion:
          typeof deliv.predecessorVersion === "number" ? deliv.predecessorVersion : null,
        predecessorProposalId: deliv.predecessorProposalId ? String(deliv.predecessorProposalId) : null,
      };
    });
}

/**
 * Deterministically compares two proposal versions side-by-side.
 */
export function compareProposalVersions(
  baseProposal: any,
  targetProposal: any
): ProposalVersionDiffResult {
  const baseSnap = extractNormalizedProposalSnapshot(baseProposal);
  const targetSnap = extractNormalizedProposalSnapshot(targetProposal);

  const currency = targetSnap.currency || baseSnap.currency || "USD";
  const baseCents = Math.round(Number(baseSnap.amount || 0) * 100);
  const targetCents = Math.round(Number(targetSnap.amount || 0) * 100);
  const deltaCents = targetCents - baseCents;

  const baseAmount = baseCents / 100;
  const targetAmount = targetCents / 100;
  const amountDelta = deltaCents / 100;
  const signPrefix = amountDelta > 0 ? "+" : amountDelta < 0 ? "-" : "";
  const formattedAmountDelta = `${signPrefix}${formatCurrency(Math.abs(amountDelta), currency)}`;

  // 1. Compare Deliverables
  const deliverableDiffs: DeliverableDiffItem[] = [];
  const baseDelivs = baseSnap.deliverables || [];
  const targetDelivs = targetSnap.deliverables || [];

  const matchedTargetIndices = new Set<number>();

  for (const bItem of baseDelivs) {
    const bNameNorm = (bItem.name || "").trim().toLowerCase();
    const targetIdx = targetDelivs.findIndex(
      (tItem, idx) =>
        !matchedTargetIndices.has(idx) &&
        ((bItem.id && tItem.id && bItem.id === tItem.id) ||
          (bNameNorm && (tItem.name || "").trim().toLowerCase() === bNameNorm))
    );

    if (targetIdx === -1) {
      deliverableDiffs.push({
        key: `deliv_rem_${bItem.id || bItem.name}`,
        changeType: "REMOVED",
        name: bItem.name,
        before: bItem,
        after: null,
        changes: ["Deliverable removed in newer version"],
      });
    } else {
      matchedTargetIndices.add(targetIdx);
      const tItem = targetDelivs[targetIdx];
      const changes: string[] = [];

      if ((bItem.name || "").trim() !== (tItem.name || "").trim()) {
        changes.push(`Name changed from "${bItem.name}" to "${tItem.name}"`);
      }
      if ((bItem.description || "").trim() !== (tItem.description || "").trim()) {
        changes.push("Deliverable description updated");
      }
      if ((bItem.suggestedEffortHours ?? null) !== (tItem.suggestedEffortHours ?? null)) {
        changes.push(
          `Estimated effort changed from ${bItem.suggestedEffortHours ?? 0}h to ${tItem.suggestedEffortHours ?? 0}h`
        );
      }

      deliverableDiffs.push({
        key: `deliv_match_${tItem.id || tItem.name}`,
        changeType: changes.length > 0 ? "MODIFIED" : "UNCHANGED",
        name: tItem.name || bItem.name,
        before: bItem,
        after: tItem,
        changes,
      });
    }
  }

  targetDelivs.forEach((tItem, idx) => {
    if (!matchedTargetIndices.has(idx)) {
      deliverableDiffs.push({
        key: `deliv_add_${tItem.id || tItem.name}_${idx}`,
        changeType: "ADDED",
        name: tItem.name,
        before: null,
        after: tItem,
        changes: ["New deliverable added"],
      });
    }
  });

  // 2. Compare Pricing Line Items
  const lineItemDiffs: LineItemDiffItem[] = [];
  const baseLines = baseSnap.pricing?.lineItems || [];
  const targetLines = targetSnap.pricing?.lineItems || [];
  const matchedLineIndices = new Set<number>();

  for (const bLine of baseLines) {
    const bDescNorm = (bLine.description || "").trim().toLowerCase();
    const targetIdx = targetLines.findIndex(
      (tLine, idx) =>
        !matchedLineIndices.has(idx) &&
        ((bLine.id && tLine.id && bLine.id === tLine.id) ||
          (bDescNorm && (tLine.description || "").trim().toLowerCase() === bDescNorm))
    );

    if (targetIdx === -1) {
      lineItemDiffs.push({
        key: `line_rem_${bLine.id || bLine.description}`,
        changeType: "REMOVED",
        description: bLine.description,
        before: bLine,
        after: null,
        changes: ["Line item removed"],
      });
    } else {
      matchedLineIndices.add(targetIdx);
      const tLine = targetLines[targetIdx];
      const changes: string[] = [];

      if (Number(bLine.quantity) !== Number(tLine.quantity)) {
        changes.push(`Quantity/Hours: ${bLine.quantity} → ${tLine.quantity}`);
      }
      if (Number(bLine.unitPrice) !== Number(tLine.unitPrice)) {
        changes.push(
          `Rate: ${formatCurrency(bLine.unitPrice, currency)} → ${formatCurrency(tLine.unitPrice, currency)}`
        );
      }
      if (Number(bLine.subtotal) !== Number(tLine.subtotal)) {
        changes.push(
          `Subtotal: ${formatCurrency(bLine.subtotal, currency)} → ${formatCurrency(tLine.subtotal, currency)}`
        );
      }

      lineItemDiffs.push({
        key: `line_match_${tLine.id || tLine.description}`,
        changeType: changes.length > 0 ? "MODIFIED" : "UNCHANGED",
        description: tLine.description || bLine.description,
        before: bLine,
        after: tLine,
        changes,
      });
    }
  }

  targetLines.forEach((tLine, idx) => {
    if (!matchedLineIndices.has(idx)) {
      lineItemDiffs.push({
        key: `line_add_${tLine.id || tLine.description}_${idx}`,
        changeType: "ADDED",
        description: tLine.description,
        before: null,
        after: tLine,
        changes: ["New billable line item added"],
      });
    }
  });

  const baseJustification =
    baseSnap.commercialJustification || baseSnap.reasonForChange || "";
  const targetJustification =
    targetSnap.commercialJustification || targetSnap.reasonForChange || "";

  const baseAssumptions = baseSnap.assumptions || [];
  const targetAssumptions = targetSnap.assumptions || [];

  return {
    baseVersion: baseSnap.version,
    targetVersion: targetSnap.version,
    baseStatus: String(baseProposal?.status || "DRAFT").toUpperCase(),
    targetStatus: String(targetProposal?.status || "DRAFT").toUpperCase(),
    currency,
    baseAmount,
    targetAmount,
    amountDelta,
    formattedBaseAmount: formatCurrency(baseAmount, currency),
    formattedTargetAmount: formatCurrency(targetAmount, currency),
    formattedAmountDelta,
    pricingModelChanged: baseSnap.pricingModel !== targetSnap.pricingModel,
    basePricingModel: baseSnap.pricingModel,
    targetPricingModel: targetSnap.pricingModel,
    timelineChanged:
      (baseSnap.timelineImpact || "").trim() !== (targetSnap.timelineImpact || "").trim(),
    baseTimelineImpact: baseSnap.timelineImpact || "None specified",
    targetTimelineImpact: targetSnap.timelineImpact || "None specified",
    justificationChanged: baseJustification.trim() !== targetJustification.trim(),
    baseJustification: baseJustification || "None specified",
    targetJustification: targetJustification || "None specified",
    assumptionsChanged:
      JSON.stringify(baseAssumptions) !== JSON.stringify(targetAssumptions),
    baseAssumptions,
    targetAssumptions,
    deliverableDiffs,
    lineItemDiffs,
    summaryCounts: {
      addedDeliverables: deliverableDiffs.filter((d) => d.changeType === "ADDED").length,
      removedDeliverables: deliverableDiffs.filter((d) => d.changeType === "REMOVED").length,
      modifiedDeliverables: deliverableDiffs.filter((d) => d.changeType === "MODIFIED").length,
      unchangedDeliverables: deliverableDiffs.filter((d) => d.changeType === "UNCHANGED").length,
      addedLineItems: lineItemDiffs.filter((l) => l.changeType === "ADDED").length,
      removedLineItems: lineItemDiffs.filter((l) => l.changeType === "REMOVED").length,
      modifiedLineItems: lineItemDiffs.filter((l) => l.changeType === "MODIFIED").length,
    },
  };
}

