const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/database');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

class AdminController {
  // Connexion administrateur
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
      }

      // Vérifier les identifiants
      const result = await query(`
        SELECT id, username, password_hash, email, is_active
        FROM admin_users
        WHERE username = $1 AND is_active = true
      `, [username]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      const admin = result.rows[0];

      // Vérifier le mot de passe
      const isValidPassword = await bcrypt.compare(password, admin.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Générer un token de session admin
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + (parseInt(process.env.JWT_ADMIN_EXPIRES_IN?.replace('h', '')) || 24) * 60 * 60 * 1000);

      await withTransaction(async (client) => {
        // Créer la session admin
        await client.query(`
          INSERT INTO admin_sessions (admin_user_id, session_token, expires_at, is_active)
          VALUES ($1, $2, $3, true)
        `, [admin.id, sessionToken, expiresAt.toISOString()]);

        // Mettre à jour la date de dernière connexion
        await client.query(`
          UPDATE admin_users SET last_login_at = NOW() WHERE id = $1
        `, [admin.id]);

        // Logger la connexion
        await client.query(`
          INSERT INTO logs (event_type, details, ip_address, user_agent)
          VALUES ($1, $2, $3, $4)
        `, [
          'admin_login',
          { admin_id: admin.id, username: admin.username },
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
          req.headers['user-agent'] || 'unknown'
        ]);
      });

      // Définir le cookie de session
      res.cookie('admin_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: (parseInt(process.env.JWT_ADMIN_EXPIRES_IN?.replace('h', '')) || 24) * 60 * 60 * 1000
      });

      res.json({
        success: true,
        token: sessionToken,
        expires_at: expiresAt.toISOString(),
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          last_login_at: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la connexion admin:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
    }
  }

  // Déconnexion administrateur
  async logout(req, res) {
    try {
      const { admin } = req;

      // Invalider la session
      await query(`
        UPDATE admin_sessions
        SET is_active = false
        WHERE session_token = $1
      `, [admin.sessionToken]);

      // Logger la déconnexion
      await query(`
        INSERT INTO logs (event_type, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
      `, [
        'admin_logout',
        { admin_id: admin.id, username: admin.username },
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        req.headers['user-agent'] || 'unknown'
      ]);

      // Supprimer le cookie
      res.clearCookie('admin_session');

      res.json({ success: true, message: 'Déconnexion réussie' });
    } catch (error) {
      logger.error('Erreur lors de la déconnexion admin:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la déconnexion' });
    }
  }

  // Vérifier une session administrateur
  async verify(req, res) {
    try {
      const { admin } = req;

      res.json({
        success: true,
        message: 'Session valide',
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la vérification de session admin:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la vérification' });
    }
  }

  // Récupérer ou sauvegarder la configuration
  async config(req, res) {
    try {
      const { action, key, value } = req.body;

      if (!action || !key) {
        return res.status(400).json({ error: 'Action et clé requises' });
      }

      if (action === 'get_config') {
        const result = await query(`
          SELECT value FROM config WHERE key = $1
        `, [key]);

        const configValue = result.rows.length > 0 ? result.rows[0].value : null;

        res.json({
          success: true,
          key,
          value: configValue
        });
      } else if (action === 'save_config') {
        if (value === undefined) {
          return res.status(400).json({ error: 'Valeur requise pour la sauvegarde' });
        }

        await query(`
          INSERT INTO config (key, value, created_at, updated_at)
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (key)
          DO UPDATE SET value = $2, updated_at = NOW()
        `, [key, JSON.stringify(value)]);

        // Logger la modification de configuration
        await query(`
          INSERT INTO logs (event_type, details, ip_address, user_agent)
          VALUES ($1, $2, $3, $4)
        `, [
          'admin_config',
          { admin_id: req.admin.id, action: 'save_config', key },
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
          req.headers['user-agent'] || 'unknown'
        ]);

        res.json({
          success: true,
          message: 'Configuration sauvegardée avec succès'
        });
      } else {
        res.status(400).json({ error: 'Action non reconnue' });
      }
    } catch (error) {
      logger.error('Erreur lors de la gestion de configuration:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la gestion de configuration' });
    }
  }

  // Mettre à jour le profil admin
  async update(req, res) {
    try {
      const { action, newPassword, email } = req.body;
      const { admin } = req;

      if (!action) {
        return res.status(400).json({ error: 'Action requise' });
      }

      if (action === 'update_password') {
        if (!newPassword || newPassword.length < 6) {
          return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        // Hasher le nouveau mot de passe
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        await query(`
          UPDATE admin_users
          SET password_hash = $1, updated_at = NOW()
          WHERE id = $2
        `, [hashedPassword, admin.id]);

        // Logger la modification
        await query(`
          INSERT INTO logs (event_type, details, ip_address, user_agent)
          VALUES ($1, $2, $3, $4)
        `, [
          'admin_update',
          { admin_id: admin.id, action: 'password_changed' },
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
          req.headers['user-agent'] || 'unknown'
        ]);

        res.json({
          success: true,
          message: 'Mot de passe mis à jour avec succès'
        });
      } else if (action === 'update_email') {
        if (!email || !email.includes('@')) {
          return res.status(400).json({ error: 'Email valide requis' });
        }

        await query(`
          UPDATE admin_users
          SET email = $1, updated_at = NOW()
          WHERE id = $2
        `, [email, admin.id]);

        // Logger la modification
        await query(`
          INSERT INTO logs (event_type, details, ip_address, user_agent)
          VALUES ($1, $2, $3, $4)
        `, [
          'admin_update',
          { admin_id: admin.id, action: 'email_changed', new_email: email },
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
          req.headers['user-agent'] || 'unknown'
        ]);

        res.json({
          success: true,
          message: 'Email mis à jour avec succès'
        });
      } else {
        res.status(400).json({ error: 'Action non reconnue' });
      }
    } catch (error) {
      logger.error('Erreur lors de la mise à jour admin:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la mise à jour' });
    }
  }

  // Test de configuration SMTP
  async testSmtp(req, res) {
    try {
      const { email, config } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email de destination requis' });
      }

      // Utiliser la config fournie ou celle par défaut
      const testResult = await emailService.testConnection(config);

      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Test de connexion SMTP échoué',
          details: testResult
        });
      }

      // Si la connexion est OK, envoyer un email de test
      const emailResult = await emailService.sendTestEmail(email, config);

      // Logger le test
      await query(`
        INSERT INTO logs (event_type, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
      `, [
        'admin_smtp_test',
        {
          admin_id: req.admin.id,
          test_email: email,
          success: emailResult.success,
          message_id: emailResult.messageId
        },
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        req.headers['user-agent'] || 'unknown'
      ]);

      res.json({
        success: true,
        message: 'Email de test envoyé avec succès',
        messageId: emailResult.messageId
      });
    } catch (error) {
      logger.error('Erreur lors du test SMTP:', error);
      res.status(400).json({
        success: false,
        error: 'Erreur lors du test SMTP',
        details: error.message
      });
    }
  }

  // Récupérer les statistiques du dashboard
  async getDashboard(req, res) {
    try {
      // Statistiques générales
      const [spacesResult, filesResult, uploadsResult, logsResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM spaces'),
        query('SELECT COUNT(*) as count, SUM(file_size) as total_size FROM files WHERE upload_status = \'completed\''),
        query('SELECT COUNT(*) as count FROM files WHERE upload_status = \'completed\' AND created_at > NOW() - INTERVAL \'24 hours\''),
        query('SELECT COUNT(*) as count FROM logs WHERE created_at > NOW() - INTERVAL \'24 hours\'')
      ]);

      // Activité récente
      const recentActivity = await query(`
        SELECT event_type, details, ip_address, created_at
        FROM logs
        WHERE created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      // Espaces les plus actifs
      const activeSpaces = await query(`
        SELECT s.space_name, COUNT(f.id) as file_count, SUM(f.file_size) as total_size
        FROM spaces s
        LEFT JOIN files f ON f.space_id = s.id AND f.upload_status = 'completed'
        GROUP BY s.id, s.space_name
        ORDER BY file_count DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        dashboard: {
          stats: {
            totalSpaces: parseInt(spacesResult.rows[0].count),
            totalFiles: parseInt(filesResult.rows[0].count),
            totalSize: parseInt(filesResult.rows[0].total_size || 0),
            uploadsToday: parseInt(uploadsResult.rows[0].count),
            activityToday: parseInt(logsResult.rows[0].count)
          },
          recentActivity: recentActivity.rows,
          activeSpaces: activeSpaces.rows
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération du dashboard:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la récupération du dashboard' });
    }
  }
}

module.exports = new AdminController();