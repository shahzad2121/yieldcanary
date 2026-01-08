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
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  try {
    const { priceId, email, successUrl, cancelUrl } = await req.json();

    if (!priceId) {
      return new Response(JSON.stringify({ error: "Missing priceId" }), { 
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    }

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!stripeSecret) {
      throw new Error("STRIPE_SECRET_KEY not set");
    }

    // Fetch price details from Stripe to determine if it's recurring or one-time
    const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${stripeSecret}`,
      },
    });

    if (!priceRes.ok) {
      const error = await priceRes.text();
      console.error("Stripe price fetch error:", error);
      throw new Error(`Failed to fetch price details: ${error}`);
    }

    const priceData = await priceRes.json();
    const isRecurring = priceData.type === "recurring";
    const mode = isRecurring ? "subscription" : "payment";

    console.log(`[Checkout] Price ${priceId} is ${priceData.type}, using mode: ${mode}`);
   
    // Validate: Prevent subscribing if user already has active subscription
    if (mode === "subscription" && email) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
      
      if (supabaseUrl && serviceRoleKey) {
        // Map priceId to tier
        const basicMonthlyPrice = Deno.env.get("VITE_BASIC_MONTHLY_PRICE") || Deno.env.get("BASIC_MONTHLY_PRICE") || "";
        const basicYearlyPrice = Deno.env.get("VITE_BASIC_YEARLY_PRICE") || Deno.env.get("BASIC_YEARLY_PRICE") || "";
        const advancedMonthlyPrice = Deno.env.get("VITE_ADVANCED_MONTHLY_PRICE") || Deno.env.get("ADVANCED_MONTHLY_PRICE") || "";
        const advancedYearlyPrice = Deno.env.get("VITE_ADVANCED_YEARLY_PRICE") || Deno.env.get("ADVANCED_YEARLY_PRICE") || "";
        
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
            }
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
                }
              );
              
              if (subscriptionsRes.ok) {
                const subscriptionsData = await subscriptionsRes.json();
                const subscriptions = (subscriptionsData.data || []).filter(
                  (sub: any) => sub.status === "active" || sub.status === "trialing"
                );
                
                if (subscriptions.length > 0) {
                  for (const subscription of subscriptions) {
                    const subPriceId = subscription.items?.data?.[0]?.price?.id;
                    const subTier = 
                      (subPriceId === advancedMonthlyPrice || subPriceId === advancedYearlyPrice) ? "advanced" :
                      (subPriceId === basicMonthlyPrice || subPriceId === basicYearlyPrice) ? "basic" :
                      null;
                    
                    // Block 1: Exact duplicate (same priceId)
                    if (subPriceId === priceId) {
                      return new Response(JSON.stringify({ 
                        error: `You already have an active subscription to this exact plan. Please manage your existing subscription.` 
                      }), { 
                        status: 400,
                        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                      });
                    }
                    
                    // Block 2: Same tier (prevents basic_monthly → basic_yearly, etc.)
                    if (subTier && requestedTier && subTier === requestedTier) {
                      return new Response(JSON.stringify({ 
                        error: `You already have an active ${subTier} subscription. Please cancel your existing subscription first or upgrade to a different tier.` 
                      }), { 
                        status: 400,
                        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                      });
                    }
                    
                    // Block 3: Downgrade attempt (advanced → basic)
                    if (subTier === "advanced" && requestedTier === "basic") {
                      return new Response(JSON.stringify({ 
                        error: `You currently have an Advanced subscription. Please cancel it first before subscribing to Basic.` 
                      }), { 
                        status: 400,
                        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                      });
                    }
                  }
                }
              }
            }
          }
          
          // GUARD CHECK 2: Check database (backup validation)
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
              
              // Block if active subscription exists (unless upgrading)
              if (isActive) {
                // Allow upgrade (basic → advanced)
                if (currentTier === "basic" && requestedTier === "advanced") {
                  // Allow - this is an upgrade
                } 
                // Block same tier
                else if (currentTier === requestedTier) {
                  return new Response(JSON.stringify({ 
                    error: `You already have an active ${currentTier} subscription. Please manage your existing subscription.` 
                  }), { 
                    status: 400,
                    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                  });
                }
                // Block downgrade
                else if (currentTier === "advanced" && requestedTier === "basic") {
                  return new Response(JSON.stringify({ 
                    error: `You currently have an Advanced subscription. Please manage your existing subscription.` 
                  }), { 
                    status: 400,
                    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                  });
                }
              }
            }
          }
        }
      } else {
        console.warn(`[Checkout] Missing SUPABASE_URL or SERVICE_ROLE_KEY. Skipping subscription validation.`);
      }
    }

    // Reuse existing Stripe customer ID if available
    let stripeCustomerId: string | null = null;
    if (email) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
      
      if (supabaseUrl && serviceRoleKey) {
        const customerRes = await fetch(
          `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=stripe_customer_id`,
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
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }
});
