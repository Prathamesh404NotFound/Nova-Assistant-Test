/**
 * Nova AI OS — Workflow Planner
 * Convert complex requests into visible steps with dependencies, progress states,
 * and retryable sub-tasks. Each workflow has steps that can depend on other steps,
 * show progress, and be retried on failure.
 */

import { useState, useEffect, useCallback } from "react";
import { Plus, Play, Pause, RotateCcw, CheckCircle2, Circle, XCircle, ChevronDown, ChevronRight, Trash2, Clock, GripVertical } from "lucide-react";

export interface WorkflowStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  dependsOn: string[];
  retryCount: number;
  maxRetries: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  substeps?: WorkflowStep[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "idle" | "running" | "paused" | "completed" | "failed";
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
}

const STORAGE_KEY = "nova_workflows";

function generateId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadWorkflows(): Workflow[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveWorkflows(workflows: Workflow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
}

function getStepProgress(steps: WorkflowStep[]): number {
  if (steps.length === 0) return 0;
  const completed = steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  return Math.round((completed / steps.length) * 100);
}

function getOverallStatus(steps: WorkflowStep[]): Workflow["status"] {
  if (steps.every((s) => s.status === "completed" || s.status === "skipped")) return "completed";
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.some((s) => s.status === "running")) return "running";
  return "idle";
}

function StepIcon({ status }: { status: WorkflowStep["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "running":
      return <div className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-400" />;
    case "skipped":
      return <Circle className="h-4 w-4 text-slate-600" />;
    case "pending":
    default:
      return <Circle className="h-4 w-4 text-slate-500" />;
  }
}

function StatusBadge({ status }: { status: Workflow["status"] }) {
  const styles: Record<string, string> = {
    idle: "bg-slate-500/15 text-slate-400",
    running: "bg-cyan-400/15 text-cyan-400",
    paused: "bg-amber-400/15 text-amber-400",
    completed: "bg-emerald-400/15 text-emerald-400",
    failed: "bg-red-400/15 text-red-400",
  };
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${styles[status] || styles.idle}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function WorkflowPlanner() {
  const [workflows, setWorkflows] = useState<Workflow[]>(loadWorkflows);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSteps, setNewSteps] = useState<string[]>([""]);

  useEffect(() => {
    saveWorkflows(workflows);
  }, [workflows]);

  const createWorkflow = useCallback(() => {
    if (!newName.trim()) return;
    const steps: WorkflowStep[] = newSteps
      .filter((s) => s.trim())
      .map((label, i) => ({
        id: generateId(),
        label: label.trim(),
        status: "pending" as const,
        dependsOn: i > 0 ? [] : [],
        retryCount: 0,
        maxRetries: 3,
      }));

    const workflow: Workflow = {
      id: generateId(),
      name: newName.trim(),
      description: newDescription.trim(),
      status: "idle",
      steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setWorkflows((prev) => [workflow, ...prev]);
    setNewName("");
    setNewDescription("");
    setNewSteps([""]);
    setShowCreate(false);
    setExpandedId(workflow.id);
  }, [newName, newDescription, newSteps]);

  const deleteWorkflow = useCallback((id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    if (expandedId === id) setExpandedId(null);
  }, [expandedId]);

  const toggleStep = useCallback((workflowId: string, stepId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== workflowId) return w;
        return {
          ...w,
          updatedAt: Date.now(),
          steps: w.steps.map((s) => {
            if (s.id !== stepId) return s;
            if (s.status === "pending") return { ...s, status: "running" as const, startedAt: Date.now() };
            if (s.status === "running") return { ...s, status: "completed" as const, completedAt: Date.now() };
            if (s.status === "failed" && s.retryCount < s.maxRetries)
              return { ...s, status: "running" as const, retryCount: s.retryCount + 1, error: undefined, startedAt: Date.now() };
            return { ...s, status: "pending" as const, error: undefined };
          }),
        };
      })
    );
  }, []);

  const retryStep = useCallback((workflowId: string, stepId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== workflowId) return w;
        return {
          ...w,
          updatedAt: Date.now(),
          steps: w.steps.map((s) => {
            if (s.id !== stepId || s.status !== "failed") return s;
            return { ...s, status: "running" as const, retryCount: s.retryCount + 1, error: undefined, startedAt: Date.now() };
          }),
        };
      })
    );
  }, []);

  const runWorkflow = useCallback((workflowId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== workflowId) return w;
        const resetSteps = w.steps.map((s) => ({
          ...s,
          status: "pending" as const,
          retryCount: 0,
          error: undefined,
          startedAt: undefined,
          completedAt: undefined,
        }));
        return { ...w, status: "running", steps: resetSteps, startedAt: Date.now(), updatedAt: Date.now() };
      })
    );
  }, []);

  const pauseWorkflow = useCallback((workflowId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== workflowId) return w;
        return {
          ...w,
          status: "paused",
          updatedAt: Date.now(),
          steps: w.steps.map((s) =>
            s.status === "running" ? { ...s, status: "pending" as const } : s
          ),
        };
      })
    );
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">Workflow Planner</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Workflow
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Workflow name..."
            className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          />
          <div className="space-y-2">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Steps</p>
            {newSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-600 w-4">{i + 1}.</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => {
                    const updated = [...newSteps];
                    updated[i] = e.target.value;
                    setNewSteps(updated);
                  }}
                  placeholder={`Step ${i + 1}...`}
                  className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
                />
                {i === newSteps.length - 1 && (
                  <button
                    onClick={() => setNewSteps([...newSteps, ""])}
                    className="text-slate-500 hover:text-cyan-400 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={createWorkflow}
              disabled={!newName.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workflow list */}
      {workflows.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">No workflows yet</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Create a workflow to break complex tasks into tracked steps
          </p>
        </div>
      )}

      {workflows.map((workflow) => {
        const expanded = expandedId === workflow.id;
        const progress = getStepProgress(workflow.steps);
        const completedCount = workflow.steps.filter((s) => s.status === "completed").length;
        const failedCount = workflow.steps.filter((s) => s.status === "failed").length;

        return (
          <div
            key={workflow.id}
            className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg overflow-hidden"
          >
            {/* Summary row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#0f2137] transition-colors"
              onClick={() => setExpandedId(expanded ? null : workflow.id)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {workflow.name}
                  </span>
                  <StatusBadge status={workflow.status} />
                </div>
                {workflow.description && (
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {workflow.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] font-mono text-slate-400">{progress}%</p>
                  <p className="text-[10px] text-slate-600">
                    {completedCount}/{workflow.steps.length} done
                    {failedCount > 0 && (
                      <span className="text-red-400 ml-1">{failedCount} failed</span>
                    )}
                  </p>
                </div>
                {/* Progress bar */}
                <div className="w-16 h-1.5 bg-[#1a2f4a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkflow(workflow.id);
                  }}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                  aria-label="Delete workflow"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="border-t border-[#1a2f4a] px-4 py-3 space-y-2">
                {/* Controls */}
                <div className="flex items-center gap-2 mb-3">
                  {workflow.status !== "running" && (
                    <button
                      onClick={() => runWorkflow(workflow.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 rounded-md hover:bg-emerald-500/25 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      Run
                    </button>
                  )}
                  {workflow.status === "running" && (
                    <button
                      onClick={() => pauseWorkflow(workflow.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-amber-500/15 text-amber-400 rounded-md hover:bg-amber-500/25 transition-colors"
                    >
                      <Pause className="h-3 w-3" />
                      Pause
                    </button>
                  )}
                  {workflow.startedAt && (
                    <span className="text-[10px] font-mono text-slate-600">
                      Started {new Date(workflow.startedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {/* Steps */}
                {workflow.steps.map((step, i) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#0f2137] hover:bg-[#132540] transition-colors"
                  >
                    <span className="text-[10px] font-mono text-slate-600 w-4">{i + 1}</span>
                    <StepIcon status={step.status} />
                    <span
                      className={`flex-1 text-xs ${
                        step.status === "completed"
                          ? "text-emerald-400"
                          : step.status === "failed"
                          ? "text-red-400"
                          : step.status === "running"
                          ? "text-cyan-400"
                          : "text-slate-300"
                      }`}
                    >
                      {step.label}
                    </span>
                    {step.error && (
                      <span className="text-[10px] text-red-400/70 truncate max-w-[200px]">
                        {step.error}
                      </span>
                    )}
                    {step.status === "failed" && (
                      <button
                        onClick={() => retryStep(workflow.id, step.id)}
                        className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry ({step.retryCount}/{step.maxRetries})
                      </button>
                    )}
                    {step.startedAt && step.completedAt && (
                      <span className="text-[10px] font-mono text-slate-600">
                        {((step.completedAt - step.startedAt) / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
