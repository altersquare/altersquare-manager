import { Octokit } from "octokit";
import sodium from "libsodium-wrappers";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_USERNAME || "altersquare";

export interface Repo {
  name: string;
  fullName: string;
  private: boolean;
  url: string;
  description: string | null;
}

/**
 * Fetch all repositories owned by the configured GitHub user.
 * Handles pagination automatically (up to 100 per page).
 */
export async function fetchAllRepos(): Promise<Repo[]> {
  const repos: Repo[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
      sort: "updated",
      affiliation: "owner",
      visibility: "all",
    });

    if (data.length === 0) break;

    for (const repo of data) {
      repos.push({
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        url: repo.html_url,
        description: repo.description,
      });
    }

    if (data.length < 100) break;
    page++;
  }

  return repos;
}

export interface Collaborator {
  username: string;
  avatarUrl: string;
  profileUrl: string;
  repos: string[];
}

/**
 * Fetch collaborators for a single repo.
 * Excludes the repo owner (altersquare) from results.
 * Handles pagination automatically.
 */
export async function fetchCollaborators(
  owner: string,
  repo: string
): Promise<{ username: string; avatarUrl: string; profileUrl: string }[]> {
  const collaborators: {
    username: string;
    avatarUrl: string;
    profileUrl: string;
  }[] = [];
  let page = 1;

  try {
    while (true) {
      const { data } = await octokit.rest.repos.listCollaborators({
        owner,
        repo,
        per_page: 100,
        page,
        affiliation: "all",
      });

      if (data.length === 0) break;

      for (const collab of data) {
        // Exclude the owner from the list
        if (collab.login.toLowerCase() === owner.toLowerCase()) continue;

        collaborators.push({
          username: collab.login,
          avatarUrl: collab.avatar_url,
          profileUrl: collab.html_url,
        });
      }

      if (data.length < 100) break;
      page++;
    }
  } catch (error: unknown) {
    // 403 means we don't have permission to list collaborators for this repo
    // (e.g., forked repos where we're not admin). Skip silently.
    if (error instanceof Error && "status" in error && (error as { status: number }).status === 403) {
      console.warn(`Skipping ${owner}/${repo} — no permission to list collaborators`);
      return [];
    }
    throw error;
  }

  return collaborators;
}

/**
 * Fetch a unified, deduplicated team across all repos.
 * Each team member includes the list of repos they're a collaborator on.
 */
export async function fetchTeam(): Promise<{
  team: Collaborator[];
  repos: Repo[];
}> {
  const repos = await fetchAllRepos();
  const teamMap = new Map<string, Collaborator>();

  // Fetch collaborators for all repos in parallel
  const results = await Promise.allSettled(
    repos.map(async (repo) => {
      const collabs = await fetchCollaborators(OWNER, repo.name);
      return { repoName: repo.name, collabs };
    })
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to fetch collaborators:", result.reason);
      continue;
    }

    const { repoName, collabs } = result.value;
    for (const collab of collabs) {
      const existing = teamMap.get(collab.username.toLowerCase());
      if (existing) {
        existing.repos.push(repoName);
      } else {
        teamMap.set(collab.username.toLowerCase(), {
          username: collab.username,
          avatarUrl: collab.avatarUrl,
          profileUrl: collab.profileUrl,
          repos: [repoName],
        });
      }
    }
  }

  // Sort team alphabetically by username
  const team = Array.from(teamMap.values()).sort((a, b) =>
    a.username.toLowerCase().localeCompare(b.username.toLowerCase())
  );

  return { team, repos };
}

/**
 * Remove a collaborator from a specific repo.
 */
export async function removeCollaborator(
  owner: string,
  repo: string,
  username: string
): Promise<void> {
  await octokit.rest.repos.removeCollaborator({
    owner,
    repo,
    username,
  });
}

/**
 * Add a collaborator to a specific repo with default 'push' permission.
 * Returns 201 for new invitation, 204 if already a collaborator.
 */
export async function addCollaborator(
  owner: string,
  repo: string,
  username: string
): Promise<{ status: number; invitationCreated: boolean }> {
  const { status } = await octokit.rest.repos.addCollaborator({
    owner,
    repo,
    username,
    permission: "push",
  });

  return {
    status,
    invitationCreated: status === 201,
  };
}

// ── Pending Invitations ─────────────────────────────────────────────

export interface PendingInvitation {
  id: number;
  username: string;
  avatarUrl: string;
  createdAt: string;
  /** GitHub expires invitations after 7 days; expired ones must be re-sent. */
  expired: boolean;
}

/**
 * Fetch all pending (unaccepted) collaborator invitations for a repo.
 * Handles pagination automatically.
 */
export async function fetchPendingInvitations(
  owner: string,
  repo: string
): Promise<PendingInvitation[]> {
  const invitations: PendingInvitation[] = [];
  let page = 1;

  try {
    while (true) {
      const { data } = await octokit.rest.repos.listInvitations({
        owner,
        repo,
        per_page: 100,
        page,
      });

      if (data.length === 0) break;

      for (const inv of data) {
        if (!inv.invitee) continue;
        invitations.push({
          id: inv.id,
          username: inv.invitee.login,
          avatarUrl: inv.invitee.avatar_url,
          createdAt: inv.created_at,
          expired: Boolean(inv.expired),
        });
      }

      if (data.length < 100) break;
      page++;
    }
  } catch (error: unknown) {
    if (error instanceof Error && "status" in error && (error as { status: number }).status === 403) {
      console.warn(`Skipping ${owner}/${repo} — no permission to list invitations`);
      return [];
    }
    throw error;
  }

  return invitations;
}

/**
 * Revoke (delete) a pending collaborator invitation.
 */
export async function revokeInvitation(
  owner: string,
  repo: string,
  invitationId: number
): Promise<void> {
  await octokit.rest.repos.deleteInvitation({
    owner,
    repo,
    invitation_id: invitationId,
  });
}

/**
 * Fetch pending invitations across many repos (parallel; per-repo failures are skipped).
 */
export async function fetchAllPendingInvitations(
  repos: string[]
): Promise<(PendingInvitation & { repo: string })[]> {
  const results = await Promise.allSettled(
    repos.map(async (repo) =>
      (await fetchPendingInvitations(OWNER, repo)).map((inv) => ({ ...inv, repo }))
    )
  );
  return results.flatMap((r) => {
    if (r.status === "rejected") {
      console.error("Failed to fetch invitations:", r.reason);
      return [];
    }
    return r.value;
  });
}

// ── Repository Secrets ──────────────────────────────────────────────

export interface RepoSecret {
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * List all Actions secrets for a repository.
 */
export async function listRepoSecrets(repo: string): Promise<RepoSecret[]> {
  const secrets: RepoSecret[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.actions.listRepoSecrets({
      owner: OWNER,
      repo,
      per_page: 100,
      page,
    });

    for (const s of data.secrets) {
      secrets.push({
        name: s.name,
        created_at: s.created_at,
        updated_at: s.updated_at,
      });
    }

    if (secrets.length >= data.total_count) break;
    page++;
  }

  return secrets;
}

/**
 * Get the public key for a repository (needed to encrypt secrets).
 */
export async function getRepoPublicKey(
  repo: string
): Promise<{ key_id: string; key: string }> {
  const { data } = await octokit.rest.actions.getRepoPublicKey({
    owner: OWNER,
    repo,
  });

  return { key_id: data.key_id, key: data.key };
}

/**
 * Create or update a repository secret.
 * Encrypts the value with the repo's public key using libsodium sealed box.
 */
export async function createOrUpdateRepoSecret(
  repo: string,
  secretName: string,
  secretValue: string
): Promise<void> {
  await sodium.ready;

  const { key_id, key } = await getRepoPublicKey(repo);

  // Encrypt the secret value
  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const binValue = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(binValue, binKey);
  const encrypted_value = sodium.to_base64(
    encryptedBytes,
    sodium.base64_variants.ORIGINAL
  );

  await octokit.rest.actions.createOrUpdateRepoSecret({
    owner: OWNER,
    repo,
    secret_name: secretName,
    encrypted_value,
    key_id,
  });
}

/**
 * Delete a repository secret.
 */
export async function deleteRepoSecret(
  repo: string,
  secretName: string
): Promise<void> {
  await octokit.rest.actions.deleteRepoSecret({
    owner: OWNER,
    repo,
    secret_name: secretName,
  });
}

// ── Repository Variables ────────────────────────────────────────────

export interface RepoVariable {
  name: string;
  value: string;
  created_at: string;
  updated_at: string;
}

/**
 * List all Actions variables for a repository.
 */
export async function listRepoVariables(repo: string): Promise<RepoVariable[]> {
  const variables: RepoVariable[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.actions.listRepoVariables({
      owner: OWNER,
      repo,
      per_page: 100,
      page,
    });

    for (const v of data.variables) {
      variables.push({
        name: v.name,
        value: v.value,
        created_at: v.created_at,
        updated_at: v.updated_at,
      });
    }

    if (variables.length >= data.total_count) break;
    page++;
  }

  return variables;
}

/**
 * Create a repository variable.
 */
export async function createRepoVariable(
  repo: string,
  name: string,
  value: string
): Promise<void> {
  await octokit.rest.actions.createRepoVariable({
    owner: OWNER,
    repo,
    name,
    value,
  });
}

/**
 * Update an existing repository variable.
 */
export async function updateRepoVariable(
  repo: string,
  name: string,
  value: string
): Promise<void> {
  await octokit.rest.actions.updateRepoVariable({
    owner: OWNER,
    repo,
    name,
    value,
  });
}

/**
 * Delete a repository variable.
 */
export async function deleteRepoVariable(
  repo: string,
  name: string
): Promise<void> {
  await octokit.rest.actions.deleteRepoVariable({
    owner: OWNER,
    repo,
    name,
  });
}

// ── Environments ────────────────────────────────────────────────────

export interface RepoEnvironment {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * List all environments for a repository.
 */
export async function listEnvironments(repo: string): Promise<RepoEnvironment[]> {
  const environments: RepoEnvironment[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.repos.getAllEnvironments({
      owner: OWNER,
      repo,
      per_page: 100,
      page,
    });

    if (!data.environments || data.environments.length === 0) break;

    for (const env of data.environments) {
      environments.push({
        id: env.id,
        name: env.name,
        created_at: env.created_at ?? "",
        updated_at: env.updated_at ?? "",
      });
    }

    if (environments.length >= (data.total_count ?? 0)) break;
    page++;
  }

  return environments;
}

/**
 * Create (or update) an environment for a repository.
 * Uses PUT which is idempotent — creates if missing, no-ops if exists.
 */
export async function createEnvironment(
  repo: string,
  environmentName: string
): Promise<void> {
  await octokit.rest.repos.createOrUpdateEnvironment({
    owner: OWNER,
    repo,
    environment_name: environmentName,
  });
}

/**
 * Delete an environment from a repository.
 */
export async function deleteEnvironment(
  repo: string,
  environmentName: string
): Promise<void> {
  await octokit.rest.repos.deleteAnEnvironment({
    owner: OWNER,
    repo,
    environment_name: environmentName,
  });
}

// ── Environment Secrets ─────────────────────────────────────────────

/**
 * List all Actions secrets for a repository environment.
 */
export async function listEnvSecrets(
  repo: string,
  environmentName: string
): Promise<RepoSecret[]> {
  const secrets: RepoSecret[] = [];
  let page = 1;

  // Need the environment ID for the secrets API (uses repository_id + environment_name)
  while (true) {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets",
      {
        owner: OWNER,
        repo,
        environment_name: environmentName,
        per_page: 100,
        page,
      }
    );

    for (const s of data.secrets) {
      secrets.push({
        name: s.name,
        created_at: s.created_at,
        updated_at: s.updated_at,
      });
    }

    if (secrets.length >= data.total_count) break;
    page++;
  }

  return secrets;
}

/**
 * Get the public key for an environment (needed to encrypt environment secrets).
 */
export async function getEnvPublicKey(
  repo: string,
  environmentName: string
): Promise<{ key_id: string; key: string }> {
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key",
    {
      owner: OWNER,
      repo,
      environment_name: environmentName,
    }
  );

  return { key_id: data.key_id, key: data.key };
}

/**
 * Create or update an environment secret.
 * Encrypts the value with the environment's public key using libsodium sealed box.
 */
export async function createOrUpdateEnvSecret(
  repo: string,
  environmentName: string,
  secretName: string,
  secretValue: string
): Promise<void> {
  await sodium.ready;

  const { key_id, key } = await getEnvPublicKey(repo, environmentName);

  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const binValue = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(binValue, binKey);
  const encrypted_value = sodium.to_base64(
    encryptedBytes,
    sodium.base64_variants.ORIGINAL
  );

  await octokit.request(
    "PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}",
    {
      owner: OWNER,
      repo,
      environment_name: environmentName,
      secret_name: secretName,
      encrypted_value,
      key_id,
    }
  );
}

/**
 * Delete an environment secret.
 */
export async function deleteEnvSecret(
  repo: string,
  environmentName: string,
  secretName: string
): Promise<void> {
  await octokit.request(
    "DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}",
    {
      owner: OWNER,
      repo,
      environment_name: environmentName,
      secret_name: secretName,
    }
  );
}

// ── Environment Variables ───────────────────────────────────────────

/**
 * List all Actions variables for a repository environment.
 */
export async function listEnvVariables(
  repo: string,
  environmentName: string
): Promise<RepoVariable[]> {
  const variables: RepoVariable[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/environments/{environment_name}/variables",
      {
        owner: OWNER,
        repo,
        environment_name: environmentName,
        per_page: 100,
        page,
      }
    );

    for (const v of data.variables) {
      variables.push({
        name: v.name,
        value: v.value,
        created_at: v.created_at,
        updated_at: v.updated_at,
      });
    }

    if (variables.length >= data.total_count) break;
    page++;
  }

  return variables;
}

/**
 * Create an environment variable.
 */
export async function createEnvVariable(
  repo: string,
  environmentName: string,
  name: string,
  value: string
): Promise<void> {
  await octokit.request(
    "POST /repos/{owner}/{repo}/environments/{environment_name}/variables",
    {
      owner: OWNER,
      repo,
      environment_name: environmentName,
      name,
      value,
    }
  );
}

/**
 * Update an existing environment variable.
 */
export async function updateEnvVariable(
  repo: string,
  environmentName: string,
  name: string,
  value: string
): Promise<void> {
  await octokit.request(
    "PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}",
    {
      owner: OWNER,
      repo,
      environment_name: environmentName,
      name,
      value,
    }
  );
}

/**
 * Delete an environment variable.
 */
export async function deleteEnvVariable(
  repo: string,
  environmentName: string,
  name: string
): Promise<void> {
  await octokit.request(
    "DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}",
    {
      owner: OWNER,
      repo,
      environment_name: environmentName,
      name,
    }
  );
}

// ── Deploy Keys ─────────────────────────────────────────────────────

export interface DeployKey {
  id: number;
  title: string;
  key: string;
  readOnly: boolean;
  createdAt: string;
  addedBy: string | null;
  lastUsed: string | null;
}

/**
 * List deploy keys (SSH keys with access to a single repo).
 */
export async function listDeployKeys(repo: string): Promise<DeployKey[]> {
  const data = await octokit.paginate(octokit.rest.repos.listDeployKeys, {
    owner: OWNER,
    repo,
    per_page: 100,
  });
  return data.map((k) => ({
    id: k.id,
    title: k.title,
    key: k.key,
    readOnly: k.read_only,
    createdAt: k.created_at,
    addedBy: k.added_by ?? null,
    lastUsed: k.last_used ?? null,
  }));
}

/**
 * Add a deploy key. Read-only unless explicitly granted write access.
 */
export async function createDeployKey(
  repo: string,
  title: string,
  key: string,
  readOnly: boolean
): Promise<void> {
  await octokit.rest.repos.createDeployKey({
    owner: OWNER,
    repo,
    title,
    key,
    read_only: readOnly,
  });
}

/**
 * Delete a deploy key.
 */
export async function deleteDeployKey(repo: string, keyId: number): Promise<void> {
  await octokit.rest.repos.deleteDeployKey({
    owner: OWNER,
    repo,
    key_id: keyId,
  });
}
