import { supabase } from '@/integrations/supabase/client';

export async function sendSupportRequest({
  name,
  email,
  message,
}: {
  name?: string;
  email: string;
  message: string;
}) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not set');
    }

    // Get current session for authorization
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if session exists
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-support-request`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: name || undefined,
        email,
        message,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send support request:', error);
      throw new Error(error.error || 'Failed to send support request');
    }

    const result = await response.json();
    console.log(`Support request sent from ${email}:`, result);
    return result;
  } catch (error) {
    console.error('Error sending support request:', error);
    throw error;
  }
}
