// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Deno-compatible Stripe webhook handler using fetch
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
      },
    });
  }

  console.log("[Stripe Webhook] Event received");
  console.log("[Webhook] SERVICE_ROLE_KEY present:", serviceRoleKey ? "yes" : "NO - MISSING!");
  console.log("[Webhook] SUPABASE_URL:", supabaseUrl);
  console.log("[Webhook] STRIPE_SECRET_KEY present:", stripeSecret ? "yes" : "NO - MISSING!");
  
  // Parse raw body and signature
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  console.log("[Webhook] Stripe signature present:", sig ? "yes" : "NO - MISSING!");

  // Parse event (skip signature verification for now to debug)
  let event;
  try {
    event = JSON.parse(rawBody);
    console.log("[Webhook] Event type:", event.type);
    console.log("[Webhook] Event ID:", event.id);
  } catch (err) {
    console.error("[Webhook] Error parsing Stripe event:", err);
    return new Response(JSON.stringify({ error: "Invalid Stripe event" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Handle one-time payment (checkout.session.completed)
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_email;

    console.log("[Webhook] Checkout completed for:", customerEmail);

    if (customerEmail) {
      // Update user's payment status in Supabase
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(customerEmail)}`, {
        method: "PATCH",
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          is_paid: true,
          subscription_tier: "basic",
          updated_at: new Date().toISOString(),
        })
      });

      console.log("[Webhook] Update response status:", updateRes.status);
      
      if (updateRes.ok) {
        console.log(`[Webhook] User ${customerEmail} payment status updated to is_paid=true.`);
        
        // Send transactional email via template system
        // Fetch user from database to get real first name
        const userRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(customerEmail)}&select=username,name`, {
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        });

        let firstName = customerEmail.split('@')[0]; // Fallback to email extraction
        if (userRes.ok) {
          const users = await userRes.json();
          if (users && users.length > 0) {
            // Prefer username, then name, then fallback to email extraction
            firstName = users[0].username || users[0].name || firstName;
          }
        }
        
        console.log("[Webhook] Sending payment receipt email to:", customerEmail);
        
        // Call the send-email edge function (same as client-side does)
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`, // Use service role key for internal calls
          },
          body: JSON.stringify({
            to: customerEmail,
            templateId: 'payment_receipt',  // Use the template ID
            data: {
              first_name: firstName,  // Pass first name for personalization
            },
          }),
        });
        
        console.log("[Webhook] Email API response status:", emailRes.status);
        
        if (emailRes.ok) {
          const emailResult = await emailRes.json();
          console.log(`[Webhook] Payment receipt email sent successfully via template.`);
        } else {
          const errText = await emailRes.text();
          console.error("[Webhook] Error sending payment receipt email:", errText);
        }
      } else {
        const errText = await updateRes.text();
        console.error(`[Webhook] Error updating user payment status:`, errText);
      }
    }
  }
  if (["customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
    const subscription = event.data.object;
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

    // Fetch customer email from Stripe API
    let email = "";
    if (customerId) {
      const stripeRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
        headers: {
          "Authorization": `Bearer ${stripeSecret}`,
        },
      });
      if (stripeRes.ok) {
        const customer = await stripeRes.json();
        email = customer.email;
      }
    }

    if (email) {
      // Update user's subscription status in Supabase
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          is_paid: true,
          subscription_tier: "basic", // TODO: map price to tier
          updated_at: new Date().toISOString(),
        })
      });
      if (updateRes.ok) {
        console.log(`User ${email} subscription updated.`);
        // Send transactional email via template system with conditional logic
        // Fetch user from database to get real first name
        const userRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=username,name`, {
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        });

        let firstName = email.split('@')[0]; // Fallback to email extraction
        if (userRes.ok) {
          const users = await userRes.json();
          if (users && users.length > 0) {
            // Prefer username, then name, then fallback to email extraction
            firstName = users[0].username || users[0].name || firstName;
          }
        }
        
        // Choose template based on event type
        // - customer.subscription.created → payment_receipt (new subscription = payment confirmation)
        // - customer.subscription.updated → access_upgraded (subscription change = access upgrade)
        const templateId = event.type === "customer.subscription.created" 
          ? 'payment_receipt' 
          : 'access_upgraded';
        
        console.log(`[Webhook] Sending ${templateId} email to ${email} for event: ${event.type}`);
        
        // Call the send-email edge function
       
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            to: email,
            templateId: templateId,
            data: {
              first_name: firstName,
            },
          }),
        });
        
        if (emailRes.ok) {
          console.log(`Transactional email (${templateId}) sent to ${email} via template.`);
        } else {
          const errText = await emailRes.text();
          console.error("Error sending transactional email:", errText);
        }
      } else {
        const errText = await updateRes.text();
        console.error("Error updating user subscription:", errText);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});