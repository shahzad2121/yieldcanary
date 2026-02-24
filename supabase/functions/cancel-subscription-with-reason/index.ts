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
    console.log("[cancel-subscription] Rejected: method not allowed");
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  console.log("[cancel-subscription] Request started");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("[cancel-subscription] Rejected: missing or invalid Authorization header");
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[cancel-subscription] Server configuration error: missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }
    if (!stripeSecret) {
      console.error("[cancel-subscription] Stripe is not configured (STRIPE_SECRET_KEY missing)");
      return jsonResponse({ error: "Stripe is not configured" }, 500);
    }

    let body: { cancel_reason?: string; cancel_reason_other?: string };
    try {
      body = await req.json();
    } catch {
      console.warn("[cancel-subscription] Rejected: invalid JSON body");
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const cancelReason = typeof body.cancel_reason === "string" ? body.cancel_reason.trim() : "";
    const cancelReasonOther = typeof body.cancel_reason_other === "string" ? body.cancel_reason_other.trim() : "";

    if (!cancelReason) {
      console.warn("[cancel-subscription] Rejected: cancel_reason is required");
      return jsonResponse({ error: "cancel_reason is required" }, 400);
    }
    if (!CANCEL_REASONS.includes(cancelReason as (typeof CANCEL_REASONS)[number])) {
      console.warn("[cancel-subscription] Rejected: invalid cancel_reason", { cancelReason });
      return jsonResponse(
        { error: "cancel_reason must be one of: too_expensive, not_enough_value, not_using_enough, found_better_alternative, other" },
        400
      );
    }
    if (cancelReason === "other" && !cancelReasonOther) {
      console.warn("[cancel-subscription] Rejected: cancel_reason_other required when reason is other");
      return jsonResponse({ error: "cancel_reason_other is required when cancel_reason is other" }, 400);
    }

    console.log("[cancel-subscription] Body validated", { cancel_reason: cancelReason, has_other_text: cancelReason === "other" && !!cancelReasonOther });

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: serviceRoleKey },
    });
    if (!userRes.ok) {
      console.warn("[cancel-subscription] Auth failed: get user returned", userRes.status);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const authUser = await userRes.json();
    const email = authUser?.email;
    if (!email) {
      console.warn("[cancel-subscription] Auth user has no email");
      return jsonResponse({ error: "User email not found" }, 401);
    }

    console.log("[cancel-subscription] Auth ok", { email });

    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,stripe_customer_id,stripe_subscription_id,is_paid,name,username,subscription_tier,subscription_status`,
      {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      }
    );
    if (!usersRes.ok) {
      console.error("[cancel-subscription] Failed to load user from DB", { status: usersRes.status });
      return jsonResponse({ error: "Failed to load user" }, 500);
    }
    const users = await usersRes.json();
    const user = users?.[0];
    if (!user) {
      console.warn("[cancel-subscription] User not found in users table", { email });
      return jsonResponse({ error: "User not found" }, 400);
    }
    if (!user.stripe_customer_id) {
      console.warn("[cancel-subscription] User has no stripe_customer_id", { user_id: user.id, email });
      return jsonResponse({ error: "No active subscription to cancel" }, 400);
    }

    console.log("[cancel-subscription] User loaded", { user_id: user.id, stripe_customer_id: user.stripe_customer_id ? "present" : "missing", stripe_subscription_id: user.stripe_subscription_id ?? "none" });

    let subscriptionId: string | null = user.stripe_subscription_id ?? null;
    if (!subscriptionId) {
      console.log("[cancel-subscription] No subscription_id on user, listing Stripe subscriptions for customer");
      const listRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${user.stripe_customer_id}&status=all&limit=10`,
        { headers: { Authorization: `Bearer ${stripeSecret}` } }
      );
      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error("[cancel-subscription] Stripe list subscriptions error:", errText);
        return jsonResponse({ error: "Could not verify subscription" }, 500);
      }
      const listData = await listRes.json();
      const subs = listData?.data ?? [];
      const active = subs.find((s: { status: string }) => s.status === "active" || s.status === "trialing");
      subscriptionId = active?.id ?? null;
      console.log("[cancel-subscription] Stripe list result", { found: subscriptionId ?? "none", count: subs.length });
    }
    if (!subscriptionId) {
      console.warn("[cancel-subscription] No active or trialing subscription found for customer");
      return jsonResponse({ error: "No active subscription found" }, 400);
    }

    // Fetch subscription to know if trialing (cancel now) or active (cancel at period end)
    const getSubRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${stripeSecret}` },
    });
    if (!getSubRes.ok) {
      const errText = await getSubRes.text();
      console.error("[cancel-subscription] Stripe get subscription error:", errText);
      return jsonResponse({ error: "Could not load subscription" }, 500);
    }
    const stripeSub = await getSubRes.json();
    const subStatus = stripeSub?.status ?? "";
    const isTrialing = subStatus === "trialing";
    const currentPeriodEnd = stripeSub?.current_period_end ? Number(stripeSub.current_period_end) : null;
    const cancelsAtIso = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null;

    console.log("[cancel-subscription] Stripe subscription", { subscription_id: subscriptionId, status: subStatus, is_trialing: isTrialing, cancels_at: cancelsAtIso ?? "n/a" });

    const now = new Date().toISOString();
    const previousTier = user.subscription_tier || "basic";
    const firstName = user.name || user.username || email.split("@")[0];

    if (isTrialing) {
      console.log("[cancel-subscription] Path: trial — cancelling immediately (DELETE)");
      // Trial: cancel immediately (DELETE)
      const deleteRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${stripeSecret}` },
      });
      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        console.error("[cancel-subscription] Stripe DELETE subscription error:", errText);
        const alreadyCanceled = errText.includes("No such subscription") || errText.includes("canceled") || errText.includes("already been canceled");
        if (!alreadyCanceled) {
          return jsonResponse({ error: "Could not cancel subscription. Please try Manage Subscription or contact support." }, 500);
        }
        console.log("[cancel-subscription] Stripe subscription already canceled, continuing with DB update");
      } else {
        console.log("[cancel-subscription] Stripe subscription deleted", { subscription_id: subscriptionId });
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
        console.error("[cancel-subscription] Failed to update user after trial cancel:", errText);
        return jsonResponse({ error: "Subscription was cancelled but we could not update your account. Please contact support." }, 500);
      }

      console.log("[cancel-subscription] User record updated to free (trial cancelled)");

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
        console.log("[cancel-subscription] Email sent: subscription_cancelled to user");
      } catch (e) {
        console.error("[cancel-subscription] Failed to send subscription_cancelled email to user:", e);
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
        console.log("[cancel-subscription] Email sent: cancellation_reason_to_support to support");
      } catch (e) {
        console.error("[cancel-subscription] Failed to send cancellation reason to support:", e);
      }

      console.log("[cancel-subscription] Trial cancellation completed successfully", { email });
      return jsonResponse({ success: true }, 200);
    }

    // Paid (active): cancel at end of billing period (PATCH cancel_at_period_end)
    console.log("[cancel-subscription] Path: paid — scheduling cancel at period end", { subscription_id: subscriptionId, cancels_at: cancelsAtIso });

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
      console.error("[cancel-subscription] Stripe set cancel_at_period_end error:", errText);
      return jsonResponse({ error: "Could not schedule cancellation. Please try Manage Subscription or contact support." }, 500);
    }

    console.log("[cancel-subscription] Stripe cancel_at_period_end set");

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
      console.error("[cancel-subscription] Failed to update user after schedule cancel:", errText);
      return jsonResponse({ error: "Cancellation was scheduled but we could not update your account. Please contact support." }, 500);
    }

    console.log("[cancel-subscription] User record updated (cancel_at_period_end, cancels_at)");

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
      console.log("[cancel-subscription] Email sent: cancellation_reason_to_support to support");
    } catch (e) {
      console.error("[cancel-subscription] Failed to send cancellation reason to support:", e);
    }

    const cancelsAtDate = cancelsAtIso ? new Date(cancelsAtIso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          to: email,
          templateId: "cancellation_scheduled",
          data: { first_name: firstName, cancels_at_date: cancelsAtDate },
        }),
      });
      console.log("[cancel-subscription] Email sent: cancellation_scheduled to user");
    } catch (e) {
      console.error("[cancel-subscription] Failed to send cancellation_scheduled email:", e);
    }

    console.log("[cancel-subscription] Paid cancellation scheduled successfully", { email, cancels_at: cancelsAtIso });
    return jsonResponse({ success: true, cancels_at: cancelsAtIso ?? undefined }, 200);
  } catch (e) {
    console.error("[cancel-subscription] Unexpected error:", e);
    return jsonResponse({ error: "Something went wrong" }, 500);
  }
});
