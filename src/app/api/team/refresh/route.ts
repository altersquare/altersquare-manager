import { NextResponse } from "next/server";
import { fetchTeam } from "@/lib/github";
import { clearCache, writeCache } from "@/lib/cache";
import { requireGithubUsername } from "@/lib/session";

export async function POST() {
  const denied = await requireGithubUsername();
  if (denied) return denied;

  try {
    // Clear existing cache
    await clearCache();

    // Fetch fresh data from GitHub
    const { team, repos } = await fetchTeam();

    // Write new cache
    const cacheData = await writeCache(team, repos);

    return NextResponse.json({
      team,
      totalMembers: team.length,
      totalRepos: repos.length,
      repos: repos.map((r) => r.name),
      cachedAt: cacheData.cachedAt,
    });
  } catch (error: unknown) {
    console.error("Failed to refresh team:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      const headers: Record<string, string> = {};
      if ("response" in error) {
        const retryAfter = (error as { response?: { headers?: Record<string, string> } }).response?.headers?.["retry-after"];
        if (retryAfter) headers["retry-after"] = retryAfter;
      }
      if (status === 401) {
        return NextResponse.json(
          { error: "Invalid or expired GitHub token. Check your GITHUB_TOKEN in .env" },
          { status: 401, headers }
        );
      }
      if (status === 403 || status === 429) {
        return NextResponse.json(
          { error: "GitHub API rate limit exceeded — please wait a few minutes and try again" },
          { status: 403, headers }
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to refresh team data" },
      { status: 500 }
    );  }
}
