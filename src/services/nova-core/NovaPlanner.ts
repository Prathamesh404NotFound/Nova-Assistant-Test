/**
 * Nova Core — planner.
 * Simple requests are answered immediately; multi-step requests get an
 * explicit, observable plan. Steps are executed by NovaToolExecutor.
 */

import type { NovaPlan, PlanStep, NovaTaskClass } from "./NovaTypes";
import { novaEventBus } from "./NovaEventBus";

function makeStep(index: number, description: string, tool?: string): PlanStep {
  return { index, description, tool, status: "pending" };
}

class NovaPlanner {
  private plans = new Map<string, NovaPlan>();

  /**
   * Build a plan. For simple tasks returns a single "answer" step which the
   * Core executes inline without ceremony.
   */
  createPlan(goal: string, taskClass: NovaTaskClass, requestId: string): NovaPlan | null {
    if (taskClass === "simple_answer" || taskClass === "conversation") return null;

    const steps: PlanStep[] = [];

    if (taskClass === "reasoning") {
      steps.push(makeStep(0, "Reason about the request", "ai"));
      steps.push(makeStep(1, "Synthesize the answer", "ai"));
    } else {
      // tool_action / multi_step: detect the requested verbs
      const lower = goal.toLowerCase();
      const wantsSearch = /\b(find|what|when|which|search|list|show|brief)\b/.test(lower);
      const wantsContext = /\b(brief|summar|prepare|report|about)\b/.test(lower);
      const wantsCreate = /\b(create|schedule|add|send|compose|make)\b/.test(lower);

      if (wantsSearch) steps.push(makeStep(steps.length, "Locate the requested information", "query"));
      if (wantsContext) steps.push(makeStep(steps.length, "Collect relevant context", "memory.search"));
      if (wantsCreate) steps.push(makeStep(steps.length, "Perform the requested action", "action"));
      if (steps.length === 0) steps.push(makeStep(0, "Perform the requested action", "action"));
      steps.push(makeStep(steps.length, "Summarize the result", "ai"));
    }

    const plan: NovaPlan = {
      id: `${requestId}-plan`,
      goal,
      steps,
      createdAt: Date.now(),
    };
    this.plans.set(plan.id, plan);
    return plan;
  }

  markStep(planId: string, index: number, status: PlanStep["status"], result?: unknown, error?: string): void {
    const plan = this.plans.get(planId);
    if (!plan) return;
    const step = plan.steps[index];
    if (!step) return;
    step.status = status;
    if (result !== undefined) step.result = result;
    if (error !== undefined) step.error = error;
    if (status === "running") {
      novaEventBus.emit("tool.started", { requestId: planId, tool: step.tool ?? "plan" });
    }
  }

  getPlan(planId: string): NovaPlan | undefined {
    return this.plans.get(planId);
  }

  /** Forget plans older than 5 minutes to avoid unbounded growth. */
  prune(): void {
    const cutoff = Date.now() - 5 * 60_000;
    for (const [id, plan] of this.plans) {
      if (plan.createdAt < cutoff) this.plans.delete(id);
    }
  }

  formatPlanForDisplay(plan: NovaPlan): string {
    const lines = plan.steps.map(
      (s, i) => `${i + 1}. ${s.description} — ${s.status}`
    );
    return lines.join("\n");
  }
}

export const novaPlanner = new NovaPlanner();
