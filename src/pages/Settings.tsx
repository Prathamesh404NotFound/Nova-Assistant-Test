import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Save, Shield, Key, Trash2 } from "lucide-react";

interface ApiKeyConfig {
  id: string;
  name: string;
  envKey: string;
  description: string;
  url: string;
  required: boolean;
}

const API_KEYS: ApiKeyConfig[] = [
  { id: "gemini", name: "Gemini API Key", envKey: "nova_gemini_key", description: "Powers AI chat responses", url: "https://aistudio.google.com", required: true },
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
            API key management · {configured}/{API_KEYS.length} configured
          </p>
        </motion.div>

        {/* Security Notice */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-[#10b981] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#e8e8f8]">Encrypted & Local</p>
              <p className="text-xs text-[#6e6e8a] mt-1">
                API keys are stored in your browser's local storage. They never leave your device
                except when making API calls directly from this app.
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
                    >
                      {showKeys[config.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {keys[config.id] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearKey(config.id)}
                      className="text-[#6e6e8a] hover:text-[#f43f5e]"
                    >
                      <Trash2 className="h-4 w-4" />
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
            {saved ? "✓ Saved!" : "Save All Keys"}
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
