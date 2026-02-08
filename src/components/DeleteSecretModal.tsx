"use client";

import { useState } from "react";

interface DeleteSecretModalProps {
  secretName: string;
  repo: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteSecretModal({
  secretName,
  repo,
  onClose,
  onSuccess,
}: DeleteSecretModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/secrets/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, name: secretName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete secret");
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
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Warning icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-center mb-2">
          Delete Secret
        </h3>
        <p className="text-gray-400 text-center text-sm mb-6">
          Are you sure you want to delete{" "}
          <span className="text-white font-medium font-mono">
            {secretName}
          </span>
          ? This action cannot be undone.
        </p>

        {/* Request error */}
        {error && (
          <p className="text-sm text-red-400 text-center mb-4">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
