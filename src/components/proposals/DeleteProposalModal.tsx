"use client";

import React, { useState } from "react";

interface DeleteProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  projectId: string;
  proposal: {
    id: string;
    version: number;
    status: string;
    amount?: any;
    currency?: string;
    providerApprovedAt?: any;
    reviewTokenHash?: any;
    clientAcceptedAt?: any;
    clientRejectedAt?: any;
    invoices?: any[];
  } | null;
}

export function DeleteProposalModal({
  isOpen,
  onClose,
  onDeleted,
  projectId,
  proposal,
}: DeleteProposalModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !proposal) return null;

  // Determine eligibility client-side for immediate feedback
  const isDraft = (proposal.status || "").toUpperCase() === "DRAFT";
  const isApproved = Boolean(proposal.providerApprovedAt || proposal.status === "APPROVED");
  const isShared = Boolean(proposal.reviewTokenHash);
  const hasDecision = Boolean(proposal.clientAcceptedAt || proposal.clientRejectedAt);
  const hasInvoices = Array.isArray(proposal.invoices) && proposal.invoices.length > 0;

  const isEligible = isDraft && !isApproved && !isShared && !hasDecision && !hasInvoices;

  let ineligibilityExplanation = "";
  if (!isDraft) {
    ineligibilityExplanation = `This proposal is in '${proposal.status}' status. Only DRAFT proposals can be deleted.`;
  } else if (isApproved) {
    ineligibilityExplanation = "This proposal has been approved and is locked as an immutable commercial record.";
  } else if (isShared) {
    ineligibilityExplanation = "This proposal has been shared with the client via a review link.";
  } else if (hasDecision) {
    ineligibilityExplanation = "This proposal has client acceptance or rejection records.";
  } else if (hasInvoices) {
    ineligibilityExplanation = "This proposal has associated PayPal invoice or billing records.";
  }

  const handleDelete = async () => {
    if (!isEligible || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/proposals/${proposal.id}/delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete proposal draft.");
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while deleting the proposal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-neutral-900/95 p-6 shadow-2xl backdrop-blur-xl text-neutral-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-100">
              {isEligible ? `Delete Proposal Draft v${proposal.version}?` : "Proposal Protected From Deletion"}
            </h3>
            <p className="text-xs text-neutral-400">
              Proposal ID: {proposal.id}
            </p>
          </div>
        </div>

        {isEligible ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">Change Proposal v{proposal.version}</strong>?
            </p>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3.5 text-xs text-neutral-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Audit Trail Notice</span>
              </div>
              <p>
                This draft will be removed from your active workspace. An immutable deletion record will be preserved in your project timeline.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-2">
            <div className="font-semibold flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Deletion Prohibited by Commercial Policy</span>
            </div>
            <p>{ineligibilityExplanation}</p>
            <p className="text-neutral-400 text-[11px] pt-1 border-t border-amber-500/20">
              Proposals with commercial commitments, client shares, approvals, or financial invoices cannot be deleted to preserve authoritative legal and payment history.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {isEligible ? "Cancel" : "Close"}
          </button>
          {isEligible && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-600/20 hover:bg-red-500 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Draft</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

