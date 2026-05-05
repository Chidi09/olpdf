import { NextResponse } from "next/server";

export const API_BASE_URL = process.env.OLPDF_API_BASE_URL || "http://localhost:8000";

function isDevMockMode() {
  return process.env.NODE_ENV !== "production" && (process.env.OLPDF_DEV_MODE === "1" || process.env.OLPDF_DEV_MODE === "true");
}

async function tryDevMock(path: string, init?: RequestInit) {
  if (!isDevMockMode()) return null;
  const { handleMock } = await import("@/lib/dev/mockBff");
  return handleMock(path, init);
}

export async function forwardJson(path: string, init?: RequestInit) {
  const mock = await tryDevMock(path, init);
  if (mock) return mock;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    const fallbackMock = await tryDevMock(path, init);
    if (fallbackMock) return fallbackMock;

    return NextResponse.json(
      { error: "upstream_unavailable", message: "FastAPI upstream unavailable" },
      { status: 502 }
    );
  }
}
