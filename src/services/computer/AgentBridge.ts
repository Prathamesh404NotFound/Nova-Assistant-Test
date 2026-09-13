/**
 * Nova Desktop Bridge — agent-side command executor for the web layer.
 *
 * The web app NEVER gets arbitrary shell privileges. Instead, desktop.*
 * tool calls are translated into named, allowlisted commands that are
 * issued to an authorized Nova Windows Agent through the Device Registry's
 * authenticated Firebase channel. The agent executes only commands matching
 * its own allowlist and returns verified results.
 *
 * When no authorized agent is online, every method fails honestly with
 * "This capability requires the Nova desktop agent." — the web layer never
 * fakes Windows control.
 */

import {
  listDevices,
  executeDeviceCommand,
  type AgentCommandResult,
} from "@/services/devices/DeviceRegistry";
import { getCurrentUserId } from "@/services/nova-core/NovaUserContext";
import { killSwitch } from "@/services/safety/KillSwitch";

// Tools the Windows agent is allowed to expose — this is the entire surface.
// Anything outside this set is rejected before it ever reaches the agent.
export const AGENT_ALLOWED_TOOLS = new Set([
  "app.launch",
  "app.close",
  "app.focus",
  "app.listWindows",
  "app.activeWindow",
  "window.minimize",
  "window.maximize",
  "screen.capture",
  "screen.read",
  "mouse.click",
  "mouse.move",
  "mouse.scroll",
  "keyboard.type",
  "keyboard.press",
  "keyboard.hotkey",
  "clipboard.read",
  "clipboard.write",
  "clipboard.clear",
  "system.info",
  "notification.show",
]);

/** Risk classification per tool, mirroring the agent's own gate. */
export const AGENT_TOOL_RISK: Record<string, "SAFE" | "LOW" | "MEDIUM" | "HIGH"> = {
  "app.launch": "LOW",
  "app.close": "MEDIUM",
  "app.focus": "SAFE",
  "app.listWindows": "SAFE",
  "app.activeWindow": "SAFE",
  "window.minimize": "SAFE",
  "window.maximize": "SAFE",
  "screen.capture": "SAFE",
  "screen.read": "SAFE",
  "mouse.click": "LOW",
  "mouse.move": "SAFE",
  "mouse.scroll": "SAFE",
  "keyboard.type": "LOW",
  "keyboard.press": "SAFE",
  "keyboard.hotkey": "LOW",
  "clipboard.read": "MEDIUM",
  "clipboard.write": "LOW",
  "clipboard.clear": "MEDIUM",
  "system.info": "SAFE",
  "notification.show": "LOW",
};

const AGENT_CAPABILITY_NAMES = new Set([
  "app_control", "screen_capture", "input_control", "clipboard_access",
  "system_info", "notifications", "file_system", "window_management",
]);

class AgentBridge {
  private cachedDeviceId: string | null = null;
  private lastCheck = 0;
  private availabilityCache: boolean = false;
  private lastError: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  getLastAvailabilityError(): string | null {
    return this.lastError;
  }

  /** Find an authorized, recently-seen agent device (cached 15s). */
  async findAuthorizedAgent(): Promise<string | null> {
    const now = Date.now();
    if (this.cachedDeviceId && now - this.lastCheck < 15_000) return this.cachedDeviceId;
    if (this.refreshPromise) return (await this.refreshPromise) ? this.cachedDeviceId : null;

    this.refreshPromise = (async () => {
      const checkedAt = Date.now();
      try {
        const devices = await listDevices();
        const agent = devices.find(
          (d) =>
            d.authorized &&
            !d.revoked &&
            checkedAt - d.lastSeen < 60_000
        );
        this.cachedDeviceId = agent?.deviceId ?? null;
        this.lastCheck = checkedAt;
        this.availabilityCache = !!this.cachedDeviceId;
        this.lastError = this.cachedDeviceId
          ? null
          : devices.length > 0
            ? "Agent found but is offline or unauthorized"
            : "No authorized desktop agent paired";
        return this.availabilityCache;
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : "Device lookup failed";
        this.cachedDeviceId = null;
        this.lastCheck = checkedAt;
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return (await this.refreshPromise) ? this.cachedDeviceId : null;
  }

  /** Check if an authorized agent is reachable. */
  async isAgentAvailable(): Promise<boolean> {
    return (await this.findAuthorizedAgent()) !== null;
  }

  /**
   * Execute an allowlisted tool on the agent. Returns null when no agent is
   * available — callers translate this into the honest web-only message.
   */
  async execute(
    tool: string,
    args: Record<string, unknown>
  ): Promise<AgentCommandResult | null> {
    // Kill switch: hard refuse before any channel activity.
    if (!killSwitch.isEnabled("computerControl") || !killSwitch.isEnabled("desktopConnection")) {
      this.lastError = "Blocked by kill switch — computer control or desktop connection is disabled.";
      return null;
    }
    if (!AGENT_ALLOWED_TOOLS.has(tool)) {
      this.lastError = `Tool "${tool}" is not in the agent allowlist`;
      return null;
    }
    const deviceId = await this.findAuthorizedAgent();
    if (!deviceId) return null;

    const uid = getCurrentUserId() ?? "web-session";
    return executeDeviceCommand(deviceId, tool, args, uid);
  }

  /** Clear cached availability (e.g., after revocation). */
  invalidate(): void {
    this.cachedDeviceId = null;
    this.lastCheck = 0;
    this.availabilityCache = false;
  }
}

export const agentBridge = new AgentBridge();

/** Human-facing message when the agent isn't reachable. */
export function agentRequiredMessage(tool: string): string {
  return `This capability requires the Nova desktop agent. "${tool}" cannot run in the browser — install and pair the Nova Windows Agent from the Devices page.`;
}

// Re-export for typing convenience
export type { AgentCommandResult };
export { AGENT_CAPABILITY_NAMES };
