"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { MailIcon, WarningIcon } from "@/components/icons";
import { RepoProgress, RepoProgressList } from "@/components/RepoProgressList";
import { postJson } from "@/lib/api";
import { plural } from "@/lib/format";

export interface BulkInvite {
  id: number;
  repo: string;
  username: string;
}

export interface BulkInviteResult {
  action: "resend" | "revoke";
  succeeded: number[];
  failed: number[];
}

/** Re-send or revoke several invitations in one go, with per-invite progress. */
export function BulkInviteModal({
  action,
  invites,
  onClose,
  onDone,
}: {
  action: "resend" | "revoke";
  invites: BulkInvite[];
  onClose: () => void;
  onDone: (result: BulkInviteResult) => void;
}) {
  const [progress, setProgress] = useState<RepoProgress[] | null>(null);
  const [result, setResult] = useState<BulkInviteResult | null>(null);
  const running = progress !== null && result === null;
  const isResend = action === "resend";
  const people = new Set(invites.map((i) => i.username.toLowerCase())).size;

  const run = async () => {
    setProgress(invites.map((i) => ({ repo: `${i.username} → ${i.repo}`, status: "pending" })));
    const out: BulkInviteResult = { action, succeeded: [], failed: [] };

    for (let idx = 0; idx < invites.length; idx++) {
      const inv = invites[idx];
      setProgress((prev) => prev!.map((p, i) => (i === idx ? { ...p, status: "working" } : p)));
      try {
        if (isResend) {
          await postJson(
            "/api/access/resend",
            { repo: inv.repo, invitationId: inv.id, username: inv.username },
            "Failed to re-send"
          );
        } else {
          await postJson("/api/repos/invitations/revoke", { repo: inv.repo, invitationId: inv.id }, "Failed to revoke");
        }
        out.succeeded.push(inv.id);
        setProgress((prev) => prev!.map((p, i) => (i === idx ? { ...p, status: isResend ? "invited" : "done" } : p)));
      } catch (err) {
        out.failed.push(inv.id);
        const error = err instanceof Error ? err.message : "Unknown error";
        setProgress((prev) => prev!.map((p, i) => (i === idx ? { ...p, status: "failed", error } : p)));
      }
    }

    setResult(out);
    onDone(out);
  };

  const verb = isResend ? "Re-send" : "Revoke";

  return (
    <Modal
      title={result ? "Done" : running ? `${isResend ? "Re-sending" : "Revoking"}…` : `${verb} ${plural(invites.length, "invitation")}`}
      subtitle={
        result
          ? `${isResend ? "Re-sent" : "Revoked"} ${result.succeeded.length}${result.failed.length ? `, ${result.failed.length} failed` : ""}.`
          : `${plural(invites.length, "invitation")} for ${plural(people, "person", "people")}`
      }
      tone={isResend ? "blue" : "red"}
      icon={isResend ? <MailIcon className="w-5 h-5" /> : <WarningIcon className="w-5 h-5" />}
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
            <Button variant={isResend ? "primary" : "danger"} onClick={run} loading={running} autoFocus>
              {verb} {invites.length}
            </Button>
          </>
        )
      }
    >
      {progress ? (
        <RepoProgressList
          items={progress}
          labels={{ working: "Working…", invited: "Re-sent", done: "Revoked", failed: "Failed" }}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            {isResend
              ? "Each old invitation is revoked and a fresh one sent, so GitHub emails the person again and the 7-day clock restarts."
              : "These people won't be able to accept. You can invite them again later."}
          </p>
          <ul className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {invites.map((i) => (
              <li key={i.id} className="px-3 py-1.5 rounded-lg bg-gray-800/60 text-sm text-gray-300 truncate">
                <span className="font-medium text-gray-100">{i.username}</span>
                <span className="text-gray-500"> → </span>
                {i.repo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
