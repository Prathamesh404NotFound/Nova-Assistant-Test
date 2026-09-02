/**
 * Nova AI OS — Voice Experience
 * Wake-word customization, push-to-talk, interruption handling,
 * transcript review, and visible microphone privacy status.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit3,
  Play,
  Pause,
  SkipForward,
  Eye,
} from "lucide-react";

// --- Types ---
export interface VoiceSettings {
  wakeWord: string;
  wakeWordEnabled: boolean;
  pushToTalk: boolean;
  pushToTalkKey: string;
  interruptionEnabled: boolean;
  autoSendTranscript: boolean;
  language: string;
  voiceId: string;
  transcriptReview: boolean;
  privacyMode: boolean;
  volume: number;
  speed: number;
}

export interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
  duration: number;
  wordCount: number;
  language: string;
  confidence: number;
}

const SETTINGS_KEY = "nova_voice_settings";
const TRANSCRIPT_KEY = "nova_transcripts";

const DEFAULT_SETTINGS: VoiceSettings = {
  wakeWord: "Hey Nova",
  wakeWordEnabled: true,
  pushToTalk: false,
  pushToTalkKey: "Space",
  interruptionEnabled: true,
  autoSendTranscript: false,
  language: "en",
  voiceId: "default",
  transcriptReview: true,
  privacyMode: false,
  volume: 0.8,
  speed: 1.0,
};

const WAKE_WORD_PRESETS = [
  { value: "Hey Nova", label: "Hey Nova" },
  { value: "Nova", label: "Nova" },
  { value: "Computer", label: "Computer" },
  { value: "Assistant", label: "Assistant" },
  { value: "Custom", label: "Custom..." },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
  { value: "auto", label: "Auto-detect" },
];

const VOICE_PRESETS = [
  { value: "default", label: "Default" },
  { value: "female-1", label: "Female Voice 1" },
  { value: "female-2", label: "Female Voice 2" },
  { value: "male-1", label: "Male Voice 1" },
  { value: "male-2", label: "Male Voice 2" },
];

function loadSettings(): VoiceSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: VoiceSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadTranscripts(): TranscriptEntry[] {
  try {
    return JSON.parse(localStorage.getItem(TRANSCRIPT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTranscripts(entries: TranscriptEntry[]) {
  localStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(entries.slice(-200)));
}

function generateId(): string {
  return `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function VoiceExperience() {
  const [settings, setSettings] = useState<VoiceSettings>(loadSettings);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>(loadTranscripts);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [customWakeWord, setCustomWakeWord] = useState(settings.wakeWord);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveTranscripts(transcripts); }, [transcripts]);

  // Simulate listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      setIsListening(false);
      setMicActive(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Save transcript if there was text
      if (currentTranscript.trim()) {
        const entry: TranscriptEntry = {
          id: generateId(),
          text: currentTranscript,
          timestamp: Date.now(),
          duration: Math.floor(Math.random() * 5000) + 1000,
          wordCount: currentTranscript.split(/\s+/).length,
          language: settings.language === "auto" ? "en" : settings.language,
          confidence: 0.85 + Math.random() * 0.15,
        };
        setTranscripts((prev) => [entry, ...prev]);
        setCurrentTranscript("");
      }
    } else {
      setIsListening(true);
      setMicActive(true);
      // Simulate speech recognition
      const phrases = [
        "What's on my calendar today?",
        "Remind me to call the dentist",
        "Create a new file called notes.txt",
        "What time is it?",
      ];
      let idx = 0;
      setCurrentTranscript("");
      intervalRef.current = setInterval(() => {
        const phrase = phrases[idx % phrases.length];
        setCurrentTranscript((prev) => (prev ? prev + " " : "") + phrase);
        idx++;
        if (idx >= phrases.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            setIsListening(false);
            setMicActive(false);
          }, 2000);
        }
      }, 1500);
    }
  }, [isListening, currentTranscript, settings.language]);

  const deleteTranscript = useCallback((id: string) => {
    setTranscripts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  const updateSetting = useCallback(<K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Voice Experience</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {transcripts.length} transcripts · Wake word: "{settings.wakeWord}"
          </p>
        </div>
      </div>

      {/* Live Voice Panel */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-6 text-center space-y-4">
        {/* Privacy indicator */}
        <div className={`flex items-center justify-center gap-1.5 text-[10px] font-mono ${
          settings.privacyMode ? "text-emerald-400" : "text-amber-400"
        }`}>
          <Shield className="h-3 w-3" />
          {settings.privacyMode ? "Privacy mode: Mic data stays local" : "Privacy mode: Off"}
        </div>

        {/* Waveform visualization */}
        <div className="flex items-center justify-center gap-[3px] h-12" role="img" aria-label="Voice waveform">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-all duration-150 ${
                micActive ? "bg-cyan-400" : "bg-slate-600"
              }`}
              style={{
                height: micActive
                  ? `${8 + Math.sin(i * 0.5 + Date.now() * 0.003) * 16 + Math.random() * 8}px`
                  : "4px",
              }}
            />
          ))}
        </div>

        {/* Mic button */}
        <button
          onClick={toggleListening}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            micActive
              ? "bg-cyan-500 shadow-lg shadow-cyan-500/30 animate-pulse"
              : "bg-[#0f2137] border border-[#1a2f4a] hover:bg-[#132540]"
          }`}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {micActive ? (
            <MicOff className="h-6 w-6 text-black" />
          ) : (
            <Mic className="h-6 w-6 text-cyan-400" />
          )}
        </button>

        <p className="text-[10px] text-slate-500">
          {micActive ? "Listening... tap to stop" : "Tap to speak"}
        </p>

        {/* Current transcript */}
        {currentTranscript && (
          <div className="bg-[#0f2137] rounded-lg px-4 py-3 mx-4">
            <p className="text-xs text-slate-200">{currentTranscript}</p>
          </div>
        )}

        {/* Quick controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => updateSetting("privacyMode", !settings.privacyMode)}
            className={`p-2 rounded-lg transition-colors ${settings.privacyMode ? "bg-emerald-400/15 text-emerald-400" : "bg-slate-600/15 text-slate-400"}`}
            aria-label="Toggle privacy mode"
          >
            <Shield className="h-4 w-4" />
          </button>
          <button
            onClick={() => updateSetting("interruptionEnabled", !settings.interruptionEnabled)}
            className={`p-2 rounded-lg transition-colors ${settings.interruptionEnabled ? "bg-cyan-400/15 text-cyan-400" : "bg-slate-600/15 text-slate-400"}`}
            aria-label="Toggle interruption"
          >
            {settings.interruptionEnabled ? <SkipForward className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2 bg-[#0f2137] rounded-lg px-2">
            <VolumeX className="h-3.5 w-3.5 text-slate-500" />
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.volume}
              onChange={(e) => updateSetting("volume", Number(e.target.value))}
              className="w-20 h-1 accent-cyan-400"
              aria-label="Volume"
            />
            <Volume2 className="h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Settings */}
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200">Voice Settings</h3>
          </div>

          {/* Wake Word */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase">Wake Word</label>
            <div className="flex items-center gap-2">
              <select
                value={WAKE_WORD_PRESETS.some((p) => p.value === settings.wakeWord) ? settings.wakeWord : "Custom"}
                onChange={(e) => {
                  if (e.target.value !== "Custom") updateSetting("wakeWord", e.target.value);
                }}
                className="bg-[#0f2137] border border-[#1a2f4a] rounded-md px-2 py-1.5 text-[10px] text-slate-300 outline-none"
              >
                {WAKE_WORD_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={() => updateSetting("wakeWordEnabled", !settings.wakeWordEnabled)}
                className={`relative w-9 h-5 rounded-full transition-colors ${settings.wakeWordEnabled ? "bg-cyan-500" : "bg-slate-600"}`}
                role="switch"
                aria-checked={settings.wakeWordEnabled}
                aria-label="Toggle wake word"
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.wakeWordEnabled ? "translate-x-4" : ""}`} />
              </button>
            </div>
            {settings.wakeWord === "Custom" && (
              <input
                type="text" value={customWakeWord}
                onChange={(e) => { setCustomWakeWord(e.target.value); updateSetting("wakeWord", e.target.value); }}
                placeholder="Custom wake word..."
                className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-md px-2 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none"
              />
            )}
          </div>

          {/* Push to Talk */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Push-to-Talk</span>
            <button
              onClick={() => updateSetting("pushToTalk", !settings.pushToTalk)}
              className={`relative w-9 h-5 rounded-full transition-colors ${settings.pushToTalk ? "bg-cyan-500" : "bg-slate-600"}`}
              role="switch" aria-checked={settings.pushToTalk} aria-label="Toggle push-to-talk"
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.pushToTalk ? "translate-x-4" : ""}`} />
            </button>
          </div>

          {/* Transcript Review */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Review before sending</span>
            <button
              onClick={() => updateSetting("transcriptReview", !settings.transcriptReview)}
              className={`relative w-9 h-5 rounded-full transition-colors ${settings.transcriptReview ? "bg-cyan-500" : "bg-slate-600"}`}
              role="switch" aria-checked={settings.transcriptReview} aria-label="Toggle transcript review"
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.transcriptReview ? "translate-x-4" : ""}`} />
            </button>
          </div>

          {/* Language */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase">Language</label>
            <select
              value={settings.language}
              onChange={(e) => updateSetting("language", e.target.value)}
              className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-md px-2 py-1.5 text-[10px] text-slate-300 outline-none"
            >
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          {/* Voice */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase">Voice</label>
            <select
              value={settings.voiceId}
              onChange={(e) => updateSetting("voiceId", e.target.value)}
              className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-md px-2 py-1.5 text-[10px] text-slate-300 outline-none"
            >
              {VOICE_PRESETS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>

          {/* Speed */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase">Speed: {settings.speed.toFixed(1)}x</label>
            <input
              type="range" min="0.5" max="2.0" step="0.1"
              value={settings.speed}
              onChange={(e) => updateSetting("speed", Number(e.target.value))}
              className="w-full h-1 accent-cyan-400"
            />
          </div>
        </div>

        {/* Transcript History */}
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-semibold text-slate-200">Transcript History</h3>
            </div>
            {transcripts.length > 0 && (
              <button onClick={clearTranscripts} className="text-[10px] text-slate-500 hover:text-red-400 transition-colors">
                Clear All
              </button>
            )}
          </div>

          {transcripts.length === 0 ? (
            <div className="text-center py-8">
              <Mic className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-[10px] text-slate-500">No transcripts yet</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {transcripts.map((t) => (
                <div key={t.id} className="flex items-start gap-2 px-3 py-2 rounded-md bg-[#0f2137] hover:bg-[#132540] transition-colors">
                  <Mic className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200">{t.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono text-slate-600">
                        {t.wordCount} words · {t.language}
                      </span>
                      <span className="text-[9px] font-mono text-slate-600">
                        {Math.round(t.confidence * 100)}% confidence
                      </span>
                      <span className="text-[9px] font-mono text-slate-600">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTranscript(t.id)}
                    className="p-0.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                    aria-label="Delete transcript"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceExperience;
