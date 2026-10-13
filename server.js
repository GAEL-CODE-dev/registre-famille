require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./src/db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'famille-admin-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Accès interdit.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.username !== ADMIN_USERNAME || payload.role !== 'admin') {
      throw new Error('Token invalide');
    }
    req.admin = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide.' });
  }
}

app.use((req, _res, next) => {
  console.log('Requête reçue :', req.method, req.url);
  next();
});

// Nécessaire derrière Render : sinon la limite anti-spam voit l'IP du proxy
// et bloquerait tout le monde en même temps
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// CORS : seulement si le frontend est hébergé sur un autre domaine
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const token = jwt.sign({ username: ADMIN_USERNAME, role: 'admin' }, JWT_SECRET, {
    expiresIn: '8h',
  });

  return res.json({ token });
});

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

app.use('/api/membres', require('./src/routes/membres'));

// Route API inconnue
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// Gestionnaire d'erreurs : on ne montre jamais les détails internes au client
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} occupé, tentative sur ${nextPort}.`);
      startServer(nextPort);
      return;
    }

    console.error('ERREUR DÉMARRAGE SERVEUR :', err);
    process.exit(1);
  });
}

startServer(PORT);

process.on('uncaughtException', (err) => console.error('ERREUR FATALE :', err));
process.on('unhandledRejection', (err) => console.error('PROMESSE REJETÉE :', err));