/**
 * WakeWordActivator — Sits inside WakeWordProvider.
 * When the wake word is detected, navigates to the chat page.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useWakeWordContext } from "@/contexts/WakeWordProvider";

export function WakeWordActivator() {
  const { lastDetected } = useWakeWordContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (lastDetected) {
      navigate("/chat");
    }
  }, [lastDetected, navigate]);

  return null;
}
