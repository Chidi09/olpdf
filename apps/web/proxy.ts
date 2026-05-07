import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createServerClient } from "@supabase/ssr";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedisConfig = Boolean(redisUrl && redisToken);

const redis = hasRedisConfig ? new Redis({ url: redisUrl!, token: redisToken! }) : null;
const protectedRoutes = ["/dashboard", "/editor", "/books", "/templates", "/toolkit", "/settings", "/api/bff"];

const limits = redis
  ? {
      ai: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(50, "1 d", 50) }),
      export: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(20, "1 d", 20) }),
      import: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(10, "1 d", 10) }),
    }
  : null;

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const response = NextResponse.next();

  if (process.env.NODE_ENV !== "development") {
    const isProtected = protectedRoutes.some((prefix) => path.startsWith(prefix));
    if (isProtected) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll();
            },
            setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
              for (const cookie of cookiesToSet) {
                response.cookies.set(cookie.name, cookie.value, cookie.options);
              }
            },
          },
        }
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("redirect", path);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  if (path.startsWith("/api/pdf/import")) {
    const size = parseInt(req.headers.get("content-length") ?? "0", 10);
    if (size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 10MB free tier limit" }, { status: 413 });
    }
  }

  if (!limits) return response;

  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userId = req.headers.get("x-user-id") ?? forwardedFor ?? "anon";
  const limiter = path.startsWith("/api/ai/")
    ? limits.ai
    : path.includes("/export")
      ? limits.export
      : path.includes("/import")
        ? limits.import
        : null;

  if (!limiter) return response;

  const { success, reset } = await limiter.limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit reached", reset: new Date(reset).toISOString() },
      { status: 429 }
    );
  }

  return response;
}
