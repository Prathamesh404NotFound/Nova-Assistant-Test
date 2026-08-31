import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Calendar, Plus } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

export default function CalendarPage() {
  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Your schedule at a glance</p>
        </motion.div>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-8 text-center">
            <Calendar className="h-12 w-12 text-[#252540] mx-auto mb-4" />
            <p className="text-[#6e6e8a] text-sm mb-4">Calendar integration coming soon.</p>
            <p className="text-xs text-[#6e6e8a]">Connect Google Calendar in Settings to see your events here.</p>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
