import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Globe, Code, Mail, Home } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

const agents = [
  { name: "Browser Agent", desc: "Browse the web and extract information", icon: Globe, status: "ready", color: "#00d4ff" },
  { name: "Coding Agent", desc: "Write and review code via GitHub", icon: Code, status: "ready", color: "#8b5cf6" },
  { name: "Email Agent", desc: "Draft and manage emails", icon: Mail, status: "ready", color: "#10b981" },
  { name: "Home Agent", desc: "Control smart home devices", icon: Home, status: "standby", color: "#f59e0b" },
];

export default function AgentsPage() {
  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Nova's specialized sub-agents</p>
        </motion.div>
        <div className="space-y-3">
          {agents.map((agent, i) => (
            <motion.div key={agent.name} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
              <Card className="nova-glass nova-glass-hover p-4 flex items-center gap-4 cursor-pointer">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${agent.color}15` }}>
                  <agent.icon className="w-5 h-5" style={{ color: agent.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#e8e8f8]">{agent.name}</p>
                  <p className="text-xs text-[#6e6e8a]">{agent.desc}</p>
                </div>
                <Badge className={`text-xs border-0 ${agent.status === "ready" ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[#f59e0b]/15 text-[#f59e0b]"}`}>
                  {agent.status}
                </Badge>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
