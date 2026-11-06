import { NextRequest, NextResponse } from "next/server";
import { getDashboardOverview } from "@/lib/dashboard/service";

/**
 * GET /api/dashboard/overview
 * Returns executive KPIs, currency-grouped financials, action items, projects, and recent activity.
 */
export async function GET(req: NextRequest) {
  try {
    const overview = await getDashboardOverview();
    return NextResponse.json(overview, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching dashboard overview:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load dashboard overview." },
      { status: 500 }
    );
  }
}

