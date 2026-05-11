import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { SignJWT } from "jose";
import { auth } from "@/lib/auth";

export const API_BASE_URL = process.env.OLPDF_API_BASE_URL || "http://localhost:8000";

async function getServerAccessToken(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;

    // Mint a short-lived JWT for the FastAPI to verify
    const secret = new TextEncoder().encode(process.env.API_JWT_SECRET!);
    return await new SignJWT({
      sub: session.user.id,
      email: session.user.email,
      role: "authenticated",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
  } catch {
    return null;
  }
}

export async function forwardJson(path: string, init?: RequestInit) {
  try {
    const accessToken = await getServerAccessToken();

    if (!accessToken) {
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
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, {
      status: response.status,
      headers: { "X-Request-ID": response.headers.get("X-Request-ID") || requestId },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: "API upstream unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
