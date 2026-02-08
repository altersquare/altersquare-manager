"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RepoDetail {
  name: string;
  fullName: string;
  private: boolean;
  url: string;
  description: string | null;
  collaboratorCount: number;
}

type SortOption = "name-asc" | "name-desc" | "collabs-desc" | "collabs-asc";
type VisibilityFilter = "all" | "public" | "private";

export default function ReposPage() {
  const [repos, setRepos] = useState<RepoDetail[]>([]);
  const [totalRepos, setTotalRepos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [sort, setSort] = useState<SortOption>("name-asc");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/repos/details");
        if (!res.ok) {
          const err = await res.json();
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
    })();
  }, []);

  // Filter & sort
  const filtered = repos
    .filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (visibility === "public" && r.private) return false;
      if (visibility === "private" && !r.private) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "collabs-desc":
          return b.collaboratorCount - a.collaboratorCount || a.name.localeCompare(b.name);
        case "collabs-asc":
          return a.collaboratorCount - b.collaboratorCount || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  const hasFilters = search || visibility !== "all";

  const clearFilters = () => {
    setSearch("");
    setVisibility("all");
    setSort("name-asc");
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Repositories</h1>
        {!loading && !error && (
          <span className="text-gray-400 text-sm">{totalRepos} total</span>
        )}
      </div>

      {/* Filter bar */}
      {!loading && !error && repos.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repos..."
              className="w-full pl-10 pr-8 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Visibility toggle */}
          <div className="flex rounded-lg border border-gray-700 overflow-hidden shrink-0">
            {(["all", "public", "private"] as VisibilityFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`px-3.5 py-2.5 text-sm font-medium capitalize transition-colors ${
                  visibility === v
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="appearance-none px-4 py-2.5 pr-9 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
            >
              <option value="name-asc">Name A→Z</option>
              <option value="name-desc">Name Z→A</option>
              <option value="collabs-desc">Most Collaborators</option>
              <option value="collabs-asc">Fewest Collaborators</option>
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-800/50 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-gray-700 rounded" />
                <div className="h-3 w-64 bg-gray-700/60 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-700 rounded-full" />
              <div className="h-6 w-24 bg-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-red-500/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Failed to load repositories</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      )}

      {/* Empty state (no repos at all) */}
      {!loading && !error && repos.length === 0 && (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">No repositories found</h2>
          <p className="text-gray-500">No repos were found for this account.</p>
        </div>
      )}

      {/* No matches */}
      {!loading && !error && repos.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-300 mb-1">No matches</h2>
          <p className="text-gray-500 text-sm">
            No repositories match your filters.
          </p>
          <button
            onClick={clearFilters}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Repo list */}
      {!loading && !error && filtered.length > 0 && (
        <>
          {hasFilters && (
            <p className="text-xs text-gray-500 mb-3">
              Showing {filtered.length} of {totalRepos} repos
            </p>
          )}
          <div className="space-y-3">
            {filtered.map((repo, idx) => (
              <Link
                key={repo.name}
                href={`/repos/${encodeURIComponent(repo.name)}/secrets`}
                className="block bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex items-start sm:items-center gap-4 hover:bg-gray-800/80 hover:border-gray-700 transition-colors animate-fade-in-up cursor-pointer"
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {repo.name}
                    </span>
                    {/* Visibility badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        repo.private
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {repo.private ? "Private" : "Public"}
                    </span>
                    {/* GitHub external link */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(repo.url, "_blank", "noopener,noreferrer");
                      }}
                      className="text-gray-500 hover:text-blue-400 transition-colors"
                      title="Open on GitHub"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-gray-500 text-sm mt-1 truncate">
                    {repo.description || <span className="italic">No description</span>}
                  </p>
                </div>

                {/* Collaborator count */}
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-700/60 text-gray-300 border border-gray-700">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {repo.collaboratorCount}
                  </span>
                </div>

                {/* Arrow indicator */}
                <div className="shrink-0 text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
