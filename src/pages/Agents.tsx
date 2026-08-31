import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logActivity } from "@/lib/local-store";
import {
  Bot,
  Globe,
  Code,
  Mail,
  Home,
  MessageSquare,
  Brain,
  Play,
  Settings,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

interface Agent {
  name: string;
  desc: string;
  icon: React.ComponentType<any>;
  status: "active" | "standby" | "configuring";
  color: string;
  capabilities: string[];
  route: string;
}

const agents: Agent[] = [
  {
    name: "Browser Agent",
    desc: "Browse the web and extract information",
    icon: Globe,
    status: "active",
    color: "#00d4ff",
    capabilities: ["Web search", "URL fetching", "Content extraction", "Page summarization"],
    route: "/browser",
  },
  {
    name: "Coding Agent",
    desc: "Write and review code via GitHub",
    icon: Code,
    status: "active",
    color: "#8b5cf6",
    capabilities: ["JavaScript sandbox", "Code execution", "Syntax highlighting", "Console output"],
    route: "/coding",
  },
  {
    name: "Email Agent",
    desc: "Draft and manage emails",
    icon: Mail,
    status: "active",
    color: "#10b981",
    capabilities: ["Draft composition", "Template management", "Send tracking", "Inbox organization"],
    route: "/email",
  },
  {
    name: "Home Agent",
    desc: "Control smart home devices",
    icon: Home,
    status: "active",
    color: "#f59e0b",
    capabilities: ["Device control", "Voice commands", "Room management", "Automation triggers"],
    route: "/smart-home",
  },
  {
    name: "Task Agent",
    desc: "Manage tasks and reminders",
    icon: Bot,
    status: "active",
    color: "#10b981",
    capabilities: ["Task creation", "Priority management", "Deadline tracking", "Voice-to-task"],
    route: "/tasks",
  },
  {
    name: "Memory Agent",
    desc: "Store and retrieve personal information",
    icon: Brain,
    status: "active",
    color: "#8b5cf6",
    capabilities: ["Fact storage", "Preference tracking", "Person profiles", "Context retrieval"],
    route: "/memory",
  },
  {
    name: "Chat Agent",
    desc: "Conversational AI with voice support",
    icon: MessageSquare,
    status: "active",
    color: "#00d4ff",
    capabilities: ["Natural conversation", "Intent routing", "Voice I/O", "Context awareness"],
    route: "/chat",
  },
];

export default function AgentsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Nova's specialized sub-agents</p>
        </motion.div>

        <div className="space-y-3">
          {agents.map((agent, i) => {
            const isExpanded = expanded === agent.name;
            return (
              <motion.div key={agent.name} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
                <Card className="nova-glass nova-glass-hover overflow-hidden">
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : agent.name)}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${agent.color}15` }}
                    >
                      <agent.icon className="w-5 h-5" style={{ color: agent.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#e8e8f8]">{agent.name}</p>
                      <p className="text-xs text-[#6e6e8a]">{agent.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs border-0 ${
                        agent.status === "active"
                          ? "bg-[#10b981]/15 text-[#10b981]"
                          : agent.status === "standby"
                          ? "bg-[#f59e0b]/15 text-[#f59e0b]"
                          : "bg-[#6e6e8a]/15 text-[#6e6e8a]"
                      }`}>
                        {agent.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="border-t border-[#252540] px-4 py-3"
                    >
                      <p className="text-xs text-[#6e6e8a] uppercase tracking-wider mb-2">Capabilities</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {agent.capabilities.map((cap) => (
                          <Badge
                            key={cap}
                            className="text-[10px] border-0"
                            style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
                          >
                            {cap}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            logActivity("agent", `Opened ${agent.name}`, "bot");
                            window.location.hash = "";
                            window.location.href = agent.route;
                          }}
                          className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80 text-xs"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Launch
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8] hover:bg-[#1e1e38] text-xs"
                          onClick={() => logActivity("agent", `Configured ${agent.name}`, "settings")}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
