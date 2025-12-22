import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { transactionalEmailTemplates } from "../emails/transactionalTemplates.ts";
import { DEFAULT_FROM } from "../constants.ts";

// Helper to replace {{placeholders}} in template
function replacePlaceholders(input: string, data: Record<string, string> = {}) {
  return input.replace(/{{([^}]+)}}/g, (_, token) => {
    const [rawKey, fallback] = token.split('|');
    const key = rawKey.trim();
    const value = data[key];
    return value && value.length > 0 ? value : (fallback ? fallback.trim() : '');
  });
}

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

  // Expect JSON body: { to, templateId, data }
  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { 
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  const { to, templateId, data = {} } = payload;
  if (!to || !templateId) {
    return new Response(JSON.stringify({ error: "Missing 'to' or 'templateId'" }), { 
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  const template = transactionalEmailTemplates.find(t => t.id === templateId);
  if (!template) {
    return new Response(JSON.stringify({ error: "Template not found" }), { 
      status: 404,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  const subject = replacePlaceholders(template.subject, data);
  const body = replacePlaceholders(template.body, data);

  // Send email via Resend
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? DEFAULT_FROM;
  // Use VITE_SUPABASE_SERVICE_ROLE_KEY for Supabase API calls if needed
  const supabaseServiceRoleKey = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  console.log(`Attempting to send email to ${to} with template ${templateId}`);
  console.log(`Resend API Key present: ${resendApiKey ? 'yes' : 'NO - MISSING!'}`);
  console.log(`Resend From Email: ${resendFromEmail}`);
  
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not set in Supabase environment variables!");
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }
  
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to,
      subject,
      html: body.includes("<!DOCTYPE") ? body : `<p>${body.replace(/\n/g, "</p><p>")}</p>`,
    })
  });

  if (emailRes.ok) {
    console.log(`Email successfully sent to ${to}`);
    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  } else {
    const errText = await emailRes.text();
    console.error(`Resend API error: ${errText}`);
    return new Response(JSON.stringify({ error: errText }), { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }
});
