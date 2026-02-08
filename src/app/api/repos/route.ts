import { NextResponse } from "next/server";
import { fetchAllRepos } from "@/lib/github";

export async function GET() {
  try {
    const repos = await fetchAllRepos();
    return NextResponse.json({ repos, count: repos.length });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Failed to fetch repos:", message);
    return NextResponse.json(
      { error: "Failed to fetch repositories", detail: message },
      { status: 500 }
    );
  }
}
