import { NextRequest, NextResponse } from "next/server";
import { revokeInvitation } from "@/lib/github";
import { requireAdmin } from "@/lib/session";

const OWNER = process.env.GITHUB_USERNAME || "altersquare";

/**
 * Revoke a pending collaborator invitation.
 * Body: { repo: string, invitationId: number }
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { repo, invitationId } = (await request.json()) as {
      repo: string;
      invitationId: number;
    };

    if (!repo || typeof repo !== "string") {
      return NextResponse.json(
        { error: "repo is required" },
        { status: 400 }
      );
    }
    if (!invitationId || typeof invitationId !== "number") {
      return NextResponse.json(
        { error: "invitationId is required and must be a number" },
        { status: 400 }
      );
    }

    await revokeInvitation(OWNER, repo, invitationId);

    return NextResponse.json({ success: true, repo, invitationId });
  } catch (error: unknown) {
    console.error("Failed to revoke invitation:", error);

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
          { error: "Invitation or repository not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}
