"use client";

import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    id: string;
    email: string;
    user_metadata: { full_name: string; avatar_url: string | null };
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.user) {
      setUser(null);
      setLoading(false);
      return;
    }
    const nextUser = {
      id: data.user.id,
      email: data.user.email,
      user_metadata: {
        full_name: data.user.name || "",
        avatar_url: data.user.image ?? null,
      },
    };
    setUser(nextUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return { user, session: user ? { user } : null, loading, signOut, refresh };
}
