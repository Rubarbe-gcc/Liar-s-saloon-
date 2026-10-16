/**
 * PETIT PONT — le jeu : les menus, le choix des équipes, le match (la boucle
 * à 60 images par seconde, l'interface par-dessus la 3D, les ralentis), la
 * fin du match.
 *
 * Le match lui-même est joué par le moteur partagé (shared/foot/match.js) ;
 * la 3D (trois/rendu3d.js) ne fait que le montrer.
 */

import { EQUIPES, EQUIPE, STADES, STYLES, noteGenerale } from '../../../shared/foot/equipes.js';
import { creerMatch, pas, chronoTexte, acteursTab, FPS } from '../../../shared/foot/match.js';
import { DUREE_ROULETTE } from '../../../shared/foot/terrain.js';
import { NIVEAUX } from '../../../shared/foot/ia.js';
import { creerCoupe, matchDuJoueur, stadeDuTour, enregistrer, jouerSansMoi, aJouer, avancer, TOURS } from '../../../shared/foot/coupe.js';
import { creerRendu, qualite, reglerQualite } from './trois/rendu3d.js';
import { ecussonSVG, tenues } from './ecusson.js';
import * as saisie from './saisie.js';
import * as son from './son.js';
import * as succes from '../../../shared/succes.js';
import * as net from './enligne.js';
import { creerLissage } from './lissage.js';
import { creerCommentateur, reglage as reglageCommentaires, regler as reglerCommentaires } from './commentaires.js';

const $ = (id) => document.getElementById(id);
const PAS = 1 / FPS;
let ecran = 'menu';
function aller(nom) {
  for (const s of document.querySelectorAll('.ecran')) s.classList.toggle('is-active', s.id === `s-${nom}`);
  ecran = nom;
  document.querySelector('.fond').classList.toggle('cache', nom === 'match');
}

/* ------------------------------------------------------------------ */
/* Les réglages gardés d'une fois sur l'autre                          */
/* ------------------------------------------------------------------ */

const CLE = 'petitpont.config';
const conf = { moi: 'brisevent', lui: 'ferrac', niveau: 1, minutes: 3, stade: 'chaudron' };
try { Object.assign(conf, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch { /* ignore */ }
if (!EQUIPE[conf.moi]) conf.moi = 'brisevent';
if (!EQUIPE[conf.lui] || conf.lui === conf.moi) conf.lui = EQUIPES.find((e) => e.id !== conf.moi).id;
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(conf)); } catch { /* ignore */ } };

const COULEURS_STADE = {
  chaudron: ['linear-gradient(180deg,#03050f,#1a2240)', '#2e8b3e'],
  toit: ['linear-gradient(180deg,#0b0820,#3a2a5a)', '#2f8a4a'],
  halle: ['linear-gradient(180deg,#3d6fa8,#e6e0d2)', '#c8955a'],
  plage: ['linear-gradient(180deg,#4a2f7a,#ff9a52)', '#4f9a3c'],
};

/* ------------------------------------------------------------------ */
/* Le choix des équipes                                                */
/* ------------------------------------------------------------------ */

let choix = { pour: 'moi', mode: 'solo', suite: null };

function carteDuel(el, id, role) {
  const eq = EQUIPE[id];
  el.style.setProperty('--c1', eq.maillot.fond);
  el.innerHTML = `${ecussonSVG(eq, 56)}<span><span class="role">${role}</span><span class="nom">${eq.nom}</span><small>${eq.ville} · ${STYLES[eq.style].nom}</small></span>`;
}

function barres(eq) {
  const n = eq.notes;
  return `<div class="barres">${[['VIT', n.vitesse], ['TIR', n.tir], ['PAS', n.passe], ['DÉF', n.defense], ['GAR', n.gardien]]
    .map(([k, v]) => `<span>${k}</span><i style="--v:${Math.round(((v - 55) / 45) * 100)}%"></i>`).join('')}</div>`;
}

function rendreEquipes() {
  const solo = choix.mode === 'solo';
  carteDuel($('duel-moi'), conf.moi, 'Toi');
  $('duel-lui').classList.toggle('cache', !solo);
  document.querySelector('.duel .vs').classList.toggle('cache', !solo);
  if (solo) carteDuel($('duel-lui'), conf.lui, 'Adversaire');
  $('duel-moi').classList.toggle('choisit', choix.pour === 'moi');
  $('duel-lui').classList.toggle('choisit', choix.pour === 'lui');
  $('consigne-equipes').textContent = choix.pour === 'moi' ? 'Choisis ton équipe.' : 'Choisis l’adversaire.';
  $('equipes-titre').textContent = { solo: 'Match amical', coupe: 'La Coupe : ton équipe', enligne: 'En ligne : ton équipe' }[choix.mode];
  $('grille-equipes').innerHTML = EQUIPES.map((eq) => {
    const moi = eq.id === conf.moi, lui = solo && eq.id === conf.lui;
    return `<button class="equipe${moi ? ' moi' : ''}${lui ? ' lui' : ''}" data-id="${eq.id}" style="--c1:${eq.maillot.fond}">
      ${moi ? '<span class="marque">TOI</span>' : lui ? '<span class="marque">ADV</span>' : ''}<span class="note">${noteGenerale(eq)}</span>
      ${ecussonSVG(eq, 60)}<span class="nom">${eq.nom}</span><span class="style">${STYLES[eq.style].nom}</span>${barres(eq)}</button>`;
  }).join('');
  $('options-match').classList.toggle('cache', choix.mode === 'enligne');
  $('seg-niveau').parentElement.classList.toggle('cache', choix.mode === 'enligne');
  $('seg-niveau').innerHTML = NIVEAUX.map((n, i) => `<button data-v="${i}" class="${conf.niveau === i ? 'oui' : ''}">${n.nom}</button>`).join('');
  $('seg-duree').innerHTML = [2, 3, 5].map((d) => `<button data-v="${d}" class="${conf.minutes === d ? 'oui' : ''}">${d} min</button>`).join('');
  const stades = choix.mode !== 'enligne';
  $('grille-stades').classList.toggle('cache', !stades);
  $('grille-stades').previousElementSibling.classList.toggle('cache', !stades);
  $('grille-stades').innerHTML = STADES.map((s) => `<button class="stade${conf.stade === s.id ? ' oui' : ''}" data-id="${s.id}" style="--ciel:${COULEURS_STADE[s.id][0]};--sol:${COULEURS_STADE[s.id][1]}"><div class="vignette"></div><b>${s.nom}</b><small>${s.desc}</small></button>`).join('');
  $('b-jouer').querySelector('b').textContent = { solo: 'Coup d’envoi', coupe: 'Commencer la Coupe', enligne: 'C’est mon équipe' }[choix.mode];
}

function brancherEquipes() {
  $('grille-equipes').addEventListener('click', (e) => {
    const b = e.target.closest('.equipe');
    if (!b) return;
    son.bip();
    const id = b.dataset.id;
    if (choix.pour === 'moi') {
      if (id === conf.lui) conf.lui = conf.moi;
      conf.moi = id;
      if (choix.mode === 'solo') choix.pour = 'lui';
    } else {
      if (id === conf.moi) conf.moi = conf.lui;
      conf.lui = id;
    }
    garder();
    rendreEquipes();
  });
  $('duel-moi').addEventListener('click', () => { choix.pour = 'moi'; rendreEquipes(); });
  $('duel-lui').addEventListener('click', () => { choix.pour = 'lui'; rendreEquipes(); });
  $('seg-niveau').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { conf.niveau = +b.dataset.v; garder(); rendreEquipes(); } });
  $('seg-duree').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { conf.minutes = +b.dataset.v; garder(); rendreEquipes(); } });
  $('grille-stades').addEventListener('click', (e) => { const b = e.target.closest('.stade'); if (b) { conf.stade = b.dataset.id; garder(); rendreEquipes(); } });
  $('equipes-retour').addEventListener('click', () => aller(choix.mode === 'enligne' ? 'enligne' : 'menu'));
  $('coupe-retour').addEventListener('click', () => { infoCoupe(); aller('menu'); });
  $('b-jouer').addEventListener('click', () => {
    son.reveiller();
    if (choix.suite) { choix.suite(); return; }
    lancerMatch({ equipes: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], minutes: conf.minutes, stade: conf.stade, mode: 'solo' });
  });
}

function ouvrirEquipes(mode, suite = null) {
  choix = { pour: 'moi', mode, suite };
  rendreEquipes();
  aller('equipes');
}

/* ------------------------------------------------------------------ */
/* Le match                                                            */
/* ------------------------------------------------------------------ */

/** Le match en cours : le moteur, la 3D, ce qui est enregistré pour les ralentis. */
let partie = null;
let enPause = false;
let raf = 0;

/** La roulette tourne lentement au début (la semelle freine), vite au milieu, et finit face au jeu. */
const tourRoulette = (u) => { const t = Math.min(1, Math.max(0, (u - 0.15) / 0.65)); return t * t * (3 - 2 * t); };

/** Ce que la 3D a besoin de savoir d'une image du match. */
function instantane(m) {
  const b = m.ballon;
  return {
    f: m.f,
    phase: m.phase,
    joueurs: m.joueurs.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, dx: p.dx, dy: p.dy, etat: p.etat, frappe: p.frappe, charge: p.charge > 0 ? Math.min(1, p.charge / 48) : 0, volee: p.volee, geste: p.geste, gesteType: p.gesteType, spin: p.gesteType === 1 && p.geste > 0 ? (p.dx * p.gly - p.dy * p.glx >= 0 ? 1 : -1) * tourRoulette(1 - p.geste / DUREE_ROULETTE) : 0, roul: p.gesteType === 1 && p.geste > 0 ? 1 - p.geste / DUREE_ROULETTE : 0, haut: p.haut, vyPlonge: p.etat === 'plonge' ? p.vy : 0 })),
    ballon: { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, porteur: b.porteur },
  };
}
/** Entre deux images du moteur (pour les écrans à plus de 60 Hz). */
function melanger(a, b, t) {
  if (!a || t >= 1) return b;
  const l = (u, v) => u + (v - u) * t;
  return {
    phase: b.phase,
    joueurs: b.joueurs.map((p, i) => { const q = a.joueurs[i]; return { ...p, x: l(q.x, p.x), y: l(q.y, p.y) }; }),
    ballon: { ...b.ballon, x: l(a.ballon.x, b.ballon.x), y: l(a.ballon.y, b.ballon.y), z: l(a.ballon.z, b.ballon.z) },
  };
}

/** Les humeurs des joueurs (célébrations) et le héros du moment. */
function humeurs(m) {
  const h = new Array(10).fill(null);
  let heros = -1;
  if (m.phase === 'but' && m.buts.length) {
    const but = m.buts[m.buts.length - 1];
    heros = but.csc ? but.e * 5 + 4 : but.j;
    for (const p of m.joueurs) h[p.id] = p.e === but.e ? (p.id === heros ? 'heros' : 'joie') : 'decu';
  } else if (m.phase === 'fin' && m.vainqueur >= 0) {
    for (const p of m.joueurs) h[p.id] = p.e === m.vainqueur ? 'joie' : 'decu';
  } else if (m.phase === 'tab' && m.tab.etape === 'resultat') {
    const { tireur } = acteursTab(m);
    const marque = m.tab.issue === 'but';
    for (const p of m.joueurs) if (p.i > 0 || p === tireur) h[p.id] = (p.e === tireur.e) === marque ? 'joie' : 'decu';
  }
  return { h, heros };
}

/**
 * Lance un match.
 * o : { equipes: [id, id], controles, niveaux, minutes, stade, mode, tab, graine, local (l'équipe du joueur), fin(partie) }
 */
function lancerMatch(o) {
  arreterMatch();
  const eqs = o.equipes.map((id) => EQUIPE[id]);
  const kits = tenues(eqs[0], eqs[1]);
  const m = creerMatch({ equipes: o.equipes, graine: o.graine ?? Math.floor(Math.random() * 2 ** 31), minutes: o.minutes, controles: o.controles, niveaux: o.niveaux, tab: !!o.tab });
  aller('match');
  const rendu = creerRendu($('scene'), { stade: o.stade, equipes: eqs, kits });
  if (!rendu) { alert('La 3D n’est pas disponible sur cet appareil.'); aller('menu'); return; }
  partie = { o, m, rendu, eqs, kits, lisse: o.mode === 'enligne' ? creerLissage() : null, local: o.local ?? 0, acc: 0, prec: null, cour: instantane(m), film: [], ralenti: null, finVue: 0, dernier: performance.now(), excit: 0, scoreAffiche: '' };
  // Le tableau d'affichage.
  for (let e = 0; e < 2; e++) {
    $(`hud-ec${e}`).innerHTML = ecussonSVG(eqs[e], 26);
    $(`hud-abr${e}`).textContent = eqs[e].abr;
  }
  $('tab-score').classList.add('cache');
  $('replay').classList.add('cache');
  $('aide-tab').classList.add('cache');
  ecranGeant();
  // Le commentateur.
  const LIEUX = { chaudron: 'au Chaudron', toit: 'sur le Toit', halle: 'à la Halle', plage: 'à la Plage' };
  partie.com = creerCommentateur({ nom: (id) => nomDe(id), equipe: (e) => eqs[e], stade: LIEUX[o.stade] || '', el: $('commentaire') });
  partie.com.debut(m);
  enPause = false;
  saisie.siJeuEnCours(() => ecran === 'match' && !enPause);
  son.public_(0.15);
  raf = requestAnimationFrame(boucle);
}

function arreterMatch() {
  cancelAnimationFrame(raf);
  if (partie?.o.mode === 'enligne') net.finirSession();
  if (partie) { partie.com?.arreter(); partie.rendu.detruire(); partie = null; }
  son.couperPublic();
  $('v-pause').classList.add('cache');
  $('attente-net').classList.add('cache');
}

function ecranGeant(texte) {
  if (!partie?.rendu.ecran) return;
  const { m, eqs } = partie;
  partie.rendu.ecran([`${eqs[0].abr}  ${m.score[0]} - ${m.score[1]}  ${eqs[1].abr}`, texte || 'PETIT PONT']);
}

function boucle(t) {
  if (!partie) return;
  raf = requestAnimationFrame(boucle);
  const P = partie;
  const dt = Math.min(0.1, Math.max(0, (t - P.dernier) / 1000));
  P.dernier = t;
  if (!enPause || P.o.mode === 'enligne') {
    P.acc += dt;
    // En ligne, si l'on est en avance sur l'adversaire, l'horloge ralentit à peine (jusqu'à 8 %) :
    // les deux se recalent sans qu'on sente d'à-coup.
    P.periode = P.o.mode === 'enligne' ? PAS * (1 + Math.min(0.08, Math.max(0, (net.ecart() - 1) * 0.03))) : PAS;
    let n = 0;
    while (P.acc >= P.periode && n < 6) { uneImage(); P.acc -= P.periode; n += 1; }
    if (n >= 6) P.acc = 0;
  }
  if (!partie) return;
  afficher(dt);
}

/** Une image du moteur, avec les touches du joueur. */
function uneImage() {
  const P = partie;
  if (P.o.mode === 'enligne') {
    // En ligne : nos touches partent, celles de l'adversaire sont prédites (et corrigées si besoin).
    const r = net.pasEnLigne(toucheForcee ?? saisie.lire());
    if (!r) return;
    P.gel = r.attente && !r.retenue ? (P.gel || 0) + 1 : 0;
    if (r.attente) return;
    P.prec = P.cour;
    P.cour = instantane(P.m);
    // Une correction du rollback a déplacé des joueurs d'un coup : l'affichage, lui, glisse.
    P.lisse.apres(P.prec, P.cour, Math.max(1, P.cour.f - P.prec.f) * PAS);
    P.film.push(P.cour);
    if (P.film.length > 260) P.film.shift();
    reagir(r.evs);
    return;
  }
  const entrees = [0, 0];
  if (P.o.controles[P.local] === 'humain') entrees[P.local] = toucheForcee ?? saisie.lire();
  P.prec = P.cour;
  const evs = pas(P.m, entrees);
  P.cour = instantane(P.m);
  P.film.push(P.cour);
  if (P.film.length > 260) P.film.shift();
  reagir(evs);
}

/* ---------------- Ce qui se passe ---------------- */

function bandeau(txt, sous = '', long = false) {
  const b = $('bandeau');
  b.innerHTML = `${txt}${sous ? `<small>${sous}</small>` : ''}`;
  b.classList.remove('montre', 'long');
  void b.offsetWidth;
  b.classList.add('montre');
  b.classList.toggle('long', long);
}

const nomDe = (id) => { const P = partie; const p = P.m.joueurs[id]; return P.eqs[p.e].joueurs[p.i].nom; };

function reagir(evs) {
  const P = partie, m = P.m;
  if (!evs.length) return;
  P.rendu.evenements(evs, P.cour);
  for (const ev of evs) {
    P.com?.evenement(ev, m);
    switch (ev.type) {
      case 'passe': son.frappe(ev.lob ? 0.45 : 0.28); break;
      case 'tir': son.frappe(0.55 + ev.puissance * 0.45); P.excit = Math.max(P.excit, 0.35); break;
      case 'controle': son.controle(); break;
      case 'bande': son.bande(ev.force); break;
      case 'poteau': son.poteau(); bandeau(ev.barre ? 'La barre !' : 'Poteau !'); son.occasion(); break;
      case 'filet': son.filet(); break;
      case 'glisse': son.tacle(); break;
      case 'arret':
        son.arret();
        if (m.phase === 'tab') bandeau('Arrêté !', nomDe(ev.joueur));
        else if (ev.capte) bandeau('Arrêt !', nomDe(ev.joueur));
        son.occasion();
        break;
      case 'sifflet': son.sifflet(1); break;
      case 'but': {
        son.but();
        son.sifflet(1);
        P.excit = 1.5;
        const qui = ev.csc ? `${nomDe(ev.joueur)} (contre son camp)` : nomDe(ev.joueur);
        const passe = ev.passeur >= 0 ? ` · passe de ${nomDe(ev.passeur).split(' ').slice(-1)[0]}` : '';
        bandeau('But !', qui + passe, true);
        $('hud-score').classList.remove('flash'); void $('hud-score').offsetWidth; $('hud-score').classList.add('flash');
        ecranGeant('BUT !');
        // Le ralenti : après la joie, on revoit les deux dernières secondes, au ralenti.
        P.ralenti = { attente: 1.9, film: P.film.slice(-150), t: 0 };
        break;
      }
      case 'mitemps': son.sifflet(2, true); bandeau('Mi-temps', `${P.eqs[0].court} ${m.score[0]} - ${m.score[1]} ${P.eqs[1].court}`, true); break;
      case 'reprise': ecranGeant('2E MI-TEMPS'); break;
      case 'engagement': ecranGeant(); break;
      case 'tab': son.sifflet(2, true); bandeau('Tirs au but', 'Cinq tirs chacun', true); $('tab-score').classList.remove('cache'); ecranGeant('TIRS AU BUT'); break;
      case 'tab-but': son.but(); bandeau('But !', nomDe(ev.joueur)); break;
      case 'tab-rate': son.occasion(); bandeau('À côté !', nomDe(ev.joueur)); break;
      case 'fin': {
        son.sifflet(3, true);
        const v = ev.vainqueur;
        bandeau('Fin du match', v < 0 ? 'Match nul' : `Victoire de ${P.eqs[v].court}`, true);
        ecranGeant(v < 0 ? 'MATCH NUL' : `VICTOIRE ${P.eqs[v].abr}`);
        P.finVue = 3.2;
        break;
      }
      default:
    }
  }
}

/* ---------------- L'affichage ---------------- */

const libContexte = { att: ['Passe', 'Tir', 'Lob', 'Geste'], def: ['Changer', 'Tacle', 'Pressing', '—'], tab: ['—', 'Tir', '—', '—'], recoit: ['Remise', 'Volée', '—', '—'] };
let contexte = '';

function afficher(dt) {
  const P = partie, m = P.m;
  P.excit *= Math.pow(0.4, dt);
  P.com?.avancer(dt, m);
  // Le ralenti d'un but, ou le direct.
  let vue, vitesse = 1;
  const R = P.ralenti;
  if (R) {
    if (R.attente > 0) R.attente -= dt;
    else {
      R.t += dt * 0.5;
      const k = Math.floor(R.t * FPS);
      if (k >= R.film.length - 1 || m.phase !== 'but') { P.ralenti = null; P.rendu.camera('tele', true); }
      else { vue = melanger(R.film[k], R.film[k + 1], R.t * FPS - k); vitesse = 0.5; }
    }
  }
  $('replay').classList.toggle('cache', !(R && R.attente <= 0 && P.ralenti));
  if (!vue) {
    vue = melanger(P.prec, P.cour, P.acc / (P.periode || PAS));
    if (P.lisse) vue = P.lisse.appliquer(vue, dt);
  }
  const { h, heros } = humeurs(m);
  const enRalenti = !!(P.ralenti && P.ralenti.attente <= 0);
  P.rendu.camera(m.phase === 'tab' ? 'tab' : enRalenti ? 'ralenti' : m.phase === 'but' ? 'but' : 'tele', enRalenti && R.t < 0.02);
  const actifs = [-1, -1];
  m.equipes.forEach((eq, e) => { if (eq.ctrl === 'humain') actifs[e === P.local ? 0 : 1] = eq.actif; });
  P.rendu.afficher({ ...vue, actifs: enRalenti ? [-1, -1] : actifs, humeurs: enRalenti ? null : h, heros, tab: m.phase === 'tab' }, dt, vitesse);

  // Le tableau d'affichage.
  const score = `${m.score[0]} - ${m.score[1]}`;
  if (score !== P.scoreAffiche) { $('hud-score').textContent = score; P.scoreAffiche = score; }
  $('hud-chrono').textContent = m.phase === 'tab' ? '' : chronoTexte(m);
  $('hud-mi').textContent = m.phase === 'tab' ? 'TAB' : m.mi === 1 ? '1re' : '2e';
  if (m.phase === 'tab') rendreTab();
  // Le joueur dirigé : son nom, son souffle, la jauge de sa frappe.
  const eq = m.equipes[P.local];
  let jauge = 0, pj = null;
  if (eq.ctrl === 'humain') {
    const id = m.phase === 'tab' ? acteursTab(m).tireur.id : eq.actif;
    pj = id >= 0 ? m.joueurs[id] : null;
    if (pj) {
      $('dirige-nom').textContent = `${P.eqs[pj.e].joueurs[pj.i].numero} · ${P.eqs[pj.e].joueurs[pj.i].nom}`;
      $('dirige-endu').style.width = `${Math.round(pj.endu * 100)}%`;
      // La jauge : celle de la frappe, ou celle de la passe (en bleu).
      jauge = pj.charge > 0 ? Math.min(1, pj.charge / 48) : pj.chargeP > 0 ? Math.min(1, pj.chargeP / 30) : 0;
      $('jauge').classList.toggle('passe', !(pj.charge > 0) && pj.chargeP > 0);
    }
  }
  $('dirige').classList.toggle('cache', !pj || m.phase === 'but' || m.phase === 'fin');
  const elJ = $('jauge');
  elJ.classList.toggle('cache', !(jauge > 0 && pj));
  if (jauge > 0 && pj) {
    const s = P.rendu.versEcran(pj.x, pj.y, 2.6);
    elJ.style.left = `${s.x}px`; elJ.style.top = `${s.y}px`;
    elJ.firstElementChild.style.width = `${Math.round(jauge * 100)}%`;
  }
  // Les boutons tactiles disent ce qu'ils font maintenant.
  const b = m.ballon;
  const attaque = (b.porteur >= 0 && m.joueurs[b.porteur].e === P.local) || (b.porteur < 0 && b.cible >= 0 && m.joueurs[b.cible].e === P.local);
  // Une passe arrive vers le joueur dirigé : c'est le moment d'une reprise de volée (B) ou d'une remise (A).
  const recoit = m.phase === 'jeu' && b.porteur < 0 && b.cible >= 0 && b.cible === m.equipes[P.local].actif && m.equipes[P.local].ctrl === 'humain';
  const aide = $('aide-volee');
  aide.classList.toggle('cache', !recoit);
  if (recoit) {
    const r = m.joueurs[b.cible];
    const pos = P.rendu.versEcran(r.x, r.y, 2.9);
    aide.style.left = `${pos.x}px`; aide.style.top = `${pos.y}px`;
    aide.classList.toggle('armee', r.reprise > 0);
  }
  const ctx = m.phase === 'tab' ? 'tab' : recoit ? 'recoit' : attaque ? 'att' : 'def';
  if (ctx !== contexte) {
    contexte = ctx;
    const [a, bb, x, g] = libContexte[ctx];
    $('lab-a').textContent = a; $('lab-b').textContent = bb; $('lab-x').textContent = x; $('lab-g').textContent = g;
  }
  // La rumeur du public : elle monte quand le ballon approche d'un but.
  const prox = Math.max(0, 1 - (20 - Math.abs(b.x)) / 12);
  son.public_(Math.min(1, 0.12 + prox * 0.4 + P.excit * 0.5));
  // La fin : on laisse les joueurs se congratuler, puis le résumé.
  if (m.phase === 'fin' && P.finVue > 0) {
    P.finVue -= dt;
    // En ligne, on attend que tout soit confirmé : le résultat ne peut plus changer.
    if (P.finVue <= 0 && (P.o.mode !== 'enligne' || net.toutConfirme())) finDuMatch();
    else if (P.finVue <= 0) P.finVue = 0.05;
  }
  // En ligne : la connexion a lâché, l'adversaire aussi, ou ses touches n'arrivent plus. On le dit (pas d'écran figé muet).
  if (P.o.mode === 'enligne') {
    const nomAdv = P.o.noms?.[1 - P.local] || 'Ton adversaire';
    const raison = P.netPerdu ? ['Connexion perdue', 'Reconnexion en cours… le match reprend tout seul.']
      : P.absent ? [`${nomAdv} a perdu la connexion`, 'On l’attend : sa place est gardée quelques minutes.']
        : (P.gel || 0) > 45 ? ['En attente…', `Les touches de ${nomAdv} n’arrivent plus pour l’instant.`] : null;
    $('attente-net').classList.toggle('cache', !raison);
    if (raison) { $('attente-titre').textContent = raison[0]; $('attente-texte').textContent = raison[1]; }
  }
  if (P.o.mode === 'enligne' && !$('net-diag').classList.contains('cache')) {
    const d = net.diagnostic();
    if (d) $('net-diag').textContent = `ping ${d.ping} ms · délai ${d.delai} · avance ${d.avance} · rejouées ${d.rejouees} · recalages ${d.recalages}`;
  }
}

function rendreTab() {
  const P = partie, m = P.m, tb = m.tab;
  const ligne = (e) => {
    const r = tb.buts[e];
    const n = Math.max(5, r.length);
    let s = `<div class="ligne"><b>${P.eqs[e].abr}</b>`;
    for (let k = 0; k < n; k++) s += `<span class="p ${r[k] === true ? 'oui' : r[k] === false ? 'non' : ''}"></span>`;
    return s + '</div>';
  };
  const html = ligne(0) + ligne(1);
  if ($('tab-score').innerHTML !== html) $('tab-score').innerHTML = html;
  // L'aide : qui tire, qui plonge.
  const { tireur, gardien } = acteursTab(m);
  let aide = '';
  if (tb.etape === 'vise' || tb.etape === 'place') {
    if (tireur.e === P.local && m.equipes[P.local].ctrl === 'humain') aide = '↑ ↓ pour viser un coin · tiens B (Tir) puis lâche';
    else if (gardien.e === P.local && m.equipes[P.local].ctrl === 'humain') aide = 'Tu es dans les cages : tiens ↑ ou ↓ au moment de la frappe pour plonger';
  }
  $('aide-tab').textContent = aide;
  $('aide-tab').classList.toggle('cache', !aide);
}

/* ---------------- La fin ---------------- */

function finDuMatch() {
  const P = partie, m = P.m;
  const res = {
    score: [...m.score], vainqueur: m.vainqueur, tab: m.tab ? m.tab.buts.map((r) => r.filter(Boolean).length) : null,
    buts: m.buts.map((b) => ({ ...b, nom: nomDe(b.j) })), stats: JSON.parse(JSON.stringify(m.stats)), equipes: P.o.equipes,
  };
  verifierSucces(P, res);
  const o = P.o;
  arreterMatch();
  montrerFin(res, o);
}

function montrerFin(res, o) {
  const eqs = res.equipes.map((id) => EQUIPE[id]);
  const local = o.local ?? 0;
  const v = res.vainqueur;
  $('fin-titre').textContent = v < 0 ? 'Match nul' : v === local && o.controles[local] === 'humain' ? 'Victoire !' : o.controles[local] === 'humain' ? 'Défaite' : `Victoire de ${eqs[v].court}`;
  $('fin-score').innerHTML = `<div class="eq">${ecussonSVG(eqs[0], 64)}<span>${eqs[0].nom}</span></div>
    <div class="sc">${res.score[0]} - ${res.score[1]}${res.tab ? `<span class="tab">(${res.tab[0]} - ${res.tab[1]} aux tirs au but)</span>` : ''}</div>
    <div class="eq">${ecussonSVG(eqs[1], 64)}<span>${eqs[1].nom}</span></div>`;
  const minute = (b) => (b.mi - 1) * (o.minutes || 3) + Math.min(o.minutes || 3, Math.floor(b.chrono / FPS / 60) + 1);
  const col = (e) => res.buts.filter((b) => b.e === e).map((b) => `⚽ ${b.nom.split(' ').slice(-1)[0]}${b.csc ? ' (csc)' : ''} <small>${minute(b)}’</small>`);
  const a = col(0), b = col(1);
  let lignes = '';
  for (let k = 0; k < Math.max(a.length, b.length); k++) lignes += `<div>${a[k] || ''}</div><div>${b[k] || ''}</div>`;
  $('fin-buteurs').innerHTML = lignes;
  const st = res.stats;
  const ligne = (lib, x, y, pct = false) => {
    const tot = x + y || 1;
    return `<div class="stat"><span>${pct ? Math.round((x / tot) * 100) + ' %' : x}</span><span class="lib">${lib}</span><span>${pct ? Math.round((y / tot) * 100) + ' %' : y}</span>
      <div class="barre"><i style="width:${(x / tot) * 100}%;background:${eqs[0].maillot.fond}"></i><i style="width:${(y / tot) * 100}%;background:${eqs[1].maillot.fond === eqs[0].maillot.fond ? eqs[1].exterieur.fond : eqs[1].maillot.fond}"></i></div></div>`;
  };
  $('fin-stats').innerHTML = ligne('Possession', st.possession[0], st.possession[1], true) + ligne('Tirs', st.tirs[0], st.tirs[1]) + ligne('Cadrés', st.cadres[0], st.cadres[1]) + ligne('Passes', st.passes[0], st.passes[1]) + ligne('Tacles', st.tacles[0], st.tacles[1]);
  const act = $('fin-actions');
  act.innerHTML = '';
  $('fin-attente').textContent = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = `<b>${txt}</b>`; el.addEventListener('click', f); act.appendChild(el); return el; };
  if (o.apres) o.apres(res, bouton);
  else {
    bouton('Rejouer', 'vert grand', () => lancerMatch({ ...o, graine: undefined }));
    bouton('Changer d’équipes', '', () => ouvrirEquipes('solo'));
    bouton('Menu', '', () => aller('menu'));
  }
  aller('fin');
}

/* ------------------------------------------------------------------ */
/* Les succès                                                          */
/* ------------------------------------------------------------------ */

function verifierSucces(P, res) {
  const o = P.o, local = o.local ?? 0;
  if (o.controles[local] !== 'humain') return;
  const gagne = res.vainqueur === local;
  if (gagne && o.mode === 'solo') succes.debloquer('foot-victoire');
  if (gagne && o.mode === 'enligne') succes.debloquer('foot-enligne');
  if (gagne && o.mode === 'solo' && o.niveaux[1 - local] === 2) succes.debloquer('foot-difficile');
  if (gagne && res.score[1 - local] === 0) succes.debloquer('foot-clean');
  if (gagne && res.tab) succes.debloquer('foot-tab');
  const parJoueur = {};
  for (const b of res.buts) if (b.e === local && !b.csc) parJoueur[b.j] = (parJoueur[b.j] || 0) + 1;
  if (Object.values(parJoueur).some((n) => n >= 3)) succes.debloquer('foot-triple');
}

/* ------------------------------------------------------------------ */
/* La pause, les commandes, le menu                                    */
/* ------------------------------------------------------------------ */

function basculerPause() {
  if (ecran !== 'match' || !partie) return;
  enPause = !enPause;
  $('v-pause').classList.toggle('cache', !enPause);
  if (!enPause) $('v-commandes').classList.add('cache');
}

function brancher() {
  saisie.ecouterClavier(basculerPause);
  saisie.brancherTactile($('zone-joy'), document.querySelectorAll('.bj'));
  const doigt = () => document.body.classList.add('doigt');
  if (saisie.estTactile()) doigt();
  addEventListener('touchstart', doigt, { once: true, passive: true });
  addEventListener('keydown', () => document.body.classList.remove('doigt'));

  $('b-solo').addEventListener('click', () => { son.reveiller(); ouvrirEquipes('solo'); });
  $('b-tournoi').addEventListener('click', () => { son.reveiller(); ouvrirCoupe(); });
  $('b-enligne').addEventListener('click', () => { son.reveiller(); ouvrirEnLigne(); });
  $('b-commandes').addEventListener('click', () => $('v-commandes').classList.remove('cache'));
  $('c-fermer').addEventListener('click', () => $('v-commandes').classList.add('cache'));
  $('p-commandes').addEventListener('click', () => $('v-commandes').classList.remove('cache'));
  $('b-pause').addEventListener('click', basculerPause);
  $('p-reprendre').addEventListener('click', basculerPause);
  $('p-quitter').addEventListener('click', () => {
    const o = partie?.o;
    arreterMatch();
    enPause = false;
    if (o?.abandon) o.abandon(); else aller('menu');
  });
  $('b-passer').addEventListener('click', passerRalenti);
  $('attente-quitter').addEventListener('click', () => { arreterMatch(); net.quitter(); enPause = false; aller('menu'); });
  const majSon = () => { $('b-son').textContent = son.estMuet() ? '🔇 Son' : '🔊 Son'; $('b-son').setAttribute('aria-pressed', String(son.estMuet())); };
  $('b-son').addEventListener('click', () => { son.basculerSon(); majSon(); });
  majSon();
  $('b-commentaires').value = reglageCommentaires;
  $('b-commentaires').addEventListener('change', (e) => reglerCommentaires(e.target.value));
  $('b-qualite').value = qualite();
  $('b-qualite').addEventListener('change', (e) => reglerQualite(e.target.value));
  brancherEquipes();
  brancherEnLigne();
}

function passerRalenti() {
  const P = partie;
  if (!P?.ralenti) return;
  P.ralenti = null;
  P.rendu.camera('tele', true);
  // Hors ligne, on ne fait pas attendre : le coup d'envoi suit tout de suite.
  if (P.o.mode !== 'enligne' && P.m.phase === 'but') P.m.t = Math.min(P.m.t, 20);
}

/* ------------------------------------------------------------------ */
/* La Coupe et le jeu en ligne (plus bas, quand ils seront prêts)      */
/* ------------------------------------------------------------------ */

/* ---------------- La Coupe ---------------- */

const CLE_COUPE = 'petitpont.coupe';
let coupe = null;
try { coupe = JSON.parse(localStorage.getItem(CLE_COUPE) || 'null'); } catch { /* ignore */ }
if (coupe && !coupe.tours) coupe = null;
const garderCoupe = () => { try { if (coupe) localStorage.setItem(CLE_COUPE, JSON.stringify(coupe)); else localStorage.removeItem(CLE_COUPE); } catch { /* ignore */ } };

function infoCoupe() {
  $('tournoi-info').textContent = coupe && !coupe.fini && !coupe.elimine ? `En cours : ${TOURS[coupe.tour].toLowerCase()} avec ${EQUIPE[coupe.moi].court}` : 'Huit équipes, élimination directe';
}

function ouvrirCoupe() {
  if (coupe) { rendreCoupe(); aller('coupe'); return; }
  ouvrirEquipes('coupe', () => {
    coupe = creerCoupe({ moi: conf.moi, graine: Math.floor(Math.random() * 2 ** 31), niveau: conf.niveau, minutes: conf.minutes, stade: conf.stade });
    garderCoupe();
    rendreCoupe();
    aller('coupe');
  });
}

/** Les autres matchs du tour se jouent ; puis on passe au tour suivant. */
function finirTour() {
  for (const i of aJouer(coupe)) jouerSansMoi(coupe, i);
  avancer(coupe);
  if (coupe.fini && coupe.champion === coupe.moi) {
    succes.debloquer('foot-coupe');
    if (coupe.niveau === 2) succes.debloquer('foot-coupe-difficile');
  }
  garderCoupe();
}

function ligneCoupe(r, id, score, perd) {
  if (!id) return '<div class="ligne"><span></span><span>?</span><b></b></div>';
  const eq = EQUIPE[id];
  return `<div class="ligne${perd ? ' perd' : ''}${id === coupe.moi ? ' toi' : ''}">${ecussonSVG(eq, 20)}<span>${eq.court}</span><b>${score ?? ''}</b></div>`;
}

function rendreCoupe() {
  const c = coupe;
  let html = '';
  for (let t = 0; t < 3; t++) {
    const tour = c.tours[t] || new Array(4 >> t).fill(null).map(() => ({}));
    html += `<div class="tour"><h4>${TOURS[t]}</h4>${tour.map((r) => {
      const fini = !!r.v;
      const sa = fini ? `${r.score[0]}${r.tab ? ` (${r.tab[0]})` : ''}` : '', sb = fini ? `${r.score[1]}${r.tab ? ` (${r.tab[1]})` : ''}` : '';
      const joueur = r.a === c.moi || r.b === c.moi;
      return `<div class="rencontre${joueur ? ' joueur' : ''}">${ligneCoupe(r, r.a, sa, fini && r.v !== r.a)}${ligneCoupe(r, r.b, sb, fini && r.v !== r.b)}</div>`;
    }).join('')}</div>`;
  }
  html += `<div class="tour"><h4>Vainqueur</h4><div class="coupe-trophee">🏆</div>${c.champion ? `<div class="rencontre${c.champion === c.moi ? ' joueur' : ''}">${ligneCoupe({}, c.champion, '')}</div>` : ''}</div>`;
  $('tableau').innerHTML = html;
  const m = matchDuJoueur(c);
  const adv = m && (m.a === c.moi ? m.b : m.a);
  $('coupe-info').textContent = c.fini
    ? (c.champion === c.moi ? `${EQUIPE[c.moi].nom} remporte la Coupe !` : `${EQUIPE[c.champion].nom} remporte la Coupe.`)
    : c.elimine ? `${EQUIPE[c.moi].court} est éliminé. La Coupe continue sans toi.`
      : `${TOURS[c.tour]} · ${EQUIPE[c.moi].court} contre ${EQUIPE[adv].court} · ${NIVEAUX[c.niveau].nom}`;
  const act = $('coupe-actions');
  act.innerHTML = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = txt; el.addEventListener('click', f); act.appendChild(el); };
  if (m) bouton(`<b>Jouer ${c.tour === 2 ? 'la finale' : c.tour === 1 ? 'la demie' : 'le quart'}</b><small>contre ${EQUIPE[adv].nom}</small>`, 'vert grand', jouerCoupe);
  if (c.elimine && !c.fini) bouton('<b>Voir la suite</b>', 'bleu', () => { while (!coupe.fini) finirTour(); rendreCoupe(); });
  if (c.fini || c.elimine) bouton('<b>Nouvelle Coupe</b>', c.fini ? 'vert' : '', () => { coupe = null; garderCoupe(); ouvrirCoupe(); });
  else bouton('Abandonner la Coupe', 'fin', () => { if (confirm('Abandonner cette Coupe ?')) { coupe = null; garderCoupe(); infoCoupe(); aller('menu'); } });
  infoCoupe();
}

function jouerCoupe() {
  const c = coupe, r = matchDuJoueur(c);
  if (!r) return;
  const moiA = r.a === c.moi;
  const adv = moiA ? r.b : r.a;
  const noter = (res) => {
    // Le match est joué « moi contre lui » : on le remet dans le sens du tableau.
    const sw = (x) => (x && !moiA ? [x[1], x[0]] : x);
    enregistrer(c, r.i, { score: sw(res.score), tab: sw(res.tab), vainqueur: moiA ? res.vainqueur : 1 - res.vainqueur });
    finirTour();
  };
  lancerMatch({
    equipes: [c.moi, adv], controles: ['humain', 'ia'], niveaux: [1, c.niveau], minutes: c.minutes, stade: stadeDuTour(c), mode: 'coupe', tab: true,
    apres: (res, bouton) => {
      noter(res);
      const gagne = res.vainqueur === 0;
      $('fin-titre').textContent = gagne ? (coupe.fini ? 'Champion !' : 'Qualifié !') : 'Éliminé';
      bouton(coupe.fini && gagne ? 'Soulever la Coupe' : 'Le tableau', 'vert grand', () => { rendreCoupe(); aller('coupe'); });
      bouton('Menu', '', () => { infoCoupe(); aller('menu'); });
    },
    // Abandonner un match de Coupe : défaite par forfait.
    abandon: () => { noter({ score: [0, 3], tab: null, vainqueur: 1 }); rendreCoupe(); aller('coupe'); },
  });
}
/* ---------------- En ligne ---------------- */

const CLE_NOM = 'petitpont.nom';
const STATUTS = { connexion: 'Connexion au serveur…', connecte: 'Connecté ! Crée une salle, ou rejoins celle d’un ami avec son code.', perdu: 'Connexion perdue. Nouvelle tentative…', injoignable: 'Le serveur ne répond pas. On réessaie…' };

function nomEnLigne() {
  const n = $('enligne-nom').value.trim() || succes.pseudo() || 'Joueur';
  try { localStorage.setItem(CLE_NOM, n); } catch { /* ignore */ }
  return n;
}

/**
 * Le salon : les deux joueurs dans la salle, chacun choisit son équipe (l'équipe de
 * l'autre est prise), puis « Prêt ! ». Le match part quand les deux sont prêts.
 */
let autoChoix = false;
function rendreSalon(s) {
  const moi = s.n, lui = 1 - s.n;
  const present = !!s.noms[lui];
  const carte = (n) => {
    const eq = s.equipes[n] && EQUIPE[s.equipes[n]];
    const nom = s.noms[n] || '…';
    return `<div class="salon-joueur${n === moi ? ' moi' : ''}${s.prets[n] ? ' pret' : ''}" style="--c1:${eq ? eq.maillot.fond : '#1c3a58'}">
      ${eq ? ecussonSVG(eq, 40) : '<span class="ec-vide">?</span>'}
      <span><small>${n === moi ? 'Toi' : 'Adversaire'}</small><b>${nom}</b><i>${eq ? eq.court : present || n === moi ? 'choisit son équipe…' : 'pas encore là'}</i></span>
      <em>${s.prets[n] ? '✓ Prêt' : ''}</em></div>`;
  };
  $('salon-joueurs').innerHTML = carte(moi) + carte(lui);
  $('salon-equipes').innerHTML = EQUIPES.map((eq) => {
    const a = s.equipes[moi] === eq.id, b = s.equipes[lui] === eq.id;
    return `<button class="equipe${a ? ' moi' : ''}${b ? ' lui pris' : ''}" data-id="${eq.id}" style="--c1:${eq.maillot.fond}"${b ? ' disabled' : ''}>
      ${a ? '<span class="marque">TOI</span>' : b ? `<span class="marque">${s.noms[lui]}</span>` : ''}<span class="note">${noteGenerale(eq)}</span>
      ${ecussonSVG(eq, 46)}<span class="nom">${eq.nom}</span><span class="style">${STYLES[eq.style].nom}</span></button>`;
  }).join('');
  const pret = s.prets[moi];
  $('salon-pret').innerHTML = pret ? '<b>Pas encore prêt</b><small>Changer d’avis</small>' : '<b>Prêt !</b><small>Le match part quand vous l’êtes tous les deux</small>';
  $('salon-pret').className = `btn grand ${pret ? '' : 'vert'}`;
  $('salon-pret').disabled = !s.equipes[moi] || !present;
  $('salle-attente').textContent = !present ? 'En attente d’un adversaire… Donne-lui ce code.'
    : s.prets[lui] && !pret ? `${s.noms[lui]} est prêt : à toi !`
      : pret && !s.prets[lui] ? `En attente de ${s.noms[lui]}…` : 'Choisissez vos équipes (pas la même), puis « Prêt ! ».';
  // La première fois, on propose l'équipe de d'habitude (si l'autre ne l'a pas prise).
  if (!autoChoix && !s.equipes[moi] && s.equipes[lui] !== conf.moi) { autoChoix = true; net.choisirEquipe(conf.moi); }
}

function rendreStadesSalle() {
  const hote = net.salle.n === 0;
  const hote2 = net.salle.salon?.noms?.[0];
  $('salle-stade-bloc').firstElementChild.textContent = hote ? 'Le stade (c’est toi qui choisis)' : `Le stade (choisi par ${hote2 || 'l’hôte'})`;
  $('salle-stades').innerHTML = STADES.map((s) => `<button data-id="${s.id}" class="${net.salle.stade === s.id ? 'oui' : ''}"${hote ? '' : ' disabled'}>${s.nom}</button>`).join('');
}

function ouvrirEnLigne() {
  let nom = '';
  try { nom = localStorage.getItem(CLE_NOM) || ''; } catch { /* ignore */ }
  $('enligne-nom').value = nom || succes.pseudo() || '';
  $('enligne-accueil').classList.toggle('cache', !!net.salle.code);
  $('enligne-salle').classList.toggle('cache', !net.salle.code);
  aller('enligne');
  net.connecter({
    statut: (st) => {
      if (!net.salle.code) $('enligne-statut').textContent = STATUTS[st] || '';
      if (partie?.o.mode === 'enligne' && (st === 'perdu' || st === 'injoignable' || st === 'connexion')) partie.netPerdu = true;
    },
    // Après une reconnexion : le serveur nous a-t-il gardé notre place ?
    session: (m) => {
      if (m.repris) { if (partie) partie.netPerdu = false; return; }
      if (partie?.o.mode === 'enligne') {
        arreterMatch();
        net.quitter();
        $('enligne-accueil').classList.remove('cache');
        $('enligne-salle').classList.add('cache');
        $('enligne-statut').textContent = 'La connexion a été coupée trop longtemps (ou le serveur a redémarré) : le match est interrompu.';
        aller('enligne');
      } else if (net.salle.code) {
        net.quitter();
        $('enligne-accueil').classList.remove('cache');
        $('enligne-salle').classList.add('cache');
        $('enligne-statut').textContent = 'La connexion a été coupée : la salle est fermée. Crées-en une autre.';
      }
    },
    absent: (m) => {
      if (partie?.o.mode === 'enligne') partie.absent = true;
      else $('salle-attente').textContent = `${m.nom} a perdu la connexion… on l’attend.`;
    },
    revenu: (m) => {
      if (partie) partie.absent = false;
      if (!partie) $('salle-attente').textContent = `${m.nom} est de retour.`;
    },
    salle: (m) => {
      $('enligne-accueil').classList.add('cache');
      $('enligne-salle').classList.remove('cache');
      $('salle-code').textContent = m.code;
      $('salle-attente').textContent = 'En attente d’un adversaire… Donne-lui ce code.';
      $('enligne-statut').textContent = '';
      autoChoix = false;
      rendreSalon({ n: 0, noms: [nomEnLigne(), null], equipes: [null, null], prets: [false, false] });
      rendreStadesSalle();
    },
    salon: (m) => {
      $('enligne-accueil').classList.add('cache');
      $('enligne-salle').classList.remove('cache');
      if (net.salle.code) $('salle-code').textContent = net.salle.code;
      if (ecran !== 'enligne' && ecran !== 'match') aller('enligne');
      $('enligne-statut').textContent = '';
      rendreSalon(m);
      rendreStadesSalle();
    },
    stade: () => rendreStadesSalle(),
    debut: (m) => lancerEnLigne(m),
    revanche: (m) => { if (ecran === 'fin' && m.n !== net.salle.n) $('fin-attente').textContent = 'Ton adversaire veut sa revanche !'; },
    parti: () => {
      const enMatch = partie?.o.mode === 'enligne';
      if (enMatch) arreterMatch();
      if (enMatch || ecran === 'fin' || ecran === 'enligne') {
        $('enligne-accueil').classList.remove('cache');
        $('enligne-salle').classList.add('cache');
        $('enligne-statut').textContent = 'Ton adversaire a quitté le match.';
        aller('enligne');
      }
    },
    erreur: (msg) => { $('enligne-statut').textContent = msg; },
  });
}

function lancerEnLigne(d) {
  son.reveiller();
  lancerMatch({
    equipes: d.equipes, controles: ['humain', 'humain'], niveaux: [1, 1], minutes: 3, stade: d.stade, mode: 'enligne', tab: true,
    graine: d.graine, local: d.n, noms: d.noms,
    apres: (res, bouton) => {
      const moi = d.n;
      $('fin-titre').textContent = res.vainqueur === moi ? `Victoire contre ${d.noms[1 - moi]} !` : `Défaite contre ${d.noms[1 - moi]}`;
      const b = bouton('Revanche', 'vert grand', () => { net.revanche(); b.disabled = true; $('fin-attente').textContent = 'En attente de ton adversaire…'; });
      bouton('Quitter', '', () => { net.quitter(); aller('menu'); });
    },
    abandon: () => { net.quitter(); aller('menu'); },
  });
  if (partie) net.demarrerSession({ m: partie.m, n: d.n });
}

function brancherEnLigne() {
  $('enligne-retour').addEventListener('click', () => { if (net.salle.code) net.quitter(); aller('menu'); });
  $('enligne-creer').addEventListener('click', () => { net.creer(nomEnLigne(), conf.stade); $('enligne-statut').textContent = 'Création de la salle…'; });
  $('salon-equipes').addEventListener('click', (e) => {
    const b = e.target.closest('.equipe');
    if (!b || b.disabled) return;
    son.bip();
    conf.moi = b.dataset.id;
    garder();
    net.choisirEquipe(b.dataset.id);
  });
  $('salon-pret').addEventListener('click', () => {
    const s = net.salle.salon;
    if (!s) return;
    son.reveiller();
    net.pret(!s.prets[s.n]);
  });
  const rejoindre = () => {
    const code = $('enligne-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { $('enligne-statut').textContent = 'Le code de la salle fait 4 caractères.'; return; }
    autoChoix = false;
    net.rejoindre(code, nomEnLigne());
    $('enligne-statut').textContent = 'On rejoint la salle…';
  };
  $('enligne-rejoindre').addEventListener('click', rejoindre);
  $('enligne-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') rejoindre(); });
  $('salle-quitter').addEventListener('click', () => { net.quitter(); $('enligne-salle').classList.add('cache'); $('enligne-accueil').classList.remove('cache'); $('enligne-statut').textContent = STATUTS.connecte; });
  $('salle-stades').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && net.salle.n === 0) { conf.stade = b.dataset.id; garder(); net.choisirStade(b.dataset.id); } });
  // Le diagnostic du réseau (F3).
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); $('net-diag').classList.toggle('cache'); } });
}

/** Pour les essais, depuis la console : faire avancer le match sans attendre l'écran. */
let toucheForcee = null;
window.petitPont = {
  partie: () => partie,
  avancer(n = 60, touches = null) {
    toucheForcee = touches;
    for (let k = 0; k < n && partie; k++) { uneImage(); if (k % 4 === 0 || k === n - 1) afficher(PAS * 4); }
    toucheForcee = null;
    return partie && { f: partie.m.f, phase: partie.m.phase, score: partie.m.score };
  },
};

brancher();
infoCoupe();
succes.visiter('petitpont');
export { lancerMatch, aller, ouvrirEquipes, montrerFin, conf, garder };
