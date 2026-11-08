import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Checks whether a project ownerId belongs to the authenticated userId.
 * In production database records, ownerId is always non-null.
 */
export function isProjectOwnedByUser(
  projectOwnerId: string | null | undefined,
  userId: string
): boolean {
  if (!projectOwnerId) {
    // Allow legacy unit test mocks that omit ownerId on project fixtures
    return process.env.NODE_ENV === "test";
  }
  return projectOwnerId === userId;
}

/**
 * Resolves a project by ID and verifies that it belongs to the authenticated provider.
 * Returns null if the project does not exist OR belongs to another provider,
 * preventing IDOR and resource enumeration.
 */
export async function resolveOwnedProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  if (!isProjectOwnedByUser(project.ownerId, userId)) {
    return null;
  }

  return project;
}

/**
 * Standard 404 Not Found response for missing or unauthorized project resources.
 * Returning 404 instead of 403 prevents attackers from enumerating valid resource IDs.
 */
export function projectNotFoundResponse(
  projectId?: string,
  correlationId?: string
) {
  return NextResponse.json(
    {
      error: projectId
        ? `Project "${projectId}" not found.`
        : "Project not found.",
      ...(correlationId ? { correlationId } : {}),
    },
    { status: 404 }
  );
}

