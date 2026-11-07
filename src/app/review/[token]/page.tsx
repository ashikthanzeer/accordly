"use client";

import React, { useEffect, useState, use } from "react";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlassCard } from "@/components/ui/GlassCard";
import type { PublicProposalSnapshot } from "@/lib/proposals/serializer";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function ClientReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [proposal, setProposal] = useState<PublicProposalSnapshot | null>(null);

  // Decision Modals State
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProposal() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/review/${token}`);
        const data = await res.json();

        if (res.status === 410) {
          setIsExpired(true);
          setErrorMsg(data.error || "This review link has expired.");
          return;
        }

        if (!res.ok) {
          setErrorMsg(data.error || "Failed to load change proposal.");
          return;
        }

        setProposal(data.proposal);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Error connecting to server");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProposal();
  }, [token]);

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/review/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record acceptance.");

      setProposal(data.proposal);
      setShowAcceptModal(false);
      setFeedbackSuccess("Proposal successfully accepted! Your service provider has been notified.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error accepting proposal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/review/${token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record response.");

      setProposal(data.proposal);
      setShowRejectModal(false);
      setFeedbackSuccess("Your response has been recorded. Your service provider will review your feedback.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error submitting response");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090A0C] flex items-center justify-center p-6 text-sm text-[#9298A3] font-mono">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-[#D4AF65] border-t-transparent rounded-full animate-spin" />
          <p>Loading client review portal...</p>
        </div>
      </div>
    );
  }

  if (isExpired || errorMsg || !proposal) {
    return (
      <div className="min-h-screen bg-[#090A0C] flex items-center justify-center p-6">
        <div className="bg-[#171A20] border border-[#292D35] rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#E06C75]/15 text-[#E06C75] flex items-center justify-center text-xl font-bold border border-[#E06C75]/30">
            !
          </div>
          <h2 className="text-lg font-bold text-[#F5F3ED]">
            {isExpired ? "Review Link Expired" : "Proposal Link Inactive"}
          </h2>
          <p className="text-xs text-[#9298A3] leading-relaxed">
            {errorMsg || "This proposal review link is invalid, expired, or was revoked by the service provider."}
          </p>
          <p className="text-[11px] text-[#9298A3]/70">
            Please contact your service provider directly to request an updated proposal link.
          </p>
        </div>
      </div>
    );
  }

  const isDecided = Boolean(proposal.clientAcceptedAt || proposal.clientRejectedAt);
  const isAccepted = proposal.status === "CLIENT_ACCEPTED";
  const isRejected = proposal.status === "CLIENT_REJECTED";

  return (
    <div className="min-h-screen bg-[#090A0C] text-[#F5F3ED] pb-20 relative overflow-hidden">
      {/* Viewport Ambient Motion & Specular Particles */}
      <AmbientBackground />

      {/* Brand Header */}
      <header className="bg-[#111318]/80 border-b border-white/[0.08] sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D4AF65] to-[#A98746] flex items-center justify-center shadow-lg shadow-[#D4AF65]/10">
              <span className="text-[#090A0C] font-black text-sm tracking-tighter">A</span>
            </div>
            <div>
              <span className="text-sm font-extrabold text-[#F5F3ED] tracking-tight">
                Accordly
              </span>
              <span className="mx-2 text-[#292D35]">|</span>
              <span className="text-xs font-semibold text-[#D4AF65]">
                Client Proposal Portal
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-[#F5F3ED] block">
              {proposal.projectName}
            </span>
            <span className="text-[11px] text-[#9298A3]">
              Prepared for <span className="text-[#F5F3ED]">{proposal.clientName}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Proposal Document Body */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6 relative z-10">
        {feedbackSuccess && (
          <div className="bg-[#43B581]/15 border border-[#43B581]/40 text-[#43B581] rounded-xl p-4 text-sm font-semibold shadow-sm backdrop-blur-sm">
            {feedbackSuccess}
          </div>
        )}

        {/* Decision Banner if already decided */}
        {isAccepted && (
          <GlassCard variant="surface" intensity="prominent" className="border-[#43B581]/40 text-[#F5F3ED] p-5 shadow-sm flex items-center gap-3 bg-[#43B581]/5">
            <div className="p-2 rounded-lg bg-[#43B581]/20 text-[#43B581] border border-[#43B581]/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#43B581]">Proposal Accepted</h2>
              <p className="text-xs text-[#9298A3]">
                You accepted this proposal on <span className="text-[#F5F3ED] font-mono">{new Date(proposal.clientAcceptedAt!).toLocaleString()}</span>.
                Work is authorized under the terms specified below.
              </p>
            </div>
          </GlassCard>
        )}

        {isRejected && (
          <GlassCard variant="surface" intensity="prominent" className="border-[#E06C75]/40 text-[#F5F3ED] p-5 shadow-sm flex items-center gap-3 bg-[#E06C75]/5">
            <div className="p-2 rounded-lg bg-[#E06C75]/20 text-[#E06C75] border border-[#E06C75]/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#E06C75]">Proposal Declined</h2>
              <p className="text-xs text-[#9298A3]">
                You declined this proposal on <span className="text-[#F5F3ED] font-mono">{new Date(proposal.clientRejectedAt!).toLocaleString()}</span>.
                {proposal.rejectionReason && (
                  <span className="block mt-1 font-mono text-[11px] bg-[#111318]/90 p-2 rounded border border-[#292D35] text-[#F5F3ED]">
                    Feedback: &ldquo;{proposal.rejectionReason}&rdquo;
                  </span>
                )}
              </p>
            </div>
          </GlassCard>
        )}

        {/* Proposal Header Card */}
        <GlassCard variant="surface" intensity="prominent" className="p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292D35] pb-4">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D4AF65] bg-[#D4AF65]/10 border border-[#D4AF65]/30 px-2.5 py-1 rounded-full">
                Change Proposal v{proposal.version}
              </span>
              <h1 className="text-2xl font-extrabold text-[#F5F3ED] mt-2 tracking-tight">
                {proposal.title}
              </h1>
            </div>

            <div className="text-right">
              <span className="text-2xl font-black font-mono text-[#F5F3ED] block">
                {proposal.pricing.formattedTotal}
              </span>
              <span className="text-[10px] text-[#D4AF65] font-semibold uppercase font-mono">
                {proposal.pricing.currency} &bull; {proposal.pricing.model}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A3] mb-1">
              Summary of Proposed Work
            </h3>
            <p className="text-sm text-[#F5F3ED] leading-relaxed">
              {proposal.description}
            </p>
          </div>

          {proposal.reasonForChange && (
            <div className="bg-[#111318]/80 border border-[#292D35] rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#9298A3] mb-1">
                Reason for Scope Modification
              </h4>
              <p className="text-xs text-[#F5F3ED]">
                {proposal.reasonForChange}
              </p>
            </div>
          )}
        </GlassCard>

        {/* Deliverables Section */}
        <GlassCard variant="surface" intensity="prominent" className="p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="border-b border-[#292D35] pb-3">
            <h2 className="text-base font-bold text-[#F5F3ED]">
              Proposed Deliverables ({proposal.deliverables.length})
            </h2>
            <p className="text-xs text-[#9298A3]">
              Work items and acceptance standards included in this proposal.
            </p>
          </div>

          <div className="space-y-4">
            {proposal.deliverables.map((deliv, idx) => (
              <div
                key={deliv.id || idx}
                className="border border-[#292D35] rounded-xl p-4 bg-[#111318]/70 hover:bg-[#111318] space-y-2.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#F5F3ED]">
                    {deliv.name}
                  </h3>
                  {deliv.suggestedEffortHours && (
                    <span className="text-xs font-mono font-medium text-[#9298A3] bg-[#090A0C]/80 px-2 py-0.5 rounded border border-[#292D35]">
                      Est. Effort: {deliv.suggestedEffortHours} hrs
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#F5F3ED]/90 leading-relaxed">
                  {deliv.description}
                </p>

                {deliv.acceptanceCriteria.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] font-bold uppercase text-[#9298A3] block mb-1">
                      Acceptance Criteria:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-[#9298A3]">
                      {deliv.acceptanceCriteria.map((crit, cIdx) => (
                        <li key={cIdx} className="text-[#F5F3ED]/80">{crit}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Commercial Pricing Breakdown */}
        <GlassCard variant="surface" intensity="prominent" className="p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="border-b border-[#292D35] pb-3">
            <h2 className="text-base font-bold text-[#F5F3ED]">
              Commercial Pricing Breakdown
            </h2>
            <p className="text-xs text-[#9298A3]">
              Itemized calculation matching agreed commercial terms.
            </p>
          </div>

          {proposal.pricing.lineItems.length > 0 && (
            <div className="divide-y divide-[#292D35] border border-[#292D35] rounded-xl overflow-hidden bg-[#171A20]/60 backdrop-blur-sm">
              <div className="bg-[#111318]/90 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#9298A3] grid grid-cols-12 gap-2 border-b border-[#292D35]">
                <span className="col-span-6">Description</span>
                <span className="col-span-2 text-right">Qty/Hours</span>
                <span className="col-span-2 text-right">Unit Price</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>
              {proposal.pricing.lineItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="px-4 py-2.5 grid grid-cols-12 gap-2 text-xs text-[#F5F3ED] items-center hover:bg-[#1D2129]/60 transition-colors"
                >
                  <span className="col-span-6 font-medium">{item.description}</span>
                  <span className="col-span-2 text-right font-mono text-[#9298A3]">
                    {item.quantity}
                  </span>
                  <span className="col-span-2 text-right font-mono text-[#9298A3]">
                    ${item.unitPrice.toFixed(2)}
                  </span>
                  <span className="col-span-2 text-right font-mono font-bold text-[#D4AF65]">
                    ${item.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-[#111318]/90 border border-[#D4AF65]/30 rounded-xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#9298A3] uppercase tracking-wider font-semibold">
                Total Amount Due ({proposal.pricing.currency})
              </span>
              <p className="text-[11px] text-[#9298A3] mt-0.5">
                Pricing model: <span className="font-semibold text-[#F5F3ED]">{proposal.pricing.model}</span>
              </p>
            </div>
            <span className="text-2xl font-black font-mono text-[#F5F3ED]">
              {proposal.pricing.formattedTotal}
            </span>
          </div>
        </GlassCard>

        {/* Assumptions, Exclusions & Timeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assumptions & Exclusions */}
          <GlassCard variant="surface" intensity="subtle" className="p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A3] mb-1.5">
                Assumptions
              </h3>
              {proposal.assumptions.length === 0 ? (
                <p className="text-xs text-[#9298A3]/60 italic">None specified.</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-xs text-[#9298A3]">
                  {proposal.assumptions.map((a, idx) => (
                    <li key={idx} className="text-[#F5F3ED]/90">{a}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-[#292D35] pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A3] mb-1.5">
                Exclusions (Not Included)
              </h3>
              {proposal.exclusions.length === 0 ? (
                <p className="text-xs text-[#9298A3]/60 italic">None specified.</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-xs text-[#9298A3]">
                  {proposal.exclusions.map((e, idx) => (
                    <li key={idx} className="text-[#F5F3ED]/90">{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </GlassCard>

          {/* Timeline & Dependencies */}
          <GlassCard variant="surface" intensity="subtle" className="p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A3] mb-1.5">
                Timeline & Schedule Impact
              </h3>
              <p className="text-xs text-[#F5F3ED]">
                {proposal.timelineImpact || "No schedule adjustment specified."}
              </p>
            </div>

            <div className="border-t border-[#292D35] pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A3] mb-1.5">
                Client Dependencies
              </h3>
              {proposal.dependencies.length === 0 ? (
                <p className="text-xs text-[#9298A3]/60 italic">None specified.</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-xs text-[#9298A3]">
                  {proposal.dependencies.map((d, idx) => (
                    <li key={idx} className="text-[#F5F3ED]/90">{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Decision Section (Visible if not decided) */}
        {!isDecided && (
          <GlassCard variant="gold" intensity="prominent" className="p-6 sm:p-8 shadow-2xl text-center space-y-4">
            <h2 className="text-lg font-extrabold text-[#F5F3ED]">
              Ready to Confirm This Proposal?
            </h2>
            <p className="text-xs text-[#9298A3] max-w-lg mx-auto leading-relaxed">
              Accepting this change proposal authorizes the service provider to proceed with the specified deliverables at the stated price.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#E06C75] bg-[#E06C75]/10 hover:bg-[#E06C75]/20 border border-[#E06C75]/30 transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                Decline / Request Changes
              </button>
              <button
                type="button"
                onClick={() => setShowAcceptModal(true)}
                className="px-8 py-2.5 rounded-xl text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] shadow-lg shadow-[#D4AF65]/25 hover:shadow-[#D4AF65]/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Accept Proposal ({proposal.pricing.formattedTotal}) &rarr;
              </button>
            </div>

            {proposal.expiresAt && (
              <p className="text-[11px] text-[#9298A3] font-mono pt-1">
                Link expires on {new Date(proposal.expiresAt).toLocaleDateString()}.
              </p>
            )}
          </GlassCard>
        )}
      </main>

      {/* Accept Confirmation Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 bg-[#090A0C]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#F5F3ED]">
              Confirm Proposal Acceptance
            </h3>
            <p className="text-xs text-[#9298A3] leading-relaxed">
              You are accepting <span className="font-semibold text-[#F5F3ED]">&ldquo;{proposal.title}&rdquo;</span> (v{proposal.version}) for a total of{" "}
              <span className="font-bold font-mono text-[#D4AF65]">{proposal.pricing.formattedTotal}</span>.
            </p>
            <div className="bg-[#111318] border border-[#292D35] rounded-lg p-3 text-[11px] text-[#9298A3] space-y-1">
              <p>&bull; Deliverables: <span className="text-[#F5F3ED]">{proposal.deliverables.length} work items</span></p>
              <p>&bull; Currency: <span className="text-[#D4AF65] font-mono">{proposal.pricing.currency}</span></p>
              <p>&bull; Confirmation will be permanently recorded in project records.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#1D2129] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleAccept}
                className="px-5 py-2 text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? "Accepting..." : "Confirm & Accept Proposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-[#090A0C]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#F5F3ED]">
              Decline Change Proposal
            </h3>
            <p className="text-xs text-[#9298A3]">
              Please provide optional feedback on why you are declining or what terms you would like changed:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Price exceeds our Q4 budget; would prefer to remove 3D assets to reduce cost..."
              className="w-full text-xs text-[#F5F3ED] bg-[#090A0C] border border-[#292D35] rounded-lg p-3 focus:outline-none focus:border-[#E06C75] placeholder-[#9298A3]/50"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#1D2129] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleReject}
                className="px-5 py-2 text-xs font-bold text-white bg-[#E06C75] hover:bg-[#E06C75]/90 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? "Declining..." : "Submit Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
