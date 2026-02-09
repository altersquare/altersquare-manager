import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Get the current session (server-side).
 * Returns null if not authenticated.
 */
export async function getSession() {
  return await auth();
}

/**
 * Guard for admin-only API routes.
 * Returns a 403 NextResponse if the user is not an admin, or null if access is allowed.
 *
 * Usage:
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  return null;
}
