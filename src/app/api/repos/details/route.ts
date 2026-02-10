import { NextResponse } from "next/server";
import { readCache, writeCache } from "@/lib/cache";
import { fetchTeam } from "@/lib/github";
import { requireGithubUsername, getMemberRepos } from "@/lib/session";

export async function GET() {
  const denied = await requireGithubUsername();
  if (denied) return denied;

  try {
    let cached = await readCache();

    // If no cache, fetch live and populate
    if (!cached) {
      const { team, repos } = await fetchTeam();
      cached = await writeCache(team, repos);
    }

    // Build collaborator count per repo
    const collabCounts = new Map<string, number>();
    for (const member of cached.team) {
      for (const repoName of member.repos) {
        collabCounts.set(repoName, (collabCounts.get(repoName) || 0) + 1);
      }
    }

    let repos = cached.repos
      .map((r) => ({
        name: r.name,
        fullName: r.fullName,
        private: r.private,
        url: r.url,
        description: r.description,
        collaboratorCount: collabCounts.get(r.name) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Filter repos for members based on their collaborator access
    const memberRepos = await getMemberRepos();
    if (memberRepos !== null) {
      const allowed = new Set(memberRepos);
      repos = repos.filter((r) => allowed.has(r.name));
    }

    return NextResponse.json({ repos, totalRepos: repos.length });
  } catch (error: unknown) {
    console.error("Failed to fetch repo details:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json(
          { error: "Invalid or expired GitHub token" },
          { status: 401 }
        );
      }
      if (status === 403 || status === 429) {
        return NextResponse.json(
          { error: "GitHub API rate limit exceeded" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch repository details" },
      { status: 500 }
    );
  }
}
