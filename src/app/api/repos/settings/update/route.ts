import { NextRequest, NextResponse } from "next/server";
import { replaceRepoTopics, updateRepoSettings } from "@/lib/github";
import { readCache, writeCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/session";

const TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/;

/**
 * Update repository settings (admin only). Only provided fields change.
 * Body: { repo, description?, homepage?, topics?, private?, archived? }
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      repo: string;
      description?: string;
      homepage?: string;
      topics?: string[];
      private?: boolean;
      archived?: boolean;
    };
    const { repo } = body;

    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "repo is required" }, { status: 400 });
    }
    if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 350)) {
      return NextResponse.json({ error: "description must be at most 350 characters" }, { status: 400 });
    }
    if (body.homepage !== undefined && typeof body.homepage !== "string") {
      return NextResponse.json({ error: "homepage must be a string" }, { status: 400 });
    }
    if (
      body.topics !== undefined &&
      (!Array.isArray(body.topics) || body.topics.length > 20 || !body.topics.every((t) => typeof t === "string" && TOPIC_PATTERN.test(t)))
    ) {
      return NextResponse.json(
        { error: "topics must be up to 20 lowercase words (letters, digits, hyphens; max 50 chars each)" },
        { status: 400 }
      );
    }
    for (const flag of ["private", "archived"] as const) {
      if (body[flag] !== undefined && typeof body[flag] !== "boolean") {
        return NextResponse.json({ error: `${flag} must be a boolean` }, { status: 400 });
      }
    }

    const changes: { description?: string; homepage?: string; private?: boolean; archived?: boolean } = {};
    if (body.description !== undefined) changes.description = body.description;
    if (body.homepage !== undefined) changes.homepage = body.homepage;
    if (body.private !== undefined) changes.private = body.private;
    if (body.archived !== undefined) changes.archived = body.archived;

    if (Object.keys(changes).length > 0) await updateRepoSettings(repo, changes);
    if (body.topics !== undefined) await replaceRepoTopics(repo, body.topics);

    // Keep the cached repo list in step (description / visibility / archived)
    const cached = await readCache();
    if (cached) {
      const repos = cached.repos.map((r) =>
        r.name === repo
          ? {
              ...r,
              ...(changes.description !== undefined && { description: changes.description || null }),
              ...(changes.private !== undefined && { private: changes.private }),
              ...(changes.archived !== undefined && { archived: changes.archived }),
            }
          : r
      );
      await writeCache(cached.team, repos, cached.cachedAt);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to update repo settings:", error);

    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json({ error: "Invalid or expired GitHub token" }, { status: 401 });
      }
      if (status === 403) {
        return NextResponse.json(
          { error: "GitHub refused the change — the repo may be archived, or the token lacks admin rights" },
          { status: 403 }
        );
      }
      if (status === 422) {
        return NextResponse.json({ error: "GitHub rejected the change (validation failed)" }, { status: 422 });
      }
    }

    return NextResponse.json({ error: "Failed to update repository settings" }, { status: 500 });
  }
}
