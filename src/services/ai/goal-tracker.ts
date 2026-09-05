/**
 * Nova AI OS — Persistent Goal Tracker
 *
 * Maintains active goals and sub-goals across sessions.
 * Users set high-level objectives, and Nova decomposes them into
 * actionable steps, tracks progress, and proactively nudges on deadlines.
 */

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "paused" | "cancelled";
  priority: "high" | "medium" | "low";
  steps: GoalStep[];
  deadline?: number; // timestamp
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  tags: string[];
}

export interface GoalStep {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: number;
}

const STORAGE_KEY = "nova_goals_v1";

// ─── Storage ───────────────────────────────────────────────────────────────

function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveGoals(goals: Goal[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch { /* ignore */ }
}

function generateId(): string {
  return `goal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ─── CRUD Operations ───────────────────────────────────────────────────────

/**
 * Create a new goal with optional sub-steps.
 */
export function createGoal(
  title: string,
  options?: {
    description?: string;
    steps?: string[];
    priority?: Goal["priority"];
    deadline?: number;
    tags?: string[];
  }
): Goal {
  const goals = loadGoals();
  const goal: Goal = {
    id: generateId(),
    title,
    description: options?.description || "",
    status: "active",
    priority: options?.priority || "medium",
    steps: (options?.steps || []).map((text) => ({
      id: generateId(),
      text,
      completed: false,
    })),
    deadline: options?.deadline,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: options?.tags || [],
  };

  goals.unshift(goal);
  saveGoals(goals);
  return goal;
}

/**
 * Get all goals, optionally filtered by status.
 */
export function getGoals(status?: Goal["status"]): Goal[] {
  const goals = loadGoals();
  return status ? goals.filter((g) => g.status === status) : goals;
}

/**
 * Get a goal by ID.
 */
export function getGoal(id: string): Goal | undefined {
  return loadGoals().find((g) => g.id === id);
}

/**
 * Mark a step as completed.
 */
export function completeStep(goalId: string, stepId: string): Goal | null {
  const goals = loadGoals();
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return null;

  const step = goal.steps.find((s) => s.id === stepId);
  if (!step) return null;

  step.completed = true;
  step.completedAt = Date.now();
  goal.updatedAt = Date.now();

  // Check if all steps are completed
  if (goal.steps.length > 0 && goal.steps.every((s) => s.completed)) {
    goal.status = "completed";
    goal.completedAt = Date.now();
  }

  saveGoals(goals);
  return goal;
}

/**
 * Mark the entire goal as completed.
 */
export function completeGoal(id: string): Goal | null {
  const goals = loadGoals();
  const goal = goals.find((g) => g.id === id);
  if (!goal) return null;

  goal.status = "completed";
  goal.completedAt = Date.now();
  goal.updatedAt = Date.now();
  goal.steps.forEach((s) => {
    if (!s.completed) {
      s.completed = true;
      s.completedAt = Date.now();
    }
  });

  saveGoals(goals);
  return goal;
}

/**
 * Delete a goal.
 */
export function deleteGoal(id: string): boolean {
  const goals = loadGoals();
  const filtered = goals.filter((g) => g.id !== id);
  if (filtered.length === goals.length) return false;
  saveGoals(filtered);
  return true;
}

// ─── AI Integration ────────────────────────────────────────────────────────

/**
 * Get a summary of active goals for injecting into AI context.
 */
export function getGoalsContext(): string {
  const activeGoals = getGoals("active");
  if (activeGoals.length === 0) return "";

  const lines = ["Active Goals:"];

  for (const goal of activeGoals) {
    const completedSteps = goal.steps.filter((s) => s.completed).length;
    const totalSteps = goal.steps.length;
    const progress = totalSteps > 0 ? `${completedSteps}/${totalSteps} steps` : "no steps";

    let deadline = "";
    if (goal.deadline) {
      const daysLeft = Math.ceil((goal.deadline - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        deadline = " [OVERDUE]";
      } else if (daysLeft === 0) {
        deadline = " [DUE TODAY]";
      } else if (daysLeft <= 3) {
        deadline = ` [${daysLeft} days left]`;
      }
    }

    lines.push(`- [${goal.priority.toUpperCase()}] ${goal.title} (${progress})${deadline}`);

    // Show incomplete steps
    const incomplete = goal.steps.filter((s) => !s.completed);
    for (const step of incomplete.slice(0, 3)) {
      lines.push(`  ○ ${step.text}`);
    }
    if (incomplete.length > 3) {
      lines.push(`  ○ ...and ${incomplete.length - 3} more`);
    }
  }

  return lines.join("\n");
}

/**
 * Get goals that are due soon (for proactive nudging).
 */
export function getUpcomingDeadlines(withinDays: number = 3): Goal[] {
  const now = Date.now();
  const cutoff = now + withinDays * 24 * 60 * 60 * 1000;

  return getGoals("active").filter(
    (g) => g.deadline && g.deadline <= cutoff && g.deadline >= now
  );
}

/**
 * Get overdue goals.
 */
export function getOverdueGoals(): Goal[] {
  const now = Date.now();
  return getGoals("active").filter((g) => g.deadline && g.deadline < now);
}

/**
 * Parse a natural language goal creation request.
 * Returns structured goal data if detectable.
 */
export function parseGoalRequest(text: string): {
  title: string;
  steps: string[];
  deadline?: number;
  priority: Goal["priority"];
} | null {
  const lower = text.toLowerCase();

  // Detect goal creation intent
  const goalPatterns = [
    /\b(?:create|add|set|start|begin|make)\s+(?:a\s+)?(?:new\s+)?goal\b/i,
    /\b(?:i want to|my goal is|i need to|i plan to|i will)\b/i,
    /\b(?:going to|gonna|wanna)\b/i,
    /मैं करना चाहता हूँ/,
    /मेरा लक्ष्य/,
  ];

  const isGoalRequest = goalPatterns.some((p) => p.test(text));
  if (!isGoalRequest) return null;

  // Extract title (remove goal creation phrases)
  let title = text
    .replace(/\b(?:create|add|set|start|begin|make)\s+(?:a\s+)?(?:new\s+)?goal\s*(?:to|:)?\s*/i, "")
    .replace(/\b(?:i want to|my goal is|i need to|i plan to|i will)\s*/i, "")
    .replace(/\b(?:going to|gonna|wanna)\s*/i, "")
    .replace(/मैं करना चाहता हूँ\s*/i, "")
    .replace(/मेरा लक्ष्य\s*/i, "")
    .trim();

  if (!title || title.length < 3) return null;

  // Detect priority
  let priority: Goal["priority"] = "medium";
  if (/\b(?:important|critical|high priority|urgent|jaldi)\b/i.test(text)) {
    priority = "high";
  } else if (/\b(?:low priority|whenever|no rush|baad mein)\b/i.test(text)) {
    priority = "low";
  }

  // Detect deadline
  let deadline: number | undefined;
  const now = Date.now();

  if (/\b(today|aaj)\b/i.test(text)) {
    deadline = now + 24 * 60 * 60 * 1000;
  } else if (/\b(tomorrow|kal)\b/i.test(text)) {
    deadline = now + 2 * 24 * 60 * 60 * 1000;
  } else if (/\b(this week|is hafte)\b/i.test(text)) {
    deadline = now + 7 * 24 * 60 * 60 * 1000;
  } else if (/\b(next week|agle hafte)\b/i.test(text)) {
    deadline = now + 14 * 24 * 60 * 60 * 1000;
  } else if (/\b(this month|is mahine)\b/i.test(text)) {
    deadline = now + 30 * 24 * 60 * 60 * 1000;
  }

  return { title, steps: [], deadline, priority };
}

/**
 * Reset all goals.
 */
export function clearAllGoals(): void {
  saveGoals([]);
}
