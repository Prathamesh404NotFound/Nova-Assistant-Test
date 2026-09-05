/**
 * Nova Labs — Novel Assistant Features
 *
 * Software-only implementations built on the existing local-store pattern:
 *  1. Time-Debt Auditor    — ledger of time Nova repaid vs. manual work
 *  2. Assumption Ledger    — assumptions surfaced as correctable chips
 *  3. Friction Detector    — proactive suggestions from activity patterns
 *  4. Future-Self Letters  — scheduled letters delivered "from your past self"
 *  5. Session Storyboard   — 6-panel reflective summary of a work session
 *  6. Ephemeral Whisper    — zero-retention message flag + styling
 *
 * All persistence is localStorage, user-agnostic device-local (never raw
 * sensitive data; letters/decisions are user-authored content).
 */

import { getActivities, logActivity, type ActivityEntry } from "@/lib/local-store";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── 1. Time-Debt Auditor ───────────────────────────────────────────────────

export interface TimeDebtEntry {
  id: string;
  task: string;
  category: string; // research | writing | email | planning | other
  manualMinutes: number; // estimate of doing it by hand
  createdAt: number;
  corrected?: boolean;
}

const DEBT_KEY = "nova_time_debt";

export function getTimeDebtEntries(): TimeDebtEntry[] {
  return read<TimeDebtEntry[]>(DEBT_KEY, []);
}

export function addTimeDebt(task: string, manualMinutes: number, category = "other"): TimeDebtEntry {
  const entry: TimeDebtEntry = { id: uid("debt"), task, category, manualMinutes, createdAt: Date.now() };
  const entries = getTimeDebtEntries();
  entries.unshift(entry);
  if (entries.length > 300) entries.length = 300;
  write(DEBT_KEY, entries);
  return entry;
}

export function correctTimeDebt(id: string, manualMinutes: number) {
  const entries = getTimeDebtEntries();
  const e = entries.find((x) => x.id === id);
  if (e) {
    e.manualMinutes = Math.max(0, manualMinutes);
    e.corrected = true;
    write(DEBT_KEY, entries);
  }
}

export function deleteTimeDebt(id: string) {
  write(DEBT_KEY, getTimeDebtEntries().filter((e) => e.id !== id));
}

/** Heuristic estimate (minutes) of doing a task manually, by category. */
export function estimateManualMinutes(task: string): { minutes: number; category: string } {
  const t = task.toLowerCase();
  const table: [RegExp, number, string][] = [
    [/research|look ?up|compare|find (?:info|information)/, 25, "research"],
    [/email|draft|write.*(mail|letter)/, 12, "email"],
    [/summar|recap|digest|report/, 20, "writing"],
    [/plan|schedule|organiz|itinerary/, 18, "planning"],
    [/code|debug|script|fix/, 35, "coding"],
  ];
  for (const [re, minutes, category] of table) {
    if (re.test(t)) return { minutes, category };
  }
  return { minutes: 8, category: "other" };
}

export interface TimeDebtRollup {
  totalMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  topCategories: { category: string; minutes: number }[];
}

export function getTimeDebtRollup(): TimeDebtRollup {
  const entries = getTimeDebtEntries();
  const now = Date.now();
  const week = now - 7 * 864e5;
  const month = now - 30 * 864e5;
  const byCat = new Map<string, number>();
  let total = 0, weekM = 0, monthM = 0;
  for (const e of entries) {
    total += e.manualMinutes;
    if (e.createdAt >= week) weekM += e.manualMinutes;
    if (e.createdAt >= month) monthM += e.manualMinutes;
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.manualMinutes);
  }
  const topCategories = [...byCat.entries()]
    .map(([category, minutes]) => ({ category, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);
  return { totalMinutes: total, weekMinutes: weekM, monthMinutes: monthM, topCategories };
}

/** Record a completed task into the ledger (called from chat when Nova finishes a task). */
export function recordTaskDebt(task: string): TimeDebtEntry | null {
  if (!task.trim()) return null;
  const { minutes, category } = estimateManualMinutes(task);
  const entry = addTimeDebt(task.slice(0, 120), minutes, category);
  logActivity("labs", `⏱ Logged time-debt: ${entry.manualMinutes}m — ${entry.task}`, "clock");
  return entry;
}

// ─── 2. Assumption Ledger ───────────────────────────────────────────────────

export interface AssumptionRecord {
  id: string;
  messageId: string;
  text: string;
  rejected: boolean;
  createdAt: number;
}

const ASSUMP_KEY = "nova_assumptions";

export function getAssumptions(): AssumptionRecord[] {
  return read<AssumptionRecord[]>(ASSUMP_KEY, []);
}

export function addAssumptions(messageId: string, texts: string[]): AssumptionRecord[] {
  const recs = texts.filter(Boolean).slice(0, 5).map((text) => ({
    id: uid("asm"),
    messageId,
    text,
    rejected: false,
    createdAt: Date.now(),
  }));
  if (recs.length === 0) return [];
  write(ASSUMP_KEY, [...getAssumptions(), ...recs]);
  return recs;
}

export function rejectAssumption(id: string) {
  const recs = getAssumptions();
  const rec = recs.find((r) => r.id === id);
  if (rec) {
    rec.rejected = true;
    write(ASSUMP_KEY, recs);
    logActivity("labs", `↩ Corrected assumption: ${rec.text}`, "corner-up-left");
  }
}

/** Assumptions the user keeps rejecting — candidates to persist as preferences. */
export function frequentRejectedAssumptions(minCount = 2): string[] {
  const counts = new Map<string, number>();
  for (const r of getAssumptions().filter((r) => r.rejected)) {
    const k = r.text.trim().toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= minCount).map(([k]) => k);
}

// ─── 3. Proactive Friction Detector ─────────────────────────────────────────

export interface FrictionSuggestion {
  rule: string;
  message: string;
  weight: number;
}

const FRICTION_KEY = "nova_friction_weights";

interface FrictionState {
  weights: Record<string, number>;
  lastSuggestionDay: string;
}

function getFrictionState(): FrictionState {
  return read<FrictionState>(FRICTION_KEY, { weights: {}, lastSuggestionDay: "" });
}

function saveFrictionState(s: FrictionState) {
  write(FRICTION_KEY, s);
}

/**
 * Scan the activity log for repeated actions on the same entity within a
 * window and return at most one suggestion per day.
 */
export function getFrictionSuggestion(): FrictionSuggestion | null {
  const state = getFrictionState();
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastSuggestionDay === today) return null; // one per day max

  const activities = getActivities();
  const dayAgo = Date.now() - 864e5 * 3;
  const recent = activities.filter((a) => a.createdAt >= dayAgo);

  // Rule: same description repeated ≥3 times in 3 days
  const counts = new Map<string, number>();
  for (const a of recent) {
    const k = a.description.slice(0, 30).toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const rules: { rule: string; message: string; base: number }[] = [];
  for (const [desc, n] of counts) {
    if (n >= 3) {
      rules.push({
        rule: `repeat:${desc}`,
        message: `You've done "${desc.slice(0, 40)}" ${n} times recently — want me to turn it into an automation?`,
        base: n,
      });
    }
  }

  // Rule: lots of chat sends in a short window → manual looping
  const chatSends = recent.filter((a) => a.type === "chat").length;
  if (chatSends >= 15) {
    rules.push({
      rule: "chat-burst",
      message: `You've sent ${chatSends} messages in 3 days. Try asking Nova to batch the recurring ones into an automation.`,
      base: chatSends / 5,
    });
  }

  if (rules.length === 0) return null;
  rules.sort((a, b) => (state.weights[b.rule] ?? 0) + b.base - ((state.weights[a.rule] ?? 0) + a.base));
  const top = rules[0];
  if ((state.weights[top.rule] ?? 0) <= -2) return null; // learned dismissal

  return { rule: top.rule, message: top.message, weight: state.weights[top.rule] ?? 0 };
}

export function markFrictionSuggested() {
  const state = getFrictionState();
  state.lastSuggestionDay = new Date().toISOString().slice(0, 10);
  saveFrictionState(state);
}

export function dismissFrictionRule(rule: string) {
  const state = getFrictionState();
  state.weights[rule] = (state.weights[rule] ?? 0) - 1;
  saveFrictionState(state);
}

// ─── 4. Future-Self Letters ─────────────────────────────────────────────────

export interface FutureLetter {
  id: string;
  body: string;
  deliverAt: number; // epoch ms
  trigger?: "date" | "deadline";
  delivered: boolean;
  readAt?: number;
  createdAt: number;
}

const LETTERS_KEY = "nova_future_letters";

export function getFutureLetters(): FutureLetter[] {
  return read<FutureLetter[]>(LETTERS_KEY, []);
}

export function scheduleFutureLetter(body: string, deliverAt: number, trigger: "date" | "deadline" = "date"): FutureLetter {
  const letter: FutureLetter = {
    id: uid("ltr"),
    body,
    deliverAt,
    trigger,
    delivered: false,
    createdAt: Date.now(),
  };
  write(LETTERS_KEY, [letter, ...getFutureLetters()]);
  logActivity("labs", `✉ Letter scheduled for ${new Date(deliverAt).toLocaleDateString()}`, "mail");
  return letter;
}

export function getDueLetters(): FutureLetter[] {
  const letters = getFutureLetters();
  const due = letters.filter((l) => !l.delivered && l.deliverAt <= Date.now());
  if (due.length > 0) {
    for (const l of due) l.delivered = true;
    write(LETTERS_KEY, letters);
  }
  return due;
}

export function markLetterRead(id: string) {
  const letters = getFutureLetters();
  const l = letters.find((x) => x.id === id);
  if (l) {
    l.readAt = Date.now();
    write(LETTERS_KEY, letters);
  }
}

// ─── 5. Session Storyboard ──────────────────────────────────────────────────

export interface StoryboardPanel {
  emoji: string;
  caption: string;
}

export interface SessionStoryboard {
  id: string;
  panels: StoryboardPanel[];
  createdAt: number;
}

const STORY_KEY = "nova_storyboards";

export function getSessionStoryboards(): SessionStoryboard[] {
  return read<SessionStoryboard[]>(STORY_KEY, []);
}

/** Build a 6-panel storyboard from recent activity (no LLM needed). */
export function buildSessionStoryboard(): SessionStoryboard {
  const activities = getActivities().slice(0, 20);
  const byType = new Map<string, ActivityEntry[]>();
  for (const a of activities) {
    const list = byType.get(a.type) ?? [];
    list.push(a);
    byType.set(a.type, list);
  }
  const emojiFor: Record<string, string> = {
    chat: "💬",
    memory: "🧠",
    labs: "🧪",
    email: "✉️",
    calendar: "📅",
    automation: "⚡",
    voice: "🎙",
  };
  const panels: StoryboardPanel[] = [];
  for (const [type, list] of byType) {
    if (panels.length >= 5) break;
    panels.push({ emoji: emojiFor[type] ?? "✨", caption: `${list.length}× ${type} — "${list[0]?.description.slice(0, 36) ?? ""}"` });
  }
  panels.unshift({ emoji: "🌅", caption: "Session started" });
  if (panels.length > 6) panels.length = 6;
  while (panels.length < 6) panels.push({ emoji: "✨", caption: "Quiet wrap-up" });

  const board: SessionStoryboard = { id: uid("sb"), panels, createdAt: Date.now() };
  write(STORY_KEY, [board, ...getSessionStoryboards()].slice(0, 20));
  logActivity("labs", "🎞 Session storyboard generated", "film");
  return board;
}

// ─── 6. Ephemeral Whisper Mode ──────────────────────────────────────────────

/** Zero-retention flag; the caller must skip ALL persistence when true. */
export interface WhisperOptions {
  ephemeral?: boolean;
}

export const WHISPER_NOTICE = "Ghost mode: this exchange was processed but never saved — not to history, memory, or activity logs.";
