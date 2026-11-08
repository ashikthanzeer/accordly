"use client";

import React, { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ProjectFinancialSummary } from "@/lib/projects/schema";

interface ArchiveProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  initialFinancialSummary?: ProjectFinancialSummary | null;
  onArchived?: () => void;
}

export function ArchiveProjectModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  initialFinancialSummary,
  onArchived,
}: ArchiveProjectModalProps) {
  const [financialSummary, setFinancialSummary] = useState<ProjectFinancialSummary | null>(
    initialFinancialSummary || null
  );
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsSubmitting(false);
      return;
    }

    if (!initialFinancialSummary) {
      setIsLoadingSummary(true);
      fetch(`/api/projects/${projectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.financialSummary) {
            setFinancialSummary(data.financialSummary);
          }
        })
        .catch((err) => {
          console.error("Failed to load project financial summary:", err);
        })
        .finally(() => {
          setIsLoadingSummary(false);
        });
    } else {
      setFinancialSummary(initialFinancialSummary);
    }
  }, [isOpen, projectId, initialFinancialSummary]);

  if (!isOpen) return null;

  const hasPaymentActivity = financialSummary?.hasPaymentActivity ?? false;

  const handleArchive = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to archive project.");
      }

      onClose();
      if (onArchived) {
        onArchived();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-lg">
        <GlassCard intensity="prominent" className="p-6 sm:p-8 space-y-6 border-white/[0.12] shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF65] font-mono block">
                PROJECT LIFECYCLE MANAGEMENT
              </span>
              <h2 id="archive-modal-title" className="text-lg sm:text-xl font-bold text-[#F5F3ED]">
                Archive Project
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-[#9298A3] hover:text-[#F5F3ED] transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>

          {/* Project Details */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1">
            <span className="text-[11px] text-[#9298A3] uppercase tracking-wider font-mono">Target Engagement</span>
            <p className="text-sm font-bold text-[#F5F3ED] break-words">{projectName}</p>
          </div>

          {/* Loading financial check */}
          {isLoadingSummary && (
            <div className="py-2 text-center text-xs text-[#9298A3] flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-[#D4AF65]/30 border-t-[#D4AF65] animate-spin" />
              <span>Verifying persisted payment and invoice records...</span>
            </div>
          )}

          {/* Warning Block */}
          {!isLoadingSummary && (
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                hasPaymentActivity
                  ? "bg-[#D4AF65]/10 border-[#D4AF65]/30"
                  : "bg-white/[0.03] border-white/[0.08]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base select-none">{hasPaymentActivity ? "🛡️" : "📦"}</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5F3ED]">
                  {hasPaymentActivity
                    ? "Financial Preservation Notice"
                    : "Active Workspace Archive Notice"}
                </h3>
              </div>

              {hasPaymentActivity ? (
                <p className="text-xs text-[#F5F3ED] leading-relaxed">
                  <strong>This project has recorded financial activity.</strong> Archiving will preserve its invoices,
                  payments, reconciliation history, agreements, proposals, and audit trail. No financial records will be
                  deleted or modified.
                </p>
              ) : (
                <p className="text-xs text-[#9298A3] leading-relaxed">
                  This project has no recorded payments. Archiving will remove it from your active workspace while
                  retaining all original agreement documents, confirmed scope baselines, proposals, and timeline events
                  indefinitely.
                </p>
              )}

              {/* Financial metrics summary if present */}
              {financialSummary && financialSummary.currencies.length > 0 && (
                <div className="pt-2 border-t border-white/[0.08] flex flex-wrap gap-2 text-[11px] font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-[#9298A3]">
                    Invoiced:{" "}
                    <strong className="text-[#F5F3ED]">{financialSummary.formattedTotalInvoiced}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-[#43B581]">
                    Collected:{" "}
                    <strong className="text-[#43B581]">{financialSummary.formattedTotalCollected}</strong>
                  </span>
                  {financialSummary.totalOutstanding > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-[#E5B45C]/30 text-[#E5B45C]">
                      Outstanding:{" "}
                      <strong className="text-[#E5B45C]">{financialSummary.formattedTotalOutstanding}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-[#E06C75]/15 border border-[#E06C75]/30 rounded-xl text-xs text-[#E06C75]">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
            >
              Keep in Active Workspace
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={isSubmitting || isLoadingSummary}
              className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] transition-all disabled:opacity-50 active:scale-95 shadow-sm"
            >
              {isSubmitting ? "Archiving Project..." : "Archive Project"}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

