"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { SecretModal } from "@/components/SecretModal";
import { DeleteSecretModal } from "@/components/DeleteSecretModal";
import { RevokeInviteModal } from "@/components/RevokeInviteModal";
import { VariableModal } from "@/components/VariableModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { CreateEnvironmentModal } from "@/components/CreateEnvironmentModal";

// ── Types ───────────────────────────────────────────────────────────

interface Secret {
  name: string;
  created_at: string;
  updated_at: string;
}

interface Variable {
  name: string;
  value: string;
  created_at: string;
  updated_at: string;
}

interface Environment {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface PendingInvitation {
  id: number;
  username: string;
  avatarUrl: string;
  createdAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function SectionHeading({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {title}
        </h2>
        {count !== undefined && (
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-700/60 text-gray-400 border border-gray-700 rounded-full">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
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
  );
}

function EmptyState({
  icon,
  text,
  sub,
}: {
  icon: React.ReactNode;
  text: string;
  sub?: string;
}) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 mx-auto text-gray-600 mb-3">{icon}</div>
      <p className="text-gray-400 font-medium text-sm">{text}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ── Secret icons ────────────────────────────────────────────────────

const KeyIcon = () => (
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
);

const VariableIcon = () => (
  <svg
    className="w-4.5 h-4.5 text-blue-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

// ── Main Page ───────────────────────────────────────────────────────

export default function RepoManagePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const params = useParams<{ repo: string }>();
  const repo = decodeURIComponent(params.repo);
  const { showToast } = useToast();

  // ── Repo Secrets ──────────────────────────────────────────────────
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(true);
  const [secretsError, setSecretsError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [secretModal, setSecretModal] = useState<{
    open: boolean;
    mode: "create" | "update";
    secretName?: string;
    env?: string;
  }>({ open: false, mode: "create" });

  const [deleteSecretModal, setDeleteSecretModal] = useState<{
    open: boolean;
    secretName: string;
  }>({ open: false, secretName: "" });

  // ── Repo Variables ────────────────────────────────────────────────
  const [variables, setVariables] = useState<Variable[]>([]);
  const [variablesLoading, setVariablesLoading] = useState(true);
  const [variablesError, setVariablesError] = useState<string | null>(null);

  const [variableModal, setVariableModal] = useState<{
    open: boolean;
    mode: "create" | "update";
    variableName?: string;
    variableValue?: string;
    env?: string;
  }>({ open: false, mode: "create" });

  const [deleteVariableModal, setDeleteVariableModal] = useState<{
    open: boolean;
    variableName: string;
    env?: string;
  }>({ open: false, variableName: "" });

  // ── Environments ──────────────────────────────────────────────────
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [environmentsLoading, setEnvironmentsLoading] = useState(true);
  const [environmentsError, setEnvironmentsError] = useState<string | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<string>("");
  const [createEnvModal, setCreateEnvModal] = useState(false);
  const [deleteEnvModal, setDeleteEnvModal] = useState(false);

  // ── Environment Secrets & Variables ───────────────────────────────
  const [envSecrets, setEnvSecrets] = useState<Secret[]>([]);
  const [envSecretsLoading, setEnvSecretsLoading] = useState(false);
  const [envVariables, setEnvVariables] = useState<Variable[]>([]);
  const [envVariablesLoading, setEnvVariablesLoading] = useState(false);

  // ── Invitations ───────────────────────────────────────────────────
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [revokeModal, setRevokeModal] = useState<{
    open: boolean;
    username: string;
    invitationId: number;
  }>({ open: false, username: "", invitationId: 0 });

  // ── Data fetching ─────────────────────────────────────────────────

  const fetchSecrets = useCallback(async () => {
    setSecretsLoading(true);
    setSecretsError(null);
    setAccessDenied(false);
    try {
      const res = await fetch(`/api/secrets?repo=${encodeURIComponent(repo)}`);
      if (!res.ok) {
        if (res.status === 403) {
          const err = await res.json();
          if (err.error?.includes("not a collaborator")) {
            setAccessDenied(true);
            return;
          }
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch secrets");
      }
      const data = await res.json();
      setSecrets(data.secrets);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load secrets";
      setSecretsError(msg);
    } finally {
      setSecretsLoading(false);
    }
  }, [repo]);

  const fetchVariables = useCallback(async () => {
    setVariablesLoading(true);
    setVariablesError(null);
    try {
      const res = await fetch(
        `/api/variables?repo=${encodeURIComponent(repo)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch variables");
      }
      const data = await res.json();
      setVariables(data.variables);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load variables";
      setVariablesError(msg);
    } finally {
      setVariablesLoading(false);
    }
  }, [repo]);

  const fetchEnvironments = useCallback(async () => {
    setEnvironmentsLoading(true);
    setEnvironmentsError(null);
    try {
      const res = await fetch(
        `/api/environments?repo=${encodeURIComponent(repo)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch environments");
      }
      const data = await res.json();
      setEnvironments(data.environments);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load environments";
      setEnvironmentsError(msg);
      showToast(msg, "error");
    } finally {
      setEnvironmentsLoading(false);
    }
  }, [repo, showToast]);

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await fetch(
        `/api/repos/invitations?repo=${encodeURIComponent(repo)}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch invitations");
      }
      const data = await res.json();
      setInvitations(data.invitations);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load invitations";
      showToast(msg, "error");
    } finally {
      setInvitationsLoading(false);
    }
  }, [repo, showToast]);

  const fetchEnvSecrets = useCallback(
    async (env: string) => {
      setEnvSecretsLoading(true);
      try {
        const res = await fetch(
          `/api/environments/secrets?repo=${encodeURIComponent(repo)}&env=${encodeURIComponent(env)}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to fetch environment secrets");
        }
        const data = await res.json();
        setEnvSecrets(data.secrets);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load environment secrets";
        showToast(msg, "error");
        setEnvSecrets([]);
      } finally {
        setEnvSecretsLoading(false);
      }
    },
    [repo, showToast]
  );

  const fetchEnvVariables = useCallback(
    async (env: string) => {
      setEnvVariablesLoading(true);
      try {
        const res = await fetch(
          `/api/environments/variables?repo=${encodeURIComponent(repo)}&env=${encodeURIComponent(env)}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            err.error || "Failed to fetch environment variables"
          );
        }
        const data = await res.json();
        setEnvVariables(data.variables);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load environment variables";
        showToast(msg, "error");
        setEnvVariables([]);
      } finally {
        setEnvVariablesLoading(false);
      }
    },
    [repo, showToast]
  );

  // Initial load
  useEffect(() => {
    fetchSecrets();
    fetchVariables();
    fetchEnvironments();
    fetchInvitations();
  }, [fetchSecrets, fetchVariables, fetchEnvironments, fetchInvitations]);

  // When selected environment changes, fetch its secrets & variables
  useEffect(() => {
    if (selectedEnv) {
      fetchEnvSecrets(selectedEnv);
      fetchEnvVariables(selectedEnv);
    } else {
      setEnvSecrets([]);
      setEnvVariables([]);
    }
  }, [selectedEnv, fetchEnvSecrets, fetchEnvVariables]);

  // ── Delete helpers ────────────────────────────────────────────────

  const handleDeleteVariable = async (name: string, env?: string) => {
    const url = env
      ? "/api/environments/variables/delete"
      : "/api/variables/delete";
    const body: Record<string, string> = { repo, name };
    if (env) body.env = env;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete variable");
    }
  };

  const handleDeleteEnvSecret = async (name: string, env: string) => {
    const res = await fetch("/api/environments/secrets/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, env, name }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete secret");
    }
  };

  const handleDeleteEnvironment = async () => {
    const res = await fetch("/api/environments/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, name: selectedEnv }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete environment");
    }
  };

  // ── Access denied ─────────────────────────────────────────────────

  if (!secretsLoading && accessDenied) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/repos"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Repos
          </Link>
        </div>
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-yellow-500/50 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">
            You don&apos;t have access to this repository
          </h2>
          <p className="text-gray-500 mb-4">
            You are not a collaborator on this repository.
          </p>
          <Link
            href="/repos"
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Back to Repos
          </Link>
        </div>
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* ── Header ───────────────────────────────────────────────── */}
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
        <h1 className="text-3xl font-bold">{repo}</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage secrets, variables &amp; environments
        </p>
      </div>

      {/* ── Pending Invitations ──────────────────────────────────── */}
      {invitationsLoading && (
        <div className="mb-8 animate-pulse space-y-3">
          <div className="h-5 w-44 bg-gray-700 rounded mb-3" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-800/50 rounded-xl p-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 bg-gray-700 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 bg-gray-700 rounded" />
                <div className="h-3 w-20 bg-gray-700/60 rounded" />
              </div>
              <div className="h-7 w-16 bg-gray-700 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {!invitationsLoading && invitations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Pending Invitations
            </h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full">
              {invitations.length}
            </span>
          </div>
          <div className="space-y-2">
            {invitations.map((inv, idx) => (
              <div
                key={inv.id}
                className="bg-gray-800/50 border border-gray-800 rounded-xl p-3 flex items-center gap-3 hover:bg-gray-800/80 transition-colors animate-fade-in-up"
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <img
                  src={inv.avatarUrl}
                  alt={inv.username}
                  className="w-8 h-8 rounded-full border border-gray-700"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{inv.username}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Sent {formatDate(inv.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setRevokeModal({
                      open: true,
                      username: inv.username,
                      invitationId: inv.id,
                    })
                  }
                  disabled={!isAdmin}
                  title={!isAdmin ? "Admin only" : undefined}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                    isAdmin
                      ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                      : "text-red-400/40 bg-red-500/5 border-red-500/10 cursor-not-allowed opacity-50"
                  }`}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Repository Secrets ───────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeading title="Repository Secrets" count={secrets.length}>
          <button
            onClick={() =>
              setSecretModal({ open: true, mode: "create" })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <PlusIcon />
            Add Secret
          </button>
        </SectionHeading>

        {secretsLoading && <ListSkeleton />}

        {secretsError && !secretsLoading && (
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-2">{secretsError}</p>
            <button
              onClick={fetchSecrets}
              className="text-sm text-blue-400 hover:text-blue-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!secretsLoading && !secretsError && secrets.length === 0 && (
          <EmptyState
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            }
            text="No secrets yet"
            sub="Add your first Actions secret to get started."
          />
        )}

        {!secretsLoading && !secretsError && secrets.length > 0 && (
          <div className="space-y-2">
            {secrets.map((secret, idx) => (
              <div
                key={secret.name}
                className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex items-start sm:items-center gap-4 hover:bg-gray-800/80 transition-colors animate-fade-in-up"
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <div className="shrink-0 mt-0.5 sm:mt-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <KeyIcon />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-medium text-sm truncate">
                    {secret.name}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Updated {formatDate(secret.updated_at)}
                  </p>
                </div>
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
                      setDeleteSecretModal({
                        open: true,
                        secretName: secret.name,
                      })
                    }
                    disabled={!isAdmin}
                    title={!isAdmin ? "Admin only" : undefined}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                      isAdmin
                        ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                        : "text-red-400/40 bg-red-500/5 border-red-500/10 cursor-not-allowed opacity-50"
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Repository Variables ──────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeading title="Repository Variables" count={variables.length}>
          <button
            onClick={() =>
              setVariableModal({ open: true, mode: "create" })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <PlusIcon />
            Add Variable
          </button>
        </SectionHeading>

        {variablesLoading && <ListSkeleton />}

        {variablesError && !variablesLoading && (
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-2">{variablesError}</p>
            <button
              onClick={fetchVariables}
              className="text-sm text-blue-400 hover:text-blue-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!variablesLoading && !variablesError && variables.length === 0 && (
          <EmptyState
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            }
            text="No variables yet"
            sub="Add your first Actions variable to get started."
          />
        )}

        {!variablesLoading && !variablesError && variables.length > 0 && (
          <div className="space-y-2">
            {variables.map((v, idx) => (
              <div
                key={v.name}
                className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex items-start sm:items-center gap-4 hover:bg-gray-800/80 transition-colors animate-fade-in-up"
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <div className="shrink-0 mt-0.5 sm:mt-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <VariableIcon />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-medium text-sm truncate">
                    {v.name}
                  </p>
                  <p className="text-gray-400 text-xs mt-1 font-mono truncate max-w-md">
                    {v.value || <span className="italic text-gray-600">(empty)</span>}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Updated {formatDate(v.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setVariableModal({
                        open: true,
                        mode: "update",
                        variableName: v.name,
                        variableValue: v.value,
                      })
                    }
                    className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700/60 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                  >
                    Update
                  </button>
                  <button
                    onClick={() =>
                      setDeleteVariableModal({
                        open: true,
                        variableName: v.name,
                      })
                    }
                    disabled={!isAdmin}
                    title={!isAdmin ? "Admin only" : undefined}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                      isAdmin
                        ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                        : "text-red-400/40 bg-red-500/5 border-red-500/10 cursor-not-allowed opacity-50"
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Environments ─────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeading
          title="Environments"
          count={environments.length}
        >
          <button
            onClick={() => setCreateEnvModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <PlusIcon />
            New Environment
          </button>
        </SectionHeading>

        {environmentsLoading && (
          <div className="animate-pulse h-10 bg-gray-800/50 rounded-lg" />
        )}

        {!environmentsLoading && environments.length === 0 && !environmentsError && (
          <EmptyState
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            }
            text="No environments yet"
            sub="Create an environment to scope secrets and variables."
          />
        )}

        {environmentsError && !environmentsLoading && (
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-2">{environmentsError}</p>
            <button
              onClick={fetchEnvironments}
              className="text-sm text-blue-400 hover:text-blue-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!environmentsLoading && !environmentsError && environments.length > 0 && (
          <>
            {/* Env selector */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <select
                  value={selectedEnv}
                  onChange={(e) => setSelectedEnv(e.target.value)}
                  className="appearance-none w-full px-4 py-2.5 pr-9 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  <option value="">Select an environment…</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.name}>
                      {env.name}
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              {selectedEnv && isAdmin && (
                <button
                  onClick={() => setDeleteEnvModal(true)}
                  className="px-3 py-2.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                >
                  Delete Environment
                </button>
              )}
              {selectedEnv && !isAdmin && (
                <button
                  disabled
                  title="Admin only"
                  className="px-3 py-2.5 text-xs font-medium text-red-400/40 bg-red-500/5 border border-red-500/10 rounded-lg cursor-not-allowed opacity-50"
                >
                  Delete Environment
                </button>
              )}
            </div>

            {/* Content for selected environment */}
            {!selectedEnv && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  Select an environment above to manage its secrets and
                  variables.
                </p>
              </div>
            )}

            {selectedEnv && (
              <div className="space-y-8 border-l-2 border-gray-800 pl-4 ml-2">
                {/* ── Env Secrets ───────────────────────────────── */}
                <div>
                  <SectionHeading
                    title={`${selectedEnv} Secrets`}
                    count={envSecrets.length}
                  >
                    <button
                      onClick={() =>
                        setSecretModal({
                          open: true,
                          mode: "create",
                          env: selectedEnv,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <PlusIcon />
                      Add Secret
                    </button>
                  </SectionHeading>

                  {envSecretsLoading && <ListSkeleton rows={2} />}

                  {!envSecretsLoading && envSecrets.length === 0 && (
                    <EmptyState
                      icon={
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      }
                      text="No environment secrets yet"
                    />
                  )}

                  {!envSecretsLoading && envSecrets.length > 0 && (
                    <div className="space-y-2">
                      {envSecrets.map((secret, idx) => (
                        <div
                          key={secret.name}
                          className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex items-start sm:items-center gap-4 hover:bg-gray-800/80 transition-colors animate-fade-in-up"
                          style={{ animationDelay: `${idx * 20}ms` }}
                        >
                          <div className="shrink-0 mt-0.5 sm:mt-0">
                            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                              <KeyIcon />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-medium text-sm truncate">
                              {secret.name}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              Updated {formatDate(secret.updated_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() =>
                                setSecretModal({
                                  open: true,
                                  mode: "update",
                                  secretName: secret.name,
                                  env: selectedEnv,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700/60 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                            >
                              Update
                            </button>
                            <button
                              onClick={() =>
                                setDeleteSecretModal({
                                  open: true,
                                  secretName: `env:${selectedEnv}:${secret.name}`,
                                })
                              }
                              disabled={!isAdmin}
                              title={!isAdmin ? "Admin only" : undefined}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                                isAdmin
                                  ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                                  : "text-red-400/40 bg-red-500/5 border-red-500/10 cursor-not-allowed opacity-50"
                              }`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Env Variables ─────────────────────────────── */}
                <div>
                  <SectionHeading
                    title={`${selectedEnv} Variables`}
                    count={envVariables.length}
                  >
                    <button
                      onClick={() =>
                        setVariableModal({
                          open: true,
                          mode: "create",
                          env: selectedEnv,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <PlusIcon />
                      Add Variable
                    </button>
                  </SectionHeading>

                  {envVariablesLoading && <ListSkeleton rows={2} />}

                  {!envVariablesLoading && envVariables.length === 0 && (
                    <EmptyState
                      icon={
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      }
                      text="No environment variables yet"
                    />
                  )}

                  {!envVariablesLoading && envVariables.length > 0 && (
                    <div className="space-y-2">
                      {envVariables.map((v, idx) => (
                        <div
                          key={v.name}
                          className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex items-start sm:items-center gap-4 hover:bg-gray-800/80 transition-colors animate-fade-in-up"
                          style={{ animationDelay: `${idx * 20}ms` }}
                        >
                          <div className="shrink-0 mt-0.5 sm:mt-0">
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                              <VariableIcon />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-medium text-sm truncate">
                              {v.name}
                            </p>
                            <p className="text-gray-400 text-xs mt-1 font-mono truncate max-w-md">
                              {v.value || (
                                <span className="italic text-gray-600">
                                  (empty)
                                </span>
                              )}
                            </p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              Updated {formatDate(v.updated_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() =>
                                setVariableModal({
                                  open: true,
                                  mode: "update",
                                  variableName: v.name,
                                  variableValue: v.value,
                                  env: selectedEnv,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700/60 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                            >
                              Update
                            </button>
                            <button
                              onClick={() =>
                                setDeleteVariableModal({
                                  open: true,
                                  variableName: v.name,
                                  env: selectedEnv,
                                })
                              }
                              disabled={!isAdmin}
                              title={!isAdmin ? "Admin only" : undefined}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                                isAdmin
                                  ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                                  : "text-red-400/40 bg-red-500/5 border-red-500/10 cursor-not-allowed opacity-50"
                              }`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Modals ───────────────────────────────────────────────── */}

      {/* Revoke invitation */}
      {revokeModal.open && (
        <RevokeInviteModal
          username={revokeModal.username}
          repo={repo}
          invitationId={revokeModal.invitationId}
          onClose={() =>
            setRevokeModal({ open: false, username: "", invitationId: 0 })
          }
          onSuccess={() => {
            setRevokeModal({ open: false, username: "", invitationId: 0 });
            showToast("Invitation revoked", "success");
            fetchInvitations();
          }}
        />
      )}

      {/* Delete repo secret */}
      {deleteSecretModal.open &&
        !deleteSecretModal.secretName.startsWith("env:") && (
          <DeleteSecretModal
            secretName={deleteSecretModal.secretName}
            repo={repo}
            onClose={() =>
              setDeleteSecretModal({ open: false, secretName: "" })
            }
            onSuccess={() => {
              setDeleteSecretModal({ open: false, secretName: "" });
              showToast("Secret deleted successfully", "success");
              fetchSecrets();
            }}
          />
        )}

      {/* Delete env secret */}
      {deleteSecretModal.open &&
        deleteSecretModal.secretName.startsWith("env:") && (() => {
          const parts = deleteSecretModal.secretName.split(":");
          const envName = parts[1];
          const secretName = parts.slice(2).join(":");
          return (
            <DeleteConfirmModal
              title="Delete Environment Secret"
              message={`Are you sure you want to delete`}
              itemName={secretName}
              onConfirm={() => handleDeleteEnvSecret(secretName, envName)}
              onClose={() =>
                setDeleteSecretModal({ open: false, secretName: "" })
              }
              onSuccess={() => {
                setDeleteSecretModal({ open: false, secretName: "" });
                showToast("Environment secret deleted", "success");
                fetchEnvSecrets(envName);
              }}
            />
          );
        })()}

      {/* Secret create/update (repo or env) */}
      {secretModal.open && (
        <SecretModal
          mode={secretModal.mode}
          secretName={secretModal.secretName}
          repo={repo}
          env={secretModal.env}
          onClose={() => setSecretModal({ open: false, mode: "create" })}
          onSuccess={() => {
            const wasEnv = secretModal.env;
            setSecretModal({ open: false, mode: "create" });
            showToast(
              secretModal.mode === "create"
                ? "Secret created successfully"
                : "Secret updated successfully",
              "success"
            );
            if (wasEnv) {
              fetchEnvSecrets(wasEnv);
            } else {
              fetchSecrets();
            }
          }}
        />
      )}

      {/* Variable create/update (repo or env) */}
      {variableModal.open && (
        <VariableModal
          mode={variableModal.mode}
          variableName={variableModal.variableName}
          variableValue={variableModal.variableValue}
          repo={repo}
          env={variableModal.env}
          onClose={() => setVariableModal({ open: false, mode: "create" })}
          onSuccess={() => {
            const wasEnv = variableModal.env;
            setVariableModal({ open: false, mode: "create" });
            showToast(
              variableModal.mode === "create"
                ? "Variable created successfully"
                : "Variable updated successfully",
              "success"
            );
            if (wasEnv) {
              fetchEnvVariables(wasEnv);
            } else {
              fetchVariables();
            }
          }}
        />
      )}

      {/* Delete variable (repo or env) */}
      {deleteVariableModal.open && (
        <DeleteConfirmModal
          title="Delete Variable"
          message="Are you sure you want to delete"
          itemName={deleteVariableModal.variableName}
          onConfirm={() =>
            handleDeleteVariable(
              deleteVariableModal.variableName,
              deleteVariableModal.env
            )
          }
          onClose={() =>
            setDeleteVariableModal({ open: false, variableName: "" })
          }
          onSuccess={() => {
            const wasEnv = deleteVariableModal.env;
            setDeleteVariableModal({ open: false, variableName: "" });
            showToast("Variable deleted successfully", "success");
            if (wasEnv) {
              fetchEnvVariables(wasEnv);
            } else {
              fetchVariables();
            }
          }}
        />
      )}

      {/* Create environment */}
      {createEnvModal && (
        <CreateEnvironmentModal
          repo={repo}
          onClose={() => setCreateEnvModal(false)}
          onSuccess={() => {
            setCreateEnvModal(false);
            showToast("Environment created successfully", "success");
            fetchEnvironments();
          }}
        />
      )}

      {/* Delete environment */}
      {deleteEnvModal && selectedEnv && (
        <DeleteConfirmModal
          title="Delete Environment"
          message="Are you sure you want to delete the environment"
          itemName={selectedEnv}
          onConfirm={handleDeleteEnvironment}
          onClose={() => setDeleteEnvModal(false)}
          onSuccess={() => {
            setDeleteEnvModal(false);
            setSelectedEnv("");
            showToast("Environment deleted successfully", "success");
            fetchEnvironments();
          }}
        />
      )}
    </main>
  );
}
