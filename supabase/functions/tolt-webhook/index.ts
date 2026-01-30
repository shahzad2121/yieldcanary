// Tolt affiliate webhook – skeleton endpoint.
// Use this URL in Tolt Dashboard → Settings → Webhooks.
// Full implementation (signature verification, attribution, etc.) will be added
// once TOLT_WEBHOOK_SECRET and TOLT_API_KEY are configured.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // Non-JSON body is fine for skeleton; we still return 200
  }

  const eventType = payload && typeof payload === "object" && "type" in payload
    ? (payload as { type?: string }).type
    : "(unknown)";

  console.log("[Tolt Webhook] Received request. Event type:", eventType);
  if (payload) {
    console.log("[Tolt Webhook] Payload keys:", Object.keys(payload as object));
  }

  // Skeleton: always return 200 so Tolt does not retry.
  // Full handler will verify signature and process events once credentials are set.
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
