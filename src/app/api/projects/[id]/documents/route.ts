import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storeDocument, DocumentValidationError } from "@/lib/documents/storage";
import { extractDocumentText, DocumentExtractionError } from "@/lib/documents/extractor";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Ensures a project exists for the given ID (auto-scaffolds if first demo run).
 */
async function ensureProjectExists(projectId: string) {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (existing) return existing;

  // Find or create default demo user
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
 * Handles multipart file upload, validation, storage, and text extraction.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    await ensureProjectExists(projectId);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No document file provided in request." },
        { status: 400 }
      );
    }

    const fileName = file.name || "agreement.pdf";
    const declaredMimeType = file.type || "application/pdf";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Validate & Store document file
    const stored = await storeDocument(buffer, fileName, declaredMimeType);

    // 2. Extract structured text
    let extraction;
    try {
      extraction = await extractDocumentText(buffer, stored.mimeType);
    } catch (extractErr: unknown) {
      // Record failed extraction status in database
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

      return NextResponse.json(
        {
          error:
            extractErr instanceof Error
              ? extractErr.message
              : "Failed to extract text from document.",
          documentId: failedDoc.id,
        },
        { status: 422 }
      );
    }

    // 3. Persist document record
    const document = await prisma.document.create({
      data: {
        projectId,
        fileName: stored.originalFileName,
        mimeType: stored.mimeType,
        storageKey: stored.storageKey,
        extractedText: extraction.rawText,
        extractionStatus: "READY",
      },
    });

    // 4. Log timeline event
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
    if (err instanceof DocumentValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (err instanceof DocumentExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }

    return NextResponse.json(
      {
        error: `Unexpected upload error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/documents
 * Returns list of uploaded documents for the project.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

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

    return NextResponse.json({ documents });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

