import { NextRequest, NextResponse } from "next/server";
import { addCollaborator, revokeInvitation } from "@/lib/github";
import { requireAdmin } from "@/lib/session";

const OWNER = process.env.GITHUB_USERNAME || "altersquare";

/**
 * Re-send an (expired) invitation: revoke the old one, then invite again.
 * Body: { repo: string, invitationId: number, username: string }
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { repo, invitationId, username } = (await request.json()) as {
      repo: string;
      invitationId: number;
      username: string;
    };

    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "repo is required" }, { status: 400 });
    }
    if (!invitationId || typeof invitationId !== "number") {
      return NextResponse.json({ error: "invitationId is required and must be a number" }, { status: 400 });
    }
    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    await revokeInvitation(OWNER, repo, invitationId);
    const result = await addCollaborator(OWNER, repo, username);

    return NextResponse.json({ success: true, repo, username, invitationCreated: result.invitationCreated });
  } catch (error: unknown) {
    console.error("Failed to re-send invitation:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json({ error: "Invalid or expired GitHub token" }, { status: 401 });
      }
      if (status === 403) {
        return NextResponse.json({ error: "Insufficient permissions or rate limited" }, { status: 403 });
      }
      if (status === 404) {
        return NextResponse.json({ error: "Invitation, user or repository not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Failed to re-send invitation" }, { status: 500 });
  }
}
