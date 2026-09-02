/**
 * Nova Computer Control — ComputerService
 * Unified interface for all desktop actions.
 * Validates safety, checks permissions, verifies results.
 */

import { desktopAdapter, checkDesktopBridge } from "./DesktopAdapter";
import type {
  DesktopAdapter as IDesktopAdapter,
  WindowInfo,
  ActionVerification,
  ClipboardContent,
  ComputerState,
  MouseClickAction,
  TypeTextAction,
  HotkeyAction,
  KeyPressAction,
  FocusWindowAction,
  LaunchAppAction,
} from "./ComputerTypes";
import { ACTION_SAFETY, CONFIRMATION_REQUIRED } from "./ComputerTypes";

// ─── State ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "nova_computer_permissions";

interface StoredPermissions {
  mouse: boolean;
  keyboard: boolean;
  screen: boolean;
  clipboard: boolean;
  window: boolean;
  application: boolean;
}

function loadPermissions(): StoredPermissions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    mouse: true,
    keyboard: true,
    screen: false,
    clipboard: true,
    window: true,
    application: true,
  };
}

function savePermissions(perms: StoredPermissions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
  } catch { /* ignore */ }
}

// ─── Computer Service ───────────────────────────────────────────────────────

class ComputerServiceImpl {
  private adapter: IDesktopAdapter = desktopAdapter;
  private bridgeOnline = false;
  private permissions: StoredPermissions = loadPermissions();
  private lastAction = "";
  private lastVerification: ActionVerification | null = null;

  /** Check if the desktop bridge is connected. */
  async checkBridge(): Promise<boolean> {
    this.bridgeOnline = await checkDesktopBridge();
    return this.bridgeOnline;
  }

  /** Get current state for diagnostics. */
  getState(): ComputerState {
    return {
      adapter: this.adapter,
      bridgeConnected: this.bridgeOnline,
      activeWindow: null,
      lastAction: this.lastAction,
      lastVerification: this.lastVerification,
      permissions: { ...this.permissions },
    };
  }

  /** Get permission status. */
  getPermissions(): StoredPermissions {
    return { ...this.permissions };
  }

  /** Update a permission. */
  setPermission(key: keyof StoredPermissions, value: boolean): void {
    this.permissions[key] = value;
    savePermissions(this.permissions);
  }

  /** Check if a specific tool requires confirmation. */
  needsConfirmation(toolName: string, args: Record<string, unknown>): boolean {
    if (CONFIRMATION_REQUIRED.has(toolName)) return true;
    const check = CONFIRMATION_REQUIRED.has(toolName);
    return check;
  }

  /** Get safety level for a tool. */
  getSafetyLevel(toolName: string): string {
    return ACTION_SAFETY[toolName] || "LOW_RISK_WRITE";
  }

  // ─── Mouse ─────────────────────────────────────────────────────────────

  async click(x: number, y: number, button: "left" | "right" | "middle" = "left", doubleClick = false): Promise<ActionVerification> {
    if (!this.permissions.mouse) {
      return { verified: false, method: "click", error: "Mouse permission not granted" };
    }
    this.lastAction = "desktop.click";
    const result = await this.adapter.click({ x, y, button, doubleClick });
    this.lastVerification = result;
    return result;
  }

  async doubleClick(x: number, y: number): Promise<ActionVerification> {
    return this.click(x, y, "left", true);
  }

  async rightClick(x: number, y: number): Promise<ActionVerification> {
    return this.click(x, y, "right");
  }

  async moveMouse(x: number, y: number): Promise<ActionVerification> {
    if (!this.permissions.mouse) {
      return { verified: false, method: "move", error: "Mouse permission not granted" };
    }
    this.lastAction = "desktop.move";
    const result = await this.adapter.move({ x, y });
    this.lastVerification = result;
    return result;
  }

  async scroll(x: number, y: number, deltaY: number): Promise<ActionVerification> {
    if (!this.permissions.mouse) {
      return { verified: false, method: "scroll", error: "Mouse permission not granted" };
    }
    this.lastAction = "desktop.scroll";
    const result = await this.adapter.scroll({ x, y, deltaY });
    this.lastVerification = result;
    return result;
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────

  async typeText(text: string, delayMs = 20): Promise<ActionVerification> {
    if (!this.permissions.keyboard) {
      return { verified: false, method: "typeText", error: "Keyboard permission not granted" };
    }
    this.lastAction = "desktop.type";
    const result = await this.adapter.typeText({ text, delayMs });
    this.lastVerification = result;
    return result;
  }

  async keyPress(key: string, modifiers?: string[]): Promise<ActionVerification> {
    if (!this.permissions.keyboard) {
      return { verified: false, method: "keyPress", error: "Keyboard permission not granted" };
    }
    this.lastAction = "desktop.press";
    const result = await this.adapter.keyPress({ key, modifiers });
    this.lastVerification = result;
    return result;
  }

  async hotkey(keys: string[]): Promise<ActionVerification> {
    if (!this.permissions.keyboard) {
      return { verified: false, method: "hotkey", error: "Keyboard permission not granted" };
    }
    this.lastAction = "desktop.hotkey";
    const result = await this.adapter.hotkey({ keys });
    this.lastVerification = result;
    return result;
  }

  // ─── Clipboard ─────────────────────────────────────────────────────────

  async clipboardRead(): Promise<ClipboardContent> {
    if (!this.permissions.clipboard) {
      return { type: "text" };
    }
    return this.adapter.clipboardRead();
  }

  async clipboardWrite(text: string): Promise<ActionVerification> {
    if (!this.permissions.clipboard) {
      return { verified: false, method: "clipboard.write", error: "Clipboard permission not granted" };
    }
    this.lastAction = "clipboard.write";
    const result = await this.adapter.clipboardWrite(text);
    this.lastVerification = result;
    return result;
  }

  async clipboardClear(): Promise<ActionVerification> {
    if (!this.permissions.clipboard) {
      return { verified: false, method: "clipboard.clear", error: "Clipboard permission not granted" };
    }
    this.lastAction = "clipboard.clear";
    const result = await this.adapter.clipboardClear();
    this.lastVerification = result;
    return result;
  }

  // ─── Window ────────────────────────────────────────────────────────────

  async listWindows(): Promise<WindowInfo[]> {
    if (!this.permissions.window) return [];
    this.lastAction = "desktop.listWindows";
    return this.adapter.listWindows();
  }

  async focusWindow(windowId?: string, application?: string): Promise<ActionVerification> {
    if (!this.permissions.window) {
      return { verified: false, method: "focusWindow", error: "Window permission not granted" };
    }
    this.lastAction = "desktop.focusWindow";
    const result = await this.adapter.focusWindow({ windowId, application });
    this.lastVerification = result;
    return result;
  }

  async minimizeWindow(windowId: string): Promise<ActionVerification> {
    if (!this.permissions.window) {
      return { verified: false, method: "minimizeWindow", error: "Window permission not granted" };
    }
    this.lastAction = "desktop.minimizeWindow";
    const result = await this.adapter.minimizeWindow(windowId);
    this.lastVerification = result;
    return result;
  }

  async maximizeWindow(windowId: string): Promise<ActionVerification> {
    if (!this.permissions.window) {
      return { verified: false, method: "maximizeWindow", error: "Window permission not granted" };
    }
    this.lastAction = "desktop.maximizeWindow";
    const result = await this.adapter.maximizeWindow(windowId);
    this.lastVerification = result;
    return result;
  }

  async getActiveWindow(): Promise<WindowInfo | null> {
    this.lastAction = "desktop.getActiveWindow";
    return this.adapter.getActiveWindow();
  }

  // ─── Application ───────────────────────────────────────────────────────

  async launchApp(application: string, args?: string[]): Promise<ActionVerification> {
    if (!this.permissions.application) {
      return { verified: false, method: "launchApp", error: "Application permission not granted" };
    }
    this.lastAction = "desktop.launchApp";
    const result = await this.adapter.launchApp({ application, args });
    this.lastVerification = result;
    return result;
  }

  async closeApp(application: string): Promise<ActionVerification> {
    if (!this.permissions.application) {
      return { verified: false, method: "closeApp", error: "Application permission not granted" };
    }
    this.lastAction = "desktop.closeApp";
    const result = await this.adapter.closeApp(application);
    this.lastVerification = result;
    return result;
  }

  // ─── Screen ────────────────────────────────────────────────────────────

  async captureScreen(region?: { x: number; y: number; width: number; height: number }): Promise<string | null> {
    if (!this.permissions.screen) return null;
    this.lastAction = "screen.capture";
    if (region) {
      return this.adapter.captureScreen({ x: region.x, y: region.y, width: region.width, height: region.height });
    }
    return this.adapter.captureScreen();
  }
}

export const computerService = new ComputerServiceImpl();
