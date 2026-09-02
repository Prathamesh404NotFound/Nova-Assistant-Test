/**
 * Nova AI OS — Plugins Page
 * Manage installed plugins and their settings.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { pluginRegistry, type NovaPlugin } from "@/lib/plugins";
import { Puzzle, Trash2, Plus } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

export default function Plugins() {
  const [plugins, setPlugins] = useState<NovaPlugin[]>([]);

  useEffect(() => {
    setPlugins(pluginRegistry.getAll());
  }, []);

  const handleToggle = (id: string) => {
    pluginRegistry.toggle(id);
    setPlugins(pluginRegistry.getAll());
  };

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6]/20 to-[#00d4ff]/20 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-[#8b5cf6]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Plugins</h1>
              <p className="text-sm text-[#6e6e8a]">Extend Nova's capabilities</p>
            </div>
          </div>
        </motion.div>

        {/* Plugin List */}
        <div className="space-y-3">
          {plugins.map((plugin, i) => (
            <motion.div
              key={plugin.id}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={i + 1}
            >
              <Card className="nova-glass p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{plugin.icon || "🔌"}</span>
                    <div>
                      <p className="text-sm font-medium text-[#e8e8f8]">{plugin.name}</p>
                      <p className="text-xs text-[#6e6e8a]">{plugin.description}</p>
                      <p className="text-[10px] text-[#6e6e8a] mt-1">
                        v{plugin.version} by {plugin.author}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={plugin.enabled}
                    onCheckedChange={() => handleToggle(plugin.id)}
                  />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Info */}
        <Card className="nova-glass p-4">
          <p className="text-xs text-[#6e6e8a]">
            Plugins extend Nova's functionality. Enable or disable plugins to customize your experience.
            More plugins coming soon!
          </p>
        </Card>
      </div>
    </main>
  );
}
