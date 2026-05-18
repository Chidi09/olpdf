import { NextResponse } from "next/server";
import { API_BASE_URL } from "../_shared";

const DEMO_TOKEN = (process.env.DEMO_USER_TOKEN || "").trim();

async function forwardDemo(path: string, init?: RequestInit): Promise<Response> {
  if (!DEMO_TOKEN) {
    return NextResponse.json(
      { error: "demo_unavailable", message: "Demo not configured" },
      { status: 503 }
    ) as unknown as Response;
  }
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${DEMO_TOKEN}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function forwardDemoJson(path: string, init?: RequestInit) {
  try {
    const response = await forwardDemo(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: "upstream_unavailable", detail: String(error) }, { status: 502 });
  }
}

export async function forwardDemoRaw(path: string, init?: RequestInit) {
  if (!DEMO_TOKEN) {
    return NextResponse.json({ error: "demo_unavailable" }, { status: 503 });
  }
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${DEMO_TOKEN}`,
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: "upstream_unavailable", detail: String(error) }, { status: 502 }) as unknown as Response;
  }
}
