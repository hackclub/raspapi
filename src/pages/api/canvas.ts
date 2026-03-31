import type { APIRoute } from "astro";

export const WIDTH = 32;
export const HEIGHT = 32;

export const ALLOWED_COLORS = new Set([
  "#0a0a0a",
  "#c41e3a",
  "#e5e5e5",
  "#404040",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316",
]);

const canvas: string[] = Array(WIDTH * HEIGHT).fill("#0a0a0a");

// ip -> timestamp
const rateLimitMap = new Map<string, number>();

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(ip) ?? 0;
  if (now - last < 1000) return true;
  rateLimitMap.set(ip, now);
  return false;
}

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ canvas, width: WIDTH, height: HEIGHT }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
};

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Rate limited. One pixel per second." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "1",
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { x, y, color } = body as Record<string, unknown>;

  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof color !== "string" ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= WIDTH ||
    y < 0 ||
    y >= HEIGHT ||
    !ALLOWED_COLORS.has(color)
  ) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  canvas[y * WIDTH + x] = color;

  return new Response(JSON.stringify({ ok: true, x, y, color }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
