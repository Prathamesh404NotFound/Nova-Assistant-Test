import { NavLink } from "react-router";
import { useState, useEffect, useCallback } from "react";
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
  Puzzle,
  Mic,
  LayoutDashboard,
  GitBranch,
  Search,
  Wifi,
  WifiOff,
  ChevronDown,
  FolderOpen,
  Users,
  BookOpen,
  Terminal,
  Store,
  Mic2,
  CalendarRange,
  BarChart3,
  Download,
  UserCog,
  Wrench,
  ScanFace,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfigStatus } from "@/components/ConfigStatus";
import { useTheme } from "@/hooks/use-theme";
import { useDashboardData } from "@/hooks/use-dashboard-data";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

interface NavCategory {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "converse",
    label: "CONVERSE",
    items: [
      { to: "/chat", icon: MessageSquare, label: "Chat" },
      { to: "/messages", icon: MessageSquare, label: "Conversations" },
      { to: "/voice-experience", icon: Mic2, label: "Voice" },
    ],
  },
  {
    id: "organize",
    label: "ORGANIZE",
    items: [
      { to: "/tasks", icon: CheckSquare, label: "Tasks" },
      { to: "/calendar", icon: Calendar, label: "Calendar" },
      { to: "/email", icon: Mail, label: "Email" },
      { to: "/files", icon: Files, label: "Files" },
    ],
  },
  {
    id: "intelligence",
    label: "INTELLIGENCE",
    items: [
      { to: "/memory", icon: Brain, label: "Memory" },
      { to: "/agents", icon: Bot, label: "Agents" },
      { to: "/browser-research", icon: BookOpen, label: "Research" },
      { to: "/coding", icon: Code, label: "Coding" },
      { to: "/workflows", icon: GitBranch, label: "Workflows" },
    ],
  },
  {
    id: "automate",
    label: "AUTOMATE",
    items: [
      { to: "/automations", icon: Zap, label: "Automations" },
      { to: "/devices", icon: Smartphone, label: "Devices" },
      { to: "/vision", icon: ScanFace, label: "Vision" },
    ],
  },
  {
    id: "tools",
    label: "TOOLS",
    items: [
      { to: "/browser", icon: Globe, label: "Browser" },
      { to: "/plugins", icon: Puzzle, label: "Skills & Integrations" },
    ],
  },
];

const CATEGORY_STATE_KEY = "nova_sidebar_categories";

function loadCategoryState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CATEGORY_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // Default: first category open, rest collapsed
  return { converse: true, organize: false, intelligence: false, automate: false, tools: false };
}

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  const { counts } = useDashboardData();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(loadCategoryState);

  const toggleCategory = useCallback((id: string) => {
    setOpenCategories((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(CATEGORY_STATE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Apply badge counts to items
  const badgeMap: Record<string, number | undefined> = {
    "/chat": counts.conversations || undefined,
    "/tasks": counts.tasks || undefined,
    "/calendar": counts.calendarEvents || undefined,
    "/email": counts.emailDrafts || undefined,
    "/files": counts.files || undefined,
    "/automations": counts.automations || undefined,

    "/activity": counts.activities || undefined,
  };

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-nova-border bg-[#081422]/95 backdrop-blur-xl z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-nova-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#0ea5e9] flex items-center justify-center shadow-lg shadow-[#00d4ff]/20">
          <span className="text-[#060e1a] font-black text-sm tracking-tight">N</span>
        </div>
        <div>
          <h1 className="text-sm font-bold text-[#e0ecf5] tracking-tight">NOVA</h1>
          <p className="text-[9px] text-[#5a7a9a] uppercase tracking-[0.15em] font-medium">AI Operating System</p>
        </div>
      </div>

      {/* Command Center link (always visible) */}
      <div className="px-3 pt-3">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-200",
              isActive
                ? "bg-[#00d4ff]/10 text-[#00d4ff] font-medium border border-[#00d4ff]/20"
                : "text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60 border border-transparent"
            )
          }
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span className="flex-1">Command Center</span>
        </NavLink>
      </div>

      {/* Categorized Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {NAV_CATEGORIES.map((cat) => (
          <div key={cat.id}>
            {/* Category header */}
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-[#5a7a9a] uppercase tracking-[0.15em] font-semibold hover:text-[#8a9ab5] transition-colors"
              aria-expanded={openCategories[cat.id]}
            >
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform duration-200",
                  !openCategories[cat.id] && "-rotate-90"
                )}
              />
              {cat.label}
            </button>

            {/* Category items */}
            {openCategories[cat.id] && (
              <div className="space-y-0.5 mt-0.5">
                {cat.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group ml-2",
                        isActive
                          ? "bg-[#00d4ff]/10 text-[#00d4ff] font-medium border border-[#00d4ff]/20"
                          : "text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60 border border-transparent"
                      )
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {badgeMap[item.to] != null && badgeMap[item.to]! > 0 && (
                      <span className="text-[10px] bg-[#00d4ff]/15 text-[#00d4ff] px-1.5 py-0.5 rounded-full font-mono font-medium">
                        {badgeMap[item.to]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Offline Queue Status */}
      <OfflineQueueStatus />

      {/* Bottom: Activity + Settings */}
      <div className="px-3 py-2 border-t border-nova-border space-y-0.5">
        <NavLink
          to="/activity"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200",
              isActive
                ? "bg-[#00d4ff]/10 text-[#00d4ff] font-medium border border-[#00d4ff]/20"
                : "text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60 border border-transparent"
            )
          }
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span>Activity</span>
          {counts.activities != null && counts.activities > 0 && (
            <span className="text-[10px] bg-[#00d4ff]/15 text-[#00d4ff] px-1.5 py-0.5 rounded-full font-mono font-medium ml-auto">
              {counts.activities}
            </span>
          )}
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200",
              isActive
                ? "bg-[#00d4ff]/10 text-[#00d4ff] font-medium border border-[#00d4ff]/20"
                : "text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60 border border-transparent"
            )
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
        </NavLink>
      </div>

      {/* Theme Toggle + Config */}
      <div className="px-4 py-3 border-t border-nova-border space-y-2">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Theme selection">
          {[
            { value: "light" as const, icon: "☀️", label: "Light theme" },
            { value: "dark" as const, icon: "🌙", label: "Dark theme" },
            { value: "system" as const, icon: "💻", label: "System theme" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              role="radio"
              aria-checked={theme === opt.value}
              aria-label={opt.label}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs transition-colors",
                theme === opt.value
                  ? "bg-[#00d4ff]/15 text-[#00d4ff]"
                  : "text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60"
              )}
            >
              {opt.icon}
            </button>
          ))}
        </div>
        <ConfigStatus />
      </div>
    </aside>
  );
}

function OfflineQueueStatus() {
  const [queueCount, setQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const check = () => {
      try {
        const queue = JSON.parse(localStorage.getItem("nova_offline_queue") || "[]");
        const queued = queue.filter((a: { status: string }) => a.status === "queued");
        setQueueCount(queued.length);
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 5000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && queueCount === 0) return null;

  return (
    <div className="mx-3 mb-2 px-3 py-1.5 rounded-lg bg-[#0f2035]/80 border border-[#1a2f4a]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <Wifi className="w-3 h-3 text-[#10b981]" aria-hidden="true" />
          ) : (
            <WifiOff className="w-3 h-3 text-[#f59e0b]" aria-hidden="true" />
          )}
          <span className="text-[10px] text-[#5a7a9a] uppercase tracking-wider">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
        {queueCount > 0 && (
          <span className="text-[10px] bg-[#f59e0b]/15 text-[#f59e0b] px-1.5 py-0.5 rounded-full font-mono">
            {queueCount} queued
          </span>
        )}
      </div>
    </div>
  );
}
