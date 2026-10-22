"use client";

import { useState } from "react";
import { Button, Modal, inputClass } from "@/components/ui";
import { WarningIcon } from "@/components/icons";
import { RepoProgress, RepoProgressList } from "@/components/RepoProgressList";
import { postJson } from "@/lib/api";
import { plural } from "@/lib/format";

export interface OffboardResult {
  username: string;
  removedRepos: string[];
  revokedInvites: number[];
  failed: number;
}

interface OffboardModalProps {
  username: string;
  /** Repos the user currently has access to. */
  repos: string[];
  /** Their pending invitations. */
  invitations: { id: number; repo: string }[];
  onClose: () => void;
  onDone: (result: OffboardResult) => void;
}

type Step = { label: string; run: () => Promise<void>; onOk: (r: OffboardResult) => void };

/** Remove a user from every repo and revoke all of their pending invites, after typing their username. */
export function OffboardModal({ username, repos, invitations, onClose, onDone }: OffboardModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [progress, setProgress] = useState<RepoProgress[] | null>(null);
  const [result, setResult] = useState<OffboardResult | null>(null);

  const running = progress !== null && result === null;
  const confirmed = confirmText.trim().toLowerCase() === username.toLowerCase();
  const total = repos.length + invitations.length;

  const run = async () => {
    if (!confirmed || total === 0) return;
    const steps: Step[] = [
      ...repos.map((repo) => ({
        label: `${repo} — remove access`,
        run: () => postJson("/api/team/remove-one", { username, repo }, "Failed to remove"),
        onOk: (r: OffboardResult) => r.removedRepos.push(repo),
      })),
      ...invitations.map((inv) => ({
        label: `${inv.repo} — revoke invite`,
        run: () => postJson("/api/repos/invitations/revoke", { repo: inv.repo, invitationId: inv.id }, "Failed to revoke"),
        onOk: (r: OffboardResult) => r.revokedInvites.push(inv.id),
      })),
    ];
    setProgress(steps.map((s) => ({ repo: s.label, status: "pending" })));
    const out: OffboardResult = { username, removedRepos: [], revokedInvites: [], failed: 0 };

    for (let i = 0; i < steps.length; i++) {
      setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status: "working" } : p)));
      try {
        await steps[i].run();
        steps[i].onOk(out);
        setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status: "done" } : p)));
      } catch (err) {
        out.failed++;
        const error = err instanceof Error ? err.message : "Unknown error";
        setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status: "failed", error } : p)));
      }
    }

    setResult(out);
    onDone(out);
  };

  return (
    <Modal
      title={result ? "Offboarding finished" : running ? `Offboarding ${username}…` : `Offboard ${username}`}
      subtitle={
        result
          ? `Removed from ${plural(result.removedRepos.length, "repo")}, revoked ${plural(result.revokedInvites.length, "invite")}${result.failed ? `, ${result.failed} failed` : ""}.`
          : "Revoke all of this person's access in one go."
      }
      tone="red"
      icon={<WarningIcon className="w-5 h-5" />}
      busy={running}
      onClose={onClose}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose} autoFocus>
            Close
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={running}>
              Cancel
            </Button>
            <Button variant="danger" onClick={run} disabled={!confirmed || total === 0} loading={running}>
              Offboard
            </Button>
          </>
        )
      }
    >
      {progress ? (
        <RepoProgressList items={progress} labels={{ working: "Working…", done: "Done", failed: "Failed" }} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="space-y-4"
        >
          <ul className="text-sm text-gray-300 space-y-1 list-disc pl-5">
            <li>
              Remove from <span className="font-medium text-gray-100">{plural(repos.length, "repository", "repositories")}</span>
            </li>
            <li>
              Revoke <span className="font-medium text-gray-100">{plural(invitations.length, "pending invitation")}</span>
            </li>
          </ul>
          <p className="text-xs text-gray-500">
            Their forks and any deploy keys or tokens they created are not affected — check those separately.
          </p>
          <div>
            <label htmlFor="offboard-confirm" className="block text-sm text-gray-300 mb-1.5">
              Type <span className="font-mono text-gray-100">{username}</span> to confirm
            </label>
            <input
              id="offboard-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
            />
          </div>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}
