import { NextRequest, NextResponse } from "next/server";
import { getRepoSettings } from "@/lib/github";
import { requireAdmin } from "@/lib/session";

/**
 * Get editable repository settings (admin only).
 * Query: ?repo=<name>
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const repo = request.nextUrl.searchParams.get("repo");
    if (!repo) {
      return NextResponse.json({ error: "repo query parameter is required" }, { status: 400 });
    }

    const settings = await getRepoSettings(repo);
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    console.error("Failed to get repo settings:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json({ error: "Invalid or expired GitHub token" }, { status: 401 });
      }
      if (status === 403) {
        return NextResponse.json({ error: "Insufficient permissions or rate limited" }, { status: 403 });
      }
      if (status === 404) {
        return NextResponse.json({ error: "Repository not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Failed to load repository settings" }, { status: 500 });
  }
}
