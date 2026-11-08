/**
 * Project Activity Timeline Service.
 *
 * Retrieves and formats chronological commercial events for a specific project
 * from persisted ProjectEvent records, enriching events with resource IDs,
 * proposal version tags, and direct workspace navigation links while sanitizing metadata.
 */

import { prisma } from "@/lib/db";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";

export type EventCategory = "SCOPE" | "REQUEST" | "PROPOSAL" | "INVOICE" | "PAYMENT" | "GENERAL";

export interface TimelineEventItem {
  id: string;
  projectId: string;
  actorType: "PROVIDER" | "CLIENT" | "SYSTEM" | "PAYPAL" | string;
  actorId?: string | null;
  eventType: string;
  category: EventCategory;
  description: string;
  resourceId?: string | null;
  proposalVersion?: number | null;
  href?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  formattedDate: string;
  formattedTime: string;
  relativeTime: string;
}

export interface ProjectTimelineResponse {
  project: {
    id: string;
    name: string;
    clientName: string;
    status: string;
  };
  events: TimelineEventItem[];
  totalCount: number;
}

/**
 * Derives an intuitive category for visual grouping and icon display.
 */
export function deriveEventCategory(eventType: string): EventCategory {
  const upper = (eventType || "").toUpperCase();
  if (upper.includes("PAYMENT") || upper.includes("PAID") || upper.includes("RECONCIL")) {
    return "PAYMENT";
  }
  if (upper.includes("INVOICE")) {
    return "INVOICE";
  }
  if (
    upper.includes("PROPOSAL") ||
    upper.includes("CHANGE_ORDER") ||
    upper.includes("ACCEPTED") ||
    upper.includes("REJECTED") ||
    upper.includes("SUPERSEDED") ||
    upper.includes("REVIEW_LINK")
  ) {
    return "PROPOSAL";
  }
  if (upper.includes("REQUEST") || upper.includes("CLASSIFI")) {
    return "REQUEST";
  }
  if (upper.includes("BASELINE") || upper.includes("DOCUMENT") || upper.includes("AGREEMENT")) {
    return "SCOPE";
  }
  return "GENERAL";
}

/**
 * Sanitizes event metadata so internal prompts, raw tokens, or secrets are never exposed.
 */
export function sanitizeEventMetadata(
  rawMeta: unknown
): Record<string, any> | undefined {
  if (!rawMeta || typeof rawMeta !== "object" || Array.isArray(rawMeta)) {
    return undefined;
  }

  const FORBIDDEN_KEYS = new Set([
    "prompt",
    "systemPrompt",
    "rawPrompt",
    "reviewToken",
    "reviewTokenHash",
    "secret",
    "apiKey",
    "accessToken",
  ]);

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawMeta as Record<string, any>)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    clean[key] = value;
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

/**
 * Resolves the relevant resource ID, proposal version, and workspace link for an event.
 */
export function resolveEventResourceContext(
  projectId: string,
  category: EventCategory,
  meta?: Record<string, any>
): {
  resourceId: string | null;
  proposalVersion: number | null;
  href: string;
} {
  const proposalId = meta?.proposalId || meta?.changeOrderId || null;
  const resourceId =
    proposalId ||
    meta?.changeRequestId ||
    meta?.invoiceId ||
    meta?.paypalInvoiceId ||
    meta?.baselineId ||
    meta?.documentId ||
    null;

  const rawVersion = meta?.version ?? meta?.proposalVersion ?? null;
  const proposalVersion =
    typeof rawVersion === "number" && Number.isFinite(rawVersion)
      ? rawVersion
      : null;

  let href = `/projects/${projectId}/baseline`;
  if (category === "PROPOSAL" || category === "INVOICE" || category === "PAYMENT") {
    href = proposalId
      ? `/projects/${projectId}/proposals/${proposalId}`
      : `/projects/${projectId}/proposals`;
  } else if (category === "REQUEST") {
    href = `/projects/${projectId}/requests`;
  } else if (category === "SCOPE") {
    href = `/projects/${projectId}/baseline`;
  }

  return {
    resourceId: resourceId ? String(resourceId) : null,
    proposalVersion,
    href,
  };
}

/**
 * Formats relative human-readable timestamps.
 */
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Retrieves the full chronological activity timeline for a project.
 */
export async function getProjectTimeline(
  projectId: string,
  userId?: string
): Promise<ProjectTimelineResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      clientName: true,
      status: true,
    },
  });

  if (!project) return null;
  if (userId && !isProjectOwnedByUser((project as any).ownerId, userId)) {
    return null;
  }

  const rawEvents = await prisma.projectEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  const events: TimelineEventItem[] = rawEvents.map((evt) => {
    const d = new Date(evt.createdAt);
    const category = deriveEventCategory(evt.eventType);
    const cleanMeta = sanitizeEventMetadata(evt.metadata);
    const { resourceId, proposalVersion, href } = resolveEventResourceContext(
      projectId,
      category,
      cleanMeta
    );

    return {
      id: evt.id,
      projectId: evt.projectId,
      actorType: evt.actorType,
      actorId: (evt as any).actorId ?? null,
      eventType: evt.eventType,
      category,
      description: evt.description,
      resourceId,
      proposalVersion,
      href,
      metadata: cleanMeta,
      createdAt: d.toISOString(),
      formattedDate: d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      formattedTime: d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      relativeTime: formatRelativeTime(d),
    };
  });

  return {
    project,
    events,
    totalCount: events.length,
  };
}
