import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Code, Play, Terminal, Trash2 } from "lucide-react";
import { permissionsService } from "@/services/permissions";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

export default function CodingPage() {
  const [hasToken] = useState(() => !!localStorage.getItem("nova_github_token"));
  const [code, setCode] = useState(`// Real JavaScript Execution Sandbox\nconst data = [10, 20, 30, 40, 50];\nconst sum = data.reduce((a, b) => a + b, 0);\nconsole.log("Calculated Sum:", sum);\nconsole.log("System Time:", new Date().toISOString());`);
  const [logs, setLogs] = useState<string[]>([]);

  const runCode = () => {
    if (!permissionsService.isGranted("external_actions")) {
      window.dispatchEvent(new CustomEvent("nova:permission-request", {
        detail: { permission: "external_actions", tool: "coding.run", message: "Nova needs permission to execute code in the browser sandbox." },
      }));
      setLogs(["Permission required: allow External Actions, then run the code again."]);
      return;
    }
    setLogs([]);
    const capturedLogs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => capturedLogs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
      error: (...args: any[]) => capturedLogs.push("[ERROR] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
      warn: (...args: any[]) => capturedLogs.push("[WARN] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
    };

    try {
      const fn = new Function("console", code);
      fn(customConsole);
      setLogs(capturedLogs.length ? capturedLogs : ["Code executed successfully with no output."]);
    } catch (err: any) {
      setLogs([`Runtime Error: ${err?.message || String(err)}`]);
    }
  };

  return (
    <main className="min-h-screen bg-[#050507] text-[#e0e0e6] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Coding Playground</h1>
                <Badge className={`text-xs border-0 ${hasToken ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
                  {hasToken ? "GitHub Connected" : "Local Sandbox"}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">Write, execute, and debug real code in Nova OS</p>
            </div>
            <Button onClick={runCode} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold gap-2">
              <Play className="w-4 h-4 fill-current" /> Run Code
            </Button>
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#0e0e15] border border-white/5 p-4 flex flex-col space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-mono text-cyan-400 flex items-center gap-1.5"><Code className="w-4 h-4" /> script.js</span>
              <span className="text-[10px] text-slate-500 uppercase font-mono">JavaScript</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-72 bg-[#050507] border border-white/10 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none"
              spellCheck={false}
            />
          </Card>

          <Card className="bg-[#0e0e15] border border-white/5 p-4 flex flex-col space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-mono text-purple-400 flex items-center gap-1.5"><Terminal className="w-4 h-4" /> Console Output</span>
              <button onClick={() => setLogs([])} className="text-slate-500 hover:text-slate-300">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-full h-72 bg-[#050507] border border-white/10 rounded-lg p-3 font-mono text-xs overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <span className="text-slate-600 italic">Click "Run Code" to execute code...</span>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={log.startsWith("[ERROR]") ? "text-red-400" : "text-green-400"}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
