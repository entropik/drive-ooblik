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

// Security: Hash magic tokens before storing in database
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function verifyHCaptcha(token: string): Promise<boolean> {
  try {
    const environment = Deno.env.get('ENVIRONMENT') || 'development';
    if (environment !== 'production') {
      console.warn('hCaptcha verification bypassed in non-production environment:', environment);
      return true; // Bypass in preview/dev to avoid test key/secret mismatch
    }

    // Note: En production, vous devrez configurer votre clé secrète hCaptcha
    const hcaptchaSecret = Deno.env.get('HCAPTCHA_SECRET_KEY');
    console.log('hCaptcha verification - Secret exists:', !!hcaptchaSecret);
    console.log('hCaptcha verification - Token received:', !!token);
    
    if (!hcaptchaSecret) {
      console.warn('hCaptcha not configured, skipping verification');
      return true; // En dev, on skip la vérification
    }

    if (!token) {
      console.error('hCaptcha token is empty or undefined');
      return false;
    }

    console.log('Calling hCaptcha siteverify API...');
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${hcaptchaSecret}&response=${encodeURIComponent(token)}`
    });

    const result = await response.json();
    console.log('hCaptcha verification result:', result);
    return !!result.success;
  } catch (error) {
    console.error('hCaptcha verification error:', error);
    return false;
  }
}

async function sendMagicLinkEmail(email: string, token: string, spaceName: string): Promise<boolean> {
  try {
    // Récupération de la config SMTP
    const { data: smtpConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'smtp_config')
      .single();

    if (!smtpConfig?.value) {
      console.warn('Configuration SMTP manquante, lien affiché uniquement');
      return false;
    }

    const config = smtpConfig.value as any;
    const magicLink = `${Deno.env.get('SUPABASE_URL')}/functions/v1/auth-consume?token=${token}`;
    
    console.log(`Envoi magic link pour ${email} (espace: ${spaceName})`);
    
    // Utiliser nodemailer avec la configuration SMTP
    const nodemailer = await import('npm:nodemailer@6.9.7');
    
    const createTransport = (nodemailer as any).createTransport || (nodemailer as any).default?.createTransport;
    if (!createTransport) {
      throw new Error('Nodemailer createTransport not available');
    }
    
    const transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const emailContent = {
      from: `${config.from.name} <${config.from.address}>`,
      to: email,
      subject: `🔑 Accès à votre espace "${spaceName}" - Ooblik S3 Manager`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Accès sécurisé - Ooblik</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">🔑 Accès sécurisé</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Votre lien d'accès est prêt</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #333; margin-bottom: 25px;">
      Bonjour ! Voici votre lien d'accès sécurisé pour l'espace <strong>"${spaceName}"</strong>.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLink}" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        🚀 Accéder à mon espace
      </a>
    </div>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 25px 0;">
      <h3 style="margin-top: 0; color: #28a745; font-size: 14px;">ℹ️ Informations importantes :</h3>
      <ul style="color: #666; line-height: 1.6; font-size: 14px; margin: 10px 0; padding-left: 20px;">
        <li>Ce lien est valide pendant <strong>6 heures</strong></li>
        <li>Il ne peut être utilisé qu'une seule fois</li>
        <li>Gardez ce lien confidentiel</li>
        <li>Aucune installation requise, tout fonctionne dans votre navigateur</li>
      </ul>
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        📧 Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
      </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center; margin: 15px 0 0 0;">
      Ooblik S3 Manager - Plateforme sécurisée de transfert de fichiers<br>
      <a href="${magicLink}" style="color: #667eea; text-decoration: none;">Lien direct : ${magicLink}</a>
    </p>
  </div>
</body>
</html>`
    };

    await transporter.sendMail(emailContent);
    console.log(`✅ Email envoyé avec succès à ${email}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
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

    // Validation email plus stricte
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Format d\'email invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limitation de taux par IP (max 5 tentatives par heure)
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { count } = await supabase
      .from('logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'auth')
      .eq('ip_address', clientIP)
      .gte('created_at', hourAgo.toISOString());

    if (count && count >= 5) {
      return new Response(
        JSON.stringify({ error: 'Trop de tentatives. Réessayez dans une heure.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    const hashedToken = await hashToken(magicToken); // Hash token for secure storage
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6h for better security

    // Création ou mise à jour de l'espace (sans email dans spaces)
    const { data: existingSpace } = await supabase
      .from('spaces')
      .select('id')
      .eq('space_name', space_name)
      .single();

    let spaceId;
    if (existingSpace) {
      // Espace existant - mise à jour du token
      const { data } = await supabase
        .from('spaces')
        .update({
          magic_token: hashedToken,
          token_expires_at: expiresAt.toISOString(),
          is_authenticated: false
        })
        .eq('id', existingSpace.id)
        .select('id')
        .single();
      spaceId = data?.id;

      // Mettre à jour l'email dans la table privée si nécessaire
      await supabase
        .from('spaces_private')
        .upsert({ space_id: existingSpace.id, email }, { onConflict: 'space_id' });
    } else {
      // Création d'un nouvel espace (sans email dans spaces)
      const { data } = await supabase
        .from('spaces')
        .insert({
          space_name,
          magic_token: hashedToken,
          token_expires_at: expiresAt.toISOString(),
          is_authenticated: false
        })
        .select('id')
        .single();
      spaceId = data?.id;

      // Stocker l'email dans la table privée sécurisée
      if (spaceId) {
        await supabase
          .from('spaces_private')
          .insert({ space_id: spaceId, email });
      }
    }

    // Log de l'événement
    await supabase.from('logs').insert({
      event_type: 'auth',
      space_id: spaceId,
      details: { action: 'magic_link_requested', email, space_name },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    });

    // Modifier l'envoi du lien magic pour utiliser la config SMTP
    const emailSent = await sendMagicLinkEmail(email, magicToken, space_name);
    
    if (!emailSent) {
      console.warn('Erreur envoi email, mais magic link généré');
    }

    // Prepare response - only expose token in development
    const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';
    const responseData: any = { 
      success: true, 
      message: emailSent ? 'Lien d\'accès envoyé par email' : 'Lien d\'accès généré (email non envoyé)'
    };

    // Only expose sensitive data in development
    if (isDevelopment) {
      responseData.magic_token = magicToken;
      responseData.magic_link = `${Deno.env.get('SUPABASE_URL')}/functions/v1/auth-consume?token=${magicToken}`;
    }

    return new Response(
      JSON.stringify(responseData),
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