/**
 * Nova AI OS — Auto-Fix System
 * Automatically attempts to resolve common issues.
 */

import { responseCache } from "@/services/ai/response-cache";

export interface FixResult {
  name: string;
  success: boolean;
  message: string;
}

/**
 * Attempt to fix common issues.
 */
export async function attemptFixes(): Promise<FixResult[]> {
  const results: FixResult[] = [];

  // Fix 1: Clear corrupted caches
  results.push(fixCorruptedCache());

  // Fix 2: Reset response cache if too large
  results.push(fixOversizedCache());

  // Fix 3: Clean localStorage if corrupted
  results.push(fixCorruptedLocalStorage());

  // Fix 4: Re-register service worker if needed
  results.push(await fixServiceWorker());

  // Fix 5: Force React re-render if DOM is empty
  results.push(fixEmptyDOM());

  return results;
}

function fixCorruptedCache(): FixResult {
  try {
    // Clear any corrupted browser cache entries
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          if (name.includes("nova") && !name.includes("v1")) {
            caches.delete(name);
          }
        });
      });
    }
    return { name: "Corrupted Cache", success: true, message: "Cache cleanup initiated" };
  } catch {
    return { name: "Corrupted Cache", success: false, message: "Could not clean cache" };
  }
}

function fixOversizedCache(): FixResult {
  try {
    const stats = responseCache.getStats();
    if (stats.size > 90) {
      responseCache.clear();
      return { name: "Oversized Cache", success: true, message: "Cache cleared (was " + stats.size + " entries)" };
    }
    return { name: "Oversized Cache", success: true, message: "Cache size normal (" + stats.size + " entries)" };
  } catch {
    return { name: "Oversized Cache", success: false, message: "Could not check cache size" };
  }
}

function fixCorruptedLocalStorage(): FixResult {
  try {
    // Check for corrupted localStorage entries
    const keysToCheck = ["nova_conversations", "nova_local_user", "nova_gemini_key"];
    for (const key of keysToCheck) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          JSON.parse(value);
        } catch {
          // Corrupted entry, remove it
          localStorage.removeItem(key);
          return { name: "Corrupted Storage", success: true, message: `Removed corrupted ${key}` };
        }
      }
    }
    return { name: "Corrupted Storage", success: true, message: "LocalStorage clean" };
  } catch {
    return { name: "Corrupted Storage", success: false, message: "Could not check localStorage" };
  }
}

async function fixServiceWorker(): Promise<FixResult> {
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        // Re-register service worker
        await navigator.serviceWorker.register("/sw.js");
        return { name: "Service Worker", success: true, message: "Service Worker re-registered" };
      }
    }
    return { name: "Service Worker", success: true, message: "Service Worker active" };
  } catch {
    return { name: "Service Worker", success: false, message: "Could not register Service Worker" };
  }
}

function fixEmptyDOM(): FixResult {
  const root = document.getElementById("root");
  if (root && root.children.length === 0) {
    // Force a re-render by dispatching a storage event
    window.dispatchEvent(new StorageEvent("storage"));
    return { name: "Empty DOM", success: true, message: "Triggered re-render" };
  }
  return { name: "Empty DOM", success: true, message: "DOM rendered" };
}

/**
 * Get summary of fix results.
 */
export function getFixSummary(results: FixResult[]): {
  total: number;
  successful: number;
  failed: number;
} {
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: results.length,
    successful,
    failed,
  };
}
