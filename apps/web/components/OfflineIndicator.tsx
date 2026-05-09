"use client";

import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const on = () => setOffline(true);
    const off = () => setOffline(false);
    window.addEventListener("offline", on);
    window.addEventListener("online", off);
    setOffline(!navigator.onLine);
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
