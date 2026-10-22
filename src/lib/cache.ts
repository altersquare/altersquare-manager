import fs from "fs/promises";
import path from "path";
import { Collaborator, Repo } from "./github";

// CACHE_DIR lets tests point at a fixture without touching the real cache
const CACHE_DIR = process.env.CACHE_DIR || path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "cache.json");

export interface CacheData {
  team: Collaborator[];
  repos: Repo[];
  cachedAt: string; // ISO timestamp
}

/**
 * Read cached team data from disk.
 * Returns null if cache doesn't exist or is unreadable.
 */
export async function readCache(): Promise<CacheData | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CacheData;
  } catch {
    return null;
  }
}

/**
 * Write team data to disk cache.
 */
export async function writeCache(
  team: Collaborator[],
  repos: Repo[],
  cachedAt: string = new Date().toISOString()
): Promise<CacheData> {
  const data: CacheData = { team, repos, cachedAt };

  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");

  return data;
}

/**
 * Delete the cache file.
 */
export async function clearCache(): Promise<void> {
  try {
    await fs.unlink(CACHE_FILE);
  } catch {
    // File doesn't exist — that's fine
  }
}
