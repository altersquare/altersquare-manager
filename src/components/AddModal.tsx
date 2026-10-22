"use client";

import { useMemo, useState } from "react";
import { Button, CheckSquare, Modal, SearchInput, inputClass } from "@/components/ui";
import { UserPlusIcon } from "@/components/icons";
import { RepoCheckRow, RepoProgress, RepoProgressList } from "@/components/RepoProgressList";
import { plural } from "@/lib/format";

export interface AddResult {
  username: string;
  /** Repos where GitHub sent an invitation (access starts once accepted). */
  invited: string[];
  /** Repos where the user already had access (no invitation needed). */
  added: string[];
  failed: string[];
}

interface AddModalProps {
  allRepos: string[];
  /** Current collaborators, used to mark repos a user already has. */
  members: { username: string; repos: string[] }[];
  /** Skip the repo picker and add to just this repo. */
  fixedRepo?: string;
  onClose: () => void;
  onDone: (result: AddResult) => void;
}

const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Accepts "octocat", "@octocat" or "https://github.com/octocat". */
function normalizeUsername(raw: string) {
  return raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
}

export function AddModal({ allRepos, members, fixedRepo, onClose, onDone }: AddModalProps) {
  const [rawUsername, setRawUsername] = useState("");
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(
    new Set(fixedRepo ? [fixedRepo] : [])
  );
  const [repoSearch, setRepoSearch] = useState("");
  const [progress, setProgress] = useState<RepoProgress[] | null>(null);
  const [summary, setSummary] = useState<AddResult | null>(null);

  const username = normalizeUsername(rawUsername);
  const usernameError =
    username.length > 0 && !USERNAME_PATTERN.test(username) ? "That doesn't look like a GitHub username." : null;

  const existingRepos = useMemo(() => {
    const m = members.find((m) => m.username.toLowerCase() === username.toLowerCase());
    return new Set(m?.repos ?? []);
  }, [members, username]);

  // Drop repos the user already has from the selection
  const effectiveSelection = [...selectedRepos].filter((r) => !existingRepos.has(r));
  const running = progress !== null && summary === null;
  const canSubmit = username.length > 0 && !usernameError && effectiveSelection.length > 0 && progress === null;

  const filteredRepos = allRepos.filter((r) => r.toLowerCase().includes(repoSearch.toLowerCase()));
  const selectable = filteredRepos.filter((r) => !existingRepos.has(r));
  const allFilteredSelected = selectable.length > 0 && selectable.every((r) => selectedRepos.has(r));

  const toggleRepo = (repo: string) =>
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repo)) next.delete(repo);
      else next.add(repo);
      return next;
    });

  const toggleAll = () =>
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      for (const r of selectable) {
        if (allFilteredSelected) next.delete(r);
        else next.add(r);
      }
      return next;
    });

  const run = async () => {
    if (!canSubmit) return;
    const repos = effectiveSelection;
    setProgress(repos.map((repo) => ({ repo, status: "pending" })));
    const result: AddResult = { username, invited: [], added: [], failed: [] };

    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status: "working" } : p)));
      try {
        const res = await fetch("/api/team/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, repo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed");
        const status = data.invitationCreated ? "invited" : "done";
        (data.invitationCreated ? result.invited : result.added).push(repo);
        setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status } : p)));
      } catch (err) {
        result.failed.push(repo);
        const error = err instanceof Error ? err.message : "Unknown error";
        setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status: "failed", error } : p)));
      }
    }

    setSummary(result);
    onDone(result);
  };

  const subtitle = fixedRepo ? (
    <>Invite someone to {fixedRepo}</>
  ) : (
    <>Invite a GitHub user to one or more repositories</>
  );

  return (
    <Modal
      title={summary ? "Done" : running ? `Inviting ${username}…` : "Add collaborator"}
      subtitle={subtitle}
      icon={<UserPlusIcon className="w-5 h-5" />}
      busy={running}
      onClose={onClose}
      footer={
        summary ? (
          <Button variant="primary" onClick={onClose} autoFocus>
            Close
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={running}>
              Cancel
            </Button>
            <Button variant="primary" onClick={run} disabled={!canSubmit} loading={running}>
              {fixedRepo ? "Send invite" : `Invite to ${plural(effectiveSelection.length, "repo")}`}
            </Button>
          </>
        )
      }
    >
      {progress ? (
        <div className="space-y-3">
          {summary && (
            <div className="text-sm text-gray-300 space-y-1">
              {summary.invited.length > 0 && (
                <p>
                  Invitation sent for {plural(summary.invited.length, "repo")}.{" "}
                  <span className="text-gray-400">
                    {username} gets access after accepting the invite from GitHub — until then they show under
                    the repo&apos;s pending invitations.
                  </span>
                </p>
              )}
              {summary.added.length > 0 && <p>Already had access to {plural(summary.added.length, "repo")}.</p>}
              {summary.failed.length > 0 && (
                <p className="text-red-400">Failed on {plural(summary.failed.length, "repo")} — see below.</p>
              )}
            </div>
          )}
          <RepoProgressList
            items={progress}
            labels={{ working: "Inviting…", invited: "Invited", done: "Already has access", failed: "Failed" }}
          />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="add-username" className="block text-sm font-medium text-gray-300 mb-1.5">
              GitHub username
            </label>
            <input
              id="add-username"
              type="text"
              value={rawUsername}
              onChange={(e) => setRawUsername(e.target.value)}
              placeholder="octocat, @octocat or profile URL"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} ${usernameError ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" : ""}`}
            />
            {usernameError && <p className="mt-1.5 text-xs text-red-400">{usernameError}</p>}
            {!usernameError && existingRepos.size > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                {username} already has access to {plural(existingRepos.size, "repo")}
                {fixedRepo && existingRepos.has(fixedRepo) && <span className="text-amber-400"> — including this one</span>}.
              </p>
            )}
          </div>

          {!fixedRepo && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-300">Repositories</span>
                <span className="text-xs text-gray-500">{effectiveSelection.length} selected</span>
              </div>
              <SearchInput value={repoSearch} onChange={setRepoSearch} placeholder="Filter repos…" className="mb-2" />
              <button
                type="button"
                onClick={toggleAll}
                disabled={selectable.length === 0}
                className="flex items-center gap-2 px-3 py-1 mb-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 cursor-pointer"
              >
                <CheckSquare checked={allFilteredSelected} indeterminate={selectedRepos.size > 0} />
                {allFilteredSelected ? "Deselect" : "Select"} {repoSearch ? "matching" : "all"} ({selectable.length})
              </button>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {filteredRepos.length === 0 && (
                  <p className="text-xs text-gray-500 px-3 py-2">No repos match &ldquo;{repoSearch}&rdquo;.</p>
                )}
                {filteredRepos.map((repo) => {
                  const has = existingRepos.has(repo);
                  return (
                    <RepoCheckRow
                      key={repo}
                      repo={repo}
                      checked={!has && selectedRepos.has(repo)}
                      onToggle={() => toggleRepo(repo)}
                      disabled={has}
                      note={has ? "Has access" : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500">Collaborators get write (push) access once they accept.</p>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}
