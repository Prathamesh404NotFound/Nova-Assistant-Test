/**
 * Nova AI OS — AI Service Provider
 * Global state orchestration for AI services.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { localAIService, type LocalAIAvailability } from "@/ai/local/LocalAIService";
import { getAIMode, setAIMode, type AIMode } from "@/ai/local/LocalAISettings";
import { validateEnvironment, type EnvValidationResult } from "@/lib/env-validator";

interface AIServiceState {
  // Environment
  envStatus: EnvValidationResult;
  // Local AI
  localAIAvailability: LocalAIAvailability | null;
  localAILoaded: boolean;
  localAIModelCached: boolean;
  // Mode
  aiMode: AIMode;
  // Health
  isOnline: boolean;
}

interface AIServiceContextType extends AIServiceState {
  refreshLocalAI: () => Promise<void>;
  setMode: (mode: AIMode) => void;
}

const AIServiceContext = createContext<AIServiceContextType | null>(null);

export function AIServiceProvider({ children }: { children: ReactNode }) {
  const [envStatus, setEnvStatus] = useState<EnvValidationResult>({ valid: true, missing: [], warnings: [] });
  const [localAIAvailability, setLocalAIAvailability] = useState<LocalAIAvailability | null>(null);
  const [localAILoaded, setLocalAILoaded] = useState(false);
  const [localAIModelCached, setLocalAIModelCached] = useState(false);
  const [aiMode, setAiModeState] = useState<AIMode>(getAIMode());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Validate environment on mount
  useEffect(() => {
    const result = validateEnvironment();
    setEnvStatus(result);
  }, []);

  // Check Local AI status
  const refreshLocalAI = async () => {
    try {
      const avail = await localAIService.detect();
      setLocalAIAvailability(avail);
      const cached = await localAIService.isCached();
      setLocalAIModelCached(cached);
      const loaded = await localAIService.isReady();
      setLocalAILoaded(loaded);
    } catch {
      setLocalAIAvailability({ supported: false, backend: "unsupported", modelCached: false });
    }
  };

  useEffect(() => {
    refreshLocalAI();
  }, []);

  // Listen for online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const setMode = (mode: AIMode) => {
    setAiModeState(mode);
    setAIMode(mode);
  };

  return (
    <AIServiceContext.Provider
      value={{
        envStatus,
        localAIAvailability,
        localAILoaded,
        localAIModelCached,
        aiMode,
        isOnline,
        refreshLocalAI,
        setMode,
      }}
    >
      {children}
    </AIServiceContext.Provider>
  );
}

export function useAIService() {
  const context = useContext(AIServiceContext);
  if (!context) {
    throw new Error("useAIService must be used within AIServiceProvider");
  }
  return context;
}
