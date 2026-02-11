# Plan: Repository Actions Management Expansion

> **Status: COMPLETE** — All 9 milestones finished.

Extend the current repo secrets management to also support **repository variables**, **environment secrets**, **environment variables**, and **environment CRUD**. Single scrollable page at `/repos/{repo}/manage`.

---

## Milestone 1 — GitHub API Layer: Repo Variables ✅

Add GitHub API functions for repository-level Actions variables in `src/lib/github.ts`.

### Tasks

1. Add `listRepoVariables(repo)` — calls `actions.listRepoVariables`, paginated, returns `{name, value, created_at, updated_at}[]`
2. Add `createRepoVariable(repo, name, value)` — calls `actions.createRepoVariable` (POST)
3. Add `updateRepoVariable(repo, name, value)` — calls `actions.updateRepoVariable` (PATCH)
4. Add `deleteRepoVariable(repo, name)` — calls `actions.deleteRepoVariable` (DELETE)

### Testing

- **Automated**: Write a quick script or use the Next.js API shell to call each function against a test repo and confirm GitHub reflects the changes.
- **Manual**: Temporarily invoke functions from a test API route or Node REPL with the GitHub token. Verify variable appears/updates/deletes on GitHub → Repo → Settings → Secrets and variables → Actions → Variables tab.

---

## Milestone 2 — API Routes: Repo Variables ✅

Create the REST API routes that the frontend will consume for repo variables.

### Tasks

1. Create `src/app/api/variables/route.ts` — `GET ?repo=<name>` → list repo variables. Guard: `requireMemberRepoAccess(repo)`.
2. Create `src/app/api/variables/create/route.ts` — `POST {repo, name, value}` → create variable. Guard: `requireMemberRepoAccess(repo)`. Validate name: `/^[A-Z0-9_]+$/`, no `GITHUB_` prefix.
3. Create `src/app/api/variables/update/route.ts` — `POST {repo, name, value}` → update variable. Guard: `requireMemberRepoAccess(repo)`.
4. Create `src/app/api/variables/delete/route.ts` — `POST {repo, name}` → delete variable. Guard: `requireAdmin()`.

### Testing

- **Manual**: Start the dev server. Use `curl` or Postman to hit each endpoint:
  - `GET /api/variables?repo=test-repo` → should return variable list
  - `POST /api/variables/create` with `{repo, name: "TEST_VAR", value: "hello"}` → should create
  - `POST /api/variables/update` with `{repo, name: "TEST_VAR", value: "updated"}` → should update
  - `POST /api/variables/delete` with `{repo, name: "TEST_VAR"}` → should delete (requires admin session)
  - Verify 401/403 for unauthenticated/unauthorized requests

---

## Milestone 3 — GitHub API Layer: Environments ✅

Add GitHub API functions for environment CRUD in `src/lib/github.ts`.

### Tasks

1. Add `listEnvironments(repo)` — calls `repos.getAllEnvironments`, returns `{name, id, created_at, updated_at}[]`
2. Add `createEnvironment(repo, envName)` — calls `repos.createOrUpdateEnvironment` (PUT)
3. Add `deleteEnvironment(repo, envName)` — calls `repos.deleteAnEnvironment` (DELETE)

### Testing

- **Manual**: Call functions against a test repo. Verify on GitHub → Repo → Settings → Environments that environments are created/deleted correctly.

---

## Milestone 4 — API Routes: Environments ✅

Create REST API routes for environment management.

### Tasks

1. Create `src/app/api/environments/route.ts` — `GET ?repo=<name>` → list environments. Guard: `requireMemberRepoAccess(repo)`.
2. Create `src/app/api/environments/create/route.ts` — `POST {repo, name}` → create environment. Guard: `requireMemberRepoAccess(repo)` (members can create).
3. Create `src/app/api/environments/delete/route.ts` — `POST {repo, name}` → delete environment. Guard: `requireAdmin()` (admin only).

### Testing

- **Manual**: Use `curl` / Postman:
  - `GET /api/environments?repo=test-repo` → list environments
  - `POST /api/environments/create` with `{repo, name: "staging"}` → create
  - `POST /api/environments/delete` with `{repo, name: "staging"}` → delete (admin only)
  - Confirm unauthorized users get 401/403

---

## Milestone 5 — GitHub API Layer: Environment Secrets & Variables ✅

Add GitHub API functions for environment-scoped secrets and variables in `src/lib/github.ts`.

### Tasks

#### Environment Secrets (encrypted, same libsodium pattern as repo secrets)
1. Add `listEnvSecrets(repo, env)` — calls environment secrets list endpoint, paginated
2. Add `getEnvPublicKey(repo, env)` — gets the per-environment public key for encryption
3. Add `createOrUpdateEnvSecret(repo, env, secretName, secretValue)` — encrypts with env public key, then PUT
4. Add `deleteEnvSecret(repo, env, secretName)` — DELETE

#### Environment Variables (plaintext, no encryption)
5. Add `listEnvVariables(repo, env)` — calls environment variables list endpoint, paginated
6. Add `createEnvVariable(repo, env, name, value)` — POST
7. Add `updateEnvVariable(repo, env, name, value)` — PATCH
8. Add `deleteEnvVariable(repo, env, name)` — DELETE

### Testing

- **Manual**: Call each function against a test repo + environment. Verify on GitHub → Repo → Settings → Environments → {env} that secrets/variables appear and are correctly created/updated/deleted.
- Specifically verify env secret encryption works (create an env secret, use it in a workflow, confirm it decrypts correctly).

---

## Milestone 6 — API Routes: Environment Secrets & Variables ✅

Create REST API routes for environment-scoped secrets and variables.

### Tasks

#### Environment Secrets
1. Create `src/app/api/environments/secrets/route.ts` — `GET ?repo=<name>&env=<env>` → list. Guard: `requireMemberRepoAccess(repo)`.
2. Create `src/app/api/environments/secrets/create/route.ts` — `POST {repo, env, name, value}` → create/update (encrypted). Guard: `requireMemberRepoAccess(repo)`.
3. Create `src/app/api/environments/secrets/delete/route.ts` — `POST {repo, env, name}` → delete. Guard: `requireAdmin()`.

#### Environment Variables
4. Create `src/app/api/environments/variables/route.ts` — `GET ?repo=<name>&env=<env>` → list. Guard: `requireMemberRepoAccess(repo)`.
5. Create `src/app/api/environments/variables/create/route.ts` — `POST {repo, env, name, value}` → create. Guard: `requireMemberRepoAccess(repo)`.
6. Create `src/app/api/environments/variables/update/route.ts` — `POST {repo, env, name, value}` → update. Guard: `requireMemberRepoAccess(repo)`.
7. Create `src/app/api/environments/variables/delete/route.ts` — `POST {repo, env, name}` → delete. Guard: `requireAdmin()`.

### Testing

- **Manual**: Full curl/Postman sweep of all 7 endpoints with valid and invalid auth. Verify changes reflected on GitHub.
- Confirm name validation (`/^[A-Z0-9_]+$/`, no `GITHUB_` prefix) is enforced on create endpoints.

---

## Milestone 7 — UI Components: Variable Modal & Delete Modals ✅

Create reusable UI components for variables and environment management.

### Tasks

1. Create `src/components/VariableModal.tsx` — Used for creating/updating both repo variables and environment variables.
   - Props: `mode ("create" | "update")`, `variableName?`, `variableValue?`, `repo`, `env?`, `onClose`, `onSuccess`
   - Value field is visible (not masked), pre-filled in update mode
   - Name field: locked in update mode, validated in create mode
   - When `env` is provided, calls environment variable endpoints; otherwise repo variable endpoints
   - Separate create vs update API calls (unlike secrets which use a single endpoint)
2. Create `src/components/DeleteConfirmModal.tsx` — Generic reusable confirmation modal replacing the need for separate `DeleteVariableModal` and `DeleteEnvironmentModal`.
   - Props: `title`, `message`, `itemName`, `onConfirm` (async callback), `onClose`, `onSuccess`
   - Displays a warning icon, item name, and confirm/cancel buttons
   - Handles loading/error states internally
3. Create `src/components/CreateEnvironmentModal.tsx` — Simple modal with text input for environment name.
   - Props: `repo`, `onClose`, `onSuccess`
   - Posts to `/api/environments/create`
4. Extend `src/components/SecretModal.tsx` — Add optional `env` prop.
   - When `env` is present, posts to `/api/environments/secrets/create` with extra `env` field
   - All other behavior unchanged (masked value, libsodium encryption happens server-side)

### Testing

- **Manual**: Render each modal in isolation (or via the manage page, if built). Verify:
  - `VariableModal` shows visible value, pre-fills on update, locks name on update
  - `DeleteConfirmModal` shows correct item name, calls onConfirm, handles errors
  - `CreateEnvironmentModal` submits and creates an environment
  - `SecretModal` with `env` prop posts to the correct endpoint

---

## Milestone 8 — UI Page: Rename Route & Build Manage Page ✅

Rename the page route from `/repos/{repo}/secrets` to `/repos/{repo}/manage` and build the unified management page.

### Tasks

1. Create `src/app/repos/[repo]/manage/page.tsx` — the new unified page
2. Delete `src/app/repos/[repo]/secrets/page.tsx`
3. Update `src/app/repos/page.tsx` — change repo card links from `/repos/{repo}/secrets` to `/repos/{repo}/manage`

#### Page layout (single scrollable page):

**Section 1 — Header**
- Repo name (from URL param)
- Back link to `/repos`
- Pending invitations (moved from old secrets page)

**Section 2 — Repository Secrets**
- Fetches from `GET /api/secrets?repo=<name>`
- List: name, updated date
- Buttons: "Add Secret" → `SecretModal(mode="create")`, "Update" → `SecretModal(mode="update")`, "Delete" (admin) → `DeleteSecretModal`

**Section 3 — Repository Variables**
- Fetches from `GET /api/variables?repo=<name>`
- List: name, value (inline, truncated if long), updated date
- Buttons: "Add Variable" → `VariableModal(mode="create")`, "Update" → `VariableModal(mode="update")`, "Delete" (admin) → `DeleteConfirmModal`

**Section 4 — Environments**
- Fetches environment list from `GET /api/environments?repo=<name>`
- Dropdown selector for choosing an environment
- "Create Environment" button → `CreateEnvironmentModal` (all members)
- "Delete Environment" button → `DeleteConfirmModal` (admin only, for selected environment)

**Section 4a — Environment Secrets** (shown when an environment is selected)
- Fetches from `GET /api/environments/secrets?repo=<name>&env=<env>`
- Same layout as repo secrets section
- Uses `SecretModal` with `env` prop for create/update

**Section 4b — Environment Variables** (shown when an environment is selected)
- Fetches from `GET /api/environments/variables?repo=<name>&env=<env>`
- Same layout as repo variables section
- Uses `VariableModal` with `env` prop for create/update

### Testing

- **Manual (comprehensive)**:
  - Navigate to `/repos` → click a repo → verify lands on `/repos/{repo}/manage`
  - Verify old URL `/repos/{repo}/secrets` no longer works (404)
  - **Repo Secrets**: Add, update, delete a secret. Confirm on GitHub.
  - **Repo Variables**: Add a variable, see value inline, update it, delete it. Confirm on GitHub.
  - **Environments**: Create a new environment. Select it in dropdown. Delete it (admin).
  - **Env Secrets**: Select an environment, add/update/delete a secret. Confirm on GitHub.
  - **Env Variables**: Select an environment, add/update/delete a variable. Confirm on GitHub.
  - **Pending Invitations**: Verify invitations still display and revoke works.
  - **Access Control**: Log in as non-admin member → confirm cannot delete anything, cannot delete environments, can create environments, can create/update all types.
  - **Edge Cases**: Repo with no environments → environments section shows empty state with create button. Variable with very long value → verify truncation. Environment with no secrets/variables → shows empty state.

---

## Milestone 9 — Polish & Edge Cases ✅

Final pass for robustness, consistency, and UX.

### Tasks

1. Add loading skeletons for each section (secrets, variables, environments)
2. Add empty states for each section ("No secrets yet", "No variables yet", "No environments yet", "Select an environment above")
3. Add toast notifications for all create/update/delete operations (success and error)
4. Verify error handling for all API routes — proper status codes and messages for:
   - Invalid names (422)
   - Non-existent repos/environments (404)
   - Permission denied (403)
   - Unauthenticated (401)
   - GitHub API errors (500 with message)
5. Verify the page is responsive on mobile/tablet
6. Confirm the `Navbar` active state works correctly on the new `/manage` route (repos link should be active)
7. Add `aria-labels` and keyboard navigation to modals

### Testing

- **Manual**: Full end-to-end walkthrough as both admin and member
- **Manual**: Test on mobile viewport
- **Manual**: Test with slow network (throttle in DevTools) — verify loading states appear
- **Manual**: Test error paths — disconnect GitHub token, use invalid repo name, etc.

---

## Summary: Files to Create/Modify

### New Files (18)

| File | Purpose |
|---|---|
| `src/app/api/variables/route.ts` | List repo variables |
| `src/app/api/variables/create/route.ts` | Create repo variable |
| `src/app/api/variables/update/route.ts` | Update repo variable |
| `src/app/api/variables/delete/route.ts` | Delete repo variable |
| `src/app/api/environments/route.ts` | List environments |
| `src/app/api/environments/create/route.ts` | Create environment |
| `src/app/api/environments/delete/route.ts` | Delete environment |
| `src/app/api/environments/secrets/route.ts` | List env secrets |
| `src/app/api/environments/secrets/create/route.ts` | Create/update env secret |
| `src/app/api/environments/secrets/delete/route.ts` | Delete env secret |
| `src/app/api/environments/variables/route.ts` | List env variables |
| `src/app/api/environments/variables/create/route.ts` | Create env variable |
| `src/app/api/environments/variables/update/route.ts` | Update env variable |
| `src/app/api/environments/variables/delete/route.ts` | Delete env variable |
| `src/components/VariableModal.tsx` | Create/update variable modal |
| `src/components/DeleteConfirmModal.tsx` | Generic delete confirmation modal |
| `src/components/CreateEnvironmentModal.tsx` | Create environment modal |
| `src/app/repos/[repo]/manage/page.tsx` | Unified manage page |

### Modified Files (3)

| File | Change |
|---|---|
| `src/lib/github.ts` | Add ~15 new GitHub API functions |
| `src/components/SecretModal.tsx` | Add optional `env` prop |
| `src/app/repos/page.tsx` | Update links from `/secrets` to `/manage` |

### Deleted Files (1)

| File | Reason |
|---|---|
| `src/app/repos/[repo]/secrets/page.tsx` | Replaced by `/manage` page |

---

## Permission Matrix

| Action | Admin | Member (collaborator) |
|---|---|---|
| List repo secrets | Yes | Yes |
| Create/update repo secret | Yes | Yes |
| Delete repo secret | Yes | No |
| List repo variables | Yes | Yes |
| Create/update repo variable | Yes | Yes |
| Delete repo variable | Yes | No |
| List environments | Yes | Yes |
| Create environment | Yes | Yes |
| Delete environment | Yes | No |
| List env secrets | Yes | Yes |
| Create/update env secret | Yes | Yes |
| Delete env secret | Yes | No |
| List env variables | Yes | Yes |
| Create/update env variable | Yes | Yes |
| Delete env variable | Yes | No |
