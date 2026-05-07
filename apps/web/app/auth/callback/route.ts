import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in search params, use it as the redirection URL
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // Generate avatar in background if profile has none yet
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", data.session.user.id)
        .single();

      if (!profile?.avatar_url) {
        fetch(`${origin}/api/bff/avatar/generate`, {
          method: "POST",
          headers: { Cookie: cookieStore.toString() },
        }).catch(() => {});
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
