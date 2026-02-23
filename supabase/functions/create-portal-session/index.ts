import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: "Stripe is not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Get current user from JWT via Auth API
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": authHeader,
        "apikey": serviceRoleKey,
      },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const authUser = await userRes.json();
    const email = authUser?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "User email not found" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Get stripe_customer_id from public.users
    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=stripe_customer_id`,
      {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      }
    );
    if (!usersRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to load subscription" }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    const users = await usersRes.json();
    const stripeCustomerId = users?.[0]?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      return new Response(
        JSON.stringify({ error: "No billing account found. Subscribe first to manage your subscription." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Optional return URL from body (default: current origin)
    let returnUrl = `${req.headers.get("origin") ?? "https://yieldcanary.com"}/`;
    try {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.returnUrl === "string" && body.returnUrl) {
        returnUrl = body.returnUrl;
      }
    } catch {
      // keep default returnUrl
    }

    // Create Stripe Billing Portal session
    const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: stripeCustomerId,
        return_url: returnUrl,
      }).toString(),
    });

    if (!portalRes.ok) {
      const errText = await portalRes.text();
      console.error("Stripe portal error:", errText);
      return new Response(JSON.stringify({ error: "Could not open billing portal" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const portal = await portalRes.json();
    const url = portal.url;
    if (!url) {
      return new Response(JSON.stringify({ error: "No portal URL returned" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (e) {
    console.error("create-portal-session error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
