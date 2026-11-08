import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CreateProjectSchema, type ProjectSummaryDto } from "@/lib/projects/schema";
import {
  createCorrelationId,
  extractPrismaCode,
  logDiagnostic,
} from "@/lib/logger";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";

function serializeProject(project: {
  id: string;
  ownerId: string;
  name: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  pricingModel: string;
  hourlyRate: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): ProjectSummaryDto {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    clientName: project.clientName,
    clientEmail: project.clientEmail,
    currency: project.currency,
    pricingModel: project.pricingModel,
    hourlyRate:
      project.hourlyRate !== null && project.hourlyRate !== undefined
        ? Number(project.hourlyRate)
        : null,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/**
 * GET /api/projects
 * Lists all projects belonging to the authenticated provider ordered by most recent update.
 */
export async function GET(req: NextRequest) {
  const correlationId = createCorrelationId();

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return unauthorizedResponse(correlationId);
  }

  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(
      {
        projects: projects.map(serializeProject),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const prismaCode = extractPrismaCode(err);
    logDiagnostic({
      level: "error",
      operation: "project.list",
      correlationId,
      stage: "db.query",
      category: prismaCode ? "database" : "unexpected",
      message: err instanceof Error ? err.message : String(err),
      statusCode: 500,
      error: err,
    });

    return NextResponse.json(
      {
        error: "Failed to load projects.",
        correlationId,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Validates input and creates a new Project owned by the authenticated provider.
 */
export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId();

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return unauthorizedResponse(correlationId);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch (err: unknown) {
    logDiagnostic({
      level: "warn",
      operation: "project.create",
      correlationId,
      stage: "request.parse",
      category: "validation",
      message: "Invalid JSON payload in project creation request.",
      statusCode: 400,
      error: err,
    });

    return NextResponse.json(
      {
        error: "Invalid JSON request body.",
        correlationId,
      },
      { status: 400 }
    );
  }

  const parsed = CreateProjectSchema.safeParse(rawBody);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const firstIssue = parsed.error.issues[0]?.message || "Invalid project details.";

    logDiagnostic({
      level: "warn",
      operation: "project.create",
      correlationId,
      stage: "request.validate",
      category: "validation",
      message: firstIssue,
      statusCode: 400,
      metadata: {
        issueCount: parsed.error.issues.length,
      },
    });

    return NextResponse.json(
      {
        error: firstIssue,
        fieldErrors: flattened.fieldErrors,
        correlationId,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const project = await prisma.project.create({
      data: {
        ownerId: user.id,
        name: data.name,
        clientName: data.clientName,
        clientEmail: data.clientEmail || "",
        currency: data.currency,
        pricingModel: data.pricingModel,
        hourlyRate: data.hourlyRate ?? null,
        status: "ACTIVE",
      },
    });

    await prisma.projectEvent.create({
      data: {
        projectId: project.id,
        actorType: "PROVIDER",
        actorId: user.id,
        eventType: "PROJECT_CREATED",
        description: `Created project "${project.name}" for client "${project.clientName}" (${project.currency}, ${project.pricingModel}).`,
        metadata: {
          projectId: project.id,
          ownerId: user.id,
          clientName: project.clientName,
          currency: project.currency,
          pricingModel: project.pricingModel,
          hourlyRate: data.hourlyRate ?? null,
        },
      },
    });

    logDiagnostic({
      level: "info",
      operation: "project.create",
      correlationId,
      projectId: project.id,
      stage: "db.persist",
      category: "success",
      message: `Project created successfully (${project.id}).`,
      statusCode: 201,
      metadata: {
        currency: project.currency,
        pricingModel: project.pricingModel,
      },
    });

    return NextResponse.json(
      {
        success: true,
        project: serializeProject(project),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const prismaCode = extractPrismaCode(err);
    logDiagnostic({
      level: "error",
      operation: "project.create",
      correlationId,
      stage: "db.persist",
      category: prismaCode ? "database" : "unexpected",
      message: err instanceof Error ? err.message : String(err),
      statusCode: 500,
      error: err,
    });

    return NextResponse.json(
      {
        error: "Failed to create project in database. Please verify database connectivity and try again.",
        correlationId,
      },
      { status: 500 }
    );
  }
}
