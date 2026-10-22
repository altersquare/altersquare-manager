"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";
import { useSync } from "@/components/SyncContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { OffboardModal, OffboardResult } from "@/components/OffboardModal";
import { Button, EmptyState, ErrorState, ListSkeleton, PageHeader, SearchInput } from "@/components/ui";
import { MailIcon, RefreshIcon, UsersIcon, WarningIcon } from "@/components/icons";
import { postJson } from "@/lib/api";
import { formatDate, plural, timeAgo } from "@/lib/format";
import { useUrlState } from "@/lib/useUrlState";

interface TeamMember {
  username: string;
  avatarUrl: string;
  repos: string[];
}

interface Invitation {
  id: number;
  repo: string;
  username: string;
  avatarUrl: string;
  createdAt: string;
  expired: boolean;
}

interface Person {
  username: string;
  avatarUrl: string;
  repos: string[];
  invites: Invitation[];
}

type InviteFilter = "all" | "expired";

function downloadCsv(people: Person[]) {
  const rows = [["username", "type", "repository", "since"]];
  for (const p of people) {
    for (const repo of p.repos) rows.push([p.username, "collaborator", repo, ""]);
    for (const inv of p.invites) rows.push([p.username, inv.expired ? "invite (expired)" : "invite", inv.repo, inv.createdAt]);
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `access-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccessPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { showToast } = useToast();
  const { registerSyncCallback, unregisterSyncCallback } = useSync();

  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useUrlState("q", "");
  const [inviteFilter, setInviteFilter] = useUrlState<InviteFilter>("invites", "all");
  const [offboarding, setOffboarding] = useState<Person | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    itemName: string;
    confirmLabel: string;
    destructive?: boolean;
    action: () => Promise<void>;
    onSuccess: () => void;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [teamRes, invRes] = await Promise.all([fetch("/api/team"), fetch("/api/access/invitations")]);
      const teamData = await teamRes.json().catch(() => ({}));
      const invData = await invRes.json().catch(() => ({}));
      if (!teamRes.ok) throw new Error(teamData.error || "Failed to load team");
      if (!invRes.ok) throw new Error(invData.error || "Failed to load invitations");
      setTeam(teamData.team);
      setInvitations(invData.invitations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load access data");
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  useEffect(() => {
    const cb = () => { load(); };
    registerSyncCallback(cb);
    return () => unregisterSyncCallback(cb);
  }, [registerSyncCallback, unregisterSyncCallback, load]);

  if (sessionStatus !== "loading" && !isAdmin) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState icon={<WarningIcon />} title="Admins only" description="The access review is only available to admins." />
      </main>
    );
  }

  // Merge collaborators and invitees into one list of people
  const people: Person[] = [];
  if (team && invitations) {
    const byName = new Map<string, Person>();
    for (const m of team) byName.set(m.username.toLowerCase(), { ...m, invites: [] });
    for (const inv of invitations) {
      const key = inv.username.toLowerCase();
      const p = byName.get(key) ?? { username: inv.username, avatarUrl: inv.avatarUrl, repos: [], invites: [] };
      p.invites.push(inv);
      byName.set(key, p);
    }
    people.push(
      ...[...byName.values()].sort(
        (a, b) => b.repos.length + b.invites.length - (a.repos.length + a.invites.length) || a.username.localeCompare(b.username)
      )
    );
  }

  const q = search.toLowerCase();
  const visiblePeople = people.filter((p) => !q || p.username.toLowerCase().includes(q));
  const expiredCount = invitations?.filter((i) => i.expired).length ?? 0;
  const visibleInvites = (invitations ?? []).filter(
    (i) => (inviteFilter === "all" || i.expired) && (!q || i.username.toLowerCase().includes(q) || i.repo.toLowerCase().includes(q))
  );
  const loaded = team !== null && invitations !== null;

  const dropInvite = (id: number) => setInvitations((prev) => (prev ?? []).filter((i) => i.id !== id));

  const handleOffboarded = (r: OffboardResult) => {
    const key = r.username.toLowerCase();
    setTeam((prev) =>
      (prev ?? [])
        .map((m) => (m.username.toLowerCase() === key ? { ...m, repos: m.repos.filter((x) => !r.removedRepos.includes(x)) } : m))
        .filter((m) => m.repos.length > 0)
    );
    setInvitations((prev) => (prev ?? []).filter((i) => !r.revokedInvites.includes(i.id)));
    if (!r.failed) showToast(`${r.username} has been offboarded`, "success");
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        title="Access review"
        subtitle="Who can reach which repositories, what's still pending, and one-click offboarding."
        actions={
          <Button size="sm" onClick={() => downloadCsv(people)} disabled={!loaded || people.length === 0}>
            Download CSV
          </Button>
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {!loaded && !error && <ListSkeleton rows={4} />}

      {loaded && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "People with access", value: team!.length },
              { label: "Pending invitations", value: invitations!.length },
              { label: "Expired invitations", value: expiredCount, warn: expiredCount > 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-800 bg-gray-800/30 px-4 py-3">
                <p className={`text-2xl font-bold ${s.warn ? "text-amber-400" : ""}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          <SearchInput value={search} onChange={setSearch} placeholder="Filter by username or repo…" className="mb-8" />

          {/* Invitations */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-sm font-semibold text-gray-300 mr-auto">
                Pending invitations <span className="text-gray-500 font-normal">({visibleInvites.length})</span>
              </h2>
              <div role="group" aria-label="Invitation filter" className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
                {(["all", "expired"] as InviteFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={inviteFilter === f}
                    onClick={() => setInviteFilter(f)}
                    className={`px-3 py-1.5 capitalize cursor-pointer ${
                      inviteFilter === f ? "bg-gray-700 text-white" : "bg-gray-800/50 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {f === "expired" ? `Expired (${expiredCount})` : "All"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              GitHub invitations expire after 7 days. Expired ones give no access until re-sent.
            </p>
            {visibleInvites.length === 0 ? (
              <EmptyState
                compact
                icon={<MailIcon />}
                title={inviteFilter === "expired" ? "No expired invitations" : "No pending invitations"}
              />
            ) : (
              <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
                {visibleInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inv.avatarUrl} alt="" className="w-8 h-8 rounded-full ring-1 ring-gray-700" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{inv.username}</span>
                        <span className="text-gray-500"> → </span>
                        <Link
                          href={`/repos/${encodeURIComponent(inv.repo)}/manage?tab=access`}
                          className="text-gray-300 hover:text-blue-400"
                        >
                          {inv.repo}
                        </Link>
                        {inv.expired && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-400">
                            EXPIRED
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500" title={formatDate(inv.createdAt)}>
                        Invited {timeAgo(inv.createdAt)}
                      </p>
                    </div>
                    {inv.expired && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setConfirm({
                            title: "Re-send invitation",
                            message: `Revoke the expired invite and send a fresh one to ${inv.repo} for`,
                            itemName: inv.username,
                            confirmLabel: "Re-send",
                            destructive: false,
                            action: async () => {
                              await postJson(
                                "/api/access/resend",
                                { repo: inv.repo, invitationId: inv.id, username: inv.username },
                                "Failed to re-send invitation"
                              );
                            },
                            onSuccess: () => {
                              showToast(`New invitation sent to ${inv.username}`, "success");
                              load();
                            },
                          })
                        }
                      >
                        <RefreshIcon className="w-3.5 h-3.5" />
                        Re-send
                      </Button>
                    )}
                    <Button
                      variant="ghost-danger"
                      size="sm"
                      onClick={() =>
                        setConfirm({
                          title: "Revoke invitation",
                          message: `Cancel the invitation to ${inv.repo} for`,
                          itemName: inv.username,
                          confirmLabel: "Revoke",
                          action: () =>
                            postJson("/api/repos/invitations/revoke", { repo: inv.repo, invitationId: inv.id }, "Failed to revoke invitation"),
                          onSuccess: () => {
                            showToast(`Revoked invitation for ${inv.username}`, "success");
                            dropInvite(inv.id);
                          },
                        })
                      }
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* People */}
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-1">
              People <span className="text-gray-500 font-normal">({visiblePeople.length})</span>
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Collaborators and invitees, most access first. On a personal account every collaborator has the same
              (write) access to the repos they&apos;re on.
            </p>
            {visiblePeople.length === 0 ? (
              <EmptyState compact icon={<UsersIcon />} title="Nobody matches" />
            ) : (
              <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
                {visiblePeople.map((p) => (
                  <li key={p.username} className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-full ring-1 ring-gray-700" />
                    <div className="flex-1 min-w-0">
                      <Link href={`/?q=${encodeURIComponent(p.username)}`} className="text-sm font-medium hover:text-blue-400">
                        {p.username}
                      </Link>
                      <p className="text-[11px] text-gray-500">
                        {p.repos.length > 0 ? plural(p.repos.length, "repo") : "No access yet"}
                        {p.invites.length > 0 && (
                          <span className={p.invites.some((i) => i.expired) ? "text-amber-400" : ""}>
                            {" "}
                            · {plural(p.invites.length, "pending invite")}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button variant="ghost-danger" size="sm" onClick={() => setOffboarding(p)}>
                      Offboard…
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {offboarding && (
        <OffboardModal
          username={offboarding.username}
          repos={offboarding.repos}
          invitations={offboarding.invites.map((i) => ({ id: i.id, repo: i.repo }))}
          onClose={() => setOffboarding(null)}
          onDone={handleOffboarded}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          itemName={confirm.itemName}
          confirmLabel={confirm.confirmLabel}
          destructive={confirm.destructive}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
          onSuccess={() => {
            confirm.onSuccess();
            setConfirm(null);
          }}
        />
      )}
    </main>
  );
}
