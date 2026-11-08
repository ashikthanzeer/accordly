/**
 * Document text extraction engine.
 *
 * Extracts text from PDF and plain-text agreements, preserving page numbers
 * and section boundaries for source citations and evidence grounding.
 */

import fs from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";

export class DocumentExtractionError extends Error {
  public readonly statusCode = 422;

  constructor(message: string) {
    super(`[DocumentExtractionError] ${message}`);
    this.name = "DocumentExtractionError";
  }
}

export interface DocumentPageChunk {
  pageNumber: number; // 1-indexed
  text: string;
}

export interface ExtractedDocumentResult {
  rawText: string;
  pageChunks: DocumentPageChunk[];
  totalPages: number;
  totalCharacters: number;
  documentType: "pdf" | "text";
}

const MIN_CHARACTERS_REQUIRED = 20;

/**
 * Converts a Node.js Buffer or Uint8Array into a standalone pure Uint8Array
 * backed by an independent ArrayBuffer (required by unpdf / pdfjs-dist, which
 * rejects Node Buffer instances even though Buffer extends Uint8Array).
 */
export function toPureUint8Array(input: Buffer | Uint8Array): Uint8Array {
  const view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return view.slice();
}

/**
 * Extracts text from a PDF buffer, preserving page numbers.
 */
export async function extractTextFromPdf(
  buffer: Buffer | Uint8Array
): Promise<ExtractedDocumentResult> {
  const uint8 = toPureUint8Array(buffer);

  let totalPages: number;
  let pageTexts: string[];
  try {
    const pdfProxy = await getDocumentProxy(uint8);
    const extracted = await extractText(pdfProxy, {
      mergePages: false,
    });
    totalPages = extracted.totalPages;
    pageTexts = Array.isArray(extracted.text)
      ? extracted.text
      : [String(extracted.text ?? "")];
  } catch (err: unknown) {
    if (err instanceof DocumentExtractionError) {
      throw err;
    }
    throw new DocumentExtractionError(
      `Failed to parse PDF document structure: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const pageChunks: DocumentPageChunk[] = [];
  const textParts: string[] = [];

  pageTexts.forEach((pageText, idx) => {
    const pageNum = idx + 1;
    const cleanText = pageText.trim();
    pageChunks.push({
      pageNumber: pageNum,
      text: cleanText,
    });

    if (cleanText) {
      textParts.push(`--- [Page ${pageNum}] ---\n${cleanText}`);
    }
  });

  const fullText = textParts.join("\n\n");
  const totalChars = fullText.replace(/\s+/g, "").length;

  if (totalChars < MIN_CHARACTERS_REQUIRED) {
    throw new DocumentExtractionError(
      "The uploaded PDF contains insufficient extractable text (< 20 characters). The document may be a scanned image or password-protected. Please provide a searchable PDF or text agreement."
    );
  }

  return {
    rawText: fullText,
    pageChunks,
    totalPages,
    totalCharacters: fullText.length,
    documentType: "pdf",
  };
}

/**
 * Extracts text from a plain text or markdown agreement.
 */
export function extractTextFromPlainText(
  buffer: Buffer
): ExtractedDocumentResult {
  const rawContent = buffer.toString("utf-8").trim();
  const totalChars = rawContent.replace(/\s+/g, "").length;

  if (totalChars < MIN_CHARACTERS_REQUIRED) {
    throw new DocumentExtractionError(
      "The uploaded document contains insufficient text (< 20 characters). Please provide a complete agreement."
    );
  }

  // Segment by markdown headings or double newlines into logical chunks
  const sections = rawContent.split(/\n(?=#{1,3}\s|[A-Z0-9\s]{4,}:)/g);
  const pageChunks: DocumentPageChunk[] = sections.map((sec, idx) => ({
    pageNumber: idx + 1,
    text: sec.trim(),
  }));

  const formattedParts = pageChunks.map(
    (chunk) => `--- [Section ${chunk.pageNumber}] ---\n${chunk.text}`
  );

  return {
    rawText: formattedParts.join("\n\n"),
    pageChunks,
    totalPages: pageChunks.length,
    totalCharacters: rawContent.length,
    documentType: "text",
  };
}

/**
 * Extracts text from a file buffer based on MIME type or filename.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedDocumentResult> {
  const normMime = mimeType.toLowerCase();

  if (normMime === "application/pdf") {
    return extractTextFromPdf(buffer);
  }

  if (normMime.includes("text/") || normMime.includes("markdown")) {
    return extractTextFromPlainText(buffer);
  }

  // Fallback check on PDF header bytes
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("utf-8") === "%PDF-") {
    return extractTextFromPdf(buffer);
  }

  return extractTextFromPlainText(buffer);
}

/**
 * Convenience method to extract text from a file on disk.
 */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<ExtractedDocumentResult> {
  const buffer = await fs.readFile(filePath);
  return extractDocumentText(buffer, mimeType);
}
