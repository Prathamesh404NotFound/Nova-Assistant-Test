/**
 * Wake Word Provider — Global wake word listener context.
 * Mounts the useWakeWord hook app-wide so any component can read wake state.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useWakeWord } from "@/hooks/use-wake-word";

interface WakeWordContextValue {
  isListening: boolean;
  isSupported: boolean;
  lastDetected: string | null;
  start: () => void;
  stop: () => void;
}

const WakeWordContext = createContext<WakeWordContextValue>({
  isListening: false,
  isSupported: false,
  lastDetected: null,
  start: () => {},
  stop: () => {},
});

export function useWakeWordContext() {
  return useContext(WakeWordContext);
}

interface Props {
  children: ReactNode;
  /** Global wake callback — typically opens command palette or chat */
  onWake?: () => void;
  enabled?: boolean;
}

export function WakeWordProvider({ children, onWake, enabled = true }: Props) {
  const [wakeTriggered, setWakeTriggered] = useState(false);

  const handleWake = useCallback(() => {
    setWakeTriggered(true);
    onWake?.();
    // Reset trigger flag after a short delay so it can fire again
    setTimeout(() => setWakeTriggered(false), 3000);
  }, [onWake]);

  const wakeWord = useWakeWord({
    onWake: handleWake,
    enabled,
    wakeWords: ["nova", "hey nova"],
  });

  return (
    <WakeWordContext.Provider
      value={{
        ...wakeWord,
        lastDetected: wakeWord.lastDetected,
      }}
    >
      {children}
      {/* Hidden accessibility: announces wake state to screen readers */}
      <div className="sr-only" aria-live="polite">
        {wakeTriggered && "Wake word detected. Opening assistant."}
      </div>
    </WakeWordContext.Provider>
  );
}
