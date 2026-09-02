import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logActivity } from "@/lib/local-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
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

interface AgentDetail {
  name: string;
  desc: string;
  icon: React.ComponentType<any>;
  capabilities: string[];
  route: string;
}

const agentDetails: Record<string, AgentDetail> = {
  browser: { name: "Browser Agent", desc: "Browse the web and extract information", icon: Globe, capabilities: ["Web search", "URL fetching", "Content extraction", "Page summarization"], route: "/browser" },
  coding: { name: "Coding Agent", desc: "Write and review code via GitHub", icon: Code, capabilities: ["JavaScript sandbox", "Code execution", "Syntax highlighting", "Console output"], route: "/coding" },
  email: { name: "Email Agent", desc: "Draft and manage emails", icon: Mail, capabilities: ["Draft composition", "Template management", "Send tracking", "Inbox organization"], route: "/email" },
  home: { name: "Home Agent", desc: "Control smart home devices", icon: Home, capabilities: ["Device control", "Voice commands", "Room management", "Automation triggers"], route: "/smart-home" },
  task: { name: "Task Agent", desc: "Manage tasks and reminders", icon: Bot, capabilities: ["Task creation", "Priority management", "Deadline tracking", "Voice-to-task"], route: "/tasks" },
  memory: { name: "Memory Agent", desc: "Store and retrieve personal information", icon: Brain, capabilities: ["Fact storage", "Preference tracking", "Person profiles", "Context retrieval"], route: "/memory" },
  chat: { name: "Chat Agent", desc: "Conversational AI with voice support", icon: MessageSquare, capabilities: ["Natural conversation", "Intent routing", "Voice I/O", "Context awareness"], route: "/chat" },
};

export default function AgentsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();
  const { agents } = useDashboardData();

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Nova's specialized sub-agents</p>
        </motion.div>

        <div className="space-y-3">
          {agents.map((agent, i) => {
            const detail = agentDetails[agent.id];
            if (!detail) return null;
            const isExpanded = expanded === agent.id;
            return (
              <motion.div key={agent.id} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
                <Card className="nova-glass nova-glass-hover overflow-hidden">
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : agent.id)}
                    role="button"
                    aria-expanded={isExpanded}
                    aria-label={`${detail.name} - ${agent.status}`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${agent.color}15` }}
                    >
                      <detail.icon className="w-5 h-5" style={{ color: agent.color }} aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#e8e8f8]">{detail.name}</p>
                      <p className="text-xs text-[#6e6e8a]">{detail.desc}</p>
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
                        {detail.capabilities.map((cap) => (
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
                            logActivity("agent", `Opened ${detail.name}`, "bot");
                            navigate(detail.route);
                          }}
                          className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80 text-xs"
                          aria-label={`Launch ${detail.name}`}
                        >
                          <Play className="h-3 w-3 mr-1" aria-hidden="true" />
                          Launch
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8] hover:bg-[#1e1e38] text-xs"
                          onClick={() => logActivity("agent", `Configured ${detail.name}`, "settings")}
                          aria-label={`Configure ${detail.name}`}
                        >
                          <Settings className="h-3 w-3 mr-1" aria-hidden="true" />
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
