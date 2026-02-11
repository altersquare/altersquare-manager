"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useSync } from "@/components/SyncContext";

const navLinks = [
  { label: "Team", href: "/" },
  { label: "Repos", href: "/repos" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { cachedAt, refreshing, handleRefresh } = useSync();

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-14">
        {/* App title */}
        <Link
          href="/"
          className="text-lg font-bold text-gray-100 hover:text-white transition-colors mr-8"
        >
          GitHub Manager
          <span className="text-[10px] font-normal text-gray-500 ml-1.5 align-super">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-blue-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-400 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sync button + timestamp + User info */}
        {session?.user && (
          <div className="flex items-center gap-3">
            {/* Last synced timestamp */}
            {cachedAt && (
              <span className="text-xs text-gray-500 hidden sm:inline">
                Synced: {new Date(cachedAt).toLocaleString()}
              </span>
            )}

            {/* Sync button with tooltip */}
            <div className="relative group">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {refreshing ? "Syncing..." : "Sync"}
              </button>

              {/* Tooltip */}
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-full mt-2 w-64 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                <p className="text-xs font-medium text-gray-200 mb-1">Refresh from GitHub</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Re-syncs team members, collaborator access, and repository data from GitHub.
                  The app caches this data locally to avoid repeated API calls.
                </p>
              </div>
            </div>

            {/* Separator */}
            <div className="w-px h-4 bg-gray-700 hidden sm:block" />

            {session.user.githubUsername && (
              <span className="text-xs text-gray-500 hidden sm:inline">
                @{session.user.githubUsername}
              </span>
            )}
            <span className="text-sm text-gray-400 hidden sm:inline">
              {session.user.name || session.user.email}
            </span>
            <button
              onClick={() => signOut()}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
