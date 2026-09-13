/**
 * Nova AI OS — Keyboard Shortcuts
 * Press ? to open a modal showing all available shortcuts.
 * Also hosts the global voice shortcuts: Shift+Space toggles the voice
 * session and ⌘/Ctrl+J barge-ins (interrupts Nova mid-speech).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { voiceSession } from "@/services/voice-core";
import { voiceStateMachine } from "@/services/voice-core/VoiceStateMachine";

interface Shortcut {
  keys: string[];
  description: string;
}

const shortcuts: Shortcut[] = [
  { keys: ["⇧", "Space"], description: "Toggle Voice Mode" },
  { keys: ["⌘", "J"], description: "Interrupt Nova (barge-in)" },
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
  const togglingRef = useRef(false);

  const toggleVoice = useCallback(async () => {
    if (togglingRef.current) return; // prevent duplicate session starts
    togglingRef.current = true;
    try {
      if (voiceSession.isActive()) {
        voiceSession.stop();
      } else {
        await voiceSession.start();
      }
    } finally {
      togglingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global voice shortcuts work even while typing (voice-first product).
      if (e.shiftKey && e.code === "Space" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        void toggleVoice();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (voiceStateMachine.current === "speaking") voiceSession.bargeIn();
        return;
      }

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
  }, [toggleVoice]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 bg-[#0b1626] border-[#00d4ff]/20 max-w-sm jarvis-elevated">
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
