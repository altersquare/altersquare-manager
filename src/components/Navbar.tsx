"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useSync } from "@/components/SyncContext";
import { LogoutIcon, RefreshIcon } from "@/components/icons";
import { formatDate, timeAgo } from "@/lib/format";

const navLinks = [
  { label: "Team", href: "/", adminOnly: false },
  { label: "Repos", href: "/repos", adminOnly: false },
  { label: "Access", href: "/access", adminOnly: true },
];

interface RateLimit {
  limit: number;
  remaining: number;
  resetAt: string;
}

/** Minutes until reset, rounded up. */
const minutesUntil = (iso: string, now: number) => Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 60000));

const ROLE_HELP = {
  admin: "Admin — full access: manage collaborators, invitations, and delete secrets, variables and environments.",
  member:
    "Member — you can view and add/edit secrets, variables and environments on repos you collaborate on. Removing people or deleting anything needs an admin.",
};

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { cachedAt, refreshing, handleRefresh } = useSync();
  const isAdmin = session?.user?.role === "admin";

  // Re-render periodically so "5 min ago" stays accurate
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // GitHub API quota for the shared token: refreshed every minute and after each sync
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const loggedIn = Boolean(session?.user);
  useEffect(() => {
    if (!loggedIn) return;
    const load = async () => {
      try {
        const res = await fetch("/api/rate-limit");
        if (res.ok) setRateLimit((await res.json()).rateLimit);
      } catch {
        // Indicator is best-effort
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [loggedIn, cachedAt]);

  const quotaRatio = rateLimit && rateLimit.limit > 0 ? rateLimit.remaining / rateLimit.limit : 1;
  const quotaLevel = quotaRatio < 0.05 ? "critical" : quotaRatio < 0.2 ? "low" : "ok";

  return (
    <nav className="bg-gray-900/95 backdrop-blur border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-14 gap-1 sm:gap-2">
        <Link
          href="/"
          className="text-base sm:text-lg font-bold text-gray-100 hover:text-white transition-colors mr-2 sm:mr-6 whitespace-nowrap"
        >
          <span className="sm:hidden">GH Manager</span>
          <span className="hidden sm:inline">GitHub Manager</span>
          <span className="text-[10px] font-normal text-gray-500 ml-1.5 align-super hidden sm:inline">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.filter((link) => isAdmin || !link.adminOnly).map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "text-blue-400" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {link.label}
                {isActive && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-400 rounded-full" />}
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        {session?.user && (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Rate limit: only takes space when the quota is running low */}
            {rateLimit && quotaLevel !== "ok" && (
              <span
                title={`GitHub API: ${rateLimit.remaining.toLocaleString()} of ${rateLimit.limit.toLocaleString()} requests left, resets in ${minutesUntil(rateLimit.resetAt, now)} min. Syncing and loading repo pages use this shared quota.`}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg border cursor-help whitespace-nowrap ${
                  quotaLevel === "critical"
                    ? "bg-red-500/15 text-red-300 border-red-500/40"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                }`}
              >
                API {rateLimit.remaining.toLocaleString()} left
                <span className="hidden sm:inline font-normal opacity-80"> · resets {minutesUntil(rateLimit.resetAt, now)}m</span>
              </span>
            )}

            {/* Sync: one control that shows freshness and refreshes on click */}
            <div className="relative group">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-wait"
                aria-label="Sync data from GitHub"
              >
                <RefreshIcon className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">
                  {refreshing ? "Syncing…" : cachedAt ? `Synced ${timeAgo(cachedAt, now)}` : "Sync"}
                </span>
              </button>
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-full mt-2 w-72 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                <p className="text-xs font-medium text-gray-200 mb-1">
                  {cachedAt ? `Last synced ${formatDate(cachedAt)}` : "Not synced yet"}
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Team members, collaborator access and the repo list are cached. Click to re-fetch them from GitHub.
                  Secrets, variables, environments and invitations are always live.
                </p>
                {rateLimit && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                      <span>GitHub API quota</span>
                      <span>
                        {rateLimit.remaining.toLocaleString()} / {rateLimit.limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          quotaLevel === "critical" ? "bg-red-500" : quotaLevel === "low" ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.round(quotaRatio * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Resets in {minutesUntil(rateLimit.resetAt, now)} min</p>
                  </div>
                )}
              </div>
            </div>

            <div className="w-px h-5 bg-gray-700 hidden sm:block" />

            <div className="flex items-center gap-2 min-w-0">
              {session.user.githubUsername && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://github.com/${session.user.githubUsername}.png?size=56`}
                  alt=""
                  className="w-7 h-7 rounded-full ring-1 ring-gray-700 hidden sm:block"
                />
              )}
              <div className="hidden md:flex flex-col leading-tight min-w-0">
                <span className="text-sm text-gray-200 truncate max-w-40">
                  {session.user.name || session.user.githubUsername || session.user.email}
                </span>
                {session.user.githubUsername && (
                  <span className="text-[11px] text-gray-500">@{session.user.githubUsername}</span>
                )}
              </div>
              <span
                title={isAdmin ? ROLE_HELP.admin : ROLE_HELP.member}
                className={`hidden sm:inline px-2 py-0.5 text-[11px] font-semibold rounded-full border cursor-help ${
                  isAdmin
                    ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                    : "bg-gray-700/50 text-gray-300 border-gray-600"
                }`}
              >
                {isAdmin ? "Admin" : "Member"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => signOut()}
              title="Log out"
              aria-label="Log out"
              className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
