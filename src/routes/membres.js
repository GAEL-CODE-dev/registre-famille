const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const PDFDocument = require('pdfkit');
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
        TO_CHAR(date_naissance, 'YYYY-MM-DD') AS date_naissance,
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

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const LARGEUR_PAGE = 595.28;
const MARGE = 40;
const LARGEUR_CONTENU = LARGEUR_PAGE - MARGE * 2;
const COLONNES = [
  { titre: 'Nom', largeur: 95 },
  { titre: 'Prénom', largeur: 95 },
  { titre: 'Naissance', largeur: 75 },
  { titre: 'Âge', largeur: 38 },
  { titre: 'Contact', largeur: 112 },
  { titre: 'Quartier', largeur: 100 },
];
const HAUTEUR_LIGNE = 22;

function formaterDateNaissance(dateIso) {
  const correspondance = String(dateIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!correspondance) return '—';
  return `${correspondance[3]}/${correspondance[2]}/${correspondance[1]}`;
}

function calculerAge(dateIso) {
  const correspondance = String(dateIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!correspondance) return '';
  const [, annee, mois, jour] = correspondance.map(Number);
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - annee;
  if (
    aujourdhui.getMonth() + 1 < mois ||
    (aujourdhui.getMonth() + 1 === mois && aujourdhui.getDate() < jour)
  ) {
    age -= 1;
  }
  return age >= 0 ? String(age) : '';
}

function tronquer(texte, longueurMax) {
  const valeur = String(texte || '—');
  return valeur.length > longueurMax ? `${valeur.slice(0, longueurMax - 1)}…` : valeur;
}

function dessinerEnteteTableau(doc, y) {
  doc.save();
  doc.rect(MARGE, y, LARGEUR_CONTENU, HAUTEUR_LIGNE).fill('#F7F3F3');
  doc.restore();

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#615456');
  let x = MARGE;
  for (const colonne of COLONNES) {
    doc.text(colonne.titre, x + 4, y + 7, { width: colonne.largeur - 8 });
    x += colonne.largeur;
  }
  return y + HAUTEUR_LIGNE;
}

// GET /api/membres/anniversaires/pdf : exporte le filtre en PDF
router.get('/anniversaires/pdf', requireAdmin, async (req, res, next) => {
  try {
    const mois = Number.parseInt(req.query.mois, 10);
    const moisValide = Number.isInteger(mois) && mois >= 1 && mois <= 12;
    const sexe = ['M', 'F'].includes(req.query.sexe) ? req.query.sexe : null;
    const recherche = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';

    const conditions = [];
    const params = [];

    if (moisValide) {
      params.push(mois);
      conditions.push(`EXTRACT(MONTH FROM date_naissance) = $${params.length}`);
    }
    if (sexe) {
      params.push(sexe);
      conditions.push(`sexe = $${params.length}`);
    }
    if (recherche) {
      params.push(`%${recherche.toLowerCase()}%`);
      const p = `$${params.length}`;
      conditions.push(`(
        LOWER(nom) LIKE ${p} OR LOWER(prenom) LIKE ${p}
        OR LOWER(COALESCE(email, '')) LIKE ${p}
        OR LOWER(COALESCE(telephone, '')) LIKE ${p}
        OR LOWER(COALESCE(quartier, '')) LIKE ${p}
        OR LOWER(COALESCE(profession, '')) LIKE ${p}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT
         nom,
         prenom,
         sexe,
         TO_CHAR(date_naissance, 'YYYY-MM-DD') AS date_naissance,
         telephone,
         email,
         quartier
       FROM membres
       ${where}
       ORDER BY EXTRACT(DAY FROM date_naissance), nom, prenom`,
      params
    );

    const titre = moisValide
      ? `Anniversaires de ${MOIS[mois - 1]}`
      : 'Anniversaires de la famille';
    const details = [];
    if (sexe) details.push(sexe === 'F' ? 'Femmes' : 'Hommes');
    if (recherche) details.push(`Recherche : « ${recherche} »`);
    const sousTitre = [
      `${rows.length} ${rows.length === 1 ? 'membre' : 'membres'}`,
      ...details,
    ].join(' · ');
    const dateGeneration = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date());

    const nomFichier = `anniversaires-${moisValide ? String(mois).padStart(2, '0') : 'registre'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);

    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGE,
      bufferPages: true,
      info: { Title: titre, Author: 'Registre familial' },
    });

    doc.on('error', next);
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#8C1820').text(titre);
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(9.5).fillColor('#6E6062').text(sousTitre);
    doc.moveDown(0.6);
    doc.moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR_CONTENU, doc.y)
      .lineWidth(2).strokeColor('#B3202A').stroke();
    doc.moveDown(0.9);

    if (rows.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor('#66585A')
        .text('Aucun membre ne correspond à ce filtre.');
    } else {
      let y = dessinerEnteteTableau(doc, doc.y);
      const basDePage = doc.page.height - 55;

      rows.forEach((membre, index) => {
        if (y + HAUTEUR_LIGNE > basDePage) {
          doc.addPage();
          y = dessinerEnteteTableau(doc, MARGE);
        }

        if (index % 2 === 1) {
          doc.save();
          doc.rect(MARGE, y, LARGEUR_CONTENU, HAUTEUR_LIGNE).fill('#FBF8F8');
          doc.restore();
        }

        const valeurs = [
          membre.nom,
          membre.prenom,
          formaterDateNaissance(membre.date_naissance),
          calculerAge(membre.date_naissance),
          membre.telephone || membre.email || '—',
          membre.quartier || '—',
        ];

        doc.font('Helvetica').fontSize(8.5).fillColor('#4D4143');
        let x = MARGE;
        valeurs.forEach((valeur, i) => {
          const colonne = COLONNES[i];
          doc.text(tronquer(valeur, i === 4 ? 24 : 18), x + 4, y + 7, {
            width: colonne.largeur - 8,
            height: HAUTEUR_LIGNE - 8,
            ellipsis: true,
            lineBreak: false,
          });
          x += colonne.largeur;
        });

        doc.save();
        doc.moveTo(MARGE, y + HAUTEUR_LIGNE).lineTo(MARGE + LARGEUR_CONTENU, y + HAUTEUR_LIGNE)
          .lineWidth(0.5).strokeColor('#EEE8E8').stroke();
        doc.restore();

        y += HAUTEUR_LIGNE;
      });

      doc.y = y;
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i += 1) {
      doc.switchToPage(pages.start + i);
      // On autorise le pied de page dans la marge basse pour éviter
      // que PDFKit n'ajoute une page vide à chaque numéro de page.
      const margeBasse = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(7.5).fillColor('#85787A')
        .text(`Document généré le ${dateGeneration}`, MARGE, doc.page.height - 45, {
          width: LARGEUR_CONTENU,
          align: 'left',
          lineBreak: false,
        });
      doc.text(`Page ${i + 1} / ${pages.count}`, MARGE, doc.page.height - 45, {
        width: LARGEUR_CONTENU,
        align: 'right',
        lineBreak: false,
      });
      doc.page.margins.bottom = margeBasse;
    }

    doc.end();
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
