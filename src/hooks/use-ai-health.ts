/**
 * Nova AI OS — AI Health Hook
 * Monitors the health of AI services (Gemini, Local AI).
 * Pings services periodically and reports status.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { isGeminiConfigured } from "@/lib/env-validator";
import { localAIService } from "@/ai/local/LocalAIService";

export type AIHealthStatus = "ready" | "degraded" | "offline";

export interface AIHealthInfo {
  status: AIHealthStatus;
  gemini: "ready" | "unconfigured" | "error";
  localAI: "ready" | "downloading" | "loading" | "unavailable" | "error";
  lastChecked: number;
  error?: string;
}

const PING_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Check Gemini health by verifying API key is configured.
 */
async function checkGeminiHealth(): Promise<"ready" | "unconfigured" | "error"> {
  if (!isGeminiConfigured()) return "unconfigured";

  try {
    // Just check if the key is configured; actual generation is tested on first use
    const key = import.meta.env.VITE_GEMINI_API_KEY as string;
    if (!key || key.length < 10) return "unconfigured";
    return "ready";
  } catch {
    return "error";
  }
}

/**
 * Check Local AI health.
 */
async function checkLocalAIHealth(): Promise<"ready" | "downloading" | "loading" | "unavailable" | "error"> {
  try {
    const status = localAIService.getStatus();
    if (status === "Ready") return "ready";
    if (status === "Downloading") return "downloading";
    if (status === "Loading") return "loading";

    // Check if device supports local AI
    const availability = await localAIService.detect();
    if (!availability.supported) return "unavailable";

    return "unavailable"; // Not downloaded yet
  } catch {
    return "error";
  }
}

/**
 * Hook that monitors AI service health.
 * Pings every 30 seconds and updates status.
 */
export function useAIHealth() {
  const [health, setHealth] = useState<AIHealthInfo>({
    status: "offline",
    gemini: "unconfigured",
    localAI: "unavailable",
    lastChecked: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const [gemini, localAI] = await Promise.all([
        checkGeminiHealth(),
        checkLocalAIHealth(),
      ]);

      let status: AIHealthStatus = "offline";
      if (gemini === "ready" || localAI === "ready") {
        status = "ready";
      } else if (gemini === "unconfigured" && localAI === "unavailable") {
        status = "degraded";
      }

      setHealth({
        status,
        gemini,
        localAI,
        lastChecked: Date.now(),
      });
    } catch (err) {
      setHealth((prev) => ({
        ...prev,
        status: "offline",
        lastChecked: Date.now(),
        error: err instanceof Error ? err.message : "Health check failed",
      }));
    }
  }, []);

  // Initial check + periodic pings
  useEffect(() => {
    checkHealth();
    intervalRef.current = setInterval(checkHealth, PING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkHealth]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => checkHealth();
    const handleOffline = () => {
      setHealth((prev) => ({
        ...prev,
        status: "offline",
        error: "Device is offline",
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkHealth]);

  return {
    ...health,
    refresh: checkHealth,
  };
}
