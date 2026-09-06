import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { permissionsService, type PermissionId } from "@/services/permissions";
import { ShieldCheck, X } from "lucide-react";

interface PermissionRequest {
  permission: PermissionId;
  tool?: string;
  message?: string;
}

/** Global bridge from agent/security denials to an explicit user permission prompt. */
export function PermissionPrompt() {
  const [request, setRequest] = useState<PermissionRequest | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<PermissionRequest>).detail;
      if (detail?.permission) setRequest(detail);
    };
    window.addEventListener("nova:permission-request", onRequest);
    return () => window.removeEventListener("nova:permission-request", onRequest);
  }, []);

  if (!request) return null;

  const allow = async () => {
    setBusy(true);
    try {
      await permissionsService.grant(request.permission);
      window.dispatchEvent(new CustomEvent("nova:permission-granted", { detail: request }));
      setRequest(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-cyan-400/30 bg-[#0b1929] p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-cyan-400/10 p-2"><ShieldCheck className="h-5 w-5 text-cyan-300" /></div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-100">Nova needs permission</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {request.message || `Allow Nova to use ${request.permission.replaceAll("_", " ")}${request.tool ? ` for ${request.tool}` : ""}?`}
            </p>
          </div>
          <button onClick={() => setRequest(null)} className="text-slate-500 hover:text-slate-200" aria-label="Close permission prompt"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={() => setRequest(null)} className="flex-1 border border-slate-700 text-slate-300">Not now</Button>
          <Button onClick={allow} disabled={busy} className="flex-1 bg-cyan-400 text-slate-950 hover:bg-cyan-300">{busy ? "Requesting…" : "Allow"}</Button>
        </div>
      </div>
    </div>
  );
}
