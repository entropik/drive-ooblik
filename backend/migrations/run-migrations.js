const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');
const logger = require('../src/config/logger');

// Table pour tracker les migrations
const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

async function runMigrations() {
  try {
    logger.info('Démarrage des migrations...');

    // Créer la table des migrations si elle n'existe pas
    await query(MIGRATIONS_TABLE);

    // Lire tous les fichiers de migration
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Tri alphabétique pour l'ordre d'exécution

    if (files.length === 0) {
      logger.info('Aucune migration trouvée');
      return;
    }

    // Récupérer les migrations déjà exécutées
    const { rows: executedMigrations } = await query(
      'SELECT filename FROM migrations ORDER BY filename'
    );

    const executedFiles = executedMigrations.map(row => row.filename);

    // Exécuter les migrations non appliquées
    for (const file of files) {
      if (executedFiles.includes(file)) {
        logger.info(`Migration ${file} déjà exécutée, ignorée`);
        continue;
      }

      logger.info(`Exécution de la migration: ${file}`);

      try {
        // Lire le contenu du fichier SQL
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Exécuter la migration
        await query(sql);

        // Marquer comme exécutée
        await query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );

        logger.info(`Migration ${file} exécutée avec succès`);
      } catch (error) {
        logger.error(`Erreur lors de l'exécution de ${file}:`, error);
        throw error;
      }
    }

    logger.info('Toutes les migrations ont été exécutées avec succès');
  } catch (error) {
    logger.error('Erreur lors des migrations:', error);
    process.exit(1);
  }
}

// Fonction pour créer une nouvelle migration
function createMigration(name) {
  if (!name) {
    console.error('Usage: node migrations/run-migrations.js create <nom_migration>');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
  const filepath = path.join(__dirname, filename);

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL statements here
-- Example:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name TEXT NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
`;

  fs.writeFileSync(filepath, template);
  console.log(`Migration créée: ${filename}`);
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'create') {
    const name = process.argv.slice(3).join(' ');
    createMigration(name);
  } else {
    // Configurer les variables d'environnement
    require('dotenv').config({ path: path.join(__dirname, '../.env') });

    runMigrations().then(() => {
      process.exit(0);
    });
  }
}

module.exports = { runMigrations, createMigration };