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

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? "";
    if (!stripeSecret) {
      throw new Error("STRIPE_SECRET_KEY_TEST not set");
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

    // Create Stripe checkout session
    const bodyParams: Record<string, string> = {
      "payment_method_types[0]": "card",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "mode": mode,
      "success_url": successUrl || "",
      "cancel_url": cancelUrl || "",
      ...(email ? { "customer_email": email } : {}),
    };

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

