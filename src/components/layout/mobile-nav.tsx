import { NavLink } from "react-router";
import {
  MessageSquare,
  CheckSquare,
  Brain,
  Mic,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/chat", icon: Mic, label: "Voice", isCenter: true },
  { to: "/memory", icon: Brain, label: "Memory" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#081422]/95 backdrop-blur-xl border-t border-[#1a2f4a]">
      <div className="flex items-center justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {mobileNavItems.map((item) =>
          item.isCenter ? (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative -mt-6 flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300",
                  "bg-gradient-to-br from-[#00d4ff] to-[#0ea5e9] shadow-lg shadow-[#00d4ff]/30",
                  isActive && "scale-110 shadow-[#00d4ff]/50"
                )
              }
            >
              <Mic className="w-6 h-6 text-[#060e1a]" />
            </NavLink>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] transition-all duration-200 min-w-[48px]",
                  isActive
                    ? "text-[#00d4ff]"
                    : "text-[#5a7a9a] hover:text-[#c8d6e5]"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
