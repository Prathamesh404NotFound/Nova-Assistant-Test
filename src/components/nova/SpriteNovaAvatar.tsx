import { cn } from "@/lib/utils";
import { NOVA_SPRITES, type NovaSpriteState } from "@/config/novaSprites";

interface SpriteNovaAvatarProps {
  state?: NovaSpriteState;
  /** Pixel size of the square sprite container. */
  size?: number;
  className?: string;
  /** Accessible label; defaults to `Nova {state}`. */
  label?: string;
  /** Show the soft glow ring behind the sprite. */
  glow?: boolean;
}

const SIZE_CLASS: Record<string, string> = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-20 h-20",
  xl: "w-32 h-32",
};

export function SpriteNovaAvatar({
  state = "idle",
  size,
  className,
  label,
  glow = true,
}: SpriteNovaAvatarProps) {
  const src = NOVA_SPRITES[state] ?? NOVA_SPRITES.idle;
  const px = size ?? 48;
  const alt = label ?? `Nova ${state}`;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={size ? { width: px, height: px } : undefined}
      role="img"
      aria-label={alt}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(0,212,255,0.22) 0%, transparent 70%)",
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        width={px}
        height={px}
        draggable={false}
        className={cn(
          "relative z-10 object-contain select-none transition-transform duration-300",
          !size && SIZE_CLASS.md
        )}
      />
    </div>
  );
}
