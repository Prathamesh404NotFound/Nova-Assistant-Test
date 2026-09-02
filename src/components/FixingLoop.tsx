/**
 * Nova AI OS — Fixing Loop
 * Autonomous fixing loop that operates without user verification.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { runDiagnostics, getDiagnosticSummary, type DiagnosticResult } from "@/lib/diagnostics";
import { attemptFixes, getFixSummary, type FixResult } from "@/lib/auto-fix";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, XCircle, Loader2, Play, Square } from "lucide-react";

interface LoopStatus {
  running: boolean;
  iteration: number;
  maxIterations: number;
  diagnostics: DiagnosticResult[];
  fixes: FixResult[];
  summary: ReturnType<typeof getDiagnosticSummary> | null;
  fixSummary: ReturnType<typeof getFixSummary> | null;
  stopped: boolean;
}

export function FixingLoop() {
  const [status, setStatus] = useState<LoopStatus>({
    running: false,
    iteration: 0,
    maxIterations: 10,
    diagnostics: [],
    fixes: [],
    summary: null,
    fixSummary: null,
    stopped: false,
  });

  const abortRef = useRef(false);

  const runLoop = useCallback(async () => {
    abortRef.current = false;
    setStatus((prev) => ({ ...prev, running: true, stopped: false, iteration: 0 }));

    let iteration = 0;

    while (!abortRef.current && iteration < 10) {
      iteration++;

      // Run diagnostics
      const diagnostics = await runDiagnostics();
      const summary = getDiagnosticSummary(diagnostics);

      setStatus((prev) => ({
        ...prev,
        iteration,
        diagnostics,
        summary,
      }));

      // If all checks pass, stop
      if (summary.allPassed) {
        setStatus((prev) => ({ ...prev, running: false }));
        return;
      }

      // Attempt fixes
      const fixes = await attemptFixes();
      const fixSummary = getFixSummary(fixes);

      setStatus((prev) => ({
        ...prev,
        fixes,
        fixSummary,
      }));

      // If no fixes were possible, stop
      if (fixSummary.successful === 0) {
        setStatus((prev) => ({ ...prev, running: false }));
        return;
      }

      // Wait before next iteration
      await new Promise((r) => setTimeout(r, 1000));
    }

    setStatus((prev) => ({ ...prev, running: false }));
  }, []);

  const stopLoop = useCallback(() => {
    abortRef.current = true;
    setStatus((prev) => ({ ...prev, running: false, stopped: true }));
  }, []);

  return (
    <Card className="p-4 bg-[#0d0d16] border-[#252540] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[#e8e8f8]">Self-Correcting Loop</h3>
          {status.running && (
            <Loader2 className="h-3 w-3 text-[#00d4ff] animate-spin" />
          )}
        </div>
        <div className="flex gap-2">
          {!status.running ? (
            <Button
              onClick={runLoop}
              size="sm"
              className="bg-[#10b981] text-[#06060c] text-xs"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          ) : (
            <Button
              onClick={stopLoop}
              size="sm"
              className="bg-[#f43f5e] text-white text-xs"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {status.iteration > 0 && (
        <div className="text-xs text-[#6e6e8a]">
          Iteration {status.iteration}/10
        </div>
      )}

      {/* Diagnostics */}
      {status.diagnostics.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#e8e8f8]">Diagnostics</p>
          {status.diagnostics.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {d.status === "pass" && <CheckCircle2 className="h-3 w-3 text-[#10b981]" />}
              {d.status === "warn" && <AlertCircle className="h-3 w-3 text-[#f59e0b]" />}
              {d.status === "fail" && <XCircle className="h-3 w-3 text-[#f43f5e]" />}
              <span className="text-[#6e6e8a]">{d.name}:</span>
              <span className={
                d.status === "pass" ? "text-[#10b981]" :
                d.status === "warn" ? "text-[#f59e0b]" :
                "text-[#f43f5e]"
              }>
                {d.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fixes */}
      {status.fixes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#e8e8f8]">Fixes Applied</p>
          {status.fixes.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {f.success ? (
                <CheckCircle2 className="h-3 w-3 text-[#10b981]" />
              ) : (
                <XCircle className="h-3 w-3 text-[#f43f5e]" />
              )}
              <span className="text-[#6e6e8a]">{f.name}:</span>
              <span className={f.success ? "text-[#10b981]" : "text-[#f43f5e]"}>
                {f.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {status.summary && (
        <div className="pt-2 border-t border-[#252540]">
          <div className="flex gap-4 text-xs">
            <span className="text-[#10b981]">{status.summary.passed} passed</span>
            <span className="text-[#f43f5e]">{status.summary.failed} failed</span>
            <span className="text-[#f59e0b]">{status.summary.warnings} warnings</span>
          </div>
        </div>
      )}
    </Card>
  );
}
