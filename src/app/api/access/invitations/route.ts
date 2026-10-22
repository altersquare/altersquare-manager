import { NextResponse } from "next/server";
import { fetchAllPendingInvitations, fetchTeam } from "@/lib/github";
import { readCache, writeCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/session";

/**
 * List pending invitations across every repository (admin only).
 * Always live from GitHub; the repo list comes from the cache.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    let cached = await readCache();
    if (!cached) {
      const { team, repos } = await fetchTeam();
      cached = await writeCache(team, repos);
    }

    const invitations = await fetchAllPendingInvitations(cached.repos.map((r) => r.name));
    invitations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return NextResponse.json({ invitations });
  } catch (error: unknown) {
    console.error("Failed to list all invitations:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json({ error: "Invalid or expired GitHub token" }, { status: 401 });
      }
      if (status === 403 || status === 429) {
        return NextResponse.json({ error: "Insufficient permissions or rate limited" }, { status: 403 });
      }
    }

    return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
  }
}
