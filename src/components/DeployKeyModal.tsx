"use client";

import { useState } from "react";
import { Button, CheckSquare, Modal, inputClass } from "@/components/ui";
import { KeyIcon } from "@/components/icons";
import { postJson } from "@/lib/api";

const KEY_PREFIX = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) /;

export function DeployKeyModal({
  repo,
  onClose,
  onSuccess,
}: {
  repo: string;
  onClose: () => void;
  onSuccess: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [allowWrite, setAllowWrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedKey = key.trim();
  const looksPrivate = trimmedKey.includes("PRIVATE KEY");
  const keyError =
    trimmedKey.length === 0
      ? null
      : looksPrivate
        ? "That's a private key — never paste it anywhere. Use the matching .pub file."
        : !KEY_PREFIX.test(trimmedKey)
          ? "Expected an SSH public key starting with ssh-ed25519, ssh-rsa or ecdsa-sha2-…"
          : null;
  const canSubmit = title.trim().length > 0 && trimmedKey.length > 0 && !keyError && !loading;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await postJson(
        "/api/deploy-keys/create",
        { repo, title: title.trim(), key: trimmedKey, readOnly: !allowWrite },
        "Failed to add deploy key"
      );
      onSuccess(title.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add deploy key"
      subtitle={<>An SSH key that can clone {repo} (and only {repo})</>}
      tone="amber"
      icon={<KeyIcon className="w-5 h-5" />}
      busy={loading}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => handleSubmit()} disabled={!canSubmit} loading={loading}>
            Add key
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="dk-title" className="block text-sm font-medium text-gray-300 mb-1.5">
            Title
          </label>
          <input
            id="dk-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="e.g. production server"
            autoFocus
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="dk-key" className="block text-sm font-medium text-gray-300 mb-1.5">
            Public key
          </label>
          <textarea
            id="dk-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder="ssh-ed25519 AAAAC3Nza… user@host"
            className={`${inputClass} font-mono text-xs resize-y ${keyError ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" : ""}`}
          />
          {keyError ? (
            <p className="mt-1.5 text-xs text-red-400">{keyError}</p>
          ) : (
            <p className="mt-1.5 text-xs text-gray-500">
              Paste the contents of the <code>.pub</code> file. A key can only be used on one repository.
            </p>
          )}
        </div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={allowWrite} onChange={(e) => setAllowWrite(e.target.checked)} className="sr-only" />
          <span className="mt-0.5">
            <CheckSquare checked={allowWrite} tone="red" />
          </span>
          <span className="text-sm text-gray-300">
            Allow write access
            <span className="block text-xs text-gray-500">
              Lets anything holding the private key push code. Leave off unless it really needs to push.
            </span>
          </span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
