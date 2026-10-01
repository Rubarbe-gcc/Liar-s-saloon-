/**
 * BRASIER — navigation.
 *
 * Le jeu ne se joue qu'en ligne : le menu ouvre ou rejoint une table, puis
 * chaque état reçu du serveur décide de l'écran — choix du héros,
 * recrutement, combat, fin.
 */

import { PHASE, JOUEURS } from '../../../shared/brasier/partie.js';
import * as net from './net.js';
import * as ui from './ui.js';
import * as arene from './arene.js';
import * as regles from './regles.js';
import { sfx, basculer, estMuet } from './sfx.js';
import { installerMusique } from '../../../shared/musique.js';

const $ = (id) => document.getElementById(id);

let nom = '';
try { nom = localStorage.getItem('brasier.nom') || ''; } catch { /* navigation privée */ }

let salon = null;
let echeance = 0;
let phaseVue = null;
let combatJoue = null;
let elimineMontre = false;
let finMontree = false;
let avant = null;

/* ------------------------------------------------------------------ */
/* Décor                                                               */
/* ------------------------------------------------------------------ */

function cendres() {
  const host = $('cendres');
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  host.innerHTML = Array.from({ length: 28 }, () =>
    `<i style="left:${(Math.random() * 100).toFixed(1)}vw;--x:${Math.round(Math.random() * 120 - 60)}px;`
    + `--t:${(7 + Math.random() * 9).toFixed(1)}s;--d:${(-Math.random() * 14).toFixed(1)}s;`
    + `transform:scale(${(0.5 + Math.random()).toFixed(2)})"></i>`).join('');
}

/* ------------------------------------------------------------------ */
/* Vestiaire                                                           */
/* ------------------------------------------------------------------ */

function rendreTable(r) {
  const moi = net.moi();
  $('code-table').textContent = r.code;
  const chaises = [];
  for (let k = 0; k < JOUEURS; k++) {
    const j = r.joueurs[k];
    if (j) {
      chaises.push(`<div class="chaise${j.id === r.hostId ? ' hote' : ''}${j.id === moi ? ' moi' : ''}">
        <span class="chaise-tete">🔥</span><b>${ui.esc(j.name)}</b>
        <i>${j.id === r.hostId ? 'hôte' : (j.id === moi ? 'vous' : 'prêt')}</i></div>`);
    } else {
      chaises.push('<div class="chaise vide"><span class="chaise-tete">🤖</span><b>Libre</b><i>un bot</i></div>');
    }
  }
  $('chaises').innerHTML = chaises.join('');
  const hote = r.hostId === moi;
  $('b-lancer').hidden = !hote;
  $('attente-hote').hidden = hote;
  $('b-lancer').textContent = r.joueurs.length >= JOUEURS
    ? 'Lancer la partie' : `Lancer · ${JOUEURS - r.joueurs.length} bot${JOUEURS - r.joueurs.length > 1 ? 's' : ''}`;
}

function remettreAZero() {
  arene.annuler();
  ui.remettreAZero();
  phaseVue = null;
  combatJoue = null;
  elimineMontre = false;
  finMontree = false;
  avant = null;
  for (const id of ['ov-heros', 'ov-decouverte', 'ov-fin']) $(id).hidden = true;
}

/* ------------------------------------------------------------------ */
/* États de partie                                                     */
/* ------------------------------------------------------------------ */

function bruits(v) {
  const m = v.moi;
  const p = avant;
  avant = m ? { ...m, plateau: m.plateau.length, triples: v.joueurs.find((j) => j.id === m.id)?.triples } : null;
  if (!p || !m || v.phase !== PHASE.RECRUTEMENT || p.mort) return;
  const triples = avant.triples;
  if (triples > p.triples) sfx.triple();
  else if (m.taverne > p.taverne) sfx.rang();
  else if (m.plateau.length > p.plateau && m.or < p.or) sfx.achat();
  else if (m.plateau.length < p.plateau && m.or > p.or) sfx.vente();
  else if (m.gel !== p.gel) sfx.gel();
  else if (m.pouvoirUtilise && !p.pouvoirUtilise) sfx.pouvoir();
  else if (m.boutique.length && p.boutique.length && m.boutique[0].uid !== p.boutique[0].uid
    && m.or <= p.or) sfx.rafraichir();
}

function surEtat(v, reste) {
  echeance = performance.now() + reste;
  const nouvellePhase = `${v.phase}:${v.tour}` !== phaseVue;
  phaseVue = `${v.phase}:${v.tour}`;

  switch (v.phase) {
    case PHASE.HEROS:
      ui.montrer('recrut');
      ui.rendreRecrutement(v);
      ui.rendreHeros(v, (id) => net.heros(id));
      break;

    case PHASE.RECRUTEMENT:
      $('ov-heros').hidden = true;
      if (nouvellePhase) {
        arene.annuler();
        ui.montrer('recrut');
        sfx.enclume();
      }
      bruits(v);
      ui.rendreRecrutement(v);
      if (v.moi && v.moi.mort && !elimineMontre) {
        elimineMontre = true;
        ui.rendreFin(v, { elimine: true });
      }
      break;

    case PHASE.COMBAT:
      $('ov-decouverte').hidden = true;
      if (v.combat && combatJoue !== v.tour) {
        combatJoue = v.tour;
        ui.montrer('combat');
        arene.rejouer(v);
      } else if (!v.combat) {
        ui.rendreRecrutement(v);
      }
      break;

    case PHASE.FIN:
      if (!finMontree) {
        finMontree = true;
        // On laisse la fin du dernier combat se jouer avant le podium.
        setTimeout(() => ui.rendreFin(v), 400);
      }
      break;

    default: break;
  }
}

/** Le chrono se calcule ici, sans attendre le serveur à chaque seconde. */
setInterval(() => {
  const s = Math.max(0, Math.ceil((echeance - performance.now()) / 1000));
  const c = $('r-chrono');
  c.textContent = `⏳ ${s}`;
  c.classList.toggle('presse', s <= 10 && phaseVue && phaseVue.startsWith(PHASE.RECRUTEMENT));
  $('heros-chrono').textContent = `Il vous reste ${s} seconde${s > 1 ? 's' : ''}.`;
}, 250);

/* ------------------------------------------------------------------ */
/* Réseau                                                              */
/* ------------------------------------------------------------------ */

const REFUS = {
  or: 'Pas assez d\'or.',
  plein: `Plateau plein (7 serviteurs au plus).`,
  'aucune cible': 'Il faut d\'abord un serviteur sur le plateau.',
  'déjà': 'C\'est déjà fait.',
  'déjà utilisé': 'Pouvoir déjà utilisé ce tour.',
  max: 'La taverne est au rang maximum.',
  passif: 'Ce pouvoir est passif : il agit tout seul.',
  'réserve vide': 'La réserve est épuisée.',
};

/** Le joueur est-il assis à une table, en partie ou au vestiaire ? */
const aTable = () => ['e-table', 'e-recrut', 'e-combat']
  .some((id) => $(id).classList.contains('actif'));

net.ecouter('statut', (s) => {
  // En pleine partie, une coupure se dit : l'écran ne doit pas sembler figé.
  if (s === 'perdu' && aTable()) ui.toast('Connexion perdue — reconnexion…', 2500);
  const el = $('net-statut');
  const dit = {
    connexion: ['Connexion à la forge…', ''],
    connecte: ['Forge allumée. Ouvrez une table ou rejoignez-en une.', 'ok'],
    perdu: ['Connexion perdue. Nouvelle tentative…', 'err'],
    injoignable: ['La forge est injoignable. Réessayez dans un instant.', 'err'],
  }[s] || ['', ''];
  el.textContent = dit[0];
  el.className = `statut${dit[1] ? ` ${dit[1]}` : ''}`;
});

net.ecouter('salon', (r) => {
  salon = r;
  remettreAZero();
  rendreTable(r);
  ui.montrer('table');
});
net.ecouter('debut', (reprise) => {
  remettreAZero();
  ui.montrer('recrut');
  if (reprise) ui.toast('De retour à la table.', 2200);
});

/*
 * Après une reconnexion, le serveur dit s'il a retrouvé notre place. S'il ne
 * l'a pas retrouvée alors qu'on se croyait à table, la table n'existe plus :
 * mieux vaut le dire et revenir au menu que rester devant un écran figé.
 */
net.ecouter('hello', (repris) => {
  if (repris || !aTable()) return;
  salon = null;
  remettreAZero();
  ui.montrer('menu');
  ui.toast('La table a été perdue pendant la coupure. Ouvrez-en une nouvelle.', 4500);
});
net.ecouter('etat', surEtat);
net.ecouter('refus', (raison) => { sfx.refus(); ui.toast(REFUS[raison] || 'Impossible pour l\'instant.'); });
net.ecouter('erreur', (m) => ui.toast(m, 3000));
net.ecouter('parti', () => { salon = null; remettreAZero(); ui.montrer('menu'); });

ui.brancher((a) => net.agir(a));

/* ------------------------------------------------------------------ */
/* Branchements                                                        */
/* ------------------------------------------------------------------ */

const REGLES = { partie: regles.pagePartie, mots: regles.pageMots, cartes: regles.pageCartes, heros: regles.pageHeros };
let reglesPretes = false;

function ouvrirRegles(page = 'partie') {
  if (!reglesPretes) {
    for (const [k, f] of Object.entries(REGLES)) $(`rp-${k}`).innerHTML = f();
    reglesPretes = true;
  }
  document.querySelectorAll('#regles-onglets .onglet').forEach((o) => o.classList.toggle('actif', o.dataset.page === page));
  for (const k of Object.keys(REGLES)) $(`rp-${k}`).classList.toggle('actif', k === page);
  $('ov-regles').hidden = false;
}

function nomSaisi() {
  const n = $('in-nom').value.trim().slice(0, 14);
  if (n) { nom = n; try { localStorage.setItem('brasier.nom', n); } catch { /* tant pis */ } }
  return nom || 'Forgeron';
}

function brancher() {
  $('in-nom').value = nom;
  $('b-creer').addEventListener('click', () => net.creer(nomSaisi()));
  $('b-rejoindre').addEventListener('click', () => {
    const code = $('in-code').value.trim().toUpperCase();
    if (code.length < 4) return ui.toast('Il faut les quatre caractères du code.');
    return net.rejoindre(code, nomSaisi());
  });
  $('in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('b-rejoindre').click(); });
  $('b-lancer').addEventListener('click', () => net.lancer());
  $('b-quitter-table').addEventListener('click', () => { net.quitter(); ui.montrer('menu'); });
  $('code-table').addEventListener('click', async () => {
    const code = $('code-table').textContent.trim();
    try { await navigator.clipboard.writeText(code); ui.toast('Code copié.'); } catch { ui.toast(code); }
  });

  $('b-quitter').addEventListener('click', () => {
    // Quitter en pleine partie : un bot reprend votre chaise, la table continue.
    if (!confirm('Quitter la partie ? Un bot prendra votre place.')) return;
    net.quitter();
    remettreAZero();
    ui.montrer('menu');
  });
  $('b-son').textContent = estMuet() ? '🔇' : '🔊';
  $('b-son').addEventListener('click', () => { $('b-son').textContent = basculer() ? '🔇' : '🔊'; });

  $('b-fin-menu').addEventListener('click', () => { net.quitter(); remettreAZero(); ui.montrer('menu'); });
  $('b-fin-table').addEventListener('click', () => {
    $('ov-fin').hidden = true;
    if (finMontree && salon) { rendreTable(salon); ui.montrer('table'); ui.toast('La table se rouvre dans un instant.'); }
  });

  document.querySelectorAll('[data-ouvre]').forEach((b) =>
    b.addEventListener('click', () => (b.dataset.ouvre === 'ov-regles' ? ouvrirRegles() : ($(b.dataset.ouvre).hidden = false))));
  document.querySelectorAll('[data-ferme]').forEach((b) =>
    b.addEventListener('click', () => { $(b.dataset.ferme).hidden = true; }));
  $('regles-onglets').addEventListener('click', (e) => {
    const o = e.target.closest('.onglet');
    if (o) ouvrirRegles(o.dataset.page);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('ov-regles').hidden) $('ov-regles').hidden = true;
  });
}

cendres();
brancher();
net.connecter({ name: nom || 'Forgeron' });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* le jeu marche sans */ });
  });
}

installerMusique('brasier', { actif: () => !estMuet() });
