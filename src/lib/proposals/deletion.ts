/**
 * Safe Proposal Soft-Deletion & Eligibility Engine.
 *
 * Enforces strict financial and commercial invariants:
 * Proposals can ONLY be soft-deleted when:
 * 1. Proposal status is strictly 'DRAFT'.
 * 2. Proposal has never been approved (providerApprovedAt is null).
 * 3. Proposal has never been shared with a client (reviewTokenHash is null).
 * 4. Proposal has never been accepted or rejected by a client.
 * 5. Proposal has no associated PayPal invoice records.
 * 6. Proposal has no payment or financial reconciliation records.
 * 7. Proposal has no dependent proposal versions or historical branch dependencies.
 *
 * Deletion is executed as a non-destructive soft deletion (setting deletedAt and deletedBy)
 * within an atomic database transaction, recording an explicit timeline audit event.
 */

import { prisma } from "@/lib/db";
import { isProjectArchived } from "@/lib/projects/lifecycle";
import { logDiagnostic } from "@/lib/logger";

export type ProposalDeletionIneligibilityReason =
  | "NOT_DRAFT"
  | "ALREADY_APPROVED"
  | "ALREADY_SHARED"
  | "ALREADY_DECIDED"
  | "HAS_INVOICE"
  | "HAS_PAYMENT_ACTIVITY"
  | "HAS_DEPENDENT_VERSIONS"
  | "ALREADY_DELETED"
  | "PROJECT_ARCHIVED";

export interface ProposalDeletionEligibilityResult {
  canDelete: boolean;
  code?: ProposalDeletionIneligibilityReason;
  reason?: string;
}

export interface ProposalDeletionCandidate {
  id: string;
  version: number;
  status: string;
  providerApprovedAt?: Date | string | null;
  clientAcceptedAt?: Date | string | null;
  clientRejectedAt?: Date | string | null;
  reviewTokenHash?: string | null;
  deletedAt?: Date | string | null;
  invoices?: Array<{
    id: string;
    status: string;
    amount?: any;
    paidAmount?: any;
  }> | null;
  project?: {
    status?: string | null;
    name?: string | null;
  } | null;
}

/**
 * Deterministically evaluates whether a proposal satisfies all 7 conditions for safe deletion.
 */
export function assertProposalDeletable(
  proposal: ProposalDeletionCandidate,
  options?: {
    dependentVersionsCount?: number;
    isProjectArchived?: boolean;
  }
): ProposalDeletionEligibilityResult {
  // 0a. Check if already soft-deleted
  if (proposal.deletedAt !== null && proposal.deletedAt !== undefined) {
    return {
      canDelete: false,
      code: "ALREADY_DELETED",
      reason: `Proposal v${proposal.version} has already been deleted.`,
    };
  }

  // 0b. Check if project is archived
  const projectArchived =
    options?.isProjectArchived ?? isProjectArchived(proposal.project?.status);
  if (projectArchived) {
    return {
      canDelete: false,
      code: "PROJECT_ARCHIVED",
      reason: `Cannot delete proposal: Project "${proposal.project?.name || "Project"}" is ARCHIVED. Mutating operations are prohibited on archived projects.`,
    };
  }

  // Condition 1: Proposal status is strictly DRAFT
  const statusUpper = (proposal.status || "").toUpperCase();
  if (statusUpper !== "DRAFT") {
    return {
      canDelete: false,
      code: "NOT_DRAFT",
      reason: `Cannot delete proposal: Proposal v${proposal.version} is in '${proposal.status}' status. Only DRAFT proposals can be deleted.`,
    };
  }

  // Condition 2: Proposal has never been approved
  if (proposal.providerApprovedAt !== null && proposal.providerApprovedAt !== undefined) {
    return {
      canDelete: false,
      code: "ALREADY_APPROVED",
      reason: `Cannot delete proposal: Proposal v${proposal.version} was approved on ${new Date(
        proposal.providerApprovedAt
      ).toISOString()}. Approved proposals are immutable commercial records.`,
    };
  }

  // Condition 3: Proposal has never been shared with a client
  if (proposal.reviewTokenHash !== null && proposal.reviewTokenHash !== undefined && proposal.reviewTokenHash !== "") {
    return {
      canDelete: false,
      code: "ALREADY_SHARED",
      reason: `Cannot delete proposal: Proposal v${proposal.version} has already been shared with the client via a review link.`,
    };
  }

  // Condition 4: Proposal has never been accepted or rejected by a client
  if (
    (proposal.clientAcceptedAt !== null && proposal.clientAcceptedAt !== undefined) ||
    (proposal.clientRejectedAt !== null && proposal.clientRejectedAt !== undefined)
  ) {
    return {
      canDelete: false,
      code: "ALREADY_DECIDED",
      reason: `Cannot delete proposal: Proposal v${proposal.version} has recorded client decision history.`,
    };
  }

  // Condition 5 & 6: Proposal has no associated PayPal invoices or payment activity
  const invoices = Array.isArray(proposal.invoices) ? proposal.invoices : [];
  if (invoices.length > 0) {
    // Check specifically for payment activity
    const hasPayment = invoices.some((inv) => {
      const invStatus = (inv.status || "").toUpperCase();
      const paid = Number(inv.paidAmount || 0);
      return (
        invStatus === "PAID" ||
        invStatus === "PARTIALLY_PAID" ||
        invStatus === "PAYMENT_PENDING" ||
        paid > 0
      );
    });

    if (hasPayment) {
      return {
        canDelete: false,
        code: "HAS_PAYMENT_ACTIVITY",
        reason: `Cannot delete proposal: Proposal v${proposal.version} is associated with authoritative invoice payment activity.`,
      };
    }

    return {
      canDelete: false,
      code: "HAS_INVOICE",
      reason: `Cannot delete proposal: Proposal v${proposal.version} has ${invoices.length} associated PayPal invoice record(s).`,
    };
  }

  // Condition 7: Proposal has no dependent proposal versions or historical relationships
  const dependentCount = options?.dependentVersionsCount ?? 0;
  if (dependentCount > 0) {
    return {
      canDelete: false,
      code: "HAS_DEPENDENT_VERSIONS",
      reason: `Cannot delete proposal: Proposal v${proposal.version} has ${dependentCount} dependent proposal version(s). Deletion would break version history.`,
    };
  }

  return { canDelete: true };
}

/**
 * Transactionally executes a safe proposal soft-deletion.
 */
export async function softDeleteProposal(
  projectId: string,
  proposalId: string,
  userId: string,
  correlationId = `req_del_${Date.now().toString(36)}`
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch proposal with relationships for authoritative eligibility inspection
    const proposal = await tx.changeOrder.findFirst({
      where: {
        id: proposalId,
        projectId,
      },
      include: {
        project: true,
        invoices: true,
      },
    });

    if (!proposal) {
      return {
        success: false,
        statusCode: 404,
        error: `Proposal "${proposalId}" not found for project "${projectId}".`,
        code: "PROPOSAL_NOT_FOUND",
      };
    }

    // 2. Count active versions that depend on or succeed this version
    const dependentVersionsCount = await tx.changeOrder.count({
      where: {
        projectId,
        version: { gt: proposal.version },
        deletedAt: null,
      },
    });

    // 3. Inspect eligibility
    const eligibility = assertProposalDeletable(proposal, {
      dependentVersionsCount,
      isProjectArchived: isProjectArchived(proposal.project?.status),
    });

    if (!eligibility.canDelete) {
      logDiagnostic({
        level: "warn",
        operation: "proposal.delete",
        correlationId,
        projectId,
        stage: "eligibility.verify",
        category: "validation",
        message: eligibility.reason || "Proposal is not eligible for deletion.",
        statusCode: 409,
      });

      return {
        success: false,
        statusCode: 409,
        error: eligibility.reason,
        code: eligibility.code,
      };
    }

    // 4. Perform atomic soft-deletion
    const now = new Date();
    const updatedProposal = await tx.changeOrder.update({
      where: { id: proposalId },
      data: {
        deletedAt: now,
        deletedBy: userId,
      },
    });

    // 5. Emit audit/timeline event
    await tx.projectEvent.create({
      data: {
        projectId,
        eventType: "PROPOSAL_DELETED",
        actorType: "USER",
        description: `Change Proposal v${proposal.version} was soft-deleted by provider.`,
        metadata: {
          proposalId,
          version: proposal.version,
          amount: proposal.amount.toString(),
          currency: proposal.currency,
          deletedAt: now.toISOString(),
          deletedBy: userId,
          correlationId,
        },
      },
    });

    logDiagnostic({
      level: "info",
      operation: "proposal.delete",
      correlationId,
      projectId,
      stage: "db.persist",
      category: "success",
      message: `Change Proposal v${proposal.version} (${proposalId}) successfully soft-deleted.`,
      statusCode: 200,
    });

    return {
      success: true,
      statusCode: 200,
      proposal: updatedProposal,
    };
  });
}

