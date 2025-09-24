import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  try {
    // Only allow POST requests from cron jobs or admin
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Clean up expired magic tokens for security
    const { data: expiredSpaces, error: selectError } = await supabase
      .from('spaces')
      .select('id, email, space_name')
      .lt('token_expires_at', new Date().toISOString())
      .not('magic_token', 'is', null);

    if (selectError) {
      console.error('Error selecting expired tokens:', selectError);
      return new Response(JSON.stringify({ error: 'Database error' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (expiredSpaces && expiredSpaces.length > 0) {
      // Clear expired tokens and reset authentication status
      const { error: updateError } = await supabase
        .from('spaces')
        .update({
          magic_token: null,
          token_expires_at: null,
          is_authenticated: false
        })
        .lt('token_expires_at', new Date().toISOString())
        .not('magic_token', 'is', null);

      if (updateError) {
        console.error('Error cleaning expired tokens:', updateError);
        return new Response(JSON.stringify({ error: 'Cleanup failed' }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Log the cleanup for security audit
      await supabase.from('logs').insert({
        event_type: 'auth',
        details: { 
          action: 'expired_token_cleanup', 
          cleaned_count: expiredSpaces.length,
          timestamp: new Date().toISOString()
        },
        ip_address: '127.0.0.1',
        user_agent: 'token_cleanup_service'
      });

      console.log(`✅ Cleaned up ${expiredSpaces.length} expired tokens`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        cleaned_count: expiredSpaces.length,
        message: 'Expired tokens cleaned successfully'
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      cleaned_count: 0,
      message: 'No expired tokens to clean'
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error in cleanup-expired-tokens:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
});