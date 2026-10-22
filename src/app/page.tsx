"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";
import { useSync } from "@/components/SyncContext";
import { TeamSkeleton } from "@/components/TeamSkeleton";
import { RemoveModal, RemoveResult } from "@/components/RemoveModal";
import { AddModal } from "@/components/AddModal";
import { Button, EmptyState, ErrorState, PageHeader, SearchInput } from "@/components/ui";
import { ExternalLinkIcon, FolderIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { useUrlState } from "@/lib/useUrlState";
import { plural } from "@/lib/format";

interface TeamMember {
  username: string;
  avatarUrl: string;
  profileUrl: string;
  repos: string[];
}

interface TeamData {
  team: TeamMember[];
  totalMembers: number;
  totalRepos: number;
  repos: string[];
  cachedAt?: string;
}

const MAX_BADGES = 8;

export default function Home() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useUrlState("q", "");
  const [repoFilter, setRepoFilter] = useUrlState("repo", "");
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [globalError, setGlobalError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { registerSyncCallback, unregisterSyncCallback } = useSync();

  const fetchTeam = useCallback(async () => {
    try {
      setGlobalError(null);
      const res = await fetch("/api/team");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setGlobalError("The server's GitHub token is invalid or expired. Ask an admin to update GITHUB_TOKEN and restart.");
          return;
        }
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          setGlobalError(
            `GitHub API rate limit exceeded.${retryAfter ? ` Try again in ${retryAfter} seconds.` : " Please wait a few minutes and try again."}`
          );
          return;
        }
        setGlobalError(err.error || "Failed to load team data");
        return;
      }
      setData(await res.json());
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Re-fetch team data when sync completes from navbar
  useEffect(() => {
    const cb = () => { fetchTeam(); };
    registerSyncCallback(cb);
    return () => unregisterSyncCallback(cb);
  }, [registerSyncCallback, unregisterSyncCallback, fetchTeam]);

  const handleRemoved = useCallback(
    ({ username, removed, failed }: RemoveResult) => {
      setData((prev) => {
        if (!prev) return prev;
        const key = username.toLowerCase();
        const team = prev.team
          .map((m) =>
            m.username.toLowerCase() === key ? { ...m, repos: m.repos.filter((r) => !removed.includes(r)) } : m
          )
          .filter((m) => m.repos.length > 0);
        return { ...prev, team, totalMembers: team.length };
      });
      if (removed.length > 0 && failed.length === 0) {
        showToast(`Removed ${username} from ${plural(removed.length, "repo")}`, "success");
      }
    },
    [showToast]
  );

  const q = search.toLowerCase();
  const rf = repoFilter.toLowerCase();
  const exactRepo = data?.repos.some((r) => r.toLowerCase() === rf) ?? false;
  const repoMatches = (r: string) => (exactRepo ? r.toLowerCase() === rf : r.toLowerCase().includes(rf));
  const filtered =
    data?.team.filter(
      (m) => (!q || m.username.toLowerCase().includes(q)) && (!rf || m.repos.some(repoMatches))
    ) ?? [];
  const hasFilters = Boolean(search || repoFilter);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        title="Team"
        subtitle={
          data ? (
            <>
              {plural(data.totalMembers, "person", "people")} with access to {plural(data.totalRepos, "repository", "repositories")} in{" "}
              <a
                href="https://github.com/altersquare"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                altersquare
              </a>
            </>
          ) : (
            "Collaborators across altersquare repositories"
          )
        }
        actions={
          isAdmin && (
            <Button variant="primary" onClick={() => setShowAddModal(true)} disabled={!data}>
              <PlusIcon />
              Add collaborator
            </Button>
          )
        }
      />

      {globalError && (
        <div className="mb-6">
          <ErrorState message={globalError} onRetry={() => { setLoading(true); fetchTeam(); }} />
        </div>
      )}

      {data && data.team.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search people…" className="flex-1" />
          <SearchInput
            value={repoFilter}
            onChange={setRepoFilter}
            placeholder="Filter by repository…"
            list="team-repo-options"
            icon={<FolderIcon className="w-4 h-4" />}
            className="flex-1"
          />
          <datalist id="team-repo-options">
            {data.repos.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
      )}

      {loading ? (
        <TeamSkeleton />
      ) : !data ? null : data.team.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="No collaborators yet"
          description={isAdmin ? "Invite someone to start sharing repositories." : "Nobody shares a repository with you yet."}
          action={
            isAdmin && (
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                <PlusIcon />
                Add collaborator
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SearchIcon />}
          title="No matches"
          description={
            <>
              Nobody matches {search && <>&ldquo;{search}&rdquo;</>}
              {search && repoFilter && " in "}
              {repoFilter && <>repo &ldquo;{repoFilter}&rdquo;</>}.
            </>
          }
          action={
            <Button size="sm" onClick={() => { setSearch(""); setRepoFilter(""); }}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {hasFilters && (
            <p className="text-xs text-gray-500 mb-3">
              Showing {filtered.length} of {data.team.length}
            </p>
          )}
          <ul className="space-y-2">
            {filtered.map((member, idx) => {
              const isExpanded = expandedMembers.has(member.username);
              // When filtering by repo, show matching repos first so the reason for the match is visible
              const ordered = rf
                ? [...member.repos.filter(repoMatches), ...member.repos.filter((r) => !repoMatches(r))]
                : member.repos;
              const shown = isExpanded ? ordered : ordered.slice(0, MAX_BADGES);
              const hiddenCount = member.repos.length - MAX_BADGES;
              return (
                <li
                  key={member.username}
                  className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 flex items-start gap-4 hover:border-gray-700 transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(idx, 15) * 25}ms` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={member.avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full ring-2 ring-gray-700 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={member.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-1 font-medium hover:text-blue-400 transition-colors"
                        title="Open GitHub profile"
                      >
                        {member.username}
                        <ExternalLinkIcon className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400" />
                      </a>
                      <span className="text-xs text-gray-500">{plural(member.repos.length, "repo")}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {shown.map((repo) => (
                        <Link
                          key={repo}
                          href={`/repos/${encodeURIComponent(repo)}/manage`}
                          title={`Manage ${repo}`}
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${
                            rf && repoMatches(repo)
                              ? "bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25"
                              : "bg-gray-700/50 text-gray-300 border-gray-700 hover:border-gray-500 hover:text-white"
                          }`}
                        >
                          {repo}
                        </Link>
                      ))}
                      {member.repos.length > MAX_BADGES && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMembers((prev) => {
                              const next = new Set(prev);
                              if (isExpanded) next.delete(member.username);
                              else next.add(member.username);
                              return next;
                            })
                          }
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                        >
                          {isExpanded ? "Show less" : `+${hiddenCount} more`}
                        </button>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <Button
                      variant="ghost-danger"
                      size="sm"
                      onClick={() => setRemovingMember(member)}
                      className="shrink-0"
                    >
                      Remove…
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {showAddModal && data && (
        <AddModal
          allRepos={data.repos}
          members={data.team}
          onClose={() => setShowAddModal(false)}
          onDone={() => {}}
        />
      )}

      {removingMember && (
        <RemoveModal
          username={removingMember.username}
          repos={removingMember.repos}
          onClose={() => setRemovingMember(null)}
          onDone={handleRemoved}
        />
      )}
    </main>
  );
}
