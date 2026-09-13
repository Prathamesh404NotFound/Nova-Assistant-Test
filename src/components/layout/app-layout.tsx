import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { EnvironmentHud } from "@/components/nova/EnvironmentHud";
import { PersistentVoiceOrb } from "@/components/nova/PersistentVoiceOrb";
import { NovaPhaseStrip } from "@/components/nova/NovaPhaseStrip";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060e1a] jarvis-grid-bg jarvis-ambience">
      <Sidebar />
      <main className="lg:ml-60 min-h-screen pb-20 lg:pb-0">
        {/* HUD status rail: live Nova pipeline phase, always available. */}
        <div className="sticky top-0 z-30 hidden lg:flex items-center justify-between px-6 h-9 border-b border-nova-border/60 bg-[#060e1a]/70 backdrop-blur-md">
          <NovaPhaseStrip />
          <div className="jarvis-rail-line h-px w-40" aria-hidden="true" />
        </div>
        {children}
      </main>
      <MobileNav />
      <EnvironmentHud />
      <PersistentVoiceOrb />
    </div>
  );
}
