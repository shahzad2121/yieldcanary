// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Deno-compatible Stripe webhook handler using fetch
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") ?? "";
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
  // For subscriptions, customer.subscription.created will send the email
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_email;
    const mode = session.mode; // "subscription" or "payment"

    console.log("[Webhook] Checkout completed for:", customerEmail, "Mode:", mode);

    // For subscriptions, skip email - customer.subscription.created will handle it
    // Only send email for one-time payments (mode === "payment")
    if (mode === "subscription") {
      console.log("[Webhook] Subscription checkout - skipping email (customer.subscription.created will send it)");
      
      // Still update user's payment status in Supabase
      if (customerEmail) {
        // Extract customer ID from session (can be string or object)
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
        // Extract customer ID from session (can be string or object)
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
              // Prefer name (first name), then username, then fallback to email extraction
              firstName = users[0].name || users[0].username || firstName;
            }
          }
          
          console.log("[Webhook] Sending payment receipt email to:", customerEmail);
          
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
          
          // Call the send-email edge function with PDF attachment
          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              to: customerEmail,
              templateId: 'payment_receipt',
              data: {
                first_name: firstName,
                invoice_pdf_url: invoicePdfUrl,
              },
              attachments: attachments,
            }),
          });
          
          console.log("[Webhook] Email API response status:", emailRes.status);
          
          if (emailRes.ok) {
            const emailResult = await emailRes.json();
            console.log(`[Webhook] Payment receipt email sent successfully with ${attachments.length} attachment(s).`);
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
  }
  if (["customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
    const subscription = event.data.object;
    const subscriptionId = subscription.id;
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

    // Step 1: Get the price ID from Stripe subscription to determine NEW tier
    const priceId = subscription.items?.data?.[0]?.price?.id;
    
    console.log(`[Webhook] Received priceId: ${priceId}`);
    
    // Step 2: Map price ID to tier (basic or advanced) - using hardcoded values to match checkout
    const basicMonthlyPrice = "price_1SkSYWJYaJlmvTvCIy15xocG";
    const basicYearlyPrice = "price_1Sn62YJYaJlmvTvCNWddZaeG";
    const advancedMonthlyPrice = "price_1Sn63DJYaJlmvTvCOeOsgBlA";
    const advancedYearlyPrice = "price_1SmkoxJYaJlmvTvCGynq0ujw";
    
    let newTier = "basic"; // default
    if (priceId === advancedMonthlyPrice || priceId === advancedYearlyPrice) {
      newTier = "advanced";
      console.log(`[Webhook] Mapped priceId ${priceId} to tier: advanced`);
    } else if (priceId === basicMonthlyPrice || priceId === basicYearlyPrice) {
      newTier = "basic";
      console.log(`[Webhook] Mapped priceId ${priceId} to tier: basic`);
    } else {
      console.warn(`[Webhook] WARNING: PriceId ${priceId} did not match any known price IDs. Defaulting to basic.`);
    }

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
          console.log("[Webhook] Fetched full subscription details from Stripe API");
        } else {
          console.warn("[Webhook] Failed to fetch full subscription, using webhook payload");
        }
      } catch (subError) {
        console.error("[Webhook] Error fetching subscription:", subError);
      }
    }

    // Fetch customer email from Stripe API
    let email = "";
    let invoicePdfUrl = "";
    let invoicePdfDownloadUrl = "";
    let invoiceNumber = "";

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

      // Fetch invoice PDF URL from subscription's latest invoice
      const invoiceId = subscription.latest_invoice;
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
    }

    if (email) {
      // Step 3: Get PREVIOUS tier from database (only for subscription.updated)
      let previousTier = "free";
      if (event.type === "customer.subscription.updated") {
        const currentUserRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=subscription_tier`, {
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        });
        if (currentUserRes.ok) {
          const currentUsers = await currentUserRes.json();
          if (currentUsers && currentUsers.length > 0) {
            previousTier = currentUsers[0].subscription_tier || "free";
          }
        }
      }

      // Step 4: Update user's subscription status in Supabase with CORRECT tier
      // Extract subscription dates from Stripe (Unix timestamps in seconds)
      // Try full subscription first, then fallback to items.data[0], then webhook payload
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
      
      console.log("[Webhook] Subscription dates - start:", subscriptionStart, "end:", subscriptionEnd);
      console.log(`[Webhook] Updating database - email: ${email}, previousTier: ${previousTier}, newTier: ${newTier}, eventType: ${event.type}`);
      
      const updateData = {
        is_paid: true,
        subscription_tier: newTier, // Use the mapped tier, not hardcoded "basic"
        stripe_customer_id: customerId || null,
        subscription_start: subscriptionStart,
        subscription_end: subscriptionEnd,
        updated_at: new Date().toISOString(),
      };
      
      console.log(`[Webhook] Database update payload:`, JSON.stringify(updateData, null, 2));
      
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(updateData),
      });
      
      if (updateRes.ok) {
        const updatedUser = await updateRes.json();
        console.log(`[Webhook] ✅ User ${email} subscription updated successfully.`);
        console.log(`[Webhook] Updated tier in DB: ${updatedUser[0]?.subscription_tier || 'N/A'}, Previous: ${previousTier}, New: ${newTier}`);
        
        // Step 5: Only send access_upgraded email if basic → advanced upgrade
        const shouldSendUpgradeEmail = 
          event.type === "customer.subscription.updated" && 
          previousTier === "basic" && 
          newTier === "advanced";
        
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
        
        // Choose template based on event type and upgrade condition
        let templateId: string | null = null;
        if (event.type === "customer.subscription.created") {
          templateId = 'payment_receipt';
        } else if (shouldSendUpgradeEmail) {
          templateId = 'access_upgraded';
        }
        
        // Only send email if we have a template to send
        if (templateId) {
          console.log(`[Webhook] Sending ${templateId} email to ${email} for event: ${event.type}`);
          
          // Download invoice PDF for attachment (for both payment_receipt and access_upgraded)
          let attachments: { filename: string; content: string }[] = [];
          if ((templateId === 'payment_receipt' || templateId === 'access_upgraded') && invoicePdfDownloadUrl) {
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
          
          // Call the send-email edge function with attachment
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
                invoice_pdf_url: invoicePdfUrl,
              },
              attachments: attachments,
            }),
          });
          
          if (emailRes.ok) {
            console.log(`Transactional email (${templateId}) sent to ${email} with ${attachments.length} attachment(s).`);
          } else {
            const errText = await emailRes.text();
            console.error("Error sending transactional email:", errText);
          }
        } else {
          console.log(`[Webhook] Skipping email - not a basic→advanced upgrade (previous: ${previousTier}, new: ${newTier})`);
        }
      } else {
        const errText = await updateRes.text();
        console.error(`[Webhook] ❌ Error updating user subscription for ${email}:`, errText);
        console.error(`[Webhook] Update response status: ${updateRes.status}`);
        console.error(`[Webhook] Attempted to update with tier: ${newTier}, priceId: ${priceId}`);
      }
    }
  }

  // Handle subscription renewal (invoice.payment_succeeded)
  if (event.type === "invoice.payment_succeeded") {
    console.log(`[Webhook] invoice.payment_succeeded event received`);
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

  return new Response(JSON.stringify({ received: true }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});