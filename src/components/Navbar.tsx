"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navLinks = [
  { label: "Team", href: "/" },
  { label: "Repos", href: "/repos" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-14">
        {/* App title */}
        <Link
          href="/"
          className="text-lg font-bold text-gray-100 hover:text-white transition-colors mr-8"
        >
          GitHub Manager
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

        {/* User info + Logout */}
        {session?.user && (
          <div className="flex items-center gap-3">
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
