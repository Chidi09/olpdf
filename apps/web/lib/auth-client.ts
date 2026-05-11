"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

const authBaseUrl =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz"
    : window.location.origin;

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
