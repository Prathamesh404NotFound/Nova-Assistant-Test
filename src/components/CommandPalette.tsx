/**
 * Nova AI OS — Command Palette
 * Cmd+K opens a searchable command palette for instant navigation.
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
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon: typeof MessageSquare;
  path: string;
  keywords: string[];
}

const commands: Command[] = [
  { id: "dashboard", label: "Dashboard", icon: Home, path: "/dashboard", keywords: ["home", "main", "start"] },
  { id: "chat", label: "Chat", icon: MessageSquare, path: "/chat", keywords: ["talk", "ai", "assistant", "conversation"] },
  { id: "tasks", label: "Tasks", icon: CheckSquare, path: "/tasks", keywords: ["todo", "checklist", "work"] },
  { id: "memory", label: "Memory", icon: Brain, path: "/memory", keywords: ["remember", "notes", "info"] },
  { id: "calendar", label: "Calendar", icon: Calendar, path: "/calendar", keywords: ["events", "schedule", "date"] },
  { id: "email", label: "Email", icon: Mail, path: "/email", keywords: ["mail", "inbox", "messages"] },
  { id: "messages", label: "Messages", icon: MessageSquare, path: "/messages", keywords: ["sms", "text", "chat"] },
  { id: "agents", label: "Agents", icon: Bot, path: "/agents", keywords: ["ai", "bots", "automate"] },
  { id: "devices", label: "Devices", icon: Smartphone, path: "/devices", keywords: ["phone", "tablet", "desktop"] },
  { id: "browser", label: "Browser", icon: Globe, path: "/browser", keywords: ["web", "search", "internet"] },
  { id: "coding", label: "Coding", icon: Code, path: "/coding", keywords: ["code", "programming", "dev"] },
  { id: "smart-home", label: "Smart Home", icon: Home, path: "/smart-home", keywords: ["lights", "thermostat", "iot"] },
  { id: "files", label: "Files", icon: Files, path: "/files", keywords: ["documents", "upload", "storage"] },
  { id: "automations", label: "Automations", icon: Zap, path: "/automations", keywords: ["workflow", "rules", "auto"] },
  { id: "activity", label: "Activity", icon: Activity, path: "/activity", keywords: ["log", "history", "timeline"] },
  { id: "security", label: "Security", icon: Shield, path: "/security", keywords: ["privacy", "protection", "safe"] },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings", keywords: ["config", "preferences", "options"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Listen for Cmd+K
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

  const filtered = useMemo(() => {
    if (!query) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.keywords.some((kw) => kw.includes(lower))
    );
  }, [query]);

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
      setQuery("");
    },
    [navigate]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 bg-[#0d0d16] border-[#252540] max-w-md">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#252540]">
          <Search className="h-4 w-4 text-[#6e6e8a]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="border-0 bg-transparent text-[#e8e8f8] placeholder:text-[#6e6e8a] focus-visible:ring-0"
            autoFocus
          />
          <kbd className="text-[10px] text-[#6e6e8a] bg-[#16162a] px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-[#6e6e8a] text-sm py-4">No commands found</p>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => handleSelect(cmd.path)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#e8e8f8] hover:bg-[#1e1e38] transition-colors text-left"
              >
                <cmd.icon className="h-4 w-4 text-[#6e6e8a]" />
                <span>{cmd.label}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
