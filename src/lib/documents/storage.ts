/**
 * Secure document validation and private storage service.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

export const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".md"]);

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(`[DocumentValidationError] ${message}`);
    this.name = "DocumentValidationError";
  }
}

export interface StoredDocumentResult {
  storageKey: string;
  absolutePath: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Returns the base storage directory for uploaded documents.
 * Respects STORAGE_DIR (e.g. Render Persistent Disk mounted at /var/data/uploads)
 * with a fallback to local uploads/documents in development.
 */
export function getDocumentsStorageDir(): string {
  const customDir = process.env.STORAGE_DIR?.trim();
  if (customDir) {
    return path.resolve(customDir);
  }
  return path.resolve(process.cwd(), "uploads", "documents");
}

/**
 * Sanitizes a filename, stripping directory traversal characters and unsafe symbols.
 */
export function sanitizeFileName(rawFileName: string): string {
  const base = path.basename(rawFileName);
  // Remove control characters, slashes, backslashes, colons, etc.
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return clean || "document";
}

/**
 * Validates document buffer, size, MIME type, and signatures.
 */
export function validateDocument(
  fileBuffer: Buffer,
  fileName: string,
  declaredMimeType?: string
): { mimeType: string; sanitizedName: string } {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new DocumentValidationError("Uploaded document is empty (0 bytes).");
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    throw new DocumentValidationError(
      `File size (${sizeMb} MB) exceeds maximum allowed limit of 10 MB.`
    );
  }

  const sanitizedName = sanitizeFileName(fileName);
  const ext = path.extname(sanitizedName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new DocumentValidationError(
      `Unsupported file extension "${ext}". Allowed formats are: .pdf, .txt, .md`
    );
  }

  let mimeType = declaredMimeType?.toLowerCase().trim() || "";
  if (!mimeType || mimeType === "application/octet-stream") {
    if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".txt") mimeType = "text/plain";
    else if (ext === ".md") mimeType = "text/markdown";
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new DocumentValidationError(
      `Unsupported MIME type "${mimeType}". Allowed formats are PDF and plain text.`
    );
  }

  // Magic bytes verification for PDF
  if (mimeType === "application/pdf" || ext === ".pdf") {
    if (fileBuffer.length < 5 || !fileBuffer.subarray(0, 5).equals(PDF_MAGIC_BYTES)) {
      throw new DocumentValidationError(
        "File signature verification failed: file is not a valid PDF document."
      );
    }
  }

  return { mimeType, sanitizedName };
}

/**
 * Securely writes an uploaded document to private storage.
 */
export async function storeDocument(
  fileBuffer: Buffer,
  fileName: string,
  declaredMimeType?: string
): Promise<StoredDocumentResult> {
  const { mimeType, sanitizedName } = validateDocument(
    fileBuffer,
    fileName,
    declaredMimeType
  );

  const storageDir = getDocumentsStorageDir();
  await fs.mkdir(storageDir, { recursive: true });

  const uniqueId = crypto.randomUUID();
  const storageKey = `${uniqueId}_${sanitizedName}`;
  const targetPath = path.resolve(storageDir, storageKey);

  // Path traversal guard
  if (!targetPath.startsWith(storageDir)) {
    throw new DocumentValidationError("Illegal file path detected.");
  }

  await fs.writeFile(targetPath, fileBuffer);

  return {
    storageKey,
    absolutePath: targetPath,
    originalFileName: sanitizedName,
    mimeType,
    sizeBytes: fileBuffer.length,
  };
}

/**
 * Retrieves the local absolute path for a stored document by key, validating against path traversal.
 */
export function getStoredDocumentPath(storageKey: string): string {
  const cleanKey = path.basename(storageKey);
  const storageDir = getDocumentsStorageDir();
  const resolved = path.resolve(storageDir, cleanKey);

  if (!resolved.startsWith(storageDir)) {
    throw new DocumentValidationError("Illegal document storage key.");
  }

  return resolved;
}

