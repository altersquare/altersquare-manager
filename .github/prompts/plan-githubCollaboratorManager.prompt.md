## Plan: GitHub Collaborator Manager Dashboard

A Next.js full-stack app that manages collaborators across all `altersquare` repos as a unified "team". Each milestone is independently verifiable before moving to the next.

---

### Milestone 1: Project Setup & GitHub API Connection ✅ DONE

**Goal:** Scaffolded project that can successfully talk to the GitHub API.

1. Initialize Next.js 14 app (App Router) with TypeScript + Tailwind CSS in workspace root
2. Install `octokit` dependency
3. Update `.env` — add `GITHUB_USERNAME=altersquare`
4. Create `lib/github.ts` — initialize `Octokit` with the token, export a single function `fetchAllRepos()` that returns all repos owned by `altersquare`
5. Create a test API route `GET /api/repos` that calls `fetchAllRepos()` and returns the result

**Verification**
- `npm run dev` starts without errors
- Hit `localhost:3000/api/repos` in browser — see JSON array of all `altersquare` repos with names

---

### Milestone 2: Collaborator Fetching & Team Aggregation ✅ DONE

**Goal:** API can fetch collaborators across all repos and return a unified, deduplicated team list.

1. In `lib/github.ts`, add `fetchCollaborators(owner, repo)` — returns collaborators for one repo (excludes owner)
2. Add `fetchTeam()` — loops through all repos, calls `fetchCollaborators` for each, deduplicates by username. Each member has: `username`, `avatarUrl`, `repos[]` (list of repo names they're on)
3. Create `GET /api/team` API route — calls `fetchTeam()`, returns the unified list

**Verification**
- Hit `localhost:3000/api/team` — see JSON with deduplicated collaborators, each showing which repos they belong to
- Confirm no duplicates, confirm owner `altersquare` is excluded

---

### Milestone 3: Local JSON Cache ✅ DONE

**Goal:** Team data is cached to a local file; subsequent loads are instant, with manual refresh.

1. Create `lib/cache.ts` — read/write helpers for `data/cache.json` (team data + timestamp)
2. Update `GET /api/team` — serve from cache if it exists, otherwise fetch live and save to cache
3. Create `POST /api/team/refresh` — clears cache, re-fetches from GitHub, saves new cache, returns fresh data
4. Add `data/` to `.gitignore`

**Verification**
- First call to `/api/team` is slow (live fetch), second call is instant (cached)
- Call `/api/team/refresh` — confirm it takes time (re-fetching), then `/api/team` returns updated data quickly
- Confirm `data/cache.json` exists on disk with team data

---

### Milestone 4: Dashboard UI — Team View ✅ DONE

**Goal:** A working web page showing all team members and their repos.

1. Create main page `app/page.tsx` with Tailwind styling:
   - Header with app title + "Refresh" button
   - Stats bar: total team members, total repos
   - Team table/grid: avatar, username (linked to GitHub profile), repo badges
2. Client-side data fetching: load from `/api/team` on mount, show loading skeleton
3. Refresh button calls `/api/team/refresh`, shows spinner, reloads data
4. Toast notifications for refresh success/failure

**Verification**
- Open `localhost:3000` — see styled dashboard with all collaborators listed
- Each collaborator shows correct repo badges
- Click Refresh — spinner appears, data reloads
- Stats bar shows correct counts

---

### Milestone 5: Remove Collaborator ✅ DONE

**Goal:** Remove a person from ALL repos with one click + confirmation.

1. Create `POST /api/team/remove` — accepts `{ username }`, looks up their repos from cache, calls `removeCollaborator(owner, repo, username)` for each repo, updates cache
2. In `lib/github.ts`, add `removeCollaborator(owner, repo, username)` — `DELETE` request
3. Add "Remove" button (red) on each team member row in the UI
4. Confirmation modal: shows username + lists all repos they'll be removed from
5. On confirm → calls API → closes modal → refreshes team list → shows success/error toast

**Verification**
- Click Remove on a test collaborator → modal shows their repos
- Confirm removal → collaborator disappears from dashboard
- Check GitHub.com → collaborator is actually removed from those repos
- Cancel on modal → nothing happens

---

### Milestone 6: Add Collaborator ✅ DONE

**Goal:** Add a GitHub user to selected repos with a modal dialog.

1. Create `POST /api/team/add` — accepts `{ username, repos: string[] }`, calls `addCollaborator(owner, repo, username)` for each selected repo (default `push` permission), updates cache
2. In `lib/github.ts`, add `addCollaborator(owner, repo, username)` — `PUT` request
3. Add "Add Collaborator" button in the dashboard header
4. Modal with: text input for GitHub username, checklist of all repos with "Select All" toggle, "Add" button
5. On submit → calls API → closes modal → refreshes team list → shows success/error toast
6. Handle errors: invalid username (404), already a collaborator (204)

**Verification**
- Click "Add Collaborator" → modal with repo checklist appears
- Enter a valid username, select some repos, click Add → person appears in team list with correct repo badges
- Check GitHub.com → invitation sent to those repos
- Try invalid username → error toast shown
- Select All / deselect works

---

### Milestone 7: Polish & Error Handling ✅ DONE

**Goal:** Robust error handling, search/filter, and final UX polish.

1. Add search bar to filter team members by username
2. Add repo filter dropdown — show only collaborators of a specific repo
3. Handle API errors globally: token expired (401) shows "Check your GitHub token" message, rate limit (403/429) shows retry-after info
4. Loading skeletons on initial load
5. Empty state UI when no collaborators exist
6. Sort team alphabetically by default

**Verification**
- Search filters the team list in real time
- Repo filter shows only relevant collaborators
- Revoke/mangle the token → dashboard shows clear auth error
- Empty repo → shows friendly empty state
- All interactions feel smooth, no hanging states

---

### Decisions

- **Next.js App Router** — modern, API routes colocated
- **`octokit`** — handles pagination, auth, types automatically
- **JSON file cache** — no DB needed for local tool
- **Default `push` permission** — keeps UX simple
- **Owner `altersquare` excluded** from team list — prevents accidental self-removal
