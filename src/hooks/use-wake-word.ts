import { useState, useRef, useCallback, useEffect } from "react";

interface UseWakeWordOptions {
  onWake?: () => void;
  enabled?: boolean;
}

export function useWakeWord({ onWake, enabled = true }: UseWakeWordOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  useEffect(() => {
    const SR: typeof SpeechRecognition | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    if (!isSupported || !enabled) return;

    const SR: typeof SpeechRecognition | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Stop any existing
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        // Detect "hey nova" or "heowa" wake words
        if (/\bhey\s*nova\b/i.test(transcript) || /\bheowa\b/i.test(transcript)) {
          onWakeRef.current?.();
          return;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("[WakeWord] Error:", event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          // Already started
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      console.warn("[WakeWord] Failed to start");
    }
  }, [isSupported, enabled]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.abort();
      setIsListening(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, isSupported, start, stop };
}
