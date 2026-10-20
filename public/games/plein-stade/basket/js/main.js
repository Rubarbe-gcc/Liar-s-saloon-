/**
 * DOUBLE PAS — le jeu : le menu, le choix des équipes, le match (la boucle à
 * 60 images par seconde, l'interface par-dessus la 3D), la fin du match.
 *
 * Le match est joué par le moteur partagé (shared/basket/match.js) ; la 3D
 * (trois/rendu3d.js) ne fait que le montrer. Pour l'instant : le match amical
 * contre l'ordinateur (le tournoi et le jeu en ligne viendront ensuite).
 */

import { EQUIPES, EQUIPE, STYLES, POSTES, NOM_POSTE, notesEquipe, noteGenerale, noteJoueur } from '../../../../shared/basket/equipes.js';
import { creerMatch, pas, chronoTexte, FPS, T, CHARGE_IDEALE, CHARGE_MAX } from '../../../../shared/basket/match.js';
import { NIVEAUX } from '../../../../shared/basket/ia.js';
import { creerRendu, qualite, reglerQualite } from './trois/rendu3d.js';
import { SALLES, SALLE } from './trois/salle3d.js';
import { ecussonSVG, tenues } from '../../commun/ecusson.js';
import { creerCinematique } from '../../commun/cinematique.js';
import { intro, miTemps, hommeDuMatch, meilleurJoueur, detailJoueur } from './cinematiques.js';
import * as saisie from '../../commun/saisie.js';
import * as touches from './touches.js';
import * as son from '../../commun/son.js';
import * as succes from '../../../../shared/succes.js';
import { creerCommentateur, reglage as reglageCommentaires, regler as reglerCommentaires, REGLAGES as REGLAGES_COMM } from './commentaires.js';

succes.visiter('petitpont');

const $ = (id) => document.getElementById(id);
const PAS = 1 / FPS;
let ecran = 'menu';
function aller(nom) {
  for (const s of document.querySelectorAll('.ecran')) s.classList.toggle('is-active', s.id === `s-${nom}`);
  ecran = nom;
  document.querySelector('.fond').classList.toggle('cache', nom === 'match');
}

/** Les touches du clavier : au choix du joueur (touches.js). */

/* ------------------------------------------------------------------ */
/* Les réglages gardés d'une fois sur l'autre                          */
/* ------------------------------------------------------------------ */

const CLE = 'doublepas.config';
const conf = { moi: 'valrose', lui: 'fort-granit', niveau: 1, minutes: 3, salle: 'palais' };
try { Object.assign(conf, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch { /* ignore */ }
if (!EQUIPE[conf.moi]) conf.moi = 'valrose';
if (!EQUIPE[conf.lui] || conf.lui === conf.moi) conf.lui = EQUIPES.find((e) => e.id !== conf.moi).id;
if (!SALLE[conf.salle]) conf.salle = 'palais';
if (![2, 3, 4, 5].includes(conf.minutes)) conf.minutes = 3;
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(conf)); } catch { /* ignore */ } };

const COULEURS_SALLE = {
  palais: ['linear-gradient(180deg,#07080d,#2a1e14)', '#c98f52'],
  gymnase: ['linear-gradient(180deg,#d9d2c4,#e9e2d2)', '#e2b57c'],
  port: ['linear-gradient(180deg,#2a2a6a,#ff8a5a)', '#2f6aa0'],
};
const LIEUX = { palais: 'au Palais', gymnase: 'au Gymnase', port: 'au Terrain du Port' };

/* ------------------------------------------------------------------ */
/* Le choix des équipes                                                */
/* ------------------------------------------------------------------ */

let choix = { pour: 'moi', survol: null };

function carteDuel(el, id, role) {
  const eq = EQUIPE[id];
  el.style.setProperty('--c1', eq.maillot.fond);
  el.innerHTML = `${ecussonSVG(eq, 56)}<span><span class="role">${role}</span><span class="nom">${eq.nom}</span><small>${eq.ville} · ${STYLES[eq.style].nom}</small></span>`;
}

const barres = (n, chiffres = false) => `<div class="barres">${[['VIT', n.vitesse], ['TIR', n.tir], ['PAS', n.passe], ['DÉF', n.defense], ['SAUT', n.saut]]
  .map(([k, v]) => `<span>${k}${chiffres ? ` ${v}` : ''}</span><i style="--v:${Math.round(((v - 50) / 50) * 100)}%"></i>`).join('')}</div>`;

/** La fiche d'un club : sa devise, son style, ses trois joueurs et leurs notes. */
function fiche(id) {
  const eq = EQUIPE[id];
  $('fiche-club').style.setProperty('--c1', eq.maillot.fond);
  $('fiche-club').innerHTML = `<div class="tete">${ecussonSVG(eq, 40)}<span><b>${eq.nom}</b><small>${eq.ville} · ${STYLES[eq.style].nom} · note ${noteGenerale(eq)}</small></span></div>
    <p class="devise">« ${eq.devise} »</p>
    <div class="joueurs">${eq.joueurs.map((j, i) => `<div class="joueur"><b>${j.numero} · ${j.nom}${j.vedette ? ' <span class="vedette">★</span>' : ''}</b><small>${NOM_POSTE[POSTES[i]]} · ${noteJoueur(eq, i)}</small>${barres(j.notes, true)}</div>`).join('')}</div>`;
}

function rendreEquipes() {
  carteDuel($('duel-moi'), conf.moi, 'Toi');
  carteDuel($('duel-lui'), conf.lui, 'Adversaire');
  $('duel-moi').classList.toggle('choisit', choix.pour === 'moi');
  $('duel-lui').classList.toggle('choisit', choix.pour === 'lui');
  $('consigne-equipes').textContent = choix.pour === 'moi' ? 'Choisis ton équipe.' : 'Choisis l’adversaire.';
  $('grille-equipes').innerHTML = EQUIPES.map((eq) => {
    const moi = eq.id === conf.moi, lui = eq.id === conf.lui;
    return `<button class="equipe${moi ? ' moi' : ''}${lui ? ' lui' : ''}" data-id="${eq.id}" style="--c1:${eq.maillot.fond}">
      ${moi ? '<span class="marque">TOI</span>' : lui ? '<span class="marque">ADV</span>' : ''}<span class="note">${noteGenerale(eq)}</span>
      ${ecussonSVG(eq, 60)}<span class="nom">${eq.nom}</span><span class="style">${STYLES[eq.style].nom}</span>${barres(notesEquipe(eq))}</button>`;
  }).join('');
  fiche(choix.survol || (choix.pour === 'moi' ? conf.moi : conf.lui));
  $('seg-niveau').innerHTML = NIVEAUX.map((n, i) => `<button data-v="${i}" class="${conf.niveau === i ? 'oui' : ''}">${n.nom}</button>`).join('');
  $('seg-duree').innerHTML = [2, 3, 4, 5].map((d) => `<button data-v="${d}" class="${conf.minutes === d ? 'oui' : ''}">2 × ${d} min</button>`).join('');
  $('grille-stades').innerHTML = SALLES.map((s) => `<button class="stade${conf.salle === s.id ? ' oui' : ''}" data-id="${s.id}" style="--ciel:${COULEURS_SALLE[s.id][0]};--sol:${COULEURS_SALLE[s.id][1]}"><div class="vignette"></div><b>${s.nom}</b><small>${s.desc}</small></button>`).join('');
}

function brancherEquipes() {
  const grille = $('grille-equipes');
  grille.addEventListener('click', (e) => {
    const b = e.target.closest('.equipe');
    if (!b) return;
    son.bip();
    const id = b.dataset.id;
    if (choix.pour === 'moi') {
      if (id === conf.lui) conf.lui = conf.moi;
      conf.moi = id;
      choix.pour = 'lui';
    } else {
      if (id === conf.moi) conf.moi = conf.lui;
      conf.lui = id;
    }
    choix.survol = id;
    garder();
    rendreEquipes();
  });
  grille.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.equipe');
    if (b && b.dataset.id !== choix.survol) { choix.survol = b.dataset.id; fiche(choix.survol); }
  });
  $('duel-moi').addEventListener('click', () => { choix.pour = 'moi'; choix.survol = conf.moi; rendreEquipes(); });
  $('duel-lui').addEventListener('click', () => { choix.pour = 'lui'; choix.survol = conf.lui; rendreEquipes(); });
  $('seg-niveau').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { conf.niveau = +b.dataset.v; garder(); rendreEquipes(); } });
  $('seg-duree').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { conf.minutes = +b.dataset.v; garder(); rendreEquipes(); } });
  $('grille-stades').addEventListener('click', (e) => { const b = e.target.closest('.stade'); if (b) { conf.salle = b.dataset.id; garder(); rendreEquipes(); } });
  $('equipes-retour').addEventListener('click', () => aller('menu'));
  $('b-jouer').addEventListener('click', () => {
    son.reveiller();
    lancerMatch({ equipes: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], minutes: conf.minutes, salle: conf.salle });
  });
}

function ouvrirEquipes() {
  choix = { pour: 'moi', survol: null };
  rendreEquipes();
  aller('equipes');
}

/* ------------------------------------------------------------------ */
/* Le match                                                            */
/* ------------------------------------------------------------------ */

const cine = creerCinematique(document.getElementById('s-match'));
let partie = null;
let enPause = false;
let raf = 0;

/** Ce que la 3D a besoin de savoir d'une image du match. */
function instantane(m) {
  const b = m.ballon;
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const att = porteur ? porteur.e : -1;
  return {
    f: m.f,
    phase: m.phase,
    joueurs: m.joueurs.map((p) => ({
      x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, dx: p.dx, dy: p.dy, etat: p.etat,
      porte: b.porteur === p.id, remise: b.remise === p.id, balleZ: b.z, main: p.i === 2 ? -1 : 1,
      defend: att >= 0 && p.e !== att && Math.hypot(p.x - porteur.x, p.y - porteur.y) < 4, surpris: p.surpris > 0, crochet: p.crochet > 0,
    })),
    ballon: { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, porteur: b.porteur },
    tirEnVol: !!b.tir && b.porteur < 0,
  };
}
function melanger(a, b, t) {
  if (!a || t >= 1) return b;
  const l = (u, v) => u + (v - u) * t;
  return {
    ...b,
    joueurs: b.joueurs.map((p, i) => { const q = a.joueurs[i]; return { ...p, x: l(q.x, p.x), y: l(q.y, p.y), z: l(q.z, p.z) }; }),
    ballon: { ...b.ballon, x: l(a.ballon.x, b.ballon.x), y: l(a.ballon.y, b.ballon.y), z: l(a.ballon.z, b.ballon.z) },
  };
}

/** Les humeurs des joueurs (célébrations) et le héros du moment. */
function humeurs(m) {
  const h = new Array(6).fill(null);
  let heros = -1;
  if (m.phase === 'panier' && m.paniers.length && m.t < 80) {
    const pn = m.paniers[m.paniers.length - 1];
    heros = pn.j;
    for (const p of m.joueurs) if (p.z === 0) h[p.id] = p.e === pn.e ? (p.id === heros ? 'heros' : 'joie') : null;
  } else if (m.phase === 'fin' && m.vainqueur >= 0) {
    for (const p of m.joueurs) h[p.id] = p.e === m.vainqueur ? 'joie' : 'decu';
  }
  return { h, heros };
}

/**
 * Lance un match.
 * o : { equipes: [id, id], controles, niveaux, minutes, salle, graine }
 */
function lancerMatch(o) {
  arreterMatch();
  const eqs = o.equipes.map((id) => EQUIPE[id]);
  const kits = tenues(eqs[0], eqs[1]);
  const m = creerMatch({ equipes: o.equipes, graine: o.graine ?? Math.floor(Math.random() * 2 ** 31), minutes: o.minutes, controles: o.controles, niveaux: o.niveaux });
  aller('match');
  const rendu = creerRendu($('scene'), { salle: o.salle, equipes: eqs, kits });
  if (!rendu) { alert('La 3D n’est pas disponible sur cet appareil.'); aller('menu'); return; }
  partie = { o, m, rendu, eqs, kits, local: 0, acc: 0, prec: null, cour: instantane(m), finVue: 0, dernier: performance.now(), excit: 0, scoreAffiche: '' };
  for (let e = 0; e < 2; e++) {
    $(`hud-ec${e}`).innerHTML = ecussonSVG(eqs[e], 26);
    $(`hud-abr${e}`).textContent = eqs[e].abr;
  }
  ecranGeant();
  partie.lieu = LIEUX[o.salle] || '';
  partie.com = creerCommentateur({ nom: (id) => nomDe(id), equipe: (e) => eqs[e], salle: partie.lieu, el: $('commentaire') });
  partie.com.debut(m);
  cine.lancer(intro(partie), { passable: true, fin: () => partie?.rendu.camera('tele', true) });
  enPause = false;
  saisie.siJeuEnCours(() => ecran === 'match' && !enPause);
  son.public_(0.15);
  raf = requestAnimationFrame(boucle);
}

function arreterMatch() {
  cancelAnimationFrame(raf);
  cine.arreter(false);
  if (partie) { partie.com?.arreter(); partie.rendu.detruire(); partie = null; }
  son.couperPublic();
  $('v-pause').classList.add('cache');
}

function ecranGeant(texte) {
  if (!partie?.rendu.ecran) return;
  const { m, eqs } = partie;
  partie.rendu.ecran([`${eqs[0].abr}  ${m.score[0]} - ${m.score[1]}  ${eqs[1].abr}`, texte || 'DOUBLE PAS']);
}

function boucle(t) {
  if (!partie) return;
  raf = requestAnimationFrame(boucle);
  const P = partie;
  const dt = Math.min(0.1, Math.max(0, (t - P.dernier) / 1000));
  P.dernier = t;
  if (cine.actif) { cine.maj(dt); P.acc = 0; }
  else if (!enPause) {
    P.acc += dt;
    let n = 0;
    while (P.acc >= PAS && n < 6) { uneImage(); P.acc -= PAS; n += 1; }
    if (n >= 6) P.acc = 0;
  }
  if (!partie) return;
  afficher(dt);
}

/** Une image du moteur, avec les touches du joueur. */
function uneImage() {
  const P = partie;
  const entrees = [0, 0];
  if (P.o.controles[P.local] === 'humain') entrees[P.local] = saisie.lire();
  P.prec = P.cour;
  const evs = pas(P.m, entrees);
  P.cour = instantane(P.m);
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
const nomCourt = (id) => nomDe(id).split(' ').slice(-1)[0];

function reagir(evs) {
  const P = partie, m = P.m;
  if (!evs.length) return;
  P.rendu.evenements(evs, P.cour);
  for (const ev of evs) {
    P.com?.evenement(ev, m);
    switch (ev.type) {
      case 'dribble': son.bande(1.6); break;
      case 'sol': son.bande(Math.min(5, ev.force * 1.5)); break;
      case 'passe': son.controle(); break;
      case 'reception': case 'rebond': son.controle(); break;
      case 'tir': son.frappe(0.25); P.excit = Math.max(P.excit, 0.3); break;
      case 'arceau': son.poteau(); break;
      case 'planche': son.bande(4); break;
      case 'contre': son.arret(); son.occasion(); bandeau('Contré !', nomDe(ev.joueur)); break;
      case 'vol': case 'interception': son.tacle(); if (m.joueurs[ev.joueur].e === P.local || Math.random() < 0.5) bandeau(ev.type === 'vol' ? 'Volé !' : 'Intercepté !', nomDe(ev.joueur)); break;
      case 'sifflet': son.sifflet(1); break;
      case 'sirene': son.sifflet(2, true); break;
      case 'panier': {
        son.filet();
        son.but();
        P.excit = ev.pts === 3 || ev.dunk ? 1.5 : 1;
        const titre = ev.enOr ? 'Panier en or !' : ev.dunk ? 'Dunk !' : ev.pts === 3 ? '3 points !' : 'Panier !';
        const passe = ev.passeur >= 0 ? ` · passe de ${nomCourt(ev.passeur)}` : '';
        bandeau(titre, `${ev.joueur >= 0 ? nomDe(ev.joueur) : ''}${passe}`, ev.pts === 3 || ev.dunk || ev.enOr);
        $('hud-score').classList.remove('flash'); void $('hud-score').offsetWidth; $('hud-score').classList.add('flash');
        ecranGeant(ev.dunk ? 'DUNK !' : ev.pts === 3 ? '3 POINTS !' : 'PANIER !');
        break;
      }
      case 'mitemps':
        cine.lancer(miTemps(P), { passable: true, fin: () => { if (partie?.m.phase === 'pause') partie.m.t = Math.min(partie.m.t, 30); partie?.rendu.camera('tele', true); } });
        son.acclamation(1); bandeau('Fin de la 1re période', `${P.eqs[0].court} ${m.score[0]} - ${m.score[1]} ${P.eqs[1].court}`, true); break;
      case 'reprise': ecranGeant('2E PÉRIODE'); break;
      case 'remise': ecranGeant(); break;
      case 'egalite': son.acclamation(1); bandeau('Égalité !', 'Panier en or : le premier qui marque gagne', true); ecranGeant('PANIER EN OR'); break;
      case 'enor': son.sifflet(1); break;
      case 'fin': {
        son.sifflet(3, true);
        son.acclamation(1);
        const v = ev.vainqueur;
        bandeau('Fin du match', `Victoire de ${P.eqs[v].court}`, true);
        ecranGeant(`VICTOIRE ${P.eqs[v].abr}`);
        P.finVue = 3;
        break;
      }
      default:
    }
  }
}

/* ---------------- L'affichage ---------------- */

const LIB = { att: ['Passe', 'Tir', 'Crochet', '—', 'Rebond'], pres: ['Passe', 'Dunk', 'Crochet', '—', 'Rebond'], def: ['Vol', 'Contre', '—', 'Changer', '—'], libre: ['—', 'Sauter', '—', 'Changer', '—'], remise: ['Remise', '—', '—', '—', 'Rebond'] };
let contexte = '';

function afficher(dt) {
  const P = partie, m = P.m;
  P.excit *= Math.pow(0.4, dt);
  P.com?.avancer(dt, m);
  const vueCine = cine.actif ? cine.vue() : null;
  if (vueCine) { P.rendu.afficher(vueCine, dt); return; }
  const vue = melanger(P.prec, P.cour, P.acc / PAS);
  const { h, heros } = humeurs(m);
  if (!cine.actif) P.rendu.camera(m.phase === 'panier' && heros >= 0 && m.t < 80 ? 'panier' : 'tele');
  const eq = m.equipes[P.local];
  const actifs = [eq.ctrl === 'humain' ? eq.actif : -1, -1];
  P.rendu.afficher({ ...vue, actifs, humeurs: h, heros }, dt);

  // Le tableau d'affichage.
  const score = `${m.score[0]} - ${m.score[1]}`;
  if (score !== P.scoreAffiche) { $('hud-score').textContent = score; P.scoreAffiche = score; }
  $('hud-chrono').textContent = chronoTexte(m);
  $('hud-mi').textContent = m.enOr ? 'PANIER' : m.periode === 1 ? '1re' : '2e';
  // Le joueur dirigé : son nom, son souffle, la jauge de son tir.
  const pj = eq.ctrl === 'humain' && eq.actif >= 0 ? m.joueurs[eq.actif] : null;
  if (pj) {
    $('dirige-nom').textContent = `${P.eqs[pj.e].joueurs[pj.i].numero} · ${P.eqs[pj.e].joueurs[pj.i].nom}`;
    $('dirige-endu').style.width = `${Math.round(pj.endu * 100)}%`;
  }
  $('dirige').classList.toggle('cache', !pj || m.phase !== 'jeu');
  const elJ = $('jauge');
  const charge = pj && pj.etat === 'tir' && m.ballon.porteur === pj.id ? pj.charge : 0;
  elJ.classList.toggle('cache', !charge);
  if (charge) {
    const s = P.rendu.versEcran(pj.x, pj.y, 2.9 + pj.z);
    elJ.style.left = `${s.x}px`; elJ.style.top = `${s.y}px`;
    elJ.firstElementChild.style.width = `${Math.round(Math.min(1, charge / CHARGE_MAX) * 100)}%`;
    elJ.classList.toggle('parfait', Math.abs(charge - CHARGE_IDEALE) <= 2);
  }
  // Les boutons tactiles disent ce qu'ils font maintenant.
  const b = m.ballon;
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const ctx = porteur && porteur.e === P.local ? (b.remise >= 0 ? 'remise' : Math.hypot(porteur.x - m.equipes[P.local].sens * 12.425, porteur.y) < 2.5 ? 'pres' : 'att') : porteur ? 'def' : 'libre';
  if (ctx !== contexte) {
    contexte = ctx;
    const [a, bb, x, g, r] = LIB[ctx];
    $('lab-a').textContent = a; $('lab-b').textContent = bb; $('lab-x').textContent = x; $('lab-g').textContent = g; $('lab-r').textContent = r;
  }
  // La rumeur du public : elle monte quand le ballon approche d'un panier.
  const prox = Math.max(0, 1 - (14 - Math.abs(b.x)) / 8);
  son.public_(Math.min(1, 0.12 + prox * 0.35 + P.excit * 0.5));
  // La fin : on laisse les joueurs se congratuler, puis le joueur du match, puis le résumé.
  if (m.phase === 'fin' && P.finVue > 0) {
    P.finVue -= dt;
    if (P.finVue <= 0) {
      P.finVue = -1;
      const etapes = hommeDuMatch(P);
      if (etapes.length) cine.lancer(etapes, { passable: true, fin: finDuMatch });
      else finDuMatch();
    }
  }
}

/* ---------------- La fin ---------------- */

function finDuMatch() {
  const P = partie, m = P.m;
  const res = {
    score: [...m.score], vainqueur: m.vainqueur, enOr: m.enOr, equipes: P.o.equipes,
    paniers: m.paniers.map((p) => ({ ...p, nom: p.j >= 0 ? nomDe(p.j) : '' })),
    stats: JSON.parse(JSON.stringify(m.stats)),
    perso: m.perso.map((s, i) => ({ ...s, nom: nomDe(i), e: m.joueurs[i].e })),
    meilleur: meilleurJoueur(m, m.vainqueur),
  };
  const o = P.o;
  arreterMatch();
  montrerFin(res, o);
}

function montrerFin(res, o) {
  const eqs = res.equipes.map((id) => EQUIPE[id]);
  const v = res.vainqueur;
  $('fin-titre').textContent = v === 0 ? 'Victoire !' : 'Défaite';
  $('fin-score').innerHTML = `<div class="eq">${ecussonSVG(eqs[0], 64)}<span>${eqs[0].nom}</span></div>
    <div class="sc">${res.score[0]} - ${res.score[1]}${res.enOr ? '<span class="tab">(panier en or)</span>' : ''}</div>
    <div class="eq">${ecussonSVG(eqs[1], 64)}<span>${eqs[1].nom}</span></div>`;
  // Les marqueurs de chaque équipe : leurs points, leurs rebonds, leurs passes.
  const col = (e) => res.perso.filter((s) => s.e === e).sort((a, b) => b.pts - a.pts)
    .map((s, k) => `🏀 ${s.nom.split(' ').slice(-1)[0]} <small>${s.pts} pts · ${s.rebonds} reb · ${s.passes} pd</small>${res.perso.indexOf(s) === res.meilleur ? ' ★' : ''}`);
  const a = col(0), b = col(1);
  let lignes = '';
  for (let k = 0; k < 3; k++) lignes += `<div>${a[k] || ''}</div><div>${b[k] || ''}</div>`;
  $('fin-buteurs').innerHTML = lignes;
  const st = res.stats;
  const ligne = (lib, x, y, tx = x, ty = y) => {
    const tot = x + y || 1;
    return `<div class="stat"><span>${tx}</span><span class="lib">${lib}</span><span>${ty}</span>
      <div class="barre"><i style="width:${(x / tot) * 100}%;background:${eqs[0].maillot.fond}"></i><i style="width:${(y / tot) * 100}%;background:${eqs[1].maillot.fond === eqs[0].maillot.fond ? eqs[1].exterieur.fond : eqs[1].maillot.fond}"></i></div></div>`;
  };
  const pc = (r, t) => (t ? Math.round((r / t) * 100) : 0);
  const tp = st.possession[0] + st.possession[1] || 1;
  $('fin-stats').innerHTML = ligne('Possession', st.possession[0], st.possession[1], `${Math.round(st.possession[0] / tp * 100)} %`, `${Math.round(st.possession[1] / tp * 100)} %`)
    + ligne('Adresse', pc(st.reussis[0], st.tirs[0]), pc(st.reussis[1], st.tirs[1]), `${st.reussis[0]}/${st.tirs[0]}`, `${st.reussis[1]}/${st.tirs[1]}`)
    + ligne('À 3 points', st.troisReussis[0], st.troisReussis[1], `${st.troisReussis[0]}/${st.trois[0]}`, `${st.troisReussis[1]}/${st.trois[1]}`)
    + ligne('Dunks', st.dunks[0], st.dunks[1])
    + ligne('Rebonds', st.rebonds[0], st.rebonds[1])
    + ligne('Passes décisives', st.decisives[0], st.decisives[1])
    + ligne('Ballons volés', st.vols[0], st.vols[1])
    + ligne('Contres', st.contres[0], st.contres[1]);
  const act = $('fin-actions');
  act.innerHTML = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = `<b>${txt}</b>`; el.addEventListener('click', f); act.appendChild(el); return el; };
  bouton('Rejouer', 'vert grand', () => lancerMatch({ ...o, graine: undefined }));
  bouton('Changer d’équipes', '', () => ouvrirEquipes());
  bouton('Menu', '', () => aller('menu'));
  aller('fin');
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

/* ---------------- Les touches, au choix ---------------- */

let attend = null;
function rendreTouches() {
  for (const b of document.querySelectorAll('.touche')) {
    b.textContent = b.dataset.action === attend ? '…' : touches.nomTouche(touches.toucheDe(b.dataset.action));
    b.classList.toggle('attend', b.dataset.action === attend);
  }
}
function brancherTouches() {
  touches.pret.then(rendreTouches);
  rendreTouches();
  $('v-commandes').addEventListener('click', (e) => {
    const b = e.target.closest('.touche');
    if (!b) return;
    attend = attend === b.dataset.action ? null : b.dataset.action;
    rendreTouches();
  });
  $('touches-defaut').addEventListener('click', () => { touches.parDefaut(); attend = null; saisie.ecouterClavier(basculerPause, touches.table()); rendreTouches(); });
  // La nouvelle touche : on l'attrape avant tout le monde (ni pause, ni jeu, ni cinématique).
  addEventListener('keydown', (e) => {
    if (!attend) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { attend = null; rendreTouches(); return; }
    if (!touches.changer(attend, e.code, e.key)) { $('touches-aide').firstChild.textContent = 'Échap et P sont réservées à la pause : choisis une autre touche. '; return; }
    attend = null;
    saisie.ecouterClavier(basculerPause, touches.table());
    rendreTouches();
  }, true);
  for (const id of ['c-fermer', 'b-commandes', 'p-commandes']) $(id).addEventListener('click', () => { attend = null; rendreTouches(); });
}

function brancher() {
  saisie.ecouterClavier(basculerPause, touches.table(), T.R);
  brancherTouches();
  document.querySelector('.bj-r').dataset.bit = T.R;
  saisie.brancherTactile($('zone-joy'), document.querySelectorAll('.bj'));
  const doigt = () => document.body.classList.add('doigt');
  if (saisie.estTactile()) doigt();
  addEventListener('touchstart', doigt, { once: true, passive: true });
  addEventListener('keydown', () => document.body.classList.remove('doigt'));

  $('b-solo').addEventListener('click', () => { son.reveiller(); ouvrirEquipes(); });
  $('b-commandes').addEventListener('click', () => $('v-commandes').classList.remove('cache'));
  $('c-fermer').addEventListener('click', () => $('v-commandes').classList.add('cache'));
  $('p-commandes').addEventListener('click', () => $('v-commandes').classList.remove('cache'));
  $('b-pause').addEventListener('click', basculerPause);
  $('p-reprendre').addEventListener('click', basculerPause);
  $('p-quitter').addEventListener('click', () => { arreterMatch(); enPause = false; aller('menu'); });
  const majSon = () => { $('b-son').textContent = son.estMuet() ? '🔇 Son' : '🔊 Son'; $('b-son').setAttribute('aria-pressed', String(son.estMuet())); };
  $('b-son').addEventListener('click', () => { son.basculerSon(); majSon(); });
  majSon();
  $('b-commentaires').innerHTML = REGLAGES_COMM.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  $('b-commentaires').value = reglageCommentaires;
  $('b-commentaires').addEventListener('change', (e) => reglerCommentaires(e.target.value));
  $('b-public').innerHTML = son.AMBIANCES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  $('b-public').value = son.ambiancePublic();
  $('b-public').addEventListener('change', (e) => { son.reglerPublic(e.target.value); son.reveiller(); son.acclamation(0.5); });
  $('b-qualite').value = qualite();
  $('b-qualite').addEventListener('change', (e) => reglerQualite(e.target.value));
  brancherEquipes();
}

brancher();

// Pour les essais (dans la console) : window.doublePas.partie()
// avancer(s) : fait passer s secondes d'un coup (quand la page est cachée, l'animation s'arrête).
window.doublePas = {
  partie: () => partie, lancerMatch,
  avancer(s = 1) { let t = partie?.dernier ?? performance.now(); for (let k = 0; k < s * 60 && partie; k++) { t += 1000 / 60; boucle(t); } cancelAnimationFrame(raf); },
};
