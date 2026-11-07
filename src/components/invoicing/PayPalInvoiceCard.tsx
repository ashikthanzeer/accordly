"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatCurrency } from "@/lib/pricing/calculator";

interface PayPalInvoiceCardProps {
  invoice: {
    id: string;
    paypalInvoiceId: string;
    status: string;
    currency: string;
    amount: string | number;
    paidAmount?: string | number | null;
    dueAmount?: string | number | null;
    hostedInvoiceUrl?: string | null;
    sentAt?: string | null;
    paidAt?: string | null;
    lastReconciledAt?: string | null;
  };
  projectId: string;
  proposalId: string;
  onInvoiceUpdated?: (invoice: any) => void;
}

export function PayPalInvoiceCard({
  invoice,
  projectId,
  proposalId,
  onInvoiceUpdated,
}: PayPalInvoiceCardProps) {
  const [isReconciling, setIsReconciling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isPaid = (invoice.status || "").toUpperCase() === "PAID";
  const isPartiallyPaid = (invoice.status || "").toUpperCase() === "PARTIALLY_PAID";

  const totalAmountNum = Number(invoice.amount) || 0;
  const paidAmountNum =
    invoice.paidAmount !== undefined && invoice.paidAmount !== null
      ? Number(invoice.paidAmount)
      : isPaid
      ? totalAmountNum
      : 0;

  const dueAmountNum =
    invoice.dueAmount !== undefined && invoice.dueAmount !== null
      ? Number(invoice.dueAmount)
      : isPaid
      ? 0
      : Math.max(0, totalAmountNum - paidAmountNum);

  const handleReconcile = async () => {
    setIsReconciling(true);
    setFeedback(null);
    try {
      // Calls the authenticated reconciliation endpoint
      const res = await fetch(
        `/api/projects/${projectId}/proposals/${proposalId}/invoice/reconcile`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reconcile payment status with PayPal.");
      }

      if (onInvoiceUpdated) {
        onInvoiceUpdated(data.invoice);
      }
      setFeedback({
        type: "success",
        text: `Authoritative status reconciled: ${data.invoice.status} (Raw: ${data.reconciliation?.rawPayPalStatus || "OK"})`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error reconciling status",
      });
    } finally {
      setIsReconciling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    switch (s) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            PAID IN FULL
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            PARTIALLY PAID
          </span>
        );
      case "SENT":
      case "UNPAID":
      case "PAYMENT_PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            SENT & AWAITING PAYMENT
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30">
            CANCELLED
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#111318] text-[#9298A3] border border-[#292D35]">
            REFUNDED
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#111318] text-[#9298A3] border border-[#292D35]">
            DRAFT
          </span>
        );
    }
  };

  return (
    <GlassCard variant="gold" intensity="prominent" tilt={false} className="p-6 shadow-xl space-y-5">
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292D35] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF65]/10 border border-[#D4AF65]/30 flex items-center justify-center text-[#D4AF65] font-black text-sm shadow-sm">
            PP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#F5F3ED]">
                PayPal Sandbox Invoice
              </h3>
              <span className="text-[10px] uppercase font-semibold text-[#D4AF65] bg-[#D4AF65]/10 border border-[#D4AF65]/20 px-2 py-0.5 rounded">
                Authoritative State
              </span>
            </div>
            <p className="text-xs text-[#9298A3] font-mono mt-0.5">
              Invoice ID: <span className="font-semibold text-[#F5F3ED]">{invoice.paypalInvoiceId}</span>
            </p>
          </div>
        </div>

        <div>{getStatusBadge(invoice.status)}</div>
      </div>

      {/* Main Financial Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
        <div className="bg-[#111318]/80 rounded-xl p-3.5 border border-[#292D35]">
          <span className="text-[10px] uppercase font-bold text-[#9298A3] tracking-wider">
            Total Billed
          </span>
          <p className="text-sm font-black font-mono text-[#F5F3ED] mt-0.5">
            {formatCurrency(totalAmountNum, invoice.currency)}
          </p>
        </div>

        <div className="bg-[#111318]/80 rounded-xl p-3.5 border border-[#292D35]">
          <span className="text-[10px] uppercase font-bold text-[#43B581] tracking-wider">
            Amount Paid
          </span>
          <p className="text-sm font-black font-mono text-[#43B581] mt-0.5">
            {formatCurrency(paidAmountNum, invoice.currency)}
          </p>
        </div>

        <div className="bg-[#111318]/80 rounded-xl p-3.5 border border-[#292D35]">
          <span className="text-[10px] uppercase font-bold text-[#9298A3] tracking-wider">
            Balance Due
          </span>
          <p className={`text-sm font-black font-mono mt-0.5 ${dueAmountNum > 0 ? "text-[#E5B45C]" : "text-[#43B581]"}`}>
            {formatCurrency(dueAmountNum, invoice.currency)}
          </p>
        </div>

        <div className="bg-[#111318]/80 rounded-xl p-3.5 border border-[#292D35]">
          <span className="text-[10px] uppercase font-bold text-[#9298A3] tracking-wider">
            Reconciled At
          </span>
          <p className="text-xs font-semibold font-mono text-[#F5F3ED] mt-1">
            {invoice.lastReconciledAt
              ? new Date(invoice.lastReconciledAt).toLocaleTimeString()
              : "Just now"}
          </p>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`text-xs p-3 rounded-xl border ${
            feedback.type === "success"
              ? "bg-[#43B581]/10 text-[#43B581] border border-[#43B581]/30"
              : "bg-[#E06C75]/10 text-[#E06C75] border border-[#E06C75]/30"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={handleReconcile}
          disabled={isReconciling}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#F5F3ED] bg-[#111318]/90 hover:text-[#D4AF65] hover:border-[#D4AF65]/40 transition-all border border-[#292D35] disabled:opacity-50 active:scale-[0.98]"
        >
          {isReconciling ? (
            <>
              <span className="inline-block animate-spin">⏳</span>
              Reconciling with PayPal...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-[#D4AF65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Payment Status
            </>
          )}
        </button>

        {invoice.hostedInvoiceUrl && (
          <a
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] shadow-sm shadow-[#D4AF65]/20 hover:shadow-[#D4AF65]/35 transition-all active:scale-[0.98]"
          >
            <span>View on PayPal</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </GlassCard>
  );
}
