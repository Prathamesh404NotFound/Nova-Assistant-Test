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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: MessageSquare, label: "Chat" },
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
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
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
      <div className="px-4 py-4 border-t border-nova-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs text-muted-foreground">Nova Online</span>
        </div>
      </div>
    </aside>
  );
}
