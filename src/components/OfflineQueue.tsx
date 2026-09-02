/**
 * Nova AI OS — Offline Queue
 * Cache approved actions locally, queue safe actions for later sync,
 * and show connectivity status per request.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  ArrowUpCircle,
  AlertTriangle,
  Zap,
  RefreshCw,
} from "lucide-react";

export interface QueuedAction {
  id: string;
  type: string;
  description: string;
  payload: Record<string, unknown>;
  status: "queued" | "syncing" | "synced" | "failed";
  createdAt: number;
  syncedAt?: number;
  error?: string;
  retries: number;
  maxRetries: number;
}

const STORAGE_KEY = "nova_offline_queue";
const CONNECTIVITY_KEY = "nova_connectivity";

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

interface OfflineQueueProps {
  showInline?: boolean;
}

export function OfflineQueue({ showInline = false }: OfflineQueueProps) {
  const [queue, setQueue] = useState<QueuedAction[]>(loadQueue);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monitor connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      localStorage.setItem(CONNECTIVITY_KEY, JSON.stringify({ online: true, at: Date.now() }));
    };
    const handleOffline = () => {
      setIsOnline(false);
      localStorage.setItem(CONNECTIVITY_KEY, JSON.stringify({ online: false, at: Date.now() }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check connectivity via fetch every 30s
    intervalRef.current = setInterval(async () => {
      try {
        const resp = await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
        setIsOnline(resp.ok);
      } catch {
        setIsOnline(false);
      }
      setLastCheck(Date.now());
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Save queue changes
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  const queueCount = queue.filter((q) => q.status === "queued").length;
  const failedCount = queue.filter((q) => q.status === "failed").length;
  const syncedCount = queue.filter((q) => q.status === "synced").length;

  const addAction = useCallback(
    (type: string, description: string, payload: Record<string, unknown> = {}) => {
      const action: QueuedAction = {
        id: generateId(),
        type,
        description,
        payload,
        status: isOnline ? "syncing" : "queued",
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 3,
      };
      setQueue((prev) => [...prev, action]);

      // If online, simulate immediate sync
      if (isOnline) {
        setTimeout(() => {
          setQueue((prev) =>
            prev.map((a) =>
              a.id === action.id
                ? { ...a, status: "synced" as const, syncedAt: Date.now() }
                : a
            )
          );
        }, 200);
      }

      return action.id;
    },
    [isOnline]
  );

  const syncQueue = useCallback(async () => {
    if (!isOnline) return;

    setQueue((prev) =>
      prev.map((a) =>
        a.status === "queued" ? { ...a, status: "syncing" as const } : a
      )
    );

    // Simulate sync with delays
    const queued = queue.filter((a) => a.status === "queued");
    for (const action of queued) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setQueue((prev) =>
        prev.map((a) =>
          a.id === action.id
            ? { ...a, status: "synced" as const, syncedAt: Date.now() }
            : a
        )
      );
    }
  }, [isOnline, queue]);

  const retryAction = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((a) => {
        if (a.id !== id || a.status !== "failed") return a;
        if (a.retries >= a.maxRetries) return a;
        return {
          ...a,
          status: "syncing" as const,
          retries: a.retries + 1,
          error: undefined,
        };
      })
    );

    // Simulate retry success after delay
    setTimeout(() => {
      setQueue((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: "synced" as const, syncedAt: Date.now() }
            : a
        )
      );
    }, 500);
  }, []);

  const clearSynced = useCallback(() => {
    setQueue((prev) => prev.filter((a) => a.status !== "synced"));
  }, []);

  const removeAction = useCallback((id: string) => {
    setQueue((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Connectivity badge (inline)
  if (showInline) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
          isOnline
            ? "bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/25"
            : "bg-amber-400/15 text-amber-400 hover:bg-amber-400/25"
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {isOnline ? "Online" : "Offline"}
        {queueCount > 0 && (
          <span className="bg-amber-400/20 text-amber-400 px-1 rounded-full text-[9px]">
            {queueCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connectivity header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono ${
              isOnline
                ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
            }`}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? "Connected" : "Offline Mode"}
            <span className="text-[10px] opacity-60">
              · last check {formatTime(lastCheck)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queueCount > 0 && isOnline && (
            <button
              onClick={syncQueue}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-cyan-500/15 text-cyan-400 rounded-md hover:bg-cyan-500/25 transition-colors"
            >
              <ArrowUpCircle className="h-3 w-3" />
              Sync Now ({queueCount})
            </button>
          )}
          {syncedCount > 0 && (
            <button
              onClick={clearSynced}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear Synced
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
        <span>
          <Zap className="h-3 w-3 inline mr-1 text-cyan-400" />
          {queueCount} queued
        </span>
        <span>
          <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-400" />
          {syncedCount} synced
        </span>
        {failedCount > 0 && (
          <span>
            <XCircle className="h-3 w-3 inline mr-1 text-red-400" />
            {failedCount} failed
          </span>
        )}
      </div>

      {/* Queue list */}
      {queue.length === 0 && (
        <div className="text-center py-8">
          <Wifi className="h-6 w-6 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No queued actions</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Actions performed offline will appear here
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {queue.map((action) => (
          <div
            key={action.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
              action.status === "synced"
                ? "bg-emerald-400/5 border-emerald-400/10"
                : action.status === "failed"
                ? "bg-red-400/5 border-red-400/10"
                : action.status === "syncing"
                ? "bg-cyan-400/5 border-cyan-400/10"
                : "bg-[#0a1425] border-[#1a2f4a]"
            }`}
          >
            {/* Status icon */}
            {action.status === "synced" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {action.status === "syncing" && (
              <div className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            )}
            {action.status === "failed" && <XCircle className="h-4 w-4 text-red-400" />}
            {action.status === "queued" && <Clock className="h-4 w-4 text-amber-400" />}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs ${
                  action.status === "synced"
                    ? "text-emerald-300"
                    : action.status === "failed"
                    ? "text-red-300"
                    : "text-slate-200"
                }`}
              >
                {action.description}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-mono text-slate-600">{action.type}</span>
                <span className="text-[9px] font-mono text-slate-600">
                  {formatTime(action.createdAt)}
                </span>
                {action.syncedAt && (
                  <span className="text-[9px] font-mono text-emerald-400/60">
                    synced {formatTime(action.syncedAt)}
                  </span>
                )}
                {action.error && (
                  <span className="text-[9px] font-mono text-red-400/60">{action.error}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {action.status === "failed" && action.retries < action.maxRetries && (
                <button
                  onClick={() => retryAction(action.id)}
                  className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                  aria-label="Retry action"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
              {(action.status === "synced" || action.status === "failed") && (
                <button
                  onClick={() => removeAction(action.id)}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                  aria-label="Remove action"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook to queue actions from other components
export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const queueAction = useCallback(
    (type: string, description: string, payload: Record<string, unknown> = {}) => {
      const queue = loadQueue();
      const action: QueuedAction = {
        id: generateId(),
        type,
        description,
        payload,
        status: isOnline ? "syncing" : "queued",
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 3,
      };
      queue.push(action);
      saveQueue(queue);

      // Auto-sync if online
      if (isOnline) {
        setTimeout(() => {
          const q = loadQueue();
          const updated = q.map((a: QueuedAction) =>
            a.id === action.id
              ? { ...a, status: "synced" as const, syncedAt: Date.now() }
              : a
          );
          saveQueue(updated);
        }, 200);
      }

      return action.id;
    },
    [isOnline]
  );

  return { isOnline, queueAction };
}
