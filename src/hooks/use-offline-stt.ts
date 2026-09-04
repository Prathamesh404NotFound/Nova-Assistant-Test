import { useState, useRef, useCallback, useEffect } from "react";

interface UseOfflineSTTOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  lang?: string;
  /** When true, recognition restarts automatically after each utterance. */
  continuous?: boolean;
}

export function useOfflineSTT({ onTranscript, lang = "en-US", continuous = false }: UseOfflineSTTOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const SR: typeof SpeechRecognition | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    if (!isSupported) return;

    const SR: typeof SpeechRecognition | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    stop();

    const recognition = new SR();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      const currentTranscript = finalText || interimText;
      setTranscript(currentTranscript);

      if (finalText) {
        onTranscriptRef.current?.(finalText.trim(), true);
      } else if (interimText) {
        onTranscriptRef.current?.(interimText, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setTranscript("");
      } else if (event.error !== "aborted") {
        console.warn("[STT] Error:", event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // In continuous mode, auto-restart if still supposed to be listening
      if (continuous && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setTranscript("");
    } catch {
      console.warn("[STT] Failed to start");
    }
  }, [isSupported, lang, continuous]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, isSupported, transcript, start, stop, reset };
}
