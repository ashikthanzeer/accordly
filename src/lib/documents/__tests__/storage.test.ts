import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  getDocumentsStorageDir,
  storeDocument,
  getStoredDocumentPath,
  DocumentValidationError,
} from "../storage";

describe("Document Storage Service (src/lib/documents/storage.ts)", () => {
  const originalEnv = process.env;
  let tempStorageDir: string;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    tempStorageDir = path.resolve(os.tmpdir(), `accordly_test_storage_${Date.now()}`);
  });

  afterEach(async () => {
    process.env = originalEnv;
    try {
      await fs.rm(tempStorageDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("defaults to process.cwd()/uploads/documents when STORAGE_DIR is unset", () => {
    delete process.env.STORAGE_DIR;
    const dir = getDocumentsStorageDir();
    expect(dir).toBe(path.resolve(process.cwd(), "uploads", "documents"));
  });

  it("resolves to custom directory when STORAGE_DIR is set (Render Persistent Disk)", () => {
    process.env.STORAGE_DIR = tempStorageDir;
    const dir = getDocumentsStorageDir();
    expect(dir).toBe(tempStorageDir);
  });

  it("stores document inside the configured STORAGE_DIR", async () => {
    process.env.STORAGE_DIR = tempStorageDir;
    const buffer = Buffer.from("Agreement Contract Text Deliverables Scope Exclusions");

    const result = await storeDocument(buffer, "master_services_agreement.txt", "text/plain");

    expect(result.storageKey).toContain("master_services_agreement.txt");
    expect(result.absolutePath.startsWith(tempStorageDir)).toBe(true);

    const onDisk = await fs.readFile(result.absolutePath, "utf8");
    expect(onDisk).toBe("Agreement Contract Text Deliverables Scope Exclusions");

    const retrievedPath = getStoredDocumentPath(result.storageKey);
    expect(retrievedPath).toBe(result.absolutePath);
  });

  it("prevents directory traversal attacks via storage keys", () => {
    process.env.STORAGE_DIR = tempStorageDir;
    expect(() => getStoredDocumentPath("../../etc/passwd")).not.toThrow();
    // basename prevents traversal and keeps it within storage directory
    const resolved = getStoredDocumentPath("../../etc/passwd");
    expect(resolved.startsWith(tempStorageDir)).toBe(true);
  });
});

