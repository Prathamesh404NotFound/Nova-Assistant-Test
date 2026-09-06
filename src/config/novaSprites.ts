/**
 * Nova Sprite Registry
 * The active raster set is derived from the user-provided reference image
 * (see SPRITES_LICENSE.md); the original SVG set remains available as fallback assets.
 * Centralized so components never hard-code image paths.
 */
import idle from "@/assets/nova/nova-idle.png";
import listening from "@/assets/nova/nova-listening.png";
import thinking from "@/assets/nova/nova-thinking.png";
import speaking from "@/assets/nova/nova-speaking.png";
import happy from "@/assets/nova/nova-happy.png";
import excited from "@/assets/nova/nova-excited.png";
import curious from "@/assets/nova/nova-curious.png";
import focused from "@/assets/nova/nova-focused.png";
import confident from "@/assets/nova/nova-confident.png";
import gentle from "@/assets/nova/nova-gentle.png";
import alert from "@/assets/nova/nova-alert.png";
import sleepy from "@/assets/nova/nova-sleepy.png";
import processing from "@/assets/nova/nova-processing.png";
import error from "@/assets/nova/nova-error.png";

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
