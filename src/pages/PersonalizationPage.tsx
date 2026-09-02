/**
 * Nova AI OS — Personalization Settings
 * Tone, response length, preferred tools, timezone, working hours,
 * notification rules, and per-project preferences.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Clock,
  Bell,
  Wrench,
  Globe,
  Palette,
  MessageSquare,
  Save,
  RotateCcw,
} from "lucide-react";

export interface PersonalizationPrefs {
  // Response style
  tone: "professional" | "casual" | "concise" | "detailed";
  responseLength: "short" | "medium" | "long";
  language: "en" | "hi" | "mr" | "auto";
  alwaysReplyIn: "none" | "hi" | "mr" | "en";

  // Tools
  preferredModel: "auto" | "gemini" | "local" | "hybrid";
  autoUseTools: boolean;
  confirmBeforeSending: boolean;

  // Time
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;

  // Notifications
  notificationsEnabled: boolean;
  notifyOnTaskComplete: boolean;
  notifyOnError: boolean;
  notifyOnReminder: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  // Workspace
  defaultProjectId: string;
  showAnalytics: boolean;
  compactMode: boolean;
}

const STORAGE_KEY = "nova_personalization";

const DEFAULT_PREFS: PersonalizationPrefs = {
  tone: "professional",
  responseLength: "medium",
  language: "auto",
  alwaysReplyIn: "none",
  preferredModel: "auto",
  autoUseTools: true,
  confirmBeforeSending: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  notificationsEnabled: true,
  notifyOnTaskComplete: true,
  notifyOnError: true,
  notifyOnReminder: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  defaultProjectId: "",
  showAnalytics: true,
  compactMode: false,
};

function loadPrefs(): PersonalizationPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULT_PREFS, ...saved };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: PersonalizationPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function ToggleSwitch({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          enabled ? "bg-cyan-500" : "bg-slate-600"
        }`}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-4" : ""
          }`}
        />
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-slate-300 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 outline-none max-w-[200px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-slate-300 shrink-0">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 outline-none"
      />
    </div>
  );
}

export function PersonalizationSettings() {
  const [prefs, setPrefs] = useState<PersonalizationPrefs>(loadPrefs);
  const [saved, setSaved] = useState(false);

  const update = useCallback(
    <K extends keyof PersonalizationPrefs>(key: K, value: PersonalizationPrefs[K]) => {
      setPrefs((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    },
    []
  );

  const handleSave = useCallback(() => {
    savePrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [prefs]);

  const handleReset = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    savePrefs(DEFAULT_PREFS);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Personalization</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Customize Nova's behavior and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              saved
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* Response Style */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200">Response Style</h3>
        </div>
        <SelectField
          label="Tone"
          value={prefs.tone}
          onChange={(v) => update("tone", v as PersonalizationPrefs["tone"])}
          options={[
            { value: "professional", label: "Professional" },
            { value: "casual", label: "Casual" },
            { value: "concise", label: "Concise" },
            { value: "detailed", label: "Detailed" },
          ]}
        />
        <SelectField
          label="Response Length"
          value={prefs.responseLength}
          onChange={(v) => update("responseLength", v as PersonalizationPrefs["responseLength"])}
          options={[
            { value: "short", label: "Short (1-2 sentences)" },
            { value: "medium", label: "Medium (paragraph)" },
            { value: "long", label: "Long (detailed)" },
          ]}
        />
        <SelectField
          label="Language"
          value={prefs.language}
          onChange={(v) => update("language", v as PersonalizationPrefs["language"])}
          options={[
            { value: "auto", label: "Auto-detect" },
            { value: "en", label: "English" },
            { value: "hi", label: "Hindi" },
            { value: "mr", label: "Marathi" },
          ]}
        />
        <SelectField
          label="Always Reply In"
          value={prefs.alwaysReplyIn}
          onChange={(v) => update("alwaysReplyIn", v as PersonalizationPrefs["alwaysReplyIn"])}
          options={[
            { value: "none", label: "Don't force" },
            { value: "en", label: "English" },
            { value: "hi", label: "Hindi" },
            { value: "mr", label: "Marathi" },
          ]}
        />
      </div>

      {/* AI & Tools */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-semibold text-slate-200">AI & Tools</h3>
        </div>
        <SelectField
          label="Preferred Model"
          value={prefs.preferredModel}
          onChange={(v) => update("preferredModel", v as PersonalizationPrefs["preferredModel"])}
          options={[
            { value: "auto", label: "Auto (best available)" },
            { value: "gemini", label: "Gemini only" },
            { value: "local", label: "Local AI only" },
            { value: "hybrid", label: "Hybrid (local + cloud)" },
          ]}
        />
        <ToggleSwitch
          label="Auto-use tools when needed"
          enabled={prefs.autoUseTools}
          onChange={(v) => update("autoUseTools", v)}
        />
        <ToggleSwitch
          label="Confirm before sending emails/messages"
          enabled={prefs.confirmBeforeSending}
          onChange={(v) => update("confirmBeforeSending", v)}
        />
      </div>

      {/* Time & Schedule */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200">Time & Schedule</h3>
        </div>
        <SelectField
          label="Timezone"
          value={prefs.timezone}
          onChange={(v) => update("timezone", v)}
          options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
        />
        <TimeField
          label="Working Hours Start"
          value={prefs.workingHoursStart}
          onChange={(v) => update("workingHoursStart", v)}
        />
        <TimeField
          label="Working Hours End"
          value={prefs.workingHoursEnd}
          onChange={(v) => update("workingHoursEnd", v)}
        />
      </div>

      {/* Notifications */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-purple-400" />
          <h3 className="text-xs font-semibold text-slate-200">Notifications</h3>
        </div>
        <ToggleSwitch
          label="Enable notifications"
          enabled={prefs.notificationsEnabled}
          onChange={(v) => update("notificationsEnabled", v)}
        />
        {prefs.notificationsEnabled && (
          <>
            <ToggleSwitch
              label="Notify on task completion"
              enabled={prefs.notifyOnTaskComplete}
              onChange={(v) => update("notifyOnTaskComplete", v)}
            />
            <ToggleSwitch
              label="Notify on errors"
              enabled={prefs.notifyOnError}
              onChange={(v) => update("notifyOnError", v)}
            />
            <ToggleSwitch
              label="Notify on reminders"
              enabled={prefs.notifyOnReminder}
              onChange={(v) => update("notifyOnReminder", v)}
            />
            <TimeField
              label="Quiet Hours Start"
              value={prefs.quietHoursStart}
              onChange={(v) => update("quietHoursStart", v)}
            />
            <TimeField
              label="Quiet Hours End"
              value={prefs.quietHoursEnd}
              onChange={(v) => update("quietHoursEnd", v)}
            />
          </>
        )}
      </div>

      {/* Workspace */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="h-4 w-4 text-pink-400" />
          <h3 className="text-xs font-semibold text-slate-200">Workspace</h3>
        </div>
        <ToggleSwitch
          label="Show analytics on dashboard"
          enabled={prefs.showAnalytics}
          onChange={(v) => update("showAnalytics", v)}
        />
        <ToggleSwitch
          label="Compact mode"
          enabled={prefs.compactMode}
          onChange={(v) => update("compactMode", v)}
        />
      </div>
    </div>
  );
}

export default PersonalizationSettings;
