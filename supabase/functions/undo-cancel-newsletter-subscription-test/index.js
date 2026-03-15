import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

function jsonResponse(body, status) {
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
    console.log("[undo-cancel-newsletter-test] Request started");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }
    if (!stripeSecret) {
      return jsonResponse({ error: "Stripe is not configured" }, 500);
    }

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
    console.log("[undo-cancel-newsletter-test] Auth OK", { email });

    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(
        email
      )}&select=id,stripe_newsletter_subscription_id,newsletter_cancel_at_period_end,newsletter_cancels_at`,
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
      return jsonResponse({ error: "No active newsletter subscription to keep" }, 400);
    }
    console.log("[undo-cancel-newsletter-test] Loaded user + newsletter subscription", {
      user_id: user.id,
      subscriptionId,
      newsletter_cancel_at_period_end: user.newsletter_cancel_at_period_end,
      newsletter_cancels_at: user.newsletter_cancels_at ?? "null",
    });

    // Clear cancel_at_period_end on Stripe
    const patchRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ cancel_at_period_end: "false" }).toString(),
    });
    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error("[undo-cancel-newsletter-test] Stripe clear cancel_at_period_end error:", errText);
      return jsonResponse({ error: "Could not keep newsletter subscription. Please try again or contact support." }, 500);
    }
    console.log("[undo-cancel-newsletter-test] Stripe subscription updated cancel_at_period_end=false", {
      subscriptionId,
    });

    // Clear newsletter cancel flags in DB
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
          newsletter_cancel_at_period_end: false,
          newsletter_cancels_at: null,
          updated_at: nowIso,
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("[undo-cancel-newsletter-test] Failed to update user cancel flags:", errText);
      return jsonResponse(
        { error: "Newsletter was kept active, but we could not update your account. Please contact support." },
        500
      );
    }

    console.log("[undo-cancel-newsletter-test] User newsletter cancel flags cleared", {
      email,
      newsletter_cancel_at_period_end: false,
      newsletter_cancels_at: null,
    });

    return jsonResponse({ success: true }, 200);
  } catch (e) {
    console.error("[undo-cancel-newsletter-test] Unexpected error:", e);
    return jsonResponse({ error: "Something went wrong" }, 500);
  }
});

