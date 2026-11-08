import { NextRequest, NextResponse } from "next/server";
import { getDashboardOverview } from "@/lib/dashboard/service";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";

/**
 * GET /api/dashboard/overview
 * Returns executive KPIs, currency-grouped financials, action items, projects, and recent activity
 * strictly scoped to the authenticated provider.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const overview = await getDashboardOverview(user.id);
    return NextResponse.json(overview, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching dashboard overview:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load dashboard overview." },
      { status: 500 }
    );
  }
}
