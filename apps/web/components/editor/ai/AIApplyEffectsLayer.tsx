"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { AnimationProfile } from "./aiAnimationPolicy";
import type { AiApplyPhase } from "./aiApplyState";

interface AIApplyEffectsLayerProps {
  phase: AiApplyPhase;
  profile: AnimationProfile;
}

function getContainerStyle(phase: AiApplyPhase, profile: AnimationProfile): CSSProperties {
  if (phase !== "applying") return {};

  const base: CSSProperties = {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 9999,
    transition: "opacity 0.3s ease",
  };

  if (profile === "subtle") {
    return {
      ...base,
      boxShadow: "inset 0 0 12px rgba(249, 115, 22, 0.15)",
    };
  }

  if (profile === "medium") {
    return {
      ...base,
      boxShadow: "inset 0 0 24px rgba(249, 115, 22, 0.25)",
      background: "radial-gradient(ellipse at 50% 50%, rgba(249, 115, 22, 0.04) 0%, transparent 70%)",
    };
  }

  // dramatic
  return {
    ...base,
    boxShadow: "inset 0 0 48px rgba(249, 115, 22, 0.3), inset 0 0 120px rgba(249, 115, 22, 0.08)",
    background: "radial-gradient(ellipse at 50% 50%, rgba(249, 115, 22, 0.06) 0%, transparent 60%)",
  };
}

export default function AIApplyEffectsLayer({ phase, profile }: AIApplyEffectsLayerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || phase !== "applied") return;

    // Rainbow sweep ending with orange accent
    el.style.transition = "box-shadow 0.6s ease, background 0.6s ease";
    el.style.boxShadow = "inset 0 0 20px rgba(255, 255, 255, 0.1), 0 0 40px rgba(249, 115, 22, 0.4)";
    el.style.background = "radial-gradient(ellipse at 50% 50%, rgba(249, 115, 22, 0.08) 0%, transparent 70%)";

    const timeout = setTimeout(() => {
      el.style.transition = "opacity 0.8s ease";
      el.style.opacity = "0";
    }, 800);

    return () => clearTimeout(timeout);
  }, [phase]);

  if (phase === "idle" || phase === "reverted") return null;

  return (
    <div
      ref={ref}
      style={getContainerStyle(phase, profile)}
      aria-hidden="true"
    />
  );
}
