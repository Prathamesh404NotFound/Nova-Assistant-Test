import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import {
  getAutomations,
  addAutomation,
  updateAutomation,
  deleteAutomation,
  type Automation,
} from "@/lib/local-store";
import { logActivity } from "@/lib/local-store";
import {
  Zap,
  Plus,
  Trash2,
  X,
  Clock,
  Play,
  Pause,
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

const triggerPresets = [
  "Every morning at 8am",
  "When I say 'start work'",
  "Every Monday at 9am",
  "When a task is completed",
  "Daily at 6pm",
  "Every hour",
];

const actionPresets = [
  "Send me a summary of today's tasks",
  "Create a reminder for tomorrow",
  "List my memories",
  "Show today's calendar",
  "Read my emails",
  "Send a message to",
];

export default function AutomationsPage() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newAction, setNewAction] = useState("");

  useEffect(() => {
    setAutomations(getAutomations());
  }, []);

  const refresh = useCallback(() => {
    setAutomations(getAutomations());
  }, []);

  const handleAdd = useCallback(() => {
    if (!newName.trim() || !newTrigger.trim() || !newAction.trim()) return;
    addAutomation({
      name: newName.trim(),
      description: newDesc.trim(),
      trigger: newTrigger.trim(),
      action: newAction.trim(),
    });
    logActivity("automation", `Created automation: ${newName.trim()}`, "zap");
    setNewName("");
    setNewDesc("");
    setNewTrigger("");
    setNewAction("");
    setShowNew(false);
    refresh();
  }, [newName, newDesc, newTrigger, newAction, refresh]);

  const handleToggle = useCallback(
    (id: string) => {
      const auto = automations.find((a) => a.id === id);
      if (!auto) return;
      updateAutomation(id, { enabled: !auto.enabled });
      logActivity(
        "automation",
        `${auto.enabled ? "Disabled" : "Enabled"}: ${auto.name}`,
        auto.enabled ? "pause" : "play"
      );
      refresh();
    },
    [automations, refresh]
  );

  const handleSimulate = useCallback(
    (id: string) => {
      const auto = automations.find((a) => a.id === id);
      if (!auto) return;
      updateAutomation(id, {
        lastRun: Date.now(),
        runCount: auto.runCount + 1,
      });
      logActivity("automation", `Ran automation: ${auto.name}`, "play");
      refresh();
    },
    [automations, refresh]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const auto = automations.find((a) => a.id === id);
      deleteAutomation(id);
      if (auto) logActivity("automation", `Deleted automation: ${auto.name}`, "trash");
      refresh();
    },
    [automations, refresh]
  );

  const enabledCount = automations.filter((a) => a.enabled).length;
  const totalRuns = automations.reduce((sum, a) => sum + a.runCount, 0);

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">
                {enabledCount} active · {totalRuns} total runs
              </p>
            </div>
            <Button onClick={() => setShowNew(!showNew)} className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80">
              {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
              {showNew ? "Cancel" : "New Automation"}
            </Button>
          </div>
        </motion.div>

        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="nova-glass p-4 space-y-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Automation name..."
                autoFocus
                className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
              />
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)..."
                className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
              />

              {/* Trigger */}
              <div>
                <label className="text-xs text-[#6e6e8a] uppercase tracking-wider mb-1 block">Trigger</label>
                <Input
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  placeholder="When should this run?"
                  className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {triggerPresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setNewTrigger(preset)}
                      className={`px-2 py-1 rounded text-[10px] transition-colors ${
                        newTrigger === preset
                          ? "bg-[#00d4ff]/15 text-[#00d4ff]"
                          : "bg-[#16162a] text-[#6e6e8a] hover:text-[#e8e8f8]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div>
                <label className="text-xs text-[#6e6e8a] uppercase tracking-wider mb-1 block">Action</label>
                <Input
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  placeholder="What should Nova do?"
                  className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {actionPresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setNewAction(preset)}
                      className={`px-2 py-1 rounded text-[10px] transition-colors ${
                        newAction === preset
                          ? "bg-[#8b5cf6]/15 text-[#8b5cf6]"
                          : "bg-[#16162a] text-[#6e6e8a] hover:text-[#e8e8f8]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleAdd} className="bg-[#00d4ff] text-[#06060c] w-full">
                Create Automation
              </Button>
            </Card>
          </motion.div>
        )}

        <div className="space-y-3">
          {automations.map((auto, i) => (
            <motion.div key={auto.id} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
              <Card className="nova-glass nova-glass-hover p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    auto.enabled ? "bg-[#10b981]/15" : "bg-[#6e6e8a]/15"
                  }`}>
                    <Zap className="w-5 h-5" style={{ color: auto.enabled ? "#10b981" : "#6e6e8a" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-[#e8e8f8]">{auto.name}</p>
                      <Badge className={`text-[10px] border-0 ${
                        auto.enabled
                          ? "bg-[#10b981]/15 text-[#10b981]"
                          : "bg-[#6e6e8a]/15 text-[#6e6e8a]"
                      }`}>
                        {auto.enabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    {auto.description && (
                      <p className="text-xs text-[#6e6e8a] mb-2">{auto.description}</p>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs text-[#6e6e8a]">
                        <span className="text-[#f59e0b]">Trigger:</span> {auto.trigger}
                      </p>
                      <p className="text-xs text-[#6e6e8a]">
                        <span className="text-[#8b5cf6]">Action:</span> {auto.action}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-[#6e6e8a]">
                      <span className="flex items-center gap-1">
                        <Play className="w-3 h-3" /> {auto.runCount} runs
                      </span>
                      {auto.lastRun && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Last: {new Date(auto.lastRun).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <Switch
                      checked={auto.enabled}
                      onCheckedChange={() => handleToggle(auto.id)}
                    />
                    <button
                      onClick={() => handleSimulate(auto.id)}
                      className="p-1.5 text-[#6e6e8a] hover:text-[#00d4ff] rounded-lg hover:bg-[#1e1e38]"
                      title="Simulate run"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(auto.id)}
                      className="p-1.5 text-[#6e6e8a] hover:text-[#f43f5e] rounded-lg hover:bg-[#1e1e38]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {automations.length === 0 && !showNew && (
          <div className="text-center py-20">
            <Zap className="h-12 w-12 text-[#252540] mx-auto mb-4" />
            <p className="text-[#6e6e8a] text-sm">No automations yet. Create one to get started!</p>
          </div>
        )}
      </div>
    </main>
  );
}
