import { NextRequest, NextResponse } from "next/server";
import { updateRepoVariable } from "@/lib/github";
import { requireMemberRepoAccess } from "@/lib/session";

/**
 * Update a repository variable.
 * Body: { repo: string, name: string, value: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { repo, name, value } = (await request.json()) as {
      repo: string;
      name: string;
      value: string;
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
        { error: "name is required" },
        { status: 400 }
      );
    }
    if (value === undefined || value === null || typeof value !== "string") {
      return NextResponse.json(
        { error: "value is required" },
        { status: 400 }
      );
    }

    await updateRepoVariable(repo, name, value);

    return NextResponse.json({ success: true, repo, name });
  } catch (error: unknown) {
    console.error("Failed to update variable:", error);

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
          { error: "Variable or repository not found" },
          { status: 404 }
        );
      }
      if (status === 422) {
        return NextResponse.json(
          { error: "Validation failed — check the variable name and value" },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update variable" },
      { status: 500 }
    );
  }
}
