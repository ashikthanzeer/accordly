"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { DocumentUpload, type UploadedDocument } from "@/components/agreements/DocumentUpload";
import { ScopeBaselineReview } from "@/components/baseline/ScopeBaselineReview";
import { GlassCard } from "@/components/ui/GlassCard";
import type { StructuredScopeBaseline } from "@/lib/ai/schema";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectBaselinePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const [draftBaseline, setDraftBaseline] = useState<StructuredScopeBaseline | null>(null);
  const [confirmedBaseline, setConfirmedBaseline] = useState<any | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractionMeta, setExtractionMeta] = useState<{
    provider?: string;
    model?: string;
    isMock?: boolean;
  }>({});

  // Fetch initial baseline status on load
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`/api/projects/${projectId}/baseline`);
        const data = await res.json();
        if (data.hasConfirmedBaseline && data.baseline) {
          setConfirmedBaseline(data.baseline);
        }
      } catch (err) {
        console.error("Error loading baseline status:", err);
      }
    }
    loadStatus();
  }, [projectId]);

  const handleDocumentUploaded = (doc: UploadedDocument) => {
    setUploadedDoc(doc);
    setErrorMsg(null);
  };

  const handleTriggerExtraction = async () => {
    setIsExtracting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/baseline/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: uploadedDoc?.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Scope extraction failed.");
      }

      setDraftBaseline(data.baseline);
      setExtractionMeta(data.metadata || {});
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmBaseline = async () => {
    if (!draftBaseline) return;

    setIsConfirming(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/baseline/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: uploadedDoc?.id,
          structuredScope: draftBaseline,
          confirmedBy: "Project Provider",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Confirmation failed.");
      }

      setConfirmedBaseline(data.baseline);
      setDraftBaseline(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConfirming(false);
    }
  };

  const quickNavActions = (
    <div className="flex items-center gap-2">
      <Link
        href={`/projects/${projectId}/requests`}
        className="text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
      >
        Requests
      </Link>
      <Link
        href={`/projects/${projectId}/proposals`}
        className="text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
      >
        Proposals
      </Link>
      <Link
        href={`/projects/${projectId}/timeline`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4AF65] hover:text-[#E2C17F] px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
      >
        <span>⏱️</span> Timeline
      </Link>
    </div>
  );

  return (
    <AppShell
      projectId={projectId}
      projectName={`Project: ${projectId}`}
      breadcrumbs={[
        { label: `Project: ${projectId}`, href: `/projects/${projectId}/baseline` },
        { label: "Scope Baseline", active: true },
      ]}
      actions={quickNavActions}
    >
      <div className="space-y-8">
        {/* Title Header */}
        <GlassCard intensity="prominent" className="p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-[#D4AF65] uppercase font-mono">
                  AGREEMENT INGESTION & BASELINE
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#43B581] animate-pulse" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#F5F3ED] mt-1">
                Contract Baseline & Extraction
              </h1>
              <p className="text-xs text-[#9298A3] mt-1">
                Upload the original signed agreement to extract and confirm the foundational scope baseline.
              </p>
            </div>

            <div className="shrink-0 self-start md:self-auto">
              {confirmedBaseline ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#43B581] bg-[#43B581]/15 px-3 py-1.5 rounded-xl border border-[#43B581]/30 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#43B581]" />
                  Baseline v{confirmedBaseline.version || 1} Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E5B45C] bg-[#E5B45C]/15 px-3 py-1.5 rounded-xl border border-[#E5B45C]/30 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5B45C]" />
                  Baseline Pending
                </span>
              )}
            </div>
          </div>
        </GlassCard>

        {errorMsg && (
          <div className="p-4 bg-[#E06C75]/15 border border-[#E06C75]/30 rounded-xl text-xs text-[#E06C75] shadow-sm">
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {/* Step 1: Upload Agreement */}
        <section>
          <DocumentUpload projectId={projectId} onUploadSuccess={handleDocumentUploaded} />
        </section>

        {/* Step 2: Trigger AI Extraction CTA */}
        {uploadedDoc && !draftBaseline && !confirmedBaseline && (
          <GlassCard intensity="prominent" className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-[#D4AF65]/40">
            <div>
              <h3 className="text-sm font-bold text-[#F5F3ED]">
                Extract Scope Baseline with AI
              </h3>
              <p className="text-xs text-[#9298A3] mt-0.5">
                Analyze &ldquo;{uploadedDoc.fileName}&rdquo; to extract deliverables, exclusions, revisions, and payment terms with citations.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTriggerExtraction}
              disabled={isExtracting}
              className="bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] text-[#090A0C] font-bold text-xs py-2 px-6 rounded-xl shadow-sm transition-all disabled:opacity-50 whitespace-nowrap active:scale-95"
            >
              {isExtracting ? "Extracting Scope with AI..." : "Extract Scope Baseline"}
            </button>
          </GlassCard>
        )}

        {/* Step 3: Review & Edit Draft Scope Baseline */}
        {draftBaseline && (
          <section className="space-y-6">
            <ScopeBaselineReview
              baseline={draftBaseline}
              onChange={(updated) => setDraftBaseline(updated)}
              isConfirmed={false}
              metadata={extractionMeta}
            />

            <GlassCard intensity="prominent" className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-[#F5F3ED]">Confirm Baseline v1</h4>
                <p className="text-xs text-[#9298A3]">
                  Locking this baseline will establish the official contractual benchmark for all future change requests.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConfirmBaseline}
                disabled={isConfirming}
                className="bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] text-[#090A0C] font-bold text-xs py-2.5 px-6 rounded-xl shadow-sm transition-all disabled:opacity-50 whitespace-nowrap active:scale-95"
              >
                {isConfirming ? "Confirming..." : "Confirm & Lock Baseline"}
              </button>
            </GlassCard>
          </section>
        )}

        {/* Step 4: Confirmed Active Scope Baseline View */}
        {confirmedBaseline && !draftBaseline && (
          <section className="space-y-4">
            <ScopeBaselineReview
              baseline={confirmedBaseline.structuredScope}
              onChange={() => {}}
              isConfirmed={true}
              version={confirmedBaseline.version}
              confirmedAt={confirmedBaseline.confirmedAt}
            />

            <div className="flex justify-end pt-2">
              <Link
                href={`/projects/${projectId}/requests`}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] transition-all shadow-sm active:scale-95"
              >
                <span>Proceed to Scope Intelligence & Requests</span>
                <span>→</span>
              </Link>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
