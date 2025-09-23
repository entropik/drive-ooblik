import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MagicLinkRequest {
  email: string;
  space_name: string;
  hcaptcha_token: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyHCaptcha(token: string): Promise<boolean> {
  try {
    // Note: En production, vous devrez configurer votre clé secrète hCaptcha
    const hcaptchaSecret = Deno.env.get('HCAPTCHA_SECRET_KEY');
    if (!hcaptchaSecret) {
      console.warn('hCaptcha not configured, skipping verification');
      return true; // En dev, on skip la vérification
    }

    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${hcaptchaSecret}&response=${token}`
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('hCaptcha verification error:', error);
    return false;
  }
}

async function sendMagicLinkEmail(email: string, token: string, spaceName: string) {
  try {
    // Récupération de la config SMTP
    const { data: smtpConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'smtp_config')
      .single();

    if (!smtpConfig?.value) {
      throw new Error('Configuration SMTP manquante');
    }

    const config = smtpConfig.value as any;
    const magicLink = `${Deno.env.get('SUPABASE_URL')}/functions/v1/auth-consume?token=${token}`;
    
    // Pour le moment, on log le lien magic (en prod, utilisez un service d'email)
    console.log(`Magic link pour ${email} (espace: ${spaceName}): ${magicLink}`);
    
    // TODO: Implémenter l'envoi d'email réel avec Nodemailer ou Resend
    // const transporter = nodemailer.createTransporter(config);
    // await transporter.sendMail({
    //   from: config.user,
    //   to: email,
    //   subject: `Accès à votre espace ${spaceName}`,
    //   html: `<p>Cliquez <a href="${magicLink}">ici</a> pour accéder à votre espace.</p>`
    // });

    return true;
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { email, space_name, hcaptcha_token }: MagicLinkRequest = await req.json();

    if (!email || !space_name) {
      return new Response(
        JSON.stringify({ error: 'Email et nom d\'espace requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérification hCaptcha
    const isValidCaptcha = await verifyHCaptcha(hcaptcha_token);
    if (!isValidCaptcha) {
      return new Response(
        JSON.stringify({ error: 'Vérification hCaptcha échouée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Génération du token magic
    const magicToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Création ou mise à jour de l'espace
    const { data: existingSpace } = await supabase
      .from('spaces')
      .select('id')
      .eq('email', email)
      .eq('space_name', space_name)
      .single();

    let spaceId;
    if (existingSpace) {
      // Mise à jour du token existant
      const { data } = await supabase
        .from('spaces')
        .update({
          magic_token: magicToken,
          token_expires_at: expiresAt.toISOString(),
          is_authenticated: false
        })
        .eq('id', existingSpace.id)
        .select('id')
        .single();
      spaceId = data?.id;
    } else {
      // Création d'un nouvel espace
      const { data } = await supabase
        .from('spaces')
        .insert({
          email,
          space_name,
          magic_token: magicToken,
          token_expires_at: expiresAt.toISOString(),
          is_authenticated: false
        })
        .select('id')
        .single();
      spaceId = data?.id;
    }

    // Log de l'événement
    await supabase.from('logs').insert({
      event_type: 'auth',
      space_id: spaceId,
      details: { action: 'magic_link_requested', email, space_name },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    });

    // Envoi du lien magic
    const emailSent = await sendMagicLinkEmail(email, magicToken, space_name);
    
    if (!emailSent) {
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'envoi de l\'email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Lien d\'accès envoyé par email',
        // En dev, on retourne le token pour faciliter les tests
        ...(Deno.env.get('NODE_ENV') === 'development' && { magic_token: magicToken })
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erreur dans auth-magic-link:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});