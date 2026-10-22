"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSync } from "@/components/SyncContext";
import Link from "next/link";
import { Button, EmptyState, ErrorState, PageHeader, SearchInput } from "@/components/ui";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FolderIcon,
  SearchIcon,
  UsersIcon,
  WarningIcon,
} from "@/components/icons";
import { useUrlState } from "@/lib/useUrlState";
import { plural } from "@/lib/format";

interface RepoDetail {
  name: string;
  fullName: string;
  private: boolean;
  url: string;
  description: string | null;
  collaboratorCount: number;
  archived: boolean;
}

type SortOption = "name-asc" | "name-desc" | "collabs-desc" | "collabs-asc";
type VisibilityFilter = "all" | "public" | "private";

export default function ReposPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [repos, setRepos] = useState<RepoDetail[]>([]);
  const [totalRepos, setTotalRepos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useUrlState("q", "");
  const [visibility, setVisibility] = useUrlState<VisibilityFilter>("visibility", "all");
  const [sort, setSort] = useUrlState<SortOption>("sort", "name-asc");
  const { registerSyncCallback, unregisterSyncCallback } = useSync();

  const fetchRepos = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/repos/details");
      if (!res.ok) {
        if (res.status === 403) {
          setAccessDenied(true);
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch repos");
      }
      const data = await res.json();
      setRepos(data.repos);
      setTotalRepos(data.totalRepos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  // Re-fetch repos when sync completes from navbar
  useEffect(() => {
    const cb = () => { fetchRepos(); };
    registerSyncCallback(cb);
    return () => unregisterSyncCallback(cb);
  }, [registerSyncCallback, unregisterSyncCallback, fetchRepos]);

  const q = search.toLowerCase();
  const filtered = repos
    .filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.description?.toLowerCase().includes(q)) return false;
      if (visibility === "public" && r.private) return false;
      if (visibility === "private" && !r.private) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "collabs-desc":
          return b.collaboratorCount - a.collaboratorCount || a.name.localeCompare(b.name);
        case "collabs-asc":
          return a.collaboratorCount - b.collaboratorCount || a.name.localeCompare(b.name);
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const hasFilters = Boolean(search) || visibility !== "all";
  const clearFilters = () => {
    setSearch("");
    setVisibility("all");
  };
  const ready = !loading && !error && !accessDenied;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        title="Repositories"
        subtitle={
          ready
            ? isAdmin
              ? `${plural(totalRepos, "repository", "repositories")} — open one to manage access, secrets and variables`
              : `${plural(totalRepos, "repository", "repositories")} you collaborate on`
            : "Open a repository to manage access, secrets and variables"
        }
      />

      {ready && repos.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or description…"
            className="flex-1"
          />

          <div className="flex gap-3">
            <div role="group" aria-label="Visibility" className="flex rounded-lg border border-gray-700 overflow-hidden shrink-0">
              {(["all", "public", "private"] as VisibilityFilter[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  aria-pressed={visibility === v}
                  className={`px-3 py-2 text-sm font-medium capitalize transition-colors cursor-pointer ${
                    visibility === v
                      ? "bg-gray-700 text-white"
                      : "bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="relative shrink-0 flex-1 sm:flex-none">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort repositories"
                className="appearance-none w-full px-3 py-2 pr-9 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
              >
                <option value="name-asc">Name A→Z</option>
                <option value="name-desc">Name Z→A</option>
                <option value="collabs-desc">Most collaborators</option>
                <option value="collabs-asc">Fewest collaborators</option>
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-gray-700 rounded" />
                <div className="h-3 w-64 bg-gray-700/60 rounded" />
              </div>
              <div className="h-6 w-24 bg-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={() => { setLoading(true); fetchRepos(); }} />}

      {!loading && accessDenied && (
        <EmptyState
          icon={<WarningIcon />}
          title="You don't have permission to view repositories"
          description="Ask an admin to check your account's GitHub username."
        />
      )}

      {ready && repos.length === 0 && (
        <EmptyState
          icon={<FolderIcon />}
          title={isAdmin ? "No repositories found" : "No repositories shared with you"}
          description={
            isAdmin
              ? "Try syncing from GitHub using the button in the top bar."
              : "Once an admin adds you as a collaborator on a repo, it will show up here."
          }
        />
      )}

      {ready && repos.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<SearchIcon />}
          title="No matches"
          description="No repositories match your filters."
          action={<Button size="sm" onClick={clearFilters}>Clear filters</Button>}
        />
      )}

      {ready && filtered.length > 0 && (
        <>
          {hasFilters && (
            <p className="text-xs text-gray-500 mb-3">
              Showing {filtered.length} of {totalRepos}
            </p>
          )}
          <ul className="space-y-2">
            {filtered.map((repo, idx) => (
              <li
                key={repo.name}
                className="group relative bg-gray-800/40 border border-gray-800 rounded-xl hover:bg-gray-800/70 hover:border-gray-700 transition-colors animate-fade-in-up"
                style={{ animationDelay: `${Math.min(idx, 15) * 20}ms` }}
              >
                <Link
                  href={`/repos/${encodeURIComponent(repo.name)}/manage`}
                  className="flex items-center gap-4 p-4 pr-14"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate group-hover:text-white">{repo.name}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          repo.private
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {repo.private ? "Private" : "Public"}
                      </span>
                      {repo.archived && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-gray-700/40 text-gray-400 border-gray-600">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm mt-1 truncate">
                      {repo.description || <span className="italic text-gray-600">No description</span>}
                    </p>
                  </div>

                  <span
                    className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-400 shrink-0"
                    title={`${plural(repo.collaboratorCount, "collaborator")} (excluding the owner)`}
                  >
                    <UsersIcon className="w-3.5 h-3.5" />
                    {plural(repo.collaboratorCount, "collaborator")}
                  </span>

                  <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-300 shrink-0 hidden sm:block" />
                </Link>
                {/* Sibling of the card link (not nested) so it stays a real, keyboard-reachable link */}
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open on GitHub"
                  aria-label={`Open ${repo.name} on GitHub`}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-blue-400 hover:bg-gray-700/60 rounded-md"
                >
                  <ExternalLinkIcon />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
