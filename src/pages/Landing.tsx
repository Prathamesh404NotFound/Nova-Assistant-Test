import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Mic,
  Brain,
  CheckSquare,
  Shield,
  Zap,
  MessageSquare,
  ArrowRight,
  Globe,
  Home,
  Code,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const features = [
  {
    icon: Mic,
    title: "Voice-First",
    desc: 'Say "Hey Nova" and Nova listens, understands, and acts.',
    color: "#00d4ff",
  },
  {
    icon: Brain,
    title: "AI Memory",
    desc: "Remembers your preferences, people, and projects across sessions.",
    color: "#8b5cf6",
  },
  {
    icon: CheckSquare,
    title: "Task Engine",
    desc: "Manages tasks with priority, deadlines, and smart execution.",
    color: "#10b981",
  },
  {
    icon: Globe,
    title: "Browser Agent",
    desc: "Browse the web, extract info, and automate tasks for you.",
    color: "#00d4ff",
  },
  {
    icon: Code,
    title: "Coding Agent",
    desc: "Writes, reviews, and ships code through GitHub integration.",
    color: "#8b5cf6",
  },
  {
    icon: Home,
    title: "Smart Home",
    desc: "Controls lights, thermostats, and devices with voice commands.",
    color: "#f59e0b",
  },
  {
    icon: Shield,
    title: "Secure by Design",
    desc: "AES-256-GCM encrypted keys. Zero-trust architecture.",
    color: "#f43f5e",
  },
  {
    icon: Zap,
    title: "Offline-First",
    desc: "Works without internet. Voice, memory, tasks — all local.",
    color: "#10b981",
  },
];

const integrations = [
  "GitHub",
  "Gmail",
  "Calendar",
  "WhatsApp",
  "Smart Home",
  "Discord",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#06060c] text-[#e8e8f8] overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#06060c]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-white font-bold text-xs">N</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Nova</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-[#6e6e8a] hover:text-[#e8e8f8]"
              onClick={() => navigate("/auth")}
            >
              Sign in
            </Button>
            <Button
              className="bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold hover:shadow-lg hover:shadow-[#00d4ff]/20"
              onClick={() => navigate("/auth")}
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#00d4ff]/5 blur-[120px]" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#8b5cf6]/5 blur-[100px]" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Avatar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-10 flex justify-center"
          >
            <div className="relative">
              <svg viewBox="0 0 200 200" width="140" height="140" className="nova-avatar-breathe">
                <defs>
                  <radialGradient id="heroFaceGrad" cx="50%" cy="40%" r="50%">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.02" />
                  </radialGradient>
                  <filter id="heroGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <circle cx="100" cy="100" r="80" fill="url(#heroFaceGrad)" stroke="#00d4ff" strokeWidth="2" strokeOpacity="0.4" filter="url(#heroGlow)" />
                <circle cx="100" cy="100" r="65" fill="none" stroke="#00d4ff" strokeWidth="1" strokeOpacity="0.15" />
                <g style={{ animation: "nova-blink 4s ease-in-out infinite" }}>
                  <ellipse cx="75" cy="85" rx="6" ry="7" fill="#00d4ff" opacity="0.9" />
                  <circle cx="77" cy="82" r="2" fill="white" opacity="0.6" />
                </g>
                <g style={{ animation: "nova-blink 4s ease-in-out infinite", animationDelay: "0.1s" }}>
                  <ellipse cx="125" cy="85" rx="6" ry="7" fill="#00d4ff" opacity="0.9" />
                  <circle cx="127" cy="82" r="2" fill="white" opacity="0.6" />
                </g>
                <path d="M 90 118 Q 100 126 110 118" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
              </svg>
              <div className="absolute inset-0 rounded-full nova-avatar-pulse" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <p className="text-sm font-medium text-[#00d4ff] uppercase tracking-[0.2em] mb-4">
              Personal AI Operating System
            </p>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Your AI that{" "}
              <span className="nova-gradient-text">sees, hears,</span>
              <br />
              and{" "}
              <span className="nova-gradient-text">acts.</span>
            </h1>
            <p className="text-lg text-[#6e6e8a] max-w-2xl mx-auto leading-relaxed">
              Nova is a voice-first personal AI that manages your tasks, answers questions,
              controls your devices, and integrates with the tools you already use. Say
              "Hey Nova" and watch it work.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-4 mt-10"
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold text-base px-8 h-12 hover:shadow-xl hover:shadow-[#00d4ff]/25"
              onClick={() => navigate("/auth")}
            >
              Start Using Nova
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-[#252540] text-[#e8e8f8] h-12 px-8 hover:bg-[#16162a]"
              onClick={() => navigate("/auth")}
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              Try Voice Chat
            </Button>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-[#6e6e8a]"
          >
            <span className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-[#10b981]" />
              End-to-end encrypted
            </span>
            <span className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[#f59e0b]" />
              Works offline
            </span>
            <span className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-[#00d4ff]" />
              Open architecture
            </span>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-[#00d4ff] uppercase tracking-[0.2em] mb-4"
            >
              Capabilities
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl font-bold tracking-tight"
            >
              Everything an AI OS should be
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="nova-glass nova-glass-hover p-6 h-full group cursor-default">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${f.color}15` }}
                  >
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="font-semibold text-[#e8e8f8] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#6e6e8a] leading-relaxed">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-[#8b5cf6] uppercase tracking-[0.2em] mb-4"
          >
            Integrations
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl font-bold tracking-tight mb-8"
          >
            Connects to the tools you already use
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-3"
          >
            {integrations.map((name, i) => (
              <motion.div
                key={name}
                variants={fadeUp}
                custom={i}
                className="nova-glass px-5 py-2.5 rounded-full text-sm font-medium text-[#6e6e8a] hover:text-[#e8e8f8] transition-colors"
              >
                {name}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
          >
            Ready to meet Nova?
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="text-lg text-[#6e6e8a] mb-10"
          >
            Set up in seconds. Works offline. No credit card required.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold text-base px-10 h-13 hover:shadow-xl hover:shadow-[#00d4ff]/25"
              onClick={() => navigate("/auth")}
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">N</span>
            </div>
            <span className="text-sm font-semibold">Nova AI OS</span>
          </div>
          <p className="text-xs text-[#6e6e8a]">
            Personal AI Operating System — Voice-first, privacy-focused, offline-capable.
          </p>
        </div>
      </footer>
    </div>
  );
}
