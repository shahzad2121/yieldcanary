/**
 * Browser Console Script to Send Test Emails
 * 
 * Copy and paste this entire script into your browser console on the YieldCanary app
 * Make sure you're logged in first!
 * 
 * This will send:
 * 1. Welcome email (welcome_verify template)
 * 2. Payment receipt email (payment_receipt template)
 * 
 * Both emails will use "Adam" as the first_name and send to rfish14@gmail.com
 */

(async function() {
  const clientEmail = 'connect2abdulaziz@gmail.com';
  const firstName = 'Abdulaziz';
  
  // Get Supabase URL - try to find it from localStorage keys or use default
  let supabaseUrl = 'https://hlwpasiewplmjvrtuuxf.supabase.co';
  
  // Try to find Supabase URL from localStorage keys
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.includes('auth-token')) {
        // Extract project ref from key: sb-{project-ref}-auth-token
        const projectRef = key.split('-')[1];
        supabaseUrl = `https://${projectRef}.supabase.co`;
        break;
      }
    }
  } catch (e) {
    console.warn('Using default Supabase URL');
  }
  
  console.log('🚀 Starting email send script...');
  console.log(`📧 Sending to: ${clientEmail}`);
  console.log(`👤 First name: ${firstName}`);
  console.log(`🔗 Supabase URL: ${supabaseUrl}`);
  
  // Get session token from localStorage
  const getSessionToken = () => {
    try {
      // Try to find the auth token in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          const authData = localStorage.getItem(key);
          if (authData) {
            const parsed = JSON.parse(authData);
            if (parsed?.access_token) {
              return parsed.access_token;
            }
            // Sometimes it's stored differently
            if (parsed?.currentSession?.access_token) {
              return parsed.currentSession.access_token;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not get session from localStorage:', e);
    }
    
    return null;
  };
  
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    console.error('❌ No session token found. Please make sure you are logged in!');
    return;
  }
  
  console.log('✅ Session token found');
  
  // Function to send email
  const sendEmail = async (templateId, templateName) => {
    try {
      console.log(`\n📨 Sending ${templateName}...`);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          to: clientEmail,
          templateId: templateId,
          data: {
            first_name: firstName,
          },
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error(`❌ Failed to send ${templateName}:`, error);
        return { success: false, error };
      }
      
      const result = await response.json();
      console.log(`✅ ${templateName} sent successfully!`, result);
      return { success: true, result };
    } catch (error) {
      console.error(`❌ Error sending ${templateName}:`, error);
      return { success: false, error };
    }
  };
  
  // Send both emails
  const results = {
    welcome: await sendEmail('welcome_verify', 'Welcome Email'),
    payment: await sendEmail('payment_receipt', 'Payment Receipt Email'),
  };
  
  // Summary
  console.log('\n📊 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Welcome Email: ${results.welcome.success ? '✅ Sent' : '❌ Failed'}`);
  console.log(`Payment Receipt Email: ${results.payment.success ? '✅ Sent' : '❌ Failed'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (results.welcome.success && results.payment.success) {
    console.log('\n🎉 All emails sent successfully!');
    console.log(`📬 Check ${clientEmail} for the emails.`);
  } else {
    console.log('\n⚠️ Some emails failed to send. Check the errors above.');
  }
})();

