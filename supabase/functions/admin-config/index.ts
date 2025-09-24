import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-session',
};

// Initialize Supabase client with service role key
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Extract session token from request
function extractToken(req: Request): string | null {
  const cookie = req.headers.get('cookie');
  if (cookie) {
    const match = cookie.match(/admin_session=([^;]+)/);
    if (match) return match[1];
  }
  
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Support custom header to avoid JWT gateway issues
  const customHeader = req.headers.get('x-admin-session');
  if (customHeader) return customHeader;
  
  return null;
}

serve(async (req: Request) => {
  console.log(`[admin-config] ${req.method} request received`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { action, key, value } = await req.json();
    console.log(`[admin-config] Action: ${action}, Key: ${key}`);

    // Extract and validate session token
    const sessionToken = extractToken(req);
    if (!sessionToken) {
      console.log('[admin-config] No session token found');
      return new Response(
        JSON.stringify({ error: 'No session token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin session
    console.log('[admin-config] Verifying admin session');
    const { data: sessionData, error: sessionError } = await supabase.rpc('verify_admin_session', {
      p_session_token: sessionToken
    });

    if (sessionError) {
      console.error('[admin-config] Session verification error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session verification failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      console.log('[admin-config] Invalid session');
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-config] Session validated for user:', sessionData[0].username);

    if (action === 'save_config') {
      // Save configuration
      console.log(`[admin-config] Saving config for key: ${key}`);
      
      const { error: configError } = await supabase
        .from('config')
        .upsert({
          key: key,
          value: value,
          updated_at: new Date().toISOString()
        });

      if (configError) {
        console.error('[admin-config] Config save error:', configError);
        return new Response(
          JSON.stringify({ error: 'Failed to save configuration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[admin-config] Configuration saved successfully');
      return new Response(
        JSON.stringify({ success: true, message: 'Configuration saved successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get_config') {
      // Get configuration
      console.log(`[admin-config] Getting config for key: ${key}`);
      
      const { data: configData, error: configError } = await supabase
        .from('config')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (configError) {
        console.error('[admin-config] Config get error:', configError);
        return new Response(
          JSON.stringify({ error: 'Failed to get configuration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[admin-config] Configuration retrieved successfully');
      return new Response(
        JSON.stringify({ success: true, data: configData?.value || null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[admin-config] Internal server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});