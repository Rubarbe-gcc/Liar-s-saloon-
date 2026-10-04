/**
 * SKULL KING — la partie en ligne.
 *
 * Le serveur (server/skullking.js) tient la partie ; ce module tient la
 * connexion, le salon, et rejoue à l'écran chaque état reçu : une carte qui
 * arrive sur la table, un pli qu'on ramasse, une nouvelle donne. Les états
 * sont traités un par un, pour qu'une animation ne soit jamais coupée par la
 * suivante.
 *
 * La table est toujours montrée « vue d'ici » : le joueur de cet écran est le
 * numéro 0, les autres suivent dans l'ordre du jeu.
 *
 * Une coupure en pleine partie n'est pas un départ : on se reconnecte avec la
 * même clé de session, et le serveur rend la place (voir shared/reprise.js).
 */

import * as S from '../../../shared/skullking/moteur.js';
import * as T from './table.js';
import { sfx } from './sfx.js';
import * as reprise from '../../../shared/reprise.js';

const $ = (id) => document.getElementById(id);
const { attendre, txt, toast } = T;
const JEU = 'skullking';

let o = null;               // { aller, ouvrir, fermer, nomPrefere, retenirNom }
let ws = null;
let voulu = false;
let delai = 800;
let minuteurConnexion = 0;
let battement = 0;
let monId = null;
let salon = null;           // dernier vestiaire reçu
let enJeu = false;          // une partie est en cours à cette table
let attendReprise = false;  // on revient d'une partie interrompue
let codeVoulu = null;       // un code d'invitation à rejoindre dès la connexion

/** Le dernier état reçu (brut, numéros du serveur) et sa version « vue d'ici ». */
let vue = null;
let local = null;
const file = [];
let enCours = false;
let minuteurChrono = 0;

export const actif = () => enJeu && $('s-table').classList.contains('is-active');
export const etat = () => local;

/* ------------------------------------------------------------------ */
/* Connexion                                                          */
/* ------------------------------------------------------------------ */

const adresse = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;

function statut(m, cls = '') {
  const e = $('en-statut');
  e.textContent = m;
  e.className = `note ${cls}`;
}

function connecter() {
  if (!voulu && !salon) attendReprise = reprise.adopter(JEU);
  voulu = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  statut('Connexion au port…');
  try { ws = new WebSocket(adresse()); } catch { relancer(); return; }
  ws.addEventListener('open', () => {
    delai = 800;
    statut('Connecté. Ouvrez une table, ou montez à bord avec un code.', 'ok');
    // La clé de session d'abord : si une place nous attend, le serveur nous la rend.
    envoyer({ t: 'session', sid: reprise.session(JEU) });
    envoyer({ t: 'hello', name: nom() });
    clearInterval(battement);
    battement = setInterval(() => { envoyer({ t: 'ping' }); if (enJeu) reprise.enPartie(JEU, { code: salon?.code }); }, 20000);
  });
  ws.addEventListener('message', (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    traiter(m);
  });
  ws.addEventListener('close', () => {
    clearInterval(battement);
    ws = null;
    if (!voulu) return;
    if (enJeu) { reprise.interrompue(JEU); toast('Connexion perdue — votre place vous attend, on se reconnecte…', 3500); }
    statut('Connexion perdue. Nouvelle tentative…', 'ko');
    relancer();
  });
  ws.addEventListener('error', () => { /* le close suivant s'en occupe */ });
}

function relancer() {
  clearTimeout(minuteurConnexion);
  if (!voulu) return;
  minuteurConnexion = setTimeout(() => { delai = Math.min(delai * 1.6, 10000); connecter(); }, delai);
}

function deconnecter() {
  voulu = false;
  clearTimeout(minuteurConnexion);
  clearInterval(battement);
  if (ws) { try { ws.close(); } catch { /* déjà fermée */ } }
  ws = null;
}

function envoyer(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try { ws.send(JSON.stringify({ g: JEU, ...msg })); return true; } catch { return false; }
}

const nom = () => ($('en-nom').value.trim() || o.nomPrefere() || 'Moussaillon').slice(0, 14);

/* ------------------------------------------------------------------ */
/* Messages du serveur                                                */
/* ------------------------------------------------------------------ */

function traiter(m) {
  switch (m.t) {
    case 'sk:bienvenue': monId = m.id; return;

    case 'session':
      if (m.repris) { attendReprise = false; toast('✅ Vous revoilà à bord.', 2400); return; }
      if (attendReprise) {
        attendReprise = false;
        reprise.oublier(JEU);
        toast('Cette partie n’existe plus : elle est finie, ou l’attente a dépassé 5 minutes.', 3800);
      }
      if (enJeu) {
        // La place n'a pas été gardée.
        finirLocal();
        o.aller('s-enligne');
        porte(true);
        toast('La partie a continué sans vous.', 3200);
      } else if (salon) {
        // Au vestiaire, une coupure libère la chaise : on la reprend.
        envoyer({ t: 'join', code: salon.code, name: nom() });
      } else if (codeVoulu) {
        envoyer({ t: 'join', code: codeVoulu, name: nom() });
        codeVoulu = null;
      }
      return;

    case 'sk:salon':
      salon = m;
      if (!m.enPartie) {
        if (enJeu) finirLocal();
        o.fermer('ov-fin');
        rendreSalon();
        if (!$('s-enligne').classList.contains('is-active')) o.aller('s-enligne');
      }
      return;

    case 'sk:debut':
      enJeu = true;
      reprise.enPartie(JEU, { code: salon?.code });
      vue = null;
      local = null;
      file.length = 0;
      ['ov-bilan', 'ov-fin', 'ov-tigresse', 'ov-quitter'].forEach((id) => o.fermer(id));
      $('pli').innerHTML = '';
      o.aller('s-table');
      return;

    case 'sk:etat':
      if (!enJeu) { enJeu = true; o.aller('s-table'); }
      file.push(m.vue);
      vider();
      return;

    case 'sk:notice': toast(m.msg, 3400); return;
    case 'sk:erreur': toast(m.msg, 3200); return;
    case 'sk:parti':
      salon = null;
      finirLocal();
      return;
    default:
  }
}

function finirLocal() {
  enJeu = false;
  vue = null;
  local = null;
  file.length = 0;
  clearInterval(minuteurChrono);
  reprise.oublier(JEU);
}

/* ------------------------------------------------------------------ */
/* Le vestiaire                                                       */
/* ------------------------------------------------------------------ */

function porte(ouverte) {
  $('en-porte').hidden = !ouverte;
  $('en-salon').hidden = ouverte;
}

function rendreSalon() {
  porte(false);
  const hote = salon.hostId === monId;
  $('en-code-table').textContent = salon.code;
  $('en-joueurs').innerHTML = salon.joueurs.map((j) => `<li class="${j.id === monId ? 'est-moi' : ''}">
    <span class="avatar">${j.av}</span><b>${txt(j.name)}</b>
    ${j.id === salon.hostId ? '<i class="etiq">capitaine</i>' : ''}${j.bot ? '<i class="etiq bot">bot</i>' : ''}${j.id === monId ? '<i class="etiq vous">vous</i>' : ''}</li>`).join('');
  const n = salon.joueurs.length;
  const bots = salon.joueurs.filter((j) => j.bot).length;
  $('en-bots').hidden = !hote;
  $('en-nb-bots').textContent = bots;
  $('en-moins').disabled = bots === 0;
  $('en-plus').disabled = n >= salon.max;
  // Le mode custom : le capitaine choisit, les autres voient ce qui les attend.
  const extras = salon.extras || [];
  $('en-custom').innerHTML = hote
    ? `<label class="interrupteur-sombre"><input type="checkbox" id="en-custom-on" ${extras.length ? 'checked' : ''}>
        <span><b>✦ Mode custom</b><i>Des cartes en plus, inventées pour la maison</i></span></label>
       ${extras.length ? `<div class="puces-custom">${o.pucesCustom(extras, true)}</div>` : ''}`
    : (extras.length
      ? `<div class="etiquette">✦ Mode custom — cartes en plus</div><div class="puces-custom">${o.pucesCustom(extras, false)}</div>`
      : '<p class="aucune">Partie classique, sans cartes custom.</p>');
  $('en-lancer').hidden = !hote;
  $('en-lancer').disabled = n < 2;
  $('en-note').textContent = hote
    ? (n < 2 ? 'Partagez le code, ou ajoutez des bots : il faut au moins deux joueurs.' : `${n} joueurs à bord. Lancez quand l’équipage est au complet.`)
    : 'Le capitaine de la table lance la partie.';
}

/* ------------------------------------------------------------------ */
/* La table vue d'ici                                                 */
/* ------------------------------------------------------------------ */

/** Fait tourner la table pour que ce joueur soit le numéro 0. */
function versLocal(v) {
  const n = v.n;
  const moi = Math.max(0, v.moi);
  const rot = (a) => (a ? a.map((_, i) => a[(i + moi) % n]) : a);
  const ici = (p) => (p == null ? p : (p - moi + n) % n);
  const res = (r) => (r ? {
    ...r, gagnant: ici(r.gagnant), meneur: ici(r.meneur),
    extras: (r.extras || []).map((x) => ({ ...x, p: ici(x.p) })),
  } : null);
  return {
    n, manche: v.manche, manches: v.manches, phase: v.phase,
    noms: rot(v.noms), avatars: rot(v.avatars), bots: rot(v.bots), absents: rot(v.absents),
    scores: rot(v.scores), paris: rot(v.paris), aParie: rot(v.aParie), plis: rot(v.plis),
    prets: rot(v.prets), cartes: rot(v.cartes),
    mains: [v.main],
    pli: v.pli.map((j) => ({ ...j, p: ici(j.p) })),
    tour: ici(v.tour), donneur: ici(v.donneur),
    resolution: res(v.resolution),
    dernier: v.dernier ? { ...res(v.dernier), pli: v.dernier.pli.map((j) => ({ ...j, p: ici(j.p) })) } : null,
    historique: v.historique.map(rot),
    reste: v.reste,
    extras: v.extras || [],
  };
}

async function vider() {
  if (enCours) return;
  enCours = true;
  try {
    while (file.length) {
      const v = file.shift();
      await montrer(v);
    }
  } catch (err) {
    console.error('[skullking] affichage', err);
  } finally {
    enCours = false;
  }
}

/** Rejoue à l'écran le passage de l'état précédent à celui-ci. */
async function montrer(v) {
  const avant = local;
  const G = versLocal(v);
  const nouvelleDonne = !avant || avant.manche !== G.manche || (avant.phase === 'bilan' && G.phase === 'pari');
  vue = v;

  if (G.phase === 'fin') {
    local = G;
    T.rendreTout(G);
    o.fermer('ov-bilan');
    T.remplirFin(G);
    $('b-fin-menu').textContent = 'Quitter la table';
    $('b-fin-rejouer').textContent = 'Retour à la table';
    if ($('ov-fin').hidden) { o.ouvrir('ov-fin'); sfx.fin(); }
    reprise.oublier(JEU);
    return;
  }

  if (G.phase === 'bilan') {
    // Le dernier pli d'abord, s'il n'a pas encore été montré.
    if (avant && avant.phase !== 'bilan') await ramasserSiBesoin(avant, G);
    local = G;
    T.rendreTout(G);
    const b = T.remplirBilan(G);
    const pret = G.prets[0];
    $('b-suite').disabled = pret;
    const attente = G.noms.filter((_, p) => !G.prets[p] && !G.bots[p] && !G.absents[p]);
    $('b-suite').textContent = pret
      ? `En attente de ${attente.length ? attente.join(', ') : 'la table'}…`
      : (G.manche >= G.manches ? 'Voir le classement' : `Prêt pour la manche ${G.manche + 1}`);
    if ($('ov-bilan').hidden) {
      o.ouvrir('ov-bilan');
      if (b && b[0].pari === b[0].plis) sfx.tenu(); else sfx.rate();
    }
    T.cacherPari();
    chrono(null);
    return;
  }

  if (nouvelleDonne) {
    o.fermer('ov-bilan');
    $('pli').innerHTML = '';
    local = G;
    T.rendreTout(G, { donne: !avant || avant.manche !== G.manche, monTour: monTour(G) });
    sfx.donne();
    if (G.phase === 'pari') {
      await attendre(avant ? 400 + G.manche * 50 : 0);
      if (local !== G) return;
      apresPari(G);
    } else apresJeu(G);
    return;
  }

  // Tout le monde a parié : les paris se révèlent.
  if (avant.phase === 'pari' && G.phase !== 'pari') {
    local = G;
    T.cacherPari();
    sfx.pari();
    T.rendreSieges(G, { revele: true });
    const total = G.paris.reduce((s, x) => s + x, 0);
    T.annoncer(`Yo ho ! ${total} pli${total > 1 ? 's' : ''} annoncé${total > 1 ? 's' : ''} pour ${G.manche} en jeu`);
    await attendre(1300);
  }

  // Le pli précédent a été ramassé.
  const memePli = G.pli.length >= avant.pli.length && sameStart(avant.pli, G.pli);
  if (avant.pli.length && !memePli) await ramasserSiBesoin(avant, G);

  // De nouvelles cartes sur la table.
  const deja = memePli ? avant.pli.length : 0;
  for (let k = deja; k < G.pli.length; k++) {
    const j = G.pli[k];
    const r0 = T.origine(j.p, j.c.id);
    local = { ...G, pli: G.pli.slice(0, k + 1), mains: j.p === 0 ? G.mains : (local.mains || G.mains), phase: 'jeu', tour: j.p };
    T.rendrePli(local);
    if (j.p === 0) T.rendreMain(G);
    sfx.carte();
    T.poser(r0, j.p === 0);
    await attendre(420);
  }

  local = G;
  T.rendreSieges(G);
  T.rendrePli(G);
  if (G.phase === 'pli' && G.resolution) {
    T.rendreMain(G);
    T.montrerVainqueur(G, G.resolution, sfx);
    chrono(null);
    return;
  }
  if (G.phase === 'pari') apresPari(G);
  else apresJeu(G);
}

const sameStart = (a, b) => a.every((j, i) => b[i] && b[i].c.id === j.c.id);

/** Fait voler le pli complet de `avant` vers son vainqueur. */
async function ramasserSiBesoin(avant, G) {
  const r = G.dernier || avant.resolution;
  if (!r || !avant.pli.length) return;
  if (avant.phase !== 'pli') {
    // On n'a pas vu le pli complet (reconnexion, ou état sauté) : on le montre vite.
    T.rendrePli({ ...avant, pli: r.pli || avant.pli });
    T.montrerVainqueur(G, r, sfx);
    await attendre(900);
  }
  await T.ramasser(r);
  T.feterVainqueur(r);
}

const monTour = (G) => G.phase === 'jeu' && G.tour === 0;

function apresPari(G) {
  if (G.paris[0] === null) {
    T.montrerPari(G);
    T.consigne(`Manche ${G.manche} : ${G.manche} carte${G.manche > 1 ? 's' : ''} en main — votre pari ?`);
  } else {
    T.cacherPari();
    const attente = G.noms.filter((_, p) => !G.aParie[p]);
    T.consigne(attente.length ? `Pari envoyé. On attend : ${attente.join(', ')}` : 'Les paris tombent…');
  }
  T.rendreMain(G);
  chrono(G.paris[0] === null ? G.reste : null);
}

function apresJeu(G) {
  T.cacherPari();
  const mien = monTour(G);
  T.rendreMain(G, { monTour: mien });
  T.consigne(mien ? T.consigneTour(G) : G.absents[G.tour] ? `${G.noms[G.tour]} est déconnecté…` : '');
  chrono(mien ? G.reste : null);
}

/** Un petit compte à rebours quand c'est à nous. */
function chrono(ms) {
  clearInterval(minuteurChrono);
  $('chrono').hidden = !ms;
  if (!ms) return;
  const fin = Date.now() + ms;
  const maj = () => {
    const s = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
    $('chrono').textContent = `⏳ ${s} s`;
    $('chrono').classList.toggle('presse', s <= 10);
    if (s <= 0) clearInterval(minuteurChrono);
  };
  maj();
  minuteurChrono = setInterval(maj, 500);
}

/* ------------------------------------------------------------------ */
/* Gestes                                                             */
/* ------------------------------------------------------------------ */

export function parier(v) {
  if (!local || local.phase !== 'pari') return;
  T.cacherPari();
  chrono(null);
  T.consigne('Pari envoyé…');
  envoyer({ t: 'pari', v });
}

export function jouer(id, as) {
  if (!local || local.phase !== 'jeu' || local.tour !== 0) return;
  T.rendreMain(local);            // plus rien n'est cliquable en attendant le serveur
  chrono(null);
  envoyer({ t: 'jouer', id, as });
}

export function pret() {
  $('b-suite').disabled = true;
  $('b-suite').textContent = 'En attente des autres…';
  envoyer({ t: 'pret' });
}

/** Quitter la table (et la partie, s'il y en a une). */
export function quitter() {
  envoyer({ t: 'leave' });
  salon = null;
  finirLocal();
  ['ov-bilan', 'ov-fin', 'ov-tigresse'].forEach((id) => o.fermer(id));
  porte(true);
  o.aller('s-enligne');
}

/** Après le classement : tout le monde revient au vestiaire, pour une revanche. */
export function retourTable() { envoyer({ t: 'rejouer' }); }

/** Ouvrir l'écran en ligne (avec, peut-être, un code d'invitation). */
export function ouvrir(code = null) {
  $('en-nom').value = o.nomPrefere();
  if (code) {
    codeVoulu = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    $('en-code').value = codeVoulu;
  }
  if (!salon) porte(true);
  o.aller('s-enligne');
  connecter();
  // Déjà connecté : le code d'invitation part tout de suite.
  if (codeVoulu && ws && ws.readyState === WebSocket.OPEN) { envoyer({ t: 'join', code: codeVoulu, name: nom() }); codeVoulu = null; }
}

export function installer(outils) {
  o = outils;
  $('en-retour').addEventListener('click', () => {
    if (salon) envoyer({ t: 'leave' });
    salon = null;
    finirLocal();
    deconnecter();
    o.aller('s-menu');
  });
  $('en-creer').addEventListener('click', () => {
    sfx.clic();
    o.retenirNom(nom());
    if (!envoyer({ t: 'create', name: nom() })) toast('Pas encore connecté…');
  });
  const rejoindre = () => {
    const code = $('en-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (code.length < 4) { toast('Le code fait 4 caractères.'); return; }
    sfx.clic();
    o.retenirNom(nom());
    if (!envoyer({ t: 'join', code, name: nom() })) toast('Pas encore connecté…');
  };
  $('en-rejoindre').addEventListener('click', rejoindre);
  $('en-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') rejoindre(); });
  $('en-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
  $('en-plus').addEventListener('click', () => { sfx.clic(); envoyer({ t: 'bot', delta: 1 }); });
  $('en-moins').addEventListener('click', () => { sfx.clic(); envoyer({ t: 'bot', delta: -1 }); });
  $('en-lancer').addEventListener('click', () => { sfx.clic(); envoyer({ t: 'start' }); });
  $('en-custom').addEventListener('change', (e) => {
    if (e.target.id !== 'en-custom-on') return;
    envoyer({ t: 'options', extras: e.target.checked ? S.TOUTES_CUSTOM : [] });
  });
  $('en-custom').addEventListener('click', (e) => {
    const b = e.target.closest('[data-custom]');
    if (!b || b.disabled || !salon) return;
    const t = b.dataset.custom;
    const extras = salon.extras || [];
    const suite = extras.includes(t) ? extras.filter((x) => x !== t) : [...extras, t];
    sfx.clic();
    // On garde au moins une carte : pour tout retirer, on décoche le mode custom.
    if (suite.length) envoyer({ t: 'options', extras: suite });
  });
  $('en-quitter').addEventListener('click', () => { sfx.clic(); quitter(); });
  $('en-code-table').addEventListener('click', async () => {
    if (!salon) return;
    const lien = `${location.origin}/games/skull-king/?table=${salon.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Skull King', text: `Monte à bord ! Table ${salon.code}`, url: lien });
      else { await navigator.clipboard.writeText(lien); toast('Lien d’invitation copié.'); }
    } catch { /* partage annulé */ }
  });
  reprise.surveiller(JEU);
}
