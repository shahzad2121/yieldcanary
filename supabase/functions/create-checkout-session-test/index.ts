import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  // CORS
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }

  try {
    const { priceId, email, successUrl, cancelUrl } = await req.json();

    if (!priceId || !email) {
      return new Response(JSON.stringify({ error: "Missing priceId or email" }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY_TEST");
    if (!stripeSecret) {
      throw new Error("STRIPE_SECRET_KEY_TEST not set");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL or SERVICE_ROLE_KEY not set");
    }

    /* --------------------------------------------------
       1️⃣ Determine checkout mode from Stripe price
    -------------------------------------------------- */
    const priceRes = await fetch(
      `https://api.stripe.com/v1/prices/${priceId}`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
        },
      }
    );

    if (!priceRes.ok) {
      throw new Error("Failed to fetch price from Stripe");
    }

    const priceData = await priceRes.json();
    const mode = priceData.type === "recurring" ? "subscription" : "payment";

    console.log(`[Checkout] [FLOW] priceId=${priceId}, type=${priceData.type}, mode=${mode}, email=${email}`);

    /* --------------------------------------------------
       2️⃣ P0 — SMART SUBSCRIPTION VALIDATION
       Allows upgrades, blocks duplicates & downgrades
    -------------------------------------------------- */
    if (mode === "subscription") {
      // Map priceId to tier
      const basicMonthlyPrice = "price_1SkSYWJYaJlmvTvCIy15xocG";
      const basicYearlyPrice = "price_1Sn62YJYaJlmvTvCNWddZaeG";
      const advancedMonthlyPrice = "price_1Sn63DJYaJlmvTvCOeOsgBlA";
      const advancedYearlyPrice = "price_1SmkoxJYaJlmvTvCGynq0ujw";
      
      let requestedTier: string | null = null;
      if (priceId === advancedMonthlyPrice || priceId === advancedYearlyPrice) {
        requestedTier = "advanced";
      } else if (priceId === basicMonthlyPrice || priceId === basicYearlyPrice) {
        requestedTier = "basic";
      }

      // GUARD CHECK 1: Check Stripe API for active subscriptions (source of truth)
      console.log(`[Checkout Validation] Checking Stripe for active subscriptions - email: ${email}`);
      const customersRes = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=10`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${stripeSecret}` },
        }
      );
      
      if (customersRes.ok) {
        const customersData = await customersRes.json();
        const customers = customersData.data || [];
        console.log(`[Checkout Validation] Found ${customers.length} Stripe customer(s) for email ${email}`);
        
        for (const customer of customers) {
          // Fetch all subscriptions and filter for active/trialing
          // Stripe API only accepts single status value, so we use 'all' and filter
          const subscriptionsRes = await fetch(
            `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=all&limit=100`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${stripeSecret}` },
            }
          );
          
          if (subscriptionsRes.ok) {
            const subscriptionsData = await subscriptionsRes.json();
            // Filter to only include active and trialing subscriptions
            const subscriptions = (subscriptionsData.data || []).filter(
              (sub: any) => sub.status === "active" || sub.status === "trialing"
            );
            console.log(`[Checkout Validation] Customer ${customer.id} has ${subscriptions.length} active/trialing subscription(s) out of ${subscriptionsData.data?.length || 0} total`);
            
            if (subscriptions.length > 0) {
              // Check each active subscription
              for (const subscription of subscriptions) {
                const subPriceId = subscription.items?.data?.[0]?.price?.id;
                const subTier = 
                  (subPriceId === advancedMonthlyPrice || subPriceId === advancedYearlyPrice) ? "advanced" :
                  (subPriceId === basicMonthlyPrice || subPriceId === basicYearlyPrice) ? "basic" :
                  null;
                
                console.log(`[Checkout Validation] Found subscription - priceId: ${subPriceId}, tier: ${subTier}, requested: ${priceId}, requestedTier: ${requestedTier}`);
                
                // Block 1: Exact duplicate (same priceId)
                if (subPriceId === priceId) {
                  console.log(`[Checkout Validation] BLOCKED: Exact duplicate subscription (same priceId)`);
                  return new Response(JSON.stringify({ 
                    error: `You already have an active subscription to this exact plan. Please manage your existing subscription.` 
                  }), { 
                    status: 400,
                    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                  });
                }
                
                // Block 2: Same tier (prevents basic_monthly → basic_yearly, etc.)
                if (subTier && requestedTier && subTier === requestedTier) {
                  console.log(`[Checkout Validation] BLOCKED: Same tier subscription (${subTier})`);
                  return new Response(JSON.stringify({ 
                    error: `You already have an active ${subTier} subscription. Please cancel your existing subscription first or upgrade to a different tier.` 
                  }), { 
                    status: 400,
                    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                  });
                }
                
                // Block 3: Downgrade attempt (advanced → basic)
                if (subTier === "advanced" && requestedTier === "basic") {
                  console.log(`[Checkout Validation] BLOCKED: Downgrade attempt (advanced → basic)`);
                  return new Response(JSON.stringify({ 
                    error: `You currently have an Advanced subscription. Please cancel it first before subscribing to Basic.` 
                  }), { 
                    status: 400,
                    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                  });
                }
                
                // Allow: Upgrade (basic → advanced) - no block here, continue checking
                if (subTier === "basic" && requestedTier === "advanced") {
                  console.log(`[Checkout Validation] ALLOWED: Upgrade detected (basic → advanced)`);
                }
              }
            }
          } else {
            const errorText = await subscriptionsRes.text();
            console.warn(`[Checkout Validation] Failed to fetch subscriptions for customer ${customer.id}: ${errorText}`);
          }
        }
      } else {
        const errorText = await customersRes.text();
        console.warn(`[Checkout Validation] Failed to fetch customers from Stripe: ${errorText}`);
      }
      
      // GUARD CHECK 2: Check database (backup validation)
      if (requestedTier) {
        console.log(`[Checkout Validation] Checking database for active subscription - email: ${email}`);
        const userRes = await fetch(
          `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=is_paid,subscription_tier,subscription_end,stripe_customer_id`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          }
        );
        
        if (userRes.ok) {
          const users = await userRes.json();
          if (users && users.length > 0) {
            const user = users[0];
            const currentTier = user.subscription_tier || "free";
            const isPaid = user.is_paid === true;
            const subscriptionEnd = user.subscription_end
              ? new Date(user.subscription_end)
              : null;
            const isActive = isPaid && subscriptionEnd && subscriptionEnd > new Date();
            
            console.log(`[Checkout Validation] Database check - is_paid: ${isPaid}, tier: ${currentTier}, subscription_end: ${subscriptionEnd}, isActive: ${isActive}`);
            
            // Block if active subscription exists (unless upgrading)
            if (isActive) {
              // Allow upgrade (basic → advanced)
              if (currentTier === "basic" && requestedTier === "advanced") {
                // Allow - this is an upgrade
                console.log(`[Checkout Validation] ALLOWED: Upgrade from ${currentTier} to ${requestedTier}`);
              } 
              // Block same tier
              else if (currentTier === requestedTier) {
                console.log(`[Checkout Validation] BLOCKED: Same tier in database (${currentTier})`);
                return new Response(JSON.stringify({ 
                  error: `You already have an active ${currentTier} subscription. Please manage your existing subscription.` 
                }), { 
                  status: 400,
                  headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                });
              }
              // Block downgrade
              else if (currentTier === "advanced" && requestedTier === "basic") {
                console.log(`[Checkout Validation] BLOCKED: Downgrade attempt in database (advanced → basic)`);
                return new Response(JSON.stringify({ 
                  error: `You currently have an Advanced subscription. Please manage your existing subscription.` 
                }), { 
                  status: 400,
                  headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                });
              }
            } else {
              console.log(`[Checkout Validation] No active subscription in database - allowing checkout`);
            }
          }
        } else {
          const errorText = await userRes.text();
          console.warn(`[Checkout Validation] Could not fetch user data from database: ${errorText}`);
        }
      }
      
      console.log(`[Checkout Validation] All validation checks passed - proceeding with checkout`);
    }

    /* --------------------------------------------------
       3️⃣ P1 — Always reuse Stripe customer
    -------------------------------------------------- */
    let stripeCustomerId: string | null = null;

    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(
        email
      )}&select=stripe_customer_id`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (customerRes.ok) {
      const users = await customerRes.json();
      stripeCustomerId = users?.[0]?.stripe_customer_id ?? null;
    }

    /* --------------------------------------------------
       4️⃣ Create Stripe Checkout Session
    -------------------------------------------------- */
    const bodyParams: Record<string, string> = {
      "payment_method_types[0]": "card",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      mode,
      success_url: successUrl || "",
      cancel_url: cancelUrl || "",
    };

    if (stripeCustomerId) {
      bodyParams["customer"] = stripeCustomerId;
    } else {
      bodyParams["customer_email"] = email;
    }

    if (mode === "payment") {
      bodyParams["invoice_creation[enabled]"] = "true";
    }

    // 7-day free trial for subscriptions (test mode)
    if (mode === "subscription") {
      bodyParams["subscription_data[trial_period_days]"] = "7";
      console.log("[Checkout] [TRIAL] 7-day free trial enabled for subscription (card required, first charge after trial)");
    }

    console.log("[Checkout] Creating session with params:", JSON.stringify({ ...bodyParams }, null, 2));

    const checkoutRes = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(bodyParams).toString(),
      }
    );

    if (!checkoutRes.ok) {
      const error = await checkoutRes.text();
      throw new Error(`Stripe checkout error: ${error}`);
    }

    const session = await checkoutRes.json();
    console.log(`[Checkout] [FLOW] Session created: sessionId=${session.id}, mode=${session.mode || mode}`);

    return new Response(JSON.stringify({ sessionId: session.id }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Checkout error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
});
