import { NextRequest, NextResponse } from "next/server";
import { removeCollaborator } from "@/lib/github";

const OWNER = process.env.GITHUB_USERNAME || "altersquare";

/**
 * Remove a collaborator from a single repo.
 * Body: { username: string, repo: string }
 */
export async function POST(request: NextRequest) {
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
