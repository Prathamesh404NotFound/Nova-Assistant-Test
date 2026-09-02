import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, Shield } from "lucide-react";

interface ConfirmActionProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog for consequential actions.
 * Used for: email send, smart-home control, code execution,
 * file deletion, automation creation, external requests.
 */
export function ConfirmAction({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmActionProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#0b1929] border border-[#1a2f4a] rounded-xl max-w-md w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 p-5 pb-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                danger ? "bg-[#f43f5e]/15" : "bg-[#f59e0b]/15"
              }`}
            >
              {danger ? (
                <AlertTriangle className="w-5 h-5 text-[#f43f5e]" />
              ) : (
                <Shield className="w-5 h-5 text-[#f59e0b]" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#e0ecf5]">{title}</h3>
              <p className="text-xs text-[#5a7a9a] mt-1 leading-relaxed">{description}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-[#5a7a9a] hover:text-[#c8d6e5] transition-colors shrink-0"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-5 pt-4">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="flex-1 text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#162a42] border border-[#1a2f4a]"
            >
              {cancelLabel}
            </Button>
            <Button
              onClick={onConfirm}
              className={`flex-1 font-semibold ${
                danger
                  ? "bg-[#f43f5e] text-white hover:bg-[#f43f5e]/80"
                  : "bg-[#00d4ff] text-[#060e1a] hover:bg-[#00d4ff]/80"
              }`}
            >
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Hook for managing confirmation state for sensitive actions.
 * Usage: const { confirm, props } = useConfirm();
 * Then: <ConfirmAction {...props} />
 * And: await confirm({ title: "...", description: "..." });
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    danger?: boolean;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (opts: { title: string; description: string; confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => {
        setState({
          open: true,
          title: opts.title,
          description: opts.description,
          confirmLabel: opts.confirmLabel,
          danger: opts.danger,
          resolve,
        });
      }),
    []
  );

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  return {
    confirm,
    props: state
      ? {
          open: state.open,
          title: state.title,
          description: state.description,
          confirmLabel: state.confirmLabel,
          danger: state.danger,
          onConfirm: handleConfirm,
          onCancel: handleCancel,
        }
      : null,
  };
}
