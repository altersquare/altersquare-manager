
# Plan: Multi-Page Polish & New Features

## Context
GitHub Manager is a Next.js dashboard for managing collaborators across all `altersquare` repos. Currently a single-page app with team view, add/remove modals, search by username, and a repo dropdown filter. This plan adds four features across 5 milestones.

---

## Milestone 1: Top Navbar + Page Structure ✅ COMPLETED

**Goal:** Add a shared navigation bar and prepare for multi-page routing.

1. Create `src/components/Navbar.tsx` — horizontal top bar with:
   - App title "GitHub Manager" on the left (links to `/`)
   - Nav links: **Team** (`/`) and **Repos** (`/repos`), active link has blue underline
   - Dark themed (`bg-gray-900`, bottom border)
2. Update `src/app/layout.tsx` — render `<Navbar />` above `{children}` inside `<body>`
3. Update `src/app/page.tsx` — remove the "GitHub Manager" title from the page header, replace with "Team" heading + subtitle + action buttons

**Verification:**
- Page loads with navbar at top showing "GitHub Manager", Team (active/underlined), Repos
- Clicking "Repos" navigates to `/repos` (404 is fine for now)
- Clicking "Team" or the logo returns to `/`
- Existing team dashboard still works identically below the navbar

**Completed:** Created `src/components/Navbar.tsx` with sticky top bar, active link underline via `usePathname()`. Updated `layout.tsx` to render Navbar. Changed page heading from "GitHub Manager" to "Team".

---

## Milestone 2: AddModal — Searchable Dropdown with Checkboxes ✅ COMPLETED

**Goal:** Replace the flat repo checkbox list in AddModal with a searchable panel for quick repo finding across 111 repos.

1. Refactor `src/components/AddModal.tsx`:
   - Add a search `<input>` at the top of the repo list section with a search icon
   - Filter the checkbox list in real time based on the search query
   - "Select All" / "Deselect All" toggle applies only to *currently visible* (filtered) repos
   - Show a summary line below the search: "N repos selected" (total, not just visible)
   - Clear search button (X) when search has text
2. Keep the existing progress view (per-repo status icons) unchanged — it activates after clicking Add

**Verification:**
- Open Add Collaborator modal → see search input above repo checkboxes
- Type "api" → only repos containing "api" shown, others hidden
- Click "Select All" while filtered → only visible repos get checked
- Clear search → all repos visible again, previously selected ones still checked
- Selected count updates correctly as you check/uncheck
- Add flow still works (progress per repo, success toast)

**Completed:** Added `repoSearch` state, search input with icon/clear button, filtered `Select All`/`Deselect All` that only applies to visible repos, and "N repos selected" summary line.

---

## Milestone 3: Team Page — Repo Text Search (Replace Dropdown) ✅ COMPLETED

**Goal:** Replace the repo `<select>` dropdown with a text input for partial repo name matching.

1. In `src/app/page.tsx`:
   - Replace the `<select>` element for repo filtering with a text `<input>` (with search icon, clear button, same styling as the username search)
   - Change placeholder to "Filter by repo name..."
   - Update filter logic from `m.repos.includes(repoFilter)` to `m.repos.some(r => r.toLowerCase().includes(repoFilter.toLowerCase()))`
2. Both search fields (username + repo) compose with AND logic

**Verification:**
- Team page shows two text inputs side by side: "Search team members..." and "Filter by repo name..."
- Type "api" in repo filter → only members who have a repo containing "api" are shown
- Type both username and repo filter → results match both criteria
- Clear buttons work on both inputs
- "Showing X of Y members" counter respects both filters
- "No matches" state with "Clear filters" button works

**Completed:** Replaced `<select>` dropdown with text `<input>` (search icon + clear button). Updated filter logic to `m.repos.some(r => r.toLowerCase().includes(...))` for partial matching.

---

## Milestone 4: Team Page — Repo Badge Collapse (8 + See More) ✅ COMPLETED

**Goal:** Collapse repo badges for members with many repos to keep the team list scannable.

1. In `src/app/page.tsx`:
   - Add state: `expandedMembers` as a `Set<string>` tracking which members have their badges expanded
   - For each member card, show only the first 8 repo badges by default
   - If `member.repos.length > 8` and not expanded, show a "+N more" button styled as a badge after the 8th
   - Clicking "+N more" adds that username to the expanded set → all badges shown + a "Show less" button
   - Clicking "Show less" removes from the set → collapses back to 8

**Verification:**
- Members with ≤ 8 repos show all badges normally (no button)
- Members with 20+ repos show 8 badges + a "+12 more" badge-styled button
- Click "+12 more" → all 20 badges visible + "Show less" button at the end
- Click "Show less" → back to 8 + "+12 more"
- Expanding one member doesn't affect others
- Works correctly when filters are active (filtered view persists)

**Completed:** Added `expandedMembers` Set state. Badges capped at 8 with "+N more" blue badge button. Clicking expands all badges + "Show less" button. Independent per member.

---

## Milestone 5: Repos Page (`/repos`) ✅ COMPLETED

**Goal:** New page showing all repositories with search, visibility filter, sort, and collaborator count.

1. Create `src/app/api/repos/details/route.ts`:
   - Read from cache (`readCache()`), if no cache → call `fetchTeam()` to populate
   - For each repo, count how many team members include that repo in their `repos[]`
   - Return: `{ repos: [{ name, fullName, private, url, description, collaboratorCount }], totalRepos }` sorted by name by default

2. Create `src/app/repos/page.tsx` — client component:
   - **Header**: "Repositories" title on the left, total count on the right
   - **Filter bar** (below header):
     - Text search input (filters by repo name, with search icon + clear button)
     - Visibility segmented toggle: All / Public / Private (styled as button group)
     - Sort dropdown: Name A→Z, Name Z→A, Most Collaborators, Fewest Collaborators
   - **Repo list**: card per repo showing:
     - Repo name (linked to GitHub URL, opens in new tab)
     - Public/Private badge (green for public, yellow/orange for private)
     - Description (truncated to 1 line, gray text, or "No description" italic)
     - Collaborator count badge (e.g. "3 collaborators")
   - **States**: loading skeleton, empty state ("No repositories found"), no-match state with clear filters button
   - **Styling**: matches team page dark theme, same card style, staggered fade-in animation

**Verification:**
- Navigate to Repos page via navbar → shows all 111 repos
- Type in search → filters repos by name in real time
- Click "Private" toggle → only private repos shown
- Change sort to "Most Collaborators" → repos with most collaborators at top
- Combine search + visibility + sort → all filters compose correctly
- Each repo card shows name (clickable), visibility badge, description, collaborator count
- "No matches" state appears when filters yield zero results
- Navigate back to Team → data still cached, loads instantly

**Completed:** Created `src/app/api/repos/details/route.ts` (reads cache, counts collaborators per repo). Created `src/app/repos/page.tsx` with search, visibility toggle (All/Public/Private), sort dropdown, repo cards with name link, visibility badge, description, collaborator count. All states implemented (loading skeleton, error, empty, no-match).
