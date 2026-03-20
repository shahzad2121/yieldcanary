import type { TransactionalEmailTemplate } from "./transactionalTemplates.ts";

/**
 * Newsletter-related email templates
 * These templates are imported and merged into the main transactionalEmailTemplates array
 */
export const newsletterEmailTemplates: TransactionalEmailTemplate[] = [
  {
    id: 'newsletter_subscribed',
    title: 'Newsletter subscription confirmed',
    subject: 'You are subscribed to the YieldCanary Newsletter',
    previewText: 'Your weekly Monday newsletter is now active.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Subscribed - YieldCanary</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a2938;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid rgba(13,164,114,0.12);border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0da472 0%,#1a8cd8 100%);padding:28px 24px;color:#ffffff;text-align:center;">
              <h1 style="margin:0;font-size:24px;line-height:1.3;">Newsletter Subscription Confirmed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">Hi {{first_name|there}},</p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;">
                You are now subscribed to the YieldCanary Newsletter. You will receive your weekly email every Monday with key insights, movers, and buy-zone ideas.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.7;">
                You can manage or cancel this subscription any time from your account settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    id: 'newsletter_cancelled',
    title: 'Newsletter cancellation confirmed',
    subject: 'Your YieldCanary Newsletter is cancelled',
    previewText: 'Your newsletter subscription has been cancelled successfully.',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Cancelled - YieldCanary</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a2938;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid rgba(13,164,114,0.12);border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0da472 0%,#1a8cd8 100%);padding:28px 24px;color:#ffffff;text-align:center;">
              <h1 style="margin:0;font-size:24px;line-height:1.3;">Newsletter Cancelled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">Hi {{first_name|there}},</p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;">
                Your YieldCanary Newsletter subscription has been cancelled successfully.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.7;">
                If you want it back later, you can re-subscribe from your account at any time.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
];
