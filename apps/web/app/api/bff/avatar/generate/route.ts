import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/app/api/bff/_shared";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${API_BASE_URL}/api/avatar/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Avatar generation failed" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
