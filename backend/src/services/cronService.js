const cron = require('node-cron');
const { query } = require('../config/database');
const logger = require('../config/logger');

class CronService {
  constructor() {
    this.jobs = [];
  }

  // Initialiser tous les jobs cron
  start() {
    logger.info('Démarrage des tâches planifiées...');

    // Nettoyage des sessions expirées - toutes les heures
    const sessionCleanup = cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredSessions();
    }, {
      scheduled: false,
      timezone: "Europe/Paris"
    });

    // Nettoyage des tokens magiques expirés - toutes les 4 heures
    const tokenCleanup = cron.schedule('0 */4 * * *', async () => {
      await this.cleanupExpiredTokens();
    }, {
      scheduled: false,
      timezone: "Europe/Paris"
    });

    // Nettoyage des logs anciens - tous les jours à 2h
    const logCleanup = cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldLogs();
    }, {
      scheduled: false,
      timezone: "Europe/Paris"
    });

    // Statistiques quotidiennes - tous les jours à 1h
    const dailyStats = cron.schedule('0 1 * * *', async () => {
      await this.generateDailyStats();
    }, {
      scheduled: false,
      timezone: "Europe/Paris"
    });

    this.jobs = [
      { name: 'sessionCleanup', job: sessionCleanup },
      { name: 'tokenCleanup', job: tokenCleanup },
      { name: 'logCleanup', job: logCleanup },
      { name: 'dailyStats', job: dailyStats }
    ];

    // Démarrer tous les jobs
    this.jobs.forEach(({ name, job }) => {
      job.start();
      logger.info(`Tâche planifiée '${name}' démarrée`);
    });

    logger.info(`${this.jobs.length} tâches planifiées démarrées avec succès`);
  }

  // Arrêter tous les jobs
  stop() {
    logger.info('Arrêt des tâches planifiées...');

    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`Tâche planifiée '${name}' arrêtée`);
    });

    this.jobs = [];
    logger.info('Toutes les tâches planifiées ont été arrêtées');
  }

  // Nettoyage des sessions expirées
  async cleanupExpiredSessions() {
    try {
      logger.info('Démarrage du nettoyage des sessions expirées...');

      // Marquer les sessions expirées comme inactives
      const expiredSessions = await query(`
        UPDATE user_sessions
        SET is_active = false
        WHERE expires_at < NOW() AND is_active = true
        RETURNING id
      `);

      // Supprimer les sessions expirées depuis plus de 7 jours
      const deletedSessions = await query(`
        DELETE FROM user_sessions
        WHERE expires_at < NOW() - INTERVAL '7 days'
        RETURNING id
      `);

      // Nettoyage des sessions admin expirées
      const expiredAdminSessions = await query(`
        UPDATE admin_sessions
        SET is_active = false
        WHERE expires_at < NOW() AND is_active = true
        RETURNING id
      `);

      const deletedAdminSessions = await query(`
        DELETE FROM admin_sessions
        WHERE expires_at < NOW() - INTERVAL '30 days'
        RETURNING id
      `);

      logger.info('Nettoyage des sessions terminé:', {
        expiredUserSessions: expiredSessions.rowCount,
        deletedUserSessions: deletedSessions.rowCount,
        expiredAdminSessions: expiredAdminSessions.rowCount,
        deletedAdminSessions: deletedAdminSessions.rowCount
      });

      // Logger l'événement
      await query(`
        INSERT INTO logs (event_type, details)
        VALUES ($1, $2)
      `, [
        'session_cleanup',
        {
          expired_user_sessions: expiredSessions.rowCount,
          deleted_user_sessions: deletedSessions.rowCount,
          expired_admin_sessions: expiredAdminSessions.rowCount,
          deleted_admin_sessions: deletedAdminSessions.rowCount
        }
      ]);
    } catch (error) {
      logger.error('Erreur lors du nettoyage des sessions:', error);
    }
  }

  // Nettoyage des tokens magiques expirés
  async cleanupExpiredTokens() {
    try {
      logger.info('Démarrage du nettoyage des tokens magiques expirés...');

      // Supprimer les tokens magiques expirés
      const result = await query(`
        UPDATE spaces
        SET magic_token = NULL, token_expires_at = NULL
        WHERE token_expires_at < NOW() AND magic_token IS NOT NULL
        RETURNING id, space_name
      `);

      logger.info('Nettoyage des tokens magiques terminé:', {
        cleanedTokens: result.rowCount
      });

      // Logger l'événement
      await query(`
        INSERT INTO logs (event_type, details)
        VALUES ($1, $2)
      `, [
        'cleanup_expired_tokens',
        { cleaned_tokens: result.rowCount }
      ]);
    } catch (error) {
      logger.error('Erreur lors du nettoyage des tokens:', error);
    }
  }

  // Nettoyage des logs anciens
  async cleanupOldLogs() {
    try {
      logger.info('Démarrage du nettoyage des logs anciens...');

      // Conserver les logs des 90 derniers jours
      const result = await query(`
        DELETE FROM logs
        WHERE created_at < NOW() - INTERVAL '90 days'
        RETURNING id
      `);

      logger.info('Nettoyage des logs terminé:', {
        deletedLogs: result.rowCount
      });

      // Logger l'événement (après le nettoyage)
      await query(`
        INSERT INTO logs (event_type, details)
        VALUES ($1, $2)
      `, [
        'log_cleanup',
        { deleted_logs: result.rowCount }
      ]);
    } catch (error) {
      logger.error('Erreur lors du nettoyage des logs:', error);
    }
  }

  // Générer les statistiques quotidiennes
  async generateDailyStats() {
    try {
      logger.info('Génération des statistiques quotidiennes...');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Collecter les statistiques
      const [
        newSpaces,
        completedUploads,
        totalSize,
        uniqueUsers,
        authAttempts,
        errors
      ] = await Promise.all([
        query(`SELECT COUNT(*) as count FROM spaces WHERE DATE(created_at) = $1`, [yesterdayStr]),
        query(`SELECT COUNT(*) as count FROM files WHERE DATE(completed_at) = $1 AND upload_status = 'completed'`, [yesterdayStr]),
        query(`SELECT COALESCE(SUM(file_size), 0) as total FROM files WHERE DATE(completed_at) = $1 AND upload_status = 'completed'`, [yesterdayStr]),
        query(`SELECT COUNT(DISTINCT ip_address) as count FROM logs WHERE DATE(created_at) = $1`, [yesterdayStr]),
        query(`SELECT COUNT(*) as count FROM logs WHERE DATE(created_at) = $1 AND event_type = 'auth'`, [yesterdayStr]),
        query(`SELECT COUNT(*) as count FROM logs WHERE DATE(created_at) = $1 AND event_type = 'error'`, [yesterdayStr])
      ]);

      const stats = {
        date: yesterdayStr,
        new_spaces: parseInt(newSpaces.rows[0].count),
        completed_uploads: parseInt(completedUploads.rows[0].count),
        total_size_bytes: parseInt(totalSize.rows[0].total),
        unique_users: parseInt(uniqueUsers.rows[0].count),
        auth_attempts: parseInt(authAttempts.rows[0].count),
        errors: parseInt(errors.rows[0].count)
      };

      logger.info('Statistiques quotidiennes générées:', stats);

      // Sauvegarder les statistiques
      await query(`
        INSERT INTO config (key, value, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
      `, [`daily_stats_${yesterdayStr}`, JSON.stringify(stats)]);

      // Logger l'événement
      await query(`
        INSERT INTO logs (event_type, details)
        VALUES ($1, $2)
      `, [
        'daily_stats',
        stats
      ]);
    } catch (error) {
      logger.error('Erreur lors de la génération des statistiques:', error);
    }
  }

  // Exécuter manuellement une tâche de nettoyage
  async runManualCleanup(type) {
    logger.info(`Exécution manuelle du nettoyage: ${type}`);

    switch (type) {
      case 'sessions':
        await this.cleanupExpiredSessions();
        break;
      case 'tokens':
        await this.cleanupExpiredTokens();
        break;
      case 'logs':
        await this.cleanupOldLogs();
        break;
      case 'stats':
        await this.generateDailyStats();
        break;
      case 'all':
        await this.cleanupExpiredSessions();
        await this.cleanupExpiredTokens();
        await this.cleanupOldLogs();
        await this.generateDailyStats();
        break;
      default:
        throw new Error(`Type de nettoyage non reconnu: ${type}`);
    }

    logger.info(`Nettoyage manuel terminé: ${type}`);
  }

  // Obtenir le statut des tâches
  getJobsStatus() {
    return this.jobs.map(({ name, job }) => ({
      name,
      running: job.getStatus() === 'scheduled'
    }));
  }
}

// Singleton
const cronService = new CronService();

module.exports = cronService;