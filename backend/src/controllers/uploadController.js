const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../config/logger');

class UploadController {
  // Initialiser un upload
  async initUpload(req, res) {
    try {
      const { filename, file_size, mime_type } = req.body;
      const { user } = req;

      // Validation des données
      if (!filename || !file_size || !mime_type) {
        return res.status(400).json({ error: 'Nom de fichier, taille et type MIME requis' });
      }

      // Vérifier la taille du fichier (5GB max)
      const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
      if (file_size > maxSize) {
        return res.status(400).json({ error: 'Taille de fichier trop importante (5GB maximum)' });
      }

      // Vérifier les types de fichiers autorisés
      const allowedTypes = await this.getAllowedFileTypes();
      if (allowedTypes.length > 0 && !allowedTypes.includes(mime_type)) {
        return res.status(400).json({ error: 'Type de fichier non autorisé' });
      }

      // Générer la clé S3 selon le schéma de nommage
      const s3Key = await this.generateS3Key(filename, user.spaceName);
      const uploadId = crypto.randomUUID();

      // Créer l'enregistrement en base
      const result = await query(`
        INSERT INTO files (space_id, original_name, s3_key, file_size, mime_type, upload_status, upload_id)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6)
        RETURNING id
      `, [user.spaceId, filename, s3Key, file_size, mime_type, uploadId]);

      const fileId = result.rows[0].id;

      // Logger l'initialisation
      await query(`
        INSERT INTO logs (event_type, space_id, file_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'upload_init',
        user.spaceId,
        fileId,
        { filename, file_size, mime_type },
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        req.headers['user-agent'] || 'unknown'
      ]);

      res.json({
        success: true,
        upload_id: uploadId,
        file_id: fileId,
        s3_key: s3Key,
        message: 'Upload initialisé avec succès'
      });
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation de l\'upload:', error);
      res.status(500).json({ error: 'Erreur serveur lors de l\'initialisation de l\'upload' });
    }
  }

  // Finaliser un upload
  async completeUpload(req, res) {
    try {
      const { upload_id, checksum } = req.body;
      const { user } = req;

      if (!upload_id) {
        return res.status(400).json({ error: 'ID d\'upload requis' });
      }

      // Vérifier que l'upload appartient à l'utilisateur
      const fileResult = await query(`
        SELECT id, original_name, s3_key, file_size
        FROM files
        WHERE upload_id = $1 AND space_id = $2 AND upload_status = 'pending'
      `, [upload_id, user.spaceId]);

      if (fileResult.rows.length === 0) {
        return res.status(404).json({ error: 'Upload non trouvé ou déjà finalisé' });
      }

      const file = fileResult.rows[0];

      // Mettre à jour le statut de l'upload
      await query(`
        UPDATE files
        SET upload_status = 'completed', checksum = $1, completed_at = NOW()
        WHERE id = $2
      `, [checksum, file.id]);

      // Logger la finalisation
      await query(`
        INSERT INTO logs (event_type, space_id, file_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'completed',
        user.spaceId,
        file.id,
        { upload_id, checksum, original_name: file.original_name },
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        req.headers['user-agent'] || 'unknown'
      ]);

      res.json({
        success: true,
        message: 'Upload finalisé avec succès',
        file: {
          id: file.id,
          original_name: file.original_name,
          s3_key: file.s3_key,
          file_size: file.file_size,
          checksum,
          completed_at: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la finalisation de l\'upload:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la finalisation de l\'upload' });
    }
  }

  // Récupérer la liste des fichiers d'un espace
  async getFiles(req, res) {
    try {
      const { user } = req;
      const { page = 1, limit = 20, status = 'all' } = req.query;

      const offset = (page - 1) * limit;
      let whereClause = 'WHERE space_id = $1';
      const params = [user.spaceId];

      if (status !== 'all') {
        whereClause += ' AND upload_status = $2';
        params.push(status);
      }

      // Récupérer les fichiers avec pagination
      const filesQuery = `
        SELECT id, original_name, s3_key, file_size, mime_type, upload_status, checksum, created_at, completed_at
        FROM files
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      // Compter le total
      const countQuery = `SELECT COUNT(*) as total FROM files ${whereClause}`;

      const [filesResult, countResult] = await Promise.all([
        query(filesQuery, [...params, limit, offset]),
        query(countQuery, params)
      ]);

      const files = filesResult.rows;
      const total = parseInt(countResult.rows[0].total);

      res.json({
        success: true,
        files,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        space: {
          id: user.spaceId,
          name: user.spaceName
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des fichiers:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la récupération des fichiers' });
    }
  }

  // Supprimer un fichier (soft delete)
  async deleteFile(req, res) {
    try {
      const { fileId } = req.params;
      const { user } = req;

      if (!fileId) {
        return res.status(400).json({ error: 'ID de fichier requis' });
      }

      // Vérifier que le fichier appartient à l'utilisateur
      const fileResult = await query(`
        SELECT id, original_name, s3_key
        FROM files
        WHERE id = $1 AND space_id = $2 AND upload_status != 'deleted'
      `, [fileId, user.spaceId]);

      if (fileResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
      }

      const file = fileResult.rows[0];

      // Marquer comme supprimé (soft delete)
      await query(`
        UPDATE files
        SET upload_status = 'deleted', updated_at = NOW()
        WHERE id = $1
      `, [fileId]);

      // Logger la suppression
      await query(`
        INSERT INTO logs (event_type, space_id, file_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'delete',
        user.spaceId,
        fileId,
        { original_name: file.original_name, s3_key: file.s3_key },
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        req.headers['user-agent'] || 'unknown'
      ]);

      res.json({
        success: true,
        message: 'Fichier supprimé avec succès'
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression du fichier:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la suppression du fichier' });
    }
  }

  // Utilitaires
  async getAllowedFileTypes() {
    try {
      const result = await query(`
        SELECT value FROM config WHERE key = 'allowed_file_types'
      `);

      if (result.rows.length === 0) {
        return []; // Tous les types autorisés par défaut
      }

      return result.rows[0].value || [];
    } catch (error) {
      logger.error('Erreur lors de la récupération des types autorisés:', error);
      return []; // En cas d'erreur, autoriser tous les types
    }
  }

  async generateS3Key(filename, spaceName) {
    try {
      // Récupérer le schéma de nommage depuis la configuration
      const result = await query(`
        SELECT value FROM config WHERE key = 'naming_schema'
      `);

      let schema = '{year}/{month}/{space}/{filename}-{uuid}';
      if (result.rows.length > 0 && result.rows[0].value) {
        schema = result.rows[0].value;
      }

      const now = new Date();
      const fileUuid = crypto.randomUUID().substring(0, 8);
      const fileExt = filename.substring(filename.lastIndexOf('.'));
      const baseName = filename.substring(0, filename.lastIndexOf('.'));

      // Remplacer les variables dans le schéma
      const s3Key = schema
        .replace('{year}', now.getFullYear().toString())
        .replace('{month}', (now.getMonth() + 1).toString().padStart(2, '0'))
        .replace('{day}', now.getDate().toString().padStart(2, '0'))
        .replace('{space}', this.slugify(spaceName))
        .replace('{filename}', this.slugify(baseName))
        .replace('{uuid}', fileUuid)
        + fileExt;

      return s3Key;
    } catch (error) {
      logger.error('Erreur lors de la génération de la clé S3:', error);
      // Fallback vers un schéma simple
      const fileUuid = crypto.randomUUID().substring(0, 8);
      return `${new Date().getFullYear()}/${this.slugify(spaceName)}/${this.slugify(filename)}-${fileUuid}`;
    }
  }

  slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z0-9]+/g, '-') // Remplacer les caractères spéciaux par des tirets
      .replace(/^-|-$/g, ''); // Supprimer les tirets en début et fin
  }
}

module.exports = new UploadController();