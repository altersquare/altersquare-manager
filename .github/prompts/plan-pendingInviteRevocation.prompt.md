## Plan: Pending Invite Revocation on Secrets Page

View and revoke pending collaborator invitations directly on the per-repo secrets page. Invite data is always fetched live from GitHub.

---

### Milestone 1: Backend — GitHub helpers ✅

Add two functions to [src/lib/github.ts](src/lib/github.ts):

1. Add `PendingInvitation` interface: `{ id: number; username: string; avatarUrl: string; createdAt: string }`
2. Add `fetchPendingInvitations(owner, repo)` — paginated call to `octokit.rest.repos.listInvitations()`, maps response to `PendingInvitation[]`
3. Add `revokeInvitation(owner, repo, invitationId)` — calls `octokit.rest.repos.deleteInvitation()`

**Done when:** Both functions export cleanly with no type errors. **Complete.**

---

### Milestone 2: Backend — API routes ✅

1. Create `GET /api/repos/invitations` at [src/app/api/repos/invitations/route.ts](src/app/api/repos/invitations/route.ts)
   - Query param `repo` → calls `fetchPendingInvitations(OWNER, repo)` → returns `{ invitations }`
2. Create `POST /api/repos/invitations/revoke` at [src/app/api/repos/invitations/revoke/route.ts](src/app/api/repos/invitations/revoke/route.ts)
   - Body `{ repo, invitationId }` → calls `revokeInvitation(OWNER, repo, invitationId)` → returns `{ success: true }`

**Done when:** Both endpoints respond correctly when tested manually (e.g. via curl or browser). **Complete.**

---

### Milestone 3: Frontend — RevokeInviteModal component ✅

Create [src/components/RevokeInviteModal.tsx](src/components/RevokeInviteModal.tsx):

- Props: `username`, `repo`, `invitationId`, `onClose`, `onSuccess`
- Mirror the pattern of [DeleteSecretModal.tsx](src/components/DeleteSecretModal.tsx) — confirmation text, loading spinner, error display
- Calls `POST /api/repos/invitations/revoke` on confirm

**Done when:** Component renders, handles loading/error states, and calls the API on confirm. **Complete.**

---

### Milestone 4: Frontend — Integrate into secrets page ✅

Modify [src/app/repos/[repo]/secrets/page.tsx](src/app/repos/%5Brepo%5D/secrets/page.tsx):

1. Add state for `invitations`, `invitationsLoading`, and `revokeModal`
2. Add `fetchInvitations()` calling `GET /api/repos/invitations?repo=X`
3. Call `fetchInvitations()` in the existing `useEffect` alongside `fetchSecrets()`
4. Render "Pending Invitations" section between the heading and secrets list:
   - Only visible when `invitations.length > 0`
   - Header with count badge
   - Each row: avatar, username, sent date, red "Revoke" button
   - Loading skeleton (2-3 small rows)
5. Wire Revoke button → `RevokeInviteModal` → on success: refetch invitations + toast

**Done when:** Full flow works end-to-end — invites appear, revoke modal works, list updates after revocation. **Complete.**

---

### Verification (after all milestones)

- Repo with pending invites → section shows with correct data
- Click Revoke → confirm → invite disappears, toast "Invitation revoked"
- Repo with no pending invites → section hidden
- Page refresh → always fresh data from GitHub
- Repo where you lack admin access → graceful error handling (no crash)
