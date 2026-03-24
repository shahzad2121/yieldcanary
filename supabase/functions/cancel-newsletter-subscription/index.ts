import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Legacy endpoint: standalone newsletter subscriptions are retired.
 * Weekly email is included with Basic and Advanced; cancel the app subscription to stop billing.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  return jsonResponse(
    {
      error:
        "The YieldCanary Weekly newsletter is included with Basic and Advanced. There is no separate newsletter subscription to cancel. Use Manage Subscription to change or cancel your plan.",
      code: "NEWSLETTER_BUNDLED",
    },
    410
  );
});
