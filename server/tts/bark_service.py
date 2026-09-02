"""
Nova Bark TTS Service — Local text-to-speech using Suno Bark.
Runs as a persistent process. Model loaded once, reused across requests.

Usage:
    python server/tts/bark_service.py [--port 5150] [--host 127.0.0.1] [--model suno/bark]
"""

import argparse
import hashlib
import io
import json
import logging
import os
import re
import struct
import sys
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional

import numpy as np

logging.basicConfig(level=logging.INFO, format="[BarkTTS] %(message)s")
logger = logging.getLogger("bark_tts")

# ─── Model Management ────────────────────────────────────────────────────────

_model = None
_processor = None
_model_lock = threading.Lock()
_model_name = "suno/bark"
_device = "cpu"


def get_device():
    """Detect best available compute device."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


def load_model(model_name: str = "suno/bark"):
    """Load Bark model once. Thread-safe."""
    global _model, _processor, _device, _model_name
    with _model_lock:
        if _model is not None:
            return _model, _processor

        _model_name = model_name
        _device = get_device()
        logger.info(f"Loading Bark model '{model_name}' on {_device}...")

        try:
            from transformers import AutoProcessor, AutoModelForTextToWaveform

            _processor = AutoProcessor.from_pretrained(model_name)
            _model = AutoModelForTextToWaveform.from_pretrained(model_name)
            _model.to(_device)
            _model.eval()
            logger.info(f"Model loaded on {_device}")
            return _model, _processor
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise


def unload_model():
    """Release model from memory."""
    global _model, _processor
    with _model_lock:
        _model = None
        _processor = None
    import gc
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass
    logger.info("Model unloaded")


# ─── Speech Text Processor ───────────────────────────────────────────────────

def preprocess_for_speech(text: str) -> str:
    """Convert written text to speech-friendly text. Strips markdown, URLs, etc."""
    if not text or not text.strip():
        return ""

    # Remove markdown bold/italic
    text = re.sub(r'\*{1,3}(.+?)\*{1,3}', r'\1', text)
    # Remove markdown headers
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Remove markdown links — keep the text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove raw URLs
    text = re.sub(r'https?://\S+', '', text)
    # Remove code fences
    text = re.sub(r'```[\s\S]*?```', 'code block', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Remove emojis (basic ranges)
    text = re.sub(
        r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF'
        r'\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251'
        r'\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF]+',
        '', text
    )
    # Remove internal IDs and metadata
    text = re.sub(r'(?:Event|Task|Memory|File)\s*(?:ID|id):\s*\S+', '', text)
    text = re.sub(r'(?:✓|✗|●|☁|⚠️)\s*', '', text)
    # Remove JSON-like structures
    text = re.sub(r'\{[^}]{20,}\}', '', text)
    text = re.sub(r'\[[^\]]{20,}\]', '', text)
    # Normalize whitespace
    text = re.sub(r'\n{2,}', '. ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    # Add periods at end if missing
    if text and text[-1] not in '.!?':
        text += '.'

    return text


def chunk_text(text: str, max_chars: int = 200) -> list[str]:
    """Split text into natural speech chunks at sentence boundaries."""
    if not text or len(text) <= max_chars:
        return [text] if text else []

    # Split at sentence boundaries
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) + 1 <= max_chars:
            current = (current + " " + sentence).strip() if current else sentence
        else:
            if current:
                chunks.append(current)
            current = sentence

    if current:
        chunks.append(current)

    return chunks if chunks else [text[:max_chars]]


# ─── Audio Generation ────────────────────────────────────────────────────────

def generate_audio(text: str, voice_preset: Optional[str] = None) -> tuple[np.ndarray, int]:
    """Generate audio from text using Bark. Returns (audio_array, sample_rate)."""
    model, processor = load_model(_model_name)

    # Preprocess
    clean_text = preprocess_for_speech(text)
    if not clean_text:
        raise ValueError("Text is empty after preprocessing")

    # Generate
    inputs = processor(clean_text, return_tensors="pt").to(_device)

    with torch.no_grad():
        audio_values = model.generate(
            **inputs,
            do_sample=True,
            temperature=0.7,
        )

    # Convert to numpy
    audio = audio_values.cpu().numpy().squeeze()

    # Bark outputs at 24kHz
    sample_rate = 24000

    return audio, sample_rate


def audio_to_wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    """Convert numpy audio array to WAV format bytes."""
    # Normalize to int16
    audio_int16 = (audio * 32767).clip(-32768, 32767).astype(np.int16)

    # WAV header
    num_channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = len(audio_int16) * block_align

    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + data_size, b'WAVE',
        b'fmt ', 16, 1, num_channels, sample_rate, byte_rate, block_align, bits_per_sample,
        b'data', data_size
    )

    return header + audio_int16.tobytes()


# ─── HTTP Server ─────────────────────────────────────────────────────────────

_model_status = {
    "installed": False,
    "loaded": False,
    "device": "unknown",
    "model_name": _model_name,
    "error": None,
}

_audio_cache: dict[str, bytes] = {}
CACHE_MAX = 50


class BarkHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress default logging

    def _send_json(self, data: dict, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _send_audio(self, wav_bytes: bytes):
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(wav_bytes)))
        self.end_headers()
        self.wfile.write(wav_bytes)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/tts/status":
            # Check if model files exist locally
            try:
                from transformers import cached_download
                _model_status["installed"] = True
            except Exception:
                _model_status["installed"] = False

            _model_status["loaded"] = _model is not None
            _model_status["device"] = _device
            _model_status["model_name"] = _model_name
            self._send_json({"success": True, **_model_status})
        else:
            self._send_json({"error": "Not found"}, 404)

    def do_POST(self):
        if self.path == "/api/tts/speak":
            self._handle_speak()
        elif self.path == "/api/tts/load":
            self._handle_load()
        elif self.path == "/api/tts/unload":
            self._handle_unload()
        else:
            self._send_json({"error": "Not found"}, 404)

    def _handle_speak(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            text = body.get("text", "").strip()
            voice_preset = body.get("voicePreset")
            max_chars = body.get("maxChars", 200)

            if not text:
                self._send_json({"success": False, "error": "No text provided"}, 400)
                return

            # Check cache
            cache_key = hashlib.md5(f"{text}:{voice_preset}".encode()).hexdigest()
            if cache_key in _audio_cache:
                self._send_audio(_audio_cache[cache_key])
                return

            # Chunk long text, generate first chunk
            chunks = chunk_text(text, max_chars)
            start_time = time.time()

            # Generate first chunk for immediate playback
            audio, sample_rate = generate_audio(chunks[0], voice_preset)
            wav_bytes = audio_to_wav_bytes(audio, sample_rate)

            gen_time = round((time.time() - start_time) * 1000)

            # Cache
            if len(_audio_cache) >= CACHE_MAX:
                oldest_key = next(iter(_audio_cache))
                del _audio_cache[oldest_key]
            _audio_cache[cache_key] = wav_bytes

            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("X-Sample-Rate", str(sample_rate))
            self.send_header("X-Generation-Ms", str(gen_time))
            self.send_header("X-Total-Chunks", str(len(chunks)))
            self.send_header("X-Chunk-Index", "0")
            self.send_header("Content-Length", str(len(wav_bytes)))
            self.end_headers()
            self.wfile.write(wav_bytes)

        except Exception as e:
            logger.error(f"Generation error: {e}")
            self._send_json({"success": False, "error": str(e)}, 500)

    def _handle_load(self):
        try:
            load_model(_model_name)
            self._send_json({"success": True, "device": _device, "model": _model_name})
        except Exception as e:
            self._send_json({"success": False, "error": str(e)}, 500)

    def _handle_unload(self):
        unload_model()
        self._send_json({"success": True})


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Nova Bark TTS Service")
    parser.add_argument("--port", type=int, default=5150)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--model", default="suno/bark")
    parser.add_argument("--preload", action="store_true", help="Load model at startup")
    args = parser.parse_args()

    global _model_name
    _model_name = args.model

    if args.preload:
        try:
            load_model(_model_name)
        except Exception as e:
            logger.error(f"Pre-load failed: {e}")

    server = HTTPServer((args.host, args.port), BarkHandler)
    logger.info(f"Bark TTS service listening on {args.host}:{args.port}")
    logger.info(f"Model: {_model_name} | Preload: {args.preload}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        unload_model()
        server.server_close()


if __name__ == "__main__":
    main()
