import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateEnvSecret } from "@/lib/github";
import { requireMemberRepoAccess } from "@/lib/session";

/**
 * Create or update an environment secret.
 * Body: { repo: string, env: string, name: string, value: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { repo, env, name, value } = (await request.json()) as {
      repo: string;
      env: string;
      name: string;
      value: string;
    };

    if (!repo || typeof repo !== "string") {
      return NextResponse.json(
        { error: "repo is required" },
        { status: 400 }
      );
    }
    if (!env || typeof env !== "string") {
      return NextResponse.json(
        { error: "env is required" },
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

    await createOrUpdateEnvSecret(repo, env, name, value);

    return NextResponse.json({ success: true, repo, env, name });
  } catch (error: unknown) {
    console.error("Failed to create/update environment secret:", error);

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
      if (status === 422) {
        return NextResponse.json(
          { error: "Validation failed — check the secret name" },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create/update environment secret" },
      { status: 500 }
    );
  }
}
