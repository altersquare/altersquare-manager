import { NextRequest, NextResponse } from "next/server";
import { createDeployKey } from "@/lib/github";
import { requireAdmin } from "@/lib/session";

const KEY_PATTERN = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/=]+( .*)?$/;

/**
 * Add a deploy key (admin only — it grants repo access).
 * Body: { repo: string, title: string, key: string, readOnly: boolean }
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { repo, title, key, readOnly } = (await request.json()) as {
      repo: string;
      title: string;
      key: string;
      readOnly: boolean;
    };

    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "repo is required" }, { status: 400 });
    }
    if (!title || typeof title !== "string" || title.length > 100) {
      return NextResponse.json({ error: "title is required (max 100 characters)" }, { status: 400 });
    }
    if (!key || typeof key !== "string" || !KEY_PATTERN.test(key.trim())) {
      return NextResponse.json({ error: "key must be an SSH public key (e.g. ssh-ed25519 AAAA…)" }, { status: 400 });
    }

    await createDeployKey(repo, title.trim(), key.trim(), readOnly !== false);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to create deploy key:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json({ error: "Invalid or expired GitHub token" }, { status: 401 });
      }
      if (status === 403) {
        return NextResponse.json({ error: "Insufficient permissions or rate limited" }, { status: 403 });
      }
      if (status === 422) {
        return NextResponse.json(
          { error: "GitHub rejected the key — it may be invalid or already in use on another repo" },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({ error: "Failed to create deploy key" }, { status: 500 });
  }
}
