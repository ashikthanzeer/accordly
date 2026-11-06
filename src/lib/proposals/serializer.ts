/**
 * Public Proposal Snapshot Serializer.
 *
 * Strips all internal provider notes, database IDs, and AI prompt metadata,
 * returning only client-safe commercial proposal data for the public review portal.
 */

export interface PublicProposalSnapshot {
  projectName: string;
  clientName: string;
  clientEmail: string;
  version: number;
  title: string;
  description: string;
  reasonForChange: string;
  deliverables: Array<{
    id: string;
    name: string;
    description: string;
    acceptanceCriteria: string[];
    suggestedEffortHours?: number | null;
  }>;
  pricing: {
    model: string;
    currency: string;
    total: number;
    formattedTotal: string;
    lineItems: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      currency: string;
    }>;
  };
  assumptions: string[];
  exclusions: string[];
  dependencies: string[];
  timelineImpact: string;
  status: string;
  expiresAt: string | null;
  clientAcceptedAt: string | null;
  clientRejectedAt: string | null;
  rejectionReason: string | null;
  disclaimer: string;
}

/**
 * Transforms an internal ChangeOrder record and its related Project into a client-safe public snapshot.
 */
export function serializePublicProposal(
  proposal: any,
  project: any
): PublicProposalSnapshot {
  const deliverablesJson =
    proposal.deliverables && typeof proposal.deliverables === "object"
      ? (proposal.deliverables as Record<string, unknown>)
      : {};

  const pricingObj = (deliverablesJson.pricing as any) || {
    model: "FIXED",
    currency: proposal.currency || "USD",
    total: Number(proposal.amount) || 0,
    formattedTotal: `${proposal.currency || "USD"} ${Number(proposal.amount).toFixed(2)}`,
    lineItems: [],
  };

  const deliverablesList = Array.isArray(deliverablesJson.deliverables)
    ? deliverablesJson.deliverables.map((d: any) => ({
        id: String(d.id || ""),
        name: String(d.name || ""),
        description: String(d.description || ""),
        acceptanceCriteria: Array.isArray(d.acceptanceCriteria)
          ? d.acceptanceCriteria.map(String)
          : [],
        suggestedEffortHours:
          typeof d.suggestedEffortHours === "number" ? d.suggestedEffortHours : null,
      }))
    : [];

  const rawAssumptions = deliverablesJson.assumptions || proposal.assumptions;
  const assumptionsList = Array.isArray(rawAssumptions)
    ? rawAssumptions.map(String)
    : typeof rawAssumptions === "string"
    ? rawAssumptions.split("\n").filter(Boolean)
    : [];

  const exclusionsList = Array.isArray(deliverablesJson.exclusions)
    ? deliverablesJson.exclusions.map(String)
    : [];

  const dependenciesList = Array.isArray(deliverablesJson.dependencies)
    ? deliverablesJson.dependencies.map(String)
    : [];

  const clientDecision = (deliverablesJson.clientDecision as any) || {};

  return {
    projectName: project?.name || "Client Project",
    clientName: project?.clientName || "Valued Client",
    clientEmail: project?.clientEmail || "",
    version: proposal.version || 1,
    title: String(deliverablesJson.title || proposal.description || "Change Proposal"),
    description: String(proposal.description || deliverablesJson.description || ""),
    reasonForChange: String(deliverablesJson.reasonForChange || ""),
    deliverables: deliverablesList,
    pricing: {
      model: String(pricingObj.model || "FIXED"),
      currency: String(pricingObj.currency || proposal.currency || "USD"),
      total: Number(pricingObj.total || proposal.amount || 0),
      formattedTotal: String(
        pricingObj.formattedTotal || `${proposal.currency} ${Number(proposal.amount).toFixed(2)}`
      ),
      lineItems: Array.isArray(pricingObj.lineItems)
        ? pricingObj.lineItems.map((item: any) => ({
            id: String(item.id || ""),
            description: String(item.description || ""),
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            subtotal: Number(item.subtotal || 0),
            currency: String(item.currency || proposal.currency || "USD"),
          }))
        : [],
    },
    assumptions: assumptionsList,
    exclusions: exclusionsList,
    dependencies: dependenciesList,
    timelineImpact: String(proposal.timelineImpact || deliverablesJson.timelineImpact || ""),
    status: proposal.status,
    expiresAt: proposal.reviewTokenExpiresAt
      ? new Date(proposal.reviewTokenExpiresAt).toISOString()
      : null,
    clientAcceptedAt: proposal.clientAcceptedAt
      ? new Date(proposal.clientAcceptedAt).toISOString()
      : null,
    clientRejectedAt: proposal.clientRejectedAt
      ? new Date(proposal.clientRejectedAt).toISOString()
      : null,
    rejectionReason: clientDecision?.rejectionReason || null,
    disclaimer:
      "This document is a commercial change proposal. Acceptance authorizes the provider to execute the agreed deliverables in accordance with the specified terms.",
  };
}

