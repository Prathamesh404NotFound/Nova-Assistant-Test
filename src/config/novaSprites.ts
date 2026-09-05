/**
 * Nova Sprite Registry
 * All artwork is original project artwork (see SPRITES_LICENSE.md).
 * Centralized so components never hard-code image paths.
 */
import idle from "@/assets/nova/nova-idle.svg";
import listening from "@/assets/nova/nova-listening.svg";
import thinking from "@/assets/nova/nova-thinking.svg";
import speaking from "@/assets/nova/nova-speaking.svg";
import happy from "@/assets/nova/nova-happy.svg";
import excited from "@/assets/nova/nova-excited.svg";
import curious from "@/assets/nova/nova-curious.svg";
import focused from "@/assets/nova/nova-focused.svg";
import confident from "@/assets/nova/nova-confident.svg";
import gentle from "@/assets/nova/nova-gentle.svg";
import alert from "@/assets/nova/nova-alert.svg";
import sleepy from "@/assets/nova/nova-sleepy.svg";
import processing from "@/assets/nova/nova-processing.svg";
import error from "@/assets/nova/nova-error.svg";

export const NOVA_SPRITE_STATES = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "excited",
  "curious",
  "focused",
  "confident",
  "gentle",
  "alert",
  "sleepy",
  "processing",
  "error",
] as const;

export type NovaSpriteState = (typeof NOVA_SPRITE_STATES)[number];

export const NOVA_SPRITES: Record<NovaSpriteState, string> = {
  idle,
  listening,
  thinking,
  speaking,
  happy,
  excited,
  curious,
  focused,
  confident,
  gentle,
  alert,
  sleepy,
  processing,
  error,
};

/** Maps the app's runtime avatar state (existing AvatarState union) to a sprite. */
export const AVATAR_STATE_TO_SPRITE: Record<string, NovaSpriteState> = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
  error: "error",
};

/** Rich state → sprite mapping (voice state machine + emotional overlays). */
export const VOICE_STATE_TO_SPRITE: Record<string, NovaSpriteState> = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  processing: "processing",
  speaking: "speaking",
  happy: "happy",
  excited: "excited",
  curious: "curious",
  focused: "focused",
  confident: "confident",
  gentle: "gentle",
  alert: "alert",
  sleepy: "sleepy",
  error: "error",
};
