// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {
  getSupabaseConfig,
  getUserByEmail,
  getUserIdByEmail,
  getStripeCustomerEmail,
  updateUserSubscriptionFromStripe,
  downgradeUserToFree,
  sendTransactionalEmail,
  createPriceIdToTierMapper,
  type EmailType,
} from "./stripe-webhook-helpers.ts";

// Deno-compatible Stripe webhook handler using fetch
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") ?? "";
const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

// Test environment price IDs (hardcoded to match checkout)
const basicMonthlyPrice = "price_1SkSYWJYaJlmvTvCIy15xocG";
const basicYearlyPrice = "price_1Sn62YJYaJlmvTvCNWddZaeG";
const advancedMonthlyPrice = "price_1Sn63DJYaJlmvTvCOeOsgBlA";
const advancedYearlyPrice = "price_1SmkoxJYaJlmvTvCGynq0ujw";

// Create price ID to tier mapper
const priceIdToTier = createPriceIdToTierMapper(
  basicMonthlyPrice,
  basicYearlyPrice,
  advancedMonthlyPrice,
  advancedYearlyPrice
);

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

  console.log("[Stripe Webhook] [FLOW] Event received (TEST webhook)");
  console.log("[Webhook] [FLOW] SERVICE_ROLE_KEY present:", serviceRoleKey ? "yes" : "NO - MISSING!");
  console.log("[Webhook] [FLOW] SUPABASE_URL:", supabaseUrl ? "set" : "MISSING");
  console.log("[Webhook] [FLOW] STRIPE_SECRET_KEY present:", stripeSecret ? "yes" : "NO - MISSING!");
  
  // Parse raw body and signature
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  console.log("[Webhook] [FLOW] Stripe signature present:", sig ? "yes" : "NO - MISSING!");

  // Parse event (skip signature verification for now to debug)
  let event;
  try {
    event = JSON.parse(rawBody);
    console.log("[Webhook] [FLOW] Event type:", event.type, "Event ID:", event.id);
  } catch (err) {
    console.error("[Webhook] Error parsing Stripe event:", err);
    return new Response(JSON.stringify({ error: "Invalid Stripe event" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Handle one-time payment (checkout.session.completed)
  // For subscriptions, customer.subscription.created will handle it
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_email;
    const mode = session.mode; // "subscription" or "payment"

    console.log("[Webhook] [FLOW] checkout.session.completed - email:", customerEmail, "mode:", mode, "subscription:", session.subscription || "n/a");

    // For subscriptions, skip email - customer.subscription.created will handle it
    // Only send email for one-time payments (mode === "payment")
    if (mode === "subscription") {
      console.log("[Webhook] [FLOW] Subscription checkout - user will be updated by customer.subscription.created (may be trialing)");
      
      // Still update user's payment status in Supabase (minimal update, full update happens in subscription.created)
      if (customerEmail) {
        const sessionCustomerId = typeof session.customer === "string"
          ? session.customer
          : session.customer?.id || null;
        
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
            stripe_customer_id: sessionCustomerId,
            updated_at: new Date().toISOString(),
          })
        });
        console.log("[Webhook] Subscription user status updated:", updateRes.status);
      }
    } else {
      // One-time payment - send email from here
      // Fetch invoice details if available
      let invoicePdfUrl = "";
      let invoicePdfDownloadUrl = "";
      let invoiceNumber = "";
      const invoiceId = session.invoice;
      if (invoiceId && typeof invoiceId === 'string') {
        try {
          const invoiceRes = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}`, {
            headers: {
              "Authorization": `Bearer ${stripeSecret}`,
            },
          });
          if (invoiceRes.ok) {
            const invoice = await invoiceRes.json();
            invoicePdfUrl = invoice.hosted_invoice_url || invoice.invoice_pdf || "";
            invoicePdfDownloadUrl = invoice.invoice_pdf || "";
            invoiceNumber = invoice.number || invoice.id || "";
            console.log("[Webhook] Invoice PDF URL retrieved:", invoicePdfUrl ? "yes" : "no");
          }
        } catch (invoiceError) {
          console.error("[Webhook] Error fetching invoice:", invoiceError);
        }
      }

      if (customerEmail) {
        const sessionCustomerId = typeof session.customer === "string"
          ? session.customer
          : session.customer?.id || null;
        
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
            stripe_customer_id: sessionCustomerId,
            updated_at: new Date().toISOString(),
          })
        });

        console.log("[Webhook] Update response status:", updateRes.status);
        
        if (updateRes.ok) {
          console.log(`[Webhook] User ${customerEmail} payment status updated to is_paid=true.`);
          
          // Get user ID and first name for email
          const user = await getUserByEmail(supabaseUrl, serviceRoleKey, customerEmail, "id,name,username");
          const userId = user?.id;
          const firstName = user?.name || user?.username || customerEmail.split('@')[0];
          
          // Download invoice PDF and convert to base64 for attachment
          let attachments: { filename: string; content: string }[] = [];
          if (invoicePdfDownloadUrl) {
            try {
              console.log(`[Webhook] Downloading invoice PDF from: ${invoicePdfDownloadUrl}`);
              const pdfResponse = await fetch(invoicePdfDownloadUrl);
              
              if (pdfResponse.ok) {
                const pdfBuffer = await pdfResponse.arrayBuffer();
                const pdfBytes = new Uint8Array(pdfBuffer);
                
                // Convert to base64
                let binary = '';
                for (let i = 0; i < pdfBytes.length; i++) {
                  binary += String.fromCharCode(pdfBytes[i]);
                }
                const pdfBase64 = btoa(binary);
                
                attachments = [{
                  filename: `YieldCanary-Invoice-${invoiceNumber}.pdf`,
                  content: pdfBase64,
                }];
                console.log(`[Webhook] Invoice PDF downloaded and encoded, size: ${pdfBytes.length} bytes`);
              } else {
                console.error(`[Webhook] Failed to download invoice PDF: ${pdfResponse.status}`);
              }
            } catch (pdfError) {
              console.error("[Webhook] Error downloading invoice PDF:", pdfError);
            }
          }
          
          // Send email using helper function (logs automatically)
          if (userId) {
            await sendTransactionalEmail(
              supabaseUrl,
              serviceRoleKey,
              userId,
              customerEmail,
              'payment_receipt' as EmailType, // Using payment_receipt as email type for one-time payments
              'payment_receipt',
              {
                first_name: firstName,
                invoice_pdf_url: invoicePdfUrl,
              },
              attachments
            );
          }
        } else {
          const errText = await updateRes.text();
          console.error(`[Webhook] Error updating user payment status:`, errText);
        }
      }
    }
  }
  // ----- customer.subscription.deleted: downgrade user when subscription is removed -----
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
    console.log("[Webhook] [FLOW] customer.subscription.deleted - subscriptionId:", subscription.id, "customerId:", customerId);

    const email = customerId ? await getStripeCustomerEmail(customerId, stripeSecret) : null;

    if (email) {
      console.log("[Webhook] [TRIAL/DOWNGRADE] Downgrading user (subscription deleted):", email);
      
      // Downgrade user using helper
      const downgraded = await downgradeUserToFree(supabaseUrl, serviceRoleKey, email);
      
      if (downgraded) {
        console.log("[Webhook] [TRIAL/DOWNGRADE] User downgraded to free:", email);
        
        // Send subscription cancelled email
        const user = await getUserByEmail(supabaseUrl, serviceRoleKey, email, "id,name,username,subscription_tier");
        if (user?.id) {
          const firstName = user.name || user.username || email.split('@')[0];
          const previousTier = user.subscription_tier || "free";
          
          await sendTransactionalEmail(
            supabaseUrl,
            serviceRoleKey,
            user.id,
            email,
            'subscription_cancelled',
            'subscription_cancelled',
            {
              first_name: firstName,
              tier: previousTier,
            }
          );
        }
      } else {
        console.error("[Webhook] [TRIAL/DOWNGRADE] Failed to downgrade user:", email);
      }
    } else {
      console.warn("[Webhook] [FLOW] customer.subscription.deleted: could not resolve email for customerId:", customerId);
    }
  }

  if (["customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
    const subscription = event.data.object;
    const subscriptionId = subscription.id;
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

    // Step 1: Get the price ID from Stripe subscription to determine NEW tier
    const priceId = subscription.items?.data?.[0]?.price?.id;
    
    console.log(`[Webhook] [FLOW] subscription event - priceId: ${priceId}, subscriptionId: ${subscriptionId}`);
    
    // Step 2: Map price ID to tier using helper function
    const newTier = priceIdToTier(priceId);
    console.log(`[Webhook] Mapped priceId ${priceId} to tier: ${newTier}`);

    // Fetch full subscription details from Stripe API to get current_period_start/end
    // (webhook payload may not include these fields)
    let fullSubscription = subscription;
    if (subscriptionId) {
      try {
        const subscriptionRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: {
            "Authorization": `Bearer ${stripeSecret}`,
          },
        });
        if (subscriptionRes.ok) {
          fullSubscription = await subscriptionRes.json();
          console.log("[Webhook] [FLOW] Fetched full subscription from Stripe API");
        } else {
          console.warn("[Webhook] Failed to fetch full subscription, using webhook payload");
        }
      } catch (subError) {
        console.error("[Webhook] Error fetching subscription:", subError);
      }
    }

    const subStatus = fullSubscription.status || subscription.status || "";
    const trialStart = fullSubscription.trial_start ?? subscription.trial_start;
    const trialEnd = fullSubscription.trial_end ?? subscription.trial_end;
    console.log("[Webhook] [FLOW] Subscription status:", subStatus, "trial_start:", trialStart ? new Date(trialStart * 1000).toISOString() : "none", "trial_end:", trialEnd ? new Date(trialEnd * 1000).toISOString() : "none");

    const isActiveOrTrialing = subStatus === "active" || subStatus === "trialing";
    if (!isActiveOrTrialing) {
      console.log("[Webhook] [TRIAL/DOWNGRADE] Subscription not active/trialing (status=" + subStatus + ") - will downgrade user if we have email");
    }

    // Fetch customer email from Stripe API using helper
    const email = customerId ? await getStripeCustomerEmail(customerId, stripeSecret) : null;
    
    // Fetch invoice PDF URL from subscription's latest invoice
    let invoicePdfUrl = "";
    let invoicePdfDownloadUrl = "";
    let invoiceNumber = "";
    const invoiceId = subscription.latest_invoice;
    if (customerId && invoiceId && typeof invoiceId === 'string') {
      try {
        const invoiceRes = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}`, {
          headers: {
            "Authorization": `Bearer ${stripeSecret}`,
          },
        });
        if (invoiceRes.ok) {
          const invoice = await invoiceRes.json();
          invoicePdfUrl = invoice.hosted_invoice_url || invoice.invoice_pdf || "";
          invoicePdfDownloadUrl = invoice.invoice_pdf || "";
          invoiceNumber = invoice.number || invoice.id || "";
          console.log("[Webhook] Invoice PDF URL retrieved:", invoicePdfUrl ? "yes" : "no");
        }
      } catch (invoiceError) {
        console.error("[Webhook] Error fetching invoice:", invoiceError);
      }
    }

    if (email) {
      // Step 3: Get PREVIOUS tier from database (only for subscription.updated)
      let previousTier = "free";
      let previousStatus: string | null = null;
      let wasTrialing = false;
      if (event.type === "customer.subscription.updated") {
        const user = await getUserByEmail(supabaseUrl, serviceRoleKey, email, "subscription_tier,subscription_status,trial_ends_at");
        if (user) {
          previousTier = user.subscription_tier || "free";
          previousStatus = user.subscription_status || null;
          // Access trial_ends_at from the raw user object (not typed in User interface)
          wasTrialing = previousStatus === "trialing" && !!(user as any).trial_ends_at;
        }
      }
      console.log("[Webhook] [FLOW] previousTier:", previousTier, "previousStatus:", previousStatus, "newTier:", newTier, "isActiveOrTrialing:", isActiveOrTrialing);

      if (isActiveOrTrialing) {
        // Step 4a: Grant access (active or trialing) - update user with tier and period dates
        const periodStart = fullSubscription.current_period_start 
          || fullSubscription.items?.data?.[0]?.current_period_start
          || subscription.current_period_start
          || null;
        const periodEnd = fullSubscription.current_period_end
          || fullSubscription.items?.data?.[0]?.current_period_end
          || subscription.current_period_end
          || null;
        
        const subscriptionStart = periodStart
          ? new Date(periodStart * 1000).toISOString()
          : null;
        const subscriptionEnd = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null;

        const trialEndsAt = subStatus === "trialing" && trialEnd
          ? new Date(trialEnd * 1000).toISOString()
          : null;
        
        console.log("[Webhook] [FLOW] Granting access - subscription_start:", subscriptionStart, "subscription_end:", subscriptionEnd, "status:", subStatus, "trial_ends_at:", trialEndsAt);
        
        // Use helper function to update subscription
        const updated = await updateUserSubscriptionFromStripe(
          supabaseUrl,
          serviceRoleKey,
          email,
          {
            id: subscriptionId,
            status: subStatus,
            customer: customerId || "",
            items: subscription.items,
            trial_start: trialStart,
            trial_end: trialEnd,
            current_period_start: periodStart,
            current_period_end: periodEnd,
          },
          priceIdToTier
        );
        
        if (updated) {
          console.log("[Webhook] ✅ User", email, "subscription updated (access granted). Tier:", newTier, "Previous:", previousTier);
          
          // Get user details for emails
          const user = await getUserByEmail(supabaseUrl, serviceRoleKey, email, "id,name,username,subscription_status,trial_converted_to_paid");
          const userId = user?.id;
          const firstName = user?.name || user?.username || email.split('@')[0];
          
          if (userId) {
            // Download invoice PDF for attachment
            let attachments: { filename: string; content: string }[] = [];
            if (invoicePdfDownloadUrl) {
              try {
                console.log(`[Webhook] Downloading invoice PDF from: ${invoicePdfDownloadUrl}`);
                const pdfResponse = await fetch(invoicePdfDownloadUrl);
                
                if (pdfResponse.ok) {
                  const pdfBuffer = await pdfResponse.arrayBuffer();
                  const pdfBytes = new Uint8Array(pdfBuffer);
                  
                  // Convert to base64
                  let binary = '';
                  for (let i = 0; i < pdfBytes.length; i++) {
                    binary += String.fromCharCode(pdfBytes[i]);
                  }
                  const pdfBase64 = btoa(binary);
                  
                  attachments = [{
                    filename: `YieldCanary-Invoice-${invoiceNumber}.pdf`,
                    content: pdfBase64,
                  }];
                  console.log(`[Webhook] Invoice PDF downloaded and encoded, size: ${pdfBytes.length} bytes`);
                } else {
                  console.error(`[Webhook] Failed to download invoice PDF: ${pdfResponse.status}`);
                }
              } catch (pdfError) {
                console.error("[Webhook] Error downloading invoice PDF:", pdfError);
              }
            }
            
            // Handle trial started email (subscription.created with trialing status)
            if (event.type === "customer.subscription.created" && subStatus === "trialing") {
              await sendTransactionalEmail(
                supabaseUrl,
                serviceRoleKey,
                userId,
                email,
                'trial_started',
                'trial_started',
                {
                  first_name: firstName,
                  trial_end_date: trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : "",
                }
              );
            }
            
            // Handle trial converted to paid (subscription.updated: trialing → active)
            if (event.type === "customer.subscription.updated" && wasTrialing && subStatus === "active" && !user?.trial_converted_to_paid) {
              await sendTransactionalEmail(
                supabaseUrl,
                serviceRoleKey,
                userId,
                email,
                'trial_converted_to_paid',
                'trial_converted_to_paid',
                {
                  first_name: firstName,
                  tier: newTier,
                }
              );
            }
            
            // Handle payment receipt (subscription.created, not trialing) or upgrade email
            const shouldSendUpgradeEmail = 
              event.type === "customer.subscription.updated" && 
              previousTier === "basic" && 
              newTier === "advanced";
            
            if (event.type === "customer.subscription.created" && subStatus !== "trialing") {
              // Payment receipt for non-trial subscription creation
              await sendTransactionalEmail(
                supabaseUrl,
                serviceRoleKey,
                userId,
                email,
                'payment_receipt' as EmailType,
                'payment_receipt',
                {
                  first_name: firstName,
                  invoice_pdf_url: invoicePdfUrl,
                },
                attachments
              );
            } else if (shouldSendUpgradeEmail) {
              // Upgrade email
              await sendTransactionalEmail(
                supabaseUrl,
                serviceRoleKey,
                userId,
                email,
                'access_upgraded' as EmailType,
                'access_upgraded',
                {
                  first_name: firstName,
                  invoice_pdf_url: invoicePdfUrl,
                },
                attachments
              );
            }
          }
        } else {
          console.error(`[Webhook] ❌ Error updating user subscription for ${email}`);
        }
      } else {
        // Step 4b: Downgrade - subscription canceled / past_due / unpaid
        console.log("[Webhook] [TRIAL/DOWNGRADE] Downgrading user (subscription status=" + subStatus + "):", email);
        
        const downgraded = await downgradeUserToFree(supabaseUrl, serviceRoleKey, email);
        
        if (downgraded) {
          console.log("[Webhook] [TRIAL/DOWNGRADE] User downgraded to free:", email);
        } else {
          console.error("[Webhook] [TRIAL/DOWNGRADE] Failed to downgrade:", email);
        }
      }
    }
  }

  // Handle subscription renewal (invoice.payment_succeeded)
  if (event.type === "invoice.payment_succeeded") {
    console.log(`[Webhook] [FLOW] invoice.payment_succeeded received`);
    const invoice = event.data.object;
    
    // Extract subscription ID - can be direct or nested in parent.subscription_details
    const subscriptionId = invoice.subscription || 
                          (invoice.parent as any)?.subscription_details?.subscription ||
                          null;
    
    console.log(`[Webhook] invoice.subscription (direct):`, invoice.subscription);
    console.log(`[Webhook] invoice.subscription (nested):`, (invoice.parent as any)?.subscription_details?.subscription);
    console.log(`[Webhook] Extracted subscriptionId:`, subscriptionId);
    console.log(`[Webhook] invoice.billing_reason:`, invoice.billing_reason);
    console.log(`[Webhook] invoice.customer:`, invoice.customer);
    console.log(`[Webhook] invoice.id:`, invoice.id);
    
    // Only process subscription renewals (not first payment or one-time payments)
    // billing_reason: "subscription_cycle" = renewal, "subscription_create" = first payment
    if (subscriptionId && invoice.billing_reason === "subscription_cycle") {
      console.log(`[Webhook] Processing renewal - conditions met`);
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;
      console.log(`[Webhook] Extracted customerId:`, customerId);

      // Get invoice PDF URL directly from the event
      let email = "";
      let invoicePdfUrl = invoice.hosted_invoice_url || invoice.invoice_pdf || "";
      const invoicePdfDownloadUrl = invoice.invoice_pdf || ""; // Direct PDF download URL

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
        console.log(`[Webhook] Subscription renewal payment succeeded for: ${email}`);
        
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
            // Prefer name (first name), then username, then fallback to email extraction
            firstName = users[0].name || users[0].username || firstName;
          }
        }
        
        console.log(`[Webhook] Sending renewal receipt email to: ${email}`);
        
        // Download invoice PDF and convert to base64 for attachment
        let attachments: { filename: string; content: string }[] = [];
        if (invoicePdfDownloadUrl) {
          try {
            console.log(`[Webhook] Downloading invoice PDF from: ${invoicePdfDownloadUrl}`);
            const pdfResponse = await fetch(invoicePdfDownloadUrl);
            
            if (pdfResponse.ok) {
              const pdfBuffer = await pdfResponse.arrayBuffer();
              const pdfBytes = new Uint8Array(pdfBuffer);
              
              // Convert to base64 using Deno's built-in encoder
              let binary = '';
              for (let i = 0; i < pdfBytes.length; i++) {
                binary += String.fromCharCode(pdfBytes[i]);
              }
              const pdfBase64 = btoa(binary);
              
              attachments = [{
                filename: `YieldCanary-Invoice-${invoice.number || invoice.id}.pdf`,
                content: pdfBase64,
              }];
              console.log(`[Webhook] Invoice PDF downloaded and encoded, size: ${pdfBytes.length} bytes`);
            } else {
              console.error(`[Webhook] Failed to download invoice PDF: ${pdfResponse.status}`);
            }
          } catch (pdfError) {
            console.error("[Webhook] Error downloading invoice PDF:", pdfError);
            // Continue without attachment - the link is still in the email
          }
        }
        
        // Send subscription renewal email with PDF attachment
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            to: email,
            templateId: 'subscription_renewal',
            data: {
              first_name: firstName,
              invoice_pdf_url: invoicePdfUrl, // Keep link as backup
            },
            attachments: attachments, // Attach PDF if downloaded successfully
          }),
        });
        
        if (emailRes.ok) {
          console.log(`[Webhook] Renewal receipt email sent successfully to ${email} with ${attachments.length} attachment(s).`);
        } else {
          const errText = await emailRes.text();
          console.error("[Webhook] Error sending renewal receipt email:", errText);
        }
      }
    } else {
      console.log(`[Webhook] Skipping - subscription: ${!!subscriptionId}, billing_reason: ${invoice.billing_reason}`);
    }
  }

  // ----- invoice.payment_failed: send payment failed email (downgrade happens via subscription.updated/deleted) -----
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    const subscriptionId = invoice.subscription;
    
    console.log("[Webhook] [FLOW] invoice.payment_failed - invoiceId:", invoice.id, "customerId:", customerId, "subscription:", subscriptionId || "none");
    
    // Only send email for subscription payments (not one-time payments)
    if (subscriptionId && customerId) {
      const email = await getStripeCustomerEmail(customerId, stripeSecret);
      
      if (email) {
        const user = await getUserByEmail(supabaseUrl, serviceRoleKey, email, "id,name,username");
        const userId = user?.id;
        
        if (userId) {
          const firstName = user?.name || user?.username || email.split('@')[0];
          
          await sendTransactionalEmail(
            supabaseUrl,
            serviceRoleKey,
            userId,
            email,
            'payment_failed',
            'payment_failed',
            {
              first_name: firstName,
              invoice_id: invoice.id,
              amount_due: invoice.amount_due ? (invoice.amount_due / 100).toFixed(2) : "0.00",
            }
          );
        }
      }
    }
  }

  console.log("[Webhook] [FLOW] Returning 200 for event type:", event.type);
  return new Response(JSON.stringify({ received: true }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});