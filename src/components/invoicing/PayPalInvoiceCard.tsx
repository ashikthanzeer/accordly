"use client";

import React, { useState } from "react";
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            PAID IN FULL
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            SENT & AWAITING PAYMENT
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            CANCELLED
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
            REFUNDED
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            DRAFT
          </span>
        );
    }
  };

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-sm">
            PP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                PayPal Sandbox Invoice
              </h3>
              <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                Authoritative State
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Invoice ID: <span className="font-semibold text-slate-800">{invoice.paypalInvoiceId}</span>
            </p>
          </div>
        </div>

        <div>{getStatusBadge(invoice.status)}</div>
      </div>

      {/* Main Financial Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Total Billed
          </span>
          <p className="text-sm font-black text-slate-900 mt-0.5">
            {formatCurrency(totalAmountNum, invoice.currency)}
          </p>
        </div>

        <div className="bg-emerald-50/60 rounded-xl p-3.5 border border-emerald-100">
          <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">
            Amount Paid
          </span>
          <p className="text-sm font-black text-emerald-700 mt-0.5">
            {formatCurrency(paidAmountNum, invoice.currency)}
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Balance Due
          </span>
          <p className={`text-sm font-black mt-0.5 ${dueAmountNum > 0 ? "text-slate-900" : "text-emerald-700"}`}>
            {formatCurrency(dueAmountNum, invoice.currency)}
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Reconciled At
          </span>
          <p className="text-xs font-semibold text-slate-800 mt-1">
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
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
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
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-300 disabled:opacity-50"
        >
          {isReconciling ? (
            <>
              <span className="inline-block animate-spin">⏳</span>
              Reconciling with PayPal...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <span>View on PayPal</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
