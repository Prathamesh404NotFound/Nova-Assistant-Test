import { NavLink } from "react-router";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfigStatus } from "@/components/ConfigStatus";
import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon, Monitor } from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Command Center" },
  { to: "/chat", icon: MessageSquare, label: "Conversations", badge: 12 },
  { to: "/tasks", icon: CheckSquare, label: "Tasks", badge: 5 },
  { to: "/memory", icon: Brain, label: "Memory" },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/email", icon: Mail, label: "Email" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/devices", icon: Smartphone, label: "Devices" },
  { to: "/browser", icon: Globe, label: "Browser" },
  { to: "/coding", icon: Code, label: "Coding" },
  { to: "/smart-home", icon: Home, label: "Smart Home" },
  { to: "/files", icon: Files, label: "Files" },
  { to: "/automations", icon: Zap, label: "Workflows", badge: 18 },
  { to: "/activity", icon: Activity, label: "Activity" },
  { to: "/security", icon: Shield, label: "Security" },
  { to: "/plugins", icon: Puzzle, label: "Tools & Skills" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function LayoutDashboard(props: any) {
  return <MessageSquare {...props} />;
}

export function Sidebar() {
  const { theme, setTheme } = useTheme();

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
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group",
                isActive
                  ? "bg-[#00d4ff]/10 text-[#00d4ff] font-medium border border-[#00d4ff]/20"
                  : "text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60 border border-transparent"
              )
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="text-[10px] bg-[#00d4ff]/15 text-[#00d4ff] px-1.5 py-0.5 rounded-full font-mono font-medium">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Voice Status */}
      <div className="px-4 py-3 border-t border-nova-border">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="w-3.5 h-3.5 text-[#00d4ff]" />
          <span className="text-[10px] text-[#5a7a9a] uppercase tracking-wider">Voice Status</span>
        </div>
        <div className="flex items-center gap-1 h-6 px-2">
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
        <p className="text-[10px] text-[#5a7a9a] mt-1 text-center">Listening...</p>
      </div>

      {/* Bottom Status */}
      <div className="px-4 py-3 border-t border-nova-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-[11px] text-[#5a7a9a]">Nova Online</span>
        </div>
        <ConfigStatus />
        {/* Theme Toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === "dark" ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "text-[#5a7a9a] hover:text-[#c8d6e5]"
            )}
          >
            <Moon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === "light" ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "text-[#5a7a9a] hover:text-[#c8d6e5]"
            )}
          >
            <Sun className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTheme("system")}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === "system" ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "text-[#5a7a9a] hover:text-[#c8d6e5]"
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
