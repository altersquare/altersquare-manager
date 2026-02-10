import { NextResponse } from "next/server";
import { fetchTeam } from "@/lib/github";
import { readCache, writeCache } from "@/lib/cache";
import { requireGithubUsername, getMemberRepos } from "@/lib/session";

export async function GET() {
  const denied = await requireGithubUsername();
  if (denied) return denied;

  try {
    // Serve from cache if available
    const cached = await readCache();
    let team;
    let repoNames: string[];
    let cachedAt: string;

    if (cached) {
      team = cached.team;
      repoNames = cached.repos.map((r) => r.name);
      cachedAt = cached.cachedAt;
    } else {
      // No cache — fetch live and save
      const fetched = await fetchTeam();
      const cacheData = await writeCache(fetched.team, fetched.repos);
      team = fetched.team;
      repoNames = fetched.repos.map((r) => r.name);
      cachedAt = cacheData.cachedAt;
    }

    // Filter for members: only show collaborators on shared repos
    const memberRepos = await getMemberRepos();
    if (memberRepos !== null) {
      const allowed = new Set(memberRepos);
      repoNames = repoNames.filter((name) => allowed.has(name));
      team = team
        .map((member) => ({
          ...member,
          repos: member.repos.filter((r) => allowed.has(r)),
        }))
        .filter((member) => member.repos.length > 0);
    }

    return NextResponse.json({
      team,
      totalMembers: team.length,
      totalRepos: repoNames.length,
      repos: repoNames,
      cachedAt,
    });
  } catch (error: unknown) {
    console.error("Failed to fetch team:", error);

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
      { error: "Failed to fetch team data" },
      { status: 500 }
    );  }
}
