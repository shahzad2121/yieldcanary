import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

  try {
    console.log("[cancel-newsletter] Request started");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "";
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }
    if (!stripeSecret) {
      return jsonResponse({ error: "Stripe is not configured" }, 500);
    }

    // Verify the calling user's JWT via Supabase auth
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: serviceRoleKey },
    });
    if (!userRes.ok) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const authUser = await userRes.json();
    const email = authUser?.email;
    if (!email) {
      return jsonResponse({ error: "User email not found" }, 401);
    }
    console.log("[cancel-newsletter] Auth OK", { email });

    // Load the user row to get their newsletter subscription ID
    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,stripe_newsletter_subscription_id`,
      {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      }
    );
    if (!usersRes.ok) {
      return jsonResponse({ error: "Failed to load user" }, 500);
    }
    const users = await usersRes.json();
    const user = users?.[0];
    if (!user) {
      return jsonResponse({ error: "User not found" }, 400);
    }

    const subscriptionId = user.stripe_newsletter_subscription_id ?? null;
    if (!subscriptionId) {
      return jsonResponse({ error: "No active newsletter subscription to cancel" }, 400);
    }
    console.log("[cancel-newsletter] Cancelling Stripe subscription", { subscriptionId });

    // Immediately cancel in Stripe (no period-end grace; matches current policy)
    const deleteRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${stripeSecret}` },
    });
    if (!deleteRes.ok) {
      const errText = await deleteRes.text();
      console.error("[cancel-newsletter] Stripe DELETE error:", errText);
      return jsonResponse(
        { error: "Could not cancel newsletter. Please try again or contact support." },
        500
      );
    }
    console.log("[cancel-newsletter] Stripe subscription deleted", { subscriptionId });

    // Clear newsletter fields so the user stops receiving the weekly send
    const nowIso = new Date().toISOString();
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newsletter_tier: "none",
          stripe_newsletter_subscription_id: null,
          updated_at: nowIso,
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("[cancel-newsletter] Failed to clear newsletter fields:", errText);
      return jsonResponse(
        { error: "Newsletter cancelled but account not updated. Please contact support." },
        500
      );
    }

    console.log("[cancel-newsletter] Newsletter fields cleared", { email });
    return jsonResponse({ success: true }, 200);
  } catch (e) {
    console.error("[cancel-newsletter] Unexpected error:", e);
    return jsonResponse({ error: "Something went wrong" }, 500);
  }
});
