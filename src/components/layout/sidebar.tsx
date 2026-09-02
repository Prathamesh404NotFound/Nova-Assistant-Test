import { NavLink } from "react-router";
import { useState, useEffect } from "react";
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
  FolderOpen,
  BarChart3,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfigStatus } from "@/components/ConfigStatus";
import { useTheme } from "@/hooks/use-theme";
import { useDashboardData } from "@/hooks/use-dashboard-data";

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  const { counts } = useDashboardData();

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Command Center" },
    { to: "/chat", icon: MessageSquare, label: "Conversations", badge: counts.conversations || undefined },
    { to: "/tasks", icon: CheckSquare, label: "Tasks", badge: counts.tasks || undefined },
    { to: "/memory", icon: Brain, label: "Memory" },
    { to: "/calendar", icon: Calendar, label: "Calendar", badge: counts.calendarEvents || undefined },
    { to: "/email", icon: Mail, label: "Email", badge: counts.emailDrafts || undefined },
    { to: "/agents", icon: Bot, label: "Agents" },
    { to: "/devices", icon: Smartphone, label: "Devices" },
    { to: "/browser", icon: Globe, label: "Browser" },
    { to: "/coding", icon: Code, label: "Coding" },
    { to: "/smart-home", icon: Home, label: "Smart Home" },
    { to: "/files", icon: Files, label: "Files", badge: counts.files || undefined },
    { to: "/automations", icon: Zap, label: "Automations", badge: counts.automations || undefined },
    { to: "/workflows", icon: GitBranch, label: "Workflow Planner" },
    { to: "/activity", icon: Activity, label: "Activity", badge: counts.activities || undefined },
    { to: "/memory-search", icon: Search, label: "Memory Search" },
    { to: "/workspace", icon: FolderOpen, label: "Workspaces" },
    { to: "/observability", icon: BarChart3, label: "Observability" },
    { to: "/security", icon: Shield, label: "Security" },
    { to: "/plugins", icon: Puzzle, label: "Tools & Skills" },
    { to: "/personalization", icon: UserCog, label: "Personalization" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-nova-border bg-[#081422]/95 backdrop-blur-xl z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-nova-border">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#0ea5e9] flex items-center justify-center shadow-lg shadow-[#00d4ff]/20">
          <span className="text-[#060e1a] font-black text-sm tracking-tight">N</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-[#e0ecf5] tracking-tight">NOVA</h1>
          <p className="text-[9px] text-[#5a7a9a] uppercase tracking-[0.2em] font-medium">Command Center</p>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-[#0f2035]/80 border border-[#1a2f4a]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#5a7a9a] uppercase tracking-wider">System Status</span>
          <span className="flex items-center gap-1.5 text-[10px] text-[#10b981] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
            Optimal
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group",
                isActive
                  ? "bg-[#00d4ff]/10 text-[#00d4ff] font-medium border border-[#00d4ff]/20"
                  : "text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60 border border-transparent"
              )
            }
          >
            <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span className="text-[10px] bg-[#00d4ff]/15 text-[#00d4ff] px-1.5 py-0.5 rounded-full font-mono font-medium">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Offline Queue Status */}
      <OfflineQueueStatus />

      {/* Voice Status */}
      <div className="px-4 py-3 border-t border-nova-border">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="w-3.5 h-3.5 text-[#00d4ff]" aria-hidden="true" />
          <span className="text-[10px] text-[#5a7a9a] uppercase tracking-wider">Voice Status</span>
        </div>
        <div className="flex items-center gap-1 h-6 px-2" role="img" aria-label="Voice waveform visualization">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] bg-[#00d4ff]/30 rounded-full"
              style={{
                height: `${4 + Math.sin(i * 0.8) * 8}px`,
                animation: `nova-waveform 1.5s ease-in-out ${i * 0.05}s infinite`,
              }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00d4ff]/10 text-[#00d4ff] text-[11px] font-medium hover:bg-[#00d4ff]/20 transition-colors"
            aria-label="Tap to speak"
          >
            <Mic className="w-3 h-3" aria-hidden="true" />
            Tap to Speak
          </button>
        </div>
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
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", () => setIsOnline(true));
      window.removeEventListener("offline", () => setIsOnline(false));
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
