import { SpriteNovaAvatar } from "./SpriteNovaAvatar";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface NovaAvatarProps {
  state?: AvatarState;
  size?: number;
  className?: string;
}

/** Backward-compatible avatar API backed by the shared reference-image sprites. */
export function NovaAvatar({ state = "idle", size = 200, className }: NovaAvatarProps) {
  return (
    <SpriteNovaAvatar
      state={state}
      size={size}
      className={className}
      label={`Nova ${state}`}
      particles={state === "thinking"}
    />
  );
}
