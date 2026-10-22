import { NextRequest, NextResponse } from "next/server";
import { deleteDeployKey } from "@/lib/github";
import { requireAdmin } from "@/lib/session";

/**
 * Delete a deploy key (admin only).
 * Body: { repo: string, keyId: number }
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { repo, keyId } = (await request.json()) as { repo: string; keyId: number };

    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "repo is required" }, { status: 400 });
    }
    if (!keyId || typeof keyId !== "number") {
      return NextResponse.json({ error: "keyId is required and must be a number" }, { status: 400 });
    }

    await deleteDeployKey(repo, keyId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to delete deploy key:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json({ error: "Invalid or expired GitHub token" }, { status: 401 });
      }
      if (status === 403) {
        return NextResponse.json({ error: "Insufficient permissions or rate limited" }, { status: 403 });
      }
      if (status === 404) {
        return NextResponse.json({ error: "Deploy key or repository not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Failed to delete deploy key" }, { status: 500 });
  }
}
