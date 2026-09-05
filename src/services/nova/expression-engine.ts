/**
 * Nova Expression Engine
 *
 * First-class emotion-performance system:
 *  - Emotion Hold-Queue: every expression holds its natural minimum duration
 *    and blends over a fixed transition window (no "emotion whiplash").
 *  - Emotion → cue map: each emotion resolves to a sprite, halo color,
 *    head tilt, blink rate and pacing guideline (see README table).
 *  - Circadian baseline: Nova's idle expression follows local time of day.
 *  - Sentiment bridge: maps the existing emotion-engine detection onto
 *    performable Nova emotions (used for the Ambient Empathy Halo).
 *
 * All artwork maps onto the existing original sprite registry
 * (src/config/novaSprites.ts) — no external or copyrighted assets.
 */

import type { NovaSpriteState } from "@/config/novaSprites";
import { detectEmotion, type EmotionDetection } from "@/services/ai/emotion-engine";

// ─── Emotions ───────────────────────────────────────────────────────────────

export const NOVA_EMOTIONS = [
  "joy",
  "surprise",
  "curiosity",
  "focus",
  "confidence",
  "gentle",
  "alert",
  "sleepy",
  "processing",
  "humble",
  "concern",
  "proud",
] as const;

export type NovaEmotion = (typeof NOVA_EMOTIONS)[number];

export interface EmotionCue {
  sprite: NovaSpriteState;
  haloColor: string;
  headTilt: number; // degrees
  blinkMs: number; // blink cycle duration
  transitionMs: number; // blend duration into this emotion
  holdMs: number; // natural minimum hold
  particles: boolean; // show thinking particles
}

// Emotion → Animation Cue & Pacing Map (README table)
export const EMOTION_CUES: Record<NovaEmotion, EmotionCue> = {
  joy:        { sprite: "happy",      haloColor: "#fbbf24", headTilt: 2,   blinkMs: 2800, transitionMs: 150, holdMs: 1500, particles: false },
  surprise:   { sprite: "excited",    haloColor: "#00e5ff", headTilt: -5,  blinkMs: 900,  transitionMs: 80,  holdMs: 400,  particles: false },
  curiosity:  { sprite: "curious",    haloColor: "#a78bfa", headTilt: 9,   blinkMs: 3200, transitionMs: 400, holdMs: 1800, particles: false },
  focus:      { sprite: "focused",    haloColor: "#1d4ed8", headTilt: 0,   blinkMs: 5000, transitionMs: 300, holdMs: 1200, particles: true  },
  confidence: { sprite: "confident",  haloColor: "#f59e0b", headTilt: 0,   blinkMs: 4200, transitionMs: 400, holdMs: 1600, particles: false },
  gentle:     { sprite: "gentle",     haloColor: "#2dd4bf", headTilt: 0,   blinkMs: 2500, transitionMs: 600, holdMs: 2000, particles: false },
  alert:      { sprite: "alert",      haloColor: "#f59e0b", headTilt: -2,  blinkMs: 700,  transitionMs: 120, holdMs: 1500, particles: false },
  sleepy:     { sprite: "sleepy",     haloColor: "#475569", headTilt: 3,   blinkMs: 2600, transitionMs: 2200, holdMs: 2500, particles: false },
  processing: { sprite: "processing", haloColor: "#22d3ee", headTilt: 0,   blinkMs: 3400, transitionMs: 250, holdMs: 600,  particles: true  },
  humble:     { sprite: "gentle",     haloColor: "#fb7185", headTilt: 8,   blinkMs: 2600, transitionMs: 600, holdMs: 1800, particles: false },
  concern:    { sprite: "error",      haloColor: "#fb923c", headTilt: -3,  blinkMs: 1800, transitionMs: 120, holdMs: 1600, particles: false },
  proud:      { sprite: "happy",      haloColor: "#facc15", headTilt: -2,  blinkMs: 3600, transitionMs: 300, holdMs: 1300, particles: false },
};

// ─── Emotion Hold-Queue ─────────────────────────────────────────────────────

interface QueuedEmotion {
  emotion: NovaEmotion;
  priority: number; // higher wins over queued lower-priority items
}

export const EMOTION_PRIORITY: Record<NovaEmotion, number> = {
  surprise: 9,
  alert: 8,
  concern: 8,
  joy: 6,
  processing: 5,
  focus: 5,
  proud: 5,
  curiosity: 4,
  confidence: 4,
  gentle: 3,
  humble: 3,
  sleepy: 2,
};

/**
 * Guarantees each displayed expression holds its natural minimum duration and
 * blends (never hard-swaps). Consumers poll via subscribe().
 */
export class EmotionHoldQueue {
  private queue: QueuedEmotion[] = [];
  private current: NovaEmotion = "gentle";
  private shownAt = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(emotion: NovaEmotion) => void>();

  constructor(initial: NovaEmotion = "gentle") {
    this.current = initial;
  }

  subscribe(fn: (emotion: NovaEmotion) => void): () => void {
    this.listeners.add(fn);
    fn(this.current);
    return () => this.listeners.delete(fn);
  }

  get currentEmotion(): NovaEmotion {
    return this.current;
  }

  get transitionMs(): number {
    return EMOTION_CUES[this.current].transitionMs;
  }

  /** Request an emotion. Returns true if it will be displayed (enqueued). */
  express(emotion: NovaEmotion, priority = EMOTION_PRIORITY[emotion]): boolean {
    if (emotion === this.current) return false;
    const elapsed = Date.now() - this.shownAt;
    const hold = EMOTION_CUES[this.current].holdMs;

    if (elapsed >= hold && this.queue.length === 0) {
      this.show(emotion);
      return true;
    }

    // Replace lower-priority queued items, drop duplicate requests
    this.queue = this.queue.filter(
      (q) => q.emotion !== emotion && q.priority >= priority
    );
    this.queue.push({ emotion, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.scheduleNext();
    return true;
  }

  private scheduleNext() {
    if (this.timer) return;
    const hold = Math.max(0, EMOTION_CUES[this.current].holdMs - (Date.now() - this.shownAt));
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.queue.shift();
      if (next) {
        this.show(next.emotion);
        if (this.queue.length > 0) this.scheduleNext();
      }
    }, hold);
  }

  private show(emotion: NovaEmotion) {
    this.current = emotion;
    this.shownAt = Date.now();
    this.listeners.forEach((fn) => fn(emotion));
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
    this.listeners.clear();
  }
}

// ─── Circadian personality ──────────────────────────────────────────────────

/** Nova's baseline expression follows local time (§6 Time-of-Day Personality). */
export function circadianBaseline(date = new Date()): NovaEmotion {
  const h = date.getHours();
  if (h >= 23 || h < 5) return "sleepy"; // late-night companion
  if (h < 9) return "joy"; // bright morning greeting
  if (h < 12) return "curiosity";
  if (h < 17) return "focus"; // midday focused mode
  if (h < 21) return "gentle";
  return "sleepy"; // winding down
}

/** Blink rate multiplier for the circadian mode (slow at night). */
export function circadianBlinkMs(date = new Date()): number {
  const h = date.getHours();
  if (h >= 23 || h < 5) return 2500; // sleepy slow blink
  if (h < 9) return 2800;
  return 3400;
}

// ─── Sentiment bridge (Ambient Empathy Halo, §4) ────────────────────────────

/** Map the existing emotion engine's detection onto a performable Nova emotion. */
export function sentimentToEmotion(text: string, detection?: EmotionDetection): NovaEmotion {
  const det = detection ?? detectEmotion(text);
  if (det.confidence < 0.3) return circadianBaseline();

  switch (det.primary) {
    case "frustrated":
    case "angry":
      return "gentle"; // calming blues/teals — soothe, don't mirror anger
    case "sad":
      return "gentle";
    case "urgent":
      return "alert";
    case "excited":
      return "joy"; // energizing amber
    case "confused":
      return "curiosity";
    case "grateful":
      return "proud";
    case "playful":
      return "joy";
    default:
      return circadianBaseline();
  }
}

/** Detect a user correction ("no, I said…", "actually…") → humble recalibration (§2). */
export function detectCorrection(text: string): boolean {
  return (
    /\b(no,?\s+(i\s+said|that's not|you'?re wrong)|actually,?|not quite|you misremembered|wrong,?\s+nova)\b/i.test(
      text
    ) || /что неверно/i.test(text)
  );
}

// ─── Attention Beacon (§7) ──────────────────────────────────────────────────

/** Attention beacon: brief alert expression followed by return to baseline. */
export function expressAttentionBeacon(queue: EmotionHoldQueue): void {
  queue.express("alert");
  setTimeout(() => queue.express(circadianBaseline()), EMOTION_CUES.alert.holdMs + 200);
}

// ─── Celebration (§10) ──────────────────────────────────────────────────────

const CELEBRATIONS: NovaEmotion[] = ["joy", "proud", "confidence"];
let lastCelebration = "";

/** Never repeats the same celebration twice in a row. */
export function expressCelebration(queue: EmotionHoldQueue, magnitude: "small" | "big" = "small"): void {
  const pool = magnitude === "big" ? CELEBRATIONS : ["proud", "confidence"];
  const options = pool.filter((e) => e !== lastCelebration);
  const pick = options[Math.floor(Math.random() * options.length)] as NovaEmotion;
  lastCelebration = pick;
  queue.express(pick);
  setTimeout(() => queue.express(circadianBaseline()), EMOTION_CUES[pick].holdMs + 300);
}
