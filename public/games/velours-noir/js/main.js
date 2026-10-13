/**
 * LE VELOURS NOIR — le hall, la caisse, la navigation entre les tables.
 *
 * Les tables (blackjack.js, roulette.js, poker.js) reçoivent `app` : la
 * caisse (débiter, créditer), les succès, les statistiques, et le retour
 * au hall.
 */

import * as K from '../../../shared/casino/banque.js';
import * as succes from '../../../shared/succes.js';
import { installerMusique } from '../../../shared/musique.js';
import * as sfx from './sfx.js';
import * as fx from './effets.js';
import { monterBlackjack } from './blackjack.js';
import { monterRoulette } from './roulette.js';
import { monterPoker } from './poker.js';
import { monterBoutique } from './boutique.js';
import { monterCompte } from './moncompte.js';
import * as EL from './enligne.js';

const $ = (id) => document.getElementById(id);
const CLE_MUSIQUE = 'velours.musique';
const CLE_NUAGE_MAJ = 'velours.nuage.maj';

succes.visiter('velours');

/* ------------------------------------------------------------------ */
/* La caisse                                                           */
/* ------------------------------------------------------------------ */

let banque = K.lire(localStorage);

function afficherSolde(anime = true) {
  for (const el of document.querySelectorAll('[data-solde]')) {
    if (anime && el.offsetParent) fx.compter(el, banque.solde);
    else { el.dataset.n = banque.solde; el.textContent = fx.nombre(banque.solde); }
  }
  majCaisse();
}

function sauver() {
  K.ecrire(localStorage, banque);
  try { localStorage.setItem(CLE_NUAGE_MAJ, String(Date.now())); } catch { /* ignore */ }
  planifierNuage();
}

const app = {
  solde: () => banque.solde,
  debiter(n) {
    n = Math.floor(n);
    if (!(n > 0) || n > banque.solde) return false;
    banque.solde -= n;
    sauver(); afficherSolde();
    return true;
  },
  crediter(n) {
    n = Math.floor(n);
    if (!(n > 0)) return;
    banque.solde += n;
    sauver(); afficherSolde();
  },
  /** Un gain net (pour le record du plus gros gain). */
  gainNet(n) {
    if (n > banque.records.gain) { banque.records.gain = n; sauver(); }
    if (banque.solde >= 10000) succes.debloquer('velours-flambeur');
  },
  stat(k, n = 1) { banque.stats[k] = (banque.stats[k] || 0) + n; sauver(); },
  succes: (id) => succes.debloquer(id),
  hall: () => aller('s-hall'),
  /** Le compte en banque fictif (il voyage avec la caisse). */
  compte: () => banque.compte,
  sauverCompte() { sauver(); },
};

function majCaisse() {
  const bonus = K.bonusDispo(banque);
  $('b-bonus').hidden = !bonus;
  $('b-secours').hidden = !K.secoursDispo(banque);
  const r = banque.records;
  $('h-records').textContent = r.solde > K.DEPART || r.gain ? `Record de caisse : ${fx.nombre(r.solde)} · Plus gros gain : ${fx.nombre(r.gain)}` : '';
}

$('b-bonus').addEventListener('click', (e) => {
  const n = K.prendreBonus(banque);
  if (!n) return;
  sauver(); afficherSolde();
  sfx.gain(true);
  fx.eclats(e.currentTarget, 36);
  fx.texte(`+${n}`, e.currentTarget, 'gros');
});
$('b-secours').addEventListener('click', (e) => {
  const n = K.prendreSecours(banque);
  if (!n) return;
  sauver(); afficherSolde();
  sfx.jetons(8);
  fx.texte(`+${n}`, e.currentTarget);
});

/* ------------------------------------------------------------------ */
/* La sauvegarde en ligne (le code de profil de l'arcade)              */
/* ------------------------------------------------------------------ */

let nuageT = 0, nuageEnCours = null;
function planifierNuage() { clearTimeout(nuageT); nuageT = setTimeout(synchroniserNuage, 2500); }
async function appeler(url, options) {
  try {
    const r = await fetch(url, { cache: 'no-store', ...options });
    let json = null;
    try { json = await r.json(); } catch { /* vide */ }
    return { ok: r.ok, statut: r.status, json };
  } catch { return { ok: false, statut: 0, json: null }; }
}
function synchroniserNuage() {
  if (nuageEnCours || !/^https?:$/.test(location.protocol)) return nuageEnCours;
  nuageEnCours = (async () => {
    const code = succes.codeProfil();
    const r = await appeler(`/api/sauvegarde?espace=velours&cle=${code}`);
    if (!r.ok && r.statut !== 404) return;
    let distant = null;
    if (r.ok && typeof r.json?.charge === 'string') { try { distant = JSON.parse(r.json.charge); } catch { /* illisible */ } }
    const tout = distant ? K.fusionner(banque, distant) : banque;
    if (!K.memes(tout, banque)) {
      banque = K.propre(tout);
      try { localStorage.setItem(K.CLE, JSON.stringify(banque)); } catch { /* ignore */ }
      afficherSolde(false);
      moncompte?.majBouton();
    }
    if (!distant || !K.memes(tout, distant)) {
      const date = Math.max(Date.now(), (Number(r.json?.date) || 0) + 1);
      await appeler('/api/sauvegarde', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ espace: 'velours', cle: code, charge: JSON.stringify(banque), date }) });
    }
  })().finally(() => { nuageEnCours = null; });
  return nuageEnCours;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

const tables = {};
let courant = 's-hall';

async function aller(id) {
  if (id === courant) return;
  const r = $('rideau');
  r.classList.remove('ferme'); void r.offsetWidth; r.classList.add('ferme');
  await fx.attendre(260);
  tables[courant]?.sortir?.();
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id));
  courant = id;
  afficherSolde(false);
  sfx.ambiance(id !== 's-hall');
  tables[id]?.entrer?.();
}

document.querySelectorAll('[data-hall]').forEach((b) => b.addEventListener('click', () => aller('s-hall')));

/* fenêtres */
document.querySelectorAll('[data-ouvre]').forEach((b) => b.addEventListener('click', () => {
  sfx.clic();
  if (b.dataset.ouvre === 'ov-boutique') boutique.ouvrir();
  else if (b.dataset.ouvre === 'ov-compte') moncompte.ouvrir();
  else $(b.dataset.ouvre).hidden = false;
}));
document.querySelectorAll('.ov').forEach((ov) => {
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-ferme]')) ov.hidden = true; });
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.ov:not([hidden])').forEach((o) => { o.hidden = true; }); });
document.querySelectorAll('.onglet').forEach((o) => o.addEventListener('click', () => {
  document.querySelectorAll('.onglet').forEach((x) => x.classList.toggle('is-on', x === o));
  document.querySelectorAll('.texte-regles').forEach((t) => { t.hidden = t.id !== o.dataset.onglet; });
}));

/* réglages */
let musique = (() => { try { return localStorage.getItem(CLE_MUSIQUE) !== '0'; } catch { return true; } })();
$('r-son').checked = sfx.sonActif();
$('r-voix').checked = sfx.voixActive();
$('r-musique').checked = musique;
$('r-son').addEventListener('change', () => { sfx.basculerSon(); });
$('r-voix').addEventListener('change', () => { sfx.basculerVoix(); });
$('r-musique').addEventListener('change', (e) => { musique = e.target.checked; try { localStorage.setItem(CLE_MUSIQUE, musique ? '1' : '0'); } catch { /* ignore */ } });
$('r-nuage').textContent = `☁️ Vos jetons sont sauvegardés avec votre profil de l’arcade (code ${succes.joliCode(succes.codeProfil())}).`;
installerMusique('velours', { actif: () => sfx.sonActif() && musique });

/* ------------------------------------------------------------------ */
/* Les tables                                                          */
/* ------------------------------------------------------------------ */

tables['s-blackjack'] = monterBlackjack(app);
tables['s-roulette'] = monterRoulette(app);
tables['s-poker'] = monterPoker(app, aller);
const moncompte = monterCompte(app);
const boutique = monterBoutique(app, moncompte);

/* ------------------------------------------------------------------ */
/* Seul ou en ligne                                                    */
/* ------------------------------------------------------------------ */

const NOMS = { blackjack: 'Blackjack', roulette: 'Roulette', poker: 'Texas Hold’em' };
let jeuChoisi = null, listeT = 0, codeVoulu = null;

function ouvrirMode(jeu) {
  jeuChoisi = jeu;
  $('mode-titre').textContent = NOMS[jeu];
  $('mode-note').textContent = '';
  $('mode-liste').innerHTML = '<p class="note">Recherche des tables…</p>';
  $('ov-mode').hidden = false;
  EL.lister(jeu);
  clearInterval(listeT);
  listeT = setInterval(() => { if ($('ov-mode').hidden) clearInterval(listeT); else EL.lister(jeu); }, 4000);
}

function rejoindreCode(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) { $('mode-note').textContent = 'Le code d’une table a quatre caractères.'; return; }
  codeVoulu = code;
  $('mode-note').textContent = 'Connexion à la table…';
  EL.info(code);
}

document.querySelectorAll('.porte').forEach((p) => p.addEventListener('click', () => {
  sfx.clic();
  ouvrirMode(p.dataset.jeu);
}));
$('mode-creer').addEventListener('click', () => {
  const publique = $('mode-publique').checked;
  if (jeuChoisi === 'poker') {
    $('ov-mode').hidden = true;
    tables['s-poker'].preparer({ type: 'creer', publique });
    aller('s-poker');
    return;
  }
  $('mode-note').textContent = 'Ouverture de la table…';
  EL.creer(jeuChoisi, { publique });
});
$('mode-rejoindre').addEventListener('click', () => rejoindreCode($('mode-code').value));
$('mode-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') rejoindreCode(e.target.value); });
$('mode-liste').addEventListener('click', (e) => {
  const b = e.target.closest('[data-code]');
  if (b) rejoindreCode(b.dataset.code);
});

/* le lien d'une table : on le copie pour l'envoyer à ses amis */
document.querySelectorAll('.code-table').forEach((b) => b.addEventListener('click', async () => {
  const lien = `${location.origin}/games/velours-noir/?table=${b.dataset.code}`;
  try { await navigator.clipboard.writeText(lien); fx.texte('Lien copié !', b); } catch { fx.texte(`Code : ${b.dataset.code}`, b); }
}));

EL.ecouter((m) => {
  switch (m.t) {
    case 'tables': {
      if ($('ov-mode').hidden) return;
      const liste = m.liste.filter((x) => x.jeu === jeuChoisi);
      $('mode-liste').innerHTML = liste.length
        ? liste.map((x) => `<button class="table-ligne" data-code="${x.code}"><b>Table de ${x.hote.replace(/[<>&]/g, '')}</b><span>${x.joueurs} / ${x.max} joueur${x.max > 1 ? 's' : ''}${x.petite ? ` · blindes ${x.petite}/${x.petite * 2}` : ''}</span><em>${x.code}</em></button>`).join('')
        : '<p class="note">Aucune table ouverte pour l’instant. Créez la vôtre !</p>';
      break;
    }
    case 'info':
      if (m.code !== codeVoulu) return;
      codeVoulu = null;
      $('ov-mode').hidden = true;
      if (m.jeu === 'poker') { tables['s-poker'].preparer({ type: 'rejoindre', code: m.code, petite: m.petite }); aller('s-poker'); }
      else EL.rejoindre(m.code);
      break;
    case 'etat':
      $('ov-mode').hidden = true;
      if (courant !== `s-${m.jeu}`) aller(`s-${m.jeu}`);
      break;
    case 'erreur':
      codeVoulu = null;
      $('mode-note').textContent = m.msg;
      break;
    case 'statut':
      document.body.classList.toggle('hors-ligne', m.s === 'injoignable');
      if (m.s === 'injoignable' && !$('ov-mode').hidden) $('mode-note').textContent = 'Le serveur des parties en ligne ne répond pas. Réessayez dans un instant.';
      break;
  }
});

// une place à reprendre (page rechargée en pleine partie), ou un lien de table reçu
if (EL.placeNotee()) EL.connecter();
const lienTable = new URLSearchParams(location.search).get('table');
if (lienTable) {
  history.replaceState(null, '', location.pathname);
  rejoindreCode(lienTable);
}

afficherSolde(false);
// la journée sur le compte en banque : après la sauvegarde en ligne (un appareil neuf retrouve d'abord le vrai compte)
Promise.race([Promise.resolve(synchroniserNuage()), new Promise((r) => setTimeout(r, 5000))]).finally(() => moncompte.nouveauxJours());
addEventListener('storage', (e) => { if (e.key === K.CLE) { banque = K.lire(localStorage); afficherSolde(false); } });

/* outils de débogage */
window.__velours = { app, banque: () => banque, aller, tables };
