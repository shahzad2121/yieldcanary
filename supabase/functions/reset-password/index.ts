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

  // Expect JSON body: { email, redirectTo }
  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { 
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  const { email, redirectTo } = payload;
  if (!email) {
    return new Response(JSON.stringify({ error: "Missing 'email'" }), { 
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Server configuration error" }), { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  try {
    // Step 1: Generate password reset token using Supabase Admin API
    // We use the Admin API to generate a recovery token
    const generateTokenRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "recovery",
        email: email,
        redirect_to: redirectTo || `${req.headers.get("origin") || "https://yieldcanary.com"}/auth`,
      }),
    });

    if (!generateTokenRes.ok) {
      const errorText = await generateTokenRes.text();
      console.error("Error generating reset token:", errorText);
      // Don't reveal if email exists or not (security best practice)
      return new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    }

    const tokenData = await generateTokenRes.json();
    const resetLink = tokenData.properties?.action_link || tokenData.action_link;

    if (!resetLink) {
      console.error("No reset link in response:", tokenData);
      // Still return success to avoid email enumeration
      return new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    }

    // Step 2: Get user info for personalization
    let firstName = email.split('@')[0]; // Fallback
    try {
      const userRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=username,name`, {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      });
      
      if (userRes.ok) {
        const users = await userRes.json();
        if (users && users.length > 0) {
          firstName = users[0].username || users[0].name || firstName;
        }
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
      // Continue with fallback
    }

    // Step 3: Use existing send-email function to send the custom template
    // This reuses all the email sending logic instead of duplicating it
    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
    const emailRes = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`, // Use service role for internal calls
      },
      body: JSON.stringify({
        to: email,
        templateId: 'password_reset',
        data: {
          first_name: firstName,
          reset_link: resetLink,
        },
      }),
    });

    if (emailRes.ok) {
      console.log(`Password reset email sent to ${email}`);
      return new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    } else {
      const errText = await emailRes.text();
      console.error(`Error sending password reset email: ${errText}`);
      // Still return success to avoid revealing errors (security best practice)
      return new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("Unexpected error in password reset:", error);
    // Return success to avoid email enumeration attacks
    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }
});

