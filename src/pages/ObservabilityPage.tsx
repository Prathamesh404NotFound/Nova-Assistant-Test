/**
 * Nova AI OS — Observability Dashboard
 * Track request latency, tool calls, failures, model selection,
 * token usage, and user-visible audit history.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Cpu,
  Database,
  Cloud,
} from "lucide-react";

export interface ObsEntry {
  id: string;
  type: "request" | "tool_call" | "cache_hit" | "cache_miss" | "error" | "model_switch";
  model?: string;
  action?: string;
  latencyMs: number;
  tokens?: number;
  status: "success" | "failure" | "timeout";
  timestamp: number;
  details?: string;
}

const STORAGE_KEY = "nova_observability";

function generateId(): string {
  return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadEntries(): ObsEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEntries(entries: ObsEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatMs(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// Seed some demo data if empty
function seedDemoData(): ObsEntry[] {
  const now = Date.now();
  const models = ["gemini-2.5-flash", "Qwen3-0.6B", "gemini-2.0-flash"];
  const actions = ["chat", "classify", "summarize", "translate", "analyze"];
  const entries: ObsEntry[] = [];

  for (let i = 0; i < 50; i++) {
    const latency = Math.floor(Math.random() * 800) + 50;
    const type = Math.random() > 0.8 ? "error" : Math.random() > 0.5 ? "tool_call" : "request";
    entries.push({
      id: generateId(),
      type: type as ObsEntry["type"],
      model: models[Math.floor(Math.random() * models.length)],
      action: actions[Math.floor(Math.random() * actions.length)],
      latencyMs: latency,
      tokens: Math.floor(Math.random() * 500) + 10,
      status: type === "error" ? "failure" : "success",
      timestamp: now - Math.floor(Math.random() * 3600000),
    });
  }
  return entries;
}

export function ObservabilityDashboard() {
  const [entries, setEntries] = useState<ObsEntry[]>(() => {
    const loaded = loadEntries();
    if (loaded.length === 0) {
      const demo = seedDemoData();
      saveEntries(demo);
      return demo;
    }
    return loaded;
  });
  const [filter, setFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "all">("1h");

  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      timeRange === "1h"
        ? now - 3600000
        : timeRange === "6h"
        ? now - 21600000
        : timeRange === "24h"
        ? now - 86400000
        : 0;

    return entries.filter((e) => {
      if (e.timestamp < cutoff) return false;
      if (filter === "all") return true;
      if (filter === "errors") return e.status === "failure";
      if (filter === "slow") return e.latencyMs > 500;
      return e.type === filter;
    });
  }, [entries, filter, timeRange]);

  const stats = useMemo(() => {
    const latencies = filtered.map((e) => e.latencyMs);
    const totalTokens = filtered.reduce((sum, e) => sum + (e.tokens || 0), 0);
    const errors = filtered.filter((e) => e.status === "failure").length;
    const success = filtered.filter((e) => e.status === "success").length;
    const cacheHits = filtered.filter((e) => e.type === "cache_hit").length;

    // Model breakdown
    const modelCounts: Record<string, number> = {};
    filtered.forEach((e) => {
      if (e.model) modelCounts[e.model] = (modelCounts[e.model] || 0) + 1;
    });

    return {
      total: filtered.length,
      avgLatency: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      totalTokens,
      errors,
      success,
      cacheHits,
      errorRate: filtered.length ? (errors / filtered.length) * 100 : 0,
      modelCounts,
    };
  }, [filtered]);

  const clearHistory = useCallback(() => {
    setEntries([]);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Observability</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {entries.length} total entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearHistory}
            className="px-2 py-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-mono text-slate-500 uppercase">Avg Latency</span>
          </div>
          <p className="text-xl font-bold text-slate-200 font-mono">
            {formatMs(stats.avgLatency)}
          </p>
          <div className="flex gap-2 mt-1">
            <span className="text-[9px] font-mono text-slate-600">p50 {formatMs(stats.p50)}</span>
            <span className="text-[9px] font-mono text-slate-600">p95 {formatMs(stats.p95)}</span>
          </div>
        </div>

        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-mono text-slate-500 uppercase">Requests</span>
          </div>
          <p className="text-xl font-bold text-slate-200 font-mono">{stats.total}</p>
          <p className="text-[9px] font-mono text-slate-600 mt-1">
            {stats.cacheHits} cache hits
          </p>
        </div>

        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] font-mono text-slate-500 uppercase">Error Rate</span>
          </div>
          <p
            className={`text-xl font-bold font-mono ${
              stats.errorRate > 10 ? "text-red-400" : stats.errorRate > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {stats.errorRate.toFixed(1)}%
          </p>
          <p className="text-[9px] font-mono text-slate-600 mt-1">
            {stats.errors} errors / {stats.success} success
          </p>
        </div>

        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[10px] font-mono text-slate-500 uppercase">Tokens</span>
          </div>
          <p className="text-xl font-bold text-slate-200 font-mono">
            {stats.totalTokens.toLocaleString()}
          </p>
          <p className="text-[9px] font-mono text-slate-600 mt-1">
            ~{Math.round(stats.totalTokens / Math.max(filtered.length, 1))} avg/req
          </p>
        </div>
      </div>

      {/* Model breakdown */}
      {Object.keys(stats.modelCounts).length > 0 && (
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
            Model Usage
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.modelCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([model, count]) => (
                <div
                  key={model}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-[#0f2137] rounded-md"
                >
                  {model.includes("gemini") ? (
                    <Cloud className="h-3 w-3 text-cyan-400" />
                  ) : model.includes("Qwen") ? (
                    <Cpu className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Database className="h-3 w-3 text-purple-400" />
                  )}
                  <span className="text-[10px] font-mono text-slate-300">{model}</span>
                  <span className="text-[10px] font-mono text-slate-500">×{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-0.5">
          {(["1h", "6h", "24h", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-2 py-1 text-[10px] font-mono rounded-md transition-colors ${
                timeRange === t
                  ? "bg-cyan-500/15 text-cyan-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-0.5">
          {["all", "request", "tool_call", "errors", "slow"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-[10px] font-mono rounded-md transition-colors ${
                filter === f
                  ? "bg-cyan-500/15 text-cyan-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {f === "tool_call" ? "tools" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Log entries */}
      <div className="space-y-1 max-h-[500px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <Activity className="h-6 w-6 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No entries for this filter</p>
          </div>
        )}
        {filtered
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 100)
          .map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs ${
                entry.status === "failure"
                  ? "bg-red-400/5 hover:bg-red-400/10"
                  : "bg-[#0a1425] hover:bg-[#0f2137]"
              } transition-colors`}
            >
              {entry.status === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : entry.status === "failure" ? (
                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
              <span className="text-slate-300 truncate">{entry.action || entry.type}</span>
              {entry.model && (
                <span className="text-[10px] font-mono text-slate-500 shrink-0">{entry.model}</span>
              )}
              <span
                className={`font-mono text-[10px] shrink-0 ${
                  entry.latencyMs > 500 ? "text-amber-400" : entry.latencyMs > 1000 ? "text-red-400" : "text-slate-500"
                }`}
              >
                {formatMs(entry.latencyMs)}
              </span>
              {entry.tokens && (
                <span className="text-[10px] font-mono text-slate-600 shrink-0">
                  {entry.tokens}tok
                </span>
              )}
              <span className="text-[9px] font-mono text-slate-600 shrink-0 ml-auto">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default ObservabilityDashboard;
