import { NextRequest, NextResponse } from "next/server";
import { listRepoSecrets } from "@/lib/github";
import { requireMemberRepoAccess } from "@/lib/session";

/**
 * List all Actions secrets for a repository.
 * Query: ?repo=<name>
 */
export async function GET(request: NextRequest) {
  try {
    const repo = request.nextUrl.searchParams.get("repo");

    if (!repo || typeof repo !== "string") {
      return NextResponse.json(
        { error: "repo query parameter is required" },
        { status: 400 }
      );
    }

    const denied = await requireMemberRepoAccess(repo);
    if (denied) return denied;

    const secrets = await listRepoSecrets(repo);

    return NextResponse.json({ secrets });
  } catch (error: unknown) {
    console.error("Failed to list secrets:", error);

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
          { error: "Repository not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to list secrets" },
      { status: 500 }
    );
  }
}
