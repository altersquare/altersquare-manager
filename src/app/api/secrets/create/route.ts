import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateRepoSecret } from "@/lib/github";

/**
 * Create or update a repository secret.
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
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    if (!value || typeof value !== "string") {
      return NextResponse.json(
        { error: "value is required" },
        { status: 400 }
      );
    }

    // Validate secret name: uppercase alphanumeric + underscores, no GITHUB_ prefix
    if (!/^[A-Z0-9_]+$/.test(name)) {
      return NextResponse.json(
        { error: "Secret name must contain only uppercase letters, digits, and underscores" },
        { status: 422 }
      );
    }
    if (name.startsWith("GITHUB_")) {
      return NextResponse.json(
        { error: "Secret name cannot start with GITHUB_" },
        { status: 422 }
      );
    }

    await createOrUpdateRepoSecret(repo, name, value);

    return NextResponse.json({ success: true, repo, name });
  } catch (error: unknown) {
    console.error("Failed to create/update secret:", error);

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
          { error: "Validation failed — check the secret name" },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create/update secret" },
      { status: 500 }
    );
  }
}
