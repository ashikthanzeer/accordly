import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export interface AuthenticatedProvider {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/**
 * Resolves the currently authenticated provider from the Better Auth session.
 * Never trusts client-supplied user IDs; derives identity strictly from server-verified session cookies.
 */
export async function getAuthenticatedUser(
  req?: NextRequest | Request
): Promise<AuthenticatedProvider | null> {
  try {
    const reqHeaders = req ? req.headers : await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session || !session.user || !session.user.id) {
      return null;
    }

    return {
      id: session.user.id,
      name: session.user.name || session.user.email.split("@")[0] || "Provider",
      email: session.user.email,
      image: session.user.image ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Standard 401 Unauthorized response helper for provider API routes.
 */
export function unauthorizedResponse(correlationId?: string) {
  return NextResponse.json(
    {
      error: "Authentication required. Please sign in with Google.",
      ...(correlationId ? { correlationId } : {}),
    },
    { status: 401 }
  );
}

