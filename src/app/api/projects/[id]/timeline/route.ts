import { NextRequest, NextResponse } from "next/server";
import { getProjectTimeline } from "@/lib/timeline/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/timeline
 * Returns chronological commercial lifecycle events for a specific project.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const timeline = await getProjectTimeline(projectId);

    if (!timeline) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(timeline, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching project timeline:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load project timeline." },
      { status: 500 }
    );
  }
}

