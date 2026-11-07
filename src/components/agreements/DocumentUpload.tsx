"use client";

import React, { useState, useRef } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

export interface UploadedDocument {
  id: string;
  fileName: string;
  mimeType: string;
  totalPages: number;
  totalCharacters: number;
  extractedTextPreview?: string;
}

interface DocumentUploadProps {
  projectId: string;
  onUploadSuccess: (document: UploadedDocument) => void;
}

export function DocumentUpload({ projectId, onUploadSuccess }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<UploadedDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setErrorMessage(null);
    setSuccessInfo(null);

    const validExtensions = [".pdf", ".txt", ".md"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!validExtensions.includes(ext)) {
      setErrorMessage("Please upload a PDF (.pdf) or text document (.txt, .md).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File exceeds the maximum 10 MB size limit.");
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setSuccessInfo(data.document);
      onUploadSuccess(data.document);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSampleAgreement = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    const sampleAgreementText = `
# MASTER SERVICES AGREEMENT & STATEMENT OF WORK
Client: Acme Digital Corp
Provider: Accordly Engineering
Effective Date: November 1, 2026

1. IN-SCOPE DELIVERABLES
- Deliverable 1: Modern responsive web portal built with Next.js and Tailwind CSS.
- Deliverable 2: RESTful API for inventory management with PostgreSQL database.
- Deliverable 3: User authentication system supporting standard email/password authentication.

2. SPECIFIC OUT-OF-SCOPE EXCLUSIONS
- Exclusion A: Mobile applications for iOS and Android native platforms.
- Exclusion B: Legacy ERP system data migration or custom enterprise connectors.
- Exclusion C: Third-party SAML 2.0 or enterprise SSO identity provider integration (e.g., Okta, Ping, Azure AD).

3. REVISION LIMITS
- Includes up to two (2) consolidated rounds of feedback and design revisions per deliverable.
- Any revision beyond two rounds shall be billed at the standard rate of $150/hour.

4. MILESTONES & ACCEPTANCE CRITERIA
- Milestone 1: UX Wireframes & Prototype delivered within 10 days of kick-off.
- Milestone 2: Final integrated deployment delivered within 30 days of kick-off.
- Acceptance Criteria: Client shall have 5 business days upon delivery to test and submit written approval.

5. PAYMENT TERMS & PRICING
- Total Project Price: $5,000 USD.
- Milestone 1 Deposit: 50% ($2,500 USD) due upon signing before commencement.
- Milestone 2 Final Payment: 50% ($2,500 USD) due upon final deliverable acceptance.
- Payment via PayPal Invoicing, Net 15 terms.
`.trim();

    const sampleFile = new File([sampleAgreementText], "sample-service-agreement.md", {
      type: "text/markdown",
    });

    processSelectedFile(sampleFile);

    const formData = new FormData();
    formData.append("file", sampleFile);

    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sample agreement.");

      setSuccessInfo(data.document);
      onUploadSuccess(data.document);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassCard intensity="prominent" className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h2 className="text-base font-bold text-[#F5F3ED]">Upload Project Agreement</h2>
          <p className="text-xs text-[#9298A3]">
            Upload the signed contract, statement of work, or agreement (PDF, TXT, MD up to 10MB).
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadSampleAgreement}
          disabled={isLoading}
          className="text-xs bg-white/[0.04] hover:bg-white/[0.08] text-[#D4AF65] hover:text-[#E2C17F] font-semibold py-1.5 px-3 rounded-xl border border-white/[0.08] transition-all shadow-sm active:scale-95"
        >
          Load Demo Agreement
        </button>
      </div>

      {/* Drag & Drop Area with Frosted Glass Surface */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-[#D4AF65] bg-[#D4AF65]/10 shadow-[0_0_24px_rgba(212,175,101,0.2)]"
            : "border-white/[0.08] hover:border-[#D4AF65]/40 bg-white/[0.02] hover:bg-white/[0.04]"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.txt,.md"
          className="hidden"
        />
        <svg
          className="mx-auto h-12 w-12 text-[#9298A3]"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v24a4 4 0 004 4h24a4 4 0 004-4V20L28 8z"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M28 8v12h12M18 28h12M18 34h8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <p className="mt-3 text-sm font-medium text-[#F5F3ED]">
          {selectedFile ? (
            <span className="text-[#D4AF65] font-semibold font-mono">{selectedFile.name}</span>
          ) : (
            <>
              <span className="text-[#D4AF65] hover:underline font-semibold">Click to upload</span> or drag and drop
            </>
          )}
        </p>
        <p className="text-xs text-[#9298A3] mt-1">
          PDF, Plain Text, or Markdown (Max 10 MB)
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-[#E06C75]/15 border border-[#E06C75]/30 rounded-xl text-xs text-[#E06C75] shadow-sm">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {selectedFile && !successInfo && (
        <div className="flex items-center justify-between bg-white/[0.03] p-3.5 rounded-xl border border-white/[0.08]">
          <div className="text-xs text-[#F5F3ED]">
            <span className="font-semibold text-[#F5F3ED] font-mono">{selectedFile.name}</span>{" "}
            <span className="text-[#9298A3] font-mono">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isLoading}
            className="bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] text-[#090A0C] text-xs font-bold py-1.5 px-4 rounded-xl transition-all disabled:opacity-50 shadow-sm active:scale-95"
          >
            {isLoading ? "Extracting Text..." : "Upload & Extract Text"}
          </button>
        </div>
      )}

      {successInfo && (
        <div className="p-4 bg-[#43B581]/10 border border-[#43B581]/30 rounded-xl space-y-2 shadow-sm">
          <div className="flex items-center text-[#43B581] font-semibold text-xs">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Agreement uploaded and text extracted successfully!
          </div>
          <div className="text-xs text-[#9298A3] grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-[#43B581]/20">
            <div>
              <strong className="text-[#F5F3ED]">File:</strong>{" "}
              <span className="font-mono text-[#F5F3ED]">{successInfo.fileName}</span>
            </div>
            <div>
              <strong className="text-[#F5F3ED]">Sections:</strong>{" "}
              <span className="font-mono text-[#F5F3ED]">{successInfo.totalPages}</span>
            </div>
            <div>
              <strong className="text-[#F5F3ED]">Characters:</strong>{" "}
              <span className="font-mono text-[#F5F3ED]">{successInfo.totalCharacters}</span>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
