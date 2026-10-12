require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pool = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// CORS : seulement si le frontend est hébergé sur un autre domaine
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
}

// Frontend statique
app.use(express.static(path.join(__dirname, 'public')));

// Vérifie que le serveur et la base répondent
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('Health check :', err.message);
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

// Les routes /api/membres et /api/admin arrivent aux phases 2 et 3

// Route API inconnue
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// Gestionnaire d'erreurs : on ne montre jamais les détails internes au client
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});