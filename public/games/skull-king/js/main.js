/**
 * SKULL KING — les écrans, et la partie solo contre l'équipage.
 *
 * Le moteur (`moteur.js`) tient les règles, `table.js` dessine la table.
 * Ici : la navigation, les réglages, et le déroulement d'une partie solo.
 * La partie en ligne a son propre chef d'orchestre (`enligne.js`) ; les
 * gestes du joueur (une carte, un pari, « manche suivante ») vont à celui
 * des deux qui mène la table.
 */

import * as S from '../../../shared/skullking/moteur.js';
import { portraitSkSvg } from './cartes.js';
import { sfx, sonActif, basculer, deverrouiller } from './sfx.js';
import { installerMusique } from '../../../shared/musique.js';
import { installerScore, afficherScore } from './score.js';
import { reglesHtml } from './regles.js';
import * as T from './table.js';
import * as enLigne from './enligne.js';
import { bandeau } from '../../../shared/reprise.js';

const $ = (id) => document.getElementById(id);
const { attendre, txt, toast } = T;

const CLE_PREFS = 'skullking.prefs';

/** L'équipage de l'ordinateur. */
const EQUIPAGE = [
  { nom: 'Barbe-Grise', av: '🦜' },
  { nom: 'Rosa la Rouge', av: '🌹' },
  { nom: 'Jack Tortue', av: '🐢' },
  { nom: 'Bahia', av: '🗡️' },
  { nom: 'Harald', av: '⚓' },
  { nom: 'La Mouette', av: '🕊️' },
];

const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* ignore */ } };
// L'ancienne sauvegarde de partie solo n'a plus cours.
try { localStorage.removeItem('skullking.partie'); } catch { /* ignore */ }

const prefs = { nom: '', bots: 3, ...lire(CLE_PREFS, {}) };
export const nomPrefere = () => prefs.nom;
export function retenirNom(nom) { prefs.nom = nom; ecrire(CLE_PREFS, prefs); }

/* ================================================================== */
/* Navigation                                                         */
/* ================================================================== */

export function aller(id) {
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id));
  document.body.dataset.ecran = id;
  if (id === 's-score') afficherScore();
}

export function ouvrir(id) { $(id).hidden = false; }
export function fermer(id) { $(id).hidden = true; }

document.addEventListener('click', (e) => {
  const va = e.target.closest('[data-va]');
  if (va) { sfx.clic(); aller(va.dataset.va); }
  const f = e.target.closest('[data-ferme]');
  if (f) fermer(f.dataset.ferme);
  deverrouiller();
});
// Toucher le voile autour d'une feuille la ferme (sauf celles qui attendent une réponse).
document.querySelectorAll('.voile').forEach((v) => v.addEventListener('click', (e) => {
  if (e.target === v && !['ov-bilan', 'ov-fin', 'ov-tigresse'].includes(v.id)) v.hidden = true;
}));

/* ================================================================== */
/* Menu et réglage                                                    */
/* ================================================================== */

$('logo-crane').innerHTML = portraitSkSvg();

function majReglage() {
  $('choix-bots').innerHTML = [1, 2, 3, 4, 5, 6].map((n) =>
    `<button class="puce${n === prefs.bots ? ' is-on' : ''}" data-bots="${n}">${n}</button>`).join('');
  $('apercu-equipage').innerHTML = EQUIPAGE.slice(0, prefs.bots).map((x) => `<span>${x.av} ${txt(x.nom)}</span>`).join('');
}
$('choix-bots').addEventListener('click', (e) => {
  const b = e.target.closest('[data-bots]');
  if (!b) return;
  prefs.bots = +b.dataset.bots;
  sfx.clic();
  majReglage();
});
$('in-nom').value = prefs.nom;
majReglage();

$('b-lancer').addEventListener('click', () => {
  retenirNom($('in-nom').value.trim().slice(0, 14));
  nouvellePartie();
});

$('b-en-ligne').addEventListener('click', () => { sfx.clic(); enLigne.ouvrir(); });

$('b-son').addEventListener('click', () => { majSon(basculer()); });
function majSon(on) { $('b-son').innerHTML = `<span class="bi">${on ? '🔊' : '🔇'}</span> Son`; }
majSon(sonActif());

$('b-regles').addEventListener('click', () => { $('regles').innerHTML = reglesHtml(); ouvrir('ov-regles'); });

/* ================================================================== */
/* La partie solo                                                     */
/* ================================================================== */

let G = null;
let occupe = false;       // une animation est en cours : on ne relance pas la boucle
let jeton = 0;            // change à chaque partie : les minuteurs d'une ancienne partie se taisent

function nouvellePartie() {
  const equipage = EQUIPAGE.slice(0, prefs.bots);
  G = S.creerPartie({
    noms: [prefs.nom || 'Capitaine', ...equipage.map((x) => x.nom)],
    bots: [false, ...equipage.map(() => true)],
  });
  G.avatars = ['🧭', ...equipage.map((x) => x.av)];
  jeton++;
  occupe = false;
  aller('s-table');
  debutManche();
}

async function debutManche() {
  const j = jeton;
  S.nouvelleManche(G, Math.random);
  fermer('ov-bilan');
  if (G.phase === 'fin') { finPartie(); return; }
  // Les pirates de l'ordinateur parient tout de suite, mais en secret.
  G.parisCaches = G.mains.map((m, p) => (G.bots[p] ? S.pariBot(m, G.n) : null));
  T.rendreTout(G, { donne: true });
  sfx.donne();
  await attendre(450 + G.manche * 60);
  if (j !== jeton) return;
  T.montrerPari(G);
  T.consigne(`Manche ${G.manche} : ${G.manche} carte${G.manche > 1 ? 's' : ''} en main`);
}

async function parierSolo(v) {
  if (G.phase !== 'pari') return;
  T.cacherPari();
  S.parier(G, 0, v);
  for (let p = 1; p < G.n; p++) S.parier(G, p, G.parisCaches[p]);
  sfx.pari();
  T.rendreSieges(G, { revele: true });
  const total = G.paris.reduce((s, x) => s + x, 0);
  T.annoncer(`Yo ho ! ${total} pli${total > 1 ? 's' : ''} annoncé${total > 1 ? 's' : ''} pour ${G.manche} en jeu`);
  await attendre(1500);
  boucle();
}

/** Le moteur de la table : qui joue, et quand. */
async function boucle() {
  if (occupe || !G) return;
  const j = jeton;
  if (G.phase === 'jeu') {
    if (G.bots[G.tour]) {
      T.rendreSieges(G);
      T.consigne('');
      T.rendreMain(G);
      occupe = true;
      await attendre(700 + Math.random() * 350);
      occupe = false;
      if (j !== jeton || G.phase !== 'jeu') return;
      const c = S.coupBot(G, G.tour);
      await jouerSolo(G.tour, c.id, c.as);
    } else {
      T.rendreSieges(G);
      T.rendreMain(G, { monTour: true });
      T.consigne(T.consigneTour(G));
    }
  } else if (G.phase === 'pli') await conclurePli();
  else if (G.phase === 'bilan') montrerBilan();
  else if (G.phase === 'fin') finPartie();
}

async function jouerSolo(p, id, as) {
  const r0 = T.origine(p, id);
  const res = S.jouer(G, p, id, as);
  if (!res.ok) { toast(res.raison); return; }
  occupe = true;
  sfx.carte();
  T.rendrePli(G);
  T.rendreMain(G);
  T.rendreSieges(G);
  T.poser(r0, p === 0);
  await attendre(480);
  occupe = false;
  boucle();
}

async function conclurePli() {
  const j = jeton;
  occupe = true;
  const r = S.resoudre(G.pli);
  await attendre(350);
  T.montrerVainqueur(G, r, sfx);
  await attendre(r.bonus ? 1900 : 1400);
  if (j !== jeton) return;
  await T.ramasser(r);
  S.ramasser(G);
  T.rendrePli(G);
  T.rendreSieges(G);
  T.feterVainqueur(r);
  occupe = false;
  if (G.phase === 'bilan') { await attendre(600); if (j === jeton) montrerBilan(); } else boucle();
}

function montrerBilan() {
  const b = T.remplirBilan(G);
  if (!b) return;
  $('b-suite').disabled = false;
  $('b-suite').textContent = G.manche >= G.manches ? 'Voir le classement' : `Manche ${G.manche + 1}`;
  ouvrir('ov-bilan');
  if (b[0].pari === b[0].plis) sfx.tenu(); else sfx.rate();
}

function finPartie() {
  G.phase = 'fin';
  fermer('ov-bilan');
  T.remplirFin(G);
  $('b-fin-menu').textContent = 'Menu';
  $('b-fin-rejouer').textContent = 'Revanche';
  ouvrir('ov-fin');
  sfx.fin();
}

/* ================================================================== */
/* Les gestes du joueur, vers la partie qui mène la table             */
/* ================================================================== */

$('pari-choix').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pari]');
  if (!b) return;
  if (enLigne.actif()) enLigne.parier(+b.dataset.pari);
  else parierSolo(+b.dataset.pari);
});

$('main').addEventListener('click', (e) => {
  const c = e.target.closest('[data-id]');
  if (!c) return;
  const etat = enLigne.actif() ? enLigne.etat() : G;
  if (!etat || etat.phase !== 'jeu' || etat.tour !== 0 || (!enLigne.actif() && occupe)) return;
  const carte = etat.mains[0].find((x) => x.id === c.dataset.id);
  if (!carte) return;
  if (!S.legales(etat.mains[0], etat.pli).includes(carte)) {
    toast(`Il faut suivre la couleur demandée : ${S.COULEURS[S.couleurDemandee(etat.pli)].nom}`);
    return;
  }
  if (carte.t === 'tig') { ouvrir('ov-tigresse'); return; }
  if (enLigne.actif()) enLigne.jouer(carte.id, null); else jouerSolo(0, carte.id, null);
});
document.querySelectorAll('[data-tig]').forEach((b) => b.addEventListener('click', () => {
  fermer('ov-tigresse');
  if (enLigne.actif()) enLigne.jouer('tig', b.dataset.tig); else jouerSolo(0, 'tig', b.dataset.tig);
}));

$('b-suite').addEventListener('click', () => {
  sfx.clic();
  if (enLigne.actif()) enLigne.pret(); else debutManche();
});

$('b-fin-menu').addEventListener('click', () => {
  fermer('ov-fin');
  if (enLigne.actif()) { enLigne.quitter(); return; }
  G = null; jeton++; aller('s-menu');
});
$('b-fin-rejouer').addEventListener('click', () => {
  fermer('ov-fin');
  if (enLigne.actif()) enLigne.retourTable(); else nouvellePartie();
});

$('b-quitter').addEventListener('click', () => {
  $('quitter-note').textContent = enLigne.actif()
    ? 'Un pirate de l’ordinateur prendra votre place à la table.'
    : 'La partie en cours sera perdue.';
  ouvrir('ov-quitter');
});
$('b-quitter-ok').addEventListener('click', () => {
  fermer('ov-quitter');
  if (enLigne.actif()) { enLigne.quitter(); return; }
  jeton++; occupe = false; G = null; aller('s-menu');
});
$('b-tableau').addEventListener('click', () => {
  const etat = enLigne.actif() ? enLigne.etat() : G;
  if (!etat) return;
  $('tableau-partie').innerHTML = T.tableauPartie(etat);
  ouvrir('ov-tableau');
});

addEventListener('resize', () => T.ajusterMain());

/* ================================================================== */
/* Démarrage                                                          */
/* ================================================================== */

installerScore({ toast, sfx, ouvrir, fermer });
enLigne.installer({ aller, ouvrir, fermer, nomPrefere, retenirNom });
installerMusique('skullking', { actif: sonActif });

// Une partie en ligne interrompue (application fermée, réseau perdu) : on peut la rejoindre.
bandeau('skullking', { visible: () => $('s-menu').classList.contains('is-active'), rejoindre: () => enLigne.ouvrir() });

// Un lien d'invitation (…/skull-king/?table=ABCD) mène droit à la table.
const invitation = new URLSearchParams(location.search).get('table');
if (invitation) enLigne.ouvrir(invitation);
