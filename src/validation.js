const STATUTS_MATRIMONIAUX = ['celibataire', 'marie', 'veuf', 'divorce'];

const RE_TELEPHONE = /^\+?[0-9 ]{8,20}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Nettoie une valeur : texte rogné, ou chaîne vide si absent
function texte(valeur) {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

function validerMembre(body) {
  const erreurs = {};
  const b = body || {};

  const nom = texte(b.nom);
  const prenom = texte(b.prenom);
  const sexe = texte(b.sexe).toUpperCase();
  const dateNaissance = texte(b.date_naissance);
  const telephone = texte(b.telephone);
  const email = texte(b.email).toLowerCase();
  const quartier = texte(b.quartier);
  const lienFamille = texte(b.lien_famille);
  const statutMatrimonial = texte(b.statut_matrimonial);
  const profession = texte(b.profession);

  if (nom.length < 2 || nom.length > 80) {
    erreurs.nom = 'Le nom doit contenir entre 2 et 80 caractères.';
  }
  if (prenom.length < 2 || prenom.length > 80) {
    erreurs.prenom = 'Le prénom doit contenir entre 2 et 80 caractères.';
  }
  if (!['M', 'F'].includes(sexe)) {
    erreurs.sexe = 'Choisis le sexe (M ou F).';
  }

  const date = new Date(dateNaissance);
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(dateNaissance) && !isNaN(date);
  if (!dateValide || date > new Date() || date.getFullYear() < 1900) {
    erreurs.date_naissance = 'Date de naissance invalide.';
  }

  if (telephone && !RE_TELEPHONE.test(telephone)) {
    erreurs.telephone = 'Numéro de téléphone invalide.';
  }
  if (email && (email.length > 120 || !RE_EMAIL.test(email))) {
    erreurs.email = 'Adresse e-mail invalide.';
  }
  if (quartier.length > 120) {
    erreurs.quartier = 'Quartier trop long (120 caractères maximum).';
  }

  const LIENS_FAMILLE = ['pere', 'mere', 'conjoint', 'enfant', 'frere_soeur', 'oncle_tante', 'cousin', 'grand_parent', 'autre'];
  if (lienFamille && !LIENS_FAMILLE.includes(lienFamille)) {
    erreurs.lien_famille = 'Lien de famille invalide.';
  }

  if (statutMatrimonial && !STATUTS_MATRIMONIAUX.includes(statutMatrimonial)) {
    erreurs.statut_matrimonial = 'Statut matrimonial invalide.';
  }
  if (profession.length > 120) {
    erreurs.profession = 'Profession trop longue (120 caractères maximum).';
  }

  // Les champs facultatifs vides deviennent null pour la base
  const donnees = {
    nom,
    prenom,
    sexe,
    date_naissance: dateNaissance,
    telephone: telephone || null,
    email: email || null,
    quartier: quartier || null,
    lien_famille: lienFamille || null,
    statut_matrimonial: statutMatrimonial || null,
    profession: profession || null,
  };

  return { erreurs, donnees, valide: Object.keys(erreurs).length === 0 };
}

module.exports = { validerMembre };