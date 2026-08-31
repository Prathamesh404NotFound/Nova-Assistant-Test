import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Smartphone, Wifi, WifiOff } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

export default function DevicesPage() {
  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Connected devices and sync status</p>
        </motion.div>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-[#10b981]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#e8e8f8]">This Device</p>
              <p className="text-xs text-[#6e6e8a]">Current browser session</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#10b981]">
              <Wifi className="h-3.5 w-3.5" />
              Online
            </div>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
