import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { permissionsService } from "@/services/permissions";
import {
  startVisionLoop,
  enrollFace,
  forgetPerson,
  listKnownPeople,
  type Detection,
  type FaceMatch,
  type VisionLoopHandle,
} from "@/services/vision/vision-service";
import { logActivity } from "@/lib/local-store";
import {
  Camera,
  CameraOff,
  ScanFace,
  UserPlus,
  Trash2,
  Box,
  Eye,
  EyeOff,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

export default function VisionPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<VisionLoopHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const latestRef = useRef<{ detections: Detection[]; matches: FaceMatch[] }>({
    detections: [],
    matches: [],
  });

  const [cameraOn, setCameraOn] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [matches, setMatches] = useState<FaceMatch[]>([]);
  const [enrollName, setEnrollName] = useState("");
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);
  const [people, setPeople] = useState(() => listKnownPeople());
  const [privacyOn, setPrivacyOn] = useState(true);

  const refreshPeople = useCallback(() => setPeople(listKnownPeople()), []);

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (privacyOn) {
      // Face boxes only when privacy mode is on (objects hidden from view).
      for (const m of latestRef.current.matches) {
        const { xmin, ymin, xmax, ymax } = m.box;
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 3;
        ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
        ctx.fillStyle = "#10b981";
        ctx.font = "16px sans-serif";
        ctx.fillText(`${m.name} (${Math.round(m.similarity * 100)}%)`, xmin, Math.max(14, ymin - 6));
      }
    } else {
      for (const d of latestRef.current.detections) {
        const { xmin, ymin, xmax, ymax } = d.box;
        ctx.strokeStyle = "#00d4ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
        ctx.fillStyle = "#00d4ff";
        ctx.font = "13px sans-serif";
        ctx.fillText(`${d.label} ${Math.round(d.score * 100)}%`, xmin, Math.max(12, ymin - 4));
      }
      for (const m of latestRef.current.matches) {
        const { xmin, ymin, xmax, ymax } = m.box;
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 3;
        ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
        ctx.fillStyle = "#10b981";
        ctx.font = "16px sans-serif";
        ctx.fillText(`${m.name} (${Math.round(m.similarity * 100)}%)`, xmin, Math.max(14, ymin - 6));
      }
    }
  }, [privacyOn]);

  // Redraw overlay whenever privacy toggles.
  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  const stopCamera = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setDetections([]);
    setMatches([]);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    if (!permissionsService.isGranted("microphone") === false) {
      // camera permission is requested directly via getUserMedia below
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
      logActivity("labs", "Vision: camera feed started (on-device detection)", "camera");

      loopRef.current?.stop();
      loopRef.current = startVisionLoop(
        video,
        (dets, ms) => {
          latestRef.current = { detections: dets, matches: ms };
          setDetections(dets);
          setMatches(ms);
          drawOverlay();
        },
        (err) => console.warn("[VISION] loop error:", err)
      );
    } catch (err) {
      console.warn("[VISION] camera failed:", err);
      setEnrollMsg("Camera access denied — allow camera in your browser settings.");
    }
  }, [drawOverlay]);

  const handleEnroll = useCallback(async () => {
    const video = videoRef.current;
    const name = enrollName.trim();
    if (!video || !cameraOn || !name) return;
    const personBox = latestRef.current.detections.find((d) => d.label === "person");
    if (!personBox) {
      setEnrollMsg("No person detected in frame — make sure you're visible and try again.");
      return;
    }
    setEnrollMsg("Learning your face…");
    try {
      await enrollFace(video, name, personBox.box);
      refreshPeople();
      setEnrollName("");
      setEnrollMsg(`✅ "${name}" enrolled. Nova will recognize you from now on.`);
      logActivity("labs", `Vision: enrolled face "${name}" (descriptor only, on-device)`, "scan-face");
    } catch (err) {
      console.warn("[VISION] enroll failed:", err);
      setEnrollMsg("Enrollment failed — try again in better lighting.");
    }
  }, [enrollName, cameraOn, refreshPeople]);

  const handleForget = useCallback(
    (name: string) => {
      forgetPerson(name);
      refreshPeople();
      logActivity("labs", `Vision: forgot face "${name}"`, "trash");
    },
    [refreshPeople]
  );

  const knownNames = new Set(people.map((p) => p.name));
  const recognized = matches.filter((m) => knownNames.has(m.name));

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vision</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">
                Face recognition & object detection — 100% on-device
              </p>
            </div>
            <Button
              onClick={cameraOn ? stopCamera : startCamera}
              className={cameraOn ? "bg-[#f43f5e] text-white" : "bg-[#00d4ff] text-[#06060c]"}
            >
              {cameraOn ? <><CameraOff className="h-4 w-4 mr-1" />Stop</> : <><Camera className="h-4 w-4 mr-1" />Start Camera</>}
            </Button>
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-4 space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas
                ref={overlayRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#6e6e8a]">
                  <Camera className="h-8 w-8" />
                  <p className="text-sm">Camera off — start the feed to begin detection</p>
                </div>
              )}
              {cameraOn && !modelReady && detections.length === 0 && (
                <Badge className="absolute top-3 left-3 bg-[#8b5cf6]/80 text-white border-0">
                  Loading models…
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#6e6e8a]">
              <span className="flex items-center gap-1.5">
                <Box className="h-3.5 w-3.5 text-[#00d4ff]" />
                {detections.length} object{detections.length === 1 ? "" : "s"} detected
              </span>
              <span className="flex items-center gap-1.5">
                <ScanFace className="h-3.5 w-3.5 text-[#10b981]" />
                {recognized.length > 0
                  ? `Recognized: ${recognized.map((m) => m.name).join(", ")}`
                  : "No known faces in view"}
              </span>
              <button
                onClick={() => setPrivacyOn((v) => !v)}
                className="ml-auto flex items-center gap-1.5 hover:text-[#e8e8f8] transition-colors"
                title="Privacy mode hides object boxes from the overlay"
              >
                {privacyOn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Privacy mode {privacyOn ? "on" : "off"}
              </button>
            </div>
          </Card>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <Card className="nova-glass p-4 space-y-3">
            <h3 className="text-sm font-medium text-[#e8e8f8] flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#00d4ff]" /> Teach Nova a face
            </h3>
            <p className="text-xs text-[#6e6e8a]">
              With the camera running and you visible in frame, type a name and enroll.
              Only a numeric descriptor is stored — never an image — and it stays on this device.
            </p>
            <div className="flex gap-2">
              <Input
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
                placeholder="Name (e.g. you, or a friend)"
                className="flex-1 bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
              />
              <Button onClick={handleEnroll} disabled={!cameraOn || !enrollName.trim()} className="bg-[#00d4ff] text-[#06060c]">
                Enroll
              </Button>
            </div>
            {enrollMsg && <p className="text-xs text-[#c8d6e5]">{enrollMsg}</p>}

            {people.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {people.map((p) => (
                  <span key={p.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#16162a] text-xs text-[#c8d6e5]">
                    <ScanFace className="h-3 w-3 text-[#10b981]" />
                    {p.name}
                    <button
                      onClick={() => handleForget(p.name)}
                      className="text-[#6e6e8a] hover:text-[#f43f5e]"
                      title={`Forget ${p.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
          <Card className="nova-glass p-4">
            <h3 className="text-xs text-[#6e6e8a] uppercase tracking-wider mb-2">Privacy</h3>
            <p className="text-xs text-[#6e6e8a] leading-relaxed">
              All processing happens in your browser via WebGPU/WASM. Frames are never uploaded,
              recorded, or persisted. Enrollment stores only an averaged numeric embedding
              (512 floats) — removing a person deletes the descriptor permanently.
            </p>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
