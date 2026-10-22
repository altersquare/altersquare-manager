"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { EntryModal, EntryKind } from "@/components/EntryModal";
import { EntryList, Entry } from "@/components/EntryList";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CreateEnvironmentModal } from "@/components/CreateEnvironmentModal";
import { AddModal, AddResult } from "@/components/AddModal";
import { Button, EmptyState, ErrorState, ListSkeleton, Tabs, CountBadge, buttonClass } from "@/components/ui";
import {
  ChevronLeftIcon,
  ExternalLinkIcon,
  MailIcon,
  PlusIcon,
  ServerIcon,
  TrashIcon,
  UserPlusIcon,
  UsersIcon,
  WarningIcon,
} from "@/components/icons";
import { postJson } from "@/lib/api";
import { formatDate, plural, timeAgo } from "@/lib/format";
import { useUrlState } from "@/lib/useUrlState";

// ── Types ───────────────────────────────────────────────────────────

interface Environment {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface PendingInvitation {
  id: number;
  username: string;
  avatarUrl: string;
  createdAt: string;
}

interface RepoInfo {
  name: string;
  private: boolean;
  url: string;
  description: string | null;
}

interface TeamMember {
  username: string;
  avatarUrl: string;
  profileUrl: string;
  repos: string[];
}

type Tab = "secrets" | "variables" | "environments" | "access";

type EntryModalState = {
  kind: EntryKind;
  mode: "create" | "update";
  env?: string;
  name?: string;
  value?: string;
} | null;

type ConfirmState = {
  title: string;
  message: string;
  itemName: string;
  confirmLabel?: string;
  action: () => Promise<void>;
  onSuccess: () => void;
} | null;

/** Small fetch-into-state helper: list + loading + error, with a reload function. */
function useList<T>(url: string | null, key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!url) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      setStatus(res.status);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data[key] ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [url, key]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, setItems, loading, error, status, reload };
}

// ── Main Page ───────────────────────────────────────────────────────

export default function RepoManagePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const params = useParams<{ repo: string }>();
  const repo = decodeURIComponent(params.repo);
  const r = encodeURIComponent(repo);
  const { showToast } = useToast();

  const [tab, setTab] = useUrlState<Tab>("tab", "secrets");
  const [envParam, setEnvParam] = useUrlState("env", "");

  // ── Data ──────────────────────────────────────────────────────────
  const secrets = useList<Entry>(`/api/secrets?repo=${r}`, "secrets");
  const variables = useList<Entry>(`/api/variables?repo=${r}`, "variables");
  const environments = useList<Environment>(`/api/environments?repo=${r}`, "environments");
  const invitations = useList<PendingInvitation>(`/api/repos/invitations?repo=${r}`, "invitations");

  // Repo metadata + collaborators come from the cached team/repo data
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [allRepos, setAllRepos] = useState<string[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const fetchMeta = useCallback(async () => {
    try {
      const [detailsRes, teamRes] = await Promise.all([fetch("/api/repos/details"), fetch("/api/team")]);
      if (detailsRes.ok) {
        const d = await detailsRes.json();
        setRepoInfo(d.repos.find((x: RepoInfo) => x.name === repo) ?? null);
      }
      if (teamRes.ok) {
        const t = await teamRes.json();
        setTeam(t.team);
        setAllRepos(t.repos);
        setCachedAt(t.cachedAt ?? null);
      }
    } catch {
      // Header falls back to the repo name; access tab shows its own state
    }
  }, [repo]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // Selected environment: from URL if valid, else the first one
  const envNames = environments.items.map((e) => e.name);
  const selectedEnv = envNames.includes(envParam) ? envParam : (envNames[0] ?? "");
  const envQuery = selectedEnv ? `repo=${r}&env=${encodeURIComponent(selectedEnv)}` : null;
  const envSecrets = useList<Entry>(envQuery && `/api/environments/secrets?${envQuery}`, "secrets");
  const envVariables = useList<Entry>(envQuery && `/api/environments/variables?${envQuery}`, "variables");

  const collaborators = (team ?? []).filter((m) => m.repos.includes(repo));

  // ── Modals ────────────────────────────────────────────────────────
  const [entryModal, setEntryModal] = useState<EntryModalState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [createEnvOpen, setCreateEnvOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const reloadEntries = (kind: EntryKind, env?: string) => {
    if (env) (kind === "secret" ? envSecrets : envVariables).reload();
    else (kind === "secret" ? secrets : variables).reload();
  };

  const askDeleteEntry = (kind: EntryKind, item: Entry, env?: string) => {
    const noun = kind === "secret" ? "secret" : "variable";
    const path = `${env ? "/api/environments" : "/api"}/${noun}s/delete`;
    setConfirm({
      title: `Delete ${noun}`,
      message: env ? `Delete the ${env} ${noun}` : `Delete the repository ${noun}`,
      itemName: item.name,
      action: () => postJson(path, env ? { repo, env, name: item.name } : { repo, name: item.name }, `Failed to delete ${noun}`),
      onSuccess: () => {
        showToast(`Deleted ${item.name}`, "success");
        reloadEntries(kind, env);
      },
    });
  };

  const entryProps = (kind: EntryKind, list: ReturnType<typeof useList<Entry>>, env?: string) => ({
    kind,
    items: list.items,
    loading: list.loading,
    error: list.error,
    onRetry: list.reload,
    onAdd: () => setEntryModal({ kind, mode: "create", env }),
    onEdit: (item: Entry) => setEntryModal({ kind, mode: "update", env, name: item.name, value: item.value }),
    onDelete: isAdmin ? (item: Entry) => askDeleteEntry(kind, item, env) : undefined,
  });

  // ── Access denied ─────────────────────────────────────────────────
  const accessDenied = secrets.status === 403 && secrets.error?.includes("not a collaborator");

  const backLink = (
    <Link
      href="/repos"
      className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3"
    >
      <ChevronLeftIcon />
      Repositories
    </Link>
  );

  if (accessDenied) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8">
        {backLink}
        <EmptyState
          icon={<WarningIcon />}
          title="You don't have access to this repository"
          description="You're not a collaborator on it. Ask an admin to add you."
          action={<Link href="/repos" className={buttonClass("secondary", "sm")}>Back to repositories</Link>}
        />
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {backLink}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold break-all">{repo}</h1>
            {repoInfo && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  repoInfo.private
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}
              >
                {repoInfo.private ? "Private" : "Public"}
              </span>
            )}
          </div>
          {repoInfo?.description && <p className="text-gray-400 text-sm mt-1">{repoInfo.description}</p>}
        </div>
        <a
          href={repoInfo?.url ?? `https://github.com/altersquare/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClass("secondary", "sm")} shrink-0 self-start`}
        >
          Open on GitHub
          <ExternalLinkIcon className="w-3.5 h-3.5" />
        </a>
      </div>

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "secrets", label: "Secrets", count: secrets.loading || secrets.error ? undefined : secrets.items.length },
          { id: "variables", label: "Variables", count: variables.loading || variables.error ? undefined : variables.items.length },
          {
            id: "environments",
            label: "Environments",
            count: environments.loading || environments.error ? undefined : environments.items.length,
          },
          {
            id: "access",
            label: "Access",
            count: team ? collaborators.length : undefined,
            badge:
              invitations.items.length > 0 ? (
                <span title={`${plural(invitations.items.length, "pending invitation")}`}>
                  <CountBadge count={invitations.items.length} tone="amber" />
                </span>
              ) : undefined,
          },
        ]}
      />

      {tab === "secrets" && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Repository-wide Actions secrets, available to every workflow run. For values that differ per deployment,
            use{" "}
            <button type="button" onClick={() => setTab("environments")} className="text-blue-400 hover:underline cursor-pointer">
              environments
            </button>
            .
          </p>
          <EntryList {...entryProps("secret", secrets)} />
        </>
      )}

      {tab === "variables" && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Repository-wide Actions variables (plain text). Environment variables with the same name take precedence.
          </p>
          <EntryList {...entryProps("variable", variables)} />
        </>
      )}

      {tab === "environments" && (
        <section>
          {environments.loading ? (
            <ListSkeleton rows={2} />
          ) : environments.error ? (
            <ErrorState message={environments.error} onRetry={environments.reload} />
          ) : environments.items.length === 0 ? (
            <EmptyState
              icon={<ServerIcon />}
              title="No environments yet"
              description="Environments (e.g. production, staging) hold secrets and variables that only apply to that deployment target."
              action={
                <Button variant="primary" size="sm" onClick={() => setCreateEnvOpen(true)}>
                  <PlusIcon className="w-3.5 h-3.5" />
                  New environment
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-6" role="tablist" aria-label="Environment">
                {environments.items.map((env) => {
                  const active = env.name === selectedEnv;
                  return (
                    <button
                      key={env.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setEnvParam(env.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${
                        active
                          ? "bg-blue-500/15 border-blue-500/50 text-blue-200"
                          : "bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500"
                      }`}
                    >
                      <ServerIcon className="w-3.5 h-3.5" />
                      {env.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCreateEnvOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors cursor-pointer"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  New
                </button>
              </div>

              {selectedEnv && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between gap-3 -mt-2">
                    <p className="text-sm text-gray-500">
                      Values below apply only to jobs that use{" "}
                      <code className="text-gray-300 bg-gray-800 px-1 py-0.5 rounded text-xs">environment: {selectedEnv}</code>{" "}
                      and override repository values with the same name.
                    </p>
                    {isAdmin && (
                      <Button
                        variant="ghost-danger"
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          setConfirm({
                            title: "Delete environment",
                            message: "Delete the environment and all of its secrets and variables:",
                            itemName: selectedEnv,
                            confirmLabel: "Delete environment",
                            action: () =>
                              postJson("/api/environments/delete", { repo, name: selectedEnv }, "Failed to delete environment"),
                            onSuccess: () => {
                              showToast(`Deleted environment ${selectedEnv}`, "success");
                              setEnvParam("");
                              environments.reload();
                            },
                          })
                        }
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        Delete environment
                      </Button>
                    )}
                  </div>
                  <EntryList title="Secrets" {...entryProps("secret", envSecrets, selectedEnv)} />
                  <EntryList title="Variables" {...entryProps("variable", envVariables, selectedEnv)} />
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "access" && (
        <div className="space-y-10">
          {/* Collaborators */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-300 mr-auto">
                Collaborators {team && <span className="text-gray-500 font-normal">({collaborators.length})</span>}
              </h3>
              {isAdmin && (
                <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} disabled={!team}>
                  <UserPlusIcon className="w-3.5 h-3.5" />
                  Add collaborator
                </Button>
              )}
            </div>
            {!team ? (
              <ListSkeleton rows={2} />
            ) : collaborators.length === 0 ? (
              <EmptyState compact icon={<UsersIcon />} title="No collaborators besides the owner" />
            ) : (
              <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
                {collaborators.map((m) => (
                  <li key={m.username} className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.avatarUrl} alt="" className="w-8 h-8 rounded-full ring-1 ring-gray-700" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={m.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:text-blue-400"
                      >
                        {m.username}
                      </a>
                      {m.repos.length > 1 && (
                        <p className="text-[11px] text-gray-500">
                          Also on{" "}
                          <Link href={`/?q=${encodeURIComponent(m.username)}`} className="hover:text-gray-300 underline decoration-dotted">
                            {plural(m.repos.length - 1, "other repo")}
                          </Link>
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost-danger"
                        size="sm"
                        onClick={() =>
                          setConfirm({
                            title: "Remove collaborator",
                            message: `Revoke access to ${repo} for`,
                            itemName: m.username,
                            confirmLabel: "Remove",
                            action: () =>
                              postJson("/api/team/remove-one", { username: m.username, repo }, "Failed to remove collaborator"),
                            onSuccess: () => {
                              showToast(`Removed ${m.username} from ${repo}`, "success");
                              setTeam((prev) =>
                                (prev ?? []).map((t) =>
                                  t.username === m.username ? { ...t, repos: t.repos.filter((x) => x !== repo) } : t
                                )
                              );
                            },
                          })
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {cachedAt && (
              <p className="text-[11px] text-gray-600 mt-2">
                From the last sync ({timeAgo(cachedAt)}). Use Sync in the top bar to refresh.
              </p>
            )}
          </section>

          {/* Pending invitations */}
          <section>
            <h3 className="text-sm font-semibold text-gray-300 mb-1">
              Pending invitations{" "}
              {!invitations.loading && <span className="text-gray-500 font-normal">({invitations.items.length})</span>}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Invited people get access once they accept the email from GitHub.
            </p>
            {invitations.loading ? (
              <ListSkeleton rows={1} />
            ) : invitations.error ? (
              <ErrorState message={invitations.error} onRetry={invitations.reload} />
            ) : invitations.items.length === 0 ? (
              <EmptyState compact icon={<MailIcon />} title="No pending invitations" />
            ) : (
              <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
                {invitations.items.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inv.avatarUrl} alt="" className="w-8 h-8 rounded-full ring-1 ring-gray-700" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.username}</p>
                      <p className="text-[11px] text-gray-500" title={formatDate(inv.createdAt)}>
                        Invited {timeAgo(inv.createdAt)}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost-danger"
                        size="sm"
                        onClick={() =>
                          setConfirm({
                            title: "Revoke invitation",
                            message: `Cancel the pending invitation to ${repo} for`,
                            itemName: inv.username,
                            confirmLabel: "Revoke",
                            action: () =>
                              postJson(
                                "/api/repos/invitations/revoke",
                                { repo, invitationId: inv.id },
                                "Failed to revoke invitation"
                              ),
                            onSuccess: () => {
                              showToast(`Revoked invitation for ${inv.username}`, "success");
                              invitations.setItems((prev) => prev.filter((i) => i.id !== inv.id));
                            },
                          })
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}

      {entryModal && (
        <EntryModal
          kind={entryModal.kind}
          mode={entryModal.mode}
          repo={repo}
          env={entryModal.env}
          initialName={entryModal.name}
          initialValue={entryModal.value}
          onClose={() => setEntryModal(null)}
          onSuccess={() => {
            const { kind, mode, env } = entryModal;
            setEntryModal(null);
            showToast(`${kind === "secret" ? "Secret" : "Variable"} ${mode === "create" ? "created" : "saved"}`, "success");
            reloadEntries(kind, env);
          }}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          itemName={confirm.itemName}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
          onSuccess={() => {
            confirm.onSuccess();
            setConfirm(null);
          }}
        />
      )}

      {createEnvOpen && (
        <CreateEnvironmentModal
          repo={repo}
          existing={envNames}
          onClose={() => setCreateEnvOpen(false)}
          onSuccess={(name) => {
            setCreateEnvOpen(false);
            showToast(`Environment ${name} created`, "success");
            setEnvParam(name);
            environments.reload();
          }}
        />
      )}

      {addOpen && team && (
        <AddModal
          allRepos={allRepos}
          members={team}
          fixedRepo={repo}
          onClose={() => setAddOpen(false)}
          onDone={(result: AddResult) => {
            if (result.invited.length > 0) invitations.reload();
          }}
        />
      )}
    </main>
  );
}
