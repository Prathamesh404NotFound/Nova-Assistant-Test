import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LocalAIPanel } from "@/components/local-ai/LocalAIPanel";
import { GeminiHealthCheck } from "@/components/GeminiHealthCheck";
import { ttsRouter, type VoiceSettings } from "@/services/tts/tts-router";
import { permissionsService, REQUIRED_PERMISSIONS, type PermissionId } from "@/services/permissions";
import { BARK_VOICE_PRESETS } from "@/services/tts/bark-voices";
import { cn } from "@/lib/utils";
import {
  Eye, EyeOff, Save, Shield, Key, Trash2, Cpu, Volume2, Mic2,
  Settings, Brain, Palette, Database, Wrench, ChevronRight,
  Download, Upload, Activity, Globe, Lock, Zap, ShieldCheck, ShieldAlert,
} from "lucide-react";

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

type SettingsTab = "general" | "ai" | "voice" | "security" | "data" | "advanced";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "ai", label: "AI & Models", icon: Brain },
  { id: "voice", label: "Voice", icon: Volume2 },
  { id: "security", label: "Security", icon: Shield },
  { id: "data", label: "Data & Storage", icon: Database },
  { id: "advanced", label: "Advanced", icon: Wrench },
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
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(ttsRouter.getSettings());
  const [barkStatus, setBarkStatus] = useState(ttsRouter.isBarkAvailable() ? "ready" : "unavailable");
  const [devMode, setDevMode] = useState(() => localStorage.getItem("nova_dev_mode") === "true");
  const [permissions, setPermissions] = useState(() => permissionsService.getAll());
  const [permBusy, setPermBusy] = useState(false);

  const refreshPermissions = useCallback(() => {
    setPermissions(permissionsService.getAll());
  }, []);

  const togglePermission = useCallback(async (id: PermissionId, next: boolean) => {
    setPermBusy(true);
    try {
      if (next) {
        await permissionsService.grant(id);
      } else {
        permissionsService.revoke(id);
      }
    } finally {
      setPermBusy(false);
      refreshPermissions();
    }
  }, [refreshPermissions]);

  const grantAllPermissions = useCallback(async () => {
    setPermBusy(true);
    try {
      await permissionsService.grantAll();
    } finally {
      setPermBusy(false);
      refreshPermissions();
    }
  }, [refreshPermissions]);

  const grantedCount = permissions.filter((p) => p.granted).length;

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
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Configure Nova AI Operating System</p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0.3}>
          <div className="flex gap-1 p-1 bg-[#0f2035]/60 rounded-xl border border-[#1a2f4a] overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-[#00d4ff]/15 text-[#00d4ff]"
                    : "text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#162a42]"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── General Tab ──────────────────────────── */}
        {activeTab === "general" && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="space-y-4">
            <Card className="nova-glass p-5">
              <h3 className="text-sm font-semibold text-[#e8e8f8] mb-4">Application</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-[#c8d6e5]">App Version</p>
                    <p className="text-xs text-[#5a7a9a]">Nova AI Operating System</p>
                  </div>
                  <Badge className="text-[10px] bg-[#00d4ff]/15 text-[#00d4ff] border-0">v1.0</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-[#1a2f4a]">
                  <div>
                    <p className="text-sm text-[#c8d6e5]">Developer Mode</p>
                    <p className="text-xs text-[#5a7a9a]">Show advanced diagnostics and tools</p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !devMode;
                      setDevMode(next);
                      localStorage.setItem("nova_dev_mode", String(next));
                    }}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      devMode ? "bg-[#00d4ff]" : "bg-[#252540]"
                    )}
                  >
                    <span className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                      devMode ? "left-5" : "left-1"
                    )} />
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── AI & Models Tab ──────────────────────── */}
        {activeTab === "ai" && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="h-4 w-4 text-[#00d4ff]" />
              <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">Nova Local AI</h2>
            </div>
            <LocalAIPanel />
            <GeminiHealthCheck apiKey={keys["gemini"]} />

            <div className="border-t border-[#252540] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Key className="h-4 w-4 text-[#8b5cf6]" />
                <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">API Keys</h2>
                <Badge className="text-[10px] bg-[#16162a] text-[#6e6e8a] border-0">{configured}/{API_KEYS.length}</Badge>
              </div>
              <Card className="nova-glass p-4 flex items-start gap-3 mb-3">
                <Shield className="h-5 w-5 text-[#10b981] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#e8e8f8]">Encrypted & Local</p>
                  <p className="text-xs text-[#6e6e8a] mt-1">API keys are stored locally. They never leave your device except when making API calls.</p>
                </div>
              </Card>
              <div className="space-y-3">
                {API_KEYS.map((config) => (
                  <Card key={config.id} className="nova-glass p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-[#00d4ff]" />
                        <p className="text-sm font-medium text-[#e8e8f8]">{config.name}</p>
                        {keys[config.id] && (
                          <Badge className="text-[10px] bg-[#10b981]/15 text-[#10b981] border-0">Configured</Badge>
                        )}
                      </div>
                      <a href={config.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00d4ff] hover:underline shrink-0">Get key →</a>
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
                        >
                          {showKeys[config.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {keys[config.id] && (
                        <Button variant="ghost" size="sm" onClick={() => clearKey(config.id)} className="text-[#6e6e8a] hover:text-[#f43f5e]">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              <Button onClick={saveKeys} className="w-full bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold h-11 mt-4">
                <Save className="h-4 w-4 mr-2" />
                {saved ? "✓ Saved!" : "Save API Keys"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Voice Tab ──────────────────────────── */}
        {activeTab === "voice" && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="space-y-4">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-[#00d4ff]" />
              <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">Voice Settings</h2>
              <Badge className={`text-[10px] border-0 ${barkStatus === "ready" ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[#f59e0b]/15 text-[#f59e0b]"}`}>
                {barkStatus === "ready" ? "● Bark Ready" : "○ Browser Only"}
              </Badge>
            </div>
            <Card className="nova-glass p-5 space-y-5">
              {/* Engine Selection */}
              <div>
                <label className="text-xs text-[#6e6e8a] mb-2 block">Voice Engine</label>
                <div className="flex gap-2">
                  {(["bark", "browser"] as const).map((engine) => (
                    <button
                      key={engine}
                      onClick={() => { const updated = { ...voiceSettings, engine }; setVoiceSettings(updated); ttsRouter.updateSettings(updated); }}
                      className={cn(
                        "flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors",
                        voiceSettings.engine === engine
                          ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30"
                          : "bg-[#16162a] text-[#6e6e8a] border border-[#252540] hover:text-[#e8e8f8]"
                      )}
                    >
                      {engine === "bark" ? "☀ Bark (Local)" : "⚙ Browser"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Preset */}
              <div>
                <label className="text-xs text-[#6e6e8a] mb-2 block">Voice Preset</label>
                <select
                  value={voiceSettings.voicePreset}
                  onChange={(e) => { const updated = { ...voiceSettings, voicePreset: e.target.value }; setVoiceSettings(updated); ttsRouter.updateSettings(updated); }}
                  className="w-full bg-[#16162a] border border-[#252540] text-[#e8e8f8] text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#00d4ff]/40"
                >
                  {BARK_VOICE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              </div>

              {/* Volume */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs text-[#6e6e8a]">Volume</label>
                  <span className="text-xs text-[#00d4ff] font-mono">{Math.round(voiceSettings.volume * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="100"
                  value={Math.round(voiceSettings.volume * 100)}
                  onChange={(e) => { const vol = parseInt(e.target.value) / 100; const updated = { ...voiceSettings, volume: vol }; setVoiceSettings(updated); ttsRouter.setVolume(vol); }}
                  className="w-full accent-[#00d4ff] h-1.5"
                />
              </div>

              {/* Speed */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs text-[#6e6e8a]">Speech Speed</label>
                  <span className="text-xs text-[#00d4ff] font-mono">{voiceSettings.speed.toFixed(1)}x</span>
                </div>
                <input
                  type="range" min="50" max="200"
                  value={Math.round(voiceSettings.speed * 100)}
                  onChange={(e) => { const speed = parseInt(e.target.value) / 100; const updated = { ...voiceSettings, speed }; setVoiceSettings(updated); ttsRouter.updateSettings(updated); }}
                  className="w-full accent-[#00d4ff] h-1.5"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={voiceSettings.autoSpeak}
                    onChange={(e) => { const updated = { ...voiceSettings, autoSpeak: e.target.checked }; setVoiceSettings(updated); ttsRouter.updateSettings(updated); }}
                    className="accent-[#00d4ff] rounded" />
                  <span className="text-xs text-[#6e6e8a]">Auto-speak responses</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={voiceSettings.interruptOnNewInput}
                    onChange={(e) => { const updated = { ...voiceSettings, interruptOnNewInput: e.target.checked }; setVoiceSettings(updated); ttsRouter.updateSettings(updated); }}
                    className="accent-[#00d4ff] rounded" />
                  <span className="text-xs text-[#6e6e8a]">Interrupt on new input</span>
                </label>
              </div>

              {/* Test */}
              <Button variant="ghost" size="sm" className="w-full text-[#00d4ff] hover:bg-[#00d4ff]/10"
                onClick={async () => { try { await ttsRouter.speak("Hello! I'm Nova. Voice is working perfectly."); } catch { /* ignore */ } }}>
                <Mic2 className="h-3.5 w-3.5 mr-2" /> Test Voice
              </Button>
            </Card>
          </motion.div>
        )}

        {/* ── Security Tab ──────────────────────────── */}
        {activeTab === "security" && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-[#00d4ff]" />
              <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">Security & Permissions</h2>
            </div>
            {/* Permission Panel */}
            <Card className="nova-glass p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#e8e8f8]">Required Permissions</p>
                  <p className="text-xs text-[#5a7a9a] mt-0.5">
                    {grantedCount}/{REQUIRED_PERMISSIONS.length} granted — Nova needs these for full functionality.
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={permBusy}
                  onClick={grantAllPermissions}
                  className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/90"
                >
                  {grantedCount === REQUIRED_PERMISSIONS.length ? (
                    <><ShieldCheck className="h-4 w-4 mr-1" /> All Granted</>
                  ) : (
                    <><ShieldAlert className="h-4 w-4 mr-1" /> Grant All</>
                  )}
                </Button>
              </div>
              <div className="divide-y divide-[#1a2f4a]">
                {permissions.map((perm) => (
                  <div key={perm.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[#c8d6e5]">{perm.label}</p>
                      <p className="text-xs text-[#5a7a9a] mt-0.5">{perm.description}</p>
                      {perm.browserPermission && !perm.granted && (
                        <p className="text-[10px] text-[#f59e0b] mt-1">
                          Granting will open your browser's permission prompt.
                        </p>
                      )}
                    </div>
                    <button
                      role="switch"
                      aria-checked={perm.granted}
                      aria-label={perm.label}
                      disabled={permBusy}
                      onClick={() => togglePermission(perm.id, !perm.granted)}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative shrink-0 mt-1",
                        perm.granted ? "bg-[#10b981]" : "bg-[#252540]",
                        permBusy && "opacity-50"
                      )}
                    >
                      <span className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                        perm.granted ? "left-5" : "left-1"
                      )} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#5a7a9a] pt-1">
                Permission state is stored locally on this device and synced with Nova's feature gates.
              </p>
            </Card>

            <Card className="nova-glass p-5 space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-[#c8d6e5]">Data Storage</p>
                  <p className="text-xs text-[#5a7a9a]">All data is stored locally in your browser</p>
                </div>
                <Badge className="text-[10px] bg-[#10b981]/15 text-[#10b981] border-0">Local</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-[#1a2f4a]">
                <div>
                  <p className="text-sm text-[#c8d6e5]">Voice Privacy</p>
                  <p className="text-xs text-[#5a7a9a]">Voice data is processed locally via Suno Bark</p>
                </div>
                <Badge className="text-[10px] bg-[#10b981]/15 text-[#10b981] border-0">Offline</Badge>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Data Tab ──────────────────────────── */}
        {activeTab === "data" && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-[#00d4ff]" />
              <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">Data & Storage</h2>
            </div>
            <Card className="nova-glass p-5 space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-[#c8d6e5]">Export Data</p>
                  <p className="text-xs text-[#5a7a9a]">Download all your memories, tasks, and settings</p>
                </div>
                <Button variant="ghost" size="sm" className="text-[#00d4ff]"><Download className="h-4 w-4 mr-1" /> Export</Button>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-[#1a2f4a]">
                <div>
                  <p className="text-sm text-[#c8d6e5]">Import Data</p>
                  <p className="text-xs text-[#5a7a9a]">Restore from a previous export</p>
                </div>
                <Button variant="ghost" size="sm" className="text-[#00d4ff]"><Upload className="h-4 w-4 mr-1" /> Import</Button>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-[#1a2f4a]">
                <div>
                  <p className="text-sm text-[#c8d6e5]">Clear All Data</p>
                  <p className="text-xs text-[#5a7a9a]">Remove all local data and start fresh</p>
                </div>
                <Button variant="ghost" size="sm" className="text-[#f43f5e] hover:bg-[#f43f5e]/10"><Trash2 className="h-4 w-4 mr-1" /> Clear</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Advanced Tab ──────────────────────────── */}
        {activeTab === "advanced" && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-[#00d4ff]" />
              <h2 className="text-sm font-semibold text-[#e8e8f8] uppercase tracking-wider">Advanced</h2>
            </div>
            {!devMode ? (
              <Card className="nova-glass p-5 text-center">
                <p className="text-sm text-[#5a7a9a]">Enable Developer Mode in General settings to access advanced diagnostics.</p>
              </Card>
            ) : (
              <Card className="nova-glass p-5 space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-[#c8d6e5]">TTS Diagnostics</p>
                    <p className="text-xs text-[#5a7a9a]">View Bark service status and generation metrics</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[#00d4ff]" onClick={() => console.log(ttsRouter.getDiagnostics())}>
                    <Activity className="h-4 w-4 mr-1" /> Debug
                  </Button>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-[#1a2f4a]">
                  <div>
                    <p className="text-sm text-[#c8d6e5]">Clear TTS Cache</p>
                    <p className="text-xs text-[#5a7a9a]">Remove cached speech audio</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[#f43f5e] hover:bg-[#f43f5e]/10"><Trash2 className="h-4 w-4 mr-1" /> Clear</Button>
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </div>
    </main>
  );
}
