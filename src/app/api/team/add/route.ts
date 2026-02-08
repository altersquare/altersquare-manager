import { NextRequest, NextResponse } from "next/server";
import { addCollaborator } from "@/lib/github";

const OWNER = process.env.GITHUB_USERNAME || "altersquare";

/**
 * Add a collaborator to a single repo.
 * Body: { username: string, repo: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { username, repo } = (await request.json()) as {
      username: string;
      repo: string;
    };

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

    const result = await addCollaborator(OWNER, repo, username);

    return NextResponse.json({
      success: true,
      username,
      repo,
      invitationCreated: result.invitationCreated,
    });
  } catch (error: unknown) {
    console.error("Failed to add collaborator:", error);

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
          { error: "User or repo not found" },
          { status: 404 }
        );
      }
      if (status === 422) {
        return NextResponse.json(
          { error: "Validation failed — check the username" },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to add collaborator" },
      { status: 500 }
    );
  }
}
