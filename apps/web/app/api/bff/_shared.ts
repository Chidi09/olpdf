import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { SignJWT } from "jose";
import { jwtVerify } from "jose";

export const API_BASE_URL = (process.env.OLPDF_API_BASE_URL || "http://localhost:8000").trim();

async function getServerAccessToken(): Promise<string | null> {
  try {
    const hdr = await headers();
    const cookie = hdr.get("cookie") || "";
    const token = cookie
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("olpdf_session="))
      ?.slice("olpdf_session=".length)
      ?.trim();
    if (!token) return null;

    const secret = new TextEncoder().encode((process.env.API_JWT_SECRET || "").trim());
    if (!secret.length) return null;
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload?.sub) return null;

    // Mint a short-lived JWT for the FastAPI to verify
    const upstreamSecret = new TextEncoder().encode((process.env.API_JWT_SECRET || "").trim());
    return await new SignJWT({
      sub: String(payload.sub),
      email: payload.email,
      role: "authenticated",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(upstreamSecret);
  } catch {
    return null;
  }
}

async function forward(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getServerAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "unauthorized", message: "No active session" },
      { status: 401 }
    );
  }

  const requestId = crypto.randomUUID();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-Request-ID": requestId,
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function forwardJson(path: string, init?: RequestInit) {
  try {
    const response = await forward(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, {
      status: response.status,
      headers: { "X-Request-ID": response.headers.get("X-Request-ID") || crypto.randomUUID() },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: "API upstream unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}

export async function forwardRaw(path: string, init?: RequestInit) {
  try {
    const response = await forward(path, init);
    const body = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const disposition = response.headers.get("content-disposition") || undefined;
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        ...(disposition ? { "Content-Disposition": disposition } : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: "API upstream unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
