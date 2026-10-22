import { NextRequest, NextResponse } from "next/server";
import { listDeployKeys } from "@/lib/github";
import { requireMemberRepoAccess } from "@/lib/session";

/**
 * List deploy keys for a repository.
 * Query: ?repo=<name>
 */
export async function GET(request: NextRequest) {
  try {
    const repo = request.nextUrl.searchParams.get("repo");
    if (!repo) {
      return NextResponse.json({ error: "repo query parameter is required" }, { status: 400 });
    }

    const denied = await requireMemberRepoAccess(repo);
    if (denied) return denied;

    const keys = await listDeployKeys(repo);
    return NextResponse.json({ keys });
  } catch (error: unknown) {
    console.error("Failed to list deploy keys:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json({ error: "Invalid or expired GitHub token" }, { status: 401 });
      }
      if (status === 403) {
        return NextResponse.json(
          { error: "The GitHub token can't read deploy keys (needs repo admin access)" },
          { status: 403 }
        );
      }
      if (status === 404) {
        return NextResponse.json({ error: "Repository not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Failed to list deploy keys" }, { status: 500 });
  }
}
