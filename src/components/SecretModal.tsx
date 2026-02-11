"use client";

import { useState, useEffect } from "react";

interface SecretModalProps {
  mode: "create" | "update";
  secretName?: string;
  repo: string;
  env?: string; // when set, targets environment-scoped secret endpoints
  onClose: () => void;
  onSuccess: () => void;
}

const SECRET_NAME_PATTERN = /^[A-Z0-9_]+$/;

function validateName(name: string): string | null {
  if (name.length === 0) return null; // no error while empty
  if (!SECRET_NAME_PATTERN.test(name)) {
    return "Only uppercase letters (A-Z), digits (0-9), and underscores (_) are allowed.";
  }
  if (name.startsWith("GITHUB_")) {
    return "Secret names cannot start with the GITHUB_ prefix.";
  }
  return null;
}

export function SecretModal({
  mode,
  secretName,
  repo,
  env,
  onClose,
  onSuccess,
}: SecretModalProps) {
  const [name, setName] = useState(secretName ?? "");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = validateName(name);
  const canSubmit =
    name.length > 0 &&
    value.length > 0 &&
    nameError === null &&
    !loading;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const url = env ? "/api/environments/secrets/create" : "/api/secrets/create";
      const body: Record<string, string> = { repo, name, value };
      if (env) body.env = env;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save secret");
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="secret-modal-title"
        className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-amber-500/10">
          <svg
            className="w-6 h-6 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>

        <h3 id="secret-modal-title" className="text-lg font-semibold text-center mb-1">
          {mode === "create" ? "New Secret" : "Update Secret"}
        </h3>
        {env && (
          <p className="text-gray-500 text-center text-xs mb-5">
            Scope: {env} environment
          </p>
        )}
        {!env && <div className="mb-5" />}

        {/* Form */}
        <div className="space-y-4">
          {/* Secret Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Secret Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === "update" || loading}
              placeholder="MY_SECRET_NAME"
              className={`w-full px-3 py-2.5 bg-gray-800 border rounded-lg text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:ring-2 transition-colors ${
                nameError
                  ? "border-red-500/50 focus:ring-red-500/30"
                  : "border-gray-700 focus:ring-blue-500/30 focus:border-blue-500/50"
              } ${mode === "update" ? "opacity-60 cursor-not-allowed" : ""}`}
            />
            {nameError && (
              <p className="mt-1.5 text-xs text-red-400">{nameError}</p>
            )}
          </div>

          {/* Secret Value */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Secret Value
            </label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={loading}
              rows={4}
              placeholder="Enter secret value…"
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors resize-none"
            />
          </div>

          {/* Request error */}
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {loading && (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {mode === "create" ? "Create Secret" : "Update Secret"}
          </button>
        </div>
      </div>
    </div>
  );
}
