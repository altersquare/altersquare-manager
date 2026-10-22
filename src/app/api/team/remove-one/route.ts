import { NextRequest, NextResponse } from "next/server";
import { removeCollaborator } from "@/lib/github";
import { requireAdmin } from "@/lib/session";
import { readCache, writeCache } from "@/lib/cache";

const OWNER = process.env.GITHUB_USERNAME || "altersquare";

/**
 * Remove a collaborator from a single repo.
 * Body: { username: string, repo: string }
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { username, repo } = body as { username: string; repo: string };

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }
    if (!repo || typeof repo !== "string") {
      return NextResponse.json(
        { error: "repo is required" },
        { status: 400 }
      );
    }

    await removeCollaborator(OWNER, repo, username);

    // Keep the cached team in step so a page reload doesn't resurrect the removed access
    const cached = await readCache();
    if (cached) {
      const key = username.toLowerCase();
      const team = cached.team
        .map((m) =>
          m.username.toLowerCase() === key ? { ...m, repos: m.repos.filter((r) => r !== repo) } : m
        )
        .filter((m) => m.repos.length > 0);
      await writeCache(team, cached.repos, cached.cachedAt);
    }

    return NextResponse.json({
      success: true,
      username,
      repo,
    });
  } catch (error: unknown) {
    console.error("Failed to remove collaborator from repo:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json(
          { error: "Invalid or expired GitHub token" },
          { status: 401 }
        );
      }
      if (status === 403) {
        return NextResponse.json(
          { error: "Insufficient permissions or rate limited" },
          { status: 403 }
        );
      }
      if (status === 404) {
        return NextResponse.json(
          { error: `User not found in repo` },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to remove collaborator" },
      { status: 500 }
    );
  }
}
