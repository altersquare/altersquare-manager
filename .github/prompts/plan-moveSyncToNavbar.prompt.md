## Plan: Move Sync Button & Last Synced to Navbar

> **Status: IMPLEMENTED** — Completed February 11, 2026.

The sync button and timestamp move from [src/app/page.tsx](src/app/page.tsx) into [src/components/Navbar.tsx](src/components/Navbar.tsx) via a shared React Context. A tooltip on the button explains what syncing does.

**Steps**

1. **Create `src/components/SyncContext.tsx`** — new file
   - `SyncProvider` component + `useSync()` hook
   - State: `cachedAt: string | null`, `refreshing: boolean`
   - `handleRefresh()` calls `POST /api/team/refresh`, updates `cachedAt`, shows toast
   - `registerSyncCallback` / `unregisterSyncCallback` so pages can react to a sync (e.g., Team page re-renders its member list, Repos page could refresh its repo list)
   - On mount, fetch initial `cachedAt` from a lightweight endpoint (see step 2)

2. **Create `GET /api/team/status` route** — new file `src/app/api/team/status/route.ts`
   - Reads cache via `readCache()`, returns `{ cachedAt }` (or `null` if no cache)
   - Avoids loading full team/repo data just for the timestamp on every page load

3. **Wrap app in `SyncProvider`** — in [src/app/layout.tsx](src/app/layout.tsx)
   - Place inside `<ToastProvider>` and outside `<Navbar />`

4. **Update [src/components/Navbar.tsx](src/components/Navbar.tsx)** — add sync button + timestamp + tooltip
   - Import `useSync()`, render refresh button and compact `cachedAt` display to the left of user info
   - **Tooltip**: a hover tooltip on the button with text like:
     > "Sync team & repo data from GitHub. This app caches organization members, their repo access, and repository metadata. Clicking refresh fetches the latest data from GitHub and updates the cache."
   - Implementation: use a `group relative` wrapper with an absolutely-positioned tooltip div that appears on hover (`invisible group-hover:visible`). Pure CSS, no library needed — matches the existing Tailwind-only approach.
   - Show spinning icon when `refreshing`, disable button, "Syncing..." text
   - Timestamp as compact `text-xs text-gray-500` absolute format: "Synced: 2/11/2026, 3:45 PM" — hidden on small screens
   - Visible to **all authenticated users** (not admin-only)

5. **Update [src/app/page.tsx](src/app/page.tsx)** — remove sync UI, consume context
   - Remove `refreshing` state, `handleRefresh` callback, refresh button JSX, and "Last Synced" stat card
   - Use `useSync()` to register a callback that calls `setData(json)` when sync completes from the Navbar
   - Stats grid goes from 3 → 2 columns

6. **Update [src/app/repos/page.tsx](src/app/repos/page.tsx)** — register a sync callback
   - After a sync from the Navbar, **auto re-fetch** repo data from `/api/repos/details` so the list updates immediately
   - This makes the sync truly global — both pages refresh when the button is clicked

**Tooltip content**

The tooltip will say:
> **Refresh from GitHub**
> Re-syncs team members, collaborator access, and repository data from GitHub. The app caches this data locally to avoid repeated API calls.

This covers what the button does and what's cached, as requested.

**Verification**
- On Team page (`/`): sync button in navbar, click it → team list updates, timestamp updates, toast shown
- On Repos page (`/repos`): sync button in navbar, click it → repos list refreshes with new data, timestamp updates
- Hover over sync button → tooltip appears explaining the action and cache contents
- Test error states (network failure, rate limit) → toast with error message
- Responsive: tooltip and timestamp hidden/adjusted on small screens

**Decisions**
- **Timestamp format**: Absolute (e.g. "Synced: 2/11/2026, 3:45 PM"), not relative
- **Auto re-fetch**: Pages auto re-fetch their data after sync completes (not toast-only)
- **Visibility**: All authenticated users, not admin-only
- Pure CSS tooltip (Tailwind `group-hover`) over a tooltip library — no new dependencies, consistent with existing stack
- Dedicated `/api/team/status` endpoint over reusing `/api/team` — avoids loading full data on every page just for a timestamp
- Sync callbacks per-page over global data in context — keeps the context lightweight; pages own their data
