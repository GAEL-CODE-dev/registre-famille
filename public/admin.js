const tbody = document.getElementById('tbody-membres');
const mobileList = document.getElementById('liste-membres-mobile');
const tableWrap = document.getElementById('tableau-annuaire');
const chargeur = document.getElementById('chargeur');
const erreurBox = document.getElementById('erreur');
const loginSection = document.getElementById('login-section');
const adminContent = document.getElementById('admin-content');
const adminMain = document.querySelector('.admin-main');
const loginForm = document.getElementById('login-form');
const loginErreur = document.getElementById('login-erreur');
const refreshButton = document.getElementById('actualiser');
const logoutButton = document.getElementById('deconnexion');
const searchInput = document.getElementById('recherche-membre');
const sexFilter = document.getElementById('filtre-sexe');
const noResults = document.getElementById('aucun-resultat');
let membres = [];

function afficherErreur(message) {
  erreurBox.textContent = message;
  erreurBox.classList.remove('hidden');
}

function afficherErreurLogin(message) {
  loginErreur.textContent = message;
  loginErreur.classList.remove('hidden');
}

function formatDate(dateIso) {
  if (!dateIso) return '—';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return String(dateIso);
  return new Intl.DateTimeFormat('fr-FR').format(date);
}

function formatDateHeure(dateIso) {
  if (!dateIso) return 'Date non renseignée';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return 'Date non renseignée';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

function echapperHTML(valeur) {
  const remplacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valeur ?? '—').replace(/[&<>"']/g, (caractere) => remplacements[caractere]);
}

function getToken() {
  return localStorage.getItem('adminToken');
}

function setAuthState(token) {
  if (token) {
    localStorage.setItem('adminToken', token);
    loginSection.classList.add('hidden');
    adminContent.classList.remove('hidden');
    adminMain.classList.add('admin-main--dashboard');
    logoutButton.classList.remove('hidden');
    return;
  }

  localStorage.removeItem('adminToken');
  loginSection.classList.remove('hidden');
  adminContent.classList.add('hidden');
  adminMain.classList.remove('admin-main--dashboard');
  logoutButton.classList.add('hidden');
}

function mettreAJourIndicateurs(liste) {
  const femmes = liste.filter((membre) => membre.sexe === 'F').length;
  const hommes = liste.filter((membre) => membre.sexe === 'M').length;
  const maintenant = new Date();
  const inscritsCeMois = liste.filter((membre) => {
    if (!membre.created_at) return false;
    const date = new Date(membre.created_at);
    return date.getFullYear() === maintenant.getFullYear() && date.getMonth() === maintenant.getMonth();
  }).length;
  const totalSexes = femmes + hommes;

  document.getElementById('metric-total').textContent = String(liste.length);
  document.getElementById('metric-femmes').textContent = String(femmes);
  document.getElementById('metric-hommes').textContent = String(hommes);
  document.getElementById('metric-mois').textContent = String(inscritsCeMois);
  document.getElementById('ratio-total').textContent = `${liste.length} au total`;
  document.getElementById('ratio-femmes-label').textContent = String(femmes);
  document.getElementById('ratio-hommes-label').textContent = String(hommes);
  document.getElementById('ratio-femmes').style.width = `${totalSexes ? (femmes / totalSexes) * 100 : 0}%`;
  document.getElementById('ratio-hommes').style.width = `${totalSexes ? (hommes / totalSexes) * 100 : 0}%`;

  const dernier = liste[0];
  document.getElementById('dernier-inscrit').textContent = dernier
    ? `${dernier.prenom || ''} ${dernier.nom || ''}`.trim()
    : 'Aucune inscription';
  document.getElementById('date-dernier-inscrit').textContent = dernier
    ? `Ajouté le ${formatDateHeure(dernier.created_at)}`
    : 'Le registre est prêt à être complété.';
}

function rendreMembre(membre) {
  const nom = echapperHTML(membre.nom);
  const prenom = echapperHTML(membre.prenom);
  const sexe = membre.sexe === 'F' ? 'Femme' : membre.sexe === 'M' ? 'Homme' : '—';
  const telephone = echapperHTML(membre.telephone);
  const email = echapperHTML(membre.email);
  const quartier = echapperHTML(membre.quartier);
  const profession = echapperHTML(membre.profession);
  const naissance = echapperHTML(formatDate(membre.date_naissance));
  const inscrit = echapperHTML(formatDate(membre.created_at));
  const emailVisible = membre.email ? `<div><dt>E-mail</dt><dd>${email}</dd></div>` : '';

  return {
    ligne: `
      <tr>
        <td>${nom}</td>
        <td>${prenom}</td>
        <td>${sexe}</td>
        <td>${naissance}</td>
        <td>${telephone !== '—' ? telephone : email}</td>
        <td>${quartier}</td>
        <td>${profession}</td>
        <td>${inscrit}</td>
      </tr>
    `,
    carte: `
      <article class="member-card">
        <div class="member-card-heading">
          <h4>${prenom} ${nom}</h4>
          <span class="member-sex ${membre.sexe === 'F' ? 'member-sex--women' : 'member-sex--men'}">${sexe}</span>
        </div>
        <dl class="member-details">
          <div><dt>Naissance</dt><dd>${naissance}</dd></div>
          <div><dt>Téléphone</dt><dd>${telephone}</dd></div>
          ${emailVisible}
          <div><dt>Quartier</dt><dd>${quartier}</dd></div>
          <div><dt>Profession</dt><dd>${profession}</dd></div>
        </dl>
      </article>
    `,
  };
}

function filtrerMembres() {
  const recherche = searchInput.value.trim().toLocaleLowerCase('fr');
  const sexe = sexFilter.value;
  const filtres = membres.filter((membre) => {
    const champs = [membre.nom, membre.prenom, membre.email, membre.telephone, membre.quartier, membre.profession];
    const correspondRecherche = !recherche || champs.some((champ) => String(champ || '').toLocaleLowerCase('fr').includes(recherche));
    return correspondRecherche && (!sexe || membre.sexe === sexe);
  });

  document.getElementById('result-count').textContent = `${filtres.length} ${filtres.length === 1 ? 'membre' : 'membres'}`;
  noResults.classList.toggle('hidden', filtres.length > 0);
  noResults.textContent = membres.length ? 'Aucun membre ne correspond à cette recherche.' : 'Aucun membre n’est encore inscrit.';
  tableWrap.classList.toggle('hidden', filtres.length === 0);
  mobileList.classList.toggle('hidden', filtres.length === 0);
  tbody.innerHTML = filtres.map((membre) => rendreMembre(membre).ligne).join('');
  mobileList.innerHTML = filtres.map((membre) => rendreMembre(membre).carte).join('');
}

async function chargerMembres() {
  const token = getToken();
  if (!token) {
    setAuthState(null);
    return;
  }

  erreurBox.classList.add('hidden');
  chargeur.classList.remove('hidden');
  refreshButton.disabled = true;
  refreshButton.textContent = 'Actualisation…';

  try {
    const reponse = await fetch('/api/membres', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (reponse.status === 401) {
      setAuthState(null);
      afficherErreurLogin('Session invalide. Reconnectez-vous.');
      return;
    }

    if (!reponse.ok) {
      throw new Error('Impossible de charger les membres.');
    }

    const donnees = await reponse.json();
    membres = Array.isArray(donnees) ? donnees : [];
    mettreAJourIndicateurs(membres);
    filtrerMembres();
  } catch (err) {
    afficherErreur(err.message || 'Erreur lors du chargement des membres.');
  } finally {
    chargeur.classList.add('hidden');
    refreshButton.disabled = false;
    refreshButton.textContent = 'Actualiser';
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginErreur.classList.add('hidden');

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const reponse = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const corps = await reponse.json().catch(() => ({}));

    if (!reponse.ok) {
      throw new Error(corps.error || 'Identifiants invalides.');
    }

    setAuthState(corps.token);
    await chargerMembres();
  } catch (err) {
    afficherErreurLogin(err.message || 'Erreur de connexion.');
  }
});

searchInput.addEventListener('input', filtrerMembres);
sexFilter.addEventListener('change', filtrerMembres);
refreshButton.addEventListener('click', chargerMembres);
logoutButton.addEventListener('click', () => setAuthState(null));

if (getToken()) {
  setAuthState(getToken());
  chargerMembres();
} else {
  setAuthState(null);
}
