/**
 * Nova Computer Control Layer — Types
 * Defines desktop actions, safety levels, verification results, and platform adapters.
 */

// ─── Action Safety Classification ───────────────────────────────────────────

export type ActionSafetyLevel =
  | "READ"              // No side effects
  | "LOW_RISK_WRITE"    // Minor local changes
  | "EXTERNAL_ACTION"   // Sends data externally
  | "DESTRUCTIVE"       // Deletes or overwrites
  | "CRITICAL";         // System-level changes

// ─── Mouse Actions ──────────────────────────────────────────────────────────

export type MouseButton = "left" | "right" | "middle";

export interface MouseClickAction {
  x: number;
  y: number;
  button?: MouseButton;
  doubleClick?: boolean;
}

export interface MouseMoveAction {
  x: number;
  y: number;
}

export interface ScrollAction {
  x: number;
  y: number;
  deltaX?: number;
  deltaY: number;
}

// ─── Keyboard Actions ───────────────────────────────────────────────────────

export interface TypeTextAction {
  text: string;
  delayMs?: number;
}

export interface KeyPressAction {
  key: string;                   // e.g., "Enter", "Tab", "Escape"
  modifiers?: string[];          // e.g., ["ctrl", "shift"]
}

export interface HotkeyAction {
  keys: string[];                // e.g., ["ctrl", "c"], ["alt", "tab"]
}

// ─── Window Actions ─────────────────────────────────────────────────────────

export interface WindowInfo {
  id: string;
  title: string;
  application: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  minimized?: boolean;
  focused?: boolean;
}

export interface FocusWindowAction {
  windowId?: string;
  application?: string;
}

export interface LaunchAppAction {
  application: string;
  args?: string[];
}

// ─── Clipboard ──────────────────────────────────────────────────────────────

export interface ClipboardContent {
  text?: string;
  hasImage?: boolean;
  type: string;                  // "text", "image", "html", "rich-text"
}

// ─── Action Verification ────────────────────────────────────────────────────

export interface ActionVerification {
  verified: boolean;
  method: string;                // how we verified
  evidence?: string;
  timeout?: boolean;
  error?: string;
}

// ─── Desktop Adapter ────────────────────────────────────────────────────────

export interface DesktopAdapter {
  readonly platform: "macos" | "windows" | "linux" | "web" | "unknown";
  
  // Mouse
  click(action: MouseClickAction): Promise<ActionVerification>;
  move(action: MouseMoveAction): Promise<ActionVerification>;
  scroll(action: ScrollAction): Promise<ActionVerification>;
  
  // Keyboard
  typeText(action: TypeTextAction): Promise<ActionVerification>;
  keyPress(action: KeyPressAction): Promise<ActionVerification>;
  hotkey(action: HotkeyAction): Promise<ActionVerification>;
  
  // Clipboard
  clipboardRead(): Promise<ClipboardContent>;
  clipboardWrite(text: string): Promise<ActionVerification>;
  clipboardClear(): Promise<ActionVerification>;
  
  // Window
  listWindows(): Promise<WindowInfo[]>;
  focusWindow(action: FocusWindowAction): Promise<ActionVerification>;
  minimizeWindow(windowId: string): Promise<ActionVerification>;
  maximizeWindow(windowId: string): Promise<ActionVerification>;
  
  // Application
  launchApp(action: LaunchAppAction): Promise<ActionVerification>;
  closeApp(application: string): Promise<ActionVerification>;
  getActiveWindow(): Promise<WindowInfo | null>;
  
  // Screen
  captureScreen(region?: { x: number; y: number; width: number; height: number }): Promise<string | null>;
  
  // System
  isAvailable(): boolean;
  getCapabilities(): string[];
}

// ─── Screen Region ──────────────────────────────────────────────────────────

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Computer State ─────────────────────────────────────────────────────────

export interface ComputerState {
  adapter: DesktopAdapter;
  bridgeConnected: boolean;
  activeWindow: WindowInfo | null;
  lastAction: string;
  lastVerification: ActionVerification | null;
  permissions: {
    mouse: boolean;
    keyboard: boolean;
    screen: boolean;
    clipboard: boolean;
    window: boolean;
    application: boolean;
  };
}

// ─── Action Safety Map ──────────────────────────────────────────────────────

export const ACTION_SAFETY: Record<string, ActionSafetyLevel> = {
  "desktop.click": "READ",
  "desktop.doubleClick": "READ",
  "desktop.rightClick": "READ",
  "desktop.type": "LOW_RISK_WRITE",
  "desktop.press": "READ",
  "desktop.hotkey": "LOW_RISK_WRITE",
  "desktop.scroll": "READ",
  "desktop.move": "READ",
  "desktop.copy": "READ",
  "desktop.paste": "LOW_RISK_WRITE",
  "desktop.selectAll": "LOW_RISK_WRITE",
  "desktop.focusWindow": "READ",
  "desktop.listWindows": "READ",
  "desktop.switchWindow": "READ",
  "desktop.getActiveWindow": "READ",
  "desktop.launchApp": "LOW_RISK_WRITE",
  "desktop.closeApp": "LOW_RISK_WRITE",
  "desktop.minimizeWindow": "READ",
  "desktop.maximizeWindow": "READ",
  "screen.capture": "READ",
  "screen.current": "READ",
  "screen.read": "READ",
  "screen.describe": "READ",
  "screen.findText": "READ",
  "screen.findElement": "READ",
  "screen.analyze": "READ",
  "clipboard.read": "READ",
  "clipboard.write": "LOW_RISK_WRITE",
  "clipboard.clear": "LOW_RISK_WRITE",
};

// ─── Confirmation Required Actions ──────────────────────────────────────────

export const CONFIRMATION_REQUIRED = new Set([
  "desktop.closeApp",
  "desktop.paste",           // paste into external apps
  "clipboard.clear",
]);
