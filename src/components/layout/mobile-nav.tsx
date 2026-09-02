import { NavLink, useNavigate } from "react-router";
import { useState } from "react";
import {
  MessageSquare,
  CheckSquare,
  Brain,
  Mic,
  Settings,
  LayoutDashboard,
  Calendar,
  MoreHorizontal,
  Mail,
  Globe,
  Code,
  Zap,
  Bot,
  Files,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/chat", icon: Mic, label: "Chat", isCenter: true },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
];

const moreCategories = [
  {
    label: "ORGANIZE",
    items: [
      { to: "/email", icon: Mail, label: "Email" },
      { to: "/files", icon: Files, label: "Files" },
      { to: "/memory", icon: Brain, label: "Memory" },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { to: "/agents", icon: Bot, label: "Agents" },
      { to: "/browser", icon: Globe, label: "Browser" },
      { to: "/coding", icon: Code, label: "Coding" },
    ],
  },
  {
    label: "AUTOMATE",
    items: [
      { to: "/automations", icon: Zap, label: "Automations" },
      { to: "/devices", icon: Zap, label: "Devices" },
    ],
  },
];

export function MobileNav() {
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#081422]/95 backdrop-blur-xl border-t border-[#1a2f4a]">
        <div className="flex items-center justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {mainNavItems.map((item) =>
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
          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] transition-all duration-200 min-w-[48px] text-[#5a7a9a] hover:text-[#c8d6e5]"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More Sheet */}
      {showMore && (
        <div className="lg:hidden fixed inset-0 z-[60]" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#081422] border-t border-[#1a2f4a] rounded-t-2xl max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2f4a]">
              <span className="text-sm font-semibold text-[#e0ecf5]">More</span>
              <button onClick={() => setShowMore(false)} className="text-[#5a7a9a] hover:text-[#e0ecf5]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Categories */}
            <div className="p-4 space-y-4">
              {moreCategories.map((cat) => (
                <div key={cat.label}>
                  <p className="text-[10px] text-[#5a7a9a] uppercase tracking-wider font-semibold mb-2">
                    {cat.label}
                  </p>
                  <div className="space-y-1">
                    {cat.items.map((item) => (
                      <button
                        key={item.to}
                        onClick={() => {
                          navigate(item.to);
                          setShowMore(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#c8d6e5] hover:bg-[#0f2035]/60 transition-colors"
                      >
                        <item.icon className="w-4 h-4 text-[#5a7a9a]" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Settings & Activity */}
              <div className="border-t border-[#1a2f4a] pt-3 space-y-1">
                <button
                  onClick={() => { navigate("/activity"); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#c8d6e5] hover:bg-[#0f2035]/60 transition-colors"
                >
                  <Zap className="w-4 h-4 text-[#5a7a9a]" />
                  Activity
                </button>
                <button
                  onClick={() => { navigate("/settings"); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#c8d6e5] hover:bg-[#0f2035]/60 transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#5a7a9a]" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
