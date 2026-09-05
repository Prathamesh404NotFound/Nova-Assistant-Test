/**
 * Nova AI OS — Proactive Context Engine
 * Surfaces relevant information before the user asks.
 * Monitors calendar, tasks, memory, and patterns to provide
 * anticipatory assistance like JARVIS.
 */

import { unifiedMemory } from "@/services/memory/MemoryService";
import { memoryManager } from "@/services/memory/memory-manager";

export interface ProactiveInsight {
  type: "calendar" | "task" | "memory" | "pattern" | "reminder";
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  actionLabel?: string;
  actionTarget?: string;
}

/**
 * Build a proactive context summary for the current moment.
 * Called before Gemini requests to inject situational awareness.
 */
export async function buildProactiveContext(): Promise<string> {
  const insights = await gatherInsights();
  if (insights.length === 0) return "";

  const lines = insights
    .sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      return priority[a.priority] - priority[b.priority];
    })
    .slice(0, 5)
    .map((i) => `- [${i.type.toUpperCase()}] ${i.title}: ${i.detail}`)
    .join("\n");

  return `\n\nProactive Context (use if relevant to the user's query):\n${lines}`;
}

/**
 * Gather proactive insights from all available sources.
 */
async function gatherInsights(): Promise<ProactiveInsight[]> {
  const insights: ProactiveInsight[] = [];

  // 1. Upcoming tasks
  try {
    const stored = localStorage.getItem("nova_tasks_local") || "[]";
    const tasks = JSON.parse(stored);
    const pendingTasks = tasks.filter((t: any) => t.status === "pending");
    if (pendingTasks.length > 0) {
      const topTasks = pendingTasks.slice(0, 3);
      insights.push({
        type: "task",
        title: `${pendingTasks.length} pending tasks`,
        detail: topTasks.map((t: any) => t.title).join(", "),
        priority: pendingTasks.length > 5 ? "high" : "medium",
      });
    }
  } catch { /* ignore */ }

  // 2. Relevant memories
  try {
    await unifiedMemory.initialize();
    const recentMemories = await unifiedMemory.recall({
      currentMessage: "user context",
      maxMemories: 3,
    });
    if (recentMemories.length > 0) {
      insights.push({
        type: "memory",
        title: "Stored preferences",
        detail: recentMemories.map((m: any) => m.value || m.key).join("; ").slice(0, 150),
        priority: "low",
      });
    }
  } catch { /* ignore */ }

  // 3. Time-based patterns
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 10) {
    insights.push({
      type: "pattern",
      title: "Morning routine",
      detail: "Good morning! Would you like me to review your tasks for today?",
      priority: "medium",
    });
  } else if (hour >= 17 && hour <= 18) {
    insights.push({
      type: "pattern",
      title: "End of day",
      detail: "End of workday approaching. Want me to summarize today's progress?",
      priority: "low",
    });
  }

  return insights;
}

/**
 * Get a greeting that includes proactive context.
 */
export async function getContextualGreeting(): Promise<string> {
  const hour = new Date().getHours();
  let timeGreeting: string;

  if (hour < 12) timeGreeting = "Good morning";
  else if (hour < 17) timeGreeting = "Good afternoon";
  else if (hour < 21) timeGreeting = "Good evening";
  else timeGreeting = "Good night";

  const insights = await gatherInsights();
  const taskInsight = insights.find((i) => i.type === "task");

  if (taskInsight) {
    return `${timeGreeting}! You have ${taskInsight.detail}. What would you like to work on?`;
  }

  return `${timeGreeting}! How can I help you today?`;
}
