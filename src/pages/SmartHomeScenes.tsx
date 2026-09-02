/**
 * Nova AI OS — Smart Home Scenes
 * Device grouping, schedules, routines, state history,
 * rollback, and confirmation for sensitive actions.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Home,
  Lightbulb,
  Thermometer,
  Lock,
  Camera,
  Bell,
  Power,
  Plus,
  Trash2,
  Play,
  Pause,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Settings,
  Copy,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";

// --- Types ---
export interface Device {
  id: string;
  name: string;
  type: "light" | "thermostat" | "lock" | "camera" | "speaker" | "sensor" | "bell";
  room: string;
  isOn: boolean;
  brightness?: number;
  temperature?: number;
  locked?: boolean;
  lastChanged: number;
}

export interface Scene {
  id: string;
  name: string;
  icon: string;
  devices: { deviceId: string; state: Partial<Device> }[];
  active: boolean;
  createdAt: number;
  lastTriggered?: number;
}

export interface Routine {
  id: string;
  name: string;
  trigger: "time" | "sunset" | "sunrise" | "manual";
  triggerTime?: string;
  scenes: string[];
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
}

export interface StateHistory {
  deviceId: string;
  deviceName: string;
  change: string;
  timestamp: number;
  rollbackAvailable: boolean;
  previousState?: Partial<Device>;
}

const DEVICES_KEY = "nova_devices";
const SCENES_KEY = "nova_scenes";
const ROUTINES_KEY = "nova_routines";
const HISTORY_KEY = "nova_device_history";

function generateId(): string { return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

const DEFAULT_DEVICES: Device[] = [
  { id: "d1", name: "Living Room Light", type: "light", room: "Living Room", isOn: true, brightness: 80, lastChanged: Date.now() },
  { id: "d2", name: "Bedroom Light", type: "light", room: "Bedroom", isOn: false, brightness: 50, lastChanged: Date.now() },
  { id: "d3", name: "Front Door Lock", type: "lock", room: "Entrance", isOn: true, locked: true, lastChanged: Date.now() },
  { id: "d4", name: "Thermostat", type: "thermostat", room: "Living Room", isOn: true, temperature: 72, lastChanged: Date.now() },
  { id: "d5", name: "Security Camera", type: "camera", room: "Entrance", isOn: true, lastChanged: Date.now() },
  { id: "d6", name: "Kitchen Light", type: "light", room: "Kitchen", isOn: false, brightness: 100, lastChanged: Date.now() },
  { id: "d7", name: "Front Doorbell", type: "bell", room: "Entrance", isOn: true, lastChanged: Date.now() },
];

const DEVICE_ICONS: Record<string, typeof Home> = {
  light: Lightbulb, thermostat: Thermometer, lock: Lock, camera: Camera, speaker: Home, sensor: Zap, bell: Bell,
};

function loadDevices(): Device[] {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICES_KEY) || "[]");
    return saved.length > 0 ? saved : DEFAULT_DEVICES;
  } catch { return DEFAULT_DEVICES; }
}

function loadScenes(): Scene[] {
  try { return JSON.parse(localStorage.getItem(SCENES_KEY) || "[]"); } catch { return []; }
}

function loadRoutines(): Routine[] {
  try { return JSON.parse(localStorage.getItem(ROUTINES_KEY) || "[]"); } catch { return []; }
}

function loadHistory(): StateHistory[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

function saveAll(devices: Device[], scenes: Scene[], routines: Routine[], history: StateHistory[]) {
  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-200)));
}

export function SmartHomeScenes() {
  const [devices, setDevices] = useState<Device[]>(loadDevices);
  const [scenes, setScenes] = useState<Scene[]>(loadScenes);
  const [routines, setRoutines] = useState<Routine[]>(loadRoutines);
  const [history, setHistory] = useState<StateHistory[]>(loadHistory);
  const [activeTab, setActiveTab] = useState<"devices" | "scenes" | "routines" | "history">("devices");
  const [showCreateScene, setShowCreateScene] = useState(false);
  const [newSceneName, setNewSceneName] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: string; target: string; onConfirm: () => void } | null>(null);

  useEffect(() => { saveAll(devices, scenes, routines, history); }, [devices, scenes, routines, history]);

  const toggleDevice = useCallback((id: string) => {
    setDevices((prev) => prev.map((d) => {
      if (d.id !== id) return d;
      const newState = !d.isOn;
      const change = `${newState ? "Turned on" : "Turned off"}`;
      setHistory((h) => [{ deviceId: id, deviceName: d.name, change, timestamp: Date.now(), rollbackAvailable: true, previousState: { isOn: d.isOn, brightness: d.brightness } }, ...h].slice(0, 200));
      return { ...d, isOn: newState, lastChanged: Date.now() };
    }));
  }, []);

  const adjustDevice = useCallback((id: string, key: string, value: number) => {
    setDevices((prev) => prev.map((d) => {
      if (d.id !== id) return d;
      const prevValue = (d as unknown as Record<string, unknown>)[key];
      setHistory((h) => [{ deviceId: id, deviceName: d.name, change: `Changed ${key} to ${value}`, timestamp: Date.now(), rollbackAvailable: true, previousState: { [key]: prevValue } as Partial<Device> }, ...h].slice(0, 200));
      return { ...d, [key]: value, lastChanged: Date.now() };
    }));
  }, []);

  const triggerScene = useCallback((sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    setDevices((prev) => prev.map((d) => {
      const override = scene.devices.find((sd) => sd.deviceId === d.id);
      if (!override) return d;
      return { ...d, ...override.state, lastChanged: Date.now() };
    }));
    setScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, active: true, lastTriggered: Date.now() } : s));
    setHistory((h) => [{ deviceId: "scene", deviceName: scene.name, change: `Scene "${scene.name}" activated`, timestamp: Date.now(), rollbackAvailable: false }, ...h].slice(0, 200));
  }, [scenes]);

  const createScene = useCallback(() => {
    if (!newSceneName.trim()) return;
    const scene: Scene = {
      id: generateId(), name: newSceneName.trim(), icon: "💡",
      devices: devices.filter((d) => d.isOn).map((d) => ({ deviceId: d.id, state: { isOn: true } })),
      active: false, createdAt: Date.now(),
    };
    setScenes((prev) => [scene, ...prev]);
    setNewSceneName("");
    setShowCreateScene(false);
  }, [newSceneName, devices]);

  const deleteScene = useCallback((id: string) => { setScenes((prev) => prev.filter((s) => s.id !== id)); }, []);

  const toggleRoutine = useCallback((id: string) => {
    setRoutines((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, []);

  const createRoutine = useCallback(() => {
    const routine: Routine = {
      id: generateId(), name: "New Routine", trigger: "manual",
      scenes: scenes.length > 0 ? [scenes[0].id] : [], enabled: false, createdAt: Date.now(),
    };
    setRoutines((prev) => [routine, ...prev]);
  }, [scenes]);

  const deleteRoutine = useCallback((id: string) => { setRoutines((prev) => prev.filter((r) => r.id !== id)); }, []);

  const rollbackDevice = useCallback((deviceId: string, previousState?: Partial<Device>) => {
    if (!previousState) return;
    setDevices((prev) => prev.map((d) => d.id === deviceId ? { ...d, ...previousState, lastChanged: Date.now() } : d));
    setHistory((h) => [{ deviceId, deviceName: devices.find((d) => d.id === deviceId)?.name || "", change: "Rolled back", timestamp: Date.now(), rollbackAvailable: false }, ...h].slice(0, 200));
  }, [devices]);

  const confirmSensitiveAction = useCallback((type: string, target: string, onConfirm: () => void) => {
    setConfirmAction({ type, target, onConfirm });
  }, []);

  const rooms = [...new Set(devices.map((d) => d.room))];
  const activeDevices = devices.filter((d) => d.isOn).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Smart Home</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {activeDevices}/{devices.length} devices on · {scenes.length} scenes · {routines.length} routines
          </p>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-amber-400">Confirm Action</h3>
          </div>
          <p className="text-xs text-slate-300">Are you sure you want to {confirmAction.type} "{confirmAction.target}"?</p>
          <div className="flex gap-2">
            <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors"
            >Confirm</button>
            <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-0.5">
        {(["devices", "scenes", "routines", "history"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-[10px] font-mono rounded-md transition-colors ${
              activeTab === tab ? "bg-cyan-500/15 text-cyan-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {/* Devices */}
      {activeTab === "devices" && (
        <div className="space-y-4">
          {rooms.map((room) => (
            <div key={room}>
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">{room}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {devices.filter((d) => d.room === room).map((device) => {
                  const Icon = DEVICE_ICONS[device.type] || Home;
                  return (
                    <div key={device.id} className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors ${
                      device.isOn ? "bg-[#0f2137] border-cyan-500/20" : "bg-[#0a1425] border-[#1a2f4a]"
                    }`}>
                      <button onClick={() => toggleDevice(device.id)}
                        className={`p-2 rounded-lg transition-colors ${device.isOn ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-600/20 text-slate-500"}`}
                        aria-label={`Toggle ${device.name}`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200">{device.name}</p>
                        <p className="text-[10px] text-slate-500">{device.isOn ? "On" : "Off"}</p>
                      </div>
                      {device.type === "light" && device.isOn && (
                        <input type="range" min="0" max="100" value={device.brightness || 50}
                          onChange={(e) => adjustDevice(device.id, "brightness", Number(e.target.value))}
                          className="w-16 h-1 accent-cyan-400" aria-label={`Brightness for ${device.name}`}
                        />
                      )}
                      {device.type === "thermostat" && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => adjustDevice(device.id, "temperature", (device.temperature || 72) - 1)}
                            className="text-[10px] text-slate-500 hover:text-cyan-400">-</button>
                          <span className="text-xs font-mono text-slate-300">{device.temperature}°</span>
                          <button onClick={() => adjustDevice(device.id, "temperature", (device.temperature || 72) + 1)}
                            className="text-[10px] text-slate-500 hover:text-cyan-400">+</button>
                        </div>
                      )}
                      {device.type === "lock" && (
                        <button onClick={() => confirmSensitiveAction("toggle lock", device.name, () => toggleDevice(device.id))}
                          className={`text-[10px] font-mono px-2 py-1 rounded ${device.locked ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/15 text-red-400"}`}
                        >
                          {device.locked ? "Locked" : "Unlocked"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scenes */}
      {activeTab === "scenes" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">Scenes</span>
            <button onClick={() => setShowCreateScene(!showCreateScene)}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-cyan-500/15 text-cyan-400 rounded-md hover:bg-cyan-500/25 transition-colors"
            ><Plus className="h-3 w-3" /> New Scene</button>
          </div>
          {showCreateScene && (
            <div className="flex gap-2">
              <input type="text" value={newSceneName} onChange={(e) => setNewSceneName(e.target.value)}
                placeholder="Scene name..." className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none"
              />
              <button onClick={createScene} disabled={!newSceneName.trim()}
                className="px-3 py-2 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 transition-colors"
              >Create</button>
            </div>
          )}
          {scenes.length === 0 ? (
            <div className="text-center py-8">
              <Home className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-[10px] text-slate-500">No scenes yet — create one to control multiple devices</p>
            </div>
          ) : (
            scenes.map((scene) => (
              <div key={scene.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#0a1425] border border-[#1a2f4a] rounded-lg hover:bg-[#0f2137] transition-colors">
                <span className="text-lg">{scene.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200">{scene.name}</p>
                  <p className="text-[10px] text-slate-500">{scene.devices.length} devices · {scene.active ? "Active" : "Inactive"}</p>
                </div>
                <button onClick={() => triggerScene(scene.id)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-cyan-500/15 text-cyan-400 rounded-md hover:bg-cyan-500/25 transition-colors"
                ><Play className="h-3 w-3" /> Trigger</button>
                <button onClick={() => confirmSensitiveAction("delete scene", scene.name, () => deleteScene(scene.id))}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors" aria-label={`Delete ${scene.name}`}
                ><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Routines */}
      {activeTab === "routines" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">Routines</span>
            <button onClick={createRoutine}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-cyan-500/15 text-cyan-400 rounded-md hover:bg-cyan-500/25 transition-colors"
            ><Plus className="h-3 w-3" /> New Routine</button>
          </div>
          {routines.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-[10px] text-slate-500">No routines — create one to automate scenes</p>
            </div>
          ) : (
            routines.map((routine) => (
              <div key={routine.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#0a1425] border border-[#1a2f4a] rounded-lg">
                <Clock className="h-4 w-4 text-cyan-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200">{routine.name}</p>
                  <p className="text-[10px] text-slate-500">Trigger: {routine.trigger} · {routine.scenes.length} scenes</p>
                </div>
                <button onClick={() => toggleRoutine(routine.id)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${routine.enabled ? "bg-cyan-500" : "bg-slate-600"}`}
                  role="switch" aria-checked={routine.enabled}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${routine.enabled ? "translate-x-4" : ""}`} />
                </button>
                <button onClick={() => confirmSensitiveAction("delete routine", routine.name, () => deleteRoutine(routine.id))}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors" aria-label={`Delete ${routine.name}`}
                ><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))
          )}
        </div>
      )}

      {/* History */}
      {activeTab === "history" && (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center py-8">
              <RotateCcw className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-[10px] text-slate-500">No device history yet</p>
            </div>
          ) : (
            history.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#0a1425] hover:bg-[#0f2137] transition-colors">
                <RotateCcw className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300"><span className="text-cyan-400">{entry.deviceName}</span> — {entry.change}</p>
                </div>
                {entry.rollbackAvailable && entry.previousState && (
                  <button onClick={() => rollbackDevice(entry.deviceId, entry.previousState)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors shrink-0"
                  >Rollback</button>
                )}
                <span className="text-[9px] font-mono text-slate-600 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default SmartHomeScenes;
