"use client";

import React, { useEffect, useState, use } from "react";
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-sm text-slate-500">
        Loading client review portal...
      </div>
    );
  }

  if (isExpired || errorMsg || !proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {isExpired ? "Review Link Expired" : "Proposal Link Inactive"}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {errorMsg || "This proposal review link is invalid, expired, or was revoked by the service provider."}
          </p>
          <p className="text-[11px] text-slate-400">
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
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      {/* Brand Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
              A
            </div>
            <span className="text-sm font-extrabold text-slate-900 tracking-tight">
              Accordly
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-semibold text-slate-500">
              Client Proposal Portal
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-700 block">
              {proposal.projectName}
            </span>
            <span className="text-[11px] text-slate-400">
              Prepared for {proposal.clientName}
            </span>
          </div>
        </div>
      </header>

      {/* Main Proposal Document Body */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {feedbackSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl p-4 text-sm font-semibold shadow-sm">
            {feedbackSuccess}
          </div>
        )}

        {/* Decision Banner if already decided */}
        {isAccepted && (
          <div className="bg-emerald-600 text-white rounded-xl p-5 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-full bg-white/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold">Proposal Accepted</h2>
              <p className="text-xs opacity-90">
                You accepted this proposal on {new Date(proposal.clientAcceptedAt!).toLocaleString()}.
                Work is authorized under the terms specified below.
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="bg-rose-600 text-white rounded-xl p-5 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-full bg-white/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold">Proposal Declined</h2>
              <p className="text-xs opacity-90">
                You declined this proposal on {new Date(proposal.clientRejectedAt!).toLocaleString()}.
                {proposal.rejectionReason && (
                  <span className="block mt-1 font-mono text-[11px]">
                    Feedback: &ldquo;{proposal.rejectionReason}&rdquo;
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Proposal Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                Change Proposal v{proposal.version}
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
                {proposal.title}
              </h1>
            </div>

            <div className="text-right">
              <span className="text-2xl font-black text-slate-900 block">
                {proposal.pricing.formattedTotal}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                {proposal.pricing.currency} &bull; {proposal.pricing.model}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Summary of Proposed Work
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {proposal.description}
            </p>
          </div>

          {proposal.reasonForChange && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Reason for Scope Modification
              </h4>
              <p className="text-xs text-slate-700">
                {proposal.reasonForChange}
              </p>
            </div>
          )}
        </div>

        {/* Deliverables Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Proposed Deliverables ({proposal.deliverables.length})
            </h2>
            <p className="text-xs text-slate-500">
              Work items and acceptance standards included in this proposal.
            </p>
          </div>

          <div className="space-y-4">
            {proposal.deliverables.map((deliv, idx) => (
              <div
                key={deliv.id || idx}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    {deliv.name}
                  </h3>
                  {deliv.suggestedEffortHours && (
                    <span className="text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Est. Effort: {deliv.suggestedEffortHours} hrs
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  {deliv.description}
                </p>

                {deliv.acceptanceCriteria.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                      Acceptance Criteria:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-600">
                      {deliv.acceptanceCriteria.map((crit, cIdx) => (
                        <li key={cIdx}>{crit}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Commercial Pricing Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Commercial Pricing Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Itemized calculation matching agreed commercial terms.
            </p>
          </div>

          {proposal.pricing.lineItems.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 grid grid-cols-12 gap-2">
                <span className="col-span-6">Description</span>
                <span className="col-span-2 text-right">Qty/Hours</span>
                <span className="col-span-2 text-right">Unit Price</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>
              {proposal.pricing.lineItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="px-4 py-2.5 grid grid-cols-12 gap-2 text-xs text-slate-800 items-center bg-white"
                >
                  <span className="col-span-6 font-medium">{item.description}</span>
                  <span className="col-span-2 text-right text-slate-600">
                    {item.quantity}
                  </span>
                  <span className="col-span-2 text-right text-slate-600">
                    ${item.unitPrice.toFixed(2)}
                  </span>
                  <span className="col-span-2 text-right font-bold text-slate-900">
                    ${item.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-900 text-white rounded-xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Total Amount Due ({proposal.pricing.currency})
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pricing model: {proposal.pricing.model}
              </p>
            </div>
            <span className="text-2xl font-black text-white">
              {proposal.pricing.formattedTotal}
            </span>
          </div>
        </div>

        {/* Assumptions, Exclusions & Timeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assumptions & Exclusions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Assumptions
              </h3>
              {proposal.assumptions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">None specified.</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                  {proposal.assumptions.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Exclusions (Not Included)
              </h3>
              {proposal.exclusions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">None specified.</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                  {proposal.exclusions.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Timeline & Dependencies */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Timeline & Schedule Impact
              </h3>
              <p className="text-xs text-slate-700">
                {proposal.timelineImpact || "No schedule adjustment specified."}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Client Dependencies
              </h3>
              {proposal.dependencies.length === 0 ? (
                <p className="text-xs text-slate-400 italic">None specified.</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                  {proposal.dependencies.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Decision Section (Visible if not decided) */}
        {!isDecided && (
          <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 sm:p-8 shadow-md text-center space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900">
              Ready to Confirm This Proposal?
            </h2>
            <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
              Accepting this change proposal authorizes the service provider to proceed with the specified deliverables at the stated price.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
              >
                Decline / Request Changes
              </button>
              <button
                type="button"
                onClick={() => setShowAcceptModal(true)}
                className="px-8 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-colors"
              >
                Accept Proposal ({proposal.pricing.formattedTotal}) &rarr;
              </button>
            </div>

            {proposal.expiresAt && (
              <p className="text-[11px] text-slate-400 pt-1">
                Link expires on {new Date(proposal.expiresAt).toLocaleDateString()}.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Accept Confirmation Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Proposal Acceptance
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are accepting <span className="font-semibold text-slate-900">&ldquo;{proposal.title}&rdquo;</span> (v{proposal.version}) for a total of{" "}
              <span className="font-bold text-emerald-700">{proposal.pricing.formattedTotal}</span>.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 space-y-1">
              <p>&bull; Deliverables: {proposal.deliverables.length} work items</p>
              <p>&bull; Currency: {proposal.pricing.currency}</p>
              <p>&bull; Confirmation will be permanently recorded in project records.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleAccept}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? "Accepting..." : "Confirm & Accept Proposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Decline Change Proposal
            </h3>
            <p className="text-xs text-slate-600">
              Please provide optional feedback on why you are declining or what terms you would like changed:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Price exceeds our Q4 budget; would prefer to remove 3D assets to reduce cost..."
              className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleReject}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
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

