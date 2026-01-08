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
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

    // Step 1: Get the price ID from Stripe subscription to determine NEW tier
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const subscriptionId = subscription.id;
    
    // Step 2: Map price ID to tier (basic or advanced)
    const basicMonthlyPrice = Deno.env.get("VITE_BASIC_MONTHLY_PRICE") || "";
    const basicYearlyPrice = Deno.env.get("VITE_BASIC_YEARLY_PRICE") || "";
    const advancedMonthlyPrice = Deno.env.get("VITE_ADVANCED_MONTHLY_PRICE") || "";
    const advancedYearlyPrice = Deno.env.get("VITE_ADVANCED_YEARLY_PRICE") || "";
    
    let newTier = "basic"; // default
    if (priceId === advancedMonthlyPrice || priceId === advancedYearlyPrice) {
      newTier = "advanced";
    } else if (priceId === basicMonthlyPrice || priceId === basicYearlyPrice) {
      newTier = "basic";
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
          subscription_tier: newTier, // Use the mapped tier, not hardcoded "basic"
          stripe_customer_id: customerId || null,
          subscription_start: subscriptionStart,
          subscription_end: subscriptionEnd,
          updated_at: new Date().toISOString(),
        })
      });
      
      if (updateRes.ok) {
        console.log(`User ${email} subscription updated.`);
        
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
            // Prefer username, then name, then fallback to email extraction
            firstName = users[0].username || users[0].name || firstName;
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
        console.error("Error updating user subscription:", errText);
      }
    }
  }

  // Handle subscription renewal (invoice.payment_succeeded)
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    
    // Extract subscription ID - can be direct or nested in parent.subscription_details
    const subscriptionId = invoice.subscription || 
                          (invoice.parent as any)?.subscription_details?.subscription ||
                          null;
    
    // Only process subscription renewals (not first payment or one-time payments)
    // billing_reason: "subscription_cycle" = renewal, "subscription_create" = first payment
    if (subscriptionId && invoice.billing_reason === "subscription_cycle") {
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;

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
            firstName = users[0].username || users[0].name || firstName;
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
    }
  }

  return new Response(JSON.stringify({ received: true }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
