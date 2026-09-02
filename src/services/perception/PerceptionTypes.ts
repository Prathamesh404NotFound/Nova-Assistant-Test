/**
 * Nova Perception Layer — Types
 * Defines observation structures, UI elements, OCR results, and vision capabilities.
 */

// ─── Screen Observation ─────────────────────────────────────────────────────

export interface ScreenObservation {
  timestamp: number;
  activeApplication?: string;
  windowTitle?: string;
  screenshot?: string;          // base64 data URL or blob URL
  extractedText?: string;
  uiElements?: UIElement[];
  screenSize?: { width: number; height: number };
  displayIndex?: number;
  error?: string;
}

// ─── UI Element ─────────────────────────────────────────────────────────────

export interface UIElement {
  id: string;
  role?: string;                // button, textbox, menu, etc.
  name?: string;                // accessibility name
  text?: string;                // visible text content
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  enabled?: boolean;
  focused?: boolean;
  selected?: boolean;
  children?: UIElement[];
}

// ─── OCR Result ─────────────────────────────────────────────────────────────

export interface OCRResult {
  text: string;
  confidence: number;           // 0.0 - 1.0
  blocks: OCRBlock[];
  language?: string;
  processingTimeMs: number;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lines: OCRLine[];
}

export interface OCRLine {
  text: string;
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ─── Vision Analysis ────────────────────────────────────────────────────────

export interface VisionAnalysis {
  description: string;
  elements: VisionElement[];
  detectedText?: string[];
  detectedActions?: string[];   // actionable items found
  confidence: number;
  processingTimeMs: number;
}

export interface VisionElement {
  type: string;                 // button, text, image, icon, menu, etc.
  label?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

// ─── Perception Capability ──────────────────────────────────────────────────

export type PerceptionCapability =
  | "screen.capture"
  | "screen.current"
  | "screen.read"
  | "screen.describe"
  | "screen.findText"
  | "screen.findElement"
  | "screen.analyze"
  | "ocr.extract"
  | "vision.analyze";

// ─── Screen Region ──────────────────────────────────────────────────────────

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Perception Settings ────────────────────────────────────────────────────

export interface PerceptionSettings {
  allowScreenAccess: boolean;
  allowScreenshots: boolean;
  allowOCR: boolean;
  allowVisualAnalysis: boolean;
  persistScreenshots: boolean;   // default: false
  maxScreenshotAge: number;      // ms, auto-delete after
}

// ─── Desktop Bridge Status ──────────────────────────────────────────────────

export interface DesktopBridgeStatus {
  connected: boolean;
  platform: string;
  version?: string;
  capabilities: string[];
  lastPing?: number;
}

// ─── Default Settings ───────────────────────────────────────────────────────

export const DEFAULT_PERCEPTION_SETTINGS: PerceptionSettings = {
  allowScreenAccess: false,
  allowScreenshots: false,
  allowOCR: false,
  allowVisualAnalysis: false,
  persistScreenshots: false,
  maxScreenshotAge: 60 * 1000, // 1 minute
};
