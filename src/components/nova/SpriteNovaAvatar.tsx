import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NOVA_SPRITES, type NovaSpriteState } from "@/config/novaSprites";
import {
  EMOTION_CUES,
  type NovaEmotion,
  circadianBaseline,
  circadianBlinkMs,
} from "@/services/nova/expression-engine";

interface SpriteNovaAvatarProps {
  /** Raw sprite state (used when `emotion` is not provided). */
  state?: NovaSpriteState;
  /** Performable emotion; when set it wins over `state`. */
  emotion?: NovaEmotion;
  /** Pixel size of the square sprite container. */
  size?: number;
  className?: string;
  /** Accessible label; defaults to `Nova {state}`. */
  label?: string;
  /** Show the Ambient Empathy Halo behind the sprite. */
  glow?: boolean;
  /** Show a one-shot cyan recalibration shimmer (§2 Conversational Blush). */
  shimmer?: boolean;
  /** Extra thought-particles regardless of emotion (§5). */
  particles?: boolean;
}

const SIZE_CLASS: Record<string, string> = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-20 h-20",
  xl: "w-32 h-32",
};

export function SpriteNovaAvatar({
  state = "idle",
  emotion,
  size,
  className,
  label,
  glow = true,
  shimmer = false,
  particles = false,
}: SpriteNovaAvatarProps) {
  const cue = emotion ? EMOTION_CUES[emotion] : null;
  const sprite: NovaSpriteState = cue ? cue.sprite : state;
  const src = NOVA_SPRITES[sprite] ?? NOVA_SPRITES.idle;
  const px = size ?? 48;
  const alt = label ?? `Nova ${emotion ?? sprite}`;

  // Circadian blink cycle (§6): slow at night, normal otherwise.
  const [blinkMs, setBlinkMs] = useState(() => circadianBlinkMs());
  useEffect(() => {
    const id = setInterval(() => setBlinkMs(circadianBlinkMs()), 60_000);
    return () => clearInterval(id);
  }, []);

  const haloColor = cue?.haloColor ?? "rgba(0,212,255,1)";
  const tilt = cue?.headTilt ?? 0;

  // Emotion blending (§9): cross-fade duration comes from the current cue.
  const transitionMs = cue?.transitionMs ?? 300;
  const showParticles = particles || cue?.particles === true;

  const haloStyle = useMemo(
    () => ({
      background: `radial-gradient(circle, ${haloColor}38 0%, transparent 70%)`,
      transition: `background ${Math.max(transitionMs, 400)}ms ease`,
    }),
    [haloColor, transitionMs]
  );

  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={size ? { width: px, height: px } : undefined}
      role="img"
      aria-label={alt}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none nova-halo-breathe"
          style={haloStyle}
        />
      )}

      <div
        className="relative z-10"
        style={{
          transform: `rotate(${tilt}deg)`,
          transition: `transform ${transitionMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        <img
          src={src}
          alt={alt}
          width={px}
          height={px}
          draggable={false}
          className={cn(
            "object-contain select-none nova-blink-cycle",
            !size && SIZE_CLASS.md
          )}
          style={{ ["--nova-blink-ms" as string]: `${blinkMs}ms` }}
        />
        {/* Recalibration shimmer (§2): cyan sweep, no embarrassment-red */}
        {shimmer && (
          <div
            className="absolute inset-0 pointer-events-none nova-recal-shimmer"
            style={{ borderRadius: "9999px" }}
          />
        )}
      </div>

      {showParticles && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                width: 4,
                height: 4,
                left: "50%",
                top: "50%",
                backgroundColor: haloColor,
                opacity: 0.7,
                animation: `nova-orbit 2.4s linear infinite`,
                animationDelay: `${i * 0.4}s`,
                transformOrigin: `0 0`,
                ["--nova-orbit-r" as string]: `${px * 0.62}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
