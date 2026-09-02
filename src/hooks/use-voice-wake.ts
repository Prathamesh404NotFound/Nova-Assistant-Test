/**
 * Nova AI OS — Voice Wake Word Detection
 * Detects the "heowa" wake word to activate the AI without tapping.
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface UseVoiceWakeOptions {
  wakeWord?: string;
  onWake?: () => void;
  enabled?: boolean;
}

export function useVoiceWake({
  wakeWord = "heowa",
  onWake,
  enabled = true,
}: UseVoiceWakeOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onWakeRef = useRef(onWake);

  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const start = useCallback(() => {
    if (!enabled || !isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        if (transcript.includes(wakeWord.toLowerCase())) {
          onWakeRef.current?.();
          // Visual/audio feedback could be added here
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("[Nova Voice Wake]", event.error);
      }
    };

    recognition.onend = () => {
      // Restart if still enabled
      if (enabled && recognitionRef.current) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {}
  }, [enabled, isSupported, wakeWord]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (enabled && isSupported) {
      start();
    }
    return () => stop();
  }, [enabled, isSupported, start, stop]);

  return { isListening, isSupported, start, stop };
}
