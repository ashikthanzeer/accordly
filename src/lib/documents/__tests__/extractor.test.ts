import { describe, it, expect } from "vitest";
import {
  validateDocument,
  DocumentValidationError,
  getStoredDocumentPath,
} from "../storage";
import {
  extractTextFromPlainText,
  DocumentExtractionError,
} from "../extractor";

describe("Document Storage & Validation", () => {
  it("validates a plain text agreement buffer", () => {
    const textBuffer = Buffer.from(
      "This is a legally binding client services agreement for web development services."
    );
    const result = validateDocument(textBuffer, "contract.txt", "text/plain");

    expect(result.mimeType).toBe("text/plain");
    expect(result.sanitizedName).toBe("contract.txt");
  });

  it("validates a markdown agreement buffer", () => {
    const mdBuffer = Buffer.from("# Statement of Work\nDeliverables: Website redesign.");
    const result = validateDocument(mdBuffer, "sow.md", "text/markdown");

    expect(result.mimeType).toBe("text/markdown");
    expect(result.sanitizedName).toBe("sow.md");
  });

  it("verifies PDF magic bytes %PDF-", () => {
    const fakePdfBuffer = Buffer.from("Not a real PDF file");
    expect(() =>
      validateDocument(fakePdfBuffer, "fake.pdf", "application/pdf")
    ).toThrow(DocumentValidationError);

    const validHeaderPdf = Buffer.from("%PDF-1.7\nSample PDF body content here for testing.");
    const result = validateDocument(validHeaderPdf, "valid.pdf", "application/pdf");
    expect(result.mimeType).toBe("application/pdf");
  });

  it("rejects empty documents", () => {
    expect(() => validateDocument(Buffer.alloc(0), "empty.txt")).toThrow(
      DocumentValidationError
    );
  });

  it("rejects oversized documents (> 10MB)", () => {
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    expect(() => validateDocument(oversizedBuffer, "large.txt")).toThrow(
      /exceeds maximum allowed limit of 10 MB/
    );
  });

  it("rejects unsupported file formats", () => {
    const exeBuffer = Buffer.from("binary executable contents");
    expect(() => validateDocument(exeBuffer, "malicious.exe")).toThrow(
      DocumentValidationError
    );
  });

  it("strips path traversal attacks in storage key resolution", () => {
    const resolved = getStoredDocumentPath("../../../../etc/passwd");
    expect(resolved).not.toContain("..");
    expect(resolved).toContain("passwd");
  });
});

describe("Document Text Extraction", () => {
  it("extracts text and sections from plain text agreements", () => {
    const content = `
# Section 1: Overview
Agreement between Provider and Client.

# Section 2: Deliverables
1. Responsive Website
2. Payment Integration
`.trim();

    const result = extractTextFromPlainText(Buffer.from(content));

    expect(result.documentType).toBe("text");
    expect(result.totalPages).toBeGreaterThan(0);
    expect(result.rawText).toContain("Section 1: Overview");
    expect(result.rawText).toContain("Section 2: Deliverables");
    expect(result.totalCharacters).toBe(content.length);
  });

  it("rejects documents with insufficient characters (< 20 chars)", () => {
    const tinyContent = "Short text";
    expect(() => extractTextFromPlainText(Buffer.from(tinyContent))).toThrow(
      DocumentExtractionError
    );
  });
});

