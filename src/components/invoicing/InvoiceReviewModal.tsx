"use client";

import React, { useState, useEffect } from "react";
import type { MappedInvoicePreview } from "@/lib/paypal/types";

interface InvoiceReviewModalProps {
  isOpen: boolean;
  projectId: string;
  proposalId: string;
  onClose: () => void;
  onInvoiceCreated: (invoice: any) => void;
}

export function InvoiceReviewModal({
  isOpen,
  projectId,
  proposalId,
  onClose,
  onInvoiceCreated,
}: InvoiceReviewModalProps) {
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MappedInvoicePreview | null>(null);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function fetchPreview() {
      setIsLoadingPreview(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/proposals/${proposalId}/invoice/preview`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load invoice preview.");
        }

        if (isMounted) {
          if (data.isAlreadyInvoiced && data.existingInvoice) {
            onInvoiceCreated(data.existingInvoice);
            onClose();
            return;
          }
          setPreview(data.preview);
          if (data.preview?.note) {
            setNote(data.preview.note);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Error loading invoice preview."
          );
        }
      } finally {
        if (isMounted) setIsLoadingPreview(false);
      }
    }

    fetchPreview();
    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId, proposalId, onClose, onInvoiceCreated]);

  if (!isOpen) return null;

  const handleConfirmAndSend = async () => {
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/proposals/${proposalId}/invoice/create-and-send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create and send PayPal invoice.");
      }

      onInvoiceCreated(data.invoice);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error sending PayPal invoice."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
              💳
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Review PayPal Invoice
              </h3>
              <p className="text-xs text-slate-500">
                Review client details and itemized pricing before sending to PayPal
                Sandbox.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="text-slate-400 hover:text-slate-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Loading state */}
        {isLoadingPreview && (
          <div className="py-12 text-center text-slate-500 text-sm space-y-2">
            <div className="inline-block animate-spin text-2xl">⏳</div>
            <p>Preparing PayPal commercial preview...</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
            <p className="font-semibold">Unable to proceed</p>
            <p>{error}</p>
          </div>
        )}

        {/* Invoice Preview Details */}
        {!isLoadingPreview && preview && (
          <div className="space-y-5 text-slate-800 text-xs">
            {/* Recipient & Project Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Client Recipient
                </span>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {preview.recipientName || "Client"}
                </p>
                <p className="text-xs text-indigo-600 font-medium">
                  {preview.recipientEmail}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Payment Destination
                </span>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  PayPal Sandbox Environment
                </p>
                <p className="text-xs text-slate-500">
                  Instant email delivery & hosted payment link
                </p>
              </div>
            </div>

            {/* Itemized Deliverables */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 font-bold text-[11px] text-slate-700 flex justify-between">
                <span>Deliverable / Line Item</span>
                <span>Subtotal ({preview.currency})</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {preview.lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-0.5 max-w-[75%]">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.description && item.description !== item.name && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.description}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        Qty: {item.quantity} × {item.currency} {item.unitAmount}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">
                        {item.currency} {item.formattedSubtotal}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Row */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Total Due:
                </span>
                <span className="text-sm font-black text-indigo-600">
                  {preview.currency} {preview.totalAmount}
                </span>
              </div>
            </div>

            {/* Note field */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">
                Invoice Note to Client (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={isSending}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-900"
                placeholder="Add a friendly note or payment reference..."
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmAndSend}
            disabled={isLoadingPreview || isSending || !preview}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isSending ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                Sending to PayPal...
              </>
            ) : (
              <>Confirm & Send via PayPal ↗</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

