/**
 * Nova Local AI — Settings Panel
 * Displays model status, mode selector, and management actions.
 */

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { localAIService, type LocalAIAvailability } from "@/ai/local/LocalAIService";
import { getAIMode, setAIMode, type AIMode } from "@/ai/local/LocalAISettings";
import { DownloadModal } from "./DownloadModal";
import {
  Cpu,
  Wifi,
  WifiOff,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Zap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

const modeOptions: { value: AIMode; label: string; desc: string }[] = [
  { value: "auto", label: "Auto", desc: "Nova decides automatically" },
  { value: "local", label: "Local", desc: "Always use on-device AI" },
  { value: "gemini", label: "Gemini", desc: "Always use cloud AI" },
];

export function LocalAIPanel() {
  const [mode, setModeState] = useState<AIMode>(getAIMode());
  const [availability, setAvailability] = useState<LocalAIAvailability | null>(null);
  const [modelStatus, setModelStatus] = useState("Not installed");
  const [showDownload, setShowDownload] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const refresh = useCallback(async () => {
    const avail = await localAIService.detect();
    setAvailability(avail);
    setModelStatus(localAIService.getStatus());
  }, []);

  useEffect(() => {
    refresh();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refresh]);

  const handleModeChange = useCallback((newMode: AIMode) => {
    setModeState(newMode);
    setAIMode(newMode);
  }, []);

  const handleDeleteModel = useCallback(async () => {
    await localAIService.clearCache();
    setShowDeleteConfirm(false);
    refresh();
  }, [refresh]);

  const handleReload = useCallback(async () => {
    localAIService.unload();
    await refresh();
  }, [refresh]);

  const backend = availability?.backend || "unsupported";
  const backendLabel = backend === "webgpu" ? "WebGPU" : backend === "wasm" ? "WASM/CPU" : "N/A";
  const isReady = modelStatus === "Ready";

  const statusConfig = {
    "Not installed": { color: "#6e6e8a", icon: Download },
    Downloading: { color: "#00d4ff", icon: Loader2 },
    Loading: { color: "#8b5cf6", icon: Loader2 },
    Ready: { color: "#10b981", icon: CheckCircle2 },
    Unsupported: { color: "#f43f5e", icon: AlertCircle },
    Error: { color: "#f43f5e", icon: AlertCircle },
  };

  const config = statusConfig[modelStatus as keyof typeof statusConfig] || statusConfig["Not installed"];
  const StatusIcon = config.icon;

  return (
    <>
      <div className="space-y-4">
        {/* AI Mode Selector */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <Card className="nova-glass p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-[#00d4ff]" />
              <p className="text-sm font-medium text-[#e8e8f8]">AI Mode</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleModeChange(opt.value)}
                  className={`p-3 rounded-lg text-center transition-all ${
                    mode === opt.value
                      ? "bg-[#00d4ff]/15 border border-[#00d4ff]/40 text-[#00d4ff]"
                      : "bg-[#16162a] border border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8] hover:border-[#35355a]"
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[10px] mt-1 opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Model Status */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#8b5cf6]" />
                <p className="text-sm font-medium text-[#e8e8f8]">Nova Local AI</p>
              </div>
              <Badge
                className="text-[10px] border-0"
                style={{ backgroundColor: `${config.color}15`, color: config.color }}
              >
                {modelStatus}
              </Badge>
            </div>

            <div className="space-y-2 text-xs text-[#6e6e8a]">
              <div className="flex justify-between">
                <span>Model</span>
                <span className="text-[#e8e8f8]">Qwen3 0.6B</span>
              </div>
              <div className="flex justify-between">
                <span>Runtime</span>
                <span className="text-[#e8e8f8]">{backendLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Online</span>
                <span className={isOnline ? "text-[#10b981]" : "text-[#f59e0b]"}>
                  {isOnline ? "Yes" : "No (offline)"}
                </span>
              </div>
              {availability?.estimatedPerformance && (
                <div className="flex justify-between">
                  <span>Device tier</span>
                  <span className="text-[#e8e8f8] capitalize">
                    {availability.estimatedPerformance}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              {!isReady ? (
                <Button
                  onClick={() => setShowDownload(true)}
                  disabled={!availability?.supported}
                  className="flex-1 bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold text-xs h-9"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download Model
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleReload}
                    variant="outline"
                    className="border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8] text-xs h-9"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Reload
                  </Button>
                  {!showDeleteConfirm ? (
                    <Button
                      onClick={() => setShowDeleteConfirm(true)}
                      variant="ghost"
                      className="text-[#6e6e8a] hover:text-[#f43f5e] text-xs h-9"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        onClick={handleDeleteModel}
                        className="bg-[#f43f5e] text-white text-xs h-9"
                      >
                        Confirm Delete
                      </Button>
                      <Button
                        onClick={() => setShowDeleteConfirm(false)}
                        variant="ghost"
                        className="text-[#6e6e8a] text-xs h-9"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {availability && !availability.supported && (
              <div className="mt-3 p-2 rounded-lg bg-[#16162a] text-[10px] text-[#6e6e8a]">
                {availability.reason || "Local AI is not supported on this device."}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Privacy Note */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <Card className="nova-glass p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 flex items-center justify-center shrink-0">
                <WifiOff className="w-4 h-4 text-[#10b981]" />
              </div>
              <div>
                <p className="text-xs font-medium text-[#e8e8f8]">Privacy-First Design</p>
                <p className="text-[10px] text-[#6e6e8a] mt-1 leading-relaxed">
                  When using Local AI, your messages never leave this device.
                  The model runs entirely in your browser. No data is sent to any server.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      <DownloadModal
        open={showDownload}
        onClose={() => {
          setShowDownload(false);
          refresh();
        }}
      />
    </>
  );
}
