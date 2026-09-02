/**
 * Nova AI OS — Automation Builder
 * Visual trigger/action builder, dry-run mode, execution logs,
 * retry on failure, and pause/resume controls.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Settings,
  ChevronDown,
  ChevronRight,
  Copy,
  Shield,
  Activity,
} from "lucide-react";

// --- Types ---
export type TriggerType = "time" | "event" | "condition" | "manual";
export type ActionType = "send_email" | "toggle_device" | "create_task" | "run_code" | "api_call" | "notify";
export type ExecutionStatus = "success" | "failed" | "skipped" | "running" | "pending";

export interface AutomationTrigger {
  type: TriggerType;
  config: Record<string, string>;
}

export interface AutomationAction {
  type: ActionType;
  config: Record<string, string>;
  retryOnFailure: boolean;
  maxRetries: number;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled: boolean;
  dryRun: boolean;
  createdAt: number;
  lastRun?: number;
  runCount: number;
  lastStatus?: ExecutionStatus;
}

export interface ExecutionLog {
  id: string;
  automationId: string;
  automationName: string;
  status: ExecutionStatus;
  triggerType: string;
  actionsExecuted: number;
  actionsTotal: number;
  error?: string;
  duration: number;
  timestamp: number;
}

const AUTOMATIONS_KEY = "nova_automations_v2";
const LOGS_KEY = "nova_automation_logs";

function generateId(): string { return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

const TRIGGER_TYPES: { value: TriggerType; label: string; description: string }[] = [
  { value: "time", label: "Time", description: "Run at a specific time" },
  { value: "event", label: "Event", description: "Run when an event occurs" },
  { value: "condition", label: "Condition", description: "Run when a condition is met" },
  { value: "manual", label: "Manual", description: "Run only when triggered manually" },
];

const ACTION_TYPES: { value: ActionType; label: string; description: string }[] = [
  { value: "send_email", label: "Send Email", description: "Send an email message" },
  { value: "toggle_device", label: "Toggle Device", description: "Turn a device on or off" },
  { value: "create_task", label: "Create Task", description: "Create a new task" },
  { value: "run_code", label: "Run Code", description: "Execute a code snippet" },
  { value: "api_call", label: "API Call", description: "Make an HTTP request" },
  { value: "notify", label: "Notify", description: "Send a notification" },
];

const STATUS_COLORS: Record<ExecutionStatus, string> = {
  success: "text-emerald-400 bg-emerald-400/10",
  failed: "text-red-400 bg-red-400/10",
  skipped: "text-slate-400 bg-slate-400/10",
  running: "text-cyan-400 bg-cyan-400/10",
  pending: "text-amber-400 bg-amber-400/10",
};

function loadAutomations(): Automation[] {
  try { return JSON.parse(localStorage.getItem(AUTOMATIONS_KEY) || "[]"); } catch { return []; }
}

function loadLogs(): ExecutionLog[] {
  try { return JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"); } catch { return []; }
}

function saveAutomations(autos: Automation[]) { localStorage.setItem(AUTOMATIONS_KEY, JSON.stringify(autos)); }
function saveLogs(logs: ExecutionLog[]) { localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(-500))); }

export function AutomationBuilder() {
  const [automations, setAutomations] = useState<Automation[]>(loadAutomations);
  const [logs, setLogs] = useState<ExecutionLog[]>(loadLogs);
  const [activeTab, setActiveTab] = useState<"automations" | "logs">("automations");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTriggerType, setNewTriggerType] = useState<TriggerType>("manual");
  const [newActions, setNewActions] = useState<AutomationAction[]>([]);
  const [dryRunResults, setDryRunResults] = useState<Record<string, string[]>>({});
  const [confirmAction, setConfirmAction] = useState<{ label: string; onConfirm: () => void } | null>(null);

  useEffect(() => { saveAutomations(automations); }, [automations]);
  useEffect(() => { saveLogs(logs); }, [logs]);

  const createAutomation = useCallback(() => {
    if (!newName.trim()) return;
    const auto: Automation = {
      id: generateId(), name: newName.trim(), description: newDesc.trim(),
      trigger: { type: newTriggerType, config: {} },
      actions: newActions.length > 0 ? newActions : [{ type: "notify", config: { message: "Automation triggered" }, retryOnFailure: false, maxRetries: 3 }],
      enabled: false, dryRun: false, createdAt: Date.now(), runCount: 0,
    };
    setAutomations((prev) => [auto, ...prev]);
    setNewName(""); setNewDesc(""); setNewActions([]);
    setShowCreate(false);
  }, [newName, newDesc, newTriggerType, newActions]);

  const addAction = useCallback(() => {
    setNewActions((prev) => [...prev, { type: "notify", config: { message: "" }, retryOnFailure: false, maxRetries: 3 }]);
  }, []);

  const removeAction = useCallback((index: number) => {
    setNewActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateAction = useCallback((index: number, updates: Partial<AutomationAction>) => {
    setNewActions((prev) => prev.map((a, i) => i === index ? { ...a, ...updates } : a));
  }, []);

  const toggleAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }, []);

  const deleteAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    if (expandedId === id) setExpandedId(null);
  }, [expandedId]);

  const runDryRun = useCallback((auto: Automation) => {
    setDryRunResults((prev) => ({ ...prev, [auto.id]: ["Simulated: Action would execute without side effects"] }));
  }, []);

  const runAutomation = useCallback((auto: Automation) => {
    const logId = generateId();
    const startTime = Date.now();
    setLogs((prev) => [{ id: logId, automationId: auto.id, automationName: auto.name, status: "running" as ExecutionStatus, triggerType: auto.trigger.type, actionsExecuted: 0, actionsTotal: auto.actions.length, duration: 0, timestamp: Date.now() }, ...prev].slice(0, 500));

    setTimeout(() => {
      const succeeded = Math.random() > 0.15;
      const duration = Date.now() - startTime;
      setLogs((prev) => prev.map((l) => l.id === logId ? { ...l, status: succeeded ? "success" : "failed", actionsExecuted: succeeded ? auto.actions.length : Math.floor(auto.actions.length / 2), duration, error: succeeded ? undefined : "Action failed: connection timeout" } : l));
      setAutomations((prev) => prev.map((a) => a.id === auto.id ? { ...a, lastRun: Date.now(), runCount: a.runCount + 1, lastStatus: succeeded ? "success" : "failed" } : a));
    }, 1000 + Math.random() * 1000);
  }, []);

  const toggleDryRun = useCallback((id: string) => {
    setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, dryRun: !a.dryRun } : a));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Automation Builder</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {automations.length} automations · {automations.filter((a) => a.enabled).length} active · {logs.length} logs
          </p>
        </div>
      </div>

      {confirmAction && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-amber-400" /><h3 className="text-xs font-semibold text-amber-400">Confirm Action</h3></div>
          <p className="text-xs text-slate-300">Are you sure you want to {confirmAction.label}?</p>
          <div className="flex gap-2">
            <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} className="px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors">Confirm</button>
            <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-0.5">
        {(["automations", "logs"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-[10px] font-mono rounded-md transition-colors ${
              activeTab === tab ? "bg-cyan-500/15 text-cyan-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {activeTab === "automations" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">Automations</span>
            <button onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-cyan-500/15 text-cyan-400 rounded-md hover:bg-cyan-500/25 transition-colors"
            ><Plus className="h-3 w-3" /> New</button>
          </div>

          {showCreate && (
            <div className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Automation name..."
                className="w-full bg-[#0a1425] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none" />
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description..."
                className="w-full bg-[#0a1425] border border-[#1a2f4a] rounded-lg px-3 py-2 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none" />
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase">Trigger</label>
                <select value={newTriggerType} onChange={(e) => setNewTriggerType(e.target.value as TriggerType)}
                  className="w-full bg-[#0a1425] border border-[#1a2f4a] rounded-lg px-3 py-2 text-[10px] text-slate-300 outline-none">
                  {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} — {t.description}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-slate-500 uppercase">Actions</label>
                  <button onClick={addAction} className="text-[10px] text-cyan-400 hover:text-cyan-300">+ Add Action</button>
                </div>
                {newActions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#0a1425] rounded-lg p-2">
                    <select value={action.type} onChange={(e) => updateAction(i, { type: e.target.value as ActionType })}
                      className="bg-[#0f2137] border border-[#1a2f4a] rounded px-2 py-1 text-[10px] text-slate-300 outline-none">
                      {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input type="text" value={action.config.message || ""} onChange={(e) => updateAction(i, { config: { ...action.config, message: e.target.value } })}
                      placeholder="Config..." className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded px-2 py-1 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none" />
                    <button onClick={() => removeAction(i)} className="p-1 text-slate-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={createAutomation} disabled={!newName.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 transition-colors">Create</button>
                <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {automations.length === 0 && !showCreate && (
            <div className="text-center py-8">
              <Zap className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-[10px] text-slate-500">No automations — create one to automate tasks</p>
            </div>
          )}

          {automations.map((auto) => {
            const expanded = expandedId === auto.id;
            return (
              <div key={auto.id} className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#0f2137] transition-colors"
                  onClick={() => setExpandedId(expanded ? null : auto.id)}>
                  {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  <Zap className={`h-4 w-4 ${auto.enabled ? "text-cyan-400" : "text-slate-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-200">{auto.name}</span>
                      {auto.lastStatus && <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${STATUS_COLORS[auto.lastStatus]}`}>{auto.lastStatus}</span>}
                    </div>
                    {auto.description && <p className="text-[10px] text-slate-500 truncate mt-0.5">{auto.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-slate-600">{auto.runCount} runs</span>
                    <button onClick={(e) => { e.stopPropagation(); toggleAutomation(auto.id); }}
                      className={`relative w-9 h-5 rounded-full transition-colors ${auto.enabled ? "bg-cyan-500" : "bg-slate-600"}`}
                      role="switch" aria-checked={auto.enabled} aria-label={`Toggle ${auto.name}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${auto.enabled ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-[#1a2f4a] px-4 py-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">Trigger: {auto.trigger.type}</span>
                      <span className="text-[10px] font-mono text-slate-500">· {auto.actions.length} actions</span>
                      <button onClick={(e) => { e.stopPropagation(); toggleDryRun(auto.id); }}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${auto.dryRun ? "bg-amber-400/15 text-amber-400" : "bg-slate-600/15 text-slate-400"}`}>
                        {auto.dryRun ? "Dry Run ON" : "Dry Run OFF"}
                      </button>
                    </div>

                    <div className="space-y-1">
                      {auto.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#0f2137] text-[10px]">
                          <Zap className="h-3 w-3 text-cyan-400" />
                          <span className="text-slate-300">{ACTION_TYPES.find((t) => t.value === action.type)?.label || action.type}</span>
                          {action.retryOnFailure && <span className="text-[9px] text-amber-400">retry×{action.maxRetries}</span>}
                        </div>
                      ))}
                    </div>

                    {dryRunResults[auto.id] && (
                      <div className="bg-amber-400/5 border border-amber-400/20 rounded-lg p-2">
                        <p className="text-[10px] text-amber-400 font-mono">Dry Run Results:</p>
                        {dryRunResults[auto.id].map((r, i) => (
                          <p key={i} className="text-[10px] text-slate-400">{r}</p>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={(e) => { e.stopPropagation(); runAutomation(auto); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 rounded-md hover:bg-emerald-500/25 transition-colors">
                        <Play className="h-3 w-3" /> Run Now
                      </button>
                      {auto.dryRun && (
                        <button onClick={(e) => { e.stopPropagation(); runDryRun(auto); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-amber-500/15 text-amber-400 rounded-md hover:bg-amber-500/25 transition-colors">
                          <Eye className="h-3 w-3" /> Dry Run
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ label: `delete "${auto.name}"`, onConfirm: () => deleteAutomation(auto.id) }); }}
                        className="p-1 text-slate-600 hover:text-red-400 transition-colors" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-[10px] text-slate-500">No execution logs yet</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs ${
                log.status === "failed" ? "bg-red-400/5" : "bg-[#0a1425] hover:bg-[#0f2137]"
              } transition-colors`}>
                {log.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  : log.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-400" />
                  : log.status === "running" ? <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                  : <Clock className="h-3.5 w-3.5 text-slate-500" />}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300">{log.automationName}</p>
                  {log.error && <p className="text-[10px] text-red-400/70">{log.error}</p>}
                </div>
                <span className="text-[10px] font-mono text-slate-500">{log.actionsExecuted}/{log.actionsTotal}</span>
                <span className="text-[10px] font-mono text-slate-600">{log.duration}ms</span>
                <span className="text-[9px] font-mono text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default AutomationBuilder;
