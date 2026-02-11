"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

interface SyncContextType {
  cachedAt: string | null;
  refreshing: boolean;
  handleRefresh: () => Promise<void>;
  registerSyncCallback: (cb: () => void) => void;
  unregisterSyncCallback: (cb: () => void) => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const callbacksRef = useRef<Set<() => void>>(new Set());

  // Fetch initial cachedAt from lightweight status endpoint
  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const res = await fetch("/api/team/status");
        if (res.ok) {
          const data = await res.json();
          if (data.cachedAt) setCachedAt(data.cachedAt);
        }
      } catch {
        // Silently ignore — timestamp will populate after first sync
      }
    })();
  }, [session?.user]);

  const registerSyncCallback = useCallback((cb: () => void) => {
    callbacksRef.current.add(cb);
  }, []);

  const unregisterSyncCallback = useCallback((cb: () => void) => {
    callbacksRef.current.delete(cb);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/team/refresh", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        const msg = err.error || "Failed to refresh";
        if (res.status === 401) {
          showToast(
            "Your GitHub token is invalid or expired. Check your .env file and restart the server.",
            "error"
          );
          return;
        }
        if (res.status === 403 || res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          showToast(
            `GitHub API rate limit exceeded.${retryAfter ? ` Try again in ${retryAfter} seconds.` : " Please wait a few minutes and try again."}`,
            "error"
          );
          return;
        }
        throw new Error(msg);
      }
      const json = await res.json();
      setCachedAt(json.cachedAt ?? new Date().toISOString());
      showToast("Data refreshed from GitHub", "success");

      // Notify all registered page callbacks
      callbacksRef.current.forEach((cb) => cb());
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to refresh data",
        "error"
      );
    } finally {
      setRefreshing(false);
    }
  }, [showToast]);

  return (
    <SyncContext.Provider
      value={{
        cachedAt,
        refreshing,
        handleRefresh,
        registerSyncCallback,
        unregisterSyncCallback,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
