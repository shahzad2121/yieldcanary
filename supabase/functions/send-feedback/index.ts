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

  // Parse request body
  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { 
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  const { message, userEmail } = payload;
  if (!message || !userEmail) {
    return new Response(JSON.stringify({ error: "Missing 'message' or 'userEmail'" }), { 
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  // Get Resend API key and from email
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "YieldCanary <support@yieldcanary.com>";
  
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not set in Supabase environment variables!");
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }
  
  // Create email content
  const subject = `Feedback from YieldCanary - ${userEmail}`;
  const timestamp = new Date().toLocaleString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback from YieldCanary</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #1a2938;
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.05) 0%, rgba(26, 140, 216, 0.05) 100%);
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      border: 1px solid rgba(13, 164, 114, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.95;
      font-weight: 500;
    }
    .content {
      padding: 32px;
    }
    .info-section {
      background: #f8fafc;
      border-left: 4px solid #0da472;
      padding: 20px;
      margin-bottom: 24px;
      border-radius: 6px;
    }
    .info-row {
      margin-bottom: 12px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 15px;
      color: #1a2938;
      font-weight: 500;
      word-break: break-all;
    }
    .feedback-section {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-radius: 8px;
      padding: 24px;
      margin-top: 24px;
    }
    .feedback-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .feedback-message {
      font-size: 15px;
      color: #1a2938;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .footer {
      background: #f8fafc;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text {
      font-size: 12px;
      color: #64748b;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { border-radius: 8px; }
      .content, .header { padding: 20px; }
      .header h1 { font-size: 20px; }
      .header p { font-size: 13px; }
      .info-section { padding: 16px; margin-bottom: 20px; }
      .info-label { font-size: 11px; }
      .info-value { font-size: 14px; }
      .feedback-section { padding: 20px; margin-top: 20px; }
      .feedback-label { font-size: 11px; margin-bottom: 10px; }
      .feedback-message { font-size: 14px; line-height: 1.6; }
      .footer { padding: 20px; }
      .footer-text { font-size: 11px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐦 New Feedback</h1>
      <p>YieldCanary User Feedback</p>
    </div>
    
    <div class="content">
      <div class="info-section">
        <div class="info-row">
          <div class="info-label">User Email</div>
          <div class="info-value">${userEmail}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Received</div>
          <div class="info-value">${timestamp}</div>
        </div>
      </div>
      
      <div class="feedback-section">
        <div class="feedback-label">Feedback Message</div>
        <div class="feedback-message">${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    
    <div class="footer">
      <p class="footer-text">This feedback was submitted through the YieldCanary dashboard.</p>
    </div>
  </div>
</body>
</html>`;
  
  // Send email via Resend
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: "rfish14@gmail.com",
      subject: subject,
      html: htmlBody,
    })
  });

  if (emailRes.ok) {
    console.log(`Feedback email successfully sent from ${userEmail}`);
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