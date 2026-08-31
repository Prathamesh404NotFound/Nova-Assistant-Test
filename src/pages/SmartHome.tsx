import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import {
  getSmartDevices,
  updateSmartDevice,
  type SmartDevice,
} from "@/lib/local-store";
import { logActivity } from "@/lib/local-store";
import {
  Home,
  Lightbulb,
  Thermometer,
  Lock,
  Camera,
  Volume2,
  Wifi,
  WifiOff,
  Plus,
  Power,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

const deviceIcons: Record<string, React.ComponentType<any>> = {
  light: Lightbulb,
  thermostat: Thermometer,
  lock: Lock,
  camera: Camera,
  speaker: Volume2,
  sensor: Wifi,
};

const deviceColors: Record<string, string> = {
  light: "#f59e0b",
  thermostat: "#f43f5e",
  lock: "#10b981",
  camera: "#00d4ff",
  speaker: "#8b5cf6",
  sensor: "#6e6e8a",
};

export default function SmartHomePage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<SmartDevice[]>([]);

  useEffect(() => {
    setDevices(getSmartDevices());
  }, []);

  const refresh = useCallback(() => {
    setDevices(getSmartDevices());
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      const device = devices.find((d) => d.id === id);
      if (!device) return;
      const newIsOn = !device.isOn;
      updateSmartDevice(id, { isOn: newIsOn });
      logActivity(
        "device",
        `${newIsOn ? "Turned on" : "Turned off"} ${device.name}`,
        newIsOn ? "power" : "power"
      );
      refresh();
    },
    [devices, refresh]
  );

  const handleValueChange = useCallback(
    (id: string, value: number) => {
      updateSmartDevice(id, { value });
      refresh();
    },
    [refresh]
  );

  const activeCount = devices.filter((d) => d.isOn).length;
  const rooms = [...new Set(devices.map((d) => d.room))];

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Smart Home</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">
                {activeCount} of {devices.length} devices active
              </p>
            </div>
          </div>
        </motion.div>

        {/* Overview Cards */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {rooms.map((room) => {
              const roomDevices = devices.filter((d) => d.room === room);
              const activeInRoom = roomDevices.filter((d) => d.isOn).length;
              return (
                <Card key={room} className="nova-glass p-3">
                  <p className="text-xs text-[#6e6e8a] uppercase tracking-wider">{room}</p>
                  <p className="text-lg font-bold text-[#e8e8f8] mt-1">
                    {activeInRoom}/{roomDevices.length}
                  </p>
                  <p className="text-[10px] text-[#6e6e8a]">devices on</p>
                </Card>
              );
            })}
          </div>
        </motion.div>

        {/* All Devices */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <h2 className="text-xs text-[#6e6e8a] uppercase tracking-wider mb-3">All Devices</h2>
          <div className="space-y-3">
            {devices.map((device, i) => {
              const Icon = deviceIcons[device.type] || Wifi;
              const color = deviceColors[device.type] || "#6e6e8a";
              return (
                <motion.div
                  key={device.id}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  custom={i + 3}
                >
                  <Card className="nova-glass nova-glass-hover p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                          device.isOn ? "shadow-lg" : ""
                        }`}
                        style={{
                          backgroundColor: device.isOn ? `${color}20` : "#16162a",
                          boxShadow: device.isOn ? `0 0 20px ${color}15` : "none",
                        }}
                      >
                        <Icon
                          className="w-6 h-6 transition-colors duration-300"
                          style={{ color: device.isOn ? color : "#6e6e8a" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#e8e8f8]">{device.name}</p>
                          <Badge className={`text-[10px] border-0 ${
                            device.isOn
                              ? "bg-[#10b981]/15 text-[#10b981]"
                              : "bg-[#6e6e8a]/15 text-[#6e6e8a]"
                          }`}>
                            {device.isOn ? "On" : "Off"}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#6e6e8a]">{device.room} · {device.type}</p>
                        {/* Brightness / Temperature Slider */}
                        {(device.type === "light" || device.type === "thermostat") && device.isOn && (
                          <div className="mt-2 flex items-center gap-3">
                            <input
                              type="range"
                              min={device.type === "thermostat" ? 50 : 0}
                              max={device.type === "thermostat" ? 90 : 100}
                              value={device.value ?? 50}
                              onChange={(e) => handleValueChange(device.id, Number(e.target.value))}
                              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                              style={{
                                background: `linear-gradient(to right, ${color} 0%, ${color} ${device.value ?? 50}%, #252540 ${device.value ?? 50}%, #252540 100%)`,
                              }}
                            />
                            <span className="text-xs text-[#6e6e8a] font-mono w-8 text-right">
                              {device.value ?? 50}
                              {device.type === "thermostat" ? "°F" : "%"}
                            </span>
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={device.isOn}
                        onCheckedChange={() => handleToggle(device.id)}
                      />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
