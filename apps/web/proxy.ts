import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedisConfig = Boolean(redisUrl && redisToken);

const redis = hasRedisConfig ? new Redis({ url: redisUrl!, token: redisToken! }) : null;

const limits = redis
  ? {
      ai: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(50, "1 d", 50) }),
      export: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(20, "1 d", 20) }),
      import: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(10, "1 d", 10) }),
    }
  : null;

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/pdf/import")) {
    const size = parseInt(req.headers.get("content-length") ?? "0", 10);
    if (size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 10MB free tier limit" }, { status: 413 });
    }
  }

  if (!limits) return NextResponse.next();

  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userId = req.headers.get("x-user-id") ?? forwardedFor ?? "anon";
  const limiter = path.startsWith("/api/ai/")
    ? limits.ai
    : path.includes("/export")
      ? limits.export
      : path.includes("/import")
        ? limits.import
        : null;

  if (!limiter) return NextResponse.next();

  const { success, reset } = await limiter.limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit reached", reset: new Date(reset).toISOString() },
      { status: 429 }
    );
  }

  return NextResponse.next();
}
