import { NextRequest, NextResponse } from "next/server";
import { removeCollaborator } from "@/lib/github";
import { readCache, writeCache } from "@/lib/cache";

const OWNER = process.env.GITHUB_USERNAME || "altersquare";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }

    // Read cache to find which repos this user is on
    const cached = await readCache();
    if (!cached) {
      return NextResponse.json(
        { error: "No cached data. Please refresh first." },
        { status: 400 }
      );
    }

    const member = cached.team.find(
      (m) => m.username.toLowerCase() === username.toLowerCase()
    );

    if (!member) {
      return NextResponse.json(
        { error: `User "${username}" not found in team` },
        { status: 404 }
      );
    }

    // Remove from all repos in parallel
    const results = await Promise.allSettled(
      member.repos.map((repo) => removeCollaborator(OWNER, repo, username))
    );

    const succeeded: string[] = [];
    const failed: string[] = [];

    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        succeeded.push(member.repos[i]);
      } else {
        console.error(
          `Failed to remove ${username} from ${member.repos[i]}:`,
          result.reason
        );
        failed.push(member.repos[i]);
      }
    });

    // Update cache — remove this member (or update repos if partial failure)
    if (failed.length === 0) {
      cached.team = cached.team.filter(
        (m) => m.username.toLowerCase() !== username.toLowerCase()
      );
    } else {
      // Partial failure — only keep the failed repos
      const memberInCache = cached.team.find(
        (m) => m.username.toLowerCase() === username.toLowerCase()
      );
      if (memberInCache) {
        memberInCache.repos = failed;
      }
    }

    cached.cachedAt = new Date().toISOString();
    await writeCache(cached.team, cached.repos);

    return NextResponse.json({
      success: true,
      username,
      removedFrom: succeeded,
      failedRepos: failed,
      team: cached.team,
      totalMembers: cached.team.length,
      totalRepos: cached.repos.length,
      repos: cached.repos.map((r) => r.name),
      cachedAt: cached.cachedAt,
    });
  } catch (error: unknown) {
    console.error("Failed to remove collaborator:", error);

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
          { error: "Rate limit exceeded or insufficient permissions" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to remove collaborator" },
      { status: 500 }
    );
  }
}
