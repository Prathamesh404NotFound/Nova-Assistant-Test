/**
 * Nova AI OS — Action Dispatch System
 * Typed action registry, intent parsing, risk classification,
 * confirmation handling, idempotency, and structured errors.
 */

// --- Action Types ---
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ActionStatus = "planned" | "awaiting_confirmation" | "executing" | "succeeded" | "failed" | "cancelled";

export interface ActionDefinition {
  type: string;
  label: string;
  riskLevel: RiskLevel;
  confirmationRequired: boolean;
  timeoutMs: number;
}

export interface ActionEnvelope {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  riskLevel: RiskLevel;
  confirmationRequired: boolean;
  status: ActionStatus;
  createdAt: number;
  idempotencyKey: string;
  result?: string;
  error?: string;
}

// --- Action Registry ---
const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  // Calendar
  "calendar.create": { type: "calendar.create", label: "Create calendar event", riskLevel: "low", confirmationRequired: false, timeoutMs: 5000 },
  "calendar.update": { type: "calendar.update", label: "Update calendar event", riskLevel: "low", confirmationRequired: false, timeoutMs: 5000 },
  "calendar.delete": { type: "calendar.delete", label: "Delete calendar event", riskLevel: "medium", confirmationRequired: true, timeoutMs: 5000 },
  "calendar.invite": { type: "calendar.invite", label: "Send calendar invitation", riskLevel: "high", confirmationRequired: true, timeoutMs: 10000 },

  // Memory
  "memory.save": { type: "memory.save", label: "Save memory", riskLevel: "low", confirmationRequired: false, timeoutMs: 3000 },
  "memory.update": { type: "memory.update", label: "Update memory", riskLevel: "low", confirmationRequired: false, timeoutMs: 3000 },
  "memory.delete": { type: "memory.delete", label: "Delete memory", riskLevel: "medium", confirmationRequired: true, timeoutMs: 3000 },
  "memory.search": { type: "memory.search", label: "Search memories", riskLevel: "low", confirmationRequired: false, timeoutMs: 3000 },

  // Files
  "file.create": { type: "file.create", label: "Create file", riskLevel: "low", confirmationRequired: false, timeoutMs: 5000 },
  "file.rename": { type: "file.rename", label: "Rename file", riskLevel: "low", confirmationRequired: false, timeoutMs: 5000 },
  "file.move": { type: "file.move", label: "Move file", riskLevel: "medium", confirmationRequired: false, timeoutMs: 5000 },
  "file.delete": { type: "file.delete", label: "Delete file", riskLevel: "high", confirmationRequired: true, timeoutMs: 5000 },
  "file.upload": { type: "file.upload", label: "Upload file", riskLevel: "low", confirmationRequired: false, timeoutMs: 15000 },

  // Tasks
  "task.create": { type: "task.create", label: "Create task", riskLevel: "low", confirmationRequired: false, timeoutMs: 3000 },
  "task.complete": { type: "task.complete", label: "Complete task", riskLevel: "low", confirmationRequired: false, timeoutMs: 3000 },
  "task.delete": { type: "task.delete", label: "Delete task", riskLevel: "medium", confirmationRequired: true, timeoutMs: 3000 },

  // Email
  "email.send": { type: "email.send", label: "Send email", riskLevel: "critical", confirmationRequired: true, timeoutMs: 10000 },
  "email.draft": { type: "email.draft", label: "Draft email", riskLevel: "low", confirmationRequired: false, timeoutMs: 5000 },

  // Smart Home
  "device.toggle": { type: "device.toggle", label: "Toggle device", riskLevel: "medium", confirmationRequired: true, timeoutMs: 5000 },
  "device.adjust": { type: "device.adjust", label: "Adjust device", riskLevel: "medium", confirmationRequired: true, timeoutMs: 5000 },

  // Code
  "code.execute": { type: "code.execute", label: "Execute code", riskLevel: "critical", confirmationRequired: true, timeoutMs: 30000 },
  "code.deploy": { type: "code.deploy", label: "Deploy code", riskLevel: "critical", confirmationRequired: true, timeoutMs: 30000 },

  // Automations
  "automation.create": { type: "automation.create", label: "Create automation", riskLevel: "medium", confirmationRequired: false, timeoutMs: 5000 },
  "automation.delete": { type: "automation.delete", label: "Delete automation", riskLevel: "medium", confirmationRequired: true, timeoutMs: 5000 },
};

// --- Intent Patterns ---
interface IntentPattern {
  patterns: RegExp[];
  type: string;
  extractParams: (match: RegExpMatchArray, fullText: string) => Record<string, unknown>;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Calendar
  {
    patterns: [/add\s+(?:a\s+)?meeting\s+(?:with\s+)?(.+?)\s+(?:on\s+)?(\w+\s+\d{1,2})\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i],
    type: "calendar.create",
    extractParams: (m) => ({ title: `Meeting with ${m[1]}`, date: m[2], time: m[3], attendees: [m[1]] }),
  },
  {
    patterns: [/schedule\s+(?:a\s+)?(.+?)\s+(?:for\s+)?(\w+\s+\d{1,2})\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i],
    type: "calendar.create",
    extractParams: (m) => ({ title: m[1], date: m[2], time: m[3] }),
  },
  {
    patterns: [/delete\s+(?:the\s+)?(?:calendar\s+)?event\s+(?:named?\s+)?["']?(.+?)["']?\s*$/i, /cancel\s+(?:the\s+)?(?:meeting|event)\s+(?:named?\s+)?["']?(.+?)["']?\s*$/i],
    type: "calendar.delete",
    extractParams: (m) => ({ title: m[1] }),
  },

  // Memory
  {
    patterns: [/remember\s+(?:that\s+)?(.+)/i, /save\s+(?:this\s+)?(?:as\s+)?(?:a\s+)?memory[:\s]+(.+)/i, /keep\s+in\s+mind[:\s]+(.+)/i],
    type: "memory.save",
    extractParams: (m) => ({ content: m[1].trim() }),
  },
  {
    patterns: [/show\s+(?:me\s+)?(?:my\s+)?(?:saved\s+)?memories?\s+(?:about\s+|for\s+|related\s+to\s+)?(.+)/i, /what\s+do\s+you\s+know\s+(?:about\s+|regarding\s+)?(.+)/i],
    type: "memory.search",
    extractParams: (m) => ({ query: m[1].trim() }),
  },
  {
    patterns: [/delete\s+(?:the\s+)?memory\s+(?:about\s+|for\s+)?["']?(.+?)["']?\s*$/i],
    type: "memory.delete",
    extractParams: (m) => ({ query: m[1].trim() }),
  },

  // Files
  {
    patterns: [/create\s+(?:a\s+)?file\s+(?:named?\s+|called?\s+)?["']?(.+?)["']?\s*$/i],
    type: "file.create",
    extractParams: (m) => ({ name: m[1].trim() }),
  },
  {
    patterns: [/rename\s+(.+?)\s+(?:to\s+|as\s+)(.+)/i],
    type: "file.rename",
    extractParams: (m) => ({ from: m[1].trim(), to: m[2].trim() }),
  },
  {
    patterns: [/delete\s+(?:the\s+)?file\s+["']?(.+?)["']?\s*$/i, /remove\s+(?:the\s+)?file\s+["']?(.+?)["']?\s*$/i],
    type: "file.delete",
    extractParams: (m) => ({ name: m[1].trim() }),
  },
  {
    patterns: [/upload\s+(?:a\s+)?file/i],
    type: "file.upload",
    extractParams: () => ({ source: "user_upload" }),
  },

  // Tasks
  {
    patterns: [/add\s+(?:a\s+)?task[:\s]+(.+)/i, /create\s+(?:a\s+)?task[:\s]+(.+)/i, /todo[:\s]+(.+)/i],
    type: "task.create",
    extractParams: (m) => ({ title: m[1].trim() }),
  },
  {
    patterns: [/complete\s+(?:the\s+)?task\s+["']?(.+?)["']?\s*$/i, /mark\s+["']?(.+?)["']?\s+as\s+done/i],
    type: "task.complete",
    extractParams: (m) => ({ title: m[1].trim() }),
  },
];

// --- Confirmation Store ---
interface PendingConfirmation {
  action: ActionEnvelope;
  expiresAt: number;
}

const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const pendingConfirmations = new Map<string, PendingConfirmation>();

// --- Core Functions ---
function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getActionDefinition(type: string): ActionDefinition | null {
  return ACTION_REGISTRY[type] || null;
}

export function getRegisteredActions(): ActionDefinition[] {
  return Object.values(ACTION_REGISTRY);
}

/**
 * Parse natural language into an action request.
 */
export function parseIntent(input: string): { action: ActionEnvelope; confidence: number; reason: string } | null {
  const trimmed = input.trim();

  for (const intent of INTENT_PATTERNS) {
    for (const pattern of intent.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const definition = getActionDefinition(intent.type);
        if (!definition) continue;

        const params = intent.extractParams(match, trimmed);
        const action: ActionEnvelope = {
          id: generateId(),
          type: intent.type,
          parameters: params,
          riskLevel: definition.riskLevel,
          confirmationRequired: definition.confirmationRequired,
          status: definition.confirmationRequired ? "awaiting_confirmation" : "planned",
          createdAt: Date.now(),
          idempotencyKey: generateIdempotencyKey(),
        };

        return {
          action,
          confidence: 0.85,
          reason: `Matched pattern for ${intent.type}`,
        };
      }
    }
  }

  return null;
}

/**
 * Request confirmation for an action.
 */
export function requestConfirmation(action: ActionEnvelope): PendingConfirmation {
  const entry: PendingConfirmation = {
    action: { ...action, status: "awaiting_confirmation" },
    expiresAt: Date.now() + CONFIRMATION_TIMEOUT_MS,
  };
  pendingConfirmations.set(action.id, entry);
  return entry;
}

/**
 * Confirm a pending action.
 */
export function confirmAction(actionId: string): ActionEnvelope | null {
  const pending = pendingConfirmations.get(actionId);
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    pendingConfirmations.delete(actionId);
    return null;
  }
  pendingConfirmations.delete(actionId);
  return { ...pending.action, status: "executing" };
}

/**
 * Cancel a pending action.
 */
export function cancelAction(actionId: string): boolean {
  return pendingConfirmations.delete(actionId);
}

/**
 * Check if a confirmation is still valid.
 */
export function isConfirmationValid(actionId: string): boolean {
  const pending = pendingConfirmations.get(actionId);
  if (!pending) return false;
  if (Date.now() > pending.expiresAt) {
    pendingConfirmations.delete(actionId);
    return false;
  }
  return true;
}

/**
 * Get all pending confirmations.
 */
export function getPendingConfirmations(): PendingConfirmation[] {
  const now = Date.now();
  const entries: PendingConfirmation[] = [];
  for (const [id, entry] of pendingConfirmations) {
    if (now > entry.expiresAt) {
      pendingConfirmations.delete(id);
    } else {
      entries.push(entry);
    }
  }
  return entries;
}

// --- Response Templates ---
export function formatSuccess(type: string, result: string): string {
  return `Done — ${result}.`;
}

export function formatConfirmation(action: ActionEnvelope): string {
  const def = getActionDefinition(action.type);
  const label = def?.label || action.type;
  const params = Object.entries(action.parameters)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return `Are you sure you want to ${label.toLowerCase()} (${params})? Reply 'YES' to confirm.`;
}

export function formatFailure(type: string, reason: string): string {
  return `I couldn't complete this action because ${reason}. No changes were made.`;
}

export function formatPartialResult(completed: string, failed: string): string {
  return `The action completed partially: ${completed}. The following could not be completed: ${failed}.`;
}

// --- Activity Log ---
export interface ActivityEntry {
  id: string;
  actionType: string;
  description: string;
  status: ActionStatus;
  timestamp: number;
  riskLevel: RiskLevel;
}

const ACTIVITY_KEY = "nova_activity_log";

function loadActivity(): ActivityEntry[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveActivity(entries: ActivityEntry[]) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(entries.slice(-200)));
}

export function logActivity(entry: Omit<ActivityEntry, "id" | "timestamp">): void {
  const log = loadActivity();
  log.push({
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  });
  saveActivity(log);
}

export function getActivityLog(): ActivityEntry[] {
  return loadActivity().sort((a, b) => b.timestamp - a.timestamp);
}
