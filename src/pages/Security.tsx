import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, AlertTriangle } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

const securityItems = [
  { label: "API Key Encryption", status: "active", icon: Lock, color: "#10b981", desc: "AES-256-GCM encryption for stored API keys" },
  { label: "Local Storage Only", status: "active", icon: Eye, color: "#10b981", desc: "Data stays on your device" },
  { label: "No Third-Party Tracking", status: "active", icon: Shield, color: "#10b981", desc: "Zero analytics or tracking scripts" },
  { label: "Emergency Stop", status: "available", icon: AlertTriangle, color: "#f59e0b", desc: "Disable all AI actions immediately" },
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Security</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Privacy and security status</p>
        </motion.div>
        <div className="space-y-3">
          {securityItems.map((item, i) => (
            <motion.div key={item.label} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
              <Card className="nova-glass p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#e8e8f8]">{item.label}</p>
                  <p className="text-xs text-[#6e6e8a]">{item.desc}</p>
                </div>
                <Badge className={`text-xs border-0 ${item.status === "active" ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[#f59e0b]/15 text-[#f59e0b]"}`}>
                  {item.status}
                </Badge>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
