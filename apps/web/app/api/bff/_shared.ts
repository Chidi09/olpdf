import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const API_BASE_URL = process.env.OLPDF_API_BASE_URL || "http://localhost:8000";

function isDevMockMode() {
  // Only allow mocks in local development environment.
  // process.env.NODE_ENV is 'development' during 'next dev'.
  return process.env.NODE_ENV === "development" && (process.env.OLPDF_DEV_MODE === "1" || process.env.OLPDF_DEV_MODE === "true");
}

async function tryDevMock(path: string, init?: RequestInit) {
  if (!isDevMockMode()) return null;
  const { handleMock } = await import("@/lib/dev/mockBff");
  return handleMock(path, init);
}

async function getServerAccessToken(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function forwardJson(path: string, init?: RequestInit) {
  const mock = await tryDevMock(path, init);
  if (mock) return mock;

  try {
    const accessToken = await getServerAccessToken();
    
    if (!accessToken && !isDevMockMode()) {
      return NextResponse.json(
        { error: "unauthorized", message: "No active session" },
        { status: 401 }
      );
    }

    const requestId = crypto.randomUUID();

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        "X-Request-ID": response.headers.get("X-Request-ID") || requestId
      }
    });
  } catch (error) {
    const fallbackMock = await tryDevMock(path, init);
    if (fallbackMock) return fallbackMock;

    return NextResponse.json(
      { error: "upstream_unavailable", message: "FastAPI upstream unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
