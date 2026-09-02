import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Secondary action like "Learn more" or "Configure" */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Show a subtle hint about what's missing */
  hint?: string;
}

/**
 * Consistent empty state for all pages.
 * Shows when a page has no data, an integration is disconnected,
 * or data failed to load. Always provides a clear recovery action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  hint,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 px-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-[#0f2035] border border-[#1a2f4a] flex items-center justify-center mx-auto mb-5">
        <Icon className="h-7 w-7 text-[#5a7a9a]" />
      </div>
      <h3 className="text-sm font-semibold text-[#e0ecf5] mb-2">{title}</h3>
      <p className="text-xs text-[#5a7a9a] max-w-sm mx-auto leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex items-center justify-center gap-3">
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            className="bg-[#00d4ff] text-[#060e1a] hover:bg-[#00d4ff]/80 font-semibold text-xs"
          >
            {actionLabel}
          </Button>
        )}
        {secondaryLabel && onSecondary && (
          <Button
            onClick={onSecondary}
            variant="outline"
            className="border-[#1a2f4a] text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035] text-xs"
          >
            {secondaryLabel}
          </Button>
        )}
      </div>
      {hint && (
        <p className="text-[10px] text-[#5a7a9a]/60 mt-4">{hint}</p>
      )}
    </motion.div>
  );
}
