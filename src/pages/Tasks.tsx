import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  createTask, getTasks, updateTask, deleteTask, type RTDBTask,
} from "@/lib/rtdb";
import { EmptyState } from "@/components/EmptyState";
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, Trash2, X } from "lucide-react";
import { logActivity } from "@/lib/local-store";

const priorityColors: Record<string, string> = {
  low: "text-[#6e6e8a] bg-[#6e6e8a]/10",
  medium: "text-[#00d4ff] bg-[#00d4ff]/10",
  high: "text-[#f59e0b] bg-[#f59e0b]/10",
  urgent: "text-[#f43f5e] bg-[#f43f5e]/10",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-[#6e6e8a]" />,
  in_progress: <Clock className="h-4 w-4 text-[#00d4ff]" />,
  completed: <CheckCircle2 className="h-4 w-4 text-[#10b981]" />,
  failed: <AlertTriangle className="h-4 w-4 text-[#f43f5e]" />,
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<RTDBTask[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<RTDBTask["priority"]>("medium");

  const userId = user?.uid ?? "";

  // Load tasks from Firebase RTDB
  useEffect(() => {
    if (!userId) return;
    getTasks(userId).then(setTasks).catch(console.error);
  }, [userId]);

  const refreshTasks = useCallback(async () => {
    if (!userId) return;
    const t = await getTasks(userId);
    setTasks(t);
  }, [userId]);

  const addTask = useCallback(async () => {
    if (!newTitle.trim() || !userId) return;
    await createTask(userId, {
      title: newTitle.trim(),
      description: "",
      status: "pending",
      priority: newPriority,
    });
    logActivity("task", `Created task: ${newTitle.trim()}`, "check-square");
    setNewTitle("");
    setShowNew(false);
    await refreshTasks();
  }, [newTitle, newPriority, userId, refreshTasks]);

  const toggleStatus = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task || !userId) return;
    const next = task.status === "completed" ? "pending" : "completed";
    await updateTask(userId, id, { status: next });
    logActivity("task", `${next === "completed" ? "Completed" : "Reopened"} task: ${task.title}`, "check-square");
    await refreshTasks();
  }, [tasks, userId, refreshTasks]);

  const removeTask = useCallback(async (id: string) => {
    if (!userId) return;
    const task = tasks.find((t) => t.id === id);
    await deleteTask(userId, id);
    if (task) logActivity("task", `Deleted task: ${task.title}`, "trash");
    await refreshTasks();
  }, [userId, tasks, refreshTasks]);

  const pending = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">{pending.length} pending · {completed.length} completed</p>
            </div>
            <Button onClick={() => setShowNew(!showNew)} className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80">
              {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
              {showNew ? "Cancel" : "New Task"}
            </Button>
          </div>
        </motion.div>

        {showNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <Card className="nova-glass p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Task title..." autoFocus
                  className="flex-1 bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                />
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as RTDBTask["priority"])}
                  className="bg-[#16162a] border border-[#252540] rounded-lg px-3 py-2 text-sm text-[#e8e8f8] focus:outline-none">
                  <option value="low">Low</option><option value="medium">Medium</option>
                  <option value="high">High</option><option value="urgent">Urgent</option>
                </select>
                <Button onClick={addTask} className="bg-[#00d4ff] text-[#06060c]">Add</Button>
              </div>
            </Card>
          </motion.div>
        )}

        <div className="space-y-2">
          {pending.map((task, i) => (
            <motion.div key={task.id} initial="hidden" animate="visible" variants={fadeUp} custom={i}>
              <Card className="nova-glass nova-glass-hover p-4 flex items-center gap-3">
                <button onClick={() => toggleStatus(task.id)} className="shrink-0">{statusIcons[task.status]}</button>
                <p className="flex-1 text-sm font-medium text-[#e8e8f8] truncate">{task.title}</p>
                <Badge className={`${priorityColors[task.priority]} border-0 text-xs`}>{task.priority}</Badge>
                <button onClick={() => removeTask(task.id)} className="shrink-0 text-[#6e6e8a] hover:text-[#f43f5e]"><Trash2 className="h-3.5 w-3.5" /></button>
              </Card>
            </motion.div>
          ))}
        </div>

        {completed.length > 0 && (
          <>
            <p className="text-xs text-[#6e6e8a] uppercase tracking-wider">Completed</p>
            <div className="space-y-2">
              {completed.map((task, i) => (
                <motion.div key={task.id} initial="hidden" animate="visible" variants={fadeUp} custom={i}>
                  <Card className="nova-glass p-4 flex items-center gap-3 opacity-60">
                    <button onClick={() => toggleStatus(task.id)} className="shrink-0"><CheckCircle2 className="h-4 w-4 text-[#10b981]" /></button>
                    <p className="text-sm text-[#6e6e8a] line-through flex-1">{task.title}</p>
                    <button onClick={() => removeTask(task.id)} className="text-[#6e6e8a] hover:text-[#f43f5e]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {tasks.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="No tasks yet"
            description="Create your first task to start tracking your work. Tasks sync across your devices and persist in your account."
            actionLabel="Create Task"
            onAction={() => setShowNew(true)}
          />
        )}
      </div>
    </main>
  );
}
