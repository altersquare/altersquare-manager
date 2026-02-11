import { NextRequest, NextResponse } from "next/server";
import { deleteRepoVariable } from "@/lib/github";
import { requireAdmin } from "@/lib/session";

/**
 * Delete a repository variable.
 * Body: { repo: string, name: string }
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

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
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    await deleteRepoVariable(repo, name);

    return NextResponse.json({ success: true, repo, name });
  } catch (error: unknown) {
    console.error("Failed to delete variable:", error);

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
    }

    return NextResponse.json(
      { error: "Failed to delete variable" },
      { status: 500 }
    );
  }
}
