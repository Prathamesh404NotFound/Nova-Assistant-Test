/**
 * Nova AI OS — TTS Configuration
 * Indic Parler TTS integration with speaker selection, language support,
 * voice preview, backend configuration, and playback controls.
 */

import { useState, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  Mic,
  Play,
  Pause,
  Globe,
  Sliders,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Languages,
  AudioWaveform,
} from "lucide-react";
import { useIndicTTS } from "@/hooks/use-indic-tts";
import {
  INDIC_SPEAKERS,
  getAvailableBackends,
  type IndicLanguage,
  type SpeakerProfile,
  type TTSBackend,
} from "@/services/tts/tts-adapter";

const LANGUAGES: { code: IndicLanguage; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
];

const PREVIEW_TEXTS: Record<string, string> = {
  en: "Hello! I'm Nova, your personal AI assistant. How can I help you today?",
  hi: "नमस्ते! मैं नोवा हूँ, आपकी व्यक्तिगत AI सहायक। आज मैं आपकी कैसे मदद कर सकती हूँ?",
  mr: "नमस्कार! मी नोवा आहे, तुमची वैयक्तिक AI सहाय्यक। आज मी तुम्हाला कशी मदत करू शकते?",
  bn: "হ্যালো! আমি নোভা, আপনার ব্যক্তিগত AI সহকারী। আজ আমি আপনাকে কিভাবে সাহায্য করতে পারি?",
  ta: "வணக்கம்! நான் நோவா, உங்கள் தனிப்பட்ட AI உதவியாளர். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
  te: "హలో! నేను నోవా, మీ వ్యక్తిగత AI సహాయకుడిని. ఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను?",
  kn: "ನಮಸ್ಕಾರ! ನಾನು ನೋವಾ, ನಿಮ್ಮ ವೈಯಕ್ತಿಕ AI ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
  ml: "ഹലോ! ഞാൻ നോവ, നിങ്ങളുടെ വ്യക്തിഗത AI സഹായകൻ. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?",
  gu: "નમસ્તે! હું નોવા છું, તમારી વ્યક્તિગત AI સહાયક. આજે હું તમને કેવી રીતે મદદ કરી શકું?",
  pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਨੋਵਾ ਹਾਂ, ਤੁਹਾਡੀ ਨਿੱਜੀ AI ਸਹਾਇਕ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?",
  ur: "السلام علیکم! میں نووا ہوں، آپ کا ذاتی AI معاون۔ آج میں آپ کی کیسے مدد کر سکتی ہوں؟",
  or: "ନମସ୍କାର! ମୁଁ ନୋଭା, ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ AI ସହାୟକ। ଆଜି ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
};

export default function TTSConfigPage() {
  const tts = useIndicTTS({ autoPlay: false });
  const { config, state, speak, stop, pause, resume, updateConfig, setLanguage, setSpeaker } = tts;
  const [previewText, setPreviewText] = useState(
    PREVIEW_TEXTS[config.language] || PREVIEW_TEXTS.en
  );
  const [showApiConfig, setShowApiConfig] = useState(false);

  const backends = getAvailableBackends(config);
  const filteredSpeakers = INDIC_SPEAKERS.filter(
    (s) => s.language === config.language || s.language === "auto"
  );

  const handlePreview = useCallback(async () => {
    if (state.isPlaying) {
      stop();
    } else {
      await speak(previewText);
    }
  }, [state.isPlaying, stop, speak, previewText]);

  const handleLanguageChange = useCallback(
    (lang: IndicLanguage) => {
      setLanguage(lang);
      setPreviewText(PREVIEW_TEXTS[lang] || PREVIEW_TEXTS.en);
    },
    [setLanguage]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <AudioWaveform className="h-5 w-5 text-cyan-400" />
          Indic Parler TTS
        </h2>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
          Multilingual voice synthesis — ai4bharat/indic-parler-tts
        </p>
      </div>

      {/* Backend Status */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200">Backend Status</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {backends.map((b) => (
            <div
              key={b.backend}
              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                config.backend === b.backend && b.available
                  ? "bg-cyan-500/10 border-cyan-500/30"
                  : "bg-[#0f2137] border-[#1a2f4a]"
              }`}
            >
              {b.available ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
              <div className="min-w-0">
                <button
                  onClick={() => b.available && updateConfig("backend", b.backend)}
                  className="text-xs font-medium text-slate-200 text-left block"
                  disabled={!b.available}
                >
                  {b.backend === "gemini"
                    ? "Gemini TTS"
                    : b.backend === "huggingface"
                    ? "Indic Parler"
                    : "Browser"}
                </button>
                <p className="text-[9px] text-slate-500 truncate">{b.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Language Selection */}
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200">Language</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex flex-col items-start p-2 rounded-lg text-left transition-colors ${
                  config.language === lang.code
                    ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400"
                    : "bg-[#0f2137] border border-transparent text-slate-300 hover:bg-[#132540]"
                }`}
              >
                <span className="text-[10px] font-semibold">{lang.label}</span>
                <span className="text-[9px] text-slate-500">{lang.native}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Speaker Selection */}
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mic className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200">Speaker</h3>
          </div>
          <div className="space-y-1.5">
            {filteredSpeakers.map((speaker) => (
              <button
                key={speaker.id}
                onClick={() => setSpeaker(speaker)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                  config.speaker.id === speaker.id
                    ? "bg-cyan-500/15 border border-cyan-500/30"
                    : "bg-[#0f2137] border border-transparent hover:bg-[#132540]"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    speaker.gender === "female"
                      ? "bg-pink-500/20 text-pink-400"
                      : speaker.gender === "male"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-slate-600/20 text-slate-400"
                  }`}
                >
                  {speaker.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200">{speaker.name}</p>
                  <p className="text-[9px] text-slate-500 truncate">{speaker.description}</p>
                </div>
                {config.speaker.id === speaker.id && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice Controls */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200">Voice Controls</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Speed */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase">
              Speed: {config.speed.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={config.speed}
              onChange={(e) => updateConfig("speed", Number(e.target.value))}
              className="w-full h-1 accent-cyan-400"
            />
          </div>
          {/* Pitch */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase">
              Pitch: {config.pitch.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={config.pitch}
              onChange={(e) => updateConfig("pitch", Number(e.target.value))}
              className="w-full h-1 accent-cyan-400"
            />
          </div>
          {/* Expressiveness */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase">
              Expressiveness: {Math.round(config.expressiveness * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.expressiveness}
              onChange={(e) => updateConfig("expressiveness", Number(e.target.value))}
              className="w-full h-1 accent-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Preview & Playback */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200">Preview</h3>
        </div>

        <textarea
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="Type text to preview the voice..."
          rows={3}
          className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/40 resize-none"
        />

        {/* Progress bar */}
        {state.isGenerating && (
          <div className="w-full bg-[#1a2f4a] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        )}

        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            disabled={state.isGenerating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              state.isPlaying
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : state.isGenerating
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse"
                : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
            }`}
          >
            {state.isPlaying ? (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                Stop
              </>
            ) : state.isGenerating ? (
              <>
                <span className="animate-spin">⏳</span>
                Generating...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Preview Voice
              </>
            )}
          </button>

          {state.isPlaying && (
            <button
              onClick={pause}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-slate-300 bg-[#0f2137] border border-[#1a2f4a] hover:bg-[#132540]"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </button>
          )}

          {!state.isPlaying && state.lastResult && state.lastResult.backend !== "browser" && (
            <button
              onClick={resume}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-slate-300 bg-[#0f2137] border border-[#1a2f4a] hover:bg-[#132540]"
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </button>
          )}
        </div>

        {/* Status */}
        {state.error && (
          <p className="text-[10px] text-red-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {state.error}
          </p>
        )}

        {state.lastResult && !state.error && (
          <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
            <span>Backend: {state.lastResult.backend}</span>
            <span>Duration: {state.lastResult.duration}ms</span>
            <span>Chars: {state.lastResult.textLength}</span>
          </div>
        )}
      </div>

      {/* API Configuration (expandable) */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg">
        <button
          onClick={() => setShowApiConfig(!showApiConfig)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200">API Configuration</h3>
          </div>
          <span className="text-[10px] text-slate-500">
            {showApiConfig ? "▲ Collapse" : "▼ Expand"}
          </span>
        </button>

        {showApiConfig && (
          <div className="px-4 pb-4 space-y-3 border-t border-[#1a2f4a] pt-3">
            {/* HuggingFace Token */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 uppercase">
                HuggingFace API Token
              </label>
              <input
                type="password"
                value={config.hfToken}
                onChange={(e) => updateConfig("hfToken", e.target.value)}
                placeholder="hf_..."
                className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-md px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/40"
              />
              <p className="text-[9px] text-slate-600">
                Required for Indic Parler TTS. Get one at huggingface.co/settings/tokens
              </p>
            </div>

            {/* HF Endpoint */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 uppercase">
                HuggingFace Endpoint
              </label>
              <input
                type="text"
                value={config.hfEndpoint}
                onChange={(e) => updateConfig("hfEndpoint", e.target.value)}
                className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-md px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500/40"
              />
              <p className="text-[9px] text-slate-600">
                Default: HF Inference API. For self-hosted, use your own endpoint URL.
              </p>
            </div>

            {/* Gemini Key (read-only, from env) */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 uppercase">
                Gemini API Key
              </label>
              <input
                type="text"
                value={config.geminiKey ? "••••" + config.geminiKey.slice(-4) : ""}
                readOnly
                className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-md px-3 py-2 text-xs text-slate-400 outline-none"
              />
              <p className="text-[9px] text-slate-600">
                {config.geminiKey
                  ? "Loaded from VITE_GEMINI_API_KEY or localStorage"
                  : "No Gemini key configured — Gemini TTS unavailable"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
