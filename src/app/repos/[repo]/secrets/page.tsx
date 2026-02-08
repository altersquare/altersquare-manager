"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { SecretModal } from "@/components/SecretModal";

interface Secret {
  name: string;
  created_at: string;
  updated_at: string;
}

export default function RepoSecretsPage() {
  const params = useParams<{ repo: string }>();
  const repo = decodeURIComponent(params.repo);
  const { showToast } = useToast();

  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [secretModal, setSecretModal] = useState<{
    open: boolean;
    mode: "create" | "update";
    secretName?: string;
  }>({ open: false, mode: "create" });

  const fetchSecrets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/secrets?repo=${encodeURIComponent(repo)}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch secrets");
      }
      const data = await res.json();
      setSecrets(data.secrets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load secrets";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link + heading */}
      <div className="mb-8">
        <Link
          href="/repos"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Repos
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{repo}</h1>
            <p className="text-gray-400 text-sm mt-1">
              Actions Secrets
            </p>
          </div>
          <button
            onClick={() =>
              setSecretModal({ open: true, mode: "create" })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Secret
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-800/50 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-gray-700 rounded" />
                <div className="h-3 w-32 bg-gray-700/60 rounded" />
              </div>
              <div className="h-8 w-20 bg-gray-700 rounded-lg" />
              <div className="h-8 w-20 bg-gray-700 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-red-500/50 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">
            Failed to load secrets
          </h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchSecrets}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && secrets.length === 0 && (
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">
            No secrets yet
          </h2>
          <p className="text-gray-500 text-sm">
            Add your first Actions secret to get started.
          </p>
        </div>
      )}

      {/* Secrets list */}
      {!loading && !error && secrets.length > 0 && (
        <div className="space-y-3">
          {secrets.map((secret, idx) => (
            <div
              key={secret.name}
              className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex items-start sm:items-center gap-4 hover:bg-gray-800/80 transition-colors animate-fade-in-up"
              style={{ animationDelay: `${idx * 20}ms` }}
            >
              {/* Secret icon */}
              <div className="shrink-0 mt-0.5 sm:mt-0">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <svg
                    className="w-4.5 h-4.5 text-amber-400"
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
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-mono font-medium text-sm truncate">
                  {secret.name}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Updated {formatDate(secret.updated_at)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    setSecretModal({
                      open: true,
                      mode: "update",
                      secretName: secret.name,
                    })
                  }
                  className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700/60 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                >
                  Update
                </button>
                <button
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("open-delete-secret-modal", {
                        detail: { secretName: secret.name },
                      })
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Secret create/update modal */}
      {secretModal.open && (
        <SecretModal
          mode={secretModal.mode}
          secretName={secretModal.secretName}
          repo={repo}
          onClose={() => setSecretModal({ open: false, mode: "create" })}
          onSuccess={() => {
            setSecretModal({ open: false, mode: "create" });
            showToast(
              secretModal.mode === "create"
                ? "Secret created successfully"
                : "Secret updated successfully",
              "success"
            );
            fetchSecrets();
          }}
        />
      )}
    </main>
  );
}
