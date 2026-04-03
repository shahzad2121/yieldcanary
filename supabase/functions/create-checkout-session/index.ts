import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req) => {
  // Handle CORS preflight
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
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  try {
    const { priceId, email, successUrl, cancelUrl, tolt_referral: toltReferral } = await req.json();

    if (!priceId) {
      return new Response(JSON.stringify({ error: "Missing priceId" }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!stripeSecret) {
      throw new Error("STRIPE_SECRET_KEY not set");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "";

    // Fetch price details from Stripe to determine if it's recurring or one-time
    const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${stripeSecret}`,
      },
    });
    console.log("priceRes", priceRes);
    if (!priceRes.ok) {
      console.error("Stripe price fetch error:", priceRes.status, priceRes.statusText);
      const error = await priceRes.text();
      console.error("Stripe price fetch error:", error);
      throw new Error(`Failed to fetch price details: ${error}`);
    }

    const priceData = await priceRes.json();
    const isRecurring = priceData.type === "recurring";
    const mode = isRecurring ? "subscription" : "payment";

    console.log(`[Checkout] Price ${priceId} is ${priceData.type}, using mode: ${mode}`);

    // Identify standalone newsletter SKUs (separate product from app tiers)
    const newsletterMonthlyPrice =
      Deno.env.get("NEWSLETTER_MONTHLY_PRICE_ID") ?? "";
    const newsletterYearlyPrice =
      Deno.env.get("NEWSLETTER_YEARLY_PRICE_ID") ?? "";
    const isNewsletter =
      (!!newsletterMonthlyPrice && priceId === newsletterMonthlyPrice) ||
      (!!newsletterYearlyPrice && priceId === newsletterYearlyPrice);
    const newsletterPlan = priceId === newsletterYearlyPrice ? "yearly" : "monthly";
    if (isNewsletter) {
      console.log("[Checkout] [NEWSLETTER] Newsletter checkout - plan:", newsletterPlan);
    }

    /** Lifetime trial flag: omit Stripe trial if true. Fail closed (no trial) if we cannot read profile. */
    let hasUsedTrial = false;
    let stripeCustomerId: string | null = null;
    type AppUserProfile = {
      has_used_trial?: boolean | null;
      stripe_customer_id?: string | null;
      is_paid?: boolean;
      subscription_tier?: string | null;
      subscription_end?: string | null;
    };
    let appUserProfile: AppUserProfile | null = null;

    if (mode === "subscription" && email && !isNewsletter) {
      if (supabaseUrl && serviceRoleKey) {
        const profileRes = await fetch(
          `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=has_used_trial,stripe_customer_id,is_paid,subscription_tier,subscription_end`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          }
        );
        if (profileRes.ok) {
          const rows = await profileRes.json();
          appUserProfile = rows?.[0] ?? null;
          if (appUserProfile) {
            hasUsedTrial = appUserProfile.has_used_trial === true;
            stripeCustomerId = appUserProfile.stripe_customer_id ?? null;
          }
        } else {
          console.warn(
            "[Checkout] User profile fetch failed; skipping trial (fail closed). status:",
            profileRes.status,
          );
          hasUsedTrial = true;
        }
      } else {
        console.warn(
          "[Checkout] Missing SUPABASE_URL or service role key; skipping trial (fail closed)",
        );
        hasUsedTrial = true;
      }
    }

    // Validate: prevent duplicate or invalid app subscriptions (skip for newsletter)
    if (mode === "subscription" && email && !isNewsletter) {
      if (supabaseUrl && serviceRoleKey) {
        // Map priceId to tier
        const basicMonthlyPrice =
          Deno.env.get("VITE_BASIC_MONTHLY_PRICE") || Deno.env.get("BASIC_MONTHLY_PRICE") || "";
        const basicYearlyPrice =
          Deno.env.get("VITE_BASIC_YEARLY_PRICE") || Deno.env.get("BASIC_YEARLY_PRICE") || "";
        const advancedMonthlyPrice =
          Deno.env.get("VITE_ADVANCED_MONTHLY_PRICE") || Deno.env.get("ADVANCED_MONTHLY_PRICE") || "";
        const advancedYearlyPrice =
          Deno.env.get("VITE_ADVANCED_YEARLY_PRICE") || Deno.env.get("ADVANCED_YEARLY_PRICE") || "";

        let requestedTier: string | null = null;
        if (priceId === advancedMonthlyPrice || priceId === advancedYearlyPrice) {
          requestedTier = "advanced";
        } else if (priceId === basicMonthlyPrice || priceId === basicYearlyPrice) {
          requestedTier = "basic";
        }

        if (requestedTier) {
          // GUARD CHECK 1: Check Stripe API for active subscriptions (source of truth)
          const customersRes = await fetch(
            `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=10`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${stripeSecret}` },
            },
          );

          if (customersRes.ok) {
            const customersData = await customersRes.json();
            const customers = customersData.data || [];

            for (const customer of customers) {
              const subscriptionsRes = await fetch(
                `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=all&limit=100`,
                {
                  method: "GET",
                  headers: { Authorization: `Bearer ${stripeSecret}` },
                },
              );

              if (subscriptionsRes.ok) {
                const subscriptionsData = await subscriptionsRes.json();
                const subscriptions = (subscriptionsData.data || []).filter(
                  (sub: { status?: string }) => sub.status === "active" || sub.status === "trialing",
                );

                if (subscriptions.length > 0) {
                  for (const subscription of subscriptions) {
                    const subPriceId = subscription.items?.data?.[0]?.price?.id;
                    const subTier =
                      (subPriceId === advancedMonthlyPrice || subPriceId === advancedYearlyPrice)
                        ? "advanced"
                        : (subPriceId === basicMonthlyPrice || subPriceId === basicYearlyPrice)
                        ? "basic"
                        : null;

                    // Block 1: Exact duplicate (same priceId)
                    if (subPriceId === priceId) {
                      return new Response(
                        JSON.stringify({
                          error:
                            `You already have an active subscription to this exact plan. Please manage your existing subscription.`,
                        }),
                        {
                          status: 400,
                          headers: {
                            "Access-Control-Allow-Origin": "*",
                            "Content-Type": "application/json",
                          },
                        },
                      );
                    }

                    // Block 2: Same tier (prevents basic_monthly → basic_yearly, etc.)
                    if (subTier && requestedTier && subTier === requestedTier) {
                      return new Response(
                        JSON.stringify({
                          error:
                            `You already have an active ${subTier} subscription. Please cancel your existing subscription first or upgrade to a different tier.`,
                        }),
                        {
                          status: 400,
                          headers: {
                            "Access-Control-Allow-Origin": "*",
                            "Content-Type": "application/json",
                          },
                        },
                      );
                    }

                    // Block 3: Downgrade attempt (advanced → basic)
                    if (subTier === "advanced" && requestedTier === "basic") {
                      return new Response(
                        JSON.stringify({
                          error:
                            `You currently have an Advanced subscription. Please cancel it first before subscribing to Basic.`,
                        }),
                        {
                          status: 400,
                          headers: {
                            "Access-Control-Allow-Origin": "*",
                            "Content-Type": "application/json",
                          },
                        },
                      );
                    }
                  }
                }
              }
            }
          }

          // GUARD CHECK 2: Check database (backup validation) — same row as trial gating
          if (appUserProfile) {
            const user = appUserProfile;
            const currentTier = user.subscription_tier || "free";
            const isPaid = user.is_paid === true;
            const subscriptionEnd = user.subscription_end
              ? new Date(user.subscription_end)
              : null;
            const isActive = isPaid && subscriptionEnd && subscriptionEnd > new Date();

            // Block if active subscription exists (unless upgrading)
            if (isActive) {
              // Allow upgrade (basic → advanced)
              if (currentTier === "basic" && requestedTier === "advanced") {
                // Allow - this is an upgrade
              }
              // Block same tier
              else if (currentTier === requestedTier) {
                return new Response(
                  JSON.stringify({
                    error:
                      `You already have an active ${currentTier} subscription. Please manage your existing subscription.`,
                  }),
                  {
                    status: 400,
                    headers: {
                      "Access-Control-Allow-Origin": "*",
                      "Content-Type": "application/json",
                    },
                  },
                );
              }
              // Block downgrade
              else if (currentTier === "advanced" && requestedTier === "basic") {
                return new Response(
                  JSON.stringify({
                    error:
                      `You currently have an Advanced subscription. Please manage your existing subscription.`,
                  }),
                  {
                    status: 400,
                    headers: {
                      "Access-Control-Allow-Origin": "*",
                      "Content-Type": "application/json",
                    },
                  },
                );
              }
            }
          }
        }
      } else {
        console.warn("[Checkout] Missing SUPABASE_URL or service role key. Skipping subscription validation.");
      }
    }

    // Create Stripe checkout session
    const bodyParams: Record<string, string> = {
      "payment_method_types[0]": "card",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "mode": mode,
      "success_url": successUrl || "",
      "cancel_url": cancelUrl || "",
    };

    if (stripeCustomerId) {
      bodyParams["customer"] = stripeCustomerId;
    } else if (email) {
      bodyParams["customer_email"] = email;
    }

    // Only enable invoice creation for one-time payments (payment mode)
    // For subscriptions, invoices are created automatically by Stripe
    if (mode === "payment") {
      bodyParams["invoice_creation[enabled]"] = "true";
    }

    // Trial: 30 days for affiliate (Tolt referral), 7 days otherwise. Newsletter has no trial.
    // Skipped when users.has_used_trial is true (lifetime per app user, includes affiliate trials).
    const isAffiliate = typeof toltReferral === "string" && toltReferral.trim().length > 0;
    if (mode === "subscription" && !isNewsletter) {
      if (!hasUsedTrial) {
        const trialDays = isAffiliate ? "30" : "7";
        bodyParams["subscription_data[trial_period_days]"] = trialDays;
        if (isAffiliate) {
          bodyParams["subscription_data[metadata][tolt_referral]"] = toltReferral.trim();
          console.log(
            "[Checkout] [TRIAL] 30-day affiliate trial; tolt_referral sent to Stripe metadata",
          );
        } else {
          console.log(
            "[Checkout] [TRIAL] 7-day free trial enabled for subscription (card required, first charge after trial)",
          );
        }
      } else {
        console.log("[Checkout] [TRIAL] Skipping trial — user has_used_trial already");
      }
    }
    if (isAffiliate && typeof toltReferral === "string" && toltReferral.trim()) {
      bodyParams["metadata[tolt_referral]"] = toltReferral.trim();
    }

    // Newsletter: inject metadata so the webhook can identify this as a newsletter subscription
    if (mode === "subscription" && isNewsletter) {
      bodyParams["metadata[product_type]"] = "newsletter";
      bodyParams["metadata[newsletter_plan]"] = newsletterPlan;
    }

    // Persist affiliate attribution on user record when we have email and referral
    if (email && isAffiliate && typeof toltReferral === "string" && toltReferral.trim()) {
      if (supabaseUrl && serviceRoleKey) {
        await fetch(
          `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tolt_referral_id: toltReferral.trim(),
              is_affiliate_user: true,
              affiliate_signup_date: new Date().toISOString(),
            }),
          },
        );
      }
    }

    const checkoutRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(bodyParams).toString(),
    });

    if (!checkoutRes.ok) {
      const error = await checkoutRes.text();
      console.error("Stripe API error:", error);
      throw new Error(`Stripe error: ${error}`);
    }

    const session = await checkoutRes.json();
    return new Response(JSON.stringify({ sessionId: session.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
});
