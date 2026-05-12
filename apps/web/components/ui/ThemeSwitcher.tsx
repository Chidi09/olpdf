"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted ? theme : "system";

  return (
    <div className={`flex items-center rounded-md border border-border-subtle bg-surface p-1 ${compact ? "w-full justify-center" : "w-full"}`}>
      <button
        onClick={() => setTheme("light")}
        aria-label="Use light theme"
        className={`rounded p-1.5 transition-colors ${active === "light" ? "bg-hover text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}
      >
        <SunIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        aria-label="Use system theme"
        className={`rounded p-1.5 transition-colors ${active === "system" ? "bg-hover text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}
      >
        <ComputerDesktopIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        aria-label="Use dark theme"
        className={`rounded p-1.5 transition-colors ${active === "dark" ? "bg-hover text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}
      >
        <MoonIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
