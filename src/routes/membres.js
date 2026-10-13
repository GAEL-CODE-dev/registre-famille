const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { validerMembre } = require('../validation');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'famille-admin-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

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

// Anti-spam : 10 enregistrements maximum par adresse IP toutes les 15 minutes
const limiteur = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessaie dans quelques minutes.' },
});

// GET /api/membres : liste les membres pour l'admin
router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        nom,
        prenom,
        sexe,
        date_naissance,
        telephone,
        email,
        quartier,
        lien_famille,
        statut_matrimonial,
        profession,
        created_at
      FROM membres
      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/membres : route publique d'enregistrement
router.post('/', async (req, res, next) => {
  try {
    // Champ piège : un humain ne le voit pas, un robot le remplit.
    // On répond "succès" sans rien enregistrer.
    if (req.body && req.body.site_web) {
      return res.status(201).json({ message: 'Enregistrement réussi.' });
    }

    const { erreurs, donnees, valide } = validerMembre(req.body);
    if (!valide) {
      return res.status(400).json({ erreurs });
    }

    await pool.query(
      `INSERT INTO membres
        (nom, prenom, sexe, date_naissance, telephone, email,
         quartier, lien_famille, statut_matrimonial, profession)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        donnees.nom, donnees.prenom, donnees.sexe, donnees.date_naissance,
        donnees.telephone, donnees.email, donnees.quartier,
        donnees.lien_famille, donnees.statut_matrimonial, donnees.profession,
      ]
    );

    res.status(201).json({ message: 'Enregistrement réussi.' });
  } catch (err) {
    // 23505 = violation de l'index unique (doublon)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce membre est déjà enregistré.' });
    }
    next(err);
  }
});

module.exports = router;