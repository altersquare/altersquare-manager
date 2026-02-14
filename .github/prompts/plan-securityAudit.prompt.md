# Security Audit — AlterSquare Manager

## Context

- **App**: Next.js service managing GitHub repos, secrets, variables, environments, and team members
- **Deployment**: Public internet via Coolify, single-instance
- **Auth**: Authentik as OIDC provider only (not forward auth proxy) — unauthenticated requests reach Next.js directly
- **Shared GitHub token**: Accepted risk, not changing
- **Decisions**: Double-submit cookie CSRF, in-memory rate limiting, Zod validation

---

## ~~Milestone 1 — Zod Request Validation~~ ✅

> **Done.** Created `src/lib/schemas.ts` with Zod schemas and `parseBody()` helper. Updated all 15 POST route handlers.

### Steps

1. Install `zod` dependency
2. Create `src/lib/schemas.ts` with Zod schemas for every POST route body:
   - `repo`: matches GitHub `owner/repo` pattern, max 200 chars
   - `username`: alphanumeric + hyphens, max 39 chars
   - `name` (secret/variable): `/^[A-Z0-9_]+$/`, no `GITHUB_` prefix, max 255 chars
   - `value` (secret/variable): string, max 64KB
   - `env` (environment name): string, max 255 chars
3. Update all ~18 POST route handlers to use `schema.safeParse()` instead of `as { ... }`
4. Return `400 { error: "Invalid request", details: zodError.issues }` on validation failure

### Test

Paste in browser console (must be logged in):

```js
// Helper — logs status + body for each test
async function test(label, url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`[${r.status}] ${label}`, await r.json());
}

// 1. Missing required field → 400
await test("Missing fields", "/api/secrets/create", {});

// 2. Path traversal in repo name → 400
await test("Path traversal repo", "/api/secrets/create", {
  repo: "../../etc/passwd", name: "FOO", value: "bar",
});

// 3. Invalid secret name (lowercase, special chars) → 400
await test("Invalid secret name", "/api/secrets/create", {
  repo: "org/repo", name: "lowercase-bad!", value: "x",
});

// 4. GITHUB_ prefix blocked → 400
await test("GITHUB_ prefix", "/api/secrets/create", {
  repo: "org/repo", name: "GITHUB_HACK", value: "x",
});

// 5. Oversized value (100KB) → 400
await test("Oversized value", "/api/secrets/create", {
  repo: "org/repo", name: "A", value: "x".repeat(100_000),
});

// 6. Invalid username format → 400
await test("Bad username", "/api/team/add", {
  username: "../../../etc",
});

// 7. Oversized environment name → 400
await test("Long env name", "/api/environments/create", {
  repo: "org/repo", name: "A".repeat(300),
});
```

All should return `400`. If any returns `200`/`500`, validation is missing.

---

## ~~Milestone 2 — Error Response Sanitization~~ ✅

> **Done.** Removed `detail: message` leak from `repos/route.ts`, removed `GITHUB_TOKEN in .env` references from `team/route.ts` and `team/refresh/route.ts`. All error responses now return generic messages; verbose errors logged server-side only.

### Steps

1. `src/app/api/repos/route.ts` — Remove `detail: message` from catch block, replace with generic message
2. `src/app/api/team/route.ts` — Remove `"GITHUB_TOKEN in .env"` reference, replace with `"Authentication with GitHub failed"`
3. `src/app/api/team/refresh/route.ts` — Same as above
4. Audit all remaining route catch blocks — ensure none return raw `error.message` or stack traces
5. Add `console.error` logging before every generic error response so debugging is still possible server-side

### Test

Paste in browser console (must be logged in):

```js
// Fetch endpoints that might leak error details and inspect response bodies
const endpoints = [
  { label: "repos", url: "/api/repos" },
  { label: "team", url: "/api/team" },
  { label: "team/refresh", url: "/api/team/refresh", method: "POST" },
];

for (const ep of endpoints) {
  const r = await fetch(ep.url, { method: ep.method || "GET" });
  const text = await r.text();
  const leaks = ["GITHUB_TOKEN", "in .env", "errno", "ENOENT", "at Object.", "at Module.", "at async"]
    .filter(term => text.includes(term));
  if (leaks.length) {
    console.error(`❌ ${ep.label} leaks: ${leaks.join(", ")}`, text);
  } else {
    console.log(`✅ ${ep.label} [${r.status}] — no internal details leaked`);
  }
}
```

Also run in the project directory (not browser):

```bash
# Grep source for strings that should never appear in JSON responses
grep -rn "detail.*message\|GITHUB_TOKEN.*\.env" src/app/api/
# Should return zero matches after fixes
```

---

## Milestone 3 — CSRF Protection (Double-Submit Cookie) ✅

> **Goal**: Protect all POST routes from cross-site request forgery.

### Steps

1. Create `src/lib/csrf.ts`:
   - `generateCsrfToken()`: returns a random 32-byte hex string
   - `setCsrfCookie(response)`: sets `__csrf` cookie (HttpOnly=false so JS can read it, SameSite=Strict, Secure=true)
   - `verifyCsrf(request)`: compares `X-CSRF-Token` header against `__csrf` cookie value; returns 403 on mismatch
2. In `src/proxy.ts` (middleware): on every `GET` navigation response, set the CSRF cookie if not present
3. In all ~18 POST route handlers: call `verifyCsrf(request)` as the first check (before auth)
4. Create a shared frontend fetch wrapper `src/lib/fetch.ts` that:
   - Reads the `__csrf` cookie value
   - Attaches `X-CSRF-Token` header to all POST requests
5. Update all frontend `fetch()` calls to use the wrapper (in page components and modals)

### Test

Paste in browser console (must be logged in):

```js
// Helper to read a cookie value
function getCookie(name) {
  return document.cookie.split("; ").find(c => c.startsWith(name + "="))?.split("=")[1];
}

const body = JSON.stringify({ repo: "org/repo", name: "TEST_CSRF", value: "x" });

// 1. POST without CSRF header → should be 403
let r1 = await fetch("/api/secrets/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
});
console.log(`[${r1.status}] No CSRF header →`, r1.status === 403 ? "✅ blocked" : "❌ NOT blocked");

// 2. POST with wrong CSRF token → should be 403
let r2 = await fetch("/api/secrets/create", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-CSRF-Token": "wrong-token" },
  body,
});
console.log(`[${r2.status}] Wrong CSRF →`, r2.status === 403 ? "✅ blocked" : "❌ NOT blocked");

// 3. POST with correct CSRF token → should NOT be 403 (may be 400/401/200 depending on auth+validation)
const csrfToken = getCookie("__csrf");
if (!csrfToken) {
  console.warn("⚠️ No __csrf cookie found — visit a page first to get one");
} else {
  let r3 = await fetch("/api/secrets/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body,
  });
  console.log(`[${r3.status}] Valid CSRF →`, r3.status !== 403 ? "✅ passed CSRF" : "❌ wrongly blocked");
}

// 4. Verify existing app functionality still works — click around the UI and confirm
//    secrets/variables/environments/team operations complete without CSRF errors
```

---

## Milestone 4 — Rate Limiting ✅

> **Goal**: Add in-memory per-IP rate limiting to all API routes, with stricter limits on expensive endpoints.

### Steps

1. Create `src/lib/rate-limit.ts`:
   - Sliding window rate limiter keyed by IP
   - Configurable `windowMs` and `maxRequests` per route group
   - Auto-cleanup of expired entries to prevent memory leaks
   - Returns `{ success: boolean, remaining: number, resetAt: number }`
2. Define rate limit tiers:
   - **Standard**: 60 requests/minute (most routes)
   - **Strict**: 5 requests/minute (`/api/team/refresh`, `/api/team/add`, `/api/team/remove`)
   - **Create/Delete**: 20 requests/minute (secrets/variables/environments CRUD)
3. Apply rate limiter as the first check in each route handler (before CSRF and auth)
4. Return `429 { error: "Too many requests" }` with `Retry-After` header

### Test

Paste in browser console (must be logged in):

```js
function getCookie(name) {
  return document.cookie.split("; ").find(c => c.startsWith(name + "="))?.split("=")[1];
}

// Rapid-fire 10 requests to a strict-limited endpoint (limit: 5/min)
const csrfToken = getCookie("__csrf") || "";
const results = await Promise.all(
  Array.from({ length: 10 }, (_, i) =>
    fetch("/api/team/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    }).then(async r => ({
      i: i + 1,
      status: r.status,
      retryAfter: r.headers.get("Retry-After"),
      body: await r.text(),
    }))
  )
);

results.forEach(r => {
  const icon = r.status === 429 ? "🛑" : "✅";
  console.log(`${icon} Request #${r.i}: ${r.status}${r.retryAfter ? ` (Retry-After: ${r.retryAfter}s)` : ""}`);
});

const blocked = results.filter(r => r.status === 429).length;
console.log(`\n${blocked}/10 requests rate-limited →`, blocked >= 5 ? "✅ rate limiting works" : "❌ not enough requests blocked");

// Wait 60s and retry — should succeed again
// setTimeout(async () => {
//   const r = await fetch("/api/team/refresh", { method: "POST",
//     headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken } });
//   console.log("After cooldown:", r.status);
// }, 61000);
```

---

## Milestone 5 — Security Headers

> **Goal**: Add comprehensive security headers via Next.js config.

### Steps

1. Update `next.config.mjs` to add a `headers()` function returning headers for all routes (`/**`):
   - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.githubusercontent.com; connect-src 'self'; frame-ancestors 'none'`
   - `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
   - `X-Frame-Options`: `DENY`
   - `X-Content-Type-Options`: `nosniff`
   - `Referrer-Policy`: `strict-origin-when-cross-origin`
   - `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`
2. Adjust CSP if the app loads external scripts/fonts/styles (check `layout.tsx` and `globals.css` for external resources)

### Test

Paste in browser console:

```js
// Check all required security headers on the current page
const requiredHeaders = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

// Fetch the page headers via a same-origin request
const r = await fetch(window.location.href);
const missing = requiredHeaders.filter(h => !r.headers.get(h));
const present = requiredHeaders.filter(h => r.headers.get(h));

present.forEach(h => console.log(`✅ ${h}: ${r.headers.get(h)}`));
missing.forEach(h => console.error(`❌ ${h}: MISSING`));

console.log(`\n${present.length}/${requiredHeaders.length} headers present →`,
  missing.length === 0 ? "✅ all good" : `❌ missing: ${missing.join(", ")}`);

// Also check for CSP violations in the console — if the app loaded without
// "Refused to ..." errors, the CSP policy is compatible with the app.
```

Also test externally: visit https://securityheaders.com and scan the app URL — should score A or A+.

---

## Milestone 6 — Cache Hardening

> **Goal**: Make file-based cache resilient to corruption, race conditions, and permission leaks.

### Steps

1. Update `src/lib/cache.ts`:
   - **Atomic writes**: Write to `data/cache.json.tmp`, then `fs.rename()` to `data/cache.json`
   - **File permissions**: `fs.chmod('data/cache.json', 0o600)` after rename
   - **Simple file lock**: Use a `data/cache.lock` file — acquire before write, release after. Spin-wait with timeout for concurrent callers.
2. Add `cachedAt` timestamp to the cache data structure (if not already present)
3. Add configurable TTL (default 1 hour) — `CACHE_TTL_MS` env var
4. In `src/lib/session.ts` `requireMemberRepoAccess()`: if cache age exceeds TTL, do a live GitHub API check for that specific user/repo pair as fallback
5. Update `src/lib/cache.ts` `getCache()` to return `null` if cache has expired, triggering refresh

### Test

Paste in browser console (must be logged in):

```js
function getCookie(name) {
  return document.cookie.split("; ").find(c => c.startsWith(name + "="))?.split("=")[1];
}
const csrfToken = getCookie("__csrf") || "";
const headers = { "Content-Type": "application/json", "X-CSRF-Token": csrfToken };

// 1. Fire two concurrent refresh calls — both should succeed without corrupting the cache
const [r1, r2] = await Promise.all([
  fetch("/api/team/refresh", { method: "POST", headers }),
  fetch("/api/team/refresh", { method: "POST", headers }),
]);
console.log(`Concurrent refresh: ${r1.status}, ${r2.status}`);

// 2. Verify the cache is still valid by loading team data
const team = await fetch("/api/team").then(r => r.json());
console.log("Cache intact after concurrent writes:",
  Array.isArray(team?.team) ? "✅ valid" : "❌ corrupted", team);

// 3. Check cachedAt is present and recent (within last 30 seconds)
if (team.cachedAt) {
  const age = Date.now() - new Date(team.cachedAt).getTime();
  console.log(`Cache age: ${Math.round(age / 1000)}s →`,
    age < 30000 ? "✅ fresh" : "⚠️ stale");
} else {
  console.warn("⚠️ No cachedAt field in response");
}
```

Also verify on the server / container:

```bash
# File permissions should be 600
stat data/cache.json

# File should be valid JSON
python3 -m json.tool data/cache.json > /dev/null && echo "✅ valid JSON" || echo "❌ corrupted"
```

---

## Milestone 7 — OIDC Claim Validation

> **Goal**: Prevent privilege escalation via tampered OIDC claims.

### Steps

1. In `src/lib/auth.ts`, in the JWT callback:
   - Validate `role` against allowlist `["admin", "member"]` — default to `"member"` if invalid
   - Validate `githubUsername` against `/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/` — reject session if invalid
2. Log a warning server-side when an invalid claim is received (potential tampering indicator)

### Test

Paste in browser console:

```js
// Test the username validation regex (same one used server-side)
const usernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const validRoles = ["admin", "member"];

const usernameTests = [
  ["valid-user", true],
  ["octocat", true],
  ["a", true],
  ["user-with-hyphens-123", true],
  ["../../admin", false],
  ["", false],
  ["-start-hyphen", false],
  ["end-hyphen-", false],
  ["a".repeat(40), false],  // too long
  ["has spaces", false],
  ["has@special!", false],
];

const roleTests = [
  ["admin", true],
  ["member", true],
  ["superadmin", false],
  ["", false],
  ["ADMIN", false],
  ["root", false],
];

console.group("Username validation");
usernameTests.forEach(([input, expected]) => {
  const result = usernameRegex.test(input);
  const icon = result === expected ? "✅" : "❌";
  console.log(`${icon} "${input}" → ${result} (expected ${expected})`);
});
console.groupEnd();

console.group("Role validation");
roleTests.forEach(([input, expected]) => {
  const result = validRoles.includes(input);
  const icon = result === expected ? "✅" : "❌";
  console.log(`${icon} "${input}" → ${result} (expected ${expected})`);
});
console.groupEnd();

// Verify your own session has valid claims
const session = await fetch("/api/auth/session").then(r => r.json());
console.log("\nCurrent session:", {
  role: session?.user?.role,
  roleValid: validRoles.includes(session?.user?.role) ? "✅" : "❌",
  username: session?.user?.githubUsername,
  usernameValid: usernameRegex.test(session?.user?.githubUsername || "") ? "✅" : "❌",
});
```

---

## Milestone 8 — Dependency Pinning & Cleanup

> **Goal**: Pin next-auth to avoid surprise beta upgrades; run dependency audit.

### Steps

1. In `package.json`: change `"next-auth": "^5.0.0-beta.30"` to `"next-auth": "5.0.0-beta.30"` (remove caret)
2. Run `npm audit` and address any findings
3. Run `npm outdated` and note any security-relevant updates

### Test

Run in project terminal:

```bash
npm audit # should report no critical/high vulnerabilities
npm ls next-auth # should show exact pinned version, no caret
```

Paste in browser console to verify the running app version:

```js
// Sanity check — app should still boot and respond
const r = await fetch("/api/auth/session");
console.log("App running:", r.ok ? "✅" : "❌", `status=${r.status}`);
```

---

## Milestone 9 — Miscellaneous Hardening

> **Goal**: Address remaining low-severity findings.

### Steps

1. **sample.env**: Replace real Authentik issuer URL with `https://auth.example.com/application/o/your-app/`
2. **data/cache.json in .gitignore**: Verify it's listed; add if not
3. **Avatar URL validation**: In `src/app/page.tsx` and any components rendering `<img src={member.avatarUrl}>`, validate URL starts with `https://avatars.githubusercontent.com/` — fall back to a default avatar otherwise
4. **Dockerfile comment**: Add a comment above the `data/` directory creation noting it contains sensitive team/access metadata

### Test

Paste in browser console:

```js
// 1. Check all avatar images use allowed GitHub domain
const avatars = document.querySelectorAll("img[src*='avatar']");
const allowedPrefix = "https://avatars.githubusercontent.com/";

if (avatars.length === 0) {
  console.warn("⚠️ No avatar images found on this page — navigate to the team page and re-run");
} else {
  avatars.forEach(img => {
    const ok = img.src.startsWith(allowedPrefix);
    console.log(ok ? "✅" : "❌", img.src.slice(0, 80));
  });
  const bad = [...avatars].filter(img => !img.src.startsWith(allowedPrefix));
  console.log(`\n${avatars.length - bad.length}/${avatars.length} avatars valid →`,
    bad.length === 0 ? "✅ all good" : `❌ ${bad.length} from unexpected domains`);
}

// 2. Verify sample.env doesn't leak real URLs (requires fetch — may 404 in prod, that's fine)
try {
  const env = await fetch("/sample.env").then(r => r.text());
  const leaks = ["coolify", "orderstack"].filter(t => env.toLowerCase().includes(t));
  console.log(leaks.length ? `❌ sample.env leaks: ${leaks.join(", ")}` : "✅ sample.env clean");
} catch {
  console.log("ℹ️ sample.env not served (expected in production)");
}
```

Also verify in the project directory:

```bash
grep -i "coolify\|orderstack" sample.env   # should return nothing
grep "cache.json" .gitignore                # should match
```

---

## Execution Order & Dependencies

```
Milestone 1 (Zod)  ─────────────────────────────────────┐
Milestone 2 (Error sanitization)  ───────────────────────┤
Milestone 5 (Security headers)  ─────────────────────────┤  Independent — can be done in any order
Milestone 7 (OIDC validation)  ──────────────────────────┤
Milestone 8 (Dependency pinning)  ───────────────────────┤
Milestone 9 (Misc hardening)  ───────────────────────────┘
                                                          
Milestone 3 (CSRF)  ← requires frontend fetch wrapper    │  Sequential — CSRF before rate limiting
Milestone 4 (Rate limiting)  ← applies before CSRF check │  so rate limiter goes first in the chain
                                                          
Milestone 6 (Cache hardening)  ← standalone               
```

## Final Verification

After all milestones are complete, paste this comprehensive check in the browser console (must be logged in):

```js
console.log("=== AlterSquare Manager — Security Audit Final Verification ===");
console.log("Run this from the main page while logged in as admin\n");

function getCookie(name) {
  return document.cookie.split("; ").find(c => c.startsWith(name + "="))?.split("=")[1];
}

const results = [];
function log(pass, label, detail = "") {
  results.push({ pass, label });
  console.log(`${pass ? "✅" : "❌"} ${label}`, detail);
}

// --- 1. Security headers ---
console.group("1. Security Headers");
const page = await fetch(window.location.href);
["content-security-policy", "strict-transport-security", "x-frame-options",
 "x-content-type-options", "referrer-policy", "permissions-policy"
].forEach(h => log(!!page.headers.get(h), h, page.headers.get(h) || "MISSING"));
console.groupEnd();

// --- 2. CSRF protection ---
console.group("2. CSRF Protection");
const csrfBody = JSON.stringify({ repo: "test/test", name: "AUDIT_TEST", value: "x" });

// No CSRF header → should be 403
const noCsrf = await fetch("/api/secrets/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: csrfBody,
});
log(noCsrf.status === 403, "POST without CSRF token blocked", `status=${noCsrf.status}`);

// Wrong CSRF header → should be 403
const wrongCsrf = await fetch("/api/secrets/create", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-CSRF-Token": "wrong" },
  body: csrfBody,
});
log(wrongCsrf.status === 403, "POST with wrong CSRF token blocked", `status=${wrongCsrf.status}`);
console.groupEnd();

// --- 3. Zod validation ---
console.group("3. Input Validation (Zod)");
const csrfToken = getCookie("__csrf") || "";
const validationHeaders = { "Content-Type": "application/json", "X-CSRF-Token": csrfToken };

const zodTests = [
  ["/api/secrets/create", {}, "Empty body"],
  ["/api/secrets/create", { repo: "../../etc", name: "F", value: "x" }, "Path traversal repo"],
  ["/api/secrets/create", { repo: "org/repo", name: "bad!", value: "x" }, "Invalid name"],
  ["/api/team/add", { username: "../admin" }, "Invalid username"],
  ["/api/environments/create", { repo: "org/repo", name: "A".repeat(300) }, "Oversized env name"],
];

for (const [url, body, label] of zodTests) {
  const r = await fetch(url, { method: "POST", headers: validationHeaders, body: JSON.stringify(body) });
  log(r.status === 400, label, `status=${r.status}`);
}
console.groupEnd();

// --- 4. Rate limiting ---
console.group("4. Rate Limiting");
const rateResults = await Promise.all(
  Array.from({ length: 10 }, () =>
    fetch("/api/team/refresh", { method: "POST", headers: validationHeaders })
      .then(r => r.status)
  )
);
const rateLimited = rateResults.filter(s => s === 429).length;
log(rateLimited >= 5, `Rate limiting (${rateLimited}/10 blocked)`, rateResults.join(", "));
console.groupEnd();

// --- 5. Error sanitization ---
console.group("5. Error Sanitization");
for (const url of ["/api/repos", "/api/team"]) {
  const r = await fetch(url);
  const text = await r.text();
  const leaks = ["GITHUB_TOKEN", ".env", "stack", "errno"].filter(t => text.includes(t));
  log(leaks.length === 0, `${url} — no leaks`, leaks.length ? leaks.join(", ") : "clean");
}
console.groupEnd();

// --- 6. Avatar validation ---
console.group("6. Avatar URLs");
const imgs = document.querySelectorAll("img[src*='avatar']");
const badAvatars = [...imgs].filter(i => !i.src.startsWith("https://avatars.githubusercontent.com/"));
log(badAvatars.length === 0, `Avatars (${imgs.length} found, ${badAvatars.length} invalid)`);
console.groupEnd();

// --- 7. Session claims ---
console.group("7. Session Claims");
const session = await fetch("/api/auth/session").then(r => r.json());
const validRoles = ["admin", "member"];
const usernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
log(validRoles.includes(session?.user?.role), `Role: "${session?.user?.role}"`);
log(usernameRegex.test(session?.user?.githubUsername || ""), `Username: "${session?.user?.githubUsername}"`);
console.groupEnd();

// --- Summary ---
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed out of ${results.length} checks ===");
if (failed > 0) {
  console.warn("Failed checks:", results.filter(r => !r.pass).map(r => r.label));
}
```

Also run in the project terminal:

```bash
npm audit                                                  # no critical/high vulnerabilities
stat data/cache.json                                       # permissions 600
grep "cache.json" .gitignore                               # present
grep -i "coolify\|orderstack" sample.env                   # no matches
grep -rn "detail.*message\|GITHUB_TOKEN.*\.env" src/app/api/ # no matches in response bodies
```

Finally: full end-to-end browser test — login, view repos, manage secrets/variables/environments, add/remove team members.
