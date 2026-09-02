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
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
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

  // Load real counts
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
      } catch {
        // Ignore
      }
    };    loadCounts();
  }, [user]);

  // Check Local AI status
  useEffect(() => {
    localAIService.detect().then((avail) => {
      setLocalAIAvailable(avail.supported);
    });
    localAIService.isCached().then(setLocalAICached);
  }, []);


  const handleTranscript = useCallback(
    async (text: string, isFinal: boolean) => {
      if (!isFinal) {
        setAvatarState("listening");
        return;
      }
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
    if (isListening) {
      stopSTT();
      setAvatarState("idle");
    } else {
      startSTT();
      setAvatarState("listening");
    }
  }, [isListening, startSTT, stopSTT]);

  useWakeWord({
    onWake: () => {
      if (!isListening) {
        startSTT();
        setAvatarState("listening");
      }
    },
  });

  const handleCommand = useCallback(
    (action: string) => {
      const routes: Record<string, string> = {
        calendar: "/calendar",
        email: "/email",
        task: "/tasks",
        memory: "/memory",
        automation: "/automations",
        settings: "/settings",
        browser: "/browser",
        coding: "/coding",
      };
      navigate(routes[action] || "/chat");
    },
    [navigate]
  );

  const handleSignOut = async () => {
    logActivity("auth", "Signed out", "logout");
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <p className="text-sm text-[#6e6e8a]">
              {getGreeting()}
              {user?.displayName ? `, ${user.displayName}` : user?.email ? `, ${user.email}` : ""}
            </p>
            <h1 className="text-2xl font-bold tracking-tight mt-1">Nova Command Center</h1>
          </div>
          <div className="flex items-center gap-3">
            <StatusIndicator />
            <Button
              variant="ghost"
              size="sm"
              className="text-[#6e6e8a] hover:text-[#e8e8f8]"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </motion.header>

        {/* Local AI Onboarding */}
        {localAIAvailable === true && !localAICached && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0.5}
          >
            <Card className="nova-glass p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981]/20 to-[#00d4ff]/20 flex items-center justify-center shrink-0">
                <Cpu className="w-5 h-5 text-[#10b981]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#e8e8f8]">Enable Nova Local AI</p>
                <p className="text-xs text-[#6e6e8a]">Download a small model to chat without Gemini</p>
              </div>
              <Button
                onClick={() => setShowLocalAIDownload(true)}
                size="sm"
                className="bg-[#10b981] text-[#06060c] hover:bg-[#10b981]/80 shrink-0"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Avatar Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
        >
          <Card className="nova-glass p-8 sm:p-12">
            <div className="flex flex-col items-center gap-6">
              {/* Avatar */}
              <div className="relative cursor-pointer" onClick={handleVoiceToggle}>
                <NovaAvatar state={avatarState} size={180} />
                {!isSupported && (
                  <p className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-[#f59e0b] whitespace-nowrap">
                    Voice not supported in this browser
                  </p>
                )}
              </div>

              {/* Voice Button */}
              <Button
                onClick={handleVoiceToggle}
                disabled={!isSupported}
                className={`h-14 px-8 rounded-full font-semibold text-base transition-all duration-300 ${
                  isListening
                    ? "bg-[#f43f5e] text-white hover:bg-[#f43f5e]/80 shadow-lg shadow-[#f43f5e]/30"
                    : "bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] hover:shadow-lg hover:shadow-[#00d4ff]/30"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="mr-2 h-5 w-5" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-5 w-5" />
                    Talk to Nova
                  </>
                )}
              </Button>

              {/* Mute Toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-[#6e6e8a] hover:text-[#e8e8f8] transition-colors"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              {/* Response */}
              {novaResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-lg p-4 rounded-xl bg-[#16162a]/50 border border-[#252540] text-sm text-[#e8e8f8] leading-relaxed"
                >
                  {novaResponse}
                </motion.div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Quick Commands */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={2}
        >
          <h2 className="text-sm font-medium text-[#6e6e8a] uppercase tracking-wider mb-4">
            Quick Commands
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickCommands.map((cmd, i) => (
              <motion.div
                key={cmd.label}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={3 + i}
              >
                <Card
                  className="nova-glass nova-glass-hover p-4 cursor-pointer group"
                  onClick={() => handleCommand(cmd.action)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#16162a] flex items-center justify-center group-hover:bg-[#00d4ff]/10 transition-colors">
                      <cmd.icon className="w-4 h-4 text-[#6e6e8a] group-hover:text-[#00d4ff] transition-colors" />
                    </div>
                    <span className="text-sm font-medium text-[#e8e8f8] group-hover:text-[#00d4ff] transition-colors">
                      {cmd.label}
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Status Cards */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={5}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {[
            { label: "Tasks Pending", value: taskCount, color: "#10b981", route: "/tasks" },
            { label: "Memories", value: memoryCount, color: "#8b5cf6", route: "/memory" },
            { label: "Conversations", value: convCount, color: "#00d4ff", route: "/chat" },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="nova-glass nova-glass-hover p-4 cursor-pointer"
              onClick={() => navigate(stat.route)}
            >
              <p className="text-xs text-[#6e6e8a] uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: stat.color }}>
                {stat.value}
              </p>
            </Card>
          ))}
        </motion.div>
      </div>

      <DownloadModal
        open={showLocalAIDownload}
        onClose={() => {
          setShowLocalAIDownload(false);
          localAIService.isCached().then(setLocalAICached);
        }}
      />
    </main>
  );
}
