import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NovaAvatar, type AvatarState } from "@/components/nova/avatar";
import { StatusIndicator } from "@/components/nova/status-indicator";
import { useAuth } from "@/hooks/use-auth";
import { useWakeWord } from "@/hooks/use-wake-word";
import { useOfflineSTT } from "@/hooks/use-offline-stt";
import { routeMessage } from "@/ai/AIRouter";
import { getAIMode } from "@/ai/local/LocalAISettings";
import { localAIService } from "@/ai/local/LocalAIService";
import { DownloadModal } from "@/components/local-ai/DownloadModal";
import { getTasks } from "@/lib/rtdb";
import { getMemories } from "@/lib/rtdb";
import { getConversations } from "@/lib/local-store";
import { logActivity } from "@/lib/local-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import {
  Mic,
  MicOff,
  Cpu,
  Download,
  MessageSquare,
  CheckSquare,
  Brain,
  Settings,
  Zap,
  LogOut,
  Volume2,
  VolumeX,
  Calendar,
  Mail,
  Globe,
  Code,
  Activity,
  Shield,
  Bot,
  Clock,
  AlertTriangle,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

const quickCommands = [
  { label: "What's on my calendar?", icon: Calendar, action: "calendar" },
  { label: "Summarize my emails", icon: Mail, action: "email" },
  { label: "Create a task", icon: CheckSquare, action: "task" },
  { label: "Remember something", icon: Brain, action: "memory" },
  { label: "Browse the web", icon: Globe, action: "browser" },
  { label: "Open coding sandbox", icon: Code, action: "coding" },
];



function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Burning the midnight oil?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Burning the midnight oil?";
}

function getCurrentTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function getCurrentDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(26, 47, 74, 0.5)" strokeWidth="5" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold font-mono" style={{ color }}>{value}%</span>
        </div>
      </div>
      <span className="text-[10px] text-[#5a7a9a] uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [novaResponse, setNovaResponse] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [geminiKey] = useState(() => (import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem("nova_gemini_key") || "");
  const [showLocalAIDownload, setShowLocalAIDownload] = useState(false);
  const [localAIAvailable, setLocalAIAvailable] = useState<boolean | null>(null);
  const [localAICached, setLocalAICached] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [memoryCount, setMemoryCount] = useState(0);
  const [convCount, setConvCount] = useState(0);
  const { agents, intelligence, counts } = useDashboardData();
  const [currentTime, setCurrentTime] = useState(getCurrentTime());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const uid = user?.uid || "";
        if (uid) {
          const tasks = await getTasks(uid);
          setTaskCount(tasks.filter((t) => t.status !== "completed").length);
          const memories = await getMemories(uid);
          setMemoryCount(memories.length);
        }
        setConvCount(getConversations().length);
      } catch { /* ignore */ }
    };
    loadCounts();
  }, [user]);

  useEffect(() => {
    localAIService.detect().then((avail) => setLocalAIAvailable(avail.supported));
    localAIService.isCached().then(setLocalAICached);
  }, []);

  const handleTranscript = useCallback(
    async (text: string, isFinal: boolean) => {
      if (!isFinal) { setAvatarState("listening"); return; }
      setAvatarState("thinking");
      setNovaResponse("");
      logActivity("voice", `Voice command: "${text.slice(0, 50)}"`, "mic");
      try {
        const result = await routeMessage(text, [], geminiKey, { mode: getAIMode() });
        setNovaResponse(result.text);
        setAvatarState("speaking");
        if (!isMuted) {
          const tts = new SpeechSynthesisUtterance(result.text);
          tts.onend = () => setAvatarState("idle");
          window.speechSynthesis.speak(tts);
        } else {
          setTimeout(() => setAvatarState("idle"), 3000);
        }
      } catch {
        setAvatarState("error");
        setNovaResponse("I couldn't process that. Check your API key in Settings.");
        setTimeout(() => setAvatarState("idle"), 3000);
      }
    },
    [geminiKey, isMuted]
  );

  const { isListening, isSupported, start: startSTT, stop: stopSTT } = useOfflineSTT({ onTranscript: handleTranscript });

  const handleVoiceToggle = useCallback(() => {
    if (isListening) { stopSTT(); setAvatarState("idle"); }
    else { startSTT(); setAvatarState("listening"); }
  }, [isListening, startSTT, stopSTT]);

  useWakeWord({ onWake: () => { if (!isListening) { startSTT(); setAvatarState("listening"); } } });

  const handleCommand = useCallback((action: string) => {
    const routes: Record<string, string> = {
      calendar: "/calendar", email: "/email", task: "/tasks",
      memory: "/memory", automation: "/automations", settings: "/settings",
      browser: "/browser", coding: "/coding",
    };
    navigate(routes[action] || "/chat");
  }, [navigate]);

  const handleSignOut = async () => {
    logActivity("auth", "Signed out", "logout");
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-[#060e1a] jarvis-grid-bg px-4 sm:px-6 py-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* ── Top Bar ──────────────────────────────────── */}
        <motion.header
          initial="hidden" animate="visible" variants={fadeUp} custom={0}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-[#5a7a9a]">{getGreeting()}{user?.displayName ? `, ${user.displayName}` : user?.email ? `, ${user.email}` : ""}</p>
              <h1 className="text-lg font-bold text-[#e0ecf5] tracking-tight">Nova Command Center</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusIndicator />
            <div className="text-right">
              <p className="text-[10px] text-[#5a7a9a] uppercase tracking-wider">{getCurrentDate()}</p>
              <p className="text-sm font-mono font-bold text-[#00d4ff] jarvis-glow-text">{currentTime}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-[#5a7a9a] hover:text-[#c8d6e5]" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </motion.header>

        {/* ── Main Grid ────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - AI Core Overview */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="col-span-3">
            <div className="jarvis-card p-4 h-full">
              <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-3">AI Core Overview</h3>
              <div className="space-y-3">
                {[
                  { label: "AI Core", value: "Active", color: "#10b981", icon: Cpu },
                  { label: "Memory", value: `${memoryCount} Stored`, color: "#8b5cf6", icon: Brain },
                  { label: "Voice", value: isListening ? "Listening" : "Online", color: "#00d4ff", icon: Mic },
                  { label: "Agents", value: `${agents.filter(a => a.status === "active").length} Running`, color: "#10b981", icon: Bot },
                  { label: "Conversations", value: `${convCount} Total`, color: "#00d4ff", icon: MessageSquare },
                  { label: "System", value: "Optimal", color: "#10b981", icon: Shield },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-[#1a2f4a]/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                      <span className="text-xs text-[#c8d6e5]">{item.label}</span>
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Center - Voice Avatar + Quick Commands */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="col-span-6 space-y-4">
            {/* Avatar Card */}
            <div className="jarvis-card p-8 jarvis-glow-cyan">
              <div className="flex flex-col items-center gap-4">
                <div className="relative cursor-pointer" onClick={handleVoiceToggle}>
                  <NovaAvatar state={avatarState} size={160} />
                  {!isSupported && (
                    <p className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-[#f59e0b] whitespace-nowrap">
                      Voice not supported
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleVoiceToggle}
                  disabled={!isSupported}
                  className={`h-12 px-8 rounded-full font-semibold text-sm transition-all duration-300 ${
                    isListening
                      ? "bg-[#f43f5e] text-white shadow-lg shadow-[#f43f5e]/30"
                      : "bg-gradient-to-r from-[#00d4ff] to-[#0ea5e9] text-[#060e1a] shadow-lg shadow-[#00d4ff]/20"
                  }`}
                >
                  {isListening ? <><MicOff className="mr-2 h-4 w-4" />Stop Listening</> : <><Mic className="mr-2 h-4 w-4" />Talk to Nova</>}
                </Button>
                <button onClick={() => setIsMuted(!isMuted)} className="text-[#5a7a9a] hover:text-[#c8d6e5] transition-colors" aria-label={isMuted ? "Unmute voice output" : "Mute voice output"}>
                  {isMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                </button>
                {novaResponse && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-lg p-4 rounded-xl bg-[#0f2035]/60 border border-[#1a2f4a] text-sm text-[#c8d6e5] leading-relaxed">
                    {novaResponse}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Quick Commands */}
            <div className="jarvis-card p-4">
              <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-3">Quick Commands</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickCommands.map((cmd) => (
                  <button key={cmd.label} onClick={() => handleCommand(cmd.action)} aria-label={cmd.label}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0f2035]/60 hover:bg-[#162a42] border border-[#1a2f4a]/50 hover:border-[#00d4ff]/30 text-xs text-[#c8d6e5] transition-all text-left group">
                    <cmd.icon className="w-3.5 h-3.5 text-[#5a7a9a] group-hover:text-[#00d4ff] transition-colors" aria-hidden="true" />
                    <span>{cmd.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Column - Live Feed */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="col-span-3">
            <div className="jarvis-card p-4 h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider">Live Intelligence</h3>
                <span className="flex items-center gap-1 text-[9px] text-[#10b981]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />LIVE
                </span>
              </div>
              <div className="space-y-2.5">
                {intelligence.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-start gap-2 py-1.5 border-b border-[#1a2f4a]/30 last:border-0">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      item.type === "warn" ? "bg-[#f59e0b]" : item.type === "success" ? "bg-[#10b981]" : "bg-[#00d4ff]"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#c8d6e5] leading-snug">{item.text}</p>
                      <p className="text-[9px] text-[#5a7a9a] mt-0.5">{item.source}</p>
                    </div>
                  </div>
                ))}
                {intelligence.length === 0 && (
                  <p className="text-[11px] text-[#5a7a9a] text-center py-4">No activity yet. Start using Nova to see your feed.</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Second Row ───────────────────────────────── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Active Agents */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="col-span-5">
            <div className="jarvis-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider">Active Agents</h3>
                <button className="text-[10px] text-[#00d4ff] hover:underline" onClick={() => navigate("/agents")} aria-label="View all agents">View All</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0f2035]/50 border border-[#1a2f4a]/50">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${agent.color}15` }}>
                      <Bot className="w-4 h-4" style={{ color: agent.color }} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-[#c8d6e5]">{agent.name}</p>
                      <p className="text-[9px] capitalize" style={{ color: agent.color }}>{agent.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* System Monitor */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="col-span-4">
            <div className="jarvis-card p-4">
              <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-4">System Monitor</h3>
              <div className="flex items-center justify-around">
                <CircularGauge value={15} label="CPU" color="#00d4ff" />
                <CircularGauge value={54} label="RAM" color="#8b5cf6" />
                <CircularGauge value={40} label="Disk" color="#10b981" />
              </div>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={6} className="col-span-3">
            <div className="jarvis-card p-4 h-full">
              <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-3">Quick Stats</h3>
              <div className="space-y-3">
                {[
                  { label: "Tasks Pending", value: taskCount, color: "#10b981", route: "/tasks" },
                  { label: "Memories", value: memoryCount, color: "#8b5cf6", route: "/memory" },
                  { label: "Conversations", value: convCount, color: "#00d4ff", route: "/chat" },
                ].map((stat) => (
                  <button key={stat.label} onClick={() => navigate(stat.route)} aria-label={`${stat.label}: ${stat.value}`}
                    className="w-full text-left flex items-center justify-between p-2.5 rounded-lg bg-[#0f2035]/40 hover:bg-[#162a42] border border-[#1a2f4a]/30 transition-colors group">
                    <span className="text-[11px] text-[#5a7a9a] group-hover:text-[#c8d6e5]">{stat.label}</span>
                    <span className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Local AI Onboarding */}
        {localAIAvailable === true && !localAICached && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={7}>
            <div className="jarvis-card p-4 flex items-center gap-4 jarvis-glow-cyan">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 flex items-center justify-center shrink-0">
                <Cpu className="w-5 h-5 text-[#10b981]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#e0ecf5]">Enable Nova Local AI</p>
                <p className="text-xs text-[#5a7a9a]">Download a small model to chat without Gemini</p>
              </div>
              <Button onClick={() => setShowLocalAIDownload(true)} size="sm"
                className="bg-[#10b981] text-[#060e1a] hover:bg-[#10b981]/80 shrink-0">
                <Download className="h-3.5 w-3.5 mr-1" />Download
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <DownloadModal open={showLocalAIDownload} onClose={() => {
        setShowLocalAIDownload(false);
        localAIService.isCached().then(setLocalAICached);
      }} />
    </main>
  );
}
