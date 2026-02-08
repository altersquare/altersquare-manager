# Authentik RBAC Integration — Milestone Plan

## Milestone 1: Authentik Setup & OIDC Provider Configuration

**Goal:** Configure Authentik so it can issue tokens with a `role` claim to this app.

### Steps

1. **Create Groups** in Authentik admin (`https://auth.coolify.orderstack.dev/`)
   - Directory → Groups → Create → `manager-admin` → Save
   - Directory → Groups → Create → `manager-member` → Save
   - Assign your admin user(s) to `manager-admin`
   - Assign your limited user(s) to `manager-member`

2. **Create Role Scope Mapping**
   - Customization → Property Mappings → Create → Scope Mapping
   - Name: `role`
   - Scope name: `role`
   - Description: `Maps Authentik groups to app roles`
   - Expression:
     ```python
     if request.user.ak_groups.filter(name="manager-admin").exists():
         return {"role": "admin"}
     return {"role": "member"}
     ```
   - Save

3. **Create OAuth2/OpenID Provider**
   - Applications → Providers → Create → OAuth2/OpenID Provider
   - Name: `altersquare-manager`
   - Authorization flow: `default-provider-authorization-implicit-consent`
   - Client type: `Confidential`
   - **Copy the Client ID and Client Secret** — you'll need these in Milestone 2
   - Redirect URIs/Origins (one per line):
     ```
     https://altersquaregithub.coolify.orderstack.dev/api/auth/callback/authentik
     http://localhost:3000/api/auth/callback/authentik
     ```
   - Advanced protocol settings:
     - Scopes: select `openid`, `email`, `profile`, and the `role` mapping from step 2
     - Include claims in id_token: **checked** ✓
   - Save

4. **Create Application**
   - Applications → Applications → Create
   - Name: `AlterSquare Manager`
   - Slug: `altersquare-manager`
   - Provider: `altersquare-manager`
   - Launch URL: `https://altersquaregithub.coolify.orderstack.dev`
   - Save

### Test

- Open `https://auth.coolify.orderstack.dev/application/o/altersquare-manager/.well-known/openid-configuration` in your browser
- Confirm it returns JSON with `authorization_endpoint`, `token_endpoint`, `issuer`, etc.
- Confirm `role` appears in `scopes_supported`

---

## Milestone 2: Install NextAuth & Auth Config (Login/Logout Works)

**Goal:** App redirects to Authentik for login, creates a session, and supports logout. No RBAC yet — just authentication.

### Steps

1. Install `next-auth@beta`
2. Add env vars to `.env`:
   - `AUTH_SECRET` (generate with `npx auth secret`)
   - `AUTH_AUTHENTIK_ID` (Client ID from Milestone 1)
   - `AUTH_AUTHENTIK_SECRET` (Client Secret from Milestone 1)
   - `AUTH_AUTHENTIK_ISSUER=https://auth.coolify.orderstack.dev/application/o/altersquare-manager`
   - `NEXTAUTH_URL=http://localhost:3000`
3. Create `src/lib/auth.ts` — NextAuth config with custom Authentik OIDC provider
4. Create `src/types/next-auth.d.ts` — type augmentation for `role` on session/JWT
5. Create `src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
6. Create `src/middleware.ts` — protect all routes, redirect unauthenticated to login
7. Edit `src/app/layout.tsx` — wrap app in `SessionProvider`
8. Edit `src/components/Navbar.tsx` — show logged-in user name/email + logout button

### Files

| Action | File |
|--------|------|
| Create | `src/lib/auth.ts` |
| Create | `src/types/next-auth.d.ts` |
| Create | `src/app/api/auth/[...nextauth]/route.ts` |
| Create | `src/middleware.ts` |
| Edit   | `.env` |
| Edit   | `package.json` (via npm install) |
| Edit   | `src/app/layout.tsx` |
| Edit   | `src/components/Navbar.tsx` |

### Test

1. Run `npm run dev`, visit `http://localhost:3000`
2. **Unauthenticated:** Should redirect to Authentik login page
3. **Login:** Sign in with any Authentik user → should redirect back to the app, see the Team page
4. **Navbar:** Should show the user's name/email and a Logout button
5. **Logout:** Click Logout → session cleared → redirected to Authentik login
6. **Session persistence:** Refresh the page after login → should still be logged in

---

## Milestone 3: Role Extraction & Exposure (Role Appears in Session)

**Goal:** The `role` claim from Authentik is extracted from the OIDC token and available in both server-side and client-side session.

### Steps

1. Edit `src/lib/auth.ts` — in `jwt` callback, extract `role` from the OIDC profile/token and store on JWT. In `session` callback, expose `session.user.role`.
2. Create `src/lib/session.ts` — server-side helpers: `getSession()` and `requireAdmin()`

### Files

| Action | File |
|--------|------|
| Edit   | `src/lib/auth.ts` |
| Create | `src/lib/session.ts` |

### Test

1. Log in as a user in the `manager-admin` group
2. Open browser console → run: `fetch('/api/auth/session').then(r=>r.json()).then(console.log)`
3. Confirm the response includes `user.role: "admin"`
4. Log out, log in as a user in the `manager-member` group
5. Repeat step 2 — confirm `user.role: "member"`
6. If role is missing or always the same, check:
   - The scope mapping expression in Authentik
   - That `role` scope is attached to the provider
   - That "Include claims in id_token" is checked

---

## Milestone 4: API Route Protection (Server-Side RBAC)

**Goal:** Admin-only API routes return 403 for `member` users. This is the real security layer.

### Steps

1. Edit `src/app/api/team/remove/route.ts` — add `requireAdmin()` check at top
2. Edit `src/app/api/team/remove-one/route.ts` — add `requireAdmin()` check at top
3. Edit `src/app/api/team/add/route.ts` — add `requireAdmin()` check at top
4. Edit `src/app/api/secrets/delete/route.ts` — add `requireAdmin()` check at top

### Files

| Action | File |
|--------|------|
| Edit   | `src/app/api/team/remove/route.ts` |
| Edit   | `src/app/api/team/remove-one/route.ts` |
| Edit   | `src/app/api/team/add/route.ts` |
| Edit   | `src/app/api/secrets/delete/route.ts` |

### Test

1. Log in as `member` user
2. Open browser DevTools → Console, run:
   ```js
   fetch('/api/team/remove-one', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:'test',repo:'test'})}).then(r=>r.json()).then(console.log)
   ```
3. Confirm response: `{"error": "Admin access required"}` with status 403
4. Repeat for `/api/team/add`, `/api/team/remove`, `/api/secrets/delete`
5. Log in as `admin` user → same requests should NOT return 403 (they may return other errors like 404 for nonexistent repos, which is fine — the point is they don't return 403)

---

## Milestone 5: UI Gating (Grey Out Restricted Buttons)

**Goal:** `member` users see restricted buttons as greyed out with an "Admin only" tooltip. `admin` users see everything as normal.

### Steps

1. Edit `src/app/page.tsx` (Team page):
   - Use `useSession()` to get `role`
   - "Remove" button per member: if `member`, render disabled + `title="Admin only"` + reduced opacity
   - "Add Collaborator" button: same treatment for `member`
2. Edit `src/app/repos/[repo]/secrets/page.tsx` (Secrets page):
   - Use `useSession()` to get `role`
   - "Delete" button per secret: if `member`, render disabled + `title="Admin only"` + reduced opacity
3. Ensure 403 API responses display as toast errors (existing toast system should handle this)

### Files

| Action | File |
|--------|------|
| Edit   | `src/app/page.tsx` |
| Edit   | `src/app/repos/[repo]/secrets/page.tsx` |

### Test

1. Log in as `admin` → Team page: Remove buttons are clickable, Add Collaborator button is clickable
2. Go to any repo secrets page → Delete buttons are clickable
3. Log out → Log in as `member`:
   - Team page: Remove buttons are greyed out, hover shows "Admin only" tooltip, clicking does nothing
   - Add Collaborator button: same — greyed out with tooltip
   - Secrets page: Delete buttons are greyed out with tooltip
   - Create/update secrets: works normally
   - Refresh team cache: works normally
4. As `member`, even if you manually trigger the API (DevTools), you get 403 (already verified in Milestone 4)

---

## Milestone Summary

| #  | Milestone                    | What You Can Test After                              |
|----|------------------------------|------------------------------------------------------|
| M1 | Authentik Config             | OIDC discovery endpoint returns valid JSON           |
| M2 | Auth Integration (Login)     | Login/logout flow works, entire app behind auth      |
| M3 | Role Extraction              | `role` claim visible in session for both user types  |
| M4 | API Protection               | 403 returned for member on restricted API routes     |
| M5 | UI Gating                    | Restricted buttons greyed out for member users       |

## Reference: Permission Matrix

| Feature                  | `admin` | `member` |
|--------------------------|---------|----------|
| View team                | ✅      | ✅       |
| View repos               | ✅      | ✅       |
| View secrets             | ✅      | ✅       |
| Refresh team cache       | ✅      | ✅       |
| Create/update secrets    | ✅      | ✅       |
| Add collaborator         | ✅      | ❌       |
| Remove collaborator      | ✅      | ❌       |
| Delete secret            | ✅      | ❌       |
