import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  // For the default OLPDF domain return null — no custom tenant branding
  if (!host || host.includes("olpdf.xyz") || host.includes("localhost") || host.includes("vercel.app")) {
    return NextResponse.json(null, { status: 200 });
  }

  // Custom domain — ask the API to resolve tenant by hostname
  if (!API_URL) {
    return NextResponse.json(null, { status: 200 });
  }

  try {
    const res = await fetch(`${API_URL}/tenants/resolve?host=${encodeURIComponent(host)}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json(null, { status: 200 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
}
