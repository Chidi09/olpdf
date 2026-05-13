"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateAlias(userId: string): string {
  const hash = simpleHash(userId);
  const consonants = "bcdfghjklmnpqrstvwxyz";
  const vowels = "aeiou";
  let alias = "";
  for (let i = 0; i < 6; i++) {
    const pool = i % 2 === 0 ? consonants : vowels;
    const idx = (hash >> (i * 5)) % pool.length;
    alias += pool[idx];
  }
  return alias;
}

type EditorProfile = {
  alias: string;
  avatarUrl: string;
  displayName: string;
  color: string;
};

const COLORS = [
  "#e6a449", "#4f9cf7", "#34d399", "#f472b6", "#a78bfa",
  "#fbbf24", "#60a5fa", "#fb923c", "#6ee7b7", "#e879f9",
];

export function useEditorProfile(): EditorProfile {
  const [profile, setProfile] = useState<EditorProfile>({
    alias: "anon",
    avatarUrl: "",
    displayName: "You",
    color: COLORS[0],
  });

  useEffect(() => {
    let mounted = true;
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (!mounted || !data.user) return;
      const userId = data.user.id;
      const alias = generateAlias(userId);
      const colorIndex = simpleHash(userId + "color") % COLORS.length;
      const color = COLORS[colorIndex];
      const meta = data.user.user_metadata ?? {};
      setProfile({
        alias,
        avatarUrl: `https://api.dicebear.com/9.x/lorelei/png?seed=${alias}&size=80`,
        displayName: String(meta.full_name || meta.name || data.user.email || "You"),
        color,
      });
    }).catch(() => null);
    return () => { mounted = false; };
  }, []);

  return profile;
}
