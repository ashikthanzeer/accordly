import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  storeDocument,
  removeStoredDocument,
  DocumentValidationError,
  DocumentSizeLimitError,
  UnsupportedDocumentTypeError,
  DocumentStorageError,
  type StoredDocumentResult,
} from "@/lib/documents/storage";
import {
  extractDocumentText,
  DocumentExtractionError,
} from "@/lib/documents/extractor";
import {
  createCorrelationId,
  extractPrismaCode,
  logDiagnostic,
} from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Resolves an existing project by ID. Auto-scaffolds "demo-project-01" on first run,
 * and returns null for unknown project IDs so the route can respond with HTTP 404.
 */
async function resolveProjectForUpload(projectId: string) {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (existing) return existing;

  if (projectId !== "demo-project-01") {
    return null;
  }

  const user = await prisma.user.upsert({
    where: { email: "provider@accordly.local" },
    update: {},
    create: {
      id: "usr_demo_provider",
      name: "Demo Provider",
      email: "provider@accordly.local",
    },
  });

  return prisma.project.create({
    data: {
      id: projectId,
      ownerId: user.id,
      name: "Client Redesign & Commercial Scope",
      clientName: "Acme Digital Corp",
      clientEmail: "client@example.com",
      currency: "USD",
      pricingModel: "HOURLY",
      hourlyRate: 150.0,
      status: "ACTIVE",
    },
  });
}

/**
 * POST /api/projects/[id]/documents
 * Handles multipart file upload, validation, storage, text extraction, and Prisma persistence.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const correlationId = createCorrelationId();
  const { id: projectId } = await params;
  let stored: StoredDocumentResult | null = null;

  try {
    // 1. Verify project exists
    const project = await resolveProjectForUpload(projectId);
    if (!project) {
      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "project.lookup",
        category: "not_found",
        message: `Cannot upload agreement: project "${projectId}" was not found.`,
        statusCode: 404,
      });

      return NextResponse.json(
        {
          error: `Project "${projectId}" was not found. Please create the project first.`,
          correlationId,
        },
        { status: 404 }
      );
    }

    // 2. Parse multipart/form-data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formErr: unknown) {
      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "request.formData",
        category: "validation",
        message: "Failed to parse multipart/form-data body.",
        statusCode: 400,
        error: formErr,
      });

      return NextResponse.json(
        {
          error: "Invalid multipart/form-data upload payload.",
          correlationId,
        },
        { status: 400 }
      );
    }

    const file = formData.get("file");

    if (
      !file ||
      typeof file === "string" ||
      typeof (file as Blob).arrayBuffer !== "function"
    ) {
      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "request.fileField",
        category: "validation",
        message: "No document file provided in form field 'file'.",
        statusCode: 400,
      });

      return NextResponse.json(
        {
          error: "No document file provided in request.",
          correlationId,
        },
        { status: 400 }
      );
    }

    const fileObj = file as File;
    const fileName = fileObj.name || "agreement.pdf";
    const declaredMimeType = fileObj.type || "application/pdf";
    const arrayBuffer = await fileObj.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Validate & store document file
    stored = await storeDocument(buffer, fileName, declaredMimeType);

    if (stored.usedFallbackStorage) {
      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "storage.write",
        category: "storage",
        message: "Primary STORAGE_DIR was not writable; used fallback writable directory.",
        metadata: {
          fileName: stored.originalFileName,
          sizeBytes: stored.sizeBytes,
        },
      });
    }

    // 4. Extract structured text
    let extraction;
    try {
      extraction = await extractDocumentText(buffer, stored.mimeType);
    } catch (extractErr: unknown) {
      let failedDocId: string | undefined;
      try {
        const failedDoc = await prisma.document.create({
          data: {
            projectId,
            fileName: stored.originalFileName,
            mimeType: stored.mimeType,
            storageKey: stored.storageKey,
            extractedText: null,
            extractionStatus: "FAILED",
          },
        });
        failedDocId = failedDoc.id;
      } catch {
        await removeStoredDocument(stored.absolutePath);
      }

      const message =
        extractErr instanceof Error
          ? extractErr.message
          : "Failed to extract text from document.";

      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "document.extract",
        category: "extraction",
        message,
        statusCode: 422,
        error: extractErr,
        metadata: {
          fileName: stored.originalFileName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      });

      return NextResponse.json(
        {
          error: message,
          ...(failedDocId ? { documentId: failedDocId } : {}),
          correlationId,
        },
        { status: 422 }
      );
    }

    // 5. Persist READY document record and timeline event
    let document;
    try {
      document = await prisma.document.create({
        data: {
          projectId,
          fileName: stored.originalFileName,
          mimeType: stored.mimeType,
          storageKey: stored.storageKey,
          extractedText: extraction.rawText,
          extractionStatus: "READY",
        },
      });

      await prisma.projectEvent.create({
        data: {
          projectId,
          actorType: "PROVIDER",
          eventType: "AGREEMENT_UPLOADED",
          description: `Uploaded agreement "${stored.originalFileName}" (${extraction.totalPages} pages/sections, ${extraction.totalCharacters} chars).`,
          metadata: {
            documentId: document.id,
            fileName: stored.originalFileName,
            totalPages: extraction.totalPages,
            totalCharacters: extraction.totalCharacters,
          },
        },
      });
    } catch (dbErr: unknown) {
      // Clean up orphaned file if DB persistence fails
      await removeStoredDocument(stored.absolutePath);
      throw dbErr;
    }

    logDiagnostic({
      level: "info",
      operation: "document.upload",
      correlationId,
      projectId,
      stage: "complete",
      category: "success",
      message: `Uploaded and extracted agreement "${stored.originalFileName}".`,
      statusCode: 201,
      metadata: {
        documentId: document.id,
        mimeType: document.mimeType,
        totalPages: extraction.totalPages,
        totalCharacters: extraction.totalCharacters,
      },
    });

    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          extractionStatus: document.extractionStatus,
          totalPages: extraction.totalPages,
          totalCharacters: extraction.totalCharacters,
          extractedTextPreview: extraction.rawText.slice(0, 500),
          createdAt: document.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof DocumentSizeLimitError) {
      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "document.validate",
        category: "validation",
        message: err.message,
        statusCode: 413,
      });
      return NextResponse.json(
        { error: err.message, correlationId },
        { status: 413 }
      );
    }

    if (err instanceof UnsupportedDocumentTypeError) {
      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "document.validate",
        category: "validation",
        message: err.message,
        statusCode: 415,
      });
      return NextResponse.json(
        { error: err.message, correlationId },
        { status: 415 }
      );
    }

    if (err instanceof DocumentValidationError) {
      const status = err.statusCode || 400;
      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "document.validate",
        category: "validation",
        message: err.message,
        statusCode: status,
      });
      return NextResponse.json(
        { error: err.message, correlationId },
        { status }
      );
    }

    if (err instanceof DocumentExtractionError) {
      logDiagnostic({
        level: "warn",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "document.extract",
        category: "extraction",
        message: err.message,
        statusCode: 422,
      });
      return NextResponse.json(
        { error: err.message, correlationId },
        { status: 422 }
      );
    }

    if (err instanceof DocumentStorageError) {
      logDiagnostic({
        level: "error",
        operation: "document.upload",
        correlationId,
        projectId,
        stage: "storage.write",
        category: "storage",
        message: err.message,
        statusCode: 503,
        error: err.causeError ?? err,
      });
      return NextResponse.json(
        {
          error:
            "Document storage is temporarily unavailable in the server environment. Please contact support or verify storage configuration.",
          correlationId,
        },
        { status: 503 }
      );
    }

    const prismaCode = extractPrismaCode(err);
    logDiagnostic({
      level: "error",
      operation: "document.upload",
      correlationId,
      projectId,
      stage: prismaCode ? "db.persist" : "unexpected",
      category: prismaCode ? "database" : "unexpected",
      message: err instanceof Error ? err.message : String(err),
      statusCode: 500,
      error: err,
    });

    return NextResponse.json(
      {
        error: `Unexpected upload error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        correlationId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/documents
 * Returns list of uploaded documents for the project.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const correlationId = createCorrelationId();
  const { id: projectId } = await params;

  try {
    const documents = await prisma.document.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        extractionStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ documents }, { status: 200 });
  } catch (err: unknown) {
    const prismaCode = extractPrismaCode(err);
    logDiagnostic({
      level: "error",
      operation: "document.list",
      correlationId,
      projectId,
      stage: "db.query",
      category: prismaCode ? "database" : "unexpected",
      message: err instanceof Error ? err.message : String(err),
      statusCode: 500,
      error: err,
    });

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        correlationId,
      },
      { status: 500 }
    );
  }
}
