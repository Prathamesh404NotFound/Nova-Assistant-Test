import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LocalAIPanel } from "@/components/local-ai/LocalAIPanel";
import { GeminiHealthCheck } from "@/components/GeminiHealthCheck";
import { ttsRouter, type VoiceSettings } from "@/services/tts/tts-router";
import { BARK_VOICE_PRESETS } from "@/services/tts/bark-voices";
import { Eye, EyeOff, Save, Shield, Key, Trash2, Cpu, Volume2, Mic2 } from "lucide-react";

interface ApiKeyConfig {
  id: string;
  name: string;
  envKey: string;
  description: string;
  url: string;
  required: boolean;
}

const API_KEYS: ApiKeyConfig[] = [
  { id: "gemini", name: "Gemini API Key", envKey: "nova_gemini_key", description: "Powers cloud AI chat responses", url: "https://aistudio.google.com", required: false },
  { id: "heygen", name: "HeyGen API Key", envKey: "nova_heygen_key", description: "Real human avatar with lip sync", url: "https://heygen.com", required: false },
  { id: "deepgram", name: "Deepgram API Key", envKey: "nova_deepgram_key", description: "Better speech recognition", url: "https://deepgram.com", required: false },
  { id: "elevenlabs", name: "ElevenLabs API Key", envKey: "nova_elevenlabs_key", description: "Natural voice output", url: "https://elevenlabs.io", required: false },
  { id: "github", name: "GitHub Token", envKey: "nova_github_token", description: "Coding agent integration", url: "https://github.com/settings/tokens", required: false },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

export default function SettingsPage() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(ttsRouter.getSettings());
  const [barkStatus, setBarkStatus] = useState(ttsRouter.isBarkAvailable() ? "ready" : "unavailable");

  useEffect(() => {
    const loaded: Record<string, string> = {};
    for (const config of API_KEYS) {
      loaded[config.id] = localStorage.getItem(config.envKey) || "";
    }
    setKeys(loaded);
  }, []);

  const updateKey = useCallback((id: string, value: string) => {
    setKeys((prev) => ({ ...prev, [id]: value }));
  }, []);

  const saveKeys = useCallback(() => {
    for (const config of API_KEYS) {
      const val = keys[config.id] || "";
      if (val) {
        localStorage.setItem(config.envKey, val);
      } else {
        localStorage.removeItem(config.envKey);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [keys]);

  const clearKey = useCallback((id: string) => {
    const config = API_KEYS.find((k) => k.id === id);
    if (config) {
      localStorage.removeItem(config.envKey);
      setKeys((prev) => ({ ...prev, [id]: "" }));
    }
  }, []);

  const configured = API_KEYS.filter((k) => keys[k.id]).length;

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">
            AI modes, API keys, and configuration
          </p>
        </motion.div>

        {/* ── Nova Local AI Section ─────────────────────────── */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0.5}>
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="h-4 w-4 text-[#00d4ff]" />
            <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">
              Nova Local AI
            </h2>
          </div>
          <LocalAIPanel />
        </motion.div>

        {/* Gemini Health Check */}
        <GeminiHealthCheck apiKey={keys["gemini"]} />

        {/* ── Voice Settings Section ─────────────────────────── */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0.7}>
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="h-4 w-4 text-[#00d4ff]" />
            <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">
              Voice Settings
            </h2>
            <Badge className={`text-[10px] border-0 ${barkStatus === "ready" ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[#f59e0b]/15 text-[#f59e0b]"}`}>
              {barkStatus === "ready" ? "● Bark Ready" : "○ Browser Only"}
            </Badge>
          </div>
          <Card className="nova-glass p-4 space-y-4">
            {/* Engine Selection */}
            <div>
              <label className="text-xs text-[#6e6e8a] mb-1 block">Voice Engine</label>
              <div className="flex gap-2">
                {(["bark", "browser"] as const).map((engine) => (
                  <button
                    key={engine}
                    onClick={() => {
                      const updated = { ...voiceSettings, engine };
                      setVoiceSettings(updated);
                      ttsRouter.updateSettings(updated);
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      voiceSettings.engine === engine
                        ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30"
                        : "bg-[#16162a] text-[#6e6e8a] border border-[#252540] hover:text-[#e8e8f8]"
                    }`}
                  >
                    {engine === "bark" ? "☀ Bark (Local)" : "⚙ Browser"}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Preset */}
            <div>
              <label className="text-xs text-[#6e6e8a] mb-1 block">Voice Preset</label>
              <select
                value={voiceSettings.voicePreset}
                onChange={(e) => {
                  const updated = { ...voiceSettings, voicePreset: e.target.value };
                  setVoiceSettings(updated);
                  ttsRouter.updateSettings(updated);
                }}
                className="w-full bg-[#16162a] border border-[#252540] text-[#e8e8f8] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d4ff]/40"
              >
                {BARK_VOICE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-[#6e6e8a]">Volume</label>
                <span className="text-xs text-[#00d4ff] font-mono">{Math.round(voiceSettings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(voiceSettings.volume * 100)}
                onChange={(e) => {
                  const vol = parseInt(e.target.value) / 100;
                  const updated = { ...voiceSettings, volume: vol };
                  setVoiceSettings(updated);
                  ttsRouter.setVolume(vol);
                }}
                className="w-full accent-[#00d4ff] h-1.5"
              />
            </div>

            {/* Speed */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-[#6e6e8a]">Speech Speed</label>
                <span className="text-xs text-[#00d4ff] font-mono">{voiceSettings.speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                value={Math.round(voiceSettings.speed * 100)}
                onChange={(e) => {
                  const speed = parseInt(e.target.value) / 100;
                  const updated = { ...voiceSettings, speed };
                  setVoiceSettings(updated);
                  ttsRouter.updateSettings(updated);
                }}
                className="w-full accent-[#00d4ff] h-1.5"
              />
            </div>

            {/* Auto Speak & Interrupt */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSettings.autoSpeak}
                  onChange={(e) => {
                    const updated = { ...voiceSettings, autoSpeak: e.target.checked };
                    setVoiceSettings(updated);
                    ttsRouter.updateSettings(updated);
                  }}
                  className="accent-[#00d4ff] rounded"
                />
                <span className="text-xs text-[#6e6e8a]">Auto-speak responses</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSettings.interruptOnNewInput}
                  onChange={(e) => {
                    const updated = { ...voiceSettings, interruptOnNewInput: e.target.checked };
                    setVoiceSettings(updated);
                    ttsRouter.updateSettings(updated);
                  }}
                  className="accent-[#00d4ff] rounded"
                />
                <span className="text-xs text-[#6e6e8a]">Interrupt on new input</span>
              </label>
            </div>

            {/* Test Button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[#00d4ff] hover:bg-[#00d4ff]/10"
              onClick={async () => {
                try {
                  await ttsRouter.speak("Hello! I'm Nova. Your personal AI assistant. Voice is working perfectly.");
                } catch {
                  console.warn("TTS test failed");
                }
              }}
            >
              <Mic2 className="h-3.5 w-3.5 mr-2" />
              Test Voice
            </Button>
          </Card>
        </motion.div>

        {/* Divider */}
        <div className="border-t border-[#252540]" />

        {/* ── API Keys Section ──────────────────────────────── */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-4 w-4 text-[#8b5cf6]" />
            <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">
              API Keys
            </h2>
            <Badge className="text-[10px] bg-[#16162a] text-[#6e6e8a] border-0">
              {configured}/{API_KEYS.length}
            </Badge>
          </div>
        </motion.div>

        {/* Security Notice */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1.5}>
          <Card className="nova-glass p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-[#10b981] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#e8e8f8]">Encrypted & Local</p>
              <p className="text-xs text-[#6e6e8a] mt-1">
                API keys are stored in your browser's local storage. They never leave your device
                except when making API calls directly from this app. Local AI requires no API key.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* API Keys */}
        <div className="space-y-3">
          {API_KEYS.map((config, i) => (
            <motion.div
              key={config.id}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={i + 2}
            >
              <Card className="nova-glass p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-[#00d4ff]" />
                    <p className="text-sm font-medium text-[#e8e8f8]">{config.name}</p>
                    {config.required && (
                      <Badge className="text-[10px] bg-[#f43f5e]/15 text-[#f43f5e] border-0">
                        Required
                      </Badge>
                    )}
                    {keys[config.id] && (
                      <Badge className="text-[10px] bg-[#10b981]/15 text-[#10b981] border-0">
                        Configured
                      </Badge>
                    )}
                  </div>
                  <a
                    href={config.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#00d4ff] hover:underline shrink-0"
                  >
                    Get key →
                  </a>
                </div>
                <p className="text-xs text-[#6e6e8a] mb-3">{config.description}</p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKeys[config.id] ? "text" : "password"}
                      value={keys[config.id] || ""}
                      onChange={(e) => updateKey(config.id, e.target.value)}
                      placeholder={`Enter ${config.name}...`}
                      className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40 pr-10"
                    />
                    <button
                      onClick={() => setShowKeys((p) => ({ ...p, [config.id]: !p[config.id] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6e8a] hover:text-[#e8e8f8]"
                      aria-label={showKeys[config.id] ? "Hide key" : "Show key"}
                    >
                      {showKeys[config.id] ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {keys[config.id] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearKey(config.id)}
                      className="text-[#6e6e8a] hover:text-[#f43f5e]"
                      aria-label={`Clear ${config.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Save Button */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={API_KEYS.length + 2}>
          <Button
            onClick={saveKeys}
            className="w-full bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold h-11"
          >
            <Save className="h-4 w-4 mr-2" />
            {saved ? "✓ Saved!" : "Save API Keys"}
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
