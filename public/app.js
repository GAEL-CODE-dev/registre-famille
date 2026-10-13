(function () {
  const formulaire = document.getElementById('formulaire');
  const message = document.getElementById('message');
  const succes = document.getElementById('succes');
  const bouton = document.getElementById('envoyer');
  const nouveau = document.getElementById('nouveau');

  if (!formulaire || !message || !succes || !bouton || !nouveau) {
    console.error('Éléments introuvables dans index.html (id).');
    return;
  }

  let enCours = false;

  function effacerErreurs() {
    document.querySelectorAll('[data-erreur]').forEach((p) => { p.textContent = ''; });
    message.classList.add('hidden');
  }

  function afficherMessage(texte) {
    message.textContent = texte;
    message.className = 'mb-6 rounded-lg bg-rouge-pale px-4 py-3 text-sm text-rouge-fonce';
  }

  function afficherErreurs(erreurs) {
    const champs = Object.keys(erreurs);
    champs.forEach((champ) => {
      const zone = document.querySelector('[data-erreur="' + champ + '"]');
      if (zone) zone.textContent = erreurs[champ];
    });
    const premier = document.querySelector('[name="' + champs[0] + '"]');
    if (premier) premier.focus();
  }

  function validerClient(d) {
    const erreurs = {};
    if (!d.nom || d.nom.trim().length < 2) erreurs.nom = 'Le nom doit contenir au moins 2 caractères.';
    if (!d.prenom || d.prenom.trim().length < 2) erreurs.prenom = 'Le prénom doit contenir au moins 2 caractères.';
    if (!d.sexe) erreurs.sexe = 'Choisis le sexe.';
    if (!d.date_naissance) erreurs.date_naissance = 'Indique ta date de naissance.';
    return erreurs;
  }

  async function envoyer() {
    if (enCours) return;
    effacerErreurs();

    const donnees = Object.fromEntries(new FormData(formulaire));
    const erreurs = validerClient(donnees);
    if (Object.keys(erreurs).length > 0) {
      afficherErreurs(erreurs);
      return;
    }

    enCours = true;
    bouton.disabled = true;
    bouton.textContent = 'Enregistrement…';

    try {
      const reponse = await fetch('/api/membres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      });
      const corps = await reponse.json().catch(() => ({}));

      if (reponse.status === 201) {
        formulaire.reset();
        formulaire.classList.add('hidden');
        succes.classList.remove('hidden');
      } else if (reponse.status === 400 && corps.erreurs) {
        afficherErreurs(corps.erreurs);
      } else {
        afficherMessage(corps.error || 'Une erreur est survenue. Réessaie dans un instant.');
      }
    } catch (err) {
      afficherMessage('Connexion impossible. Vérifie ta connexion internet et réessaie.');
    } finally {
      enCours = false;
      bouton.disabled = false;
      bouton.textContent = 'Enregistrer';
    }
  }

  formulaire.addEventListener('submit', (e) => {
    e.preventDefault();
    envoyer();
  });

  if (!bouton.form) {
    bouton.addEventListener('click', (e) => {
      e.preventDefault();
      envoyer();
    });
  }

  nouveau.addEventListener('click', () => {
    succes.classList.add('hidden');
    formulaire.classList.remove('hidden');
    effacerErreurs();
  });
})();