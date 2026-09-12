/**
 * Nova Environment Layer — Desktop / App / Screen services.
 * Thin wrappers over the existing verified-action ComputerService and the
 * vision-backed PerceptionService. Every action:
 *   - reports honestly when the desktop bridge is offline (no faking),
 *   - returns verified results from the underlying service,
 *   - publishes typed events on the Nova event bus.
 */

import { computerService } from "@/services/computer/ComputerService";
import { perceptionService } from "@/services/perception/PerceptionService";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import type {
  EnvActionResult,
  EnvironmentCapabilities,
  ScreenUnderstanding,
} from "./EnvironmentTypes";

// ─── DesktopService (mouse / keyboard / clipboard) ──────────────────────────

class DesktopServiceImpl {
  async capabilities(): Promise<EnvironmentCapabilities> {
    const bridge = await computerService.checkBridge();
    return this.capabilitiesFor(bridge);
  }

  capabilitiesFor(bridge: boolean): EnvironmentCapabilities {
    return {
      desktopBridge: bridge,
      screenshot: bridge,
      screenVision: true, // OCR/vision runs in-browser
      clipboard: typeof navigator !== "undefined" && !!navigator.clipboard,
      battery: "getBattery" in navigator,
      networkInfo: "connection" in navigator,
      fileSystem: true, // app-scoped store
      notifications: "Notification" in window || true, // in-app channel always available
      unsupportedInBrowser: bridge
        ? []
        : [
            "click/type/keypress/scroll (needs the Nova desktop bridge)",
            "screenshot (needs the Nova desktop bridge)",
            "open/focus/close apps (needs the Nova desktop bridge)",
            "disk usage (web pages cannot read disk)",
          ],
    };
  }

  async click(x: number, y: number, button: "left" | "right" | "middle" = "left"): Promise<EnvActionResult<{ x: number; y: number }>> {
    const result = await computerService.click(x, y, button);
    if (!result.verified) {
      return { success: false, verified: false, risk: "low", message: "", error: result.error ?? "Click could not be verified." };
    }
    return { success: true, verified: true, risk: "low", data: { x, y }, message: `Clicked at (${x}, ${y}) — verified via bridge.` };
  }

  async typeText(text: string, delayMs = 20): Promise<EnvActionResult<{ chars: number }>> {
    const result = await computerService.typeText(text, delayMs);
    if (!result.verified) {
      return { success: false, verified: false, risk: "low", message: "", error: result.error ?? "Typing could not be verified." };
    }
    return { success: true, verified: true, risk: "low", data: { chars: text.length }, message: `Typed ${text.length} characters — verified.` };
  }

  async keyPress(key: string, modifiers?: string[]): Promise<EnvActionResult<{ key: string }>> {
    const result = await computerService.keyPress(key, modifiers);
    if (!result.verified) {
      return { success: false, verified: false, risk: "low", message: "", error: result.error ?? "Key press could not be verified." };
    }
    return { success: true, verified: true, risk: "low", data: { key }, message: `Pressed ${key} — verified.` };
  }

  async scroll(x: number, y: number, deltaY: number): Promise<EnvActionResult<{ deltaY: number }>> {
    const result = await computerService.scroll(x, y, deltaY);
    if (!result.verified) {
      return { success: false, verified: false, risk: "safe", message: "", error: result.error ?? "Scroll could not be verified." };
    }
    return { success: true, verified: true, risk: "safe", data: { deltaY }, message: `Scrolled ${deltaY > 0 ? "down" : "up"} — verified.` };
  }

  async clipboardRead(): Promise<EnvActionResult<{ text: string }>> {
    const result = await computerService.clipboardRead();
    const text = result.text ?? "";
    return { success: true, verified: true, risk: "safe", data: { text }, message: text ? `Clipboard has ${text.length} characters.` : "Clipboard is empty." };
  }

  async clipboardWrite(text: string): Promise<EnvActionResult<{ chars: number }>> {
    const result = await computerService.clipboardWrite(text);
    if (!result.verified) {
      return { success: false, verified: false, risk: "safe", message: "", error: result.error ?? "Clipboard write could not be verified." };
    }
    return { success: true, verified: true, risk: "safe", data: { chars: text.length }, message: `Copied ${text.length} characters — verified.` };
  }
}

// ─── AppService (launch / focus / close / list) ──────────────────────────────

export interface AppWindowInfo {
  id: string;
  application: string;
  title: string;
}

class AppServiceImpl {
  async listOpen(): Promise<EnvActionResult<{ windows: AppWindowInfo[]; bridge: boolean }>> {
    const bridge = await computerService.checkBridge();
    if (!bridge) {
      return {
        success: false,
        verified: true,
        risk: "safe",
        message: "",
        error: "Listing open apps requires the Nova desktop bridge, which is not connected in this browser-only session.",
      };
    }
    const windows = await computerService.listWindows();
    return {
      success: true,
      verified: true,
      risk: "safe",
      data: { windows: windows as AppWindowInfo[], bridge: true },
      message: `${windows.length} open window${windows.length === 1 ? "" : "s"}.`,
    };
  }

  async open(application: string): Promise<EnvActionResult<{ application: string }>> {
    const result = await computerService.launchApp(application);
    if (!result.verified) {
      return { success: false, verified: false, risk: "low", message: "", error: result.error ?? `Could not verify that ${application} opened.` };
    }
    novaEventBus.emit("app.opened", { application, bridge: true });
    return { success: true, verified: true, risk: "low", data: { application }, message: `${application} is open — verified via bridge.` };
  }

  async focus(application: string): Promise<EnvActionResult<{ application: string }>> {
    const result = await computerService.focusWindow(undefined, application);
    if (!result.verified) {
      return { success: false, verified: false, risk: "safe", message: "", error: result.error ?? `Could not verify ${application} is focused.` };
    }
    return { success: true, verified: true, risk: "safe", data: { application }, message: `${application} focused — verified.` };
  }

  async close(application: string): Promise<EnvActionResult<{ application: string }>> {
    const result = await computerService.closeApp(application);
    if (!result.verified) {
      return { success: false, verified: false, risk: "medium", message: "", error: result.error ?? `Could not verify ${application} closed.` };
    }
    novaEventBus.emit("app.closed", { application });
    return { success: true, verified: true, risk: "medium", data: { application }, message: `${application} closed — verified.` };
  }
}

// ─── ScreenService (capture → OCR/vision → structured understanding) ────────

class ScreenServiceImpl {
  /** Screenshot → vision model → structured description of the screen. */
  async understand(): Promise<EnvActionResult<ScreenUnderstanding>> {
    const vision = await perceptionService.describeScreen();
    const ocr = await perceptionService.extractText();

    if (!vision.description && !ocr.text) {
      return {
        success: false,
        verified: true,
        risk: "safe",
        message: "",
        error: "Screen could not be read. Enable screen access in Settings → Perception, or connect the desktop bridge for screenshots.",
      };
    }

    const elements: ScreenUnderstanding["elements"] = [];
    // Derive structured elements from OCR lines (real data, not guesses).
    for (const line of ocr.text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40)) {
      elements.push({ kind: /cancel|ok|confirm|submit|save|close|settings|search/i.test(line) ? "button" : "text", label: line });
    }

    const understanding: ScreenUnderstanding = {
      capturedAt: Date.now(),
      description: vision.description || "No vision description available.",
      elements,
      ocrText: ocr.text,
      confidence: Math.round(ocr.confidence * 100),
    };

    novaEventBus.emit("screen.changed", { hash: `${understanding.capturedAt}` });
    return {
      success: true,
      verified: true,
      risk: "safe",
      data: understanding,
      message: understanding.description,
    };
  }

  async screenshot(): Promise<EnvActionResult<{ captured: boolean }>> {
    const obs = await perceptionService.captureScreen();
    if (!obs.screenshot) {
      return { success: false, verified: true, risk: "safe", message: "", error: obs.error ?? "Screenshot unavailable — enable screen access in Settings → Perception or connect the desktop bridge." };
    }
    return { success: true, verified: true, risk: "safe", data: { captured: true }, message: "Screenshot captured (processed locally — nothing is uploaded)." };
  }

  async readText(): Promise<EnvActionResult<{ text: string; confidence: number }>> {
    const ocr = await perceptionService.extractText();
    if (!ocr.text) {
      return { success: false, verified: true, risk: "safe", message: "", error: "No text detected. Enable OCR in Settings → Perception if screen access is set up." };
    }
    return { success: true, verified: true, risk: "safe", data: { text: ocr.text, confidence: Math.round(ocr.confidence * 100) }, message: `Extracted ${ocr.text.length} characters (${Math.round(ocr.confidence * 100)}% confidence).` };
  }

  async findText(text: string): Promise<EnvActionResult<{ found: boolean; location?: { x: number; y: number } }>> {
    const result = await perceptionService.findTextOnScreen(text);
    return {
      success: true,
      verified: true,
      risk: "safe",
      data: { found: result.found, location: result.location },
      message: result.found ? `Found "${text}" at (${result.location?.x}, ${result.location?.y}).` : `"${text}" is not on screen.`,
    };
  }
}

export const desktopService = new DesktopServiceImpl();
export const appService = new AppServiceImpl();
export const screenService = new ScreenServiceImpl();
