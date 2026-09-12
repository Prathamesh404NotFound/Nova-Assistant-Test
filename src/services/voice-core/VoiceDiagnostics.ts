/**
 * Voice Core — diagnostics.
 * Reports the real state of every voice subsystem for the HUD / settings.
 */

import { voiceStateMachine } from "./VoiceStateMachine";
import { voiceInput } from "./VoiceInput";
import { voiceOutput } from "./VoiceOutput";
import { liveVoiceProvider } from "./LiveVoiceProvider";
import { wakeWordDetector } from "./VoiceWakeWord";
import { ttsRouter } from "@/services/tts/tts-router";

export interface VoiceDiagnosticsReport {
  state: string;
  listening: boolean;
  speaking: boolean;
  sttSupported: boolean;
  ttsProvider: string;
  ttsAvailable: boolean;
  liveAvailable: boolean;
  liveReason?: string;
  liveConnected: boolean;
  wakeWordEnabled: boolean;
  wakeArmed: boolean;
  bargeInCount: number;
  lastError?: string;
  lang: string;
}

class VoiceDiagnostics {
  private lastError: string | null = null;

  recordError(message: string): void {
    this.lastError = message;
  }

  report(): VoiceDiagnosticsReport {
    const ttsSettings = ttsRouter.getSettings();
    return {
      state: voiceStateMachine.current,
      listening: voiceInput.isListening(),
      speaking: voiceOutput.isSpeaking(),
      sttSupported: voiceInput.isSupported(),
      ttsProvider: ttsSettings.engine,
      ttsAvailable: typeof window !== "undefined" && "speechSynthesis" in window,
      liveAvailable: liveVoiceProvider.getStatus().available,
      liveReason: liveVoiceProvider.getStatus().reason,
      liveConnected: liveVoiceProvider.isConnected(),
      wakeWordEnabled: wakeWordDetector.isArmed(),
      wakeArmed: wakeWordDetector.isArmed(),
      bargeInCount: voiceStateMachine.getBargeInCount(),
      lastError: this.lastError ?? undefined,
      lang: voiceInput.lang,
    };
  }
}

export const voiceDiagnostics = new VoiceDiagnostics();
