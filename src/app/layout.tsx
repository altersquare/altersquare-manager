import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { SyncProvider } from "@/components/SyncContext";
import { Navbar } from "@/components/Navbar";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: { default: "Team · GitHub Manager", template: "%s · GitHub Manager" },
  description: "Manage collaborators across altersquare repos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <SessionProvider>
          <ToastProvider>
            <SyncProvider>
              <Navbar />
              {children}
            </SyncProvider>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
