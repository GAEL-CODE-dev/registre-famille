const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquant : vérifie ton fichier .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Erreur inattendue du pool PostgreSQL :', err.message);
});

module.exports = pool;