import { NextResponse } from "next/server";
import { API_BASE_URL } from "../_shared";

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/templates`, { method: "GET", cache: "no-store" });
    const data = await response.json().catch(() => []);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: "Template registry unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
