import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getActivities,
  logActivity,
  type ActivityEntry,
} from "@/lib/local-store";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  MessageSquare,
  CheckSquare,
  Brain,
  Calendar,
  Mail,
  Mic,
  Zap,
  Shield,
  Settings,
  Globe,
  Code,
  Home,
  Files,
  Bot,
  Trash2,
  RotateCcw,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

const iconMap: Record<string, React.ComponentType<any>> = {
  zap: Zap,
  message: MessageSquare,
  "message-square": MessageSquare,
  task: CheckSquare,
  brain: Brain,
  calendar: Calendar,
  mail: Mail,
  mic: Mic,
  shield: Shield,
  settings: Settings,
  globe: Globe,
  code: Code,
  home: Home,
  files: Files,
  bot: Bot,
  send: RotateCcw,
  logout: Shield,
  trash: Trash2,
  voice: Mic,
  auth: Shield,
};

const typeColors: Record<string, string> = {
  chat: "#00d4ff",
  task: "#10b981",
  memory: "#8b5cf6",
  calendar: "#f59e0b",
  email: "#f43f5e",
  message: "#00d4ff",
  automation: "#10b981",
  voice: "#8b5cf6",
  auth: "#6e6e8a",
  settings: "#6e6e8a",
  device: "#f59e0b",
};

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    setActivities(getActivities());
  }, []);

  const refresh = useCallback(() => {
    setActivities(getActivities());
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem("nova_activity");
    logActivity("settings", "Cleared activity log", "trash");
    refresh();
  }, [refresh]);

  // Group by day
  const grouped: Record<string, ActivityEntry[]> = {};
  for (const act of activities) {
    const day = new Date(act.createdAt).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(act);
  }

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">{activities.length} events logged</p>
            </div>
            {activities.length > 0 && (
              <Button
                onClick={clearAll}
                variant="ghost"
                size="sm"
                className="text-[#6e6e8a] hover:text-[#f43f5e]"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </motion.div>

        {Object.entries(grouped).map(([day, entries], dayIdx) => (
          <motion.div
            key={day}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={dayIdx + 1}
          >
            <p className="text-xs text-[#6e6e8a] uppercase tracking-wider mb-3">{day}</p>
            <div className="space-y-2">
              {entries.map((act) => {
                const Icon = iconMap[act.icon] || Zap;
                const color = typeColors[act.type] || "#6e6e8a";
                return (
                  <Card key={act.id} className="nova-glass p-3 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#e8e8f8] truncate">{act.description}</p>
                      <p className="text-[10px] text-[#6e6e8a]">
                        {new Date(act.createdAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge
                      className="text-[10px] border-0"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      {act.type}
                    </Badge>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        ))}

        {activities.length === 0 && (
          <div className="text-center py-20">
            <Activity className="h-12 w-12 text-[#252540] mx-auto mb-4" />
            <p className="text-[#6e6e8a] text-sm">No activity yet. Start using Nova to see your activity feed.</p>
          </div>
        )}
      </div>
    </main>
  );
}
