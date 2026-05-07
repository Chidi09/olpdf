"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function isDevMockMode() {
  if (typeof process === "undefined") return false;
  const flag = process.env.NEXT_PUBLIC_OLPDF_DEV_MODE ?? process.env.OLPDF_DEV_MODE;
  return process.env.NODE_ENV !== "production" && (flag === "1" || flag === "true");
}

export function useAuth() {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDevMockMode()) {
      const mockUser = {
        id: "dev-user",
        email: "dev@olpdf.xyz",
        user_metadata: { full_name: "Dev User" },
        app_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as unknown as User;

      const mockSession = {
        access_token: "dev-mock-token",
        refresh_token: "dev-mock-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: mockUser,
      } as unknown as Session;

      Promise.resolve().then(() => {
        setUser(mockUser);
        setSession(mockSession);
        setLoading(false);
      });
      return;
    }

    if (!supabase) {
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    if (isDevMockMode() && !supabase) {
      setUser(null);
      setSession(null);
      return;
    }
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
