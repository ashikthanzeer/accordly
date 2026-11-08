import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { NextRequest } from "next/server";
import {
  validateDocument,
  DocumentValidationError,
  DocumentSizeLimitError,
  UnsupportedDocumentTypeError,
} from "../storage";
import {
  toPureUint8Array,
  extractTextFromPdf,
  DocumentExtractionError,
} from "../extractor";
import { POST as handleUploadDocument } from "../../../app/api/projects/[id]/documents/route";
import { redactSecrets, extractPrismaCode } from "@/lib/logger";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: "usr_demo_provider",
    name: "Sarah Jenkins",
    email: "provider@accordly.local",
  }),
  unauthorizedResponse: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      upsert: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    document: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    projectEvent: {
      create: vi.fn(),
    },
  },
}));

/**
 * Builds a minimal valid 1-page PDF buffer containing the given text string.
 */
function buildMinimalPdfBuffer(text: string): Buffer {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const contentStream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objs = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += obj;
  }

  const xrefOffset = Buffer.byteLength(body, "utf8");
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, "utf8");
}

describe("PDF Buffer to Pure Uint8Array & Extraction (src/lib/documents/extractor.ts)", () => {
  it("converts a Node Buffer into a pure Uint8Array (not a Buffer instance)", () => {
    const nodeBuf = Buffer.from("%PDF-1.4 sample data");
    expect(Buffer.isBuffer(nodeBuf)).toBe(true);

    const pureUint8 = toPureUint8Array(nodeBuf);
    expect(pureUint8 instanceof Uint8Array).toBe(true);
    expect(Buffer.isBuffer(pureUint8)).toBe(false);
    expect(Object.getPrototypeOf(pureUint8)).toBe(Uint8Array.prototype);
  });

  it("extracts text from a valid PDF Node Buffer via unpdf without throwing Buffer type error", async () => {
    const pdfBuffer = buildMinimalPdfBuffer(
      "Master Services Agreement: Provider shall deliver responsive web application and PayPal invoicing."
    );

    const extracted = await extractTextFromPdf(pdfBuffer);
    expect(extracted.documentType).toBe("pdf");
    expect(extracted.totalPages).toBe(1);
    expect(extracted.rawText).toContain("Master Services Agreement");
    expect(extracted.pageChunks[0].pageNumber).toBe(1);
  });

  it("throws DocumentExtractionError (422) on corrupted PDF binary data", async () => {
    const brokenPdf = Buffer.from("%PDF-1.7\nCorrupted non-PDF binary body contents");
    await expect(extractTextFromPdf(brokenPdf)).rejects.toThrow(DocumentExtractionError);
  });
});

describe("Semantic Document Validation Errors (400, 413, 415)", () => {
  it("throws DocumentSizeLimitError (statusCode 413) for files > 10MB", () => {
    const huge = Buffer.alloc(10 * 1024 * 1024 + 1024);
    try {
      validateDocument(huge, "agreement.pdf", "application/pdf");
      expect.fail("Should have thrown DocumentSizeLimitError");
    } catch (err) {
      expect(err).toBeInstanceOf(DocumentValidationError);
      expect(err).toBeInstanceOf(DocumentSizeLimitError);
      expect((err as DocumentSizeLimitError).statusCode).toBe(413);
    }
  });

  it("throws UnsupportedDocumentTypeError (statusCode 415) for unsupported extensions", () => {
    const buf = Buffer.from("binary payload");
    try {
      validateDocument(buf, "archive.zip", "application/zip");
      expect.fail("Should have thrown UnsupportedDocumentTypeError");
    } catch (err) {
      expect(err).toBeInstanceOf(DocumentValidationError);
      expect(err).toBeInstanceOf(UnsupportedDocumentTypeError);
      expect((err as UnsupportedDocumentTypeError).statusCode).toBe(415);
    }
  });
});

describe("POST /api/projects/[id]/documents Route Handler", () => {
  const originalEnv = process.env;
  let tempStorageDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    tempStorageDir = path.resolve(os.tmpdir(), `accordly_upload_route_${Date.now()}`);
    process.env.STORAGE_DIR = tempStorageDir;
  });

  afterEach(async () => {
    process.env = originalEnv;
    try {
      await fs.rm(tempStorageDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("returns HTTP 404 when uploading to a non-existent project", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["Valid agreement text with deliverables and scope."], { type: "text/plain" }),
      "agreement.txt"
    );

    const req = new NextRequest("http://localhost:3000/api/projects/proj_missing/documents", {
      method: "POST",
      body: formData,
    });

    const res = await handleUploadDocument(req, {
      params: Promise.resolve({ id: "proj_missing" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("proj_missing");
    expect(data.correlationId).toMatch(/^req_/);
  });

  it("returns HTTP 201 and persists Document + ProjectEvent for a valid PDF agreement", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: "proj_1",
      name: "Web Redesign",
    } as any);

    vi.mocked(prisma.document.create).mockResolvedValueOnce({
      id: "doc_pdf_1",
      projectId: "proj_1",
      fileName: "agreement.pdf",
      mimeType: "application/pdf",
      extractionStatus: "READY",
      createdAt: new Date("2026-11-08T12:00:00Z"),
    } as any);

    vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({
      id: "evt_doc_1",
    } as any);

    const pdfBuffer = buildMinimalPdfBuffer(
      "Section 1 Scope of Work: Design and build 5 responsive landing pages and integrate PayPal Sandbox."
    );

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }),
      "agreement.pdf"
    );

    const req = new NextRequest("http://localhost:3000/api/projects/proj_1/documents", {
      method: "POST",
      body: formData,
    });

    const res = await handleUploadDocument(req, {
      params: Promise.resolve({ id: "proj_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.document.id).toBe("doc_pdf_1");
    expect(data.document.extractionStatus).toBe("READY");
    expect(data.document.totalPages).toBe(1);
    expect(data.document.extractedTextPreview).toContain("Scope of Work");
  });

  it("returns HTTP 415 for unsupported file type", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: "proj_1",
      name: "Web Redesign",
    } as any);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["binary content"], { type: "application/octet-stream" }),
      "malware.exe"
    );

    const req = new NextRequest("http://localhost:3000/api/projects/proj_1/documents", {
      method: "POST",
      body: formData,
    });

    const res = await handleUploadDocument(req, {
      params: Promise.resolve({ id: "proj_1" }),
    });
    expect(res.status).toBe(415);
  });

  it("returns HTTP 422 when document has insufficient extractable text", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: "proj_1",
      name: "Web Redesign",
    } as any);

    vi.mocked(prisma.document.create).mockResolvedValueOnce({
      id: "doc_failed_1",
      extractionStatus: "FAILED",
    } as any);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["Too short"], { type: "text/plain" }),
      "tiny.txt"
    );

    const req = new NextRequest("http://localhost:3000/api/projects/proj_1/documents", {
      method: "POST",
      body: formData,
    });

    const res = await handleUploadDocument(req, {
      params: Promise.resolve({ id: "proj_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.documentId).toBe("doc_failed_1");
  });
});

describe("Secret-Safe Diagnostic Logger (src/lib/logger.ts)", () => {
  it("redacts PostgreSQL URLs, Gemini keys, OpenAI keys, and Bearer tokens", () => {
    const raw =
      "Failed connecting to postgresql://neondb_owner:secret123@ep-pooler.aws.neon.tech/neondb with key=AIzaSyD1234567890123456789012345 and Bearer eyJhbGciOiJIUzI1NiJ9.token and sk-proj12345678901234567890";
    const cleaned = redactSecrets(raw);

    expect(cleaned).not.toContain("secret123");
    expect(cleaned).not.toContain("AIzaSyD1234567890123456789012345");
    expect(cleaned).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(cleaned).not.toContain("sk-proj12345678901234567890");
    expect(cleaned).toContain("[REDACTED_DB_URL]");
  });

  it("extracts Prisma error codes safely", () => {
    expect(extractPrismaCode({ code: "P2002", message: "Unique constraint" })).toBe("P2002");
    expect(extractPrismaCode(new Error("Normal error"))).toBeUndefined();
  });
});

