import { useState, useRef, useCallback, useEffect } from "react";

type STTErrorKind =
  | "not-supported"
  | "not-allowed"
  | "service-not-allowed"
  | "audio-capture"
  | "network"
  | "transient";

export interface STTError {
  kind: STTErrorKind;
  message: string;
}

interface UseOfflineSTTOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (err: STTError) => void;
  lang?: string;
  /** When true, recognition restarts automatically after each utterance / engine stop. */
  continuous?: boolean;
}

/** Errors that mean "do not auto-restart" — user or environment must intervene. */
const FATAL_ERRORS: STTErrorKind[] = ["not-allowed", "service-not-allowed", "audio-capture", "not-supported"];

/** Delay before auto-restart to avoid rapid start/stop loops from the engine. */
const RESTART_DELAY_MS = 400;

export function useOfflineSTT({
  onTranscript,
  onError,
  lang = "en-US",
  continuous = false,
}: UseOfflineSTTOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Mutable runtime state lives in refs to avoid stale closures.
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const continuousRef = useRef(continuous);
  const shouldListenRef = useRef(false); // true while voice session is active
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingRef = useRef(false); // guards duplicate start() calls

  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;
  continuousRef.current = continuous;

  const emitError = useCallback((kind: STTErrorKind, message: string) => {
    if (import.meta.env.DEV) console.warn(`[STT] ${kind}: ${message}`);
    onErrorRef.current?.({ kind, message });
  }, []);

  const getRecognition = useCallback((): typeof SpeechRecognition | undefined => {
    const w = window as unknown as {
      SpeechRecognition?: typeof SpeechRecognition;
      webkitSpeechRecognition?: typeof SpeechRecognition;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition;
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    clearRestartTimer();
    const rec = recognitionRef.current;
    if (rec) {
      recognitionRef.current = null; // detach first so onend doesn't restart
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    }
    setIsListening(false);
    if (import.meta.env.DEV) console.debug("[STT] stopped");
  }, [clearRestartTimer]);

  const start = useCallback(() => {
    const SR = getRecognition();
    if (!SR) {
      emitError("not-supported", "Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (startingRef.current || recognitionRef.current) return; // prevent duplicate instances
    shouldListenRef.current = true;
    startingRef.current = true;

    const recognition = new SR();
    recognition.continuous = continuousRef.current;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      startingRef.current = false;
      setIsListening(true);
      if (import.meta.env.DEV) console.debug("[STT] started");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      const trimmedFinal = finalText.trim();
      if (trimmedFinal) {
        setTranscript(trimmedFinal);
        if (import.meta.env.DEV) console.debug("[STT] final transcript:", trimmedFinal);
        onTranscriptRef.current?.(trimmedFinal, true);
      } else if (interimText.trim()) {
        setTranscript(interimText);
        onTranscriptRef.current?.(interimText.trim(), false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        // Silence timeout — safe to keep listening; the engine will fire onend.
        return;
      }
      if (event.error === "aborted") return; // intentional stop

      const kind: STTErrorKind =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "not-allowed"
          : event.error === "audio-capture"
          ? "audio-capture"
          : event.error === "network"
          ? "network"
          : "transient";

      const message =
        kind === "not-allowed"
          ? "Microphone permission denied. Enable it in your browser settings to use voice."
          : kind === "audio-capture"
          ? "No microphone found. Connect a microphone to use voice."
          : kind === "network"
          ? "Speech recognition needs a network connection."
          : `Speech recognition error: ${event.error}`;

      emitError(kind, message);
      if (FATAL_ERRORS.includes(kind)) {
        shouldListenRef.current = false; // do not auto-restart fatal failures
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      startingRef.current = false;
      setIsListening(false);
      if (import.meta.env.DEV) console.debug("[STT] ended");

      // Auto-restart only in continuous voice sessions, after a short delay,
      // and never for fatal errors (shouldListenRef already false there).
      if (continuousRef.current && shouldListenRef.current) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (continuousRef.current && shouldListenRef.current && !recognitionRef.current) {
            if (import.meta.env.DEV) console.debug("[STT] restarting");
            start();
          }
        }, RESTART_DELAY_MS);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setTranscript("");
    } catch {
      // start() can throw InvalidStateError if already started — treat as benign.
      startingRef.current = false;
      recognitionRef.current = null;
    }
  }, [lang, emitError, getRecognition, clearRestartTimer]);

  const reset = useCallback(() => {
    setTranscript("");
  }, []);

  // Detect support once
  useEffect(() => {
    setIsSupported(!!getRecognition());
  }, [getRecognition]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* noop */
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, isSupported, transcript, start, stop, reset };
}
