import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wifi,
  WifiOff,
  Monitor,
  Globe,
  Mic,
  Volume2,
  MonitorSmartphone,
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import {
  onDevicesChange,
  setDeviceAuthorization,
  revokeDevice,
  createPairingCode,
  type NovaDevice,
} from "@/services/devices/DeviceRegistry";
import { useAuth } from "@/hooks/use-auth";

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

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DevicesPage() {
  const { user } = useAuth();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo[]>([]);
  const [agents, setAgents] = useState<NovaDevice[]>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Realtime agent devices from the cloud registry.
  useEffect(() => {
    const unsub = onDevicesChange(
      (devices) => setAgents(devices.filter((d) => !d.revoked)),
      () => {}
    );
    return unsub;
  }, []);

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
    const sttSupported = !!window.SpeechRecognition || !!(window as any).webkitSpeechRecognition;
    const ttsSupported = "speechSynthesis" in window;
    const online = navigator.onLine;

    const info: DeviceInfo[] = [
      { label: "Platform", value: isMobile ? "Mobile" : "Desktop", icon: isMobile ? Smartphone : Monitor, color: "#00d4ff" },
      { label: "Operating System", value: os, icon: Monitor, color: "#8b5cf6" },
      { label: "Browser", value: browser, icon: Globe, color: "#10b981" },
      { label: "Language", value: lang, icon: Globe, color: "#f59e0b" },
      { label: "CPU Cores", value: String(cores), icon: Monitor, color: "#f43f5e" },
      { label: "Speech Recognition", value: sttSupported ? "Supported" : "Not Supported", icon: Mic, color: sttSupported ? "#10b981" : "#f43f5e" },
      { label: "Text-to-Speech", value: ttsSupported ? "Supported" : "Not Supported", icon: Volume2, color: ttsSupported ? "#10b981" : "#f43f5e" },
      { label: "Connection", value: online ? "Online" : "Offline", icon: Wifi, color: online ? "#10b981" : "#f43f5e" },
    ];

    setDeviceInfo(info);
  }, []);

  const handlePair = useCallback(async () => {
    if (!user?.uid) return;
    setPairingLoading(true);
    try {
      const pairing = await createPairingCode(user.uid);
      setPairingCode(pairing.code);
    } catch {
      setPairingCode(null);
    } finally {
      setPairingLoading(false);
    }
  }, [user?.uid]);

  const copyCode = useCallback(() => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pairingCode]);

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">
            Device detection, desktop agent pairing, and permissions
          </p>
        </motion.div>

        {/* Desktop agent pairing */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00d4ff]/15 flex items-center justify-center shrink-0">
                <MonitorSmartphone className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#e8e8f8]">Nova Windows Agent</p>
                <p className="text-xs text-[#6e6e8a]">
                  Pair this computer so Nova can control apps, screens, and files — securely, via allowlisted commands only.
                </p>
              </div>
            </div>

            {pairingCode ? (
              <div className="flex items-center gap-3 rounded-lg bg-[#0a0a14] border border-[#00d4ff]/20 p-3">
                <span className="text-2xl font-mono font-bold tracking-[0.3em] text-[#00d4ff] select-all">
                  {pairingCode}
                </span>
                <div className="flex-1 text-xs text-[#6e6e8a]">
                  Enter this code in the agent window within 5 minutes, then approve the device below.
                </div>
                <Button variant="outline" size="sm" onClick={copyCode} className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <Button onClick={handlePair} disabled={pairingLoading} size="sm" className="w-fit">
                {pairingLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pair desktop agent
              </Button>
            )}
          </Card>
        </motion.div>

        {/* Paired desktop agents */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="space-y-3">
          <h2 className="text-sm font-semibold text-[#a0a0c0] uppercase tracking-wide">Desktop Agents</h2>
          {agents.length === 0 ? (
            <Card className="nova-glass p-4 text-sm text-[#6e6e8a]">
              No desktop agents paired yet. Generate a pairing code above and run the Nova Windows Agent on your PC.
            </Card>
          ) : (
            agents.map((device) => {
              const online = Date.now() - device.lastSeen < 60_000;
              return (
                <Card key={device.deviceId} className="nova-glass p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${device.authorized ? "bg-[#10b981]/15" : "bg-[#f59e0b]/15"}`}>
                      <Monitor className={`w-5 h-5 ${device.authorized ? "text-[#10b981]" : "text-[#f59e0b]"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#e8e8f8] truncate">{device.deviceName}</p>
                      <p className="text-xs text-[#6e6e8a]">
                        {device.platform} · agent v{device.agentVersion} · seen {timeAgo(device.lastSeen)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {online ? (
                        <Badge className="bg-[#10b981]/15 text-[#10b981] border-0 gap-1">
                          <Wifi className="h-3 w-3" /> Online
                        </Badge>
                      ) : (
                        <Badge className="bg-[#6e6e8a]/15 text-[#6e6e8a] border-0 gap-1">
                          <WifiOff className="h-3 w-3" /> Offline
                        </Badge>
                      )}
                      {device.authorized ? (
                        <Badge className="bg-[#00d4ff]/15 text-[#00d4ff] border-0 gap-1">
                          <ShieldCheck className="h-3 w-3" /> Authorized
                        </Badge>
                      ) : (
                        <Badge className="bg-[#f59e0b]/15 text-[#f59e0b] border-0">Pending</Badge>
                      )}
                    </div>
                  </div>

                  {device.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {device.capabilities.slice(0, 8).map((cap) => (
                        <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6]">
                          {cap}
                        </span>
                      ))}
                      {device.capabilities.length > 8 && (
                        <span className="text-[10px] px-2 py-0.5 text-[#6e6e8a]">
                          +{device.capabilities.length - 8} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!device.authorized ? (
                      <Button
                        size="sm"
                        onClick={() => void setDeviceAuthorization(device.deviceId, true)}
                        className="bg-[#10b981] hover:bg-[#10b981]/90 text-white"
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" /> Approve
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void revokeDevice(device.deviceId)}
                      >
                        <ShieldOff className="h-4 w-4 mr-1" /> Revoke
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </motion.div>

        {/* Current browser device */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
          <h2 className="text-sm font-semibold text-[#a0a0c0] uppercase tracking-wide mb-3">This Device</h2>
          <Card className="nova-glass p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#10b981]/15 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#10b981]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#e8e8f8]">Current browser session</p>
              <p className="text-xs text-[#6e6e8a]">Capabilities below</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#10b981]">
              <Wifi className="h-3.5 w-3.5" />
              Online
            </div>
          </Card>
        </motion.div>

        {/* Device Info Grid */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deviceInfo.map((info, i) => (
              <motion.div key={info.label} initial="hidden" animate="visible" variants={fadeUp} custom={i + 5}>
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
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
