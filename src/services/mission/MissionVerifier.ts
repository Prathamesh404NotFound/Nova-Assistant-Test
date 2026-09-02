/**
 * Nova Mission Engine — Verifier
 * Inspects actual system state to confirm that a step truly succeeded.
 * Does NOT trust the model's claim of success — checks real data.
 */

import { toolRegistry } from "@/services/agent/ToolRegistry";
import { toolExecutor } from "@/services/agent/ToolExecutor";
import type { MissionStep, VerificationResult, ToolContext } from "./MissionTypes";

// ─── Verification Rules ──────────────────────────────────────────────────────

interface VerificationRule {
  /** Tool name this rule applies to */
  tool: string;
  /** Verification description */
  method: string;
  /** Function that verifies the step succeeded by checking system state */
  verify: (step: MissionStep, context: ToolContext) => Promise<VerificationResult>;
}

const VERIFICATION_RULES: VerificationRule[] = [
  // Calendar: after creating an event, verify it appears in the calendar list
  {
    tool: "calendar.create",
    method: "calendar.list",
    verify: async (step, context) => {
      const title = step.args.title as string;
      const date = step.args.date as string;

      const result = await toolExecutor.execute(
        "calendar.list",
        { startDate: date, endDate: date },
        context,
        { skipConfirmation: true, source: "system" }
      );

      if (!result.success || !Array.isArray(result.data)) {
        return {
          verified: false,
          method: "calendar.list",
          evidence: "Could not query calendar",
          discrepancy: "Calendar query failed",
        };
      }

      const found = result.data.some(
        (e: any) =>
          e.title?.toLowerCase().includes(title?.toLowerCase()) ||
          title?.toLowerCase().includes(e.title?.toLowerCase())
      );

      return {
        verified: found,
        method: "calendar.list",
        evidence: found
          ? `Event "${title}" found in calendar for ${date}`
          : `Event "${title}" NOT found in calendar for ${date}`,
        discrepancy: found ? undefined : `Expected event "${title}" on ${date} but it was not found`,
      };
    },
  },

  // Memory: after saving, verify it appears in memory search
  {
    tool: "memory.save",
    method: "memory.search",
    verify: async (step, context) => {
      const content = (step.args.content as string) || "";
      const searchTerms = content.split(" ").slice(0, 3).join(" ");

      const result = await toolExecutor.execute(
        "memory.search",
        { query: searchTerms },
        context,
        { skipConfirmation: true, source: "system" }
      );

      if (!result.success || !Array.isArray(result.data)) {
        return {
          verified: false,
          method: "memory.search",
          evidence: "Could not query memories",
          discrepancy: "Memory search failed",
        };
      }

      const found = result.data.some(
        (m: any) =>
          m.content?.toLowerCase().includes(content.toLowerCase().slice(0, 30))
      );

      return {
        verified: found,
        method: "memory.search",
        evidence: found
          ? `Memory containing "${content.slice(0, 40)}" found`
          : `Memory containing "${content.slice(0, 40)}" NOT found`,
        discrepancy: found ? undefined : "Saved memory not found in search results",
      };
    },
  },

  // Task: after creating a task, verify it appears in task list
  {
    tool: "task.create",
    method: "task.list",
    verify: async (step, context) => {
      const title = step.args.title as string;

      const result = await toolExecutor.execute(
        "task.list",
        {},
        context,
        { skipConfirmation: true, source: "system" }
      );

      if (!result.success || !Array.isArray(result.data)) {
        return {
          verified: false,
          method: "task.list",
          evidence: "Could not query tasks",
          discrepancy: "Task list query failed",
        };
      }

      const found = result.data.some(
        (t: any) =>
          t.title?.toLowerCase().includes(title?.toLowerCase()) ||
          title?.toLowerCase().includes(t.title?.toLowerCase())
      );

      return {
        verified: found,
        method: "task.list",
        evidence: found
          ? `Task "${title}" found in task list`
          : `Task "${title}" NOT found in task list`,
        discrepancy: found ? undefined : `Expected task "${title}" but it was not found`,
      };
    },
  },

  // Email: after drafting, verify it appears in draft list
  {
    tool: "email.draft",
    method: "email.list",
    verify: async (step, context) => {
      const to = step.args.to as string;
      const subject = step.args.subject as string;

      const result = await toolExecutor.execute(
        "email.list",
        {},
        context,
        { skipConfirmation: true, source: "system" }
      );

      if (!result.success || !Array.isArray(result.data)) {
        return {
          verified: false,
          method: "email.list",
          evidence: "Could not query email drafts",
          discrepancy: "Email list query failed",
        };
      }

      const found = result.data.some(
        (d: any) =>
          d.to?.toLowerCase() === to?.toLowerCase() &&
          d.subject?.toLowerCase().includes(subject?.toLowerCase())
      );

      return {
        verified: found,
        method: "email.list",
        evidence: found
          ? `Email draft to ${to} with subject "${subject}" found`
          : `Email draft to ${to} NOT found`,
        discrepancy: found ? undefined : "Draft email not found in draft list",
      };
    },
  },
];

// ─── Verification Engine ─────────────────────────────────────────────────────

/**
 * Verify a completed step by inspecting actual system state.
 * Returns a VerificationResult indicating whether the step truly succeeded.
 */
export async function verifyStep(
  step: MissionStep,
  context: ToolContext
): Promise<VerificationResult> {
  // Find a matching verification rule
  const rule = VERIFICATION_RULES.find((r) => r.tool === step.tool);

  if (!rule) {
    // No specific verification rule — trust the tool result
    return {
      verified: step.result?.success ?? false,
      method: "result-check",
      evidence: step.result?.success
        ? `Tool ${step.tool} reported success: ${step.result?.message || "no message"}`
        : `Tool ${step.tool} reported failure: ${step.result?.error || "no error details"}`,
      discrepancy: step.result?.success ? undefined : "Tool reported failure",
    };
  }

  // Run the verification
  try {
    return await rule.verify(step, context);
  } catch (err) {
    return {
      verified: false,
      method: rule.method,
      evidence: "Verification threw an error",
      discrepancy: err instanceof Error ? err.message : "Unknown verification error",
    };
  }
}
