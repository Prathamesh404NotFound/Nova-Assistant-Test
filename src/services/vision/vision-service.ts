/**
 * Nova Vision Service
 *
 * Face recognition + continuous object detection, 100% on-device.
 *
 * Privacy:
 *  - Camera frames are processed in-memory only; NO image is ever stored
 *    or transmitted. Model weights are downloaded from HuggingFace and cached.
 *  - Face "descriptors" (numeric embedding vectors only — never images)
 *    are stored in localStorage under `nova_face_descriptors_v1`.
 *  - Deleting a person removes their descriptor permanently.
 */

import { pipeline, env, type ObjectDetectionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.cacheDir = "nova-vision-cache";

export interface Detection {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

export interface FaceMatch {
  name: string;
  similarity: number;
  box: Detection["box"];
}

interface FaceDescriptor {
  name: string;
  vector: number[];
  createdAt: number;
}

const DESCRIPTOR_KEY = "nova_face_descriptors_v1";
/** Cosine similarity above this is considered the same person. */
const MATCH_THRESHOLD = 0.72;

// ── Lazy singleton pipelines ─────────────────────────────────────

let objectDetector: ObjectDetectionPipeline | null = null;
let embedder: Awaited<ReturnType<typeof createEmbedder>> | null = null;
let detectorLoading: Promise<ObjectDetectionPipeline> | null = null;
let embedderLoading: Promise<Awaited<ReturnType<typeof createEmbedder>>> | null = null;

function createEmbedder() {
  return pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch32", {
    dtype: "q8",
  });
}

export async function getObjectDetector(): Promise<ObjectDetectionPipeline> {
  if (objectDetector) return objectDetector;
  if (!detectorLoading) {
    detectorLoading = pipeline("object-detection", "Xenova/detr-resnet-50", {
      dtype: "q8",
    }).then((p) => {
      objectDetector = p as ObjectDetectionPipeline;
      return objectDetector;
    });
  }
  return detectorLoading;
}

async function getEmbedder() {
  if (embedder) return embedder;
  if (!embedderLoading) {
    embedderLoading = createEmbedder().then((p) => {
      embedder = p;
      return p;
    });
  }
  return embedderLoading;
}

// ── Descriptor storage (vectors only — never images) ─────────────

function loadDescriptors(): FaceDescriptor[] {
  try {
    const raw = localStorage.getItem(DESCRIPTOR_KEY);
    return raw ? (JSON.parse(raw) as FaceDescriptor[]) : [];
  } catch {
    return [];
  }
}

function saveDescriptors(list: FaceDescriptor[]): void {
  try {
    localStorage.setItem(DESCRIPTOR_KEY, JSON.stringify(list));
  } catch { /* storage full — ignore */ }
}

export function listKnownPeople(): Array<{ name: string; enrolledAt: number }> {
  return loadDescriptors()
    .map((d) => ({ name: d.name, enrolledAt: d.createdAt }))
    .filter((p, i, arr) => arr.findIndex((q) => q.name === p.name) === i);
}

export function forgetPerson(name: string): void {
  saveDescriptors(loadDescriptors().filter((d) => d.name !== name));
}

// ── Math helpers ─────────────────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function average(vectors: number[][]): number[] {
  const len = vectors[0].length;
  const out = new Array<number>(len).fill(0);
  for (const v of vectors) for (let i = 0; i < len; i++) out[i] += v[i];
  return out.map((x) => x / vectors.length);
}

// ── Core operations ──────────────────────────────────────────────

/** Draw any media source into an offscreen canvas (transformers accepts canvases). */
function toCanvas(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  box?: Detection["box"]
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  if (box) {
    canvas.width = Math.max(8, Math.round(box.xmax - box.xmin));
    canvas.height = Math.max(8, Math.round(box.ymax - box.ymin));
    canvas
      .getContext("2d")!
      .drawImage(
        source as CanvasImageSource,
        box.xmin, box.ymin, canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height
      );
  } else {
    if (source instanceof HTMLVideoElement) {
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
    } else {
      canvas.width = (source as HTMLCanvasElement | HTMLImageElement).width;
      canvas.height = (source as HTMLCanvasElement | HTMLImageElement).height;
    }
    canvas.getContext("2d")!.drawImage(source as CanvasImageSource, 0, 0);
  }
  return canvas;
}

/** Compute a normalized embedding vector for a canvas/image crop. */
async function computeEmbedding(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  box?: Detection["box"]
): Promise<number[]> {
  const input = toCanvas(source, box);
  const emb = await getEmbedder();
  const output = await emb(input, { pool: true });
  // L2-normalize so cosine similarity is a plain dot product.
  const flat = Array.from(output.data as Float32Array);
  const dims = output.dims as number[];
  const vec = dims.length > 1 && dims[0] === 1 ? flat.slice(0, dims[1]) : flat;
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

/** Run one object-detection pass on a frame. */
export async function detectObjects(
  source: HTMLVideoElement | HTMLCanvasElement
): Promise<Detection[]> {
  const detector = await getObjectDetector();
  const raw = (await detector(toCanvas(source), { threshold: 0.5 })) as Array<{
    label: string;
    score: number;
    box: Detection["box"];
  }>;
  return raw.map((d) => ({ label: d.label, score: d.score, box: d.box }));
}

/**
 * Enroll a face: capture 3 embeddings from the current frame (slightly
 * jittered crops for robustness) and store the averaged vector.
 */
export async function enrollFace(
  video: HTMLVideoElement,
  name: string,
  faceBox: Detection["box"]
): Promise<void> {
  const jitter = (scale: number, dx: number, dy: number) => ({
    xmin: faceBox.xmin + dx - (faceBox.xmax - faceBox.xmin) * (scale - 1) / 2,
    ymin: faceBox.ymin + dy - (faceBox.ymax - faceBox.ymin) * (scale - 1) / 2,
    xmax: faceBox.xmax + dx + (faceBox.xmax - faceBox.xmin) * (scale - 1) / 2,
    ymax: faceBox.ymax + dy + (faceBox.ymax - faceBox.ymin) * (scale - 1) / 2,
  });
  const boxes = [jitter(1, 0, 0), jitter(1.1, 2, 0), jitter(1.1, -2, 1)];
  const vectors: number[][] = [];
  for (const b of boxes) {
    vectors.push(await computeEmbedding(video, b));
  }
  const list = loadDescriptors().filter((d) => d.name !== name);
  list.push({ name, vector: average(vectors), createdAt: Date.now() });
  saveDescriptors(list);
}

/**
 * Recognize faces in a frame: match each detected `person` crop against
 * stored descriptors. Returns matches above threshold.
 */
export async function recognizeFaces(
  video: HTMLVideoElement,
  detections: Detection[]
): Promise<FaceMatch[]> {
  const people = loadDescriptors();
  if (people.length === 0) return [];
  const personBoxes = detections.filter((d) => d.label === "person").map((d) => d.box);
  const matches: FaceMatch[] = [];
  for (const box of personBoxes.slice(0, 3)) {
    try {
      const vec = await computeEmbedding(video, box);
      let best: FaceMatch | null = null;
      for (const d of people) {
        const sim = cosine(vec, d.vector);
        if (sim >= MATCH_THRESHOLD && (!best || sim > best.similarity)) {
          best = { name: d.name, similarity: sim, box };
        }
      }
      if (best) matches.push(best);
    } catch { /* skip frame crop */ }
  }
  return matches;
}

// ── Detection loop (continuous scanning) ─────────────────────────

export interface VisionLoopHandle {
  stop: () => void;
}

/**
 * Run continuous detection on a video element, calling `onFrame` after each
 * pass. Automatically paced (one pass at a time, ~1s rest) to keep the UI
 * responsive.
 */
export function startVisionLoop(
  video: HTMLVideoElement,
  onFrame: (detections: Detection[], matches: FaceMatch[]) => void,
  onError?: (err: unknown) => void
): VisionLoopHandle {
  let running = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (!running) return;
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const detections = await detectObjects(video);
        const matches = await recognizeFaces(video, detections);
        if (running) onFrame(detections, matches);
      }
    } catch (err) {
      onError?.(err);
    }
    if (running) timer = setTimeout(tick, 1000);
  };

  tick();

  return {
    stop: () => {
      running = false;
      if (timer) clearTimeout(timer);
    },
  };
}
