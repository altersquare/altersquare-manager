import { NextResponse } from "next/server";
import { readCache } from "@/lib/cache";
import { requireGithubUsername } from "@/lib/session";

export async function GET() {
  const denied = await requireGithubUsername();
  if (denied) return denied;

  try {
    const cached = await readCache();
    return NextResponse.json({ cachedAt: cached?.cachedAt ?? null });
  } catch {
    return NextResponse.json({ cachedAt: null });
  }
}
