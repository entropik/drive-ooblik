const { Pool } = require('pg');
const winston = require('winston');

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'drive_ooblik',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Nombre maximum de connexions dans le pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Création du pool de connexions PostgreSQL
const pool = new Pool(dbConfig);

// Gestion des événements du pool
pool.on('connect', () => {
  winston.info('Nouvelle connexion établie avec PostgreSQL');
});

pool.on('error', (err) => {
  winston.error('Erreur inattendue sur le client PostgreSQL:', err);
  process.exit(-1);
});

// Fonction pour tester la connexion
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    winston.info('Connexion à PostgreSQL réussie:', result.rows[0].now);
    return true;
  } catch (err) {
    winston.error('Erreur de connexion à PostgreSQL:', err);
    return false;
  }
}

// Fonction utilitaire pour exécuter des requêtes
async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    winston.debug('Requête exécutée', {
      query: text,
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    return result;
  } catch (err) {
    winston.error('Erreur lors de l\'exécution de la requête:', {
      error: err.message,
      query: text,
      params
    });
    throw err;
  } finally {
    client.release();
  }
}

// Fonction pour les transactions
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  testConnection,
  withTransaction
};