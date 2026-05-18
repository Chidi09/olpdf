"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";

type Theme = "light" | "system" | "dark";

const ICONS: Record<Theme, typeof SunIcon> = {
  light: SunIcon,
  system: ComputerDesktopIcon,
  dark: MoonIcon,
};

const CYCLE: Record<Theme, Theme> = {
  light: "system",
  system: "dark",
  dark: "light",
};

const LABELS: Record<Theme, string> = {
  light: "Light",
  system: "System",
  dark: "Dark",
};

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const active = (mounted ? theme : "system") as Theme;

  if (compact) {
    const Icon = ICONS[active] ?? ComputerDesktopIcon;
    const next = CYCLE[active] ?? "system";
    return (
      <button
        onClick={() => setTheme(next)}
        aria-label={`Theme: ${LABELS[active]} — click to cycle`}
        title={`Theme: ${LABELS[active]}`}
        className="flex w-full items-center justify-center rounded-md p-2 transition-colors text-text-tertiary hover:bg-surface hover:text-text-primary"
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex w-full items-center rounded-md border border-border-subtle bg-surface p-1">
      {(["light", "system", "dark"] as Theme[]).map((t) => {
        const Icon = ICONS[t];
        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            aria-label={`Use ${LABELS[t]} theme`}
            title={LABELS[t]}
            className={`flex flex-1 items-center justify-center rounded py-1.5 transition-colors ${
              active === t
                ? "bg-hover text-text-primary"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
