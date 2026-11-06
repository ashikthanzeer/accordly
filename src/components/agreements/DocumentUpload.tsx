"use client";

import React, { useState, useRef } from "react";

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
      setErrorMessage("File exceeds maximum allowed size of 10 MB.");
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

    const sampleAgreementText = `
# SERVICE AGREEMENT: E-COMMERCE & CLIENT PORTAL REDESIGN
Effective Date: November 10, 2026
Between: Digital Craft Studio ("Provider") and Acme Corp ("Client")

1. SCOPE OF WORK & DELIVERABLES
Provider agrees to deliver:
- DEL-1: High-fidelity desktop and mobile website templates in React & Tailwind CSS.
- DEL-2: PayPal Sandbox checkout and invoicing workflow integration.
- DEL-3: Client review portal with versioned document confirmation.

2. EXCLUSIONS
- Custom video production and 3D animation assets are explicitly excluded.
- Content writing and product copywriting are excluded; client provides all final copy.

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
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Upload Project Agreement</h2>
          <p className="text-sm text-slate-500">
            Upload the signed contract, statement of work, or agreement (PDF, TXT, MD up to 10MB).
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadSampleAgreement}
          disabled={isLoading}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-3 rounded border border-slate-300 transition"
        >
          Load Demo Agreement
        </button>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 hover:border-slate-400 bg-slate-50"
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
          className="mx-auto h-12 w-12 text-slate-400"
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

        <p className="mt-2 text-sm font-medium text-slate-700">
          {selectedFile ? (
            <span className="text-blue-600 font-semibold">{selectedFile.name}</span>
          ) : (
            <>
              <span className="text-blue-600 hover:underline">Click to upload</span> or drag and drop
            </>
          )}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          PDF, Plain Text, or Markdown (Max 10 MB)
        </p>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {selectedFile && !successInfo && (
        <div className="mt-4 flex items-center justify-between bg-slate-50 p-3 rounded border border-slate-200">
          <div className="text-sm">
            <span className="font-medium text-slate-800">{selectedFile.name}</span>{" "}
            <span className="text-slate-500">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded transition disabled:opacity-50"
          >
            {isLoading ? "Extracting Text..." : "Upload & Extract Text"}
          </button>
        </div>
      )}

      {successInfo && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center text-emerald-800 font-medium text-sm">
            <svg className="w-5 h-5 mr-2 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Agreement uploaded and text extracted successfully!
          </div>
          <div className="mt-2 text-xs text-emerald-700 grid grid-cols-3 gap-2">
            <div>
              <strong>File:</strong> {successInfo.fileName}
            </div>
            <div>
              <strong>Sections/Pages:</strong> {successInfo.totalPages}
            </div>
            <div>
              <strong>Characters:</strong> {successInfo.totalCharacters}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

