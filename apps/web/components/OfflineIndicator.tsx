"use client";

import { useEffect, useState } from "react";

export function OfflineIndicator() {
  // Lazy init avoids SSR mismatch and fixes the setState-in-effect lint error.
  const [offline, setOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const on = () => setOffline(true);
    const off = () => setOffline(false);
    window.addEventListener("offline", on);
    window.addEventListener("online", off);
    return () => {
      window.removeEventListener("offline", on);
      window.removeEventListener("online", off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[999] -translate-x-1/2 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
      You are offline — changes are saved locally
    </div>
  );
}
