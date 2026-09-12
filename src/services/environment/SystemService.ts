/**
 * Nova Environment Layer — SystemService
 * Reads only browser-exposed system telemetry. No native code, no shell.
 * Reports what is genuinely unavailable instead of fabricating values.
 */

import { notificationService } from "@/services/notifications/NotificationService";
import type { SystemStatus } from "./EnvironmentTypes";

const BOOT_TIME = Date.now();

interface NetworkStatusInformation extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener: (type: string, cb: () => void) => void;
}

interface BatteryManagerLike {
  level?: number;
  charging?: boolean;
  addEventListener?: (type: string, cb: () => void) => void;
}

class SystemServiceImpl {
  private batteryManager: BatteryManagerLike | null = null;
  private networkInfo: NetworkStatusInformation | null = null;

  init(): void {
    // Battery telemetry (Chromium). Failure is fine — we report unsupported.
    try {
      const nav = navigator as Navigator & {
        getBattery?: () => Promise<BatteryManagerLike>;
      };
      if (nav.getBattery) {
        nav.getBattery().then((b) => {
          this.batteryManager = b;
          b.addEventListener?.("levelchange", () =>
            this.emitBatteryEvent()
          );
          b.addEventListener?.("chargingchange", () =>
            this.emitBatteryEvent()
          );
        }).catch(() => { /* unsupported */ });
      }
    } catch { /* unsupported */ }

    this.networkInfo =
      (navigator as Navigator & { connection?: NetworkStatusInformation })
        .connection ?? null;
  }

  private emitBatteryEvent(): void {
    // Environment events are surfaced via the in-app notification channel;
    // NovaEventBus import here would create a cycle, so system telemetry
    // consumers poll getStatus() instead.
  }

  /** Full system status snapshot. Every field is real or honestly null. */
  async getStatus(): Promise<SystemStatus> {
    const mem = (performance as Performance & {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    }).memory;

    let battery: SystemStatus["battery"] = {
      supported: false,
      level: null,
      charging: null,
    };
    if (this.batteryManager) {
      battery = {
        supported: true,
        level: typeof this.batteryManager.level === "number" ? this.batteryManager.level : null,
        charging: typeof this.batteryManager.charging === "boolean" ? this.batteryManager.charging : null,
      };
    }

    return {
      os: this.detectOS(),
      browser: this.detectBrowser(),
      platform: navigator.platform || "unknown",
      cpuCores: navigator.hardwareConcurrency || 1,
      memory: {
        deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
        heapUsedMB: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null,
        heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1024 / 1024) : null,
      },
      disk: {
        available: false,
        note: "Disk usage is not exposed to web pages; requires the desktop bridge.",
      },
      battery,
      network: {
        online: navigator.onLine,
        effectiveType: this.networkInfo?.effectiveType ?? null,
        downlinkMbps: this.networkInfo?.downlink ?? null,
        rttMs: this.networkInfo?.rtt ?? null,
      },
      uptimeMs: Date.now() - BOOT_TIME,
    };
  }

  /** Human-readable one-liner for voice/chat responses. */
  async getSummary(): Promise<string> {
    const s = await this.getStatus();
    const parts: string[] = [];
    parts.push(`${s.browser} on ${s.os}`);
    parts.push(`${s.cpuCores} CPU cores`);
    if (s.memory.heapUsedMB !== null) {
      parts.push(`heap ${s.memory.heapUsedMB}MB / ${s.memory.heapLimitMB}MB`);
    } else if (s.memory.deviceMemoryGB !== null) {
      parts.push(`~${s.memory.deviceMemoryGB}GB device memory`);
    }
    if (s.battery.supported && s.battery.level !== null) {
      parts.push(`battery ${Math.round(s.battery.level * 100)}%${s.battery.charging ? " (charging)" : ""}`);
    }
    parts.push(s.network.online
      ? `online${s.network.effectiveType ? ` (${s.network.effectiveType})` : ""}`
      : "offline");
    return parts.join(" · ");
  }

  /** Notify the user via the real notification service. */
  notifyUser(title: string, body: string, priority: "critical" | "high" | "medium" | "low" = "medium"): boolean {
    const n = notificationService.send({
      title,
      body,
      channel: "in_app",
      priority,
      category: "environment",
      silent: false,
    });
    return n !== null;
  }

  private detectOS(): string {
    const ua = navigator.userAgent;
    if (/Windows NT/.test(ua)) return "Windows";
    if (/Mac OS X/.test(ua)) return "macOS";
    if (/CrOS/.test(ua)) return "ChromeOS";
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPad/.test(ua)) return "iOS";
    if (/Linux/.test(ua)) return "Linux";
    return "Unknown";
  }

  private detectBrowser(): string {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return "Edge";
    if (/OPR\//.test(ua)) return "Opera";
    if (/Chrome\//.test(ua)) return "Chrome";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Safari\//.test(ua)) return "Safari";
    return "Unknown";
  }
}

export const systemService = new SystemServiceImpl();
