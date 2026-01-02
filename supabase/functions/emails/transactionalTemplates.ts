export type TransactionalEmailTemplate = {
  id: 'welcome_verify' | 'payment_receipt' | 'access_upgraded' | 'access_expired' | 'password_reset';
  title: string;
  subject: string;
  previewText?: string;
  body: string;
};

/**
 * Central source of truth for Resend transactional messages.
 * Keep the {{placeholders}} intact so the mailer can inject user-specific values.
 */
export const transactionalEmailTemplates: TransactionalEmailTemplate[] = [
  {
    id: 'welcome_verify',
    title: 'Welcome Email',
    subject: 'Welcome to YieldCanary - See Through the ETF Marketing Hype',
    previewText: 'Your account is ready. Time to see the real numbers behind every high-yield ETF.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to YieldCanary</title>
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
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(13, 164, 114, 0.1);
      overflow: hidden;
      border: 1px solid rgba(13, 164, 114, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff;
      padding: 48px 32px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }
    .header p {
      font-size: 16px;
      opacity: 0.95;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    .content {
      padding: 48px 32px;
      background: #ffffff;
    }
    .greeting {
      font-size: 20px;
      color: #1a2938;
      margin-bottom: 24px;
      font-weight: 600;
    }
    .intro-text {
      font-size: 16px;
      color: #475569;
      margin-bottom: 28px;
      line-height: 1.8;
    }
    .what-section {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .what-section h2 {
      font-size: 18px;
      color: #1a2938;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .what-section p {
      font-size: 15px;
      color: #475569;
      line-height: 1.7;
      margin-bottom: 16px;
    }
    .what-section ul {
      margin: 16px 0 0 20px;
    }
    .what-section li {
      margin-bottom: 10px;
      color: #334155;
      font-size: 15px;
    }
    .what-section strong {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff !important;
      padding: 16px 40px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 32px 0;
      box-shadow: 0 4px 12px rgba(13, 164, 114, 0.3);
      transition: transform 0.2s, box-shadow 0.2s;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .cta-button:hover {
      box-shadow: 0 6px 16px rgba(13, 164, 114, 0.4);
    }
    .why-section {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .why-section h3 {
      font-size: 18px;
      color: #1a2938;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .why-section p {
      font-size: 15px;
      color: #475569;
      line-height: 1.8;
      margin-bottom: 16px;
    }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 12px;
    }
    .signature {
      font-size: 15px;
      color: #1a2938;
      margin-top: 20px;
      font-weight: 500;
    }
    .founder {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { border-radius: 8px; }
      .content, .header { padding: 24px 20px; }
      .header h1 { font-size: 22px; }
      .header p { font-size: 14px; }
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .intro-text { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .what-section { padding: 20px; margin: 24px 0; }
      .what-section h2 { font-size: 16px; margin-bottom: 12px; }
      .what-section p { font-size: 14px; line-height: 1.6; }
      .what-section li { font-size: 14px; }
      .why-section { margin-top: 24px; padding-top: 24px; }
      .why-section h3 { font-size: 16px; margin-bottom: 12px; }
      .why-section p { font-size: 14px; line-height: 1.7; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐦 YieldCanary</h1>
      <p>Cut Through the ETF Marketing Hype</p>
    </div>
    
    <div class="content">
      <p class="greeting">Welcome, {{first_name|there!}}! 👋</p>
      
      <p class="intro-text">
        Thanks for joining YieldCanary. Your account is active and ready to use. 
        We built this platform to give you the real story behind high-yield ETFs — no marketing fluff, no hidden metrics.
      </p>
      
      <div class="what-section">
        <h2>What is YieldCanary?</h2>
        <p>
          YieldCanary is an ETF analytics dashboard that reveals the truth behind income investments. 
          We track over 100 high-yield ETFs and show you metrics the fund companies do not want you to see:
        </p>
        <ul>
          <li><strong>Death Clock</strong> - How long until this ETF burns through your principal with unsustainable distributions</li>
          <li><strong>True Income Yield</strong> - The real yield after stripping out return of capital (ROC)</li>
          <li><strong>Take-Home Cash Return</strong> - Your actual return after taxes, the number that matters for retirement planning</li>
        </ul>
        <p style="margin-top: 16px;">
          Most ETF marketing shows you inflated yields. We show you reality.
        </p>
      </div>
      
      <p style="text-align: center;">
        <a href="https://yieldcanary.com" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%); color: #ffffff !important; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 32px 0; box-shadow: 0 4px 12px rgba(13, 164, 114, 0.3);">Explore the Dashboard →</a>
      </p>
      
      <div class="why-section">
        <h3>Why We Built This</h3>
        <p>
          High-yield income ETFs have exploded in popularity, but most investors don't realize that many of those eye-catching 12%+ yields are funded by quietly returning their own principal.
        </p>
        <p>
          That's not true income — it's liquidation with extra steps. YieldCanary gives you the data to make smarter decisions. Browse the full ETF list, compare true yields, and easily spot the funds generating sustainable income versus those slowly burning through assets.
        </p>
      </div>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        Have questions? Just reply to this email — I read every message.
      </p>
      <p class="signature">
        <span class="founder">Ryan Fish</span><br>
        Founder, YieldCanary
      </p>
      <p class="footer-text" style="margin-top: 24px; font-size: 12px;">
        © 2026 YieldCanary. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'payment_receipt',
    title: 'Payment Receipt / Unlock notice',
    subject: 'You are in! YieldCanary Pro is now unlocked!',
    previewText: 'Death Clock, True Income Yield, and Take-Home Cash Return are now visible.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed - YieldCanary Pro</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(13, 164, 114, 0.1);
      overflow: hidden;
      border: 1px solid rgba(13, 164, 114, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff;
      padding: 48px 32px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 30% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }
    .header p {
      font-size: 16px;
      opacity: 0.95;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    .success-icon {
      font-size: 56px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
      display: inline-block;
    }
    .content {
      padding: 48px 32px;
      background: #ffffff;
    }
    .greeting {
      font-size: 20px;
      color: #1a2938;
      margin-bottom: 24px;
      font-weight: 600;
    }
    .message {
      font-size: 16px;
      color: #475569;
      margin-bottom: 28px;
      line-height: 1.8;
    }
    .feature-box {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .feature-box h3 {
      color: #1a2938;
      font-size: 18px;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .feature-box ul {
      list-style: none;
      padding: 0;
    }
    .feature-box li {
      color: #334155;
      padding: 10px 0;
      padding-left: 32px;
      position: relative;
      font-size: 15px;
    }
    .feature-box li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #0da472;
      font-weight: bold;
      font-size: 20px;
      background: rgba(13, 164, 114, 0.1);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff !important;
      padding: 16px 40px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 32px 0;
      box-shadow: 0 4px 12px rgba(13, 164, 114, 0.3);
      transition: transform 0.2s, box-shadow 0.2s;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .cta-button:hover {
      box-shadow: 0 6px 16px rgba(13, 164, 114, 0.4);
    }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 12px;
    }
    .signature {
      font-size: 15px;
      color: #1a2938;
      margin-top: 20px;
      font-weight: 500;
    }
    .signature-name {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { border-radius: 8px; }
      .content, .header { padding: 24px 20px; }
      .header h1 { font-size: 22px; }
      .header p { font-size: 14px; }
      .success-icon { font-size: 40px; margin-bottom: 16px; }
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .message { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .feature-box { padding: 20px; margin: 24px 0; }
      .feature-box h3 { font-size: 16px; margin-bottom: 16px; }
      .feature-box li { font-size: 14px; padding: 8px 0; padding-left: 28px; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="success-icon">🐤</div>
      <h1>Payment Confirmed!</h1>
      <p>YieldCanary Pro is Now Active</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey, {{first_name|there!}}!</p>
      
      <p class="message">
        Welcome to the real numbers. The blur is <strong>gone</strong> — you now have full access to every metric we track.
      </p>
      
      <div class="feature-box">
        <h3>Your Pro Access Includes:</h3>
        <ul>
          <li><strong>Death Clock</strong> on every ETF</li>
          <li><strong>True Income Yield</strong> after ROC</li>
          <li><strong>Take-Home Cash Return</strong> after taxes</li>
          <li><strong>Advanced Filtering</strong> & sorting</li>
          <li><strong>Real-time Updates</strong> on all metrics</li>
        </ul>
      </div>
      
      <p style="text-align: center; margin-top: 32px;">
        <a href="{{invoice_pdf_url|#}}" style="display: inline-block; color: #64748b; text-decoration: underline; font-size: 14px; margin-bottom: 20px;">View Payment Receipt (PDF)</a>
      </p>
      <p style="text-align: center;">
        <a href="https://yieldcanary.com" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%); color: #ffffff !important; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 32px 0; box-shadow: 0 4px 12px rgba(13, 164, 114, 0.3);">Open Your Dashboard</a>
      </p>
      
      <p class="message" style="margin-top: 32px; font-size: 14px; color: #64748b;">
        Need help getting started? Just reply to this email and we'll guide you through it.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Questions? Reply to this email anytime.</p>
      <p class="signature">
        Let's go find some dead canaries,<br>
        <span class="signature-name">Ryan Fish</span><br>
        Founder, YieldCanary
      </p>
      <p class="footer-text" style="margin-top: 24px; font-size: 12px;">
        © 2026 YieldCanary. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'access_upgraded',
    title: 'Blur Removed / Access Upgraded',
    subject: 'Your YieldCanary Pro access just went live!',
    previewText: 'Full ETF metrics, including Take-Home Cash Return, are now visible.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Upgraded - YieldCanary</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #1a2938;
      background: linear-gradient(135deg, rgba(26, 140, 216, 0.05) 0%, rgba(13, 164, 114, 0.05) 100%);
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(26, 140, 216, 0.1);
      overflow: hidden;
      border: 1px solid rgba(26, 140, 216, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #1a8cd8 0%, #0da472 100%);
      color: #ffffff;
      padding: 48px 32px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 70% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }
    .header p {
      font-size: 16px;
      opacity: 0.95;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    .upgrade-icon {
      font-size: 56px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
      display: inline-block;
    }
    .content {
      padding: 48px 32px;
      background: #ffffff;
    }
    .greeting {
      font-size: 20px;
      color: #1a2938;
      margin-bottom: 24px;
      font-weight: 600;
    }
    .highlight-box {
      background: linear-gradient(135deg, rgba(26, 140, 216, 0.1) 0%, rgba(13, 164, 114, 0.1) 100%);
      border: 1px solid rgba(26, 140, 216, 0.25);
      border-radius: 8px;
      padding: 32px;
      text-align: center;
      margin: 32px 0;
      box-shadow: 0 2px 8px rgba(26, 140, 216, 0.15);
    }
    .highlight-box h2 {
      color: #1a2938;
      font-size: 22px;
      margin-bottom: 12px;
      font-weight: 700;
    }
    .highlight-box p {
      color: #475569;
      font-size: 15px;
      font-weight: 500;
    }
    .message {
      font-size: 16px;
      color: #475569;
      margin-bottom: 28px;
      line-height: 1.8;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #1a8cd8 0%, #0da472 100%);
      color: #ffffff !important;
      padding: 16px 40px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 32px 0;
      box-shadow: 0 4px 12px rgba(26, 140, 216, 0.3);
      transition: transform 0.2s, box-shadow 0.2s;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .cta-button:hover {
      box-shadow: 0 6px 16px rgba(26, 140, 216, 0.4);
    }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(26, 140, 216, 0.1);
    }
    .footer-text {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 12px;
    }
    .signature {
      font-size: 15px;
      color: #1a2938;
      margin-top: 20px;
      font-weight: 500;
    }
    .signature-name {
      background: linear-gradient(135deg, #1a8cd8 0%, #0da472 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { border-radius: 8px; }
      .content, .header { padding: 24px 20px; }
      .header h1 { font-size: 22px; }
      .header p { font-size: 14px; }
      .upgrade-icon { font-size: 40px; margin-bottom: 16px; }
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .message { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .highlight-box { padding: 20px; margin: 24px 0; }
      .highlight-box h2 { font-size: 18px; margin-bottom: 10px; }
      .highlight-box p { font-size: 14px; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="upgrade-icon">⚡</div>
      <h1>The Blur is Gone!</h1>
      <p>Pro Access Activated</p>
    </div>
    
    <div class="content">
      <p class="greeting">{{first_name|there!}},</p>
      
      <div class="highlight-box">
        <h2>Full Access Unlocked</h2>
        <p>Every metric on our list of income ETFs is now visible</p>
      </div>
      
      <p class="message">
        You now have complete access to every metric we track, including the <strong>Take-Home Cash Return</strong> column that shows exactly what you'll actually keep after taxes and ROC adjustments.
      </p>
      
      <p class="message">
        No more blurred data. No more hidden numbers. Just the truth.
      </p>
      
      <p style="text-align: center;">
        <a href="https://yieldcanary.com" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #1a8cd8 0%, #0da472 100%); color: #ffffff !important; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 32px 0; box-shadow: 0 4px 12px rgba(26, 140, 216, 0.3);">Open the Dashboard</a>
      </p>
    </div>
    
    <div class="footer">
      <p class="signature">
        Enjoy the truth,<br>
        <span class="signature-name">YieldCanary HQ</span>
      </p>
      <p class="footer-text" style="margin-top: 24px; font-size: 12px;">
        © 2026 YieldCanary. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'access_expired',
    title: 'Access Expired / Churn notice',
    subject: 'Your YieldCanary Pro access has expired',
    previewText: 'Blurred data is back, but your watchlist is saved if you return.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Expired - YieldCanary</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(13, 164, 114, 0.1);
      overflow: hidden;
      border: 1px solid rgba(13, 164, 114, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff;
      padding: 48px 32px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }
    .header p {
      font-size: 16px;
      opacity: 0.95;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    .expired-icon {
      font-size: 56px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
      display: inline-block;
    }
    .content {
      padding: 48px 32px;
      background: #ffffff;
    }
    .greeting {
      font-size: 20px;
      color: #1a2938;
      margin-bottom: 24px;
      font-weight: 600;
    }
    .message {
      font-size: 16px;
      color: #475569;
      margin-bottom: 28px;
      line-height: 1.8;
    }
    .info-box {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .info-box p {
      color: #334155;
      font-size: 15px;
      margin-bottom: 12px;
      line-height: 1.7;
    }
    .info-box p:last-child {
      margin-bottom: 0;
    }
    .info-box strong {
      color: #1a2938;
      font-weight: 600;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff !important;
      padding: 16px 40px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 32px 0;
      box-shadow: 0 4px 12px rgba(13, 164, 114, 0.3);
      transition: transform 0.2s, box-shadow 0.2s;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .cta-button:hover {
      box-shadow: 0 6px 16px rgba(13, 164, 114, 0.4);
    }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 12px;
    }
    .signature {
      font-size: 15px;
      color: #1a2938;
      margin-top: 20px;
      font-weight: 500;
    }
    .signature-name {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { border-radius: 8px; }
      .content, .header { padding: 24px 20px; }
      .header h1 { font-size: 22px; }
      .header p { font-size: 14px; }
      .expired-icon { font-size: 40px; margin-bottom: 16px; }
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .message { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .info-box { padding: 20px; margin: 24px 0; }
      .info-box p { font-size: 14px; line-height: 1.6; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="expired-icon">⏰</div>
      <h1>Your Pro Access Has Expired</h1>
      <p>The blur is back</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey {{first_name|there!}},</p>
      
      <p class="message">
        Your Pro access expired today — the blur is back on and premium metrics are now hidden.
      </p>
      
      <div class="info-box">
        <p><strong>✓ Your watchlist is still saved</strong></p>
        <p><strong>✓ Your account is still active</strong></p>
        <p><strong>✓ All your data is safe</strong></p>
      </div>
      
      <p class="message">
        Want your full access back? You can reactivate anytime — no pressure, we'll keep your data safe while you decide.
      </p>
      
      <p style="text-align: center;">
        <a href="https://yieldcanary.com/pricing" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%); color: #ffffff !important; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 32px 0; box-shadow: 0 4px 12px rgba(13, 164, 114, 0.3); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);">Reactivate Pro Access</a>
      </p>
      
      <p class="message" style="margin-top: 32px; font-size: 14px; color: #64748b; text-align: center;">
        Questions? Just reply to this email.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">We're here if you need us.</p>
      <p class="signature">
        No pressure,<br>
        <span class="signature-name">YieldCanary HQ</span>
      </p>
      <p class="footer-text" style="margin-top: 24px; font-size: 12px;">
        © 2026 YieldCanary. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'password_reset',
    title: 'Password Reset',
    subject: 'Reset your YieldCanary password',
    previewText: 'Set a new password for your account.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - YieldCanary</title>
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
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(13, 164, 114, 0.1);
      overflow: hidden;
      border: 1px solid rgba(13, 164, 114, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff;
      padding: 48px 32px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }
    .header p {
      font-size: 16px;
      opacity: 0.95;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    .icon {
      font-size: 56px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
      display: inline-block;
    }
    .content {
      padding: 48px 32px;
      background: #ffffff;
    }
    .greeting {
      font-size: 20px;
      color: #1a2938;
      margin-bottom: 24px;
      font-weight: 600;
    }
    .message {
      font-size: 16px;
      color: #475569;
      margin-bottom: 28px;
      line-height: 1.8;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      color: #ffffff !important;
      padding: 18px 48px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 17px;
      letter-spacing: 0.3px;
      margin: 32px 0;
      transition: all 0.3s;
      box-shadow: 0 4px 16px rgba(13, 164, 114, 0.35), 0 2px 8px rgba(13, 164, 114, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      text-transform: uppercase;
      position: relative;
      overflow: hidden;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .cta-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }
    .cta-button:hover {
      background: linear-gradient(135deg, #0fb881 0%, #1c9de8 100%);
      box-shadow: 0 6px 20px rgba(13, 164, 114, 0.45), 0 4px 12px rgba(13, 164, 114, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }
    .cta-button:hover::before {
      left: 100%;
    }
    .info-box {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .info-box p {
      color: #334155;
      font-size: 15px;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .info-box p:last-child {
      margin-bottom: 0;
    }
    .info-box strong {
      color: #1a2938;
      font-weight: 600;
    }
    .link-box {
      background-color: #f1f5f9;
      border: 1px solid rgba(13, 164, 114, 0.2);
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
      word-break: break-all;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 12px;
      color: #0da472;
      line-height: 1.6;
    }
    .security-note {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 24px;
      margin: 28px 0;
      border-radius: 8px;
    }
    .security-note p {
      color: #92400e;
      font-size: 14px;
      line-height: 1.7;
      margin-bottom: 10px;
    }
    .security-note p:last-child {
      margin-bottom: 0;
    }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 12px;
    }
    .signature {
      font-size: 15px;
      color: #1a2938;
      margin-top: 20px;
      font-weight: 500;
    }
    .brand {
      background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { border-radius: 8px; }
      .content, .header { padding: 24px 20px; }
      .header h1 { font-size: 22px; }
      .header p { font-size: 14px; }
      .icon { font-size: 40px; margin-bottom: 16px; }
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .message { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .info-box { padding: 20px; margin: 24px 0; }
      .info-box p { font-size: 14px; line-height: 1.6; }
      .security-note { padding: 20px; margin: 24px 0; }
      .security-note p { font-size: 13px; line-height: 1.6; }
      .link-box { padding: 12px; font-size: 11px; margin: 16px 0; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔐</div>
      <h1>🐦 YieldCanary</h1>
      <p>Password Reset Request</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey {{first_name|there!}},</p>
      
      <p class="message">
        Someone (hopefully you) requested a password reset for your YieldCanary account. 
        Click the button below to set a new password.
      </p>
      
      <p style="text-align: center; margin: 40px 0;">
        <a href="{{reset_link}}" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #0da472 0%, #1a8cd8 100%); color: #ffffff !important; padding: 18px 48px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 17px; letter-spacing: 0.3px; box-shadow: 0 4px 16px rgba(13, 164, 114, 0.35), 0 2px 8px rgba(13, 164, 114, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); text-transform: uppercase;">🔐 Reset Your Password</a>
      </p>
      
      <div class="info-box">
        <p><strong>⏰ This link expires in 1 hour</strong></p>
        <p>For your security, the reset link will expire after 60 minutes. If you need a new link, you can request another password reset.</p>
      </div>
      
      <p class="message" style="font-size: 14px; color: #64748b; margin-top: 30px;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      
      <div class="link-box">
        {{reset_link}}
      </div>
      
      <div class="security-note">
        <p><strong>🔒 Didn't request this?</strong></p>
        <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.</p>
      </div>
      
      <p class="message" style="margin-top: 32px; font-size: 14px; color: #64748b;">
        Need help? Just reply to this email and we'll assist you.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Keep your account secure.</p>
      <p class="signature">
        <span class="brand">YieldCanary Support</span>
      </p>
      <p class="footer-text" style="margin-top: 24px; font-size: 12px;">
        © 2026 YieldCanary. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
];
