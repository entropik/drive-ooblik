const nodemailer = require('nodemailer');
const { query } = require('../config/database');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.config = null;
  }

  // Récupérer la configuration SMTP depuis la base de données
  async getConfig() {
    try {
      const result = await query(`
        SELECT value FROM config WHERE key = 'smtp_config'
      `);

      if (result.rows.length === 0) {
        logger.warn('Configuration SMTP non trouvée en base, utilisation des variables d\'environnement');
        return {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          from: {
            name: process.env.SMTP_FROM_NAME || 'Drive Ooblik',
            address: process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER
          }
        };
      }

      return result.rows[0].value;
    } catch (error) {
      logger.error('Erreur lors de la récupération de la config SMTP:', error);
      throw new Error('Configuration SMTP indisponible');
    }
  }

  // Initialiser le transporteur avec la configuration
  async initialize() {
    try {
      this.config = await this.getConfig();

      if (!this.config?.host || !this.config?.auth?.user) {
        throw new Error('Configuration SMTP incomplète');
      }

      this.transporter = nodemailer.createTransporter({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.auth.user,
          pass: this.config.auth.pass
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      });

      logger.info('Service email initialisé avec succès');
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du service email:', error);
      throw error;
    }
  }

  // Tester la connexion SMTP
  async testConnection(customConfig = null) {
    try {
      const config = customConfig || await this.getConfig();

      const testTransporter = nodemailer.createTransporter({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass
        }
      });

      await testTransporter.verify();
      logger.info('Test de connexion SMTP réussi');
      return { success: true, message: 'Connexion SMTP réussie' };
    } catch (error) {
      logger.error('Test de connexion SMTP échoué:', error);
      return {
        success: false,
        error: error.message,
        details: {
          code: error.code,
          response: error.response
        }
      };
    }
  }

  // Envoyer un email de lien magique
  async sendMagicLinkEmail(email, token, spaceName) {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      const magicLink = `${process.env.API_BASE_URL}/api/auth/consume?token=${token}`;
      const fromAddress = this.config.from?.address || this.config.auth.user;
      const fromName = this.config.from?.name || 'Drive Ooblik';

      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: `Accès à votre espace "${spaceName}" - Drive Ooblik`,
        html: this.generateMagicLinkEmailTemplate(spaceName, magicLink),
        text: this.generateMagicLinkEmailText(spaceName, magicLink)
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email de lien magique envoyé:', {
        to: email,
        spaceName,
        messageId: info.messageId
      });

      return {
        success: true,
        messageId: info.messageId,
        message: 'Email envoyé avec succès'
      };
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de l\'email:', error);
      throw new Error(`Erreur lors de l'envoi de l'email: ${error.message}`);
    }
  }

  // Envoyer un email de test
  async sendTestEmail(email, customConfig = null) {
    try {
      const config = customConfig || await this.getConfig();

      const testTransporter = nodemailer.createTransporter({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass
        }
      });

      const fromAddress = config.from?.address || config.auth.user;
      const fromName = config.from?.name || 'Drive Ooblik';

      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Test de configuration SMTP - Drive Ooblik',
        html: `
          <h2>Test de configuration SMTP réussi!</h2>
          <p>Si vous recevez cet email, votre configuration SMTP fonctionne correctement.</p>
          <hr>
          <p><small>Drive Ooblik - Plateforme de transfert de fichiers</small></p>
        `,
        text: `
Test de configuration SMTP réussi!

Si vous recevez cet email, votre configuration SMTP fonctionne correctement.

Drive Ooblik - Plateforme de transfert de fichiers
        `
      };

      const info = await testTransporter.sendMail(mailOptions);

      logger.info('Email de test envoyé:', {
        to: email,
        messageId: info.messageId
      });

      return {
        success: true,
        messageId: info.messageId,
        message: 'Email de test envoyé avec succès'
      };
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de l\'email de test:', error);
      throw new Error(`Erreur lors de l'envoi de l'email de test: ${error.message}`);
    }
  }

  // Template HTML pour le lien magique
  generateMagicLinkEmailTemplate(spaceName, magicLink) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accès à votre espace ${spaceName}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 30px; }
    .button { display: inline-block; background: #007bff; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Drive Ooblik</h1>
      <h2>Accès à votre espace "${spaceName}"</h2>
    </div>

    <p>Bonjour,</p>

    <p>Vous avez demandé l'accès à votre espace de transfert de fichiers "<strong>${spaceName}</strong>".</p>

    <p>Cliquez sur le bouton ci-dessous pour accéder à votre espace :</p>

    <p style="text-align: center;">
      <a href="${magicLink}" class="button">Accéder à mon espace</a>
    </p>

    <p>Ou copiez ce lien dans votre navigateur :</p>
    <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">${magicLink}</p>

    <div class="warning">
      <p><strong>⚠️ Important :</strong></p>
      <ul>
        <li>Ce lien est valable pendant 6 heures</li>
        <li>Il ne peut être utilisé qu'une seule fois</li>
        <li>Votre session durera 4 heures après connexion</li>
      </ul>
    </div>

    <p>Si vous n'avez pas demandé cet accès, ignorez simplement cet email.</p>

    <div class="footer">
      <p>Drive Ooblik - Plateforme de transfert de fichiers sécurisée</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // Version texte pour le lien magique
  generateMagicLinkEmailText(spaceName, magicLink) {
    return `
Drive Ooblik - Accès à votre espace "${spaceName}"

Bonjour,

Vous avez demandé l'accès à votre espace de transfert de fichiers "${spaceName}".

Cliquez sur ce lien pour accéder à votre espace :
${magicLink}

IMPORTANT :
- Ce lien est valable pendant 6 heures
- Il ne peut être utilisé qu'une seule fois
- Votre session durera 4 heures après connexion

Si vous n'avez pas demandé cet accès, ignorez simplement cet email.

Drive Ooblik - Plateforme de transfert de fichiers sécurisée
    `;
  }
}

// Singleton
const emailService = new EmailService();

module.exports = emailService;