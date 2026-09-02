/**
 * Nova AI OS — Configuration Status Indicator
 * Shows which services are connected with color-coded dots.
 */

import { useState, useEffect } from "react";
import { isFirebaseConfigured, isGeminiConfigured, isVoiceConfigured } from "@/lib/env-validator";
import { localAIService } from "@/ai/local/LocalAIService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Shield, Cpu, Mic, Cloud } from "lucide-react";

interface ServiceStatus {
  name: string;
  configured: boolean;
  icon: typeof Shield;
}

export function ConfigStatus() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [localAICached, setLocalAICached] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const cached = await localAIService.isCached();
      setLocalAICached(cached);

      setServices([
        {
          name: "Firebase Auth",
          configured: isFirebaseConfigured(),
          icon: Shield,
        },
        {
          name: "Gemini AI",
          configured: isGeminiConfigured(),
          icon: Cloud,
        },
        {
          name: "Local AI",
          configured: cached,
          icon: Cpu,
        },
        {
          name: "Voice APIs",
          configured: isVoiceConfigured(),
          icon: Mic,
        },
      ]);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const allConfigured = services.every((s) => s.configured);
  const someMissing = services.some((s) => !s.configured);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono transition-colors ${
            allConfigured
              ? "bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25"
              : someMissing
              ? "bg-[#f59e0b]/15 text-[#f59e0b] hover:bg-[#f59e0b]/25"
              : "bg-[#6e6e8a]/15 text-[#6e6e8a] hover:bg-[#6e6e8a]/25"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              allConfigured ? "bg-[#10b981]" : someMissing ? "bg-[#f59e0b]" : "bg-[#6e6e8a]"
            }`}
          />
          {allConfigured ? "All OK" : someMissing ? "Config" : "Unknown"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 bg-[#0d0d16] border-[#252540]" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#e8e8f8] mb-3">Service Status</p>
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <service.icon className="h-3 w-3 text-[#6e6e8a]" />
                <span className="text-xs text-[#6e6e8a]">{service.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    service.configured ? "bg-[#10b981]" : "bg-[#f43f5e]"
                  }`}
                />
                <span
                  className={`text-[10px] ${
                    service.configured ? "text-[#10b981]" : "text-[#f43f5e]"
                  }`}
                >
                  {service.configured ? "Connected" : "Missing"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
