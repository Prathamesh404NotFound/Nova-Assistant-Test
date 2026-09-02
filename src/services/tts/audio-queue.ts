/**
 * Nova TTS — Audio Queue
 * Manages sequential audio playback with FIFO ordering,
 * interruption, pause/resume, and cleanup.
 */

export interface AudioQueueItem {
  id: string;
  audioUrl: string;
  text: string;
  onPlay?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export type AudioQueueStatus = "idle" | "playing" | "paused" | "stopping";

export class AudioQueue {
  private queue: AudioQueueItem[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private currentItem: AudioQueueItem | null = null;
  private status: AudioQueueStatus = "idle";
  private volume = 1.0;

  /** Add an item to the queue. If idle, starts playing immediately. */
  enqueue(item: AudioQueueItem): void {
    this.queue.push(item);
    if (this.status === "idle") {
      this.playNext();
    }
  }

  /** Play the next item in the queue. */
  private playNext(): void {
    if (this.queue.length === 0) {
      this.status = "idle";
      this.currentItem = null;
      return;
    }

    const item = this.queue.shift()!;
    this.currentItem = item;
    this.status = "playing";

    const audio = new Audio(item.audioUrl);
    audio.volume = this.volume;
    this.currentAudio = audio;

    audio.onplay = () => {
      item.onPlay?.();
    };

    audio.onended = () => {
      this.currentAudio = null;
      this.currentItem = null;
      item.onEnd?.();
      // Play next
      this.playNext();
    };

    audio.onerror = (e) => {
      const error = new Error(`Audio playback error: ${e}`);
      this.currentAudio = null;
      this.currentItem = null;
      item.onError?.(error);
      this.playNext();
    };

    audio.play().catch((err) => {
      item.onError?.(new Error(`Failed to play: ${err}`));
      this.currentAudio = null;
      this.currentItem = null;
      this.playNext();
    });
  }

  /** Stop everything and clear the queue. */
  stop(): void {
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.currentItem = null;
    this.status = "idle";
  }

  /** Pause current playback. */
  pause(): void {
    if (this.currentAudio && this.status === "playing") {
      this.currentAudio.pause();
      this.status = "paused";
    }
  }

  /** Resume paused playback. */
  resume(): void {
    if (this.currentAudio && this.status === "paused") {
      this.currentAudio.play();
      this.status = "playing";
    }
  }

  /** Skip current item and play next. */
  skip(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.currentItem?.onEnd?.();
    this.currentItem = null;
    this.playNext();
  }

  /** Clear remaining queue without affecting current playback. */
  clearPending(): void {
    this.queue = [];
  }

  /** Set volume (0.0 to 1.0). */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  /** Get current status. */
  getStatus(): AudioQueueStatus {
    return this.status;
  }

  /** Get queue length (not including current). */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Get currently playing item. */
  get nowPlaying(): AudioQueueItem | null {
    return this.currentItem;
  }

  /** Check if anything is playing or queued. */
  get isActive(): boolean {
    return this.status !== "idle" || this.queue.length > 0;
  }
}
