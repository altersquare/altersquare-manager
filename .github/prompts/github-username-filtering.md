# GitHub Username-Based Repo Filtering for Members

## Overview

Store each member's GitHub username as a custom attribute in Authentik, exposed via OIDC scope mapping. Members **without** a `github_username` claim are blocked from the entire app — they see only a "contact admin" page. Members **with** a valid `github_username` can only see/manage repos they collaborate on. Admins remain fully unrestricted.

---

## Milestone 1: Authentik Configuration & Auth Token Flow ✅

**Goal:** Get `github_username` flowing from Authentik → OIDC token → NextAuth session.

### 1.1 Authentik Admin Panel (Manual) ✅

- For each member user, add a custom attribute: **User → Edit → Attributes** → add `github_username: "their-gh-login"`.
- Create a **Scope Mapping** (type: Expression, scope name: `github_username`):

  ```python
  return {"github_username": request.user.attributes.get("github_username", "")}
  ```

- Attach this scope mapping to the **OAuth2 Provider** used by the app (Provider → Edit → Advanced Protocol Settings → Scopes).

### 1.2 Extend NextAuth Types — `src/types/next-auth.d.ts` ✅

Add `githubUsername?: string | null` to both `Session.user` and `JWT` interfaces.

### 1.3 Extract Claim in Auth Config — `src/lib/auth.ts` ✅

- Add `github_username` to the `authorization.params.scope` string → becomes `"openid email profile role github_username"`.
- In the `jwt` callback: extract `profile.github_username` → store as `token.githubUsername`.
- In the `session` callback: copy `token.githubUsername` → `session.user.githubUsername`.

### Verification

1. Log in as a member user who has `github_username` set in Authentik.
2. Inspect the session (e.g. via `useSession()` on any page, or browser devtools → NextAuth session endpoint `/api/auth/session`).
3. Confirm `githubUsername` appears in the session with the correct value.
4. Log in as a member user **without** `github_username` set → confirm `githubUsername` is `null`/`undefined`/`""`.
5. Log in as an admin → confirm session still works (admin may or may not have `githubUsername`; doesn't matter).

---

## Milestone 2: Block Members Without GitHub Username ✅

**Goal:** Members without a `github_username` in their token cannot access anything — they see a "contact admin" page. Enforced at both middleware (page routes) and API level.

### 2.1 Create No-Access Page — `src/app/no-access/page.tsx` ✅

- Static page with messaging: *"Your account does not have a GitHub username configured. Please contact your administrator to update your profile."*
- Include a **Sign Out** button so the user can re-login after admin fixes their account.
- Clean, centered layout consistent with the rest of the app.

### 2.2 Update Middleware — `src/proxy.ts` ✅

After the existing auth check, add:

- If `req.auth.user.role !== "admin"` **AND** `req.auth.user.githubUsername` is falsy:
  - If the request path is **not** `/no-access` and **not** `/api/auth/*` → redirect to `/no-access`.
- This blocks all page navigation for members without a GitHub username while still allowing sign-out.

### 2.3 Create `requireGithubUsername()` Helper — `src/lib/session.ts` ✅

- Get session; return 401 if not authenticated.
- If admin → return `null` (allow).
- If `session.user.githubUsername` is falsy → return 403: `{ error: "GitHub username not configured. Contact your administrator." }`.
- Otherwise return `null`.

This will be called at the top of every API route in later milestones.

### Verification

1. **Member without `github_username`:** Log in → should be redirected to `/no-access` on every page. Verify the message and sign-out button work.
2. **Member without `github_username` — API:** Make direct API calls (e.g. `GET /api/team`, `GET /api/repos`) → should return 403 with the "not configured" message.
3. **Member with `github_username`:** Log in → should **not** be redirected to `/no-access`; normal access works.
4. **Admin without `github_username`:** Log in → should have full unrestricted access (no redirect, no 403).
5. **Sign-out flow:** On `/no-access`, click Sign Out → should redirect to login. After admin sets the attribute, re-login → should enter the app normally.

---

## Milestone 3: Session Helpers & Cache-Based Repo Access Validation ✅

**Goal:** Build the core `requireMemberRepoAccess(repo)` and `getMemberRepos()` helpers that validate member access against the cached team data.

### 3.1 Create `requireMemberRepoAccess(repo)` — `src/lib/session.ts` ✅

- Get session; return 401 if not authenticated.
- If admin → return `null` (allow).
- Call `requireGithubUsername()` first (handles no-username case).
- Read cache via `readCache()`. If null, call `fetchTeam()` + `writeCache()` to populate.
- Find `Collaborator` where `username.toLowerCase() === session.user.githubUsername.toLowerCase()`.
- Check if that collaborator's `repos` includes the target repo name.
- If not found or repo not listed → return 403: `"You are not a collaborator on this repository"`.
- Otherwise return `null`.

### 3.2 Create `getMemberRepos()` — `src/lib/session.ts` ✅

- Get session; if admin return `null` (signals "no filtering, show all").
- If `githubUsername` falsy → return `[]`.
- Read cache (or fetch + write if missing).
- Find matching `Collaborator` (case-insensitive), return their `repos[]`.
- If not found → return `[]`.

### Verification

1. Temporarily add a test API route (e.g. `GET /api/test-access?repo=xyz`) that calls `requireMemberRepoAccess(repo)` and returns the result.
2. **Member who IS a collaborator on repo X:** Call `/api/test-access?repo=X` → should return 200.
3. **Member who is NOT a collaborator on repo Y:** Call `/api/test-access?repo=Y` → should return 403.
4. **Admin:** Call `/api/test-access?repo=anything` → should return 200.
5. **Cache miss:** Clear `data/cache.json`, call the test endpoint → should auto-populate cache and still return correct result.
6. **Case insensitivity:** If Authentik has `github_username: "MyUser"` and GitHub has collaborator `"myuser"` → should match.
7. Remove the test route after verification.

---

## Milestone 4: Guard API Routes ✅

**Goal:** Apply access controls to all API routes so members can only interact with repos they collaborate on.

### 4.1 Guard `/api/repos` — `src/app/api/repos/route.ts` ✅

- Add `requireGithubUsername()` check at the top.

### 4.2 Guard `/api/repos/details` — `src/app/api/repos/details/route.ts` ✅

- Add `requireGithubUsername()` check at the top.
- After building the `RepoDetail[]` list, call `getMemberRepos()`.
- If result is an array (member), filter repos to only include those whose `name` is in the array.
- If result is `null` (admin), return all repos.

### 4.3 Guard `/api/secrets` (list) — `src/app/api/secrets/route.ts` ✅

- Add `requireMemberRepoAccess(repo)` check (this implicitly checks `githubUsername`).

### 4.4 Guard `/api/secrets/create` — `src/app/api/secrets/create/route.ts` ✅

- Add `requireMemberRepoAccess(repo)` check.

### 4.5 Guard `/api/secrets/delete` — `src/app/api/secrets/delete/route.ts`

- Already admin-only via `requireAdmin()`. **No change needed.**

### 4.6 Guard `/api/repos/invitations` — `src/app/api/repos/invitations/route.ts` ✅

- Add `requireMemberRepoAccess(repo)` check.

### 4.7 Guard `/api/repos/invitations/revoke` — `src/app/api/repos/invitations/revoke/route.ts`

- Already admin-only. **No change needed.**

### 4.8 Guard `/api/team` — `src/app/api/team/route.ts` ✅

- Add `requireGithubUsername()` check.
- After fetching cached team data, call `getMemberRepos()`.
- If result is an array (member):
  - Filter `team[]` to only include collaborators who share at least one repo with the member.
  - Filter each collaborator's `repos[]` to only show shared repos.
  - Filter `repos[]` in the response to only the member's repos.
  - Update `totalMembers` and `totalRepos` counts accordingly.

### 4.9 Guard `/api/team/refresh` — `src/app/api/team/refresh/route.ts` ✅

- Add `requireGithubUsername()` check.

### 4.10 Team management routes — admin-only, no change

- `/api/team/add` — already admin-only.
- `/api/team/remove` — already admin-only.
- `/api/team/remove-one` — already admin-only.

### Verification

1. **Member — repos list:** `GET /api/repos/details` → should only return repos the member collaborates on.
2. **Member — secrets list (allowed repo):** `GET /api/secrets?repo=<collab-repo>` → should return secrets.
3. **Member — secrets list (disallowed repo):** `GET /api/secrets?repo=<other-repo>` → should return 403.
4. **Member — create secret (allowed repo):** `POST /api/secrets/create` with an allowed repo → should succeed.
5. **Member — create secret (disallowed repo):** `POST /api/secrets/create` with a disallowed repo → should return 403.
6. **Member — team list:** `GET /api/team` → should only show collaborators on shared repos.
7. **Member — invitations:** `GET /api/repos/invitations?repo=<disallowed-repo>` → should return 403.
8. **Admin — all endpoints:** Full unrestricted access, all repos, all secrets, all team members.
9. **Member without `github_username` — all endpoints:** Should return 403 "not configured" message.

---

## Milestone 5: Frontend — Handle Filtered Data & Error States ✅

**Goal:** Update the UI to gracefully handle 403 responses, empty states, and display relevant messaging for members.

### 5.1 Repos Page — `src/app/repos/page.tsx` ✅

- Handle 403 response from `/api/repos/details` — show access-denied message.
- When repos list is empty for a member, show: *"You are not a collaborator on any repositories."*

### 5.2 Secrets Page — `src/app/repos/[repo]/secrets/page.tsx` ✅

- Handle 403 from `/api/secrets` — show *"You don't have access to this repository"* with a back link to `/repos`.
- Hide "Add Secret" and "Delete Secret" buttons if the user is denied access.

### 5.3 Team Page — `src/app/page.tsx` ✅

- Handle 403 response from `/api/team` — show the "contact admin" message.
- The team list is already filtered server-side, so the UI will naturally show only shared collaborators.

### 5.4 Display GitHub Username in Navbar — `src/components/Navbar.tsx` ✅

- Show the user's GitHub username in the navbar (e.g. next to their name) for visibility.

### Verification

1. **Member with repos:** Log in → repos page shows only their repos. Click into a repo → secrets page shows secrets. Can add/update secrets.
2. **Member — direct URL to disallowed repo:** Navigate to `/repos/<other-repo>/secrets` → should show "You don't have access" with a back link.
3. **Member without repos:** Log in → repos page shows empty state message.
4. **Member without `github_username`:** Redirected to `/no-access` page (from Milestone 2).
5. **Admin:** Full UI, all repos visible, all buttons enabled.
6. **Team page (member):** Only shows collaborators on shared repos.
7. **Team page (admin):** Shows all collaborators across all repos.

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/types/next-auth.d.ts` | Add `githubUsername` to Session and JWT types |
| `src/lib/auth.ts` | Extract `github_username` claim from OIDC profile |
| `src/app/no-access/page.tsx` | **New** — blocked member landing page |
| `src/proxy.ts` | Redirect members without `githubUsername` to `/no-access` |
| `src/lib/session.ts` | Add `requireGithubUsername()`, `requireMemberRepoAccess()`, `getMemberRepos()` |
| `src/app/api/repos/route.ts` | Add `requireGithubUsername()` guard |
| `src/app/api/repos/details/route.ts` | Add guard + filter repos for members |
| `src/app/api/secrets/route.ts` | Add `requireMemberRepoAccess()` guard |
| `src/app/api/secrets/create/route.ts` | Add `requireMemberRepoAccess()` guard |
| `src/app/api/repos/invitations/route.ts` | Add `requireMemberRepoAccess()` guard |
| `src/app/api/team/route.ts` | Add guard + filter team for members |
| `src/app/api/team/refresh/route.ts` | Add `requireGithubUsername()` guard |
| `src/app/repos/page.tsx` | Handle 403 + empty state |
| `src/app/repos/[repo]/secrets/page.tsx` | Handle 403 + access denied state |
| `src/app/page.tsx` | Handle 403 from team endpoint |
| `src/components/Navbar.tsx` | (Optional) Display GitHub username |

## Key Design Decisions

- **Authentik custom attribute + scope mapping** — no runtime API calls, no new env vars
- **Cache-based validation** — avoids GitHub API rate limits; freshness governed by existing refresh mechanism
- **Case-insensitive username matching** — GitHub usernames are case-insensitive
- **Defense in depth** — both middleware (pages) and API helpers (routes) enforce access
- **Admins fully unrestricted** — `github_username` presence not required for admins
- **Members without `github_username` blocked entirely** — redirected to `/no-access`, API returns 403
