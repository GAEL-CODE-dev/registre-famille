// Exécute les fichiers .sql du dossier migrations, une seule fois chacun
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function run() {
  // Table qui garde la liste des migrations déjà appliquées
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name       VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`);

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM migrations');
  const done = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (done.has(file)) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('Migration appliquée :', file);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Échec de la migration', file, ':', err.message);
      process.exitCode = 1;
      break;
    } finally {
      client.release();
    }
  }

  await pool.end();
  if (!process.exitCode) console.log('Base à jour.');
}

run();