import type { TransactionalEmailTemplate } from "./transactionalTemplates.ts";

/**
 * Trial-related email templates
 * These templates are imported and merged into the main transactionalEmailTemplates array
 */

export const trialEmailTemplates: TransactionalEmailTemplate[] = [
  {
    id: 'trial_started',
    title: 'Trial Started',
    subject: 'Your {{trial_days|7}}-Day Free Trial Has Started - Welcome to YieldCanary Pro!',
    previewText: 'Explore all Pro features for {{trial_days|7}} days, no credit card required.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Trial Has Started</title>
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
    .trial-info-box {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .trial-info-box h2 {
      font-size: 18px;
      color: #1a2938;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .trial-info-box p {
      font-size: 15px;
      color: #475569;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .trial-date {
      font-size: 16px;
      font-weight: 600;
      color: #0da472;
      margin-top: 8px;
    }
    .features-section {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .features-section h3 {
      font-size: 18px;
      color: #1a2938;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .feature-list li {
      padding: 12px 0;
      padding-left: 32px;
      position: relative;
      color: #334155;
      font-size: 15px;
      line-height: 1.6;
    }
    .feature-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #0da472;
      font-weight: 700;
      font-size: 18px;
    }
    .feature-list strong {
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
    .no-charge-note {
      background: #f8fafc;
      border: 1px solid rgba(13, 164, 114, 0.15);
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .no-charge-note p {
      font-size: 14px;
      color: #64748b;
      margin: 0;
      line-height: 1.6;
    }
    .no-charge-note strong {
      color: #0da472;
      font-weight: 600;
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
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .intro-text { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .trial-info-box { padding: 20px; margin: 24px 0; }
      .trial-info-box h2 { font-size: 16px; margin-bottom: 12px; }
      .trial-info-box p { font-size: 14px; line-height: 1.6; }
      .trial-date { font-size: 14px; }
      .features-section { margin-top: 24px; padding-top: 24px; }
      .features-section h3 { font-size: 16px; margin-bottom: 16px; }
      .feature-list li { font-size: 14px; padding: 10px 0; padding-left: 28px; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .no-charge-note { padding: 16px; margin: 20px 0; }
      .no-charge-note p { font-size: 13px; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Your Free Trial Has Started!</h1>
      <p>{{trial_days|7}} Days of Full Pro Access</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey, {{first_name|there!}}!</p>
      
      <p class="intro-text">
        Great news! Your <strong>{{trial_days|7}}-day free trial</strong> of YieldCanary Pro is now active. 
        You have full access to all premium features — no credit card charged during the trial period.
      </p>
      
      <div class="trial-info-box">
        <h2>⏰ Trial Details</h2>
        <p>Your trial period ends on:</p>
        <p class="trial-date">{{trial_end_date|January 1, 2026}}</p>
        <p style="margin-top: 16px;">
          After the trial ends, your subscription will automatically continue unless you cancel. 
          You can cancel anytime during the trial with no charges.
        </p>
      </div>
      
      <div class="features-section">
        <h3>What You Can Access During Your Trial:</h3>
        <ul class="feature-list">
          <li><strong>Death Clock</strong> — See exactly when each ETF's income will run out</li>
          <li><strong>True Income Yield</strong> — Real yield after Return of Capital (ROC)</li>
          <li><strong>Take-Home Cash Return</strong> — After-tax returns that matter</li>
          <li><strong>Advanced Filtering</strong> — Find ETFs that match your exact criteria</li>
          <li><strong>Real-time Updates</strong> — Always current data on all metrics</li>
          <li><strong>Export & Analysis</strong> — Download data for deeper analysis</li>
        </ul>
      </div>
      
      <p style="text-align: center; margin-top: 32px;">
        <a href="https://yieldcanary.com" class="cta-button">Start Exploring Your Dashboard</a>
      </p>
      
      <div class="no-charge-note">
        <p>
          <strong>No charges during trial</strong> — Your card won't be charged until after the trial period ends. 
          Cancel anytime before {{trial_end_date|the trial ends}} with zero cost.
        </p>
      </div>
      
      <p class="intro-text" style="margin-top: 32px; font-size: 14px; color: #64748b;">
        Questions about your trial? Just reply to this email and we'll help you out.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Enjoy exploring YieldCanary Pro!</p>
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
  {
    id: 'trial_ending_reminder',
    title: 'Trial Ending Reminder',
    subject: 'Your YieldCanary trial ends soon ({{trial_end_date|soon}})',
    previewText: 'A quick reminder before your Pro trial ends.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trial Ending Soon</title>
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
      top: 0; left: 0; right: 0; bottom: 0;
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
    .content { padding: 48px 32px; background: #ffffff; }
    .greeting { font-size: 20px; color: #1a2938; margin-bottom: 24px; font-weight: 600; }
    .intro-text { font-size: 16px; color: #475569; margin-bottom: 28px; line-height: 1.8; }
    .trial-info-box {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .trial-info-box h2 { font-size: 18px; color: #1a2938; margin-bottom: 16px; font-weight: 600; }
    .trial-info-box p { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 12px; }
    .trial-date { font-size: 16px; font-weight: 600; color: #0da472; margin-top: 8px; }
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
    .cta-button:hover { box-shadow: 0 6px 16px rgba(13, 164, 114, 0.4); }
    .no-charge-note {
      background: #f8fafc;
      border: 1px solid rgba(13, 164, 114, 0.15);
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .no-charge-note p { font-size: 14px; color: #64748b; margin: 0; line-height: 1.6; }
    .no-charge-note strong { color: #0da472; font-weight: 600; }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text { font-size: 14px; color: #64748b; margin-bottom: 12px; }
    .signature { font-size: 15px; color: #1a2938; margin-top: 20px; font-weight: 500; }
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
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .intro-text { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .trial-info-box { padding: 20px; margin: 24px 0; }
      .trial-info-box h2 { font-size: 16px; margin-bottom: 12px; }
      .trial-info-box p { font-size: 14px; line-height: 1.6; }
      .trial-date { font-size: 14px; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .no-charge-note { padding: 16px; margin: 20px 0; }
      .no-charge-note p { font-size: 13px; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏳ Trial Ending Soon</h1>
      <p>Quick reminder so you’re not surprised</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey, {{first_name|there!}}!</p>
      
      <p class="intro-text">
        Just a heads-up: your YieldCanary Pro trial is scheduled to end soon.
      </p>
      
      <div class="trial-info-box">
        <h2>📅 Trial End Date</h2>
        <p>Your trial ends on:</p>
        <p class="trial-date">{{trial_end_date|soon}}</p>
        <p style="margin-top: 16px;">
          You can cancel anytime before then to avoid being charged.
        </p>
      </div>
      
      <p style="text-align: center; margin-top: 32px;">
        <a href="https://yieldcanary.com" class="cta-button">Review Your Dashboard</a>
      </p>
      
      <div class="no-charge-note">
        <p>
          <strong>Want to keep Pro?</strong> No action needed—your access continues automatically after the trial ends.
        </p>
      </div>
      
      <p class="intro-text" style="margin-top: 32px; font-size: 14px; color: #64748b;">
        Need help deciding? Reply to this email and we’ll help.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Thanks for trying YieldCanary Pro.</p>
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
  {
    id: 'trial_converted_to_paid',
    title: 'Trial Converted to Paid',
    subject: 'You’re officially Pro — welcome aboard!',
    previewText: 'Your trial has converted and Pro access continues.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Pro</title>
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
      top: 0; left: 0; right: 0; bottom: 0;
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
    .content { padding: 48px 32px; background: #ffffff; }
    .greeting { font-size: 20px; color: #1a2938; margin-bottom: 24px; font-weight: 600; }
    .intro-text { font-size: 16px; color: #475569; margin-bottom: 28px; line-height: 1.8; }
    .trial-info-box {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .trial-info-box h2 { font-size: 18px; color: #1a2938; margin-bottom: 16px; font-weight: 600; }
    .trial-info-box p { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 12px; }
    .trial-date { font-size: 16px; font-weight: 600; color: #0da472; margin-top: 8px; }
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
    .cta-button:hover { box-shadow: 0 6px 16px rgba(13, 164, 114, 0.4); }
    .no-charge-note {
      background: #f8fafc;
      border: 1px solid rgba(13, 164, 114, 0.15);
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .no-charge-note p { font-size: 14px; color: #64748b; margin: 0; line-height: 1.6; }
    .no-charge-note strong { color: #0da472; font-weight: 600; }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text { font-size: 14px; color: #64748b; margin-bottom: 12px; }
    .signature { font-size: 15px; color: #1a2938; margin-top: 20px; font-weight: 500; }
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
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .intro-text { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .trial-info-box { padding: 20px; margin: 24px 0; }
      .trial-info-box h2 { font-size: 16px; margin-bottom: 12px; }
      .trial-info-box p { font-size: 14px; line-height: 1.6; }
      .trial-date { font-size: 14px; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .no-charge-note { padding: 16px; margin: 20px 0; }
      .no-charge-note p { font-size: 13px; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Pro Access Continues</h1>
      <p>Your trial converted successfully</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey, {{first_name|there!}}!</p>
      
      <p class="intro-text">
        You’re officially on YieldCanary Pro now—your trial has ended and your subscription is active.
      </p>
      
      <div class="trial-info-box">
        <h2>📌 Your Plan</h2>
        <p>You’re currently on the <strong>{{tier|Pro}}</strong> plan.</p>
        <p class="trial-date">Pro insights stay unlocked.</p>
      </div>
      
      <p style="text-align: center; margin-top: 32px;">
        <a href="https://yieldcanary.com" class="cta-button">Open Your Dashboard</a>
      </p>
      
      <div class="no-charge-note">
        <p>
          <strong>Need help?</strong> Reply to this email anytime—we’re here.
        </p>
      </div>
      
      <p class="intro-text" style="margin-top: 32px; font-size: 14px; color: #64748b;">
        Thank you for supporting YieldCanary.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Welcome to Pro.</p>
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
  {
    id: 'payment_failed',
    title: 'Payment Failed',
    subject: 'Payment issue — action needed to keep Pro active',
    previewText: 'Your payment didn’t go through. Please update your billing details.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
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
      top: 0; left: 0; right: 0; bottom: 0;
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
    .content { padding: 48px 32px; background: #ffffff; }
    .greeting { font-size: 20px; color: #1a2938; margin-bottom: 24px; font-weight: 600; }
    .intro-text { font-size: 16px; color: #475569; margin-bottom: 28px; line-height: 1.8; }
    .trial-info-box {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .trial-info-box h2 { font-size: 18px; color: #1a2938; margin-bottom: 16px; font-weight: 600; }
    .trial-info-box p { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 12px; }
    .trial-date { font-size: 14px; font-weight: 600; color: #64748b; margin-top: 8px; }
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
    .cta-button:hover { box-shadow: 0 6px 16px rgba(13, 164, 114, 0.4); }
    .no-charge-note {
      background: #f8fafc;
      border: 1px solid rgba(13, 164, 114, 0.15);
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .no-charge-note p { font-size: 14px; color: #64748b; margin: 0; line-height: 1.6; }
    .no-charge-note strong { color: #0da472; font-weight: 600; }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text { font-size: 14px; color: #64748b; margin-bottom: 12px; }
    .signature { font-size: 15px; color: #1a2938; margin-top: 20px; font-weight: 500; }
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
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .intro-text { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .trial-info-box { padding: 20px; margin: 24px 0; }
      .trial-info-box h2 { font-size: 16px; margin-bottom: 12px; }
      .trial-info-box p { font-size: 14px; line-height: 1.6; }
      .cta-button { padding: 14px 32px; font-size: 14px; margin: 24px 0; }
      .no-charge-note { padding: 16px; margin: 20px 0; }
      .no-charge-note p { font-size: 13px; }
      .footer { padding: 24px 20px; }
      .footer-text { font-size: 13px; }
      .signature { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Payment Failed</h1>
      <p>Update your billing to keep Pro</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey, {{first_name|there!}}!</p>
      
      <p class="intro-text">
        We tried to process your subscription payment, but it didn’t go through.
      </p>
      
      <div class="trial-info-box">
        <h2>Details</h2>
        <p>Please update your payment method to avoid interruptions to Pro access.</p>
        <p class="trial-date">Invoice: {{invoice_id|—}}</p>
      </div>
      
      <p style="text-align: center; margin-top: 32px;">
        <a href="https://yieldcanary.com" class="cta-button">Fix Billing</a>
      </p>
      
      <div class="no-charge-note">
        <p>
          <strong>Tip:</strong> If your bank blocked the charge, try another card or contact your bank.
        </p>
      </div>
      
      <p class="intro-text" style="margin-top: 32px; font-size: 14px; color: #64748b;">
        If you need help, reply to this email—we’ll assist.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">We’ll keep trying for a short time, but updating billing is the fastest fix.</p>
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
  {
    id: 'subscription_cancelled',
    title: 'Subscription Cancelled',
    subject: 'Your YieldCanary subscription has been cancelled',
    previewText: 'Your account is now on the free plan.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Cancelled</title>
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
      top: 0; left: 0; right: 0; bottom: 0;
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
    .content { padding: 48px 32px; background: #ffffff; }
    .greeting { font-size: 20px; color: #1a2938; margin-bottom: 24px; font-weight: 600; }
    .intro-text { font-size: 16px; color: #475569; margin-bottom: 28px; line-height: 1.8; }
    .trial-info-box {
      background: linear-gradient(135deg, rgba(13, 164, 114, 0.08) 0%, rgba(26, 140, 216, 0.08) 100%);
      border: 1px solid rgba(13, 164, 114, 0.2);
      border-left: 4px solid #0da472;
      padding: 28px;
      margin: 32px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(13, 164, 114, 0.1);
    }
    .trial-info-box h2 { font-size: 18px; color: #1a2938; margin-bottom: 16px; font-weight: 600; }
    .trial-info-box p { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 12px; }
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
    .cta-button:hover { box-shadow: 0 6px 16px rgba(13, 164, 114, 0.4); }
    .footer {
      background: #f8fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid rgba(13, 164, 114, 0.1);
    }
    .footer-text { font-size: 14px; color: #64748b; margin-bottom: 12px; }
    .signature { font-size: 15px; color: #1a2938; margin-top: 20px; font-weight: 500; }
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
      .greeting { font-size: 18px; margin-bottom: 20px; }
      .intro-text { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .trial-info-box { padding: 20px; margin: 24px 0; }
      .trial-info-box h2 { font-size: 16px; margin-bottom: 12px; }
      .trial-info-box p { font-size: 14px; line-height: 1.6; }
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
      <h1>🧾 Subscription Cancelled</h1>
      <p>Your account has been moved to Free</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey, {{first_name|there!}}!</p>
      
      <p class="intro-text">
        Your YieldCanary subscription has been cancelled, and your account is now on the free plan.
      </p>
      
      <div class="trial-info-box">
        <h2>Plan Status</h2>
        <p>Previous plan: <strong>{{tier|Pro}}</strong></p>
        <p style="margin-top: 12px;">You can resubscribe anytime to unlock Pro features again.</p>
      </div>
      
      <p style="text-align: center; margin-top: 32px;">
        <a href="https://yieldcanary.com" class="cta-button">Open YieldCanary</a>
      </p>
      
      <p class="intro-text" style="margin-top: 32px; font-size: 14px; color: #64748b;">
        If this was a mistake, reply to this email and we’ll help.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">Thanks for using YieldCanary.</p>
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
