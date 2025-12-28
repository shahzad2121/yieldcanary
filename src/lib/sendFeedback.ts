import { supabase } from '@/integrations/supabase/client';

export async function sendFeedback({
  message,
  userEmail,
}: {
  message: string;
  userEmail: string;
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

    const response = await fetch(`${supabaseUrl}/functions/v1/send-feedback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        userEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send feedback:', error);
      throw new Error(error.error || 'Failed to send feedback');
    }

    const result = await response.json();
    console.log(`Feedback sent from ${userEmail}:`, result);
    return result;
  } catch (error) {
    console.error('Error sending feedback:', error);
    throw error;
  }
}