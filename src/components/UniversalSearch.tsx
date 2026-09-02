/**
 * Nova AI OS — Universal Search
 * Searches across all data types: conversations, tasks, events, files, memories, activity.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, MessageSquare, CheckSquare, Calendar, FileText, Brain, Activity } from "lucide-react";

interface SearchResult {
  id: string;
  type: "conversation" | "task" | "event" | "file" | "memory" | "activity";
  title: string;
  subtitle: string;
  route: string;
  timestamp: number;
}

function getIcon(type: SearchResult["type"]) {
  switch (type) {
    case "conversation":
      return MessageSquare;
    case "task":
      return CheckSquare;
    case "event":
      return Calendar;
    case "file":
      return FileText;
    case "memory":
      return Brain;
    case "activity":
      return Activity;
  }
}

function getTypeColor(type: SearchResult["type"]): string {
  switch (type) {
    case "conversation":
      return "text-cyan-400 bg-cyan-400/10";
    case "task":
      return "text-emerald-400 bg-emerald-400/10";
    case "event":
      return "text-amber-400 bg-amber-400/10";
    case "file":
      return "text-purple-400 bg-purple-400/10";
    case "memory":
      return "text-pink-400 bg-pink-400/10";
    case "activity":
      return "text-blue-400 bg-blue-400/10";
  }
}

function searchAllData(query: string): SearchResult[] {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const results: SearchResult[] = [];

  // Search tasks
  try {
    const tasks = JSON.parse(localStorage.getItem("nova_tasks") || "[]");
    for (const t of tasks) {
      if (
        (t.title && t.title.toLowerCase().includes(lower)) ||
        (t.description && t.description.toLowerCase().includes(lower))
      ) {
        results.push({
          id: `task-${t.id}`,
          type: "task",
          title: t.title,
          subtitle: t.description?.slice(0, 80) || "No description",
          route: "/tasks",
          timestamp: t.createdAt || Date.now(),
        });
      }
    }
  } catch { /* ignore */ }

  // Search memories
  try {
    const memories = JSON.parse(localStorage.getItem("nova_memories") || "[]");
    for (const m of memories) {
      if (
        (m.content && m.content.toLowerCase().includes(lower)) ||
        (m.category && m.category.toLowerCase().includes(lower))
      ) {
        results.push({
          id: `memory-${m.id}`,
          type: "memory",
          title: m.content?.slice(0, 60) || "Memory",
          subtitle: m.category || "General",
          route: "/memory",
          timestamp: m.createdAt || Date.now(),
        });
      }
    }
  } catch { /* ignore */ }

  // Search calendar events
  try {
    const events = JSON.parse(localStorage.getItem("nova_events") || "[]");
    for (const e of events) {
      if (
        (e.title && e.title.toLowerCase().includes(lower)) ||
        (e.description && e.description.toLowerCase().includes(lower))
      ) {
        results.push({
          id: `event-${e.id}`,
          type: "event",
          title: e.title,
          subtitle: e.date || "No date",
          route: "/calendar",
          timestamp: e.createdAt || Date.now(),
        });
      }
    }
  } catch { /* ignore */ }

  // Search files
  try {
    const files = JSON.parse(localStorage.getItem("nova_files") || "[]");
    for (const f of files) {
      if (f.name && f.name.toLowerCase().includes(lower)) {
        results.push({
          id: `file-${f.id}`,
          type: "file",
          title: f.name,
          subtitle: f.type || "Unknown type",
          route: "/files",
          timestamp: f.createdAt || Date.now(),
        });
      }
    }
  } catch { /* ignore */ }

  // Search activity
  try {
    const activity = JSON.parse(localStorage.getItem("nova_activity") || "[]");
    for (const a of activity) {
      if (a.description && a.description.toLowerCase().includes(lower)) {
        results.push({
          id: `activity-${a.id}`,
          type: "activity",
          title: a.description,
          subtitle: a.type || "Activity",
          route: "/activity",
          timestamp: a.timestamp || Date.now(),
        });
      }
    }
  } catch { /* ignore */ }

  // Sort by relevance (timestamp desc)
  results.sort((a, b) => b.timestamp - a.timestamp);
  return results.slice(0, 20);
}

interface UniversalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function UniversalSearch({ open, onClose }: UniversalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setResults(searchAllData(query));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const handleNavigate = useCallback(
    (result: SearchResult) => {
      window.location.assign(result.route);
      onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Search panel */}
      <div className="relative w-full max-w-lg mx-4 bg-[#0b1929] border border-[#1a2f4a] rounded-xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a2f4a]">
          <Search className="h-4 w-4 text-cyan-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, memories, files, events, activity..."
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="text-[10px] font-mono text-slate-600 bg-[#0a1425] px-1.5 py-0.5 rounded border border-[#1a2f4a]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No results for "{query}"</p>
              <p className="text-[10px] text-slate-600 mt-1">
                Try searching tasks, memories, files, events, or activity
              </p>
            </div>
          )}

          {results.map((result) => {
            const Icon = getIcon(result.type);
            return (
              <button
                key={result.id}
                onClick={() => handleNavigate(result)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#0f2137] transition-colors text-left"
              >
                <div className={`p-1.5 rounded-md ${getTypeColor(result.type)}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{result.title}</p>
                  <p className="text-[10px] text-slate-500 truncate">{result.subtitle}</p>
                </div>
                <span className={`text-[10px] font-mono ${getTypeColor(result.type)}`}>
                  {result.type}
                </span>
              </button>
            );
          })}

          {!query && (
            <div className="px-4 py-6 text-center">
              <p className="text-[10px] text-slate-500">
                Type to search across all your data
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
