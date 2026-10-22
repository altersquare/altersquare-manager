"use client";

import { useState } from "react";
import { Button, Modal, inputClass } from "@/components/ui";
import { KeyIcon, VariableIcon } from "@/components/icons";
import { postJson } from "@/lib/api";

export type EntryKind = "secret" | "variable";

interface EntryModalProps {
  kind: EntryKind;
  mode: "create" | "update";
  repo: string;
  env?: string; // when set, targets environment-scoped endpoints
  initialName?: string;
  initialValue?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const NAME_PATTERN = /^[A-Z0-9_]+$/;

function validateName(name: string, label: string): string | null {
  if (name.length === 0) return null; // no error while empty
  if (!NAME_PATTERN.test(name)) {
    return "Only uppercase letters (A-Z), digits (0-9), and underscores (_) are allowed.";
  }
  if (name.startsWith("GITHUB_")) return `${label} names cannot start with GITHUB_.`;
  if (/^[0-9]/.test(name)) return `${label} names cannot start with a digit.`;
  return null;
}

/** Turns "my-api key" into "MY_API_KEY" so the user can accept a valid name in one click. */
function suggestName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function endpointFor(kind: EntryKind, mode: "create" | "update", env?: string) {
  const base = env ? "/api/environments" : "/api";
  if (kind === "secret") return `${base}/secrets/create`; // secrets endpoint is an upsert
  return `${base}/variables/${mode === "create" ? "create" : "update"}`;
}

/** Create or update a repository / environment secret or variable. */
export function EntryModal({
  kind,
  mode,
  repo,
  env,
  initialName,
  initialValue,
  onClose,
  onSuccess,
}: EntryModalProps) {
  const label = kind === "secret" ? "Secret" : "Variable";
  const [name, setName] = useState(initialName ?? "");
  const [value, setValue] = useState(initialValue ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = validateName(name, label);
  const suggestion = nameError ? suggestName(name) : "";
  const canUseSuggestion = suggestion.length > 0 && validateName(suggestion, label) === null;
  const valueRequired = kind === "secret";
  const canSubmit =
    name.length > 0 && nameError === null && (!valueRequired || value.length > 0) && !loading;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string> = { repo, name, value };
      if (env) body.env = env;
      await postJson(endpointFor(kind, mode, env), body, `Failed to save ${kind}`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const scope = env ? (
    <>
      Environment <span className="text-gray-200 font-medium">{env}</span> in {repo}
    </>
  ) : (
    <>Repository-wide in {repo}</>
  );

  return (
    <Modal
      title={mode === "create" ? `New ${kind}` : `Edit ${initialName}`}
      subtitle={scope}
      tone={kind === "secret" ? "amber" : "blue"}
      icon={kind === "secret" ? <KeyIcon className="w-5 h-5" /> : <VariableIcon className="w-5 h-5" />}
      busy={loading}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => handleSubmit()} disabled={!canSubmit} loading={loading}>
            {mode === "create" ? `Create ${kind}` : "Save changes"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "create" && (
          <div>
            <label htmlFor="entry-name" className="block text-sm font-medium text-gray-300 mb-1.5">
              Name
            </label>
            <input
              id="entry-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder={kind === "secret" ? "API_KEY" : "NODE_ENV"}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} font-mono ${nameError ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" : ""}`}
            />
            {nameError ? (
              <p className="mt-1.5 text-xs text-red-400">
                {nameError}
                {canUseSuggestion && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setName(suggestion)}
                      className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                    >
                      Use <span className="font-mono">{suggestion}</span>
                    </button>
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">Uppercase letters, digits and underscores.</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="entry-value" className="block text-sm font-medium text-gray-300 mb-1.5">
            {mode === "update" && kind === "secret" ? "New value" : "Value"}
          </label>
          <textarea
            id="entry-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
            }}
            disabled={loading}
            rows={4}
            autoFocus={mode === "update"}
            spellCheck={false}
            placeholder={kind === "secret" ? "Paste the secret value" : "Variable value"}
            className={`${inputClass} font-mono resize-y min-h-24`}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            {kind === "secret"
              ? mode === "update"
                ? "Secret values can't be read back from GitHub — this replaces the current value."
                : "Encrypted before it leaves the server. You won't be able to view it again."
              : "Variables are stored as plain text and visible to anyone with repo access."}{" "}
            <span className="hidden sm:inline text-gray-600">Ctrl+Enter to save.</span>
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {/* Lets Enter in the name field submit the form */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
