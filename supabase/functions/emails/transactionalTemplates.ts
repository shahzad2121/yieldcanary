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
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    .header p {
      font-size: 16px;
      opacity: 0.95;
      font-weight: 500;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 24px;
      font-weight: 600;
    }
    .intro-text {
      font-size: 16px;
      color: #374151;
      margin-bottom: 24px;
      line-height: 1.8;
    }
    .what-section {
      background-color: #f9fafb;
      border-left: 4px solid #2563eb;
      padding: 20px 24px;
      margin: 30px 0;
      border-radius: 4px;
    }
    .what-section h2 {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .what-section p {
      font-size: 15px;
      color: #4b5563;
      line-height: 1.7;
      margin-bottom: 16px;
    }
    .what-section ul {
      margin: 16px 0 0 20px;
    }
    .what-section li {
      margin-bottom: 10px;
      color: #1f2937;
      font-size: 15px;
    }
    .what-section strong {
      color: #2563eb;
    }
    .cta-button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 16px 40px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 30px 0;
      transition: background-color 0.3s;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
    }
    .cta-button:hover {
      background-color: #1d4ed8;
    }
    .why-section {
      margin-top: 30px;
      padding-top: 30px;
      border-top: 1px solid #e5e7eb;
    }
    .why-section h3 {
      font-size: 16px;
      color: #1f2937;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .why-section p {
      font-size: 15px;
      color: #4b5563;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .signature {
      font-size: 14px;
      color: #1f2937;
      margin-top: 15px;
      font-weight: 500;
    }
    .founder {
      color: #2563eb;
      font-weight: 600;
    }
    @media (max-width: 600px) {
      .container {
        border-radius: 0;
      }
      .content {
        padding: 30px 20px;
      }
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 26px;
      }
      .what-section {
        padding: 16px 20px;
      }
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
      <p class="greeting">Welcome, {{first_name|friend}}! 👋</p>
      
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
        <a href="https://yieldcanary.com" class="cta-button">Explore the Dashboard →</a>
      </p>
      
      <div class="why-section">
        <h3>Why we built this</h3>
        <p>
          Income ETFs have exploded in popularity, but most investors do not realize they are paying 12%+ yields 
          funded by selling off their own principal. That is not income — that is liquidation with extra steps.
        </p>
        <p>
          YieldCanary gives you the data to make smarter decisions. Browse the full ETF list, compare true yields, 
          and spot the funds that are actually generating sustainable income versus those burning through assets.
        </p>
      </div>
    </div>
    
    <div style="border-top: 1px solid #e5e7eb;"></div>
    
    <div class="footer">
      <p class="footer-text">
        Have questions? Just reply to this email — I read every message.
      </p>
      <p class="signature">
        Happy hunting,<br>
        <span class="founder">Ryan Fish</span><br>
        Founder, YieldCanary
      </p>
      <p class="footer-text" style="margin-top: 20px; font-size: 12px;">
        © 2024 YieldCanary. All rights reserved.
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .success-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 25px;
      line-height: 1.8;
    }
    .feature-box {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .feature-box h3 {
      color: #1f2937;
      font-size: 16px;
      margin-bottom: 15px;
    }
    .feature-box ul {
      list-style: none;
      padding: 0;
    }
    .feature-box li {
      color: #374151;
      padding: 8px 0;
      padding-left: 25px;
      position: relative;
    }
    .feature-box li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: bold;
      font-size: 18px;
    }
    .cta-button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 14px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 30px 0;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .signature {
      font-size: 14px;
      color: #1f2937;
      margin-top: 15px;
      font-weight: 500;
    }
    @media (max-width: 600px) {
      .container { border-radius: 0; }
      .content, .header { padding: 30px 20px; }
      .header h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="success-icon">🎉</div>
      <h1>Payment Confirmed!</h1>
      <p>YieldCanary Pro is Now Active</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey {{first_name}},</p>
      
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
      
      <p style="text-align: center;">
        <a href="https://yieldcanary.com" class="cta-button">Open Your Dashboard</a>
      </p>
      
      <p class="message" style="margin-top: 30px; font-size: 14px; color: #6b7280;">
        Need help getting started? Just reply to this email and we'll guide you through it.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Questions? Reply to this email anytime.</p>
      <p class="signature">
        Let's go find some dead canaries,<br>
        <span style="color: #2563eb; font-weight: 600;">Ryan Fish</span><br>
        Founder, YieldCanary
      </p>
      <p class="footer-text" style="margin-top: 20px; font-size: 12px;">
        © 2024 YieldCanary. All rights reserved.
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .boom {
      font-size: 52px;
      margin-bottom: 15px;
      animation: pulse 1s ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .highlight-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 8px;
      padding: 25px;
      text-align: center;
      margin: 25px 0;
      border: 2px solid #fbbf24;
    }
    .highlight-box h2 {
      color: #92400e;
      font-size: 20px;
      margin-bottom: 10px;
    }
    .highlight-box p {
      color: #78350f;
      font-size: 14px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 25px;
      line-height: 1.8;
    }
    .cta-button {
      display: inline-block;
      background-color: #8b5cf6;
      color: #ffffff;
      padding: 14px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 30px 0;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
    }
    .signature {
      font-size: 14px;
      color: #1f2937;
      margin-top: 15px;
      font-weight: 500;
    }
    @media (max-width: 600px) {
      .container { border-radius: 0; }
      .content, .header { padding: 30px 20px; }
      .header h1 { font-size: 26px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="boom">💥</div>
      <h1>The Blur is Gone!</h1>
      <p>Pro Access Activated</p>
    </div>
    
    <div class="content">
      <p class="greeting">{{first_name}},</p>
      
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
        <a href="https://yieldcanary.com" class="cta-button">Open the Dashboard</a>
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Happy hunting!</p>
      <p class="signature">
        Enjoy the truth,<br>
        <span style="color: #8b5cf6; font-weight: 600;">YieldCanary HQ</span>
      </p>
      <p class="footer-text" style="margin-top: 20px; font-size: 12px;">
        © 2024 YieldCanary. All rights reserved.
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #64748b 0%, #475569 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .icon {
      font-size: 42px;
      margin-bottom: 15px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 25px;
      line-height: 1.8;
    }
    .info-box {
      background-color: #f1f5f9;
      border-left: 4px solid #64748b;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .info-box p {
      color: #475569;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .info-box p:last-child {
      margin-bottom: 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 14px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 30px 0;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
    }
    .signature {
      font-size: 14px;
      color: #1f2937;
      margin-top: 15px;
      font-weight: 500;
    }
    @media (max-width: 600px) {
      .container { border-radius: 0; }
      .content, .header { padding: 30px 20px; }
      .header h1 { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">⏰</div>
      <h1>Your Pro Access Has Expired</h1>
      <p>The blur is back</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey {{first_name}},</p>
      
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
        <a href="https://yieldcanary.com/pricing" class="cta-button">Reactivate Pro Access</a>
      </p>
      
      <p class="message" style="margin-top: 30px; font-size: 14px; color: #6b7280; text-align: center;">
        Questions? Just reply to this email.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">We're here if you need us.</p>
      <p class="signature">
        No pressure,<br>
        <span style="color: #64748b; font-weight: 600;">YieldCanary HQ</span>
      </p>
      <p class="footer-text" style="margin-top: 20px; font-size: 12px;">
        © 2024 YieldCanary. All rights reserved.
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .icon {
      font-size: 42px;
      margin-bottom: 15px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 25px;
      line-height: 1.8;
    }
    .cta-button {
      display: inline-block;
      background-color: #ef4444;
      color: #ffffff;
      padding: 14px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 30px 0;
    }
    .warning-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .warning-box p {
      color: #991b1b;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .warning-box p:last-child {
      margin-bottom: 0;
    }
    .link-box {
      background-color: #f9fafb;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
      color: #2563eb;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
    }
    .signature {
      font-size: 14px;
      color: #1f2937;
      margin-top: 15px;
      font-weight: 500;
    }
    @media (max-width: 600px) {
      .container { border-radius: 0; }
      .content, .header { padding: 30px 20px; }
      .header h1 { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔐</div>
      <h1>Password Reset Request</h1>
      <p>Secure your account</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey {{first_name}},</p>
      
      <p class="message">
        Someone (hopefully you) requested a password reset for your YieldCanary account.
      </p>
      
      <p style="text-align: center;">
        <a href="{{reset_link}}" class="cta-button">Reset Your Password</a>
      </p>
      
      <p class="message" style="font-size: 14px; color: #6b7280;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      
      <div class="link-box">
        {{reset_link}}
      </div>
      
      <div class="warning-box">
        <p><strong>⚠️ This link expires in 1 hour</strong></p>
        <p>If you didn't request this reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
      
      <p class="message" style="margin-top: 30px; font-size: 14px; color: #6b7280;">
        Need help? Reply to this email and we'll assist you.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Keep your account secure.</p>
      <p class="signature">
        <span style="color: #ef4444; font-weight: 600;">YieldCanary HQ</span>
      </p>
      <p class="footer-text" style="margin-top: 20px; font-size: 12px;">
        © 2024 YieldCanary. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
];
