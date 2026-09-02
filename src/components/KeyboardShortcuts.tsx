/**
 * Nova AI OS — Keyboard Shortcuts
 * Press ? to open a modal showing all available shortcuts.
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface Shortcut {
  keys: string[];
  description: string;
}

const shortcuts: Shortcut[] = [
  { keys: ["⌘", "K"], description: "Open Command Palette" },
  { keys: ["?"], description: "Show Keyboard Shortcuts" },
  { keys: ["⌘", "Enter"], description: "Send Message" },
  { keys: ["Esc"], description: "Close Modal / Stop Generation" },
  { keys: ["↑"], description: "Edit Previous Message" },
  { keys: ["⌘", "N"], description: "New Chat" },
  { keys: ["⌘", "D"], description: "Toggle Sidebar" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 bg-[#0d0d16] border-[#252540] max-w-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#252540]">
          <Keyboard className="h-4 w-4 text-[#6e6e8a]" />
          <p className="text-sm font-medium text-[#e8e8f8]">Keyboard Shortcuts</p>
        </div>
        <div className="p-4 space-y-3">
          {shortcuts.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-[#6e6e8a]">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    className="text-[10px] text-[#e8e8f8] bg-[#16162a] border border-[#252540] px-1.5 py-0.5 rounded min-w-[20px] text-center"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-[#252540]">
          <p className="text-[10px] text-[#6e6e8a] text-center">
            Press <kbd className="bg-[#16162a] px-1 rounded">?</kbd> to toggle
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
