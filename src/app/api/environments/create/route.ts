import { NextRequest, NextResponse } from "next/server";
import { createEnvironment } from "@/lib/github";
import { requireMemberRepoAccess } from "@/lib/session";

/**
 * Create an environment for a repository.
 * Body: { repo: string, name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { repo, name } = (await request.json()) as {
      repo: string;
      name: string;
    };

    if (!repo || typeof repo !== "string") {
      return NextResponse.json(
        { error: "repo is required" },
        { status: 400 }
      );
    }

    const denied = await requireMemberRepoAccess(repo);
    if (denied) return denied;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Environment name is required" },
        { status: 400 }
      );
    }

    if (name.length > 255) {
      return NextResponse.json(
        { error: "Environment name must be 255 characters or fewer" },
        { status: 422 }
      );
    }

    await createEnvironment(repo, name);

    return NextResponse.json({ success: true, repo, name });
  } catch (error: unknown) {
    console.error("Failed to create environment:", error);

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
      if (status === 422) {
        return NextResponse.json(
          { error: "Validation failed — check the environment name" },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create environment" },
      { status: 500 }
    );
  }
}
