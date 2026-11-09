"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProposalContentEditor } from "@/components/proposals/ProposalContentEditor";
import { PricingEditor } from "@/components/proposals/PricingEditor";
import { ProposalVersionComparison } from "@/components/proposals/ProposalVersionComparison";
import { ClientShareModal } from "@/components/proposals/ClientShareModal";
import { DeleteProposalModal } from "@/components/proposals/DeleteProposalModal";
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Proposal state
  const [proposal, setProposal] = useState<any | null>(null);
  const [allProposals, setAllProposals] = useState<any[]>([]);
  const [isBranchingVersion, setIsBranchingVersion] = useState(false);

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

        // Check for active PayPal invoice and load sibling proposal versions
        try {
          const [invRes, listRes] = await Promise.all([
            fetch(`/api/projects/${projectId}/proposals/${proposalId}/invoice`),
            fetch(`/api/projects/${projectId}/proposals`),
          ]);
          if (invRes.ok) {
            const invData = await invRes.json();
            if (invData.invoice) {
              setActiveInvoice(invData.invoice);
            }
          }
          if (listRes.ok) {
            const listData = await listRes.json();
            if (Array.isArray(listData.proposals)) {
              setAllProposals(listData.proposals);
            }
          }
        } catch {
          // Non-blocking invoice & version list fetch
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

  const isDraft = proposal?.status === "DRAFT";
  const isApproved = proposal?.status === "APPROVED" || proposal?.status === "PROVIDER_APPROVED";
  const isSent = proposal?.status === "SENT_TO_CLIENT";
  const isClientAccepted = proposal?.status === "CLIENT_ACCEPTED";
  const isClientRejected = proposal?.status === "CLIENT_REJECTED";
  const isSuperseded = proposal?.status === "SUPERSEDED";
  const isWithdrawn = proposal?.status === "WITHDRAWN";
  const isReadOnly = !isDraft;

  const syncProposalState = (updated: any) => {
    setProposal(updated);
    setAllProposals((prev) =>
      prev.some((p) => p.id === updated.id)
        ? prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
        : [updated, ...prev]
    );
  };

  const handleSaveDraft = async () => {
    if (!isDraft) return;
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

      syncProposalState(data.proposal);
      setFeedbackMsg({ type: "success", text: "Proposal draft saved successfully." });
    } catch (err: unknown) {
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error saving proposal",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewVersion = async () => {
    setIsBranchingVersion(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/proposals/${proposalId}/versions`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create new version.");

      setFeedbackMsg({
        type: "success",
        text: `Created new Change Proposal v${data.proposal.version} (Draft). Redirecting...`,
      });
      setTimeout(() => {
        router.push(`/projects/${projectId}/proposals/${data.proposal.id}`);
      }, 800);
    } catch (err: unknown) {
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error creating new version",
      });
    } finally {
      setIsBranchingVersion(false);
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

      syncProposalState(data.proposal);
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

      syncProposalState(data.proposal);
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
      syncProposalState(data.proposal);
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

  const getStatusBadge = () => {
    if (!proposal) return null;
    switch (proposal.status) {
      case "CLIENT_ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Accepted by Client
          </span>
        );
      case "CLIENT_REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Rejected by Client
          </span>
        );
      case "SENT_TO_CLIENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Sent to Client (Active Link)
          </span>
        );
      case "APPROVED":
      case "PROVIDER_APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Approved & Ready to Share
          </span>
        );
      case "SUPERSEDED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#111318] text-[#9298A3] border border-[#292D35]">
            Superseded by Newer Version
          </span>
        );
      case "WITHDRAWN":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30">
            Withdrawn
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30">
            Draft Proposal
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <AppShell
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: `Project (${projectId.slice(0, 8)}...)`, href: `/projects/${projectId}/baseline` },
          { label: "Proposals", href: `/projects/${projectId}/proposals` },
          { label: "Loading..." },
        ]}
      >
        <div className="bg-[#171A20] border border-[#292D35] rounded-xl p-12 text-center text-[#9298A3] text-sm font-mono">
          Loading proposal workspace...
        </div>
      </AppShell>
    );
  }

  if (!proposal) {
    return (
      <AppShell
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: `Project (${projectId.slice(0, 8)}...)`, href: `/projects/${projectId}/baseline` },
          { label: "Proposals", href: `/projects/${projectId}/proposals` },
          { label: "Not Found" },
        ]}
      >
        <div className="bg-[#171A20] border border-[#292D35] rounded-xl p-12 text-center text-[#F5F3ED] space-y-4">
          <h2 className="text-xl font-bold">Proposal Not Found</h2>
          <Link href={`/projects/${projectId}/proposals`} className="text-[#D4AF65] underline hover:text-[#E2C17F]">
            ← Return to Proposals
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: `Project (${projectId.slice(0, 8)}...)`, href: `/projects/${projectId}/baseline` },
        { label: "Proposals", href: `/projects/${projectId}/proposals` },
        { label: `v${proposal.version}` },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {proposal.status === "CLIENT_ACCEPTED" && !activeInvoice && (
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] transition-colors shadow-sm"
            >
              <span>💳</span>
              Create PayPal Invoice
            </button>
          )}

          {(isApproved || proposal.status === "SENT_TO_CLIENT") && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] transition-colors shadow-sm"
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
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#E06C75] bg-[#E06C75]/10 hover:bg-[#E06C75]/20 border border-[#E06C75]/30 transition-colors"
            >
              {isRevoking ? "Revoking..." : "Revoke Link"}
            </button>
          )}

          {!isDraft && proposal.status !== "WITHDRAWN" && (
            <button
              type="button"
              disabled={isBranchingVersion}
              onClick={handleCreateNewVersion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#D4AF65] bg-[#D4AF65]/10 border border-[#D4AF65]/30 hover:bg-[#D4AF65]/20 transition-colors disabled:opacity-50"
            >
              <span>📑</span>
              {isBranchingVersion
                ? "Branching Version..."
                : `Create New Version (v${proposal.version + 1})`}
            </button>
          )}

          {!isReadOnly && (
            <>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveDraft}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-[#F5F3ED] bg-[#171A20] hover:text-[#D4AF65] hover:border-[#D4AF65] transition-colors border border-[#292D35] disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={() => setShowApprovalModal(true)}
                className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#090A0C] bg-[#43B581] hover:bg-[#43B581]/90 transition-colors shadow-sm"
              >
                Approve Proposal →
              </button>

              <button
                type="button"
                disabled={isWithdrawing}
                onClick={handleWithdrawProposal}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#E06C75] hover:bg-[#E06C75]/10 transition-colors"
              >
                Withdraw
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Draft
              </button>
            </>
          )}

          {isReadOnly && (
            <div
              title="This proposal is protected because it has been approved, shared, or associated with commercial activity."
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-neutral-500 bg-neutral-900 border border-neutral-800"
            >
              <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Protected</span>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Workspace Subnavigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#292D35] pb-3 overflow-x-auto">
          <Link
            href={`/projects/${projectId}/baseline`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Baseline
          </Link>
          <Link
            href={`/projects/${projectId}/requests`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Scope Intelligence
          </Link>
          <Link
            href={`/projects/${projectId}/proposals`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#D4AF65] bg-[#D4AF65]/10 border border-[#D4AF65]/30"
          >
            Proposals
          </Link>
          <Link
            href={`/projects/${projectId}/timeline`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Timeline
          </Link>
        </div>

        {/* Header Summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292D35] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold text-[#F5F3ED] tracking-tight">
                Proposal Workspace <span className="text-[#D4AF65] font-mono">v{proposal.version}</span>
              </h1>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-[#9298A3]">
              Review scope deliverables, adjust deterministic pricing, and approve commercial proposals.
            </p>
          </div>

          <div className="text-right">
            <span className="text-xl font-extrabold font-mono text-[#F5F3ED]">
              {formatCurrency(Number(proposal.amount), proposal.currency)}
            </span>
            <p className="text-[10px] text-[#D4AF65] font-mono uppercase font-bold">
              {proposal.currency}
            </p>
          </div>
        </div>

        {/* Predecessor Lineage Banner */}
        {proposal.deliverables?.predecessorVersion && (
          <div className="bg-[#111318] border border-white/[0.08] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-[#9298A3]">
            <span>
              Branched from predecessor proposal <strong className="text-[#F5F3ED] font-mono">v{proposal.deliverables.predecessorVersion}</strong>.
            </span>
            {proposal.deliverables.predecessorProposalId && (
              <Link
                href={`/projects/${projectId}/proposals/${proposal.deliverables.predecessorProposalId}`}
                className="text-[#D4AF65] hover:underline font-mono"
              >
                View v{proposal.deliverables.predecessorVersion} &rarr;
              </Link>
            )}
          </div>
        )}

        {feedbackMsg && (
          <div
            className={`rounded-xl p-4 text-sm font-medium flex items-center justify-between shadow-sm ${
              feedbackMsg.type === "success"
                ? "bg-[#43B581]/10 text-[#43B581] border border-[#43B581]/30"
                : "bg-[#E06C75]/10 text-[#E06C75] border border-[#E06C75]/30"
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="text-xs underline ml-4 hover:text-[#F5F3ED]">
              Dismiss
            </button>
          </div>
        )}

        {/* Client Decision Banners */}
        {proposal.status === "CLIENT_ACCEPTED" && (
          <GlassCard variant="surface" intensity="prominent" className="border-[#43B581]/30 p-6 shadow-sm flex items-start gap-4 text-[#F5F3ED] bg-[#43B581]/5">
            <div className="p-2 rounded-lg bg-[#43B581]/20 text-[#43B581] border border-[#43B581]/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#43B581]">
                Commercial Agreement Established — Proposal Accepted by Client
              </h3>
              <p className="text-xs text-[#9298A3]">
                Client confirmed acceptance on <span className="font-mono text-[#F5F3ED]">{new Date(proposal.clientAcceptedAt).toLocaleString()}</span> for{" "}
                <span className="font-bold font-mono text-[#D4AF65]">{formatCurrency(Number(proposal.amount), proposal.currency)}</span>.
                This proposal is permanently locked and ready for project fulfillment and invoicing.
              </p>
            </div>
          </GlassCard>
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
            <GlassCard variant="gold" intensity="prominent" className="p-5 shadow-lg flex flex-wrap items-center justify-between gap-4 text-[#F5F3ED]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💳</span>
                  <h4 className="text-sm font-bold text-[#F5F3ED]">
                    Ready for PayPal Invoicing
                  </h4>
                </div>
                <p className="text-xs text-[#9298A3]">
                  This change proposal has been accepted by the client. Generate and send an itemized PayPal invoice directly to{" "}
                  <span className="font-semibold text-[#D4AF65] font-mono">{proposal.project?.clientEmail || "the client"}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] transition-all shadow-sm shadow-[#D4AF65]/20 active:scale-[0.98]"
              >
                <span>Create PayPal Invoice →</span>
              </button>
            </GlassCard>
          )
        )}

        {proposal.status === "CLIENT_REJECTED" && (
          <GlassCard variant="surface" intensity="prominent" className="border-[#E06C75]/30 p-6 shadow-sm flex items-start gap-4 text-[#F5F3ED] bg-[#E06C75]/5">
            <div className="p-2 rounded-lg bg-[#E06C75]/20 text-[#E06C75] border border-[#E06C75]/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#E06C75]">
                Client Rejected This Change Proposal
              </h3>
              <p className="text-xs text-[#9298A3]">
                Rejected on <span className="font-mono text-[#F5F3ED]">{new Date(proposal.clientRejectedAt).toLocaleString()}</span>.
                {(proposal.deliverables as any)?.clientDecision?.rejectionReason && (
                  <span className="block mt-1 bg-[#111318] p-2.5 rounded border border-[#292D35] text-[#F5F3ED] font-mono">
                    Client Feedback: &ldquo;{(proposal.deliverables as any).clientDecision.rejectionReason}&rdquo;
                  </span>
                )}
              </p>
              <p className="text-[11px] text-[#9298A3] pt-1">
                You may click &ldquo;Edit as New Version&rdquo; to prepare a revised proposal addressing the client&apos;s feedback.
              </p>
            </div>
          </GlassCard>
        )}

        {proposal.status === "SENT_TO_CLIENT" && (
          <GlassCard variant="surface" intensity="subtle" className="border-[#D4AF65]/30 p-5 shadow-sm flex items-center justify-between text-[#F5F3ED]">
            <div className="space-y-0.5">
              <p className="font-bold text-sm text-[#D4AF65]">
                Active Client Review Link
              </p>
              <p className="text-xs text-[#9298A3]">
                Awaiting client review.
                {proposal.reviewTokenExpiresAt && (
                  <span> Link expires on <span className="font-mono text-[#F5F3ED]">{new Date(proposal.reviewTokenExpiresAt).toLocaleDateString()}</span>.</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] px-3.5 py-1.5 rounded-lg transition-all shadow-sm active:scale-[0.98]"
            >
              View / Copy Link
            </button>
          </GlassCard>
        )}

        {/* Status Alerts */}
        {isApproved && proposal.status !== "SENT_TO_CLIENT" && proposal.status !== "CLIENT_ACCEPTED" && proposal.status !== "CLIENT_REJECTED" && (
          <GlassCard variant="surface" intensity="subtle" className="border-[#43B581]/30 p-5 shadow-sm text-sm text-[#F5F3ED] flex items-center justify-between bg-[#43B581]/5">
            <div>
              <p className="font-bold text-[#43B581]">Proposal Approved & Locked</p>
              <p className="text-xs text-[#9298A3] mt-0.5">
                Approved on <span className="font-mono text-[#F5F3ED]">{new Date(proposal.providerApprovedAt || proposal.updatedAt).toLocaleString()}</span> for{" "}
                <span className="font-semibold font-mono text-[#D4AF65]">{formatCurrency(Number(proposal.amount), proposal.currency)}</span>.
                Approved records cannot be altered. Click &ldquo;Share with Client&rdquo; to generate a review link.
              </p>
            </div>
          </GlassCard>
        )}

        {/* Originating Change Request Card */}
        {proposal.changeRequest && (
          <GlassCard variant="surface" intensity="prominent" className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9298A3]">
                Originating Client Change Request
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-[#111318] text-[#D4AF65] border border-[#292D35]">
                {proposal.changeRequest.classification}
              </span>
            </div>
            <div className="bg-[#090A0C]/90 border border-[#292D35] rounded-lg p-3 text-xs font-mono text-[#F5F3ED]">
              {proposal.changeRequest.sourceText}
            </div>
          </GlassCard>
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

        {/* Version History & Side-by-Side Version Comparison */}
        {allProposals.length > 0 && (
          <ProposalVersionComparison
            projectId={projectId}
            proposals={allProposals}
            currentProposalId={proposalId}
          />
        )}
      </div>

      {/* Provider Approval Confirmation Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-[#090A0C]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#F5F3ED]">
                  Explicit Provider Approval
                </h3>
                <p className="text-xs text-[#9298A3] font-mono">
                  Proposal Version {proposal.version}
                </p>
              </div>
            </div>

            <div className="bg-[#111318] border border-[#292D35] rounded-xl p-4 text-xs space-y-2 text-[#9298A3]">
              <div className="flex justify-between">
                <span>Proposal Title:</span>
                <span className="font-semibold text-[#F5F3ED]">{content.title}</span>
              </div>
              <div className="flex justify-between">
                <span>Deliverables Count:</span>
                <span className="font-semibold text-[#F5F3ED] font-mono">{content.deliverables.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Pricing Model:</span>
                <span className="font-semibold text-[#F5F3ED] font-mono">{pricingConfig.model}</span>
              </div>
              <div className="flex justify-between border-t border-[#292D35] pt-2 text-sm">
                <span className="font-bold text-[#F5F3ED]">Total Commercial Amount:</span>
                <span className="font-bold font-mono text-[#D4AF65]">
                  {formatCurrency(Number(proposal.amount), proposal.currency)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#9298A3] leading-relaxed">
              By confirming, you explicitly sign off on this commercial proposal. The record will become immutable and locked against edits. Subsequent modifications will generate a new proposal version.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#1D2129] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={handleApproveProposal}
                className="px-4 py-2 text-xs font-bold text-[#090A0C] bg-[#43B581] hover:bg-[#43B581]/90 rounded-lg transition-colors shadow-sm disabled:opacity-50"
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

      {/* Proposal Soft Deletion Modal */}
      <DeleteProposalModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => {
          router.push(`/projects/${projectId}/proposals`);
        }}
        projectId={projectId}
        proposal={proposal}
      />
    </AppShell>
  );
}
