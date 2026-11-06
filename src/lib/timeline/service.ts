/**
 * Project Activity Timeline Service.
 *
 * Retrieves and formats chronological commercial events for a specific project
 * from persisted ProjectEvent records.
 */

import { prisma } from "@/lib/db";

export type EventCategory = "SCOPE" | "REQUEST" | "PROPOSAL" | "INVOICE" | "PAYMENT" | "GENERAL";

export interface TimelineEventItem {
  id: string;
  projectId: string;
  actorType: "PROVIDER" | "CLIENT" | "SYSTEM" | "PAYPAL" | string;
  eventType: string;
  category: EventCategory;
  description: string;
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
    upper.includes("REJECTED")
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
  projectId: string
): Promise<ProjectTimelineResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientName: true,
      status: true,
    },
  });

  if (!project) return null;

  const rawEvents = await prisma.projectEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  const events: TimelineEventItem[] = rawEvents.map((evt) => {
    const d = new Date(evt.createdAt);
    return {
      id: evt.id,
      projectId: evt.projectId,
      actorType: evt.actorType,
      eventType: evt.eventType,
      category: deriveEventCategory(evt.eventType),
      description: evt.description,
      metadata: (evt.metadata as Record<string, any>) || undefined,
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

