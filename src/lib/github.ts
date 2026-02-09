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
