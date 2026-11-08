/**
 * Secure document validation and private storage service with writable directory fallback.
 */

import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
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
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(`[DocumentValidationError] ${message}`);
    this.name = "DocumentValidationError";
    this.statusCode = statusCode;
  }
}

export class DocumentSizeLimitError extends DocumentValidationError {
  constructor(message: string) {
    super(message, 413);
    this.name = "DocumentSizeLimitError";
  }
}

export class UnsupportedDocumentTypeError extends DocumentValidationError {
  constructor(message: string) {
    super(message, 415);
    this.name = "UnsupportedDocumentTypeError";
  }
}

export class DocumentStorageError extends Error {
  public readonly statusCode = 503;

  constructor(message: string, public readonly causeError?: unknown) {
    super(`[DocumentStorageError] ${message}`);
    this.name = "DocumentStorageError";
  }
}

export interface StoredDocumentResult {
  storageKey: string;
  absolutePath: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  usedFallbackStorage?: boolean;
}

let lastResolvedStorageDir: string | null = null;

/**
 * Returns the configured primary storage directory for uploaded documents.
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
 * Resolves a writable directory for document storage, falling back safely if
 * STORAGE_DIR (such as /var/data/uploads without a mounted Render disk) is not writable.
 */
export async function resolveWritableStorageDir(): Promise<{
  storageDir: string;
  usedFallback: boolean;
}> {
  const candidates: string[] = [];
  const customDir = process.env.STORAGE_DIR?.trim();
  if (customDir) {
    candidates.push(path.resolve(customDir));
  }

  const localUploadsDir = path.resolve(process.cwd(), "uploads", "documents");
  if (!candidates.includes(localUploadsDir)) {
    candidates.push(localUploadsDir);
  }

  const tempUploadsDir = path.resolve(os.tmpdir(), "accordly-uploads");
  if (!candidates.includes(tempUploadsDir)) {
    candidates.push(tempUploadsDir);
  }

  let lastErr: unknown = null;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      await fs.mkdir(candidate, { recursive: true });
      await fs.access(candidate, fsConstants.W_OK);
      lastResolvedStorageDir = candidate;
      return {
        storageDir: candidate,
        usedFallback: i > 0,
      };
    } catch (err: unknown) {
      lastErr = err;
    }
  }

  throw new DocumentStorageError(
    `Document storage is unavailable: no writable directory could be initialized (${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }).`,
    lastErr
  );
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
    throw new DocumentValidationError("Uploaded document is empty (0 bytes).", 400);
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    throw new DocumentSizeLimitError(
      `File size (${sizeMb} MB) exceeds maximum allowed limit of 10 MB.`
    );
  }

  const sanitizedName = sanitizeFileName(fileName);
  const ext = path.extname(sanitizedName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new UnsupportedDocumentTypeError(
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
    throw new UnsupportedDocumentTypeError(
      `Unsupported MIME type "${mimeType}". Allowed formats are PDF and plain text.`
    );
  }

  // Magic bytes verification for PDF
  if (mimeType === "application/pdf" || ext === ".pdf") {
    if (fileBuffer.length < 5 || !fileBuffer.subarray(0, 5).equals(PDF_MAGIC_BYTES)) {
      throw new DocumentValidationError(
        "File signature verification failed: file is not a valid PDF document.",
        400
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

  const { storageDir, usedFallback } = await resolveWritableStorageDir();

  const uniqueId = crypto.randomUUID();
  const storageKey = `${uniqueId}_${sanitizedName}`;
  const targetPath = path.resolve(storageDir, storageKey);

  // Path traversal guard
  if (!targetPath.startsWith(storageDir)) {
    throw new DocumentValidationError("Illegal file path detected.", 400);
  }

  try {
    await fs.writeFile(targetPath, fileBuffer);
  } catch (err: unknown) {
    throw new DocumentStorageError(
      `Failed to write uploaded document to storage: ${
        err instanceof Error ? err.message : String(err)
      }`,
      err
    );
  }

  return {
    storageKey,
    absolutePath: targetPath,
    originalFileName: sanitizedName,
    mimeType,
    sizeBytes: fileBuffer.length,
    usedFallbackStorage: usedFallback,
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
    throw new DocumentValidationError("Illegal document storage key.", 400);
  }

  return resolved;
}

/**
 * Safely deletes a stored file from disk when downstream processing or DB persistence fails.
 */
export async function removeStoredDocument(absolutePathOrKey: string): Promise<void> {
  if (!absolutePathOrKey) return;
  try {
    const targetPath = path.isAbsolute(absolutePathOrKey)
      ? absolutePathOrKey
      : path.resolve(lastResolvedStorageDir || getDocumentsStorageDir(), path.basename(absolutePathOrKey));
    await fs.unlink(targetPath);
  } catch {
    // Ignore ENOENT or cleanup errors so the primary error is preserved
  }
}
