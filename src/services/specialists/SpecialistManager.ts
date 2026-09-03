/**
 * Nova Specialist Agents — Manager
 * Routes tasks to the appropriate specialist, enforces least-privilege,
 * and manages handoffs between specialists.
 */

import { SPECIALIST_DEFINITIONS, type SpecialistName, type HandoffRequest, type HandoffResult } from "./SpecialistTypes";
import { securityLayer } from "../security/SecurityLayer";
import { rateLimiter } from "../safety/SafetySystems";
import { loopDetector } from "../safety/SafetySystems";
import type { ToolContext, ToolResult } from "../agent/types";

// ─── Intent → Specialist Mapping ─────────────────────────────────────────────

const INTENT_SPECIALIST_MAP: Array<{ keywords: string[]; specialist: SpecialistName; priority: number }> = [
  { keywords: ["research", "investigate", "compare", "analyze", "summarize web", "what is", "latest news"], specialist: "research", priority: 10 },
  { keywords: ["search for", "find online", "look up", "google"], specialist: "research", priority: 9 },
  { keywords: ["code", "script", "program", "debug", "function", "implement", "refactor"], specialist: "coding", priority: 10 },
  { keywords: ["screenshot", "screen", "what's on my", "click", "type in", "open app", "switch to"], specialist: "computer", priority: 10 },
  { keywords: ["schedule", "meeting", "calendar", "event", "appointment", "available time"], specialist: "calendar", priority: 10 },
  { keywords: ["email", "send mail", "draft email", "reply to", "forward email", "inbox"], specialist: "communication", priority: 10 },
  { keywords: ["remember", "memory", "what do you know about", "recall", "preferences"], specialist: "memory", priority: 8 },
  { keywords: ["file", "document", "folder", "read file", "save file", "write to"], specialist: "file", priority: 9 },
  { keywords: ["automation", "workflow", "automate", "when this happens"], specialist: "automation", priority: 8 },
];

// ─── Specialist Manager ──────────────────────────────────────────────────────

class SpecialistManagerImpl {
  private activeSpecialist: SpecialistName | null = null;
  private missionSpecialists = new Map<string, SpecialistName>();
  private handoffHistory: HandoffRequest[] = [];

  /**
   * Determine the best specialist for a given user input.
   */
  classifySpecialist(userInput: string): SpecialistName {
    const lower = userInput.toLowerCase();
    let bestMatch: SpecialistName | null = null;
    let bestPriority = -1;

    for (const mapping of INTENT_SPECIALIST_MAP) {
      for (const keyword of mapping.keywords) {
        if (lower.includes(keyword) && mapping.priority > bestPriority) {
          bestMatch = mapping.specialist;
          bestPriority = mapping.priority;
        }
      }
    }

    return bestMatch || "research"; // default to research for unknown intents
  }

  /**
   * Get the specialist definition.
   */
  getSpecialist(name: SpecialistName) {
    return SPECIALIST_DEFINITIONS[name];
  }

  /**
   * Check if a tool is allowed for a given specialist.
   */
  canUseTool(specialist: SpecialistName, toolName: string): boolean {
    const def = SPECIALIST_DEFINITIONS[specialist];
    if (!def) return false;
    return def.allowedTools.includes(toolName);
  }

  /**
   * Check if a specialist has the required permission for a tool.
   */
  hasPermission(specialist: SpecialistName, toolCategory: string): boolean {
    const def = SPECIALIST_DEFINITIONS[specialist];
    if (!def) return false;
    return def.allowedCategories.includes(toolCategory as any);
  }

  /**
   * Enforce least-privilege: check tool + rate limit + loop detection before execution.
   */
  canExecute(specialist: SpecialistName, toolName: string, toolCategory: string): { allowed: boolean; reason?: string } {
    // 1. Tool permission check
    if (!this.canUseTool(specialist, toolName)) {
      return { allowed: false, reason: `Specialist '${specialist}' does not have access to tool '${toolName}'` };
    }

    // 2. Category check
    if (!this.hasPermission(specialist, toolCategory)) {
      return { allowed: false, reason: `Specialist '${specialist}' does not have access to category '${toolCategory}'` };
    }

    // 3. Rate limit
    if (!rateLimiter.check(toolCategory)) {
      return { allowed: false, reason: `Rate limit exceeded for '${toolCategory}'` };
    }

    // 4. Loop detection
    const loopKey = `${specialist}:${toolName}`;
    if (loopDetector.isLooping(loopKey)) {
      return { allowed: false, reason: `Loop detected: specialist '${specialist}' repeatedly calling '${toolName}'` };
    }

    return { allowed: true };
  }

  /**
   * Execute a handoff from one specialist to another.
   */
  async handoff(request: HandoffRequest): Promise<HandoffResult> {
    this.handoffHistory.push(request);
    if (this.handoffHistory.length > 100) {
      this.handoffHistory = this.handoffHistory.slice(-100);
    }

    const targetDef = SPECIALIST_DEFINITIONS[request.to];
    if (!targetDef) {
      return { success: false, result: `Unknown specialist: ${request.to}`, actionsExecuted: [] };
    }

    // Security check: target specialist must have the right permissions
    const permissionCheck = securityLayer.checkPermission(
      targetDef.allowedTools[0] || "memory.search",
      targetDef.allowedCategories[0] || "memory",
      request.missionId ? { missionId: request.missionId } : undefined
    );

    if (!permissionCheck.allowed) {
      const denyReason = "reason" in permissionCheck ? permissionCheck.reason : "Permission denied";
      return {
        success: false,
        result: `Permission denied for specialist '${request.to}': ${denyReason}`,
        actionsExecuted: [],
      };
    }

    this.activeSpecialist = request.to;
    if (request.missionId) {
      this.missionSpecialists.set(request.missionId, request.to);
    }

    return {
      success: true,
      result: `Handed off to ${targetDef.displayName}`,
      actionsExecuted: [],
    };
  }

  /**
   * Get the active specialist for a mission.
   */
  getMissionSpecialist(missionId: string): SpecialistName | undefined {
    return this.missionSpecialists.get(missionId);
  }

  /**
   * Clear mission specialist assignment.
   */
  clearMissionSpecialist(missionId: string): void {
    this.missionSpecialists.delete(missionId);
  }

  /**
   * Get recent handoff history (for diagnostics).
   */
  getHandoffHistory(limit = 20): HandoffRequest[] {
    return this.handoffHistory.slice(-limit).reverse();
  }

  /**
   * Get all specialists summary for UI display.
   */
  getSpecialistSummary(): Array<{ name: SpecialistName; displayName: string; description: string; toolCount: number; maxRisk: string }> {
    return Object.values(SPECIALIST_DEFINITIONS).map((s) => ({
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      toolCount: s.allowedTools.length,
      maxRisk: s.maxRiskWithoutConfirmation,
    }));
  }
}

export const specialistManager = new SpecialistManagerImpl();
