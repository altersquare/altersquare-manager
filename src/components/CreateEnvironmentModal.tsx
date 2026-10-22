"use client";

import { useState } from "react";
import { Button, Modal, inputClass } from "@/components/ui";
import { ServerIcon } from "@/components/icons";
import { postJson } from "@/lib/api";

interface CreateEnvironmentModalProps {
  repo: string;
  existing: string[];
  onClose: () => void;
  onSuccess: (name: string) => void;
}

const SUGGESTIONS = ["production", "staging", "development"];

export function CreateEnvironmentModal({
  repo,
  existing,
  onClose,
  onSuccess,
}: CreateEnvironmentModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const taken = existing.some((e) => e.toLowerCase() === trimmed.toLowerCase());
  const nameError =
    trimmed.length > 255
      ? "Environment name must be 255 characters or fewer."
      : taken
        ? "An environment with this name already exists."
        : null;
  const canSubmit = trimmed.length > 0 && nameError === null && !loading;
  const quickPicks = SUGGESTIONS.filter(
    (s) => !existing.some((e) => e.toLowerCase() === s)
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/environments/create", { repo, name: trimmed }, "Failed to create environment");
      onSuccess(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <Modal
      title="New environment"
      subtitle={<>Scope secrets and variables to a deployment target in {repo}</>}
      icon={<ServerIcon className="w-5 h-5" />}
      busy={loading}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => handleSubmit()} disabled={!canSubmit} loading={loading}>
            Create environment
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="env-name" className="block text-sm font-medium text-gray-300 mb-1.5">
            Name
          </label>
          <input
            id="env-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            placeholder="e.g. production"
            autoFocus
            autoComplete="off"
            className={`${inputClass} ${nameError ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" : ""}`}
          />
          {nameError && <p className="mt-1.5 text-xs text-red-400">{nameError}</p>}
        </div>
        {quickPicks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">Quick pick:</span>
            {quickPicks.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                className="px-2 py-0.5 text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-500 cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
