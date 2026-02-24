import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const CANCEL_REASONS = [
  "too_expensive",
  "not_enough_value",
  "not_using_enough",
  "found_better_alternative",
  "other",
] as const;

function jsonResponse(body: object, status: number) {
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }
    if (!stripeSecret) {
      return jsonResponse({ error: "Stripe is not configured" }, 500);
    }

    let body: { cancel_reason?: string; cancel_reason_other?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const cancelReason = typeof body.cancel_reason === "string" ? body.cancel_reason.trim() : "";
    const cancelReasonOther = typeof body.cancel_reason_other === "string" ? body.cancel_reason_other.trim() : "";

    if (!cancelReason) {
      return jsonResponse({ error: "cancel_reason is required" }, 400);
    }
    if (!CANCEL_REASONS.includes(cancelReason as (typeof CANCEL_REASONS)[number])) {
      return jsonResponse(
        { error: "cancel_reason must be one of: too_expensive, not_enough_value, not_using_enough, found_better_alternative, other" },
        400
      );
    }
    if (cancelReason === "other" && !cancelReasonOther) {
      return jsonResponse({ error: "cancel_reason_other is required when cancel_reason is other" }, 400);
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

    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,stripe_customer_id,stripe_subscription_id,is_paid,name,username,subscription_tier,subscription_status`,
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
    if (!user.stripe_customer_id) {
      return jsonResponse({ error: "No active subscription to cancel" }, 400);
    }
    if (!user.is_paid) {
      return jsonResponse({ error: "No active subscription to cancel" }, 400);
    }

    let subscriptionId: string | null = user.stripe_subscription_id ?? null;
    if (!subscriptionId) {
      const listRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${user.stripe_customer_id}&status=all&limit=10`,
        { headers: { Authorization: `Bearer ${stripeSecret}` } }
      );
      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error("Stripe list subscriptions error:", errText);
        return jsonResponse({ error: "Could not verify subscription" }, 500);
      }
      const listData = await listRes.json();
      const subs = listData?.data ?? [];
      const active = subs.find((s: { status: string }) => s.status === "active" || s.status === "trialing");
      subscriptionId = active?.id ?? null;
    }
    if (!subscriptionId) {
      return jsonResponse({ error: "No active subscription found" }, 400);
    }

    // Fetch subscription to know if trialing (cancel now) or active (cancel at period end)
    const getSubRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${stripeSecret}` },
    });
    if (!getSubRes.ok) {
      const errText = await getSubRes.text();
      console.error("Stripe get subscription error:", errText);
      return jsonResponse({ error: "Could not load subscription" }, 500);
    }
    const stripeSub = await getSubRes.json();
    const subStatus = stripeSub?.status ?? "";
    const isTrialing = subStatus === "trialing";
    const currentPeriodEnd = stripeSub?.current_period_end ? Number(stripeSub.current_period_end) : null;
    const cancelsAtIso = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null;

    const now = new Date().toISOString();
    const previousTier = user.subscription_tier || "basic";
    const firstName = user.name || user.username || email.split("@")[0];

    if (isTrialing) {
      // Trial: cancel immediately (DELETE)
      const deleteRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${stripeSecret}` },
      });
      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        console.error("Stripe cancel subscription error:", errText);
        const alreadyCanceled = errText.includes("No such subscription") || errText.includes("canceled") || errText.includes("already been canceled");
        if (!alreadyCanceled) {
          return jsonResponse({ error: "Could not cancel subscription. Please try Manage Subscription or contact support." }, 500);
        }
      }

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
            cancel_reason: cancelReason,
            cancel_reason_other: cancelReason === "other" ? cancelReasonOther : null,
            cancelled_at: now,
            is_paid: false,
            subscription_tier: "free",
            stripe_subscription_id: null,
            subscription_start: null,
            subscription_end: null,
            trial_ends_at: null,
            subscription_status: "free",
            trial_converted_to_paid: false,
            cancel_at_period_end: false,
            cancels_at: null,
            updated_at: now,
          }),
        }
      );
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error("Failed to update user after cancel:", errText);
        return jsonResponse({ error: "Subscription was cancelled but we could not update your account. Please contact support." }, 500);
      }

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            to: email,
            templateId: "subscription_cancelled",
            data: { first_name: firstName, tier: previousTier },
          }),
        });
      } catch (e) {
        console.error("Failed to send subscription_cancelled email:", e);
      }
      try {
        const reasonLabel = cancelReason === "other" ? `Other: ${cancelReasonOther}` : cancelReason.replace(/_/g, " ");
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            to: "support@yieldcanary.com",
            templateId: "cancellation_reason_to_support",
            data: {
              user_email: email,
              reason: reasonLabel,
              reason_other: cancelReason === "other" ? cancelReasonOther : "",
              timestamp: now,
            },
          }),
        });
      } catch (e) {
        console.error("Failed to send cancellation reason to support:", e);
      }

      return jsonResponse({ success: true }, 200);
    }

    // Paid (active): cancel at end of billing period (PATCH cancel_at_period_end)
    const patchRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ cancel_at_period_end: "true" }).toString(),
    });
    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error("Stripe set cancel_at_period_end error:", errText);
      return jsonResponse({ error: "Could not schedule cancellation. Please try Manage Subscription or contact support." }, 500);
    }

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
          cancel_reason: cancelReason,
          cancel_reason_other: cancelReason === "other" ? cancelReasonOther : null,
          cancelled_at: now,
          cancel_at_period_end: true,
          cancels_at: cancelsAtIso,
          updated_at: now,
        }),
      }
    );
    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("Failed to update user after schedule cancel:", errText);
      return jsonResponse({ error: "Cancellation was scheduled but we could not update your account. Please contact support." }, 500);
    }

    try {
      const reasonLabel = cancelReason === "other" ? `Other: ${cancelReasonOther}` : cancelReason.replace(/_/g, " ");
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          to: "support@yieldcanary.com",
          templateId: "cancellation_reason_to_support",
          data: {
            user_email: email,
            reason: reasonLabel,
            reason_other: cancelReason === "other" ? cancelReasonOther : "",
            timestamp: now,
            cancels_at: cancelsAtIso ?? "",
          },
        }),
      });
    } catch (e) {
      console.error("Failed to send cancellation reason to support:", e);
    }

    return jsonResponse({ success: true, cancels_at: cancelsAtIso ?? undefined }, 200);
  } catch (e) {
    console.error("cancel-subscription-with-reason error:", e);
    return jsonResponse({ error: "Something went wrong" }, 500);
  }
});
