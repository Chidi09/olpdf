"use client";

import { useEffect } from "react";

export function TypekitLoader() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://use.typekit.net/nlr1ayn.css";
    document.head.appendChild(link);
  }, []);
  return null;
}
