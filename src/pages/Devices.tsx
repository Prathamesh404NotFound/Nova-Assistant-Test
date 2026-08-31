import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wifi,
  Monitor,
  Battery,
  Globe,
  Mic,
  Volume2,
  Camera,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

interface DeviceInfo {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
  color: string;
}

export default function DevicesPage() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo[]>([]);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const browser = (() => {
      if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
      if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
      if (ua.includes("Firefox")) return "Firefox";
      if (ua.includes("Edg")) return "Edge";
      return "Unknown Browser";
    })();
    const os = (() => {
      if (ua.includes("Win")) return "Windows";
      if (ua.includes("Mac")) return "macOS";
      if (ua.includes("Linux")) return "Linux";
      if (ua.includes("Android")) return "Android";
      if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
      return "Unknown OS";
    })();
    const lang = navigator.language || "en-US";
    const cores = navigator.hardwareConcurrency || "Unknown";
    const mem = (navigator as any).deviceMemory
      ? `${(navigator as any).deviceMemory} GB`
      : "Unknown";
    const sttSupported = !!window.SpeechRecognition || !!(window as any).webkitSpeechRecognition;
    const ttsSupported = "speechSynthesis" in window;
    const online = navigator.onLine;

    const info: DeviceInfo[] = [
      { label: "Platform", value: isMobile ? "Mobile" : "Desktop", icon: isMobile ? Smartphone : Monitor, color: "#00d4ff" },
      { label: "Operating System", value: os, icon: Monitor, color: "#8b5cf6" },
      { label: "Browser", value: browser, icon: Globe, color: "#10b981" },
      { label: "Language", value: lang, icon: Globe, color: "#f59e0b" },
      { label: "CPU Cores", value: String(cores), icon: Monitor, color: "#f43f5e" },
      { label: "Memory", value: mem, icon: Monitor, color: "#8b5cf6" },
      { label: "Speech Recognition", value: sttSupported ? "Supported" : "Not Supported", icon: Mic, color: sttSupported ? "#10b981" : "#f43f5e" },
      { label: "Text-to-Speech", value: ttsSupported ? "Supported" : "Not Supported", icon: Volume2, color: ttsSupported ? "#10b981" : "#f43f5e" },
      { label: "Connection", value: online ? "Online" : "Offline", icon: Wifi, color: online ? "#10b981" : "#f43f5e" },
    ];

    setDeviceInfo(info);
  }, []);

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Device detection and capabilities</p>
        </motion.div>

        {/* Current Device */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#10b981]/15 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#10b981]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#e8e8f8]">This Device</p>
              <p className="text-xs text-[#6e6e8a]">Current browser session</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#10b981]">
              <Wifi className="h-3.5 w-3.5" />
              Online
            </div>
          </Card>
        </motion.div>

        {/* Device Info Grid */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deviceInfo.map((info, i) => (
              <motion.div key={info.label} initial="hidden" animate="visible" variants={fadeUp} custom={i + 3}>
                <Card className="nova-glass p-3 flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${info.color}15` }}
                  >
                    <info.icon className="w-4 h-4" style={{ color: info.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#6e6e8a]">{info.label}</p>
                    <p className="text-sm font-medium text-[#e8e8f8]">{info.value}</p>
                  </div>
                  <Badge
                    className="text-[10px] border-0"
                    style={{ backgroundColor: `${info.color}15`, color: info.color }}
                  >
                    {info.value.includes("Supported") || info.value.includes("Online") ? "✓" : "—"}
                  </Badge>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
