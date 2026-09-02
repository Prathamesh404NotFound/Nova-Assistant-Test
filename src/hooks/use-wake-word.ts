import { useState, useRef, useCallback, useEffect } from "react";

interface UseWakeWordOptions {
  /** Callback fired when wake word is detected */
  onWake?: () => void;
  /** Enable/disable the listener */
  enabled?: boolean;
  /** Wake words to listen for (default: ["nova", "hey nova"]) */
  wakeWords?: string[];
  /** Language for recognition */
  lang?: string;
}

export function useWakeWord({
  onWake,
  enabled = true,
  wakeWords = ["nova", "hey nova"],
  lang = "en-US",
}: UseWakeWordOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  // Build a regex that matches any wake word at a word boundary
  const wakePatternRef = useRef(
    new RegExp(
      `(?:^|\\b)(?:${wakeWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:\\b|$)`,
      "i"
    )
  );

  useEffect(() => {
    wakePatternRef.current = new RegExp(
      `(?:^|\\b)(?:${wakeWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:\\b|$)`,
      "i"
    );
  }, [wakeWords]);

  useEffect(() => {
    const SR: typeof SpeechRecognition | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SR);
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || !enabled) return;

    const SR: typeof SpeechRecognition | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    // Release previous MediaStream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Initialize MediaStream on demand (requires user gesture)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      console.warn("[WakeWord] Microphone access denied:", err);
      setIsListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        const matched = wakePatternRef.current.test(transcript);
        if (matched) {
          const detected = wakeWords.find((w) =>
            transcript.includes(w.toLowerCase())
          );
          setLastDetected(detected || wakeWords[0]);
          onWakeRef.current?.();
          return;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignore benign errors; log real ones
      if (
        event.error !== "no-speech" &&
        event.error !== "aborted" &&
        event.error !== "not-allowed"
      ) {
        console.warn("[WakeWord] Recognition error:", event.error);
      }
      if (event.error === "not-allowed") {
        setIsListening(false);
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
      console.warn("[WakeWord] Failed to start recognition");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [isSupported, enabled, lang, wakeWords]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.abort();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    lastDetected,
    start,
    stop,
  };
}
