import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { readCache, writeCache } from "@/lib/cache";
import { fetchTeam } from "@/lib/github";

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

/**
 * Guard that ensures a member user has a GitHub username configured.
 * Admins are always allowed through. Members without a githubUsername get a 403.
 *
 * Usage:
 *   const denied = await requireGithubUsername();
 *   if (denied) return denied;
 */
export async function requireGithubUsername(): Promise<NextResponse | null> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (session.user.role === "admin") {
    return null;
  }

  if (!session.user.githubUsername) {
    return NextResponse.json(
      {
        error:
          "GitHub username not configured. Contact your administrator.",
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Ensure the cache is populated. Reads from disk; if missing, fetches from GitHub and writes.
 */
async function ensureCache() {
  const cached = await readCache();
  if (cached) return cached;

  const { team, repos } = await fetchTeam();
  return await writeCache(team, repos);
}

/**
 * Guard that checks whether a member is a collaborator on a specific repo.
 * Admins are always allowed. Members without a githubUsername get a 403.
 * Members whose githubUsername is not a collaborator on the repo get a 403.
 *
 * Usage:
 *   const denied = await requireMemberRepoAccess(repo);
 *   if (denied) return denied;
 */
export async function requireMemberRepoAccess(
  repo: string
): Promise<NextResponse | null> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (session.user.role === "admin") {
    return null;
  }

  if (!session.user.githubUsername) {
    return NextResponse.json(
      {
        error:
          "GitHub username not configured. Contact your administrator.",
      },
      { status: 403 }
    );
  }

  const cached = await ensureCache();
  const ghUser = session.user.githubUsername.toLowerCase();
  const collaborator = cached.team.find(
    (c) => c.username.toLowerCase() === ghUser
  );

  if (!collaborator || !collaborator.repos.includes(repo)) {
    return NextResponse.json(
      { error: "You are not a collaborator on this repository" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Get the list of repos a member has access to.
 * Returns null for admins (meaning "no filtering — show all").
 * Returns an empty array for members without a githubUsername or not found in the cache.
 * Returns the collaborator's repo list for valid members.
 */
export async function getMemberRepos(): Promise<string[] | null> {
  const session = await auth();

  if (!session?.user) {
    return [];
  }

  if (session.user.role === "admin") {
    return null;
  }

  if (!session.user.githubUsername) {
    return [];
  }

  const cached = await ensureCache();
  const ghUser = session.user.githubUsername.toLowerCase();
  const collaborator = cached.team.find(
    (c) => c.username.toLowerCase() === ghUser
  );

  return collaborator ? collaborator.repos : [];
}
