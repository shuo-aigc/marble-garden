const ALLOWED_ORIGIN = "https://shuo-aigc.github.io";
const ALLOWED_EVENTS = new Set([
  "mode_clear_start",
  "mode_free_start",
  "shot",
  "level_clear",
]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function deviceFromUserAgent(userAgent) {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return "mobile";
  return "desktop";
}

function browserFromUserAgent(userAgent) {
  if (/Edg\//i.test(userAgent)) return "edge";
  if (/Firefox\//i.test(userAgent)) return "firefox";
  if (/Chrome\//i.test(userAgent)) return "chrome";
  if (/Safari\//i.test(userAgent)) return "safari";
  return "other";
}

async function dailyVisitorHash(ip, day, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${day}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (url.pathname !== "/event" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    if (request.headers.get("Origin") !== ALLOWED_ORIGIN) {
      return new Response("Forbidden", { status: 403 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response("Bad request", { status: 400, headers: corsHeaders() });
    }
    if (!ALLOWED_EVENTS.has(payload?.event)) {
      return new Response("Bad request", { status: 400, headers: corsHeaders() });
    }

    try {
      const day = new Date().toISOString().slice(0, 10);
      await env.EVENTS.prepare(
        `INSERT INTO daily_event_counts (day, event, count)
         VALUES (?, ?, 1)
         ON CONFLICT(day, event) DO UPDATE SET count = count + 1`
      ).bind(day, payload.event).run();

      // The server sees the network address, but never stores it. A secret-salted,
      // per-day hash is used only to deduplicate starts within that one day.
      if ((payload.event === "mode_clear_start" || payload.event === "mode_free_start") && env.IP_HASH_SALT) {
        const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For");
        if (ip) {
          const userAgent = request.headers.get("User-Agent") || "";
          const device = deviceFromUserAgent(userAgent);
          const browser = browserFromUserAgent(userAgent);
          const visitorHash = await dailyVisitorHash(ip, day, env.IP_HASH_SALT);
          const result = await env.EVENTS.prepare(
            `INSERT OR IGNORE INTO daily_visitors (day, visitor_hash, device, browser)
             VALUES (?, ?, ?, ?)`
          ).bind(day, visitorHash, device, browser).run();
          if (result.meta.changes) {
            await env.EVENTS.prepare(
              `INSERT INTO daily_device_counts (day, device, browser, count)
               VALUES (?, ?, ?, 1)
               ON CONFLICT(day, device, browser) DO UPDATE SET count = count + 1`
            ).bind(day, device, browser).run();
          }
        }
      }
    } catch {
      return new Response("Unavailable", { status: 503, headers: corsHeaders() });
    }
    return new Response(null, { status: 204, headers: corsHeaders() });
  },
};
