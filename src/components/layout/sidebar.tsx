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
  Users,
  Bot,
  Puzzle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfigStatus } from "@/components/ConfigStatus";
import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon, Monitor } from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: MessageSquare, label: "Home" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/memory", icon: Brain, label: "Memory" },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/email", icon: Mail, label: "Email" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/devices", icon: Smartphone, label: "Devices" },
  { to: "/browser", icon: Globe, label: "Browser" },
  { to: "/coding", icon: Code, label: "Coding" },
  { to: "/smart-home", icon: Home, label: "Smart Home" },
  { to: "/files", icon: Files, label: "Files" },
  { to: "/automations", icon: Zap, label: "Automations" },
  { to: "/activity", icon: Activity, label: "Activity" },
  { to: "/security", icon: Shield, label: "Security" },
  { to: "/plugins", icon: Puzzle, label: "Plugins" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-nova-border bg-nova-surface/80 backdrop-blur-xl z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-nova-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center">
          <span className="text-white font-bold text-sm">N</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight">Nova</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">AI OS</p>
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
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                isActive
                  ? "bg-nova-cyan/10 text-[#00d4ff] font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-nova-surface-light"
              )
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Status */}
      <div className="px-4 py-4 border-t border-nova-border space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs text-muted-foreground">Nova Online</span>
        </div>
        <ConfigStatus />
        {/* Theme Toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === "dark" ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "text-[#6e6e8a] hover:text-[#e8e8f8]"
            )}
          >
            <Moon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === "light" ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "text-[#6e6e8a] hover:text-[#e8e8f8]"
            )}
          >
            <Sun className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTheme("system")}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === "system" ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "text-[#6e6e8a] hover:text-[#e8e8f8]"
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
