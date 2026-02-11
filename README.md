# AlterSquare Manager

A centralized GitHub organization management dashboard for the **altersquare** GitHub account. Manage collaborators, repository secrets, repository variables, environments, environment secrets, environment variables, and invitations across all repositories from a single web interface.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)

---

## Features

### Team Management

- **Unified collaborator view** — See all collaborators across every repository in one place, with avatar, username, and per-repo badges.
- **Add collaborators** — Invite a GitHub user to one or more repositories at once (default `push` permission). A multi-select modal shows all available repos with a searchable checkbox list, select/deselect all (applies only to currently visible filtered repos), and live per-repo progress indicators.
- **Remove collaborators** — Remove a user from all or selected repositories with granular control. The removal modal pre-selects all repos, lets you deselect individual ones, and shows per-repo progress with status icons.
- **Search & filter** — Two side-by-side text inputs for filtering by username and by repo name (partial matching). Both compose with AND logic.
- **Collapsible repo badges** — Members with many repos show the first 8 badges with a "+N more" button; click to expand all, click "Show less" to collapse. Independent per member.
- **Stats bar** — Displays total member count and total repo count.
- **Owner excluded** — The `altersquare` owner account is automatically excluded from the team list to prevent accidental self-removal.

### Repository Browser

- **List all repositories** — Browse every repo with name, description, visibility badge (public/private), and collaborator count.
- **Filter & sort** — Search by name, toggle visibility with a segmented control (All / Public / Private), sort by name (A–Z / Z–A) or collaborator count (most / fewest). All filters compose together.
- **Clickable repo cards** — Entire repo card navigates to the per-repo manage page. A small icon links externally to GitHub.
- **Staggered animations** — Cards fade in with staggered delays for a polished loading experience.

### Secrets Management

- **Repository secrets** — Manages GitHub Actions **repository secrets**.
- **View secrets** — List all secrets for a repository with name and last-updated timestamp. Always fetched live from GitHub (no caching — secrets are sensitive).
- **Create & update secrets** — Single upsert endpoint for both create and update. Values are encrypted using **libsodium sealed box** before being sent to the GitHub API. Strict name validation: only uppercase `A-Z`, digits `0-9`, and `_` allowed; names starting with `GITHUB_` are rejected. Validation errors appear inline in real time (no silent auto-uppercasing).
- **Delete secrets** — Remove secrets with a confirmation dialog (admin-only).

### Variables Management

- **Repository variables** — Manages GitHub Actions **repository variables** (plaintext, not encrypted).
- **View variables** — List all variables for a repository with name, value shown inline (truncated if long), and last-updated timestamp.
- **Create & update variables** — Separate create and update endpoints. Same strict name validation as secrets.
- **Delete variables** — Remove variables with a confirmation dialog (admin-only).

### Environment Management

- **Environment CRUD** — Create and delete GitHub Actions environments from the manage page. Members can create environments; only admins can delete them.
- **Environment selector** — Dropdown selector on the per-repo manage page to switch between environments.
- **Environment secrets** — Per-environment secrets encrypted with the environment-specific public key using libsodium sealed box. Same create/update/delete workflow as repo secrets.
- **Environment variables** — Per-environment plaintext variables. Same create/update/delete workflow as repo variables.

### Invitation Management

- **View pending invitations** — Displayed on the per-repo manage page between the heading and secrets list. Always fetched live from GitHub. Shows avatar, username, and sent date for each invitation.
- **Revoke invitations** — Cancel pending invitations with a confirmation modal (admin-only). List updates immediately after revocation.

### Unified Manage Page

- **Single scrollable page** — All repository secrets, variables, environments, and environment-scoped secrets/variables are managed from a single page at `/repos/{repo}/manage`.
- **Per-section loading states** — Each section (secrets, variables, environments) has independent loading skeletons and error states with retry buttons.
- **Toast notifications** — Success and error toasts for all create, update, and delete operations.
- **Accessible modals** — All modals include `role="dialog"`, `aria-modal`, `aria-labelledby`, and Escape key dismissal.
- **Staggered list animations** — Items fade in with staggered delays matching the repo browser style.

### Authentication & Authorization

- **SSO via Authentik** — OIDC-based authentication using [Authentik](https://goauthentik.io/) as the identity provider through NextAuth v5. Scopes: `openid`, `email`, `profile`, `role`, `github_username`.
- **Role-based access control** — A custom Authentik scope mapping evaluates group membership to emit `role: "admin"` or `role: "member"` in the OIDC token. Admin-only actions (remove collaborator, delete secret, revoke invitation) are enforced both server-side (403) and client-side (disabled buttons with "Admin only" tooltips).
- **GitHub username-based repo filtering** — Each member's GitHub username is stored as a custom Authentik attribute and exposed via a `github_username` OIDC scope mapping. Members can only see and manage repos they are a collaborator on. The team page is filtered to show only collaborators who share repos with the member. Admins remain fully unrestricted.
- **Access blocking for unconfigured members** — Members without a `github_username` attribute in Authentik are blocked from the entire application and shown a "contact your administrator" page with a sign-out button.
- **Defense-in-depth enforcement** — Access controls are enforced at both the middleware level (page route redirects) and the API level (per-route guards). Case-insensitive GitHub username matching ensures compatibility with GitHub's username handling.
- **Middleware protection** — All page routes require authentication; unauthenticated users are redirected to the sign-in page. Members without a GitHub username are redirected to `/no-access`. API routes handle their own auth via `requireAdmin()`, `requireGithubUsername()`, or `requireMemberRepoAccess()`.

### Performance & Caching

- **File-based cache** — Team and repo data is cached to `data/cache.json` on disk to minimize GitHub API calls.
- **Global sync button** — A sync button in the navbar (accessible on all pages) clears the cache and fetches fresh data from GitHub. A tooltip explains what gets synced. Both the Team and Repos pages auto re-fetch after sync completes.
- **Last synced timestamp** — Displayed in the navbar as an absolute timestamp (e.g. "Synced: 2/11/2026, 3:45 PM").
- **In-place cache updates** — Mutations (e.g., removing a collaborator) update the cache directly to avoid full refetches.
- **Parallel data fetching** — Collaborators for all repos are fetched in parallel via `Promise.allSettled`, with graceful handling of 403 errors on restricted repos (e.g., forks).
- **App version in navbar** — The package.json version is displayed in the navbar title so you can tell when the UI has been updated.

---

## Tech Stack

| Layer       | Technology                                    |
| ----------- | --------------------------------------------- |
| Framework   | Next.js 16 (App Router, standalone output)    |
| Language    | TypeScript 5.9                                |
| UI          | React 19, Tailwind CSS 4                      |
| Auth        | NextAuth v5 (beta) + Authentik OIDC           |
| GitHub API  | Octokit 5                                     |
| Encryption  | libsodium-wrappers (sealed box)               |
| Container   | Docker (Node 22 Alpine, multi-stage build)    |

---

## Environment Variables

| Variable               | Required | Description                                          |
| ---------------------- | -------- | ---------------------------------------------------- |
| `AUTH_AUTHENTIK_ISSUER` | Yes      | Authentik OIDC issuer URL                            |
| `AUTH_AUTHENTIK_ID`     | Yes      | Authentik OIDC client ID                             |
| `AUTH_AUTHENTIK_SECRET` | Yes      | Authentik OIDC client secret                         |
| `AUTH_SECRET`           | Yes      | NextAuth session encryption secret                   |
| `GITHUB_TOKEN`          | Yes      | GitHub personal access token with repo/admin scopes  |
| `GITHUB_USERNAME`       | No       | GitHub user or org name (defaults to `altersquare`)  |

---

## Getting Started

### Development

```bash
npm install
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t altersquare-manager .

docker run -p 3000:3000 \
  -e AUTH_AUTHENTIK_ISSUER=https://auth.example.com/application/o/app \
  -e AUTH_AUTHENTIK_ID=your-client-id \
  -e AUTH_AUTHENTIK_SECRET=your-client-secret \
  -e AUTH_SECRET=your-nextauth-secret \
  -e GITHUB_TOKEN=ghp_xxxxxxxxxxxx \
  altersquare-manager
```

The Docker image uses a multi-stage build (Node 22 Alpine), runs as a non-root user, and exposes port **3000**.

### Authentik Setup

The app expects two Authentik groups and a custom scope mapping:

1. **Groups** — Create `altersquare-github-manager` (admin) and `altersquare-github-member` (member) groups in Authentik. Assign users accordingly.
2. **Role Scope Mapping** — Create an OAuth2/OpenID scope mapping named `role` with this expression:
   ```python
   if request.user.ak_groups.filter(name="altersquare-github-manager").exists():
       return {"role": "admin"}
   return {"role": "member"}
   ```
3. **GitHub Username Scope Mapping** — Create an OAuth2/OpenID scope mapping named `github_username` with this expression:
   ```python
   return {"github_username": request.user.attributes.get("github_username", "")}
   ```
4. **Per-User GitHub Username** — For each member user, add a custom attribute: **User → Edit → Attributes** → add `github_username: "their-gh-login"`. Members without this attribute will be blocked from the app.
5. **Application + Provider** — Create an OAuth2/OIDC application with `Confidential` client type, the `role` and `github_username` scope mappings attached alongside `openid`, `email`, `profile`, and "Include claims in id_token" enabled.
6. **Redirect URIs**:
   ```
   https://your-domain.com/api/auth/callback/authentik
   http://localhost:3000/api/auth/callback/authentik
   ```

---

## Design Decisions

| Decision | Rationale |
| -------- | --------- |
| JSON file cache, no database | Simple local tool — no external dependencies needed |
| GitHub username stored in Authentik, not fetched at runtime | No extra API calls or env vars; cached in the OIDC token |
| Cache-based collaborator validation | Avoids GitHub API rate limits; freshness governed by existing refresh mechanism |
| Case-insensitive username matching | GitHub usernames are case-insensitive |
| Members without `github_username` blocked entirely | Prevents partial/broken experience; clear admin action required |
| Default `push` permission for collaborators | Keeps the add-collaborator UX simple |
| Owner excluded from team list | Prevents accidental self-removal |
| Repository secrets, not environment secrets | Per user requirement |
| Now supports environment secrets, variables, and environment CRUD | Extended per user requirement |
| Secrets always fetched live (no caching) | Sensitive data — stale cache is risky |
| Strict secret name validation (no auto-uppercase) | Explicit errors over silent transformations |
| Single upsert endpoint for create/update | GitHub's PUT endpoint is idempotent |
| POST for delete operations | Matches existing codebase patterns |
| Classic PAT with full `repo` scope | Covers both collaborator and Actions secrets APIs |
| Standalone Next.js output | Minimal Docker image size |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                      # Team dashboard
│   ├── no-access/
│   │   └── page.tsx                  # Blocked member landing page
│   ├── repos/
│   │   ├── page.tsx                  # Repository browser
│   │   └── [repo]/manage/page.tsx    # Per-repo manage page (secrets, variables, environments)
│   └── api/
│       ├── auth/[...nextauth]/       # NextAuth OIDC handler
│       ├── repos/                    # Repo listing & details
│       │   ├── details/              # Repos with collaborator counts
│       │   └── invitations/          # Pending invitations & revoke
│       ├── secrets/                  # List, create, delete repo secrets
│       ├── variables/                # List, create, update, delete repo variables
│       ├── environments/             # List, create, delete environments
│       │   ├── secrets/              # List, create, delete env secrets
│       │   └── variables/            # List, create, update, delete env variables
│       └── team/                     # Team CRUD & cache refresh
│           └── status/               # Lightweight cache timestamp endpoint
├── components/                       # Modals, navbar, toast, sync context, skeletons
├── lib/
│   ├── auth.ts                       # NextAuth config (Authentik OIDC)
│   ├── cache.ts                      # File-based cache read/write
│   ├── github.ts                     # Octokit helpers (fetchTeam, secrets, variables, environments, etc.)
│   └── session.ts                    # Session helpers, admin guard & repo access validation
├── proxy.ts                          # Auth middleware for page routes
└── types/
    └── next-auth.d.ts                # Extended NextAuth type definitions
data/
└── cache.json                        # Runtime cache (team + repo data)
```

---

## API Reference

| Endpoint                                          | Method | Auth    | Description                                  |
| ------------------------------------------------- | ------ | ------- | -------------------------------------------- |
| `/api/team`                                        | GET    | Member+ | Get team data (filtered for members)         |
| `/api/team/refresh`                                | POST   | Member+ | Force refresh team data from GitHub          |
| `/api/team/status`                                 | GET    | Member+ | Get cache timestamp (lightweight)            |
| `/api/team/add`                                    | POST   | Admin   | Add collaborator to a repo                   |
| `/api/team/remove`                                 | POST   | Admin   | Remove collaborator from all their repos     |
| `/api/team/remove-one`                             | POST   | Admin   | Remove collaborator from a single repo       |
| `/api/repos`                                       | GET    | Member+ | List all repositories                        |
| `/api/repos/details`                               | GET    | Member+ | Repos with collaborator counts (filtered)    |
| `/api/repos/invitations`                           | GET    | Member+ | Pending invitations for a repo               |
| `/api/repos/invitations/revoke`                    | POST   | Admin   | Revoke a pending invitation                  |
| `/api/secrets`                                     | GET    | Member+ | List repo secrets (repo access required)     |
| `/api/secrets/create`                              | POST   | Member+ | Create or update a repo secret               |
| `/api/secrets/delete`                              | POST   | Admin   | Delete a repo secret                         |
| `/api/variables`                                   | GET    | Member+ | List repo variables (repo access required)   |
| `/api/variables/create`                            | POST   | Member+ | Create a repo variable                       |
| `/api/variables/update`                            | POST   | Member+ | Update a repo variable                       |
| `/api/variables/delete`                            | POST   | Admin   | Delete a repo variable                       |
| `/api/environments`                                | GET    | Member+ | List environments (repo access required)     |
| `/api/environments/create`                         | POST   | Member+ | Create an environment                        |
| `/api/environments/delete`                         | POST   | Admin   | Delete an environment                        |
| `/api/environments/secrets`                        | GET    | Member+ | List environment secrets                     |
| `/api/environments/secrets/create`                 | POST   | Member+ | Create or update an environment secret       |
| `/api/environments/secrets/delete`                 | POST   | Admin   | Delete an environment secret                 |
| `/api/environments/variables`                      | GET    | Member+ | List environment variables                   |
| `/api/environments/variables/create`               | POST   | Member+ | Create an environment variable               |
| `/api/environments/variables/update`               | POST   | Member+ | Update an environment variable               |
| `/api/environments/variables/delete`               | POST   | Admin   | Delete an environment variable               |
