import { NextResponse } from "next/server";
import { getRateLimit } from "@/lib/github";
import { requireGithubUsername } from "@/lib/session";

/**
 * Current GitHub API quota for the shared server token.
 */
export async function GET() {
  const denied = await requireGithubUsername();
  if (denied) return denied;

  try {
    const rateLimit = await getRateLimit();
    return NextResponse.json({ rateLimit });
  } catch (error: unknown) {
    console.error("Failed to get rate limit:", error);

    if (error instanceof Error && "status" in error && (error as { status: number }).status === 401) {
      return NextResponse.json({ error: "Invalid or expired GitHub token" }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to get rate limit" }, { status: 500 });
  }
}
