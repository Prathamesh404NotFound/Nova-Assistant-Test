/**
 * Nova AI OS — Command Palette + Universal Search
 * Cmd+K opens a searchable command palette with instant navigation and data search.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  CheckSquare,
  Brain,
  Calendar,
  Mail,
  Settings,
  Shield,
  Activity,
  Smartphone,
  Globe,
  Code,
  Home,
  Files,
  Zap,
  Bot,
  Search,
  X,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon: typeof MessageSquare;
  path: string;
  keywords: string[];
  category: "page";
}

interface DataResult {
  id: string;
  type: "task" | "memory" | "event" | "file" | "activity";
  title: string;
  subtitle: string;
  route: string;
}

const commands: Command[] = [
  { id: "dashboard", label: "Dashboard", icon: Home, path: "/dashboard", keywords: ["home", "main", "start"], category: "page" },
  { id: "chat", label: "Chat", icon: MessageSquare, path: "/chat", keywords: ["talk", "ai", "assistant", "conversation"], category: "page" },
  { id: "tasks", label: "Tasks", icon: CheckSquare, path: "/tasks", keywords: ["todo", "checklist", "work"], category: "page" },
  { id: "memory", label: "Memory", icon: Brain, path: "/memory", keywords: ["remember", "notes", "info"], category: "page" },
  { id: "calendar", label: "Calendar", icon: Calendar, path: "/calendar", keywords: ["events", "schedule", "date"], category: "page" },
  { id: "email", label: "Email", icon: Mail, path: "/email", keywords: ["mail", "inbox", "messages"], category: "page" },
  { id: "messages", label: "Messages", icon: MessageSquare, path: "/messages", keywords: ["sms", "text", "chat"], category: "page" },
  { id: "agents", label: "Agents", icon: Bot, path: "/agents", keywords: ["ai", "bots", "automate"], category: "page" },
  { id: "devices", label: "Devices", icon: Smartphone, path: "/devices", keywords: ["phone", "tablet", "desktop"], category: "page" },
  { id: "browser", label: "Browser", icon: Globe, path: "/browser", keywords: ["web", "search", "internet"], category: "page" },
  { id: "coding", label: "Coding", icon: Code, path: "/coding", keywords: ["code", "programming", "dev"], category: "page" },
  { id: "smart-home", label: "Smart Home", icon: Home, path: "/smart-home", keywords: ["lights", "thermostat", "iot"], category: "page" },
  { id: "files", label: "Files", icon: Files, path: "/files", keywords: ["documents", "upload", "storage"], category: "page" },
  { id: "automations", label: "Automations", icon: Zap, path: "/automations", keywords: ["workflow", "rules", "auto"], category: "page" },
  { id: "activity", label: "Activity", icon: Activity, path: "/activity", keywords: ["log", "history", "timeline"], category: "page" },
  { id: "security", label: "Security", icon: Shield, path: "/security", keywords: ["privacy", "protection", "safe"], category: "page" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings", keywords: ["config", "preferences", "options"], category: "page" },
];

function searchData(query: string): DataResult[] {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const results: DataResult[] = [];

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
          subtitle: t.description?.slice(0, 60) || "",
          route: "/tasks",
        });
      }
    }
  } catch { /* ignore */ }

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
        });
      }
    }
  } catch { /* ignore */ }

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
          subtitle: e.date || "",
          route: "/calendar",
        });
      }
    }
  } catch { /* ignore */ }

  try {
    const files = JSON.parse(localStorage.getItem("nova_files") || "[]");
    for (const f of files) {
      if (f.name && f.name.toLowerCase().includes(lower)) {
        results.push({
          id: `file-${f.id}`,
          type: "file",
          title: f.name,
          subtitle: f.type || "",
          route: "/files",
        });
      }
    }
  } catch { /* ignore */ }

  try {
    const activity = JSON.parse(localStorage.getItem("nova_activity") || "[]");
    for (const a of activity) {
      if (a.description && a.description.toLowerCase().includes(lower)) {
        results.push({
          id: `activity-${a.id}`,
          type: "activity",
          title: a.description,
          subtitle: a.type || "",
          route: "/activity",
        });
      }
    }
  } catch { /* ignore */ }

  return results.slice(0, 10);
}

function dataTypeIcon(type: DataResult["type"]) {
  switch (type) {
    case "task": return CheckSquare;
    case "memory": return Brain;
    case "event": return Calendar;
    case "file": return Files;
    case "activity": return Activity;
  }
}

function dataTypeColor(type: DataResult["type"]): string {
  switch (type) {
    case "task": return "text-emerald-400";
    case "memory": return "text-pink-400";
    case "event": return "text-amber-400";
    case "file": return "text-purple-400";
    case "activity": return "text-blue-400";
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.keywords.some((kw) => kw.includes(lower))
    );
  }, [query]);

  const dataResults = useMemo(() => searchData(query), [query]);

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
      setQuery("");
    },
    [navigate]
  );

  const hasResults = filteredCommands.length > 0 || dataResults.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 bg-[#0b1929] border-[#1a2f4a] max-w-lg">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a2f4a]">
          <Search className="h-4 w-4 text-cyan-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, tasks, memories, files..."
            className="border-0 bg-transparent text-slate-200 placeholder:text-slate-500 focus-visible:ring-0"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-500 hover:text-slate-300">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="text-[10px] text-slate-600 bg-[#0a1425] px-1.5 py-0.5 rounded border border-[#1a2f4a]">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {!hasResults && query && (
            <p className="text-center text-slate-500 text-sm py-4">
              No results for "{query}"
            </p>
          )}

          {/* Pages section */}
          {filteredCommands.length > 0 && (
            <div className="mb-2">
              {!query && (
                <p className="text-[10px] font-mono text-slate-600 px-3 py-1 uppercase tracking-wider">
                  Pages
                </p>
              )}
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(cmd.path)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-[#0f2137] transition-colors text-left"
                >
                  <cmd.icon className="h-4 w-4 text-slate-500" />
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Data results section */}
          {dataResults.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-slate-600 px-3 py-1 uppercase tracking-wider border-t border-[#1a2f4a]/50 pt-2">
                Data
              </p>
              {dataResults.map((result) => {
                const Icon = dataTypeIcon(result.type);
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result.route)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-[#0f2137] transition-colors text-left"
                  >
                    <Icon className={`h-4 w-4 ${dataTypeColor(result.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">
                        {result.title}
                      </p>
                      {result.subtitle && (
                        <p className="text-[10px] text-slate-500 truncate">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-mono ${dataTypeColor(result.type)}`}>
                      {result.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
