/**
 * useIndicTTS — React hook for Nova's multi-backend TTS system.
 * Wraps the TTS adapter with React state management, caching, and playback controls.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  generateSpeech,
  playAudio,
  loadTTSConfig,
  saveTTSConfig,
  type TTSConfig,
  type TTSState,
  type TTSResult,
  type IndicLanguage,
  type SpeakerProfile,
} from "@/services/tts/tts-adapter";

interface UseIndicTTSOptions {
  /** Auto-play generated audio */
  autoPlay?: boolean;
  /** Called when speech starts playing */
  onPlay?: () => void;
  /** Called when speech finishes playing */
  onEnd?: () => void;
}

interface UseIndicTTSReturn {
  state: TTSState;
  config: TTSConfig;
  /** Generate and optionally play speech from text */
  speak: (text: string) => Promise<void>;
  /** Stop current playback */
  stop: () => void;
  /** Pause current playback */
  pause: () => void;
  /** Resume paused playback */
  resume: () => void;
  /** Update a config field */
  updateConfig: <K extends keyof TTSConfig>(key: K, value: TTSConfig[K]) => void;
  /** Set language */
  setLanguage: (lang: IndicLanguage) => void;
  /** Set speaker */
  setSpeaker: (speaker: SpeakerProfile) => void;
  /** Check if a given language is supported */
  isLanguageSupported: (lang: IndicLanguage) => boolean;
}

export function useIndicTTS(
  options: UseIndicTTSOptions = {}
): UseIndicTTSReturn {
  const { autoPlay = true, onPlay, onEnd } = options;

  const [config, setConfig] = useState<TTSConfig>(loadTTSConfig);
  const [state, setState] = useState<TTSState>({
    isGenerating: false,
    isPlaying: false,
    error: null,
    lastResult: null,
    progress: 0,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackRef = useRef<{ stop: () => void; audio: HTMLAudioElement } | null>(null);
  const onPlayRef = useRef(onPlay);
  const onEndRef = useRef(onEnd);
  onPlayRef.current = onPlay;
  onEndRef.current = onEnd;

  // Cache: text+config hash → TTSResult
  const cacheRef = useRef<Map<string, TTSResult>>(new Map());

  // Save config whenever it changes
  useEffect(() => {
    saveTTSConfig(config);
  }, [config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
      // Revoke cached URLs
      cacheRef.current.forEach((r) => {
        if (r.audioUrl) URL.revokeObjectURL(r.audioUrl);
      });
    };
  }, []);

  const makeCacheKey = useCallback(
    (text: string) => {
      return `${config.language}:${config.speaker.id}:${config.speed}:${config.pitch}:${config.expressiveness}:${text.slice(0, 200)}`;
    },
    [config.language, config.speaker.id, config.speed, config.pitch, config.expressiveness]
  );

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Stop any ongoing playback
      playbackRef.current?.stop();
      audioRef.current = null;

      // Check cache
      const cacheKey = makeCacheKey(text);
      const cached = cacheRef.current.get(cacheKey);

      if (cached && cached.backend !== "browser") {
        // Reuse cached audio
        setState((s) => ({
          ...s,
          isGenerating: false,
          isPlaying: true,
          error: null,
          lastResult: cached,
          progress: 100,
        }));

        if (autoPlay && cached.audioUrl) {
          const playback = playAudio(cached.audioUrl);
          playbackRef.current = playback;
          audioRef.current = playback.audio;
          onPlayRef.current?.();

          playback.audio.onended = () => {
            setState((s) => ({ ...s, isPlaying: false }));
            onEndRef.current?.();
          };
        }
        return;
      }

      // Generate new audio
      setState((s) => ({
        ...s,
        isGenerating: true,
        error: null,
        progress: 0,
      }));

      try {
        const result = await generateSpeech(text, config, (progress) => {
          setState((s) => ({ ...s, progress }));
        });

        // Cache the result
        cacheRef.current.set(cacheKey, result);
        // Limit cache size
        if (cacheRef.current.size > 50) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey) {
            const old = cacheRef.current.get(firstKey);
            if (old?.audioUrl) URL.revokeObjectURL(old.audioUrl);
            cacheRef.current.delete(firstKey);
          }
        }

        setState((s) => ({
          ...s,
          isGenerating: false,
          isPlaying: result.backend !== "browser" && autoPlay,
          error: null,
          lastResult: result,
          progress: 100,
        }));

        // Auto-play
        if (autoPlay && result.audioUrl) {
          const playback = playAudio(result.audioUrl);
          playbackRef.current = playback;
          audioRef.current = playback.audio;
          onPlayRef.current?.();

          playback.audio.onended = () => {
            setState((s) => ({ ...s, isPlaying: false }));
            onEndRef.current?.();
          };
        } else if (result.backend === "browser") {
          // Browser TTS plays inline; mark as playing briefly
          setState((s) => ({ ...s, isPlaying: true }));
          setTimeout(() => {
            setState((s) => ({ ...s, isPlaying: false }));
            onEndRef.current?.();
          }, Math.max(1000, text.length * 50)); // rough estimate
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          isGenerating: false,
          isPlaying: false,
          error: err instanceof Error ? err.message : "TTS generation failed",
          progress: 0,
        }));
      }
    },
    [config, autoPlay, makeCacheKey]
  );

  const stop = useCallback(() => {
    playbackRef.current?.stop();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setState((s) => ({ ...s, isPlaying: false }));
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setState((s) => ({ ...s, isPlaying: true }));
    }
  }, []);

  const updateConfig = useCallback(
    <K extends keyof TTSConfig>(key: K, value: TTSConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const setLanguage = useCallback((lang: IndicLanguage) => {
    setConfig((prev) => ({
      ...prev,
      language: lang,
    }));
  }, []);

  const setSpeaker = useCallback((speaker: SpeakerProfile) => {
    setConfig((prev) => ({
      ...prev,
      speaker,
      language: speaker.language === "auto" ? prev.language : speaker.language,
    }));
  }, []);

  const isLanguageSupported = useCallback(
    (lang: IndicLanguage) => {
      // Gemini supports most languages; HF supports Indic; browser varies
      if (config.geminiKey) return true;
      if (config.hfToken) return lang !== "auto";
      return ["en", "hi", "mr"].includes(lang); // Browser best-effort
    },
    [config.geminiKey, config.hfToken]
  );

  return {
    state,
    config,
    speak,
    stop,
    pause,
    resume,
    updateConfig,
    setLanguage,
    setSpeaker,
    isLanguageSupported,
  };
}
