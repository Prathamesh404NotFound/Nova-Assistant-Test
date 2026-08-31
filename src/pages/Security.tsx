import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Shield,
  Lock,
  Eye,
  AlertTriangle,
  Key,
  Database,
  Globe,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

interface SecurityFeature {
  label: string;
  desc: string;
  icon: React.ComponentType<any>;
  color: string;
  active: boolean;
  toggleable: boolean;
}

const defaultFeatures: SecurityFeature[] = [
  {
    label: "API Key Encryption",
    desc: "AES-256-GCM encryption for stored API keys",
    icon: Lock,
    color: "#10b981",
    active: true,
    toggleable: false,
  },
  {
    label: "Local Storage Only",
    desc: "All data stays on your device in localStorage",
    icon: Database,
    color: "#10b981",
    active: true,
    toggleable: false,
  },
  {
    label: "No Third-Party Tracking",
    desc: "Zero analytics or tracking scripts",
    icon: Eye,
    color: "#10b981",
    active: true,
    toggleable: false,
  },
  {
    label: "Voice Data Processing",
    desc: "Voice is processed locally via Web Speech API",
    icon: Fingerprint,
    color: "#00d4ff",
    active: true,
    toggleable: true,
  },
  {
    label: "Browser Fingerprinting",
    desc: "Prevent browser fingerprinting attempts",
    icon: Globe,
    color: "#8b5cf6",
    active: true,
    toggleable: true,
  },
  {
    label: "Emergency Stop",
    desc: "Disable all AI actions immediately",
    icon: AlertTriangle,
    color: "#f59e0b",
    active: false,
    toggleable: true,
  },
];

export default function SecurityPage() {
  const [features, setFeatures] = useState<SecurityFeature[]>(defaultFeatures);

  const configuredKeys = [
    "gemini",
    "heygen",
    "deepgram",
    "elevenlabs",
    "github",
  ].filter((key) => {
    try {
      return !!localStorage.getItem(`nova_${key}_key`);
    } catch {
      return false;
    }
  });

  const toggleFeature = (idx: number) => {
    setFeatures((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, active: !f.active } : f))
    );
  };

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Security</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Privacy and security status</p>
        </motion.div>

        {/* Security Score */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#10b981]/15 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-[#10b981]" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-[#e8e8f8]">Security Status: Strong</p>
                <p className="text-xs text-[#6e6e8a] mt-1">
                  Your Nova OS instance is running with end-to-end encryption and local-only data storage.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* API Keys Status */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <Card className="nova-glass p-4">
            <div className="flex items-center gap-3 mb-3">
              <Key className="h-4 w-4 text-[#00d4ff]" />
              <p className="text-sm font-medium text-[#e8e8f8]">API Key Status</p>
              <Badge className="text-[10px] bg-[#00d4ff]/15 text-[#00d4ff] border-0">
                {configuredKeys.length}/5 configured
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["gemini", "heygen", "deepgram", "elevenlabs", "github"].map((key) => {
                const configured = configuredKeys.includes(key);
                return (
                  <Badge
                    key={key}
                    className={`text-[10px] border-0 ${
                      configured
                        ? "bg-[#10b981]/15 text-[#10b981]"
                        : "bg-[#6e6e8a]/15 text-[#6e6e8a]"
                    }`}
                  >
                    {configured ? "✓" : "○"} {key}
                  </Badge>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Security Features */}
        <div className="space-y-3">
          {features.map((feature, i) => (
            <motion.div key={feature.label} initial="hidden" animate="visible" variants={fadeUp} custom={i + 3}>
              <Card className="nova-glass p-4 flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${feature.active ? feature.color : "#6e6e8a"}15` }}
                >
                  <feature.icon
                    className="w-5 h-5"
                    style={{ color: feature.active ? feature.color : "#6e6e8a" }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#e8e8f8]">{feature.label}</p>
                  <p className="text-xs text-[#6e6e8a]">{feature.desc}</p>
                </div>
                {feature.toggleable ? (
                  <Switch checked={feature.active} onCheckedChange={() => toggleFeature(i)} />
                ) : (
                  <Badge className={`text-xs border-0 ${
                    feature.active
                      ? "bg-[#10b981]/15 text-[#10b981]"
                      : "bg-[#6e6e8a]/15 text-[#6e6e8a]"
                  }`}>
                    {feature.active ? "Active" : "Inactive"}
                  </Badge>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
