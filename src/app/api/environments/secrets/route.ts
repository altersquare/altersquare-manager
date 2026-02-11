import { NextRequest, NextResponse } from "next/server";
import { listEnvSecrets } from "@/lib/github";
import { requireMemberRepoAccess } from "@/lib/session";

/**
 * List all Actions secrets for a repository environment.
 * Query: ?repo=<name>&env=<environment>
 */
export async function GET(request: NextRequest) {
  try {
    const repo = request.nextUrl.searchParams.get("repo");
    const env = request.nextUrl.searchParams.get("env");

    if (!repo || typeof repo !== "string") {
      return NextResponse.json(
        { error: "repo query parameter is required" },
        { status: 400 }
      );
    }
    if (!env || typeof env !== "string") {
      return NextResponse.json(
        { error: "env query parameter is required" },
        { status: 400 }
      );
    }

    const denied = await requireMemberRepoAccess(repo);
    if (denied) return denied;

    const secrets = await listEnvSecrets(repo, env);

    return NextResponse.json({ secrets });
  } catch (error: unknown) {
    console.error("Failed to list environment secrets:", error);

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
          { error: "Repository or environment not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to list environment secrets" },
      { status: 500 }
    );
  }
}
