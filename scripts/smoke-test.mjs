#!/usr/bin/env node
/**
 * Smoke tests against a production build (`npm run build` first).
 *
 * Starts `next start` with dummy credentials and a fixture cache, signs in with
 * locally minted session cookies (admin / member / member without a GitHub
 * username), and checks that pages render, auth redirects work, admin-only
 * routes refuse members, and input validation runs. Nothing talks to GitHub:
 * the token is a dummy and every checked route is served from the cache or
 * rejected before any GitHub call.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { encode } from "next-auth/jwt";

const PORT = Number(process.env.SMOKE_PORT || 3100);
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = "smoke-test-secret-smoke-test-secret-0123456789";
const COOKIE = "authjs.session-token";

// ── Fixture cache ───────────────────────────────────────────────────

const cacheDir = mkdtempSync(path.join(tmpdir(), "gh-manager-smoke-"));
const repo = (name, extra = {}) => ({
  name,
  fullName: `altersquare/${name}`,
  private: true,
  url: `https://github.com/altersquare/${name}`,
  description: `${name} description`,
  archived: false,
  ...extra,
});
writeFileSync(
  path.join(cacheDir, "cache.json"),
  JSON.stringify({
    team: [
      { username: "alice", avatarUrl: "", profileUrl: "", repos: ["repo-a", "repo-b"] },
      { username: "bob", avatarUrl: "", profileUrl: "", repos: ["repo-b"] },
    ],
    repos: [repo("repo-a"), repo("repo-b", { private: false }), repo("repo-old", { archived: true })],
    cachedAt: new Date().toISOString(),
  })
);

// ── Sessions ────────────────────────────────────────────────────────

const mint = (token) => encode({ secret: SECRET, salt: COOKIE, token: { sub: "1", ...token }, maxAge: 3600 });
const sessions = {
  none: null,
  admin: await mint({ name: "Admin", role: "admin", githubUsername: "octo-admin" }),
  member: await mint({ name: "Alice", role: "member", githubUsername: "alice" }),
  noUsername: await mint({ name: "Nobody", role: "member", githubUsername: null }),
};

// ── Server ──────────────────────────────────────────────────────────

const server = spawn(
  process.execPath,
  [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT), "-H", "127.0.0.1"],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      CACHE_DIR: cacheDir,
      AUTH_SECRET: SECRET,
      AUTH_TRUST_HOST: "true",
      AUTH_URL: BASE,
      NEXTAUTH_URL: BASE,
      AUTH_AUTHENTIK_ID: "smoke",
      AUTH_AUTHENTIK_SECRET: "smoke",
      AUTH_AUTHENTIK_ISSUER: "http://127.0.0.1:9/",
      GITHUB_TOKEN: "smoke-test-dummy-token",
      GITHUB_USERNAME: "altersquare",
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
);
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

function cleanup() {
  server.kill();
  rmSync(cacheDir, { recursive: true, force: true });
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(BASE, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Server did not start on ${BASE}\n${serverLog}`);
}

// ── Test helpers ────────────────────────────────────────────────────

async function request(as, method, url, body) {
  const headers = {};
  if (sessions[as]) headers.cookie = `${COOKIE}=${sessions[as]}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return fetch(BASE + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

function expectStatus(res, expected) {
  const list = Array.isArray(expected) ? expected : [expected];
  if (!list.includes(res.status)) throw new Error(`expected status ${list.join("/")}, got ${res.status}`);
}

function expectRedirect(res, pathPrefix) {
  expectStatus(res, [302, 303, 307, 308]);
  const loc = new URL(res.headers.get("location"), BASE);
  if (!loc.pathname.startsWith(pathPrefix)) throw new Error(`expected redirect to ${pathPrefix}, got ${loc.pathname}${loc.search}`);
  return loc;
}

async function expectPage(as, url, text) {
  const res = await request(as, "GET", url);
  expectStatus(res, 200);
  const html = await res.text();
  if (!html.includes(text)) throw new Error(`page ${url} does not contain "${text}"`);
}

// ── Tests ───────────────────────────────────────────────────────────

try {
  await waitForServer();
  console.log(`Smoke testing ${BASE}\n`);

  console.log("Auth & routing");
  await check("signed-out visitors are sent to sign-in", async () => {
    expectRedirect(await request("none", "GET", "/"), "/api/auth/signin");
  });
  await check("members without a GitHub username are sent to /no-access", async () => {
    expectRedirect(await request("noUsername", "GET", "/repos"), "/no-access");
  });
  await check("legacy /secrets page redirects to the manage page", async () => {
    const loc = expectRedirect(await request("admin", "GET", "/repos/repo-a/secrets"), "/repos/repo-a/manage");
    if (loc.searchParams.get("tab") !== "secrets") throw new Error(`expected ?tab=secrets, got ${loc.search}`);
  });

  console.log("\nPages render");
  await check("team page", () => expectPage("admin", "/", "Team · GitHub Manager"));
  await check("repos page", () => expectPage("admin", "/repos", "Repositories · GitHub Manager"));
  await check("repo manage page", () => expectPage("admin", "/repos/repo-a/manage", "repo-a · GitHub Manager"));
  await check("access review page", () => expectPage("admin", "/access", "Access review · GitHub Manager"));
  await check("no-access page", () => expectPage("noUsername", "/no-access", "GitHub Username Not Configured"));

  console.log("\nCached data APIs");
  await check("admin sees the whole team", async () => {
    const res = await request("admin", "GET", "/api/team");
    expectStatus(res, 200);
    const data = await res.json();
    if (data.totalMembers !== 2 || data.totalRepos !== 3) {
      throw new Error(`expected 2 members / 3 repos, got ${data.totalMembers} / ${data.totalRepos}`);
    }
  });
  await check("member only sees repos they collaborate on", async () => {
    const res = await request("member", "GET", "/api/repos/details");
    expectStatus(res, 200);
    const names = (await res.json()).repos.map((r) => r.name).sort().join(",");
    if (names !== "repo-a,repo-b") throw new Error(`expected repo-a,repo-b, got ${names}`);
  });
  await check("repo details include archived flag", async () => {
    const res = await request("admin", "GET", "/api/repos/details");
    const old = (await res.json()).repos.find((r) => r.name === "repo-old");
    if (old?.archived !== true) throw new Error("repo-old should be archived");
  });
  await check("sync status endpoint returns cachedAt", async () => {
    const res = await request("admin", "GET", "/api/team/status");
    expectStatus(res, 200);
    if (!(await res.json()).cachedAt) throw new Error("missing cachedAt");
  });

  console.log("\nAdmin-only routes refuse members");
  const adminOnly = [
    ["GET", "/api/access/invitations"],
    ["POST", "/api/access/resend", { repo: "repo-a", invitationId: 1, username: "x" }],
    ["POST", "/api/team/add", { repo: "repo-a", username: "x" }],
    ["POST", "/api/team/remove-one", { repo: "repo-a", username: "bob" }],
    ["POST", "/api/repos/invitations/revoke", { repo: "repo-a", invitationId: 1 }],
    ["POST", "/api/deploy-keys/create", { repo: "repo-a", title: "k", key: "ssh-ed25519 AAAA", readOnly: true }],
    ["POST", "/api/deploy-keys/delete", { repo: "repo-a", keyId: 1 }],
    ["GET", "/api/repos/settings?repo=repo-a"],
    ["POST", "/api/repos/settings/update", { repo: "repo-a", private: false }],
    ["POST", "/api/secrets/delete", { repo: "repo-a", name: "X" }],
    ["POST", "/api/environments/delete", { repo: "repo-a", name: "prod" }],
  ];
  for (const [method, url, body] of adminOnly) {
    await check(`${method} ${url.split("?")[0]} → 403 for members`, async () => {
      expectStatus(await request("member", method, url, body), 403);
    });
  }
  await check("member can't read a repo they don't collaborate on", async () => {
    expectStatus(await request("member", "GET", "/api/deploy-keys?repo=repo-old"), 403);
  });

  console.log("\nInput validation (rejected before calling GitHub)");
  await check("deploy key: rejects a non-SSH key", async () => {
    expectStatus(
      await request("admin", "POST", "/api/deploy-keys/create", { repo: "repo-a", title: "k", key: "-----BEGIN PRIVATE KEY-----", readOnly: true }),
      400
    );
  });
  await check("repo settings: rejects invalid topics", async () => {
    expectStatus(await request("admin", "POST", "/api/repos/settings/update", { repo: "repo-a", topics: ["Not Valid!"] }), 400);
  });
  await check("repo settings: rejects non-boolean visibility", async () => {
    expectStatus(await request("admin", "POST", "/api/repos/settings/update", { repo: "repo-a", private: "yes" }), 400);
  });
  await check("re-send: requires a numeric invitationId", async () => {
    expectStatus(await request("admin", "POST", "/api/access/resend", { repo: "repo-a", invitationId: "1", username: "x" }), 400);
  });
} catch (err) {
  console.error(err.message);
  results.push({ name: "setup", ok: false });
} finally {
  cleanup();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) {
  console.log("\n--- server log ---\n" + serverLog.slice(-4000));
  process.exit(1);
}
