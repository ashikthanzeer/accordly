/**
 * Canonical Approved Proposal Snapshot & Cryptographic Integrity Engine.
 *
 * Implements deterministic JSON canonicalization, SHA-256 hash calculation,
 * and tamper detection for commercial proposals in Accordly.
 */

import crypto from "crypto";

export interface SnapshotLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  currency: string;
}

export interface SnapshotDeliverable {
  id: string;
  name: string;
  description: string;
  acceptanceCriteria: string[];
  suggestedEffortHours?: number | null;
}

export interface ApprovedProposalSnapshot {
  version: number;
  title: string;
  description: string;
  reasonForChange: string;
  amount: string; // e.g. "1500.00"
  currency: string; // e.g. "USD"
  pricingModel: string; // "FIXED" | "HOURLY" | "ITEMIZED"
  pricing: {
    model: string;
    currency: string;
    total: number;
    formattedTotal: string;
    lineItems: SnapshotLineItem[];
  };
  deliverables: SnapshotDeliverable[];
  assumptions: string[];
  exclusions: string[];
  dependencies: string[];
  timelineImpact: string;
  commercialJustification: string | null;
  disclaimer: string;
  approvedAt: string; // ISO 8601
  approvedBy: string;
}

export interface SnapshotVerificationResult {
  isValid: boolean;
  error?: string;
  snapshot?: ApprovedProposalSnapshot;
  computedHash?: string;
  expectedHash?: string;
  isLegacyUnsigned?: boolean;
}

/**
 * Deterministically serializes any JS data structure into canonical JSON with sorted object keys.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);

  return `{${pairs.join(",")}}`;
}

/**
 * Computes the SHA-256 hex digest of an approved proposal snapshot.
 */
export function computeSnapshotHash(snapshot: ApprovedProposalSnapshot): string {
  const canonical = canonicalizeJson(snapshot);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Constructs a complete, normalized ApprovedProposalSnapshot from proposal content and project metadata.
 */
export function buildApprovedSnapshot(params: {
  proposal: any;
  project?: any;
  approverName?: string;
  approvedAt?: Date;
}): ApprovedProposalSnapshot {
  const { proposal, approverName = "Project Provider", approvedAt = new Date() } = params;

  const deliverablesObj =
    proposal.deliverables && typeof proposal.deliverables === "object"
      ? (proposal.deliverables as Record<string, unknown>)
      : {};

  const pricingObj = (deliverablesObj.pricing as any) || {
    model: "FIXED",
    currency: proposal.currency || "USD",
    total: Number(proposal.amount) || 0,
    formattedTotal: `${proposal.currency || "USD"} ${Number(proposal.amount).toFixed(2)}`,
    lineItems: [],
  };

  const rawDeliverables = Array.isArray(deliverablesObj.deliverables)
    ? deliverablesObj.deliverables
    : [];

  const deliverablesList: SnapshotDeliverable[] = rawDeliverables.map((d: any) => ({
    id: String(d.id || ""),
    name: String(d.name || ""),
    description: String(d.description || ""),
    acceptanceCriteria: Array.isArray(d.acceptanceCriteria)
      ? d.acceptanceCriteria.map(String)
      : [],
    suggestedEffortHours:
      typeof d.suggestedEffortHours === "number" ? d.suggestedEffortHours : null,
  }));

  const rawAssumptions = deliverablesObj.assumptions || proposal.assumptions;
  const assumptionsList = Array.isArray(rawAssumptions)
    ? rawAssumptions.map(String)
    : typeof rawAssumptions === "string"
      ? rawAssumptions.split("\n").filter(Boolean)
      : [];

  const exclusionsList = Array.isArray(deliverablesObj.exclusions)
    ? deliverablesObj.exclusions.map(String)
    : [];

  const dependenciesList = Array.isArray(deliverablesObj.dependencies)
    ? deliverablesObj.dependencies.map(String)
    : [];

  const lineItemsList: SnapshotLineItem[] = Array.isArray(pricingObj.lineItems)
    ? pricingObj.lineItems.map((item: any) => ({
        id: item.id ? String(item.id) : undefined,
        description: String(item.description || ""),
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        subtotal: Number(item.subtotal || 0),
        currency: String(item.currency || proposal.currency || "USD").toUpperCase(),
      }))
    : [];

  const amountNumber = Number(proposal.amount) || Number(pricingObj.total) || 0;
  const currencyString = String(proposal.currency || pricingObj.currency || "USD").toUpperCase();

  return {
    version: Number(proposal.version) || 1,
    title: String(deliverablesObj.title || proposal.description || "Change Proposal"),
    description: String(proposal.description || deliverablesObj.description || ""),
    reasonForChange: String(deliverablesObj.reasonForChange || ""),
    amount: amountNumber.toFixed(2),
    currency: currencyString,
    pricingModel: String(pricingObj.model || "FIXED").toUpperCase(),
    pricing: {
      model: String(pricingObj.model || "FIXED").toUpperCase(),
      currency: currencyString,
      total: amountNumber,
      formattedTotal: String(
        pricingObj.formattedTotal || `${currencyString} ${amountNumber.toFixed(2)}`
      ),
      lineItems: lineItemsList,
    },
    deliverables: deliverablesList,
    assumptions: assumptionsList,
    exclusions: exclusionsList,
    dependencies: dependenciesList,
    timelineImpact: String(proposal.timelineImpact || deliverablesObj.timelineImpact || ""),
    commercialJustification: deliverablesObj.commercialJustification
      ? String(deliverablesObj.commercialJustification)
      : null,
    disclaimer: String(
      deliverablesObj.disclaimer ||
        "This document is a commercial change proposal. Acceptance authorizes the provider to execute the agreed deliverables in accordance with the specified terms."
    ),
    approvedAt: approvedAt.toISOString(),
    approvedBy: approverName.trim() || "Project Provider",
  };
}

/**
 * Validates the cryptographic integrity of an approved proposal.
 * Verifies that the snapshot exists, recomputes the SHA-256 digest,
 * compares against approvedSnapshotHash, and checks currency and amount consistency.
 */
export function verifySnapshotIntegrity(
  proposal: any,
  options?: { strict?: boolean }
): SnapshotVerificationResult {
  if (!proposal) {
    return { isValid: false, error: "Proposal record is required for verification." };
  }

  const deliverablesObj =
    proposal.deliverables && typeof proposal.deliverables === "object"
      ? (proposal.deliverables as Record<string, unknown>)
      : {};

  const snapshot = deliverablesObj.approvedSnapshot as ApprovedProposalSnapshot | undefined;
  const expectedHash = deliverablesObj.approvedSnapshotHash as string | undefined;

  if (!snapshot) {
    // If proposal is in draft status, it has no snapshot yet
    if (proposal.status === "DRAFT") {
      return { isValid: true };
    }
    return {
      isValid: false,
      error: `Proposal v${proposal.version} is in status '${proposal.status}' but lacks an approved commercial snapshot.`,
    };
  }

  // If hash is missing on a legacy snapshot, allow unless strict mode is enabled
  if (!expectedHash) {
    if (options?.strict) {
      return {
        isValid: false,
        error: `Proposal v${proposal.version} lacks a cryptographic snapshot hash.`,
        snapshot,
        isLegacyUnsigned: true,
      };
    }
    return {
      isValid: true,
      snapshot,
      isLegacyUnsigned: true,
    };
  }

  const computedHash = computeSnapshotHash(snapshot);
  if (computedHash !== expectedHash) {
    return {
      isValid: false,
      error: `Proposal snapshot integrity verification failed: computed hash does not match locked digest.`,
      snapshot,
      computedHash,
      expectedHash,
    };
  }

  // Cross-check root currency and amount
  const rootAmount = Number(proposal.amount);
  const snapshotAmount = Number(snapshot.amount);
  if (Math.abs(rootAmount - snapshotAmount) > 0.001) {
    return {
      isValid: false,
      error: `Proposal root amount (${rootAmount}) does not match approved snapshot amount (${snapshotAmount}).`,
      snapshot,
      computedHash,
      expectedHash,
    };
  }

  const rootCurrency = String(proposal.currency || "").toUpperCase();
  const snapshotCurrency = String(snapshot.currency || "").toUpperCase();
  if (rootCurrency && snapshotCurrency && rootCurrency !== snapshotCurrency) {
    return {
      isValid: false,
      error: `Proposal root currency (${rootCurrency}) does not match approved snapshot currency (${snapshotCurrency}).`,
      snapshot,
      computedHash,
      expectedHash,
    };
  }

  return {
    isValid: true,
    snapshot,
    computedHash,
    expectedHash,
  };
}

