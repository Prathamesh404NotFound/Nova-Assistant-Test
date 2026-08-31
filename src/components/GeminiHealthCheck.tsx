/**
 * Gemini Health Check Diagnostic
 * Development-safe diagnostic panel showing Gemini API status.
 * Only shows detailed results, never exposes the API key.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkGeminiHealth, type GeminiHealthResult } from "@/lib/gemini";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface GeminiHealthCheckProps {
  apiKey?: string;
}

export function GeminiHealthCheck({ apiKey }: GeminiHealthCheckProps) {
  const [result, setResult] = useState<GeminiHealthResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const health = await checkGeminiHealth(apiKey);
      setResult(health);
    } catch (err) {
      setResult({
        apiKeyConfigured: !!apiKey,
        apiReachable: false,
        modelsDiscovered: 0,
        selectedModel: "",
        generationSupported: false,
        testPassed: false,
        error: err instanceof Error ? err.message : "Health check failed",
      });
    } finally {
      setIsChecking(false);
    }
  }, [apiKey]);

  return (
    <Card className="nova-glass p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#00d4ff]" />
          <p className="text-sm font-medium text-[#e8e8f8]">Gemini Health Check</p>
        </div>
        <Button
          onClick={runCheck}
          disabled={isChecking}
          size="sm"
          variant="outline"
          className="border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8] text-xs h-8"
        >
          {isChecking ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          {isChecking ? "Checking..." : "Run Check"}
        </Button>
      </div>

      {result && (
        <div className="space-y-2 text-xs">
          <StatusRow
            label="API key"
            ok={result.apiKeyConfigured}
            detail={result.apiKeyConfigured ? "Configured" : "Missing"}
          />
          <StatusRow
            label="API reachable"
            ok={result.apiReachable}
            detail={result.apiReachable ? "Yes" : "No"}
          />
          <StatusRow
            label="Models discovered"
            ok={result.modelsDiscovered > 0}
            detail={`${result.modelsDiscovered} models`}
          />
          <StatusRow
            label="Selected model"
            ok={!!result.selectedModel}
            detail={result.selectedModel || "None"}
          />
          <StatusRow
            label="Generation test"
            ok={result.testPassed}
            detail={result.testPassed ? "PASS" : "FAIL"}
          />

          {result.error && (
            <div className="p-2 rounded-lg bg-[#f43f5e]/10 text-[#f43f5e] mt-2">
              {result.error}
            </div>
          )}

          {result.testPassed && (
            <div className="p-2 rounded-lg bg-[#10b981]/10 text-[#10b981] mt-2">
              ✓ Gemini is working correctly with model: {result.selectedModel}
            </div>
          )}
        </div>
      )}

      {!result && !isChecking && (
        <p className="text-xs text-[#6e6e8a]">
          Click "Run Check" to verify your Gemini API integration.
        </p>
      )}
    </Card>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6e6e8a]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[#e8e8f8] font-mono">{detail}</span>
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-[#10b981]" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-[#f43f5e]" />
        )}
      </div>
    </div>
  );
}
