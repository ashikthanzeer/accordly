"use client";

import React, { useEffect, useState, use } from "react";
import { DocumentUpload, type UploadedDocument } from "@/components/agreements/DocumentUpload";
import { ScopeBaselineReview } from "@/components/baseline/ScopeBaselineReview";
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-slate-500">
        <a href="/" className="hover:text-blue-600 transition">
          Accordly Dashboard
        </a>
        <span>/</span>
        <span className="text-slate-800 font-medium">Project Scope Baseline</span>
      </nav>

      <div className="border-b border-slate-200 pb-5 flex flex-wrap items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Agreement Ingestion & Scope Baseline
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Upload the original signed agreement to extract and confirm the foundational scope baseline.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {/* Step 1: Upload Agreement */}
      <section>
        <DocumentUpload projectId={projectId} onUploadSuccess={handleDocumentUploaded} />
      </section>

      {/* Step 2: Trigger AI Extraction CTA */}
      {uploadedDoc && !draftBaseline && !confirmedBaseline && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-blue-900">
              Extract Scope Baseline with AI
            </h3>
            <p className="text-sm text-blue-700 mt-0.5">
              Analyze &ldquo;{uploadedDoc.fileName}&rdquo; to extract deliverables, exclusions, revisions, and payment terms with citations.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTriggerExtraction}
            disabled={isExtracting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md shadow-sm transition disabled:opacity-50 whitespace-nowrap"
          >
            {isExtracting ? "Extracting Scope with AI..." : "Extract Scope Baseline"}
          </button>
        </div>
      )}

      {/* Step 3: Interactive Review & Editing */}
      {draftBaseline && (
        <section className="space-y-6">
          <ScopeBaselineReview
            baseline={draftBaseline}
            onChange={setDraftBaseline}
            isConfirmed={false}
            metadata={extractionMeta}
          />

          {/* Explicit Confirmation Action Bar */}
          <div className="bg-slate-900 text-white rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
            <div>
              <h4 className="font-semibold text-white">Ready to finalize contract scope?</h4>
              <p className="text-sm text-slate-300">
                Confirming establishes this as the immutable baseline for future change requests and invoices.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConfirmBaseline}
              disabled={isConfirming}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-md transition shadow disabled:opacity-50"
            >
              {isConfirming ? "Confirming..." : "Confirm Scope Baseline ✓"}
            </button>
          </div>
        </section>
      )}

      {/* Step 4: Confirmed State Display */}
      {confirmedBaseline && (
        <section className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-700 font-bold text-lg">✓</span>
              <div>
                <h3 className="font-semibold text-emerald-900">
                  Authoritative Baseline Confirmed (Version {confirmedBaseline.version})
                </h3>
                <p className="text-xs text-emerald-700">
                  Confirmed by {confirmedBaseline.confirmedBy} on{" "}
                  {new Date(confirmedBaseline.confirmedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <ScopeBaselineReview
            baseline={confirmedBaseline.structuredScope}
            onChange={() => {}}
            isConfirmed={true}
            version={confirmedBaseline.version}
            confirmedAt={confirmedBaseline.confirmedAt}
          />
        </section>
      )}
    </div>
  );
}

