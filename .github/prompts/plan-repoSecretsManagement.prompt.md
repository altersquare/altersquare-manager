## Plan: Repository Secrets Management (CRUD)

Adds a per-repo detail page at `/repos/[repo]/secrets` where users can list, create, update, and delete GitHub Actions **repository secrets**. One repo at a time. Follows existing codebase patterns (API routes, modals, toast notifications, Octokit).

**New dependency required:** `libsodium-wrappers` — GitHub requires secrets to be encrypted with the repo's public key (sealed box) before upload.

---

### Milestone 1: Backend — GitHub lib + API routes ✅

**Goal:** Wire up all Octokit calls and expose them as Next.js API routes.

1. **Add `libsodium-wrappers`** — `npm install libsodium-wrappers @types/libsodium-wrappers`

2. **Extend `src/lib/github.ts`** with four new exported functions using the shared `octokit` + `OWNER`:
   - `listRepoSecrets(repo)` → calls `octokit.rest.actions.listRepoSecrets({ owner, repo })`, returns array of `{ name, created_at, updated_at }`
   - `getRepoPublicKey(repo)` → calls `octokit.rest.actions.getRepoPublicKey({ owner, repo })`, returns `{ key_id, key }`
   - `createOrUpdateRepoSecret(repo, secretName, secretValue)` → fetches the public key, encrypts `secretValue` with `libsodium` sealed box, calls `octokit.rest.actions.createOrUpdateRepoSecret({ owner, repo, secret_name, encrypted_value, key_id })`
   - `deleteRepoSecret(repo, secretName)` → calls `octokit.rest.actions.deleteRepoSecret({ owner, repo, secret_name })`

3. **Create API routes** under `src/app/api/secrets/` following the existing error-handling pattern from team routes:

   | Route file | Method | Body / Query | Calls |
   |---|---|---|---|
   | `src/app/api/secrets/route.ts` | GET | `?repo=<name>` | `listRepoSecrets(repo)` |
   | `src/app/api/secrets/create/route.ts` | POST | `{ repo, name, value }` | `createOrUpdateRepoSecret(repo, name, value)` |
   | `src/app/api/secrets/delete/route.ts` | POST | `{ repo, name }` | `deleteRepoSecret(repo, name)` |

   The create route handles both create and update (GitHub's API is upsert). Each route uses the same try/catch → status-code mapping pattern as `src/app/api/team/add/route.ts`.

---

### Milestone 2: Frontend — Repo detail page with secrets list ✅

**Goal:** Navigable per-repo page that lists all secrets.

4. **Make the whole repo card clickable** in `src/app/repos/page.tsx` — wrap each repo card in a `<Link href={/repos/${encodeURIComponent(repo.name)}/secrets}>`. Move the existing GitHub external link to a small icon/button inside the card so it doesn't conflict with the card-level navigation. Add a cursor-pointer and subtle hover state to indicate clickability.

5. **Create dynamic route page** at `src/app/repos/[repo]/secrets/page.tsx` (client component):
   - Read repo name from route params
   - On mount, `GET /api/secrets?repo=<name>` → display secrets in a table/list (name, created date, updated date)
   - Show a "Back to Repos" link and the repo name as heading
   - Add an "Add Secret" button (top of page)
   - Each secret row gets an "Update" button and a "Delete" button
   - Loading state: skeleton similar to `src/components/TeamSkeleton.tsx`
   - Empty state: message + prompt to create first secret

---

### Milestone 3: Frontend — Create/Update modal

**Goal:** Modal to input secret name + value for creating or updating a secret.

6. **Create `src/components/SecretModal.tsx`** following the `AddModal.tsx` pattern:
   - Props: `{ mode: "create" | "update", secretName?: string, repo: string, onClose, onSuccess }`
   - Two form fields: "Secret Name" (text input, disabled in update mode) and "Secret Value" (textarea, always required)
   - Name validation: inline error if user types lowercase letters or invalid characters (only uppercase `A-Z`, digits `0-9`, and `_` allowed). Also reject names starting with `GITHUB_` prefix. Show the validation message below the input field in real-time.
   - On submit: `POST /api/secrets/create` with `{ repo, name, value }` → on success call `onSuccess()` and `showToast(...)`, on error show toast error
   - Loading spinner on the confirm button while request is in flight

---

### Milestone 4: Frontend — Delete confirmation + integration

**Goal:** Delete flow with confirmation, toast feedback, and full integration.

7. **Create `src/components/DeleteSecretModal.tsx`** (simple confirm dialog):
   - Props: `{ secretName, repo, onClose, onSuccess }`
   - Displays "Are you sure you want to delete **SECRET_NAME**?"
   - On confirm: `POST /api/secrets/delete` with `{ repo, name }` → `showToast(...)` + `onSuccess()`
   - Same backdrop/overlay pattern as `RemoveModal.tsx`

8. **Wire everything together** in the secrets page:
   - "Add Secret" → opens `SecretModal` in create mode
   - "Update" on a row → opens `SecretModal` in update mode with pre-filled name
   - "Delete" on a row → opens `DeleteSecretModal`
   - After any successful operation, refetch the secrets list

---

### Verification

- **Manual testing:** Navigate to `/repos`, click a repo → see its secrets page. Create a secret, verify it appears in the list. Update the secret value. Delete a secret, verify it's removed. Cross-check on GitHub Settings → Secrets and variables → Actions.
- **Error paths:** Test with an invalid repo name (404), invalid secret name (422), expired token (401). Verify toast messages appear correctly.
- **Edge cases:** Repo names with special characters (URL encoding), empty secrets list, very long secret values.

---

### Decisions

- **Repository secrets, not environment secrets** — per user clarification
- **Classic PAT with full `repo` scope** — token already has the permissions needed for Actions secrets; no token changes required
- **Whole card clickable** — repo card navigates to `/repos/[repo]/secrets`; GitHub external link becomes a small icon inside the card
- **Strict name validation** — inline error for lowercase or invalid characters (uppercase `A-Z`, `0-9`, `_` only, no `GITHUB_` prefix). No silent auto-uppercasing.
- **Toast errors only** — 403/token permission issues handled via toast, same pattern as rest of the app; no special banner
- **Upsert API** — single `/api/secrets/create` route for both create and update since GitHub's PUT endpoint is idempotent
- **No caching** for secrets — always fetch live from GitHub (secrets are sensitive, stale data is risky)
- **`libsodium-wrappers`** for encryption — required by GitHub's API, `tweetsodium` is deprecated
- **POST for delete** — matches existing pattern in team routes (`remove/route.ts`) rather than using HTTP DELETE
