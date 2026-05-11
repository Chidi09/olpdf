"use client";

import { useSession, signOut as _signOut } from "@/lib/auth-client";

export function useAuth() {
  const { data: session, isPending: loading } = useSession();

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        user_metadata: {
          full_name: session.user.name,
          avatar_url: session.user.image ?? null,
        },
      }
    : null;

  const signOut = () => _signOut();

  return { user, session, loading, signOut };
}
