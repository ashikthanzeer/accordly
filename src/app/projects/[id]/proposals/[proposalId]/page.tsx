"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProposalContentEditor } from "@/components/proposals/ProposalContentEditor";
import { PricingEditor } from "@/components/proposals/PricingEditor";
import { ClientShareModal } from "@/components/proposals/ClientShareModal";
import { InvoiceReviewModal } from "@/components/invoicing/InvoiceReviewModal";
import { PayPalInvoiceCard } from "@/components/invoicing/PayPalInvoiceCard";
import type { ProposalPricingInput } from "@/lib/pricing/schema";
import type { ProposalSuggestedDeliverable } from "@/lib/ai/proposal-drafter";
import { formatCurrency } from "@/lib/pricing/calculator";

interface PageProps {
  params: Promise<{ id: string; proposalId: string }>;
}

export default function ProposalWorkspacePage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { id: projectId, proposalId } = resolvedParams;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Proposal state
  const [proposal, setProposal] = useState<any | null>(null);
  const [isEditingApproved, setIsEditingApproved] = useState(false);

  // Content state
  const [content, setContent] = useState<{
    title: string;
    description: string;
    reasonForChange: string;
    deliverables: ProposalSuggestedDeliverable[];
    assumptions: string[];
    exclusions: string[];
    dependencies: string[];
    timelineImpact: string;
  }>({
    title: "",
    description: "",
    reasonForChange: "",
    deliverables: [],
    assumptions: [],
    exclusions: [],
    dependencies: [],
    timelineImpact: "",
  });

  // Pricing state
  const [pricingConfig, setPricingConfig] = useState<ProposalPricingInput>({
    model: "FIXED",
    currency: "USD",
    fixedAmount: 0,
    lineItems: [],
  });

  useEffect(() => {
    async function loadProposal() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/proposals/${proposalId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load proposal.");

        const prop = data.proposal;
        setProposal(prop);

        const deliv = (prop.deliverables as any) || {};
        setContent({
          title: deliv.title || prop.description || "Change Proposal",
          description: prop.description || "",
          reasonForChange: deliv.reasonForChange || "",
          deliverables: deliv.deliverables || [],
          assumptions: deliv.assumptions || (prop.assumptions ? prop.assumptions.split("\n") : []),
          exclusions: deliv.exclusions || [],
          dependencies: deliv.dependencies || [],
          timelineImpact: prop.timelineImpact || deliv.timelineImpact || "",
        });

        const initialPricing = deliv.pricingConfig || {
          model: deliv.pricing?.model || "FIXED",
          currency: prop.currency || "USD",
          fixedAmount: Number(prop.amount),
          lineItems: deliv.pricing?.lineItems || [],
        };
        setPricingConfig(initialPricing);

        // Check for active PayPal invoice
        try {
          const invRes = await fetch(`/api/projects/${projectId}/proposals/${proposalId}/invoice`);
          if (invRes.ok) {
            const invData = await invRes.json();
            if (invData.invoice) {
              setActiveInvoice(invData.invoice);
            }
          }
        } catch {
          // Non-blocking invoice fetch
        }
      } catch (err: unknown) {
        setFeedbackMsg({
          type: "error",
          text: err instanceof Error ? err.message : "Error loading proposal",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadProposal();
  }, [projectId, proposalId]);

  const isApproved = proposal?.status === "APPROVED" || proposal?.status === "PROVIDER_APPROVED";
  const isSuperseded = proposal?.status === "SUPERSEDED";
  const isWithdrawn = proposal?.status === "WITHDRAWN";
  const isReadOnly = (isApproved && !isEditingApproved) || isSuperseded || isWithdrawn;

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/proposals/${proposalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: content.title,
          description: content.description,
          reasonForChange: content.reasonForChange,
          deliverables: content.deliverables,
          assumptions: content.assumptions,
          exclusions: content.exclusions,
          dependencies: content.dependencies,
          timelineImpact: content.timelineImpact,
          pricingConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save proposal.");

      if (data.isNewVersion) {
        setFeedbackMsg({
          type: "success",
          text: `Approved proposal was preserved. Created new proposal v${data.proposal.version}!`,
        });
        setTimeout(() => {
          router.push(`/projects/${projectId}/proposals/${data.proposal.id}`);
        }, 1200);
      } else {
        setProposal(data.proposal);
        setFeedbackMsg({ type: "success", text: "Proposal draft saved successfully." });
      }
    } catch (err: unknown) {
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error saving proposal",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveProposal = async () => {
    setIsApproving(true);
    setFeedbackMsg(null);

    try {
      // Auto-save any pending changes first
      await fetch(`/api/projects/${projectId}/proposals/${proposalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: content.title,
          description: content.description,
          reasonForChange: content.reasonForChange,
          deliverables: content.deliverables,
          assumptions: content.assumptions,
          exclusions: content.exclusions,
          dependencies: content.dependencies,
          timelineImpact: content.timelineImpact,
          pricingConfig,
        }),
      });

      const res = await fetch(`/api/projects/${projectId}/proposals/${proposalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverName: "Project Provider" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve proposal.");

      setProposal(data.proposal);
      setShowApprovalModal(false);
      setFeedbackMsg({
        type: "success",
        text: `Proposal v${data.proposal.version} approved! It is now locked and ready for client presentation.`,
      });
    } catch (err: unknown) {
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error approving proposal",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleWithdrawProposal = async () => {
    if (!confirm("Are you sure you want to withdraw this change proposal?")) return;
    setIsWithdrawing(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/proposals/${proposalId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to withdraw proposal.");

      setProposal(data.proposal);
      setFeedbackMsg({ type: "success", text: "Proposal has been marked as WITHDRAWN." });
    } catch (err: unknown) {
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error withdrawing proposal",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!confirm("Are you sure you want to revoke the client review link? The client will no longer be able to access the proposal.")) {
      return;
    }
    setIsRevoking(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/proposals/${proposalId}/revoke-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke link.");
      setProposal(data.proposal);
      setFeedbackMsg({ type: "success", text: "Client review link has been revoked." });
    } catch (err: unknown) {
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error revoking link",
      });
    } finally {
      setIsRevoking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
        Loading proposal workspace...
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-700">
        <h2 className="text-xl font-bold mb-2">Proposal Not Found</h2>
        <Link href={`/projects/${projectId}/proposals`} className="text-indigo-600 underline">
          ← Return to Proposals
        </Link>
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (proposal.status) {
      case "CLIENT_ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Accepted by Client
          </span>
        );
      case "CLIENT_REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Rejected by Client
          </span>
        );
      case "SENT_TO_CLIENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Sent to Client (Active Review Link)
          </span>
        );
      case "APPROVED":
      case "PROVIDER_APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Approved & Ready to Share
          </span>
        );
      case "SUPERSEDED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Superseded by Newer Version
          </span>
        );
      case "WITHDRAWN":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Withdrawn
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Draft Proposal
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}/proposals`}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Proposals List
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-600">
              Proposal <span className="font-bold text-slate-900">v{proposal.version}</span>
            </span>
            {getStatusBadge()}
          </div>

          <div className="flex items-center gap-3">
            {proposal.status === "CLIENT_ACCEPTED" && !activeInvoice && (
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <span>💳</span>
                Create PayPal Invoice
              </button>
            )}

            {(isApproved || proposal.status === "SENT_TO_CLIENT") && (
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <span>🔗</span>
                Share with Client
              </button>
            )}

            {proposal.reviewTokenHash && !proposal.clientAcceptedAt && !proposal.clientRejectedAt && (
              <button
                type="button"
                disabled={isRevoking}
                onClick={handleRevokeLink}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors border border-rose-200"
              >
                {isRevoking ? "Revoking..." : "Revoke Link"}
              </button>
            )}

            {isApproved && !isEditingApproved && (
              <button
                type="button"
                onClick={() => setIsEditingApproved(true)}
                className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-200"
              >
                Create New Version to Edit (v{proposal.version + 1})
              </button>
            )}

            {!isReadOnly && (
              <>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-300 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Draft"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowApprovalModal(true)}
                  className="inline-flex items-center px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Approve Proposal →
                </button>

                <button
                  type="button"
                  disabled={isWithdrawing}
                  onClick={handleWithdrawProposal}
                  className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  Withdraw
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {feedbackMsg && (
          <div
            className={`rounded-xl p-4 text-sm font-medium flex items-center justify-between shadow-sm ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Client Decision Banners */}
        {proposal.status === "CLIENT_ACCEPTED" && (
          <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-6 shadow-sm flex items-start gap-4 text-emerald-950">
            <div className="p-2 rounded-full bg-emerald-100 text-emerald-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-emerald-900">
                Commercial Agreement Established — Proposal Accepted by Client
              </h3>
              <p className="text-xs text-emerald-800">
                Client confirmed acceptance on {new Date(proposal.clientAcceptedAt).toLocaleString()} for{" "}
                <span className="font-bold">{formatCurrency(Number(proposal.amount), proposal.currency)}</span>.
                This proposal is permanently locked and ready for project fulfillment and invoicing.
              </p>
            </div>
          </div>
        )}

        {/* PayPal Invoice Section for Accepted Proposals */}
        {proposal.status === "CLIENT_ACCEPTED" && (
          activeInvoice ? (
            <PayPalInvoiceCard
              invoice={activeInvoice}
              projectId={projectId}
              proposalId={proposalId}
              onInvoiceUpdated={(updated) => setActiveInvoice(updated)}
            />
          ) : (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4 text-indigo-950">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💳</span>
                  <h4 className="text-sm font-bold text-indigo-950">
                    Ready for PayPal Invoicing
                  </h4>
                </div>
                <p className="text-xs text-indigo-700">
                  This change proposal has been accepted by the client. Generate and send an itemized PayPal invoice directly to{" "}
                  <span className="font-semibold">{proposal.project?.clientEmail || "the client"}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <span>Create PayPal Invoice →</span>
              </button>
            </div>
          )
        )}

        {proposal.status === "CLIENT_REJECTED" && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-6 shadow-sm flex items-start gap-4 text-rose-950">
            <div className="p-2 rounded-full bg-rose-100 text-rose-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-900">
                Client Rejected This Change Proposal
              </h3>
              <p className="text-xs text-rose-800">
                Rejected on {new Date(proposal.clientRejectedAt).toLocaleString()}.
                {(proposal.deliverables as any)?.clientDecision?.rejectionReason && (
                  <span className="block mt-1 bg-white/70 p-2 rounded border border-rose-200 text-rose-900 font-mono">
                    Client Feedback: &ldquo;{(proposal.deliverables as any).clientDecision.rejectionReason}&rdquo;
                  </span>
                )}
              </p>
              <p className="text-[11px] text-rose-700 pt-1">
                You may click &ldquo;Create New Version to Edit&rdquo; to prepare a revised proposal addressing the client&apos;s feedback.
              </p>
            </div>
          </div>
        )}

        {proposal.status === "SENT_TO_CLIENT" && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 shadow-sm flex items-center justify-between text-indigo-950">
            <div className="space-y-0.5">
              <p className="font-bold text-sm text-indigo-900">
                Active Client Review Link
              </p>
              <p className="text-xs text-indigo-700">
                Awaiting client review.
                {proposal.reviewTokenExpiresAt && (
                  <span> Link expires on {new Date(proposal.reviewTokenExpiresAt).toLocaleDateString()}.</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="text-xs font-bold text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 shadow-sm"
            >
              View / Copy Link
            </button>
          </div>
        )}

        {/* Status Alerts */}
        {isApproved && proposal.status !== "SENT_TO_CLIENT" && proposal.status !== "CLIENT_ACCEPTED" && proposal.status !== "CLIENT_REJECTED" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm text-sm text-emerald-900 flex items-center justify-between">
            <div>
              <p className="font-bold">Proposal Approved & Locked</p>
              <p className="text-xs text-emerald-800 mt-0.5">
                Approved on {new Date(proposal.providerApprovedAt || proposal.updatedAt).toLocaleString()} for{" "}
                <span className="font-semibold">{formatCurrency(Number(proposal.amount), proposal.currency)}</span>.
                Approved records cannot be altered. Click &ldquo;Share with Client&rdquo; to generate a review link.
              </p>
            </div>
          </div>
        )}

        {/* Originating Change Request Card */}
        {proposal.changeRequest && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Originating Client Change Request
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800">
                {proposal.changeRequest.classification}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-800">
              {proposal.changeRequest.sourceText}
            </div>
          </div>
        )}

        {/* Content & Deliverables Editor */}
        <ProposalContentEditor
          content={content}
          isReadOnly={isReadOnly}
          onChange={setContent}
        />

        {/* Pricing Configuration Editor */}
        <PricingEditor
          pricingConfig={pricingConfig}
          currency={proposal.currency || "USD"}
          isReadOnly={isReadOnly}
          onChange={setPricingConfig}
        />
      </main>

      {/* Provider Approval Confirmation Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-emerald-100 text-emerald-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Explicit Provider Approval
                </h3>
                <p className="text-xs text-slate-500">
                  Proposal Version {proposal.version}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Proposal Title:</span>
                <span className="font-semibold text-slate-900">{content.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deliverables Count:</span>
                <span className="font-semibold text-slate-900">{content.deliverables.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pricing Model:</span>
                <span className="font-semibold text-slate-900">{pricingConfig.model}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-bold text-slate-900">Total Commercial Amount:</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(Number(proposal.amount), proposal.currency)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              By confirming, you explicitly sign off on this commercial proposal. The record will become immutable and locked against edits. Subsequent modifications will generate a new proposal version.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={handleApproveProposal}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isApproving ? "Approving..." : "Yes, Explicitly Approve Proposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Sharing Modal */}
      <ClientShareModal
        isOpen={showShareModal}
        projectId={projectId}
        proposalId={proposalId}
        proposalVersion={proposal.version}
        clientEmail={proposal.project?.clientEmail}
        onClose={() => setShowShareModal(false)}
        onLinkGenerated={({ expiresAt }) => {
          setProposal((prev: any) => ({
            ...prev,
            status: "SENT_TO_CLIENT",
            reviewTokenExpiresAt: expiresAt,
          }));
        }}
      />

      {/* PayPal Invoice Review Modal */}
      <InvoiceReviewModal
        isOpen={showInvoiceModal}
        projectId={projectId}
        proposalId={proposalId}
        onClose={() => setShowInvoiceModal(false)}
        onInvoiceCreated={(newInvoice) => {
          setActiveInvoice(newInvoice);
          setFeedbackMsg({
            type: "success",
            text: `PayPal invoice ${newInvoice.paypalInvoiceId} created and sent successfully!`,
          });
        }}
      />
    </div>
  );
}

