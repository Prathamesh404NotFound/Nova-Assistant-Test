/**
 * NovaPresence — the primary screen of Nova.
 *
 * Not a dashboard. Nova's core is the center of the page; everything else
 * (contextual panels, world state, transcript, chat) orbits it and appears
 * only when relevant.
 *
 * Replaces the card-grid Dashboard as the authenticated destination, while
 * the Dashboard remains available at /dashboard for users who prefer it.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { AmbientNovaCore } from "@/components/nova/AmbientNovaCore";
import { ContextualPanels } from "@/components/nova/ContextualPanels";
import { StatusIndicator } from "@/components/nova/status-indicator";
import { useAuth } from "@/hooks/use-auth";
import { proactiveContext } from "@/services/proactive";
import { LogOut, LayoutDashboard } from "lucide-react";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Still up";
}

/** Minimal world-state indicators — only what's relevant right now. */
function WorldStateRail() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    }, 30_000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 text-[10px] text-[#5a7a9a]" role="status" aria-label="World state">
      <span className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-[#10b981]" : "bg-[#f43f5e]"}`} aria-hidden="true" />
        {online ? "Online" : "Offline"}
      </span>
      <span className="font-mono text-[#00d4ff]/80">{time}</span>
    </div>
  );
}

export default function NovaPresence() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-[#060e1a] jarvis-grid-bg jarvis-ambience flex flex-col">
      {/* ── Slim header: presence, not a toolbar ────────── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-4 sm:px-6 pt-4"
      >
        <div className="flex items-center gap-3">
          <p className="text-xs text-[#5a7a9a]">
            {greeting()}{user?.displayName ? `, ${user.displayName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WorldStateRail />
          <StatusIndicator />
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-[11px] text-[#5a7a9a] hover:text-[#c8d6e5] transition-colors focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70 rounded px-1.5 py-1"
            title="Classic dashboard view"
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="text-[#5a7a9a] hover:text-[#c8d6e5] transition-colors focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70 rounded p-1"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </motion.header>

      {/* ── Ambient center: orb + live ops + conversation ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        <AmbientNovaCore />

        {/* Contextual panels — only when relevant */}
        <ContextualPanels />
      </div>
    </main>
  );
}
