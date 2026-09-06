/**
 * Nova Perception Layer — Desktop Adapter
 * Platform-agnostic abstraction for computer control.
 * Falls back gracefully when desktop bridge is unavailable.
 */

import type {
  DesktopAdapter,
  MouseClickAction,
  MouseMoveAction,
  ScrollAction,
  TypeTextAction,
  KeyPressAction,
  HotkeyAction,
  WindowInfo,
  FocusWindowAction,
  LaunchAppAction,
  ClipboardContent,
  ActionVerification,
} from "./ComputerTypes";

// ─── Bridge Communication ───────────────────────────────────────────────────

const BRIDGE_URL = "http://127.0.0.1:5190";
const BRIDGE_TIMEOUT = 3000;

async function bridgeRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT);

    const response = await fetch(`${BRIDGE_URL}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function ok(verified: boolean, method: string, evidence?: string): ActionVerification {
  return { verified, method, evidence };
}

function fail(method: string, error: string): ActionVerification {
  return { verified: false, method, error };
}

// ─── Web/Desktop Adapter ────────────────────────────────────────────────────

class WebDesktopAdapter implements DesktopAdapter {
  readonly platform = "web" as const;
  private bridgeOnline = false;

  setBridgeOnline(online: boolean): void {
    this.bridgeOnline = online;
  }

  private async sendAction(action: string, params: Record<string, unknown>): Promise<ActionVerification> {
    const result = await bridgeRequest<{ success: boolean; error?: string; evidence?: string }>(
      "/action",
      "POST",
      { action, ...params } as Record<string, unknown>
    );

    if (!result) {
      return fail(action, "Desktop bridge is not running. Install Nova Desktop Bridge for computer control.");
    }

    return result.success
      ? ok(true, action, result.evidence)
      : fail(action, result.error || "Action failed");
  }

  async click(action: MouseClickAction): Promise<ActionVerification> {
    return this.sendAction("mouse.click", action as unknown as Record<string, unknown>);
  }

  async move(action: MouseMoveAction): Promise<ActionVerification> {
    return this.sendAction("mouse.move", action as unknown as Record<string, unknown>);
  }

  async scroll(action: ScrollAction): Promise<ActionVerification> {
    return this.sendAction("mouse.scroll", action as unknown as Record<string, unknown>);
  }

  async typeText(action: TypeTextAction): Promise<ActionVerification> {
    return this.sendAction("keyboard.type", action as unknown as Record<string, unknown>);
  }

  async keyPress(action: KeyPressAction): Promise<ActionVerification> {
    return this.sendAction("keyboard.press", action as unknown as Record<string, unknown>);
  }

  async hotkey(action: HotkeyAction): Promise<ActionVerification> {
    return this.sendAction("keyboard.hotkey", action as unknown as Record<string, unknown>);
  }

  async clipboardRead(): Promise<ClipboardContent> {
    // Try browser clipboard API first
    try {
      const text = await navigator.clipboard.readText();
      return { text, type: "text" };
    } catch {
      // Fall back to bridge
      const result = await bridgeRequest<{ text: string; type: string }>("/clipboard/read");
      return result || { type: "text" };
    }
  }

  async clipboardWrite(text: string): Promise<ActionVerification> {
    try {
      await navigator.clipboard.writeText(text);
      return ok(true, "clipboard.write", `Copied ${text.length} characters`);
    } catch {
      return this.sendAction("clipboard.write", { text });
    }
  }

  async clipboardClear(): Promise<ActionVerification> {
    try {
      await navigator.clipboard.writeText("");
      return ok(true, "clipboard.clear");
    } catch {
      return this.sendAction("clipboard.clear", {});
    }
  }

  async listWindows(): Promise<WindowInfo[]> {
    const result = await bridgeRequest<{ windows: WindowInfo[] }>("/windows/list");
    return result?.windows || [];
  }

  async focusWindow(action: FocusWindowAction): Promise<ActionVerification> {
    return this.sendAction("window.focus", action as unknown as Record<string, unknown>);
  }

  async minimizeWindow(windowId: string): Promise<ActionVerification> {
    return this.sendAction("window.minimize", { windowId });
  }

  async maximizeWindow(windowId: string): Promise<ActionVerification> {
    return this.sendAction("window.maximize", { windowId });
  }

  async launchApp(action: LaunchAppAction): Promise<ActionVerification> {
    return this.sendAction("app.launch", action as unknown as Record<string, unknown>);
  }

  async closeApp(application: string): Promise<ActionVerification> {
    return this.sendAction("app.close", { application });
  }

  async getActiveWindow(): Promise<WindowInfo | null> {
    const result = await bridgeRequest<{ window: WindowInfo }>("/windows/active");
    return result?.window || null;
  }

  async captureScreen(region?: Record<string, number>): Promise<string | null> {
    const result = await bridgeRequest<{ screenshot: string }>(
      "/screen/capture",
      "POST",
      { region }
    );
    return result?.screenshot || null;
  }

  isAvailable(): boolean {
    return this.bridgeOnline || (typeof navigator !== "undefined" && typeof navigator.clipboard !== "undefined");
  }

  getCapabilities(): string[] {
    return [
      "clipboard.read",
      "clipboard.write",
      // Desktop bridge capabilities would be listed here when connected
    ];
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const desktopAdapter = new WebDesktopAdapter();

/** Check if the desktop bridge is reachable. */
export async function checkDesktopBridge(): Promise<boolean> {
  const result = await bridgeRequest<{ status: string }>("/health");
  const online = result?.status === "ok";
  desktopAdapter.setBridgeOnline(online);
  return online;
}
