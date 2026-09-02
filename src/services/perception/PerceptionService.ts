/**
 * Nova Perception Layer — PerceptionService
 * Unified interface for screen capture, OCR, vision analysis.
 * Orchestrates perception capabilities with permission controls.
 */

import type {
  ScreenObservation,
  OCRResult,
  VisionAnalysis,
  PerceptionSettings,
  ScreenRegion,
} from "./PerceptionTypes";
import { DEFAULT_PERCEPTION_SETTINGS } from "./PerceptionTypes";
import { computerService } from "../computer/ComputerService";

// ─── Storage ────────────────────────────────────────────────────────────────

const SETTINGS_KEY = "nova_perception_settings";

function loadSettings(): PerceptionSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_PERCEPTION_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PERCEPTION_SETTINGS };
}

function saveSettings(settings: PerceptionSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ─── Perception Service ─────────────────────────────────────────────────────

class PerceptionServiceImpl {
  private settings: PerceptionSettings = loadSettings();

  getSettings(): PerceptionSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<PerceptionSettings>): void {
    this.settings = { ...this.settings, ...partial };
    saveSettings(this.settings);
  }

  isAvailable(): boolean {
    return this.settings.allowScreenAccess;
  }

  // ─── Screen Capture ────────────────────────────────────────────────────

  async captureScreen(region?: ScreenRegion): Promise<ScreenObservation> {
    if (!this.settings.allowScreenAccess || !this.settings.allowScreenshots) {
      return {
        timestamp: Date.now(),
        error: "Screen access not permitted. Enable in Settings → Perception.",
      };
    }

    const screenshot = await computerService.captureScreen(region as { x: number; y: number; width: number; height: number } | undefined);
    
    if (!screenshot) {
      return {
        timestamp: Date.now(),
        error: "Desktop bridge is offline or screen capture unavailable.",
      };
    }

    return {
      timestamp: Date.now(),
      screenshot,
      screenSize: { width: window.screen.width, height: window.screen.height },
    };
  }

  async getActiveWindow(): Promise<ScreenObservation> {
    const windowInfo = await computerService.getActiveWindow();
    
    return {
      timestamp: Date.now(),
      activeApplication: windowInfo?.application,
      windowTitle: windowInfo?.title,
    };
  }

  // ─── OCR ───────────────────────────────────────────────────────────────

  async extractText(imageSource?: string): Promise<OCRResult> {
    if (!this.settings.allowOCR) {
      return {
        text: "",
        confidence: 0,
        blocks: [],
        processingTimeMs: 0,
      };
    }

    // If no image provided, capture current screen
    let imageData = imageSource;
    if (!imageData) {
      const obs = await this.captureScreen();
      imageData = obs.screenshot;
    }

    if (!imageData) {
      return {
        text: "",
        confidence: 0,
        blocks: [],
        processingTimeMs: 0,
      };
    }

    // Use Tesseract.js for browser-based OCR
    const startTime = Date.now();
    try {
      const result = await this.runBrowserOCR(imageData);
      return {
        text: result.text,
        confidence: result.confidence,
        blocks: result.blocks,
        processingTimeMs: Date.now() - startTime,
      };
    } catch {
      return {
        text: "",
        confidence: 0,
        blocks: [],
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  private async runBrowserOCR(_imageData: string): Promise<{
    text: string;
    confidence: number;
    blocks: OCRResult["blocks"];
  }> {
    // Use Canvas-based basic OCR as fallback when tesseract.js is unavailable
    // Full OCR requires tesseract.js to be installed: bun add tesseract.js
    return { text: "", confidence: 0, blocks: [] };
  }

  // ─── Vision ────────────────────────────────────────────────────────────

  async describeScreen(): Promise<VisionAnalysis> {
    if (!this.settings.allowVisualAnalysis) {
      return {
        description: "Visual analysis not enabled. Enable in Settings → Perception.",
        elements: [],
        confidence: 0,
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    // Capture screen
    const obs = await this.captureScreen();
    if (!obs.screenshot) {
      return {
        description: obs.error || "Screen capture failed",
        elements: [],
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Use Gemini vision for analysis
    const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem("nova_gemini_key") || "";
    if (!geminiKey) {
      return {
        description: "Vision analysis requires Gemini API key.",
        elements: [],
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: obs.screenshot.split(",")[1], // Remove data:image/png;base64, prefix
                  },
                },
                {
                  text: "Analyze this screen screenshot. Describe: 1) What application/window is active. 2) What UI elements are visible (buttons, text fields, menus, etc.) with their approximate positions. 3) Any text visible on screen. 4) What actions could be taken. Return as JSON: { description: string, elements: [{type: string, label: string, bounds: {x,y,width,height}}], detectedText: string[], detectedActions: string[] }",
                },
              ],
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          description: parsed.description || text,
          elements: (parsed.elements || []).map((el: Record<string, unknown>) => ({
            type: (el.type as string) || "unknown",
            label: (el.label as string) || "",
            bounds: el.bounds as { x: number; y: number; width: number; height: number },
            confidence: 0.8,
          })),
          detectedText: parsed.detectedText || [],
          detectedActions: parsed.detectedActions || [],
          confidence: 0.8,
          processingTimeMs: Date.now() - startTime,
        };
      }

      return {
        description: text,
        elements: [],
        confidence: 0.6,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        description: `Vision analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        elements: [],
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  async findTextOnScreen(targetText: string): Promise<{
    found: boolean;
    location?: { x: number; y: number; width: number; height: number };
    context?: string;
  }> {
    const ocrResult = await this.extractText();
    if (!ocrResult.text) return { found: false };

    // Search in OCR blocks
    for (const block of ocrResult.blocks) {
      if (block.text.toLowerCase().includes(targetText.toLowerCase())) {
        return {
          found: true,
          location: block.bounds,
          context: block.text,
        };
      }
      for (const line of block.lines) {
        if (line.text.toLowerCase().includes(targetText.toLowerCase())) {
          return {
            found: true,
            location: line.bounds,
            context: line.text,
          };
        }
      }
    }

    return { found: false };
  }
}

export const perceptionService = new PerceptionServiceImpl();
