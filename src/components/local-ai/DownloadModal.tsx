/**
 * Nova Local AI — Download Modal
 * Polished onboarding experience for downloading the local AI model.
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { localAIService, type LocalAIAvailability } from "@/ai/local/LocalAIService";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Cpu,
  Globe,
  Shield,
} from "lucide-react";

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

type DownloadState = "idle" | "downloading" | "installing" | "ready" | "error";

interface Progress {
  loaded: number;
  total: number;
  percent: number;
}

export function DownloadModal({ open, onClose, onComplete }: DownloadModalProps) {
  const [state, setState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState<Progress>({ loaded: 0, total: 0, percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<LocalAIAvailability | null>(null);

  useEffect(() => {
    if (open) {
      localAIService.detect().then(setAvailability);
      // Check if already ready
      localAIService.isCached().then((cached) => {
        if (cached) setState("ready");
      });
    }
  }, [open]);

  const handleDownload = useCallback(async () => {
    setState("downloading");
    setError(null);
    setProgress({ loaded: 0, total: 0, percent: 0 });

    try {
      await localAIService.downloadModel((p) => {
        setProgress(p);
      });
      setState("installing");
      // Brief pause for "installing" state
      await new Promise((r) => setTimeout(r, 500));
      setState("ready");
      onComplete?.();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }, [onComplete]);

  const handleDelete = useCallback(async () => {
    await localAIService.clearCache();
    setState("idle");
    setProgress({ loaded: 0, total: 0, percent: 0 });
  }, []);

  if (!open) return null;

  const backend = availability?.backend || "unsupported";
  const backendLabel = backend === "webgpu" ? "WebGPU" : backend === "wasm" ? "WASM/CPU" : "Unsupported";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="bg-[#0d0d16] border border-[#252540] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#e8e8f8]">Nova Local AI</h2>
                <p className="text-xs text-[#6e6e8a]">On-device intelligence</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#6e6e8a] hover:text-[#e8e8f8] transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 space-y-4">
            {state === "idle" && (
              <>
                <Card className="nova-glass p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-[#e8e8f8]">
                    Enable Nova Local AI
                  </h3>
                  <p className="text-xs text-[#6e6e8a] leading-relaxed">
                    Download a small AI model to this device and chat with Nova locally.
                    Your casual conversations can stay on your device and work without Gemini.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-[#e8e8f8]">
                      <Cpu className="h-3.5 w-3.5 text-[#00d4ff]" />
                      <span>Qwen3 0.6B</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#e8e8f8]">
                      <Download className="h-3.5 w-3.5 text-[#8b5cf6]" />
                      <span>~450 MB</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#e8e8f8]">
                      <Globe className="h-3.5 w-3.5 text-[#10b981]" />
                      <span>Runs on-device</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#e8e8f8]">
                      <Shield className="h-3.5 w-3.5 text-[#f59e0b]" />
                      <span>No cloud required</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#6e6e8a] bg-[#16162a] rounded-lg px-3 py-2">
                    Runtime: {backendLabel} · Downloads once · Works offline
                  </div>
                </Card>

                {availability && !availability.supported && (
                  <Card className="p-3 bg-[#f43f5e]/10 border border-[#f43f5e]/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-[#f43f5e] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#f43f5e]">
                        {availability.reason || "Local AI is not supported on this device."}
                      </p>
                    </div>
                  </Card>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleDownload}
                    disabled={!availability?.supported}
                    className="flex-1 bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Local AI
                  </Button>
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8]"
                  >
                    Continue with Gemini
                  </Button>
                </div>
              </>
            )}

            {(state === "downloading" || state === "installing") && (
              <div className="space-y-4 py-4">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 text-[#00d4ff] mx-auto mb-3 animate-spin" />
                  <p className="text-sm font-medium text-[#e8e8f8]">
                    {state === "downloading" ? "Downloading Nova Local AI" : "Installing model..."}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="w-full h-2 bg-[#16162a] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.percent}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[#6e6e8a]">
                    <span>{progress.percent}%</span>
                    <span>
                      {progress.loaded > 0 && progress.total > 0
                        ? `${Math.round(progress.loaded)} MB / ${Math.round(progress.total)} MB`
                        : "Starting download..."}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-[#6e6e8a] text-center">
                  This downloads once. Future visits load from cache.
                </p>
              </div>
            )}

            {state === "ready" && (
              <div className="space-y-4 py-4 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 className="h-12 w-12 text-[#10b981] mx-auto" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-[#e8e8f8]">Local AI Ready!</p>
                  <p className="text-xs text-[#6e6e8a] mt-1">
                    Nova can now respond to casual conversations without Gemini.
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={onClose}
                    className="bg-[#10b981] text-[#06060c] font-semibold"
                  >
                    Start Chatting
                  </Button>
                  {state === "ready" && (
                    <Button
                      onClick={handleDelete}
                      variant="ghost"
                      className="text-[#6e6e8a] hover:text-[#f43f5e]"
                    >
                      Delete Model
                    </Button>
                  )}
                </div>
              </div>
            )}

            {state === "error" && (
              <div className="space-y-4 py-4 text-center">
                <AlertCircle className="h-10 w-10 text-[#f43f5e] mx-auto" />
                <div>
                  <p className="text-sm font-medium text-[#e8e8f8]">Download Failed</p>
                  <p className="text-xs text-[#6e6e8a] mt-1">{error}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={handleDownload}
                    className="bg-[#00d4ff] text-[#06060c]"
                  >
                    Retry
                  </Button>
                  <Button
                    onClick={onClose}
                    variant="ghost"
                    className="text-[#6e6e8a]"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
