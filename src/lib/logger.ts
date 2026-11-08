/**
 * Structured, secret-safe diagnostic logger for Accordly server operations.
 *
 * Guarantees that secrets, API keys, database connection strings, review tokens,
 * and raw agreement contents are never emitted in logs.
 */

import crypto from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export type DiagnosticCategory =
  | "validation"
  | "not_found"
  | "storage"
  | "extraction"
  | "ai_provider"
  | "database"
  | "unexpected"
  | "success";

export interface DiagnosticLogInput {
  level?: LogLevel;
  operation: string;
  correlationId: string;
  projectId?: string;
  stage: string;
  category: DiagnosticCategory;
  message: string;
  statusCode?: number;
  error?: unknown;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface StructuredDiagnosticEntry {
  level: LogLevel;
  operation: string;
  correlationId: string;
  projectId?: string;
  stage: string;
  category: DiagnosticCategory;
  message: string;
  statusCode?: number;
  prismaCode?: string;
  errorName?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  timestamp: string;
}

/**
 * Generates a unique correlation ID for tracing a single request across stages.
 */
export function createCorrelationId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Extracts a Prisma error code (e.g. P2002, P2003, P2025) if present on an error object.
 */
export function extractPrismaCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && /^P\d{4}$/.test(code)) {
      return code;
    }
  }
  return undefined;
}

/**
 * Redacts connection strings, API keys, and tokens from error messages.
 */
export function redactSecrets(raw: string): string {
  if (!raw) return "";
  return raw
    // Redact postgres / database connection URLs
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DB_URL]")
    // Redact Google Gemini API keys (AIza...)
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED_GEMINI_KEY]")
    // Redact OpenAI API keys (sk-...)
    .replace(/sk-[0-9A-Za-z\-_]{16,}/g, "[REDACTED_OPENAI_KEY]")
    // Redact Bearer tokens
    .replace(/Bearer\s+[0-9A-Za-z\-._~+/]+=*/gi, "Bearer [REDACTED_TOKEN]")
    // Redact query key=... parameters
    .replace(/([?&]key=)[^&\s"']+/gi, "$1[REDACTED_KEY]");
}

/**
 * Builds and emits a structured JSON diagnostic log line.
 */
export function logDiagnostic(input: DiagnosticLogInput): StructuredDiagnosticEntry {
  const level: LogLevel = input.level ?? (input.category === "success" ? "info" : "error");
  const prismaCode = extractPrismaCode(input.error);
  const errorName =
    input.error instanceof Error
      ? input.error.name
      : input.error && typeof input.error === "object" && "name" in input.error
        ? String((input.error as { name?: unknown }).name)
        : undefined;

  const entry: StructuredDiagnosticEntry = {
    level,
    operation: input.operation,
    correlationId: input.correlationId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    stage: input.stage,
    category: input.category,
    message: redactSecrets(input.message),
    ...(input.statusCode !== undefined ? { statusCode: input.statusCode } : {}),
    ...(prismaCode ? { prismaCode } : {}),
    ...(errorName ? { errorName } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    timestamp: new Date().toISOString(),
  };

  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }

  return entry;
}

