import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#06060c]">
      <Sidebar />
      <main className="lg:ml-60 min-h-screen pb-20 lg:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
