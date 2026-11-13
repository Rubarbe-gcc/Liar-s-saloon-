/**
 * RAFFUT — le jeu : le menu, le choix des équipes, le match (la boucle à
 * 60 images par seconde, l'interface par-dessus la 3D), la fin du match, le
 * Tournoi et l'Entraînement.
 *
 * Le match est joué par le moteur partagé (shared/rugby/match.js) ; la 3D
 * (trois/rendu3d.js) ne fait que le montrer. En ligne (un contre un, avec un code) :
 * enligne.js et server/rugby.js, le rollback comme le basket.
 */

import { EQUIPES, EQUIPE, STYLES, POSTES, NOM_POSTE, notesEquipe, noteGenerale, noteJoueur } from '../../../../shared/rugby/equipes.js';
import { creerMatch, pas, chronoTexte, reglerEntrainement, FPS, T, CHARGE_MAX, FORCE_IDEALE, DEMI_L } from '../../../../shared/rugby/match.js';
import { NIVEAUX } from '../../../../shared/rugby/ia.js';
import { creerRendu, qualite, reglerQualite } from './trois/rendu3d.js';
import { STADES, STADE } from './trois/stade3d.js';
import { ecussonSVG, tenues } from '../../commun/ecusson.js';
import { creerCinematique } from '../../commun/cinematique.js';
import { intro, miTemps, hommeDuMatch, trophee, meilleurJoueur } from './cinematiques.js';
import { creerTournoi, matchDuJoueur, stadeDuTour, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement, TOURS } from '../../../../shared/rugby/tournoi.js';
import * as saisie from '../../commun/saisie.js';
import * as touches from './touches.js';
import * as son from '../../commun/son.js';
import * as net from './enligne.js';
import { creerLissage } from '../../commun/lissage.js';
import * as succes from '../../../../shared/succes.js';
import { creerCommentateur, reglage as reglageCommentaires, regler as reglerCommentaires, REGLAGES as REGLAGES_COMM } from './commentaires.js';

succes.visiter('petitpont');

const N = 7;
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

const CLE = 'raffut.config';
const DUREES = [2, 3, 4, 5, 7];
const conf = { moi: 'roc-fendu', lui: 'sablemer', niveau: 1, minutes: 3, stade: 'grand' };
try { Object.assign(conf, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch { /* ignore */ }
if (!EQUIPE[conf.moi]) conf.moi = 'roc-fendu';
if (!EQUIPE[conf.lui] || conf.lui === conf.moi) conf.lui = EQUIPES.find((e) => e.id !== conf.moi).id;
if (!STADE[conf.stade]) conf.stade = 'grand';
if (!DUREES.includes(conf.minutes)) conf.minutes = 3;
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(conf)); } catch { /* ignore */ } };

const COULEURS_STADE = {
  grand: ['linear-gradient(180deg,#03050f,#1a2240)', '#2f8b40'],
  village: ['linear-gradient(180deg,#5aa0e8,#cfe6ff)', '#4f9a3a'],
  falaises: ['linear-gradient(180deg,#4a2f7a,#ff9a52)', '#4a8f3e'],
};
const LIEUX = { grand: 'au Grand Stade', village: 'au Pré du Village', falaises: 'aux Falaises' };

/* ------------------------------------------------------------------ */
/* Le choix des équipes                                                */
/* ------------------------------------------------------------------ */

let choix = { pour: 'moi', survol: null, mode: 'solo', suite: null };

function carteDuel(el, id, role) {
  const eq = EQUIPE[id];
  el.style.setProperty('--c1', eq.maillot.fond);
  el.innerHTML = `${ecussonSVG(eq, 56)}<span><span class="role">${role}</span><span class="nom">${eq.nom}</span><small>${eq.ville} · ${STYLES[eq.style].nom}</small></span>`;
}

const barres = (n, chiffres = false) => `<div class="barres">${[['VIT', n.vitesse], ['FOR', n.force], ['PAS', n.passe], ['PIED', n.pied], ['DÉF', n.defense]]
  .map(([k, v]) => `<span>${k}${chiffres ? ` ${v}` : ''}</span><i style="--v:${Math.round(((v - 40) / 60) * 100)}%"></i>`).join('')}</div>`;

/** La fiche d'un club : sa devise, son style, ses sept joueurs et leurs notes. */
function fiche(id) {
  const eq = EQUIPE[id];
  $('fiche-club').style.setProperty('--c1', eq.maillot.fond);
  $('fiche-club').innerHTML = `<div class="tete">${ecussonSVG(eq, 40)}<span><b>${eq.nom}</b><small>${eq.ville} · ${STYLES[eq.style].nom} · note ${noteGenerale(eq)}</small></span></div>
    <p class="devise">« ${eq.devise} »</p>
    <div class="joueurs">${eq.joueurs.map((j, i) => `<div class="joueur"><b>${j.numero} · ${j.nom}${j.vedette ? ' <span class="vedette">★</span>' : ''}</b><small>${NOM_POSTE[POSTES[i]]} · ${noteJoueur(eq, i)}</small>${barres(j.notes, true)}</div>`).join('')}</div>`;
}

function rendreEquipes() {
  const solo = choix.mode !== 'tournoi';
  carteDuel($('duel-moi'), conf.moi, 'Toi');
  carteDuel($('duel-lui'), conf.lui, 'Adversaire');
  $('duel-lui').classList.toggle('cache', !solo);
  document.querySelector('.duel .vs').classList.toggle('cache', !solo);
  $('equipes-titre').textContent = { solo: 'Match amical', tournoi: 'Le Tournoi : ton club', entrainement: 'Entraînement : les équipes' }[choix.mode];
  $('b-jouer').querySelector('b').textContent = { solo: 'Coup d’envoi', tournoi: 'Commencer le tournoi', entrainement: 'C’est parti' }[choix.mode];
  $('duel-moi').classList.toggle('choisit', choix.pour === 'moi');
  $('duel-lui').classList.toggle('choisit', choix.pour === 'lui');
  $('consigne-equipes').textContent = choix.pour === 'moi' ? 'Choisis ton équipe.' : 'Choisis l’adversaire.';
  $('grille-equipes').innerHTML = EQUIPES.map((eq) => {
    const moi = eq.id === conf.moi, lui = solo && eq.id === conf.lui;
    return `<button class="equipe${moi ? ' moi' : ''}${lui ? ' lui' : ''}" data-id="${eq.id}" style="--c1:${eq.maillot.fond}">
      ${moi ? '<span class="marque">TOI</span>' : lui ? '<span class="marque">ADV</span>' : ''}<span class="note">${noteGenerale(eq)}</span>
      ${ecussonSVG(eq, 60)}<span class="nom">${eq.nom}</span><span class="style">${STYLES[eq.style].nom}</span>${barres(notesEquipe(eq))}</button>`;
  }).join('');
  fiche(choix.survol || (choix.pour === 'moi' ? conf.moi : conf.lui));
  $('seg-niveau').innerHTML = NIVEAUX.map((n, i) => `<button data-v="${i}" class="${conf.niveau === i ? 'oui' : ''}">${n.nom}</button>`).join('');
  $('seg-duree').parentElement.classList.toggle('cache', choix.mode === 'entrainement');
  $('seg-duree').innerHTML = DUREES.map((d) => `<button data-v="${d}" class="${conf.minutes === d ? 'oui' : ''}">2 × ${d} min</button>`).join('');
  $('grille-stades').innerHTML = STADES.map((s) => `<button class="stade${conf.stade === s.id ? ' oui' : ''}" data-id="${s.id}" style="--ciel:${COULEURS_STADE[s.id][0]};--sol:${COULEURS_STADE[s.id][1]}"><div class="vignette"></div><b>${s.nom}</b><small>${s.desc}</small></button>`).join('');
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
      if (choix.mode !== 'tournoi') choix.pour = 'lui';
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
  $('grille-stades').addEventListener('click', (e) => { const b = e.target.closest('.stade'); if (b) { conf.stade = b.dataset.id; garder(); rendreEquipes(); } });
  $('equipes-retour').addEventListener('click', () => aller('menu'));
  $('b-jouer').addEventListener('click', () => {
    son.reveiller();
    if (choix.suite) { choix.suite(); return; }
    lancerMatch({ equipes: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], minutes: conf.minutes, stade: conf.stade });
  });
}

function ouvrirEquipes(mode = 'solo', suite = null) {
  choix = { pour: 'moi', survol: null, mode, suite };
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
  const tr = m.transfo;
  return {
    f: m.f,
    phase: m.phase,
    joueurs: m.joueurs.map((p) => ({
      x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, dx: p.dx, dy: p.dy, etat: p.etat, absent: !!p.absent,
      porte: b.porteur === p.id, bloque: b.porteur === p.id && b.bloque, frappe: p.frappe, charge: p.etat === 'pied' ? Math.min(1, p.charge / CHARGE_MAX) : 0,
      melee: m.phase === 'melee' && p.i <= 2, ruck: m.phase === 'ruck' && m.ruck && Math.hypot(p.x - m.ruck.x, p.y - m.ruck.y) < 1.9 && p.etat === 'normal',
      lance: m.phase === 'touche' && b.porteur === p.id, raffut: p.raffut > 6, geste: p.geste, tg: p.tg,
      defend: att >= 0 && p.e !== att && Math.hypot(p.x - porteur.x, p.y - porteur.y) < 6,
    })),
    ballon: { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, porteur: b.porteur, pied: !!b.pied },
    transfo: tr ? { bx: tr.bx, by: tr.by, vise: tr.vise, parti: tr.parti, sens: m.equipes[tr.e].sens, humain: m.equipes[tr.e].ctrl === 'humain' } : null,
  };
}
function melanger(a, b, t) {
  if (!a || t >= 1) return b;
  const l = (u, v) => u + (v - u) * t;
  // Un saut (un placement de mêlée, de touche…) : pas de glissade.
  return {
    ...b,
    joueurs: b.joueurs.map((p, i) => { const q = a.joueurs[i]; if (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > 2) return p; return { ...p, x: l(q.x, p.x), y: l(q.y, p.y), z: l(q.z, p.z) }; }),
    ballon: Math.abs(a.ballon.x - b.ballon.x) + Math.abs(a.ballon.y - b.ballon.y) > 3 ? b.ballon : { ...b.ballon, x: l(a.ballon.x, b.ballon.x), y: l(a.ballon.y, b.ballon.y), z: l(a.ballon.z, b.ballon.z) },
  };
}

/** Les humeurs des joueurs (célébrations) et le héros du moment. */
function humeurs(m) {
  const h = new Array(2 * N).fill(null);
  let heros = -1;
  if (m.phase === 'marque' && m.marque) {
    const mq = m.marque;
    heros = mq.j;
    for (const p of m.joueurs) h[p.id] = p.e === mq.e ? (p.id === heros && mq.type === 'essai' ? 'heros' : 'joie') : p.etat === 'normal' ? 'decu' : null;
  } else if (m.phase === 'fin' && m.vainqueur >= 0) {
    for (const p of m.joueurs) h[p.id] = p.e === m.vainqueur ? 'joie' : 'decu';
  }
  return { h, heros };
}

/**
 * Lance un match.
 * o : { equipes: [id, id], controles, niveaux, minutes, stade, graine, entrainement, apres, abandon, finale }
 */
function lancerMatch(o) {
  arreterMatch();
  const eqs = o.equipes.map((id) => EQUIPE[id]);
  const kits = tenues(eqs[0], eqs[1]);
  const m = creerMatch({ equipes: o.equipes, graine: o.graine ?? Math.floor(Math.random() * 2 ** 31), minutes: o.minutes, controles: o.controles, niveaux: o.niveaux, entrainement: o.entrainement || null });
  aller('match');
  const rendu = creerRendu($('scene'), { stade: o.stade, equipes: eqs, kits });
  if (!rendu) { alert('La 3D n’est pas disponible sur cet appareil.'); aller('menu'); return; }
  partie = { o, m, rendu, eqs, kits, local: o.local ?? 0, lisse: o.mode === 'enligne' ? creerLissage(2 * N) : null, acc: 0, prec: null, cour: instantane(m), finVue: 0, dernier: performance.now(), excit: 0, scoreAffiche: '' };
  for (let e = 0; e < 2; e++) {
    $(`hud-ec${e}`).innerHTML = ecussonSVG(eqs[e], 26);
    $(`hud-abr${e}`).textContent = eqs[e].abr;
  }
  $('tableau-score').classList.toggle('libre', !!o.entrainement);
  $('p-quitter').textContent = o.entrainement ? 'Quitter l’entraînement' : 'Abandonner le match';
  if (o.entrainement) $('hud-score').textContent = 'ENTRAÎNEMENT';
  partie.lieu = LIEUX[o.stade] || '';
  ecranGeant();
  if (!o.entrainement) {
    partie.com = creerCommentateur({ nom: (id) => nomDe(id), equipe: (e) => eqs[e], lieu: partie.lieu, el: $('commentaire') });
    partie.com.debut(m);
    cine.lancer(intro(partie), { passable: o.mode !== 'enligne', fin: () => partie?.rendu.camera('tele', true) });
  } else rendu.camera('tele', true);
  enPause = false;
  saisie.siJeuEnCours(() => ecran === 'match' && !enPause);
  son.public_(0.15);
  raf = requestAnimationFrame(boucle);
}

function arreterMatch() {
  cancelAnimationFrame(raf);
  if (partie?.o.mode === 'enligne') net.finirSession();
  $('attente-net').classList.add('cache');
  cine.arreter(false);
  if (partie) { partie.com?.arreter(); partie.rendu.detruire(); partie = null; }
  son.couperPublic();
  $('v-pause').classList.add('cache');
}

function ecranGeant(texte) {
  if (!partie?.rendu.ecran) return;
  const { m, eqs } = partie;
  if (m.entrainement) { partie.rendu.ecran(['RAFFUT', texte || 'ENTRAÎNEMENT']); return; }
  partie.rendu.ecran([`${eqs[0].abr}  ${m.score[0]} - ${m.score[1]}  ${eqs[1].abr}`, texte || 'RAFFUT']);
}

function boucle(t) {
  if (!partie) return;
  raf = requestAnimationFrame(boucle);
  const P = partie;
  const dt = Math.min(0.1, Math.max(0, (t - P.dernier) / 1000));
  P.dernier = t;
  if (cine.actif) { cine.maj(dt); P.acc = 0; }
  else if (!enPause || P.o.mode === 'enligne') {
    P.acc += dt;
    // En ligne : en avance sur l'adversaire, on ralentit à peine l'horloge (au lieu de sauter une image).
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
    const r = net.pasEnLigne(saisie.lire());
    if (!r) return;
    P.gel = r.attente && !r.retenue ? (P.gel || 0) + 1 : 0;
    if (r.attente) return;
    P.prec = P.cour;
    P.cour = instantane(P.m);
    P.lisse.apres(P.prec, P.cour, Math.max(1, P.cour.f - P.prec.f) * PAS);
    reagir(r.evs);
    return;
  }
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
      case 'passe': son.controle(); break;
      case 'reception': case 'ramasse': son.controle(); break;
      case 'pied': case 'envoi': son.frappe(ev.transfo ? 0.6 : 0.45); P.excit = Math.max(P.excit, 0.3); break;
      case 'rebond': son.bande(Math.min(4, ev.force)); break;
      case 'poteau': son.poteau(); break;
      case 'plaquage': son.tacle(); P.excit = Math.max(P.excit, 0.35); break;
      case 'plaquage-rate': if (ev.franchi) { son.occasion(); bandeau('Franchissement !', nomDe(ev.porteur)); P.excit = 0.8; } break;
      case 'geste': if (m.joueurs[ev.joueur].e === P.local && ev.reussi) bandeau({ crochet: 'Crochet !', roulette: 'Roulette !', feinte: 'Feinte de passe !' }[ev.geste], nomDe(ev.joueur)); break;
      case 'raffut': if (ev.reussi) { son.arret(); if (m.joueurs[ev.joueur].e === P.local) bandeau('Raffut !', nomDe(ev.joueur)); } break;
      case 'grattage': son.tacle(); bandeau('Grattage !', nomDe(ev.joueur)); break;
      case 'interception': son.tacle(); bandeau('Interception !', nomDe(ev.joueur)); break;
      case 'en-avant': son.sifflet(1); bandeau('En-avant', nomDe(ev.joueur)); break;
      case 'passe-avant': bandeau('Passe en avant', nomDe(ev.joueur)); break;
      case 'melee': bandeau('Mêlée', P.eqs[ev.equipe].court); break;
      case 'melee-gagnee': if (ev.contre) bandeau('Mêlée gagnée !', `contre l’introduction · ${P.eqs[ev.equipe].court}`); break;
      case 'touche': son.sifflet(1); bandeau('Touche', P.eqs[ev.equipe].court); break;
      case 'touche-gagnee': if (ev.vol) bandeau('Touche volée !', nomDe(ev.joueur)); break;
      case 'mort': son.sifflet(1); bandeau('Ballon mort'); break;
      case 'sifflet': son.sifflet(ev.n || 1, ev.n === 3); break;
      case 'sirene': son.sifflet(2, true); bandeau('La sirène !', 'Dernière action : la mi-temps finit au prochain arrêt de jeu', true); break;
      case 'essai': {
        son.but();
        P.excit = 1.5;
        const passe = ev.passeur >= 0 ? ` · passe de ${nomCourt(ev.passeur)}` : '';
        bandeau(ev.enOr ? 'Essai en or !' : 'Essai !', `${nomDe(ev.joueur)}${passe}`, true);
        $('hud-score').classList.remove('flash'); void $('hud-score').offsetWidth; $('hud-score').classList.add('flash');
        ecranGeant('ESSAI !');
        break;
      }
      case 'transfo':
        if (ev.reussi) { son.acclamation(0.7); bandeau('Transformée !', nomDe(ev.joueur)); ecranGeant('TRANSFORMÉE'); }
        else bandeau('Transformation manquée', nomDe(ev.joueur));
        break;
      case 'drop':
        son.but(); P.excit = 1.3;
        bandeau(ev.enOr ? 'Drop en or !' : 'Drop !', `${nomDe(ev.joueur)} · 3 points`, true);
        ecranGeant('DROP !');
        break;
      case 'mitemps':
        if (P.o.mode !== 'enligne') cine.lancer(miTemps(P), { passable: true, fin: () => { if (partie?.m.phase === 'pause') partie.m.t = Math.min(partie.m.t, 30); partie?.rendu.camera('tele', true); } });
        son.acclamation(1); bandeau('Mi-temps', `${P.eqs[0].court} ${m.score[0]} - ${m.score[1]} ${P.eqs[1].court}`, true); break;
      case 'reprise': ecranGeant('2E MI-TEMPS'); break;
      case 'renvoi': ecranGeant(); break;
      case 'egalite': son.acclamation(1); bandeau('Égalité !', 'Point en or : le premier qui marque gagne', true); ecranGeant('POINT EN OR'); break;
      case 'fin': {
        son.sifflet(3, true);
        son.acclamation(1);
        const v = ev.vainqueur;
        bandeau('Fin du match', v >= 0 ? `Victoire de ${P.eqs[v].court}` : 'Match nul', true);
        ecranGeant(v >= 0 ? `VICTOIRE ${P.eqs[v].abr}` : 'MATCH NUL');
        P.finVue = 3;
        break;
      }
      default:
    }
  }
}

/* ---------------- L'affichage ---------------- */

const LIB = {
  att: ['Passe', 'Pied', 'Raffut', 'Crochet', 'Sautée'],
  def: ['Gratter', 'Plaquer', 'Gratter', 'Changer', '—'],
  libre: ['—', '—', '—', 'Changer', '—'],
  transfo: ['—', 'Force', '—', '—', '—'],
};
let contexte = '';

function afficher(dt) {
  const P = partie, m = P.m;
  P.excit *= Math.pow(0.4, dt);
  P.com?.avancer(dt, m);
  const vueCine = cine.actif ? cine.vue() : null;
  if (vueCine) { P.rendu.afficher(vueCine, dt); return; }
  let vue = melanger(P.prec, P.cour, P.acc / (P.periode || PAS));
  if (P.lisse) vue = P.lisse.appliquer(vue, dt);
  const { h, heros } = humeurs(m);
  if (!cine.actif) P.rendu.camera(m.phase === 'marque' && heros >= 0 && m.marque?.type === 'essai' && m.t < 100 ? 'essai' : m.phase === 'transfo' ? 'transfo' : 'tele');
  const eq = m.equipes[P.local];
  const autre = m.equipes[1 - P.local];
  const actifs = [eq.ctrl === 'humain' ? eq.actif : -1, autre.ctrl === 'humain' ? autre.actif : -1];
  P.rendu.afficher({ ...vue, actifs, humeurs: h, heros }, dt);

  // Le tableau d'affichage.
  if (!m.entrainement) {
    const score = `${m.score[0]} - ${m.score[1]}`;
    if (score !== P.scoreAffiche) { $('hud-score').textContent = score; P.scoreAffiche = score; }
    $('hud-chrono').textContent = m.sirene && !m.enOr ? '0:00' : chronoTexte(m);
    $('hud-mi').textContent = m.enOr ? 'POINT' : m.periode === 1 ? '1re' : '2e';
    $('tableau-score').classList.toggle('sirene', !!m.sirene && !m.enOr);
  }
  // Le joueur dirigé : son nom, son souffle.
  const pj = eq.ctrl === 'humain' && eq.actif >= 0 ? m.joueurs[eq.actif] : null;
  if (pj) {
    $('dirige-nom').textContent = `${P.eqs[pj.e].joueurs[pj.i].numero} · ${P.eqs[pj.e].joueurs[pj.i].nom}`;
    $('dirige-endu').style.width = `${Math.round(pj.endu * 100)}%`;
  }
  $('dirige').classList.toggle('cache', !pj || (m.phase !== 'jeu' && m.phase !== 'ruck'));
  // La jauge : la force du coup de pied (et, pour la transformation, la zone idéale).
  const elJ = $('jauge');
  const tr = m.transfo;
  const monTransfo = tr && !tr.parti && tr.e === P.local && eq.ctrl === 'humain';
  const charge = monTransfo ? tr.charge / CHARGE_MAX : pj && pj.etat === 'pied' && m.ballon.porteur === pj.id ? pj.charge / CHARGE_MAX : 0;
  elJ.classList.toggle('cache', !charge && !monTransfo);
  elJ.classList.toggle('transfo', !!monTransfo);
  if (charge || monTransfo) {
    const p = monTransfo ? m.joueurs[tr.j] : pj;
    const s = P.rendu.versEcran(p.x, p.y, 2.6);
    elJ.style.left = `${s.x}px`; elJ.style.top = `${s.y}px`;
    elJ.firstElementChild.style.width = `${Math.round(Math.min(1, charge) * 100)}%`;
    elJ.classList.toggle('parfait', !!monTransfo && Math.abs(charge - FORCE_IDEALE) <= 0.06);
  }
  $('aide-transfo').classList.toggle('cache', !monTransfo);
  // Les boutons tactiles disent ce qu'ils font maintenant.
  const b = m.ballon;
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const ctx = monTransfo ? 'transfo' : porteur && porteur.e === P.local ? 'att' : porteur || m.phase === 'ruck' ? 'def' : 'libre';
  if (ctx !== contexte) {
    contexte = ctx;
    const [a, bb, x, g, r] = LIB[ctx];
    $('lab-a').textContent = a; $('lab-b').textContent = bb; $('lab-x').textContent = x; $('lab-g').textContent = g; $('lab-r').textContent = r;
  }
  // La rumeur du public : elle monte quand le ballon approche d'un en-but.
  const prox = Math.max(0, 1 - (DEMI_L - Math.abs(b.x)) / 14);
  son.public_(Math.min(1, 0.12 + prox * 0.35 + P.excit * 0.5));
  // La fin : on laisse les joueurs se congratuler, puis le joueur du match, puis le résumé.
  if (P.o.mode === 'enligne') attenteReseau(P);
  if (m.phase === 'fin' && P.finVue > 0) {
    P.finVue -= dt;
    // En ligne, on attend que tout soit confirmé : le résultat ne peut plus changer.
    if (P.finVue <= 0 && P.o.mode === 'enligne') P.attenteFin ??= performance.now();
    if (P.finVue <= 0 && P.o.mode === 'enligne' && !net.toutConfirme() && performance.now() - P.attenteFin <= 3000) P.finVue = 0.05;
    else if (P.finVue <= 0) {
      P.finVue = -1;
      const etapes = [...hommeDuMatch(P), ...(P.o.finale && m.vainqueur === P.local ? trophee(P, P.local) : [])];
      if (etapes.length) cine.lancer(etapes, { passable: true, fin: finDuMatch });
      else finDuMatch();
    }
  }
}

/* ---------------- La fin ---------------- */

function finDuMatch() {
  const P = partie, m = P.m;
  const res = {
    score: [...m.score], vainqueur: m.vainqueur, enOr: m.enOr, auTerrain: !!m.auTerrain, equipes: P.o.equipes,
    stats: JSON.parse(JSON.stringify(m.stats)),
    perso: m.perso.map((s, i) => ({ ...s, nom: nomDe(i), e: m.joueurs[i].e })),
    meilleur: meilleurJoueur(m, m.vainqueur),
    resume: resumer(m),
  };
  const o = P.o;
  arreterMatch();
  montrerFin(res, o);
}

function montrerFin(res, o) {
  const eqs = res.equipes.map((id) => EQUIPE[id]);
  const v = res.vainqueur;
  $('fin-titre').textContent = v === 0 ? 'Victoire !' : v === 1 ? 'Défaite' : 'Match nul';
  $('fin-attente').textContent = '';
  $('fin-score').innerHTML = `<div class="eq">${ecussonSVG(eqs[0], 64)}<span>${eqs[0].nom}</span></div>
    <div class="sc">${res.score[0]} - ${res.score[1]}${res.auTerrain ? '<span class="tab">(au terrain gagné)</span>' : res.enOr ? '<span class="tab">(point en or)</span>' : ''}</div>
    <div class="eq">${ecussonSVG(eqs[1], 64)}<span>${eqs[1].nom}</span></div>`;
  // Les meilleurs de chaque équipe : leurs points, leurs essais, leurs plaquages.
  const col = (e) => res.perso.filter((s) => s.e === e).sort((a, b) => b.pts - a.pts || b.essais - a.essais || b.plaquages - a.plaquages)
    .map((s) => `🏉 ${s.nom.split(' ').slice(-1)[0]} <small>${s.pts} pts · ${s.essais} ess. · ${s.plaquages} plaq.</small>${res.perso.indexOf(s) === res.meilleur ? ' ★' : ''}`);
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
  const tp = st.possession[0] + st.possession[1] || 1;
  const tt = st.territoire[0] + st.territoire[1] || 1;
  $('fin-stats').innerHTML = ligne('Possession', st.possession[0], st.possession[1], `${Math.round((st.possession[0] / tp) * 100)} %`, `${Math.round((st.possession[1] / tp) * 100)} %`)
    + ligne('Territoire', st.territoire[0], st.territoire[1], `${Math.round((st.territoire[0] / tt) * 100)} %`, `${Math.round((st.territoire[1] / tt) * 100)} %`)
    + ligne('Essais', st.essais[0], st.essais[1])
    + ligne('Transformations', st.transfos[0], st.transfos[1], `${st.transfos[0]}/${st.transfosTentees[0]}`, `${st.transfos[1]}/${st.transfosTentees[1]}`)
    + ligne('Mètres gagnés', Math.round(st.metres[0]), Math.round(st.metres[1]))
    + ligne('Plaquages', st.plaquages[0], st.plaquages[1])
    + ligne('Plaquages manqués', st.plaquagesRates[0], st.plaquagesRates[1])
    + ligne('Ballons grattés', st.grattages[0], st.grattages[1])
    + ligne('En-avant', st.enAvants[0], st.enAvants[1]);
  const act = $('fin-actions');
  act.innerHTML = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = `<b>${txt}</b>`; el.addEventListener('click', f); act.appendChild(el); return el; };
  if (o.apres) o.apres(res, bouton);
  else {
    bouton('Rejouer', 'vert grand', () => lancerMatch({ ...o, graine: undefined }));
    bouton('Changer d’équipes', '', () => ouvrirEquipes());
    bouton('Menu', '', () => aller('menu'));
  }
  aller('fin');
}

/* ------------------------------------------------------------------ */
/* L'entraînement                                                      */
/* ------------------------------------------------------------------ */

if (!conf.entr) conf.entr = { nous: 7, eux: 7, immobiles: false };

function lancerEntrainement() {
  lancerMatch({
    equipes: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], minutes: 3, stade: conf.stade,
    entrainement: { ...conf.entr },
    abandon: () => aller('menu'),
  });
}

/** Les réglages de l'entraînement, dans la pause (cachés pendant un vrai match). */
function rendreReglages() {
  const on = !!partie?.m.entrainement;
  $('p-entr').classList.toggle('cache', !on);
  $('panneau-pause').classList.toggle('large', on);
  if (!on) return;
  const E = conf.entr;
  const seg = (id, valeurs, actuelle, libelle) => { $(id).innerHTML = valeurs.map((v) => `<button data-v="${v}" class="${String(actuelle) === String(v) ? 'oui' : ''}">${libelle(v)}</button>`).join(''); };
  const nombre = (n) => (n ? String(n) : 'Personne');
  seg('entr-nous', [1, 2, 3, 4, 5, 6, 7], E.nous, nombre);
  seg('entr-eux', [0, 1, 2, 3, 4, 5, 6, 7], E.eux, nombre);
  seg('entr-mode', ['jouent', 'plots'], E.immobiles ? 'plots' : 'jouent', (v) => (v === 'plots' ? 'Immobiles' : 'Jouent'));
  seg('entr-niveau', [0, 1, 2], conf.niveau, (i) => NIVEAUX[i].nom);
  const personne = !E.eux;
  $('entr-bloc-mode').classList.toggle('cache', personne);
  $('entr-bloc-niveau').classList.toggle('cache', personne || E.immobiles);
}

function brancherEntrainement() {
  const choisir = (id, f) => $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !partie?.m.entrainement) return;
    son.bip();
    f(b.dataset.v);
    garder();
    reglerEntrainement(partie.m, { ...conf.entr, niveau: conf.niveau });
    partie.prec = null;
    partie.cour = instantane(partie.m);
    rendreReglages();
  });
  choisir('entr-nous', (v) => { conf.entr.nous = +v; });
  choisir('entr-eux', (v) => { conf.entr.eux = +v; });
  choisir('entr-mode', (v) => { conf.entr.immobiles = v === 'plots'; });
  choisir('entr-niveau', (v) => { conf.niveau = +v; });
  $('b-entrainement').addEventListener('click', () => { son.reveiller(); ouvrirEquipes('entrainement', lancerEntrainement); });
}

/* ------------------------------------------------------------------ */
/* Le Tournoi                                                          */
/* ------------------------------------------------------------------ */

const CLE_TOURNOI = 'raffut.tournoi';
let tournoi = null;
try { tournoi = JSON.parse(localStorage.getItem(CLE_TOURNOI) || 'null'); } catch { /* ignore */ }
if (tournoi && !tournoi.tours) tournoi = null;
const garderTournoi = () => { try { if (tournoi) localStorage.setItem(CLE_TOURNOI, JSON.stringify(tournoi)); else localStorage.removeItem(CLE_TOURNOI); } catch { /* ignore */ } };

function infoTournoi() {
  $('tournoi-info').textContent = tournoi && !tournoi.fini && !tournoi.elimine ? `En cours : ${TOURS[tournoi.tour].toLowerCase()} avec ${EQUIPE[tournoi.moi].court}` : 'Huit clubs, élimination directe';
}

function ouvrirTournoi() {
  if (tournoi) { rendreTournoi(); aller('tournoi'); return; }
  ouvrirEquipes('tournoi', () => {
    tournoi = creerTournoi({ moi: conf.moi, graine: Math.floor(Math.random() * 2 ** 31), niveau: conf.niveau, minutes: conf.minutes, stade: conf.stade });
    garderTournoi();
    rendreTournoi();
    aller('tournoi');
  });
}

/** Les autres matchs du tour se jouent ; puis on passe au tour suivant. */
function finirTour() {
  for (const i of aJouer(tournoi)) jouerSansMoi(tournoi, i);
  avancer(tournoi);
  garderTournoi();
}

function ligneTournoi(id, score, perd) {
  if (!id) return '<div class="ligne"><span></span><span>?</span><b></b></div>';
  const eq = EQUIPE[id];
  return `<div class="ligne${perd ? ' perd' : ''}${id === tournoi.moi ? ' toi' : ''}">${ecussonSVG(eq, 20)}<span>${eq.court}</span><b>${score ?? ''}</b></div>`;
}

function rendreTournoi() {
  const c = tournoi;
  let html = '';
  for (let t = 0; t < 3; t++) {
    const tour = c.tours[t] || new Array(4 >> t).fill(null).map(() => ({}));
    html += `<div class="tour"><h4>${TOURS[t]}</h4>${tour.map((r) => {
      const fini = !!r.v;
      // ★ : gagné au point en or.
      const sa = fini ? `${r.score[0]}${r.enOr && r.v === r.a ? ' ★' : ''}` : '', sb = fini ? `${r.score[1]}${r.enOr && r.v === r.b ? ' ★' : ''}` : '';
      const joueur = r.a === c.moi || r.b === c.moi;
      return `<div class="rencontre${joueur ? ' joueur' : ''}">${ligneTournoi(r.a, sa, fini && r.v !== r.a)}${ligneTournoi(r.b, sb, fini && r.v !== r.b)}</div>`;
    }).join('')}</div>`;
  }
  html += `<div class="tour"><h4>Vainqueur</h4><div class="coupe-trophee">🏆</div>${c.champion ? `<div class="rencontre${c.champion === c.moi ? ' joueur' : ''}">${ligneTournoi(c.champion, '')}</div>` : ''}</div>`;
  $('tableau').innerHTML = html;
  $('tableau').classList.toggle('tirage', !c.tirageVu);
  if (!c.tirageVu) {
    $('tableau').querySelectorAll('.tour:first-child .ligne').forEach((el, i) => el.style.setProperty('--i', i));
    c.tirageVu = true;
    garderTournoi();
  }
  const m = matchDuJoueur(c);
  const adv = m && (m.a === c.moi ? m.b : m.a);
  $('tournoi-texte').textContent = c.fini
    ? (c.champion === c.moi ? `${EQUIPE[c.moi].nom} remporte le Tournoi !` : `${EQUIPE[c.champion].nom} remporte le Tournoi.`)
    : c.elimine ? `${EQUIPE[c.moi].court} est éliminé. Le Tournoi continue sans toi.`
      : `${TOURS[c.tour]} · ${EQUIPE[c.moi].court} contre ${EQUIPE[adv].court} · ${NIVEAUX[c.niveau].nom} · ${STADE[stadeDuTour(c)].nom}`;
  const act = $('tournoi-actions');
  act.innerHTML = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = txt; el.addEventListener('click', f); act.appendChild(el); };
  bouton('<b>Statistiques</b>', 'bleu', () => montrerStats(c.stats, c.moi, () => { rendreTournoi(); aller('tournoi'); }));
  if (m) bouton(`<b>Jouer ${c.tour === 2 ? 'la finale' : c.tour === 1 ? 'la demie' : 'le quart'}</b><small>contre ${EQUIPE[adv].nom}</small>`, 'vert grand', jouerTournoi);
  if (c.elimine && !c.fini) bouton('<b>Voir la suite</b>', 'bleu', () => { while (!tournoi.fini) finirTour(); rendreTournoi(); });
  if (c.fini || c.elimine) bouton('<b>Nouveau tournoi</b>', c.fini ? 'vert' : '', () => { tournoi = null; garderTournoi(); ouvrirTournoi(); });
  else bouton('Abandonner le tournoi', 'fin', () => { if (confirm('Abandonner ce tournoi ?')) { tournoi = null; garderTournoi(); infoTournoi(); aller('menu'); } });
  infoTournoi();
}

function jouerTournoi() {
  const c = tournoi, r = matchDuJoueur(c);
  if (!r) return;
  const moiA = r.a === c.moi;
  const adv = moiA ? r.b : r.a;
  const noter = (res) => {
    // Le match est joué « moi contre lui » : on le remet dans le sens du tableau.
    enregistrer(c, r.i, { score: moiA ? res.score : [res.score[1], res.score[0]], enOr: res.enOr, vainqueur: moiA ? res.vainqueur : 1 - res.vainqueur });
    noterStats(c, res.resume);
    finirTour();
  };
  lancerMatch({
    equipes: [c.moi, adv], controles: ['humain', 'ia'], niveaux: [1, c.niveau], minutes: c.minutes, stade: stadeDuTour(c), finale: c.tour === 2,
    apres: (res, bouton) => {
      noter(res);
      const gagne = res.vainqueur === 0;
      $('fin-titre').textContent = gagne ? (tournoi.fini ? 'Champion !' : 'Qualifié !') : 'Éliminé';
      bouton('Le tableau', 'vert grand', () => { rendreTournoi(); aller('tournoi'); });
      bouton('Menu', '', () => { infoTournoi(); aller('menu'); });
    },
    // Abandonner un match du tournoi : défaite par forfait.
    abandon: () => { noter({ score: [0, 28], enOr: false, vainqueur: 1, resume: [] }); rendreTournoi(); aller('tournoi'); },
  });
}

/* ---------------- Les statistiques du tournoi ---------------- */

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
function montrerStats(stats, moi, retour) {
  const ligne = (x, valeur, detail) => {
    const eq = EQUIPE[x.club];
    return `<li class="ligne-stat${x.club === moi ? ' toi' : ''}"><span class="rg">${x.rang}</span>${ecussonSVG(eq, 26)}<span class="qui"><b>${eq.joueurs[x.i].nom}</b><small>${eq.court}</small></span><span class="val">${valeur}<small>${detail}</small></span></li>`;
  };
  const bloc = (titre, cle, mot, vide) => {
    const l = classement(stats, cle);
    return `<section class="classement-stat"><h3>${titre}</h3>${l.length ? `<ol>${l.map((x) => ligne(x, pluriel(x[cle], mot), `${(x[cle] / x.matchs).toFixed(1)} par match`)).join('')}</ol>` : `<p class="vide">${vide}</p>`}</section>`;
  };
  $('stats-corps').innerHTML = `<div class="stats-grille">${[
    bloc('Meilleurs marqueurs d’essais', 'essais', 'essai', 'Personne n’a encore marqué d’essai.'),
    bloc('Meilleurs réalisateurs', 'pts', 'point', 'Aucun point pour l’instant.'),
    bloc('Meilleurs plaqueurs', 'plaquages', 'plaquage', 'Aucun plaquage pour l’instant.'),
    bloc('Meilleurs passeurs', 'passes', 'passe décisive', 'Aucune passe décisive pour l’instant.'),
  ].join('')}</div>`;
  $('stats-retour').onclick = retour;
  aller('stats');
}

/* ------------------------------------------------------------------ */
/* En ligne (un contre un, avec un code : enligne.js, server/rugby.js) */
/* ------------------------------------------------------------------ */

const CLE_NOM = 'raffut.nom';
const STATUTS = { connexion: 'Connexion au serveur…', connecte: 'Connecté ! Crée une salle, ou rejoins celle d’un ami avec son code.', perdu: 'Connexion perdue. Nouvelle tentative…', injoignable: 'Le serveur ne répond pas. On réessaie…' };

function nomEnLigne() {
  const n = $('enligne-nom').value.trim() || succes.pseudo() || 'Joueur';
  try { localStorage.setItem(CLE_NOM, n); } catch { /* ignore */ }
  return n;
}

/** La connexion lâche, l'adversaire aussi, ou ses touches n'arrivent plus : on le dit (pas d'écran figé muet). */
function attenteReseau(P) {
  const nomAdv = P.o.noms?.[1 - P.local] || 'Ton adversaire';
  const raison = P.netPerdu ? ['Connexion perdue', 'Reconnexion en cours… le match reprend tout seul.']
    : P.absent ? [`${nomAdv} a perdu la connexion`, 'On l’attend : sa place est gardée quelques minutes.']
      : (P.gel || 0) > 45 ? ['En attente…', `Les touches de ${nomAdv} n’arrivent plus pour l’instant.`] : null;
  $('attente-net').classList.toggle('cache', !raison);
  if (raison) { $('attente-titre').textContent = raison[0]; $('attente-texte').textContent = raison[1]; }
  if (!$('net-diag').classList.contains('cache')) {
    const d = net.diagnostic();
    if (d) $('net-diag').textContent = `ping ${d.ping} ms · délai ${d.delai} · avance ${d.avance} · rejouées ${d.rejouees} · recalages ${d.recalages}`;
  }
}

/**
 * Le salon : les deux joueurs dans la salle, chacun choisit son club (celui de
 * l'autre est pris), puis « Prêt ! ». Le match part quand les deux sont prêts.
 */
let autoChoix = false;
function rendreSalon(s) {
  const moi = s.n, lui = 1 - s.n;
  const present = !!s.noms[lui];
  const carte = (n) => {
    const eq = s.equipes[n] && EQUIPE[s.equipes[n]];
    const nom = s.noms[n] || '…';
    return `<div class="salon-joueur${n === moi ? ' moi' : ''}${s.prets[n] ? ' pret' : ''}" style="--c1:${eq ? eq.maillot.fond : '#1a3a2a'}">
      ${eq ? ecussonSVG(eq, 40) : '<span class="ec-vide">?</span>'}
      <span><small>${n === moi ? 'Toi' : 'Adversaire'}</small><b>${nom}</b><i>${eq ? eq.court : present || n === moi ? 'choisit son club…' : 'pas encore là'}</i></span>
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
      : pret && !s.prets[lui] ? `En attente de ${s.noms[lui]}…` : 'Choisissez vos clubs (pas le même), puis « Prêt ! ».';
  // La première fois, on propose le club de d'habitude (si l'autre ne l'a pas pris).
  if (!autoChoix && !s.equipes[moi] && s.equipes[lui] !== conf.moi) { autoChoix = true; net.choisirEquipe(conf.moi); }
}

/** Le stade du match : c'est l'hôte qui le choisit. */
function rendreStadesEnLigne() {
  const hote = net.salle.n === 0;
  const nomHote = net.salle.salon?.noms?.[0];
  $('salle-stade-bloc').firstElementChild.textContent = hote ? 'Le stade (c’est toi qui choisis)' : `Le stade (choisi par ${nomHote || 'l’hôte'})`;
  $('salle-stades').innerHTML = STADES.map((x) => `<button data-id="${x.id}" class="${net.salle.stade === x.id ? 'oui' : ''}"${hote ? '' : ' disabled'}>${x.nom}</button>`).join('');
}

function ouvrirEnLigne() {
  let nom = '';
  try { nom = localStorage.getItem(CLE_NOM) || localStorage.getItem('doublepas.nom') || localStorage.getItem('petitpont.nom') || ''; } catch { /* ignore */ }
  $('enligne-nom').value = nom || succes.pseudo() || '';
  $('enligne-accueil').classList.toggle('cache', !!net.salle.code);
  $('enligne-salle').classList.toggle('cache', !net.salle.code);
  aller('enligne');
  const retourAccueil = (texte) => {
    $('enligne-accueil').classList.remove('cache');
    $('enligne-salle').classList.add('cache');
    $('enligne-statut').textContent = texte;
  };
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
        retourAccueil('La connexion a été coupée trop longtemps (ou le serveur a redémarré) : le match est interrompu.');
        aller('enligne');
      } else if (net.salle.code) {
        net.quitter();
        retourAccueil('La connexion a été coupée : la salle est fermée. Crées-en une autre.');
      }
    },
    absent: (m) => {
      if (partie?.o.mode === 'enligne') partie.absent = true;
      else $('salle-attente').textContent = `${m.nom} a perdu la connexion… on l’attend.`;
    },
    revenu: (m) => {
      if (partie) partie.absent = false;
      else $('salle-attente').textContent = `${m.nom} est de retour.`;
    },
    salle: (m) => {
      $('enligne-accueil').classList.add('cache');
      $('enligne-salle').classList.remove('cache');
      $('salle-code').textContent = m.code;
      $('enligne-statut').textContent = '';
      autoChoix = false;
      rendreSalon({ n: 0, noms: [nomEnLigne(), null], equipes: [null, null], prets: [false, false] });
      rendreStadesEnLigne();
    },
    salon: (m) => {
      $('enligne-accueil').classList.add('cache');
      $('enligne-salle').classList.remove('cache');
      if (net.salle.code) $('salle-code').textContent = net.salle.code;
      // Retour au salon (après un match) : on quitte la fin du match, même si elle n'est pas finie ici.
      if (partie?.o.mode === 'enligne') arreterMatch();
      if (ecran !== 'enligne') aller('enligne');
      $('enligne-statut').textContent = '';
      rendreSalon(m);
      rendreStadesEnLigne();
    },
    stade: () => rendreStadesEnLigne(),
    debut: (m) => lancerEnLigne(m),
    revanche: (m) => { if (ecran === 'fin' && m.n !== net.salle.n) $('fin-attente').textContent = 'Ton adversaire veut sa revanche !'; },
    parti: () => {
      const enMatch = partie?.o.mode === 'enligne';
      if (enMatch) arreterMatch();
      if (enMatch || ecran === 'fin' || ecran === 'enligne') { retourAccueil('Ton adversaire a quitté le match.'); aller('enligne'); }
    },
    erreur: (msg) => { $('enligne-statut').textContent = msg; },
  });
}

function lancerEnLigne(d) {
  son.reveiller();
  $('fin-attente').textContent = '';
  lancerMatch({
    equipes: d.equipes, controles: ['humain', 'humain'], niveaux: [1, 1], minutes: 3, stade: STADE[d.stade] ? d.stade : 'grand', mode: 'enligne',
    graine: d.graine, local: d.n, noms: d.noms,
    apres: (res, bouton) => {
      const moi = d.n;
      $('fin-titre').textContent = res.vainqueur === moi ? `Victoire contre ${d.noms[1 - moi]} !` : `Défaite contre ${d.noms[1 - moi]}`;
      const b = bouton('Revanche', 'vert grand', () => { net.revanche(); b.disabled = true; $('fin-attente').textContent = 'En attente de ton adversaire…'; });
      bouton('Changer d’équipes', '', () => net.retourSalon());
      bouton('Quitter', '', () => { net.quitter(); aller('menu'); });
    },
    abandon: () => { net.quitter(); aller('menu'); },
  });
  if (partie) net.demarrerSession({ m: partie.m, n: d.n });
}

function brancherEnLigne() {
  $('b-enligne').addEventListener('click', () => { son.reveiller(); ouvrirEnLigne(); });
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
  $('attente-quitter').addEventListener('click', () => { arreterMatch(); net.quitter(); enPause = false; aller('menu'); });
  // Le diagnostic du réseau (F3).
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); $('net-diag').classList.toggle('cache'); } });
}

/* ------------------------------------------------------------------ */
/* La pause, les commandes, le menu                                    */
/* ------------------------------------------------------------------ */

function basculerPause() {
  if (ecran !== 'match' || !partie) return;
  enPause = !enPause;
  $('v-pause').classList.toggle('cache', !enPause);
  if (enPause) rendreReglages();
  if (!enPause) $('v-commandes').classList.add('cache');
}

let attend = null;
function rendreTouches() {
  for (const b of document.querySelectorAll('.touche')) {
    b.textContent = b.dataset.action === attend ? '…' : touches.nomTouche(touches.toucheDe(b.dataset.action));
    b.classList.toggle('attend', b.dataset.action === attend);
  }
  const k = (a) => touches.nomTouche(touches.toucheDe(a));
  $('aide-transfo').innerHTML = `<b>Transformation</b> ${k('haut')} ${k('bas')} pour viser · tiens <b>${k('pied')}</b> pour la force, lâche dans la zone blanche`;
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
  $('p-quitter').addEventListener('click', () => {
    const o = partie?.o;
    arreterMatch();
    enPause = false;
    if (o?.abandon) o.abandon(); else aller('menu');
  });
  $('b-tournoi').addEventListener('click', () => { son.reveiller(); ouvrirTournoi(); });
  $('tournoi-retour').addEventListener('click', () => { infoTournoi(); aller('menu'); });
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
brancherEnLigne();
brancherEntrainement();
infoTournoi();

// Pour les essais (dans la console) : window.raffut.partie()
// avancer(s) : fait passer s secondes d'un coup (quand la page est cachée, l'animation s'arrête).
window.raffut = {
  partie: () => partie, lancerMatch,
  avancer(s = 1) { let t = partie?.dernier ?? performance.now(); for (let k = 0; k < s * 60 && partie; k++) { t += 1000 / 60; boucle(t); } cancelAnimationFrame(raf); },
  reprendre() { cancelAnimationFrame(raf); if (partie) { partie.dernier = performance.now(); raf = requestAnimationFrame(boucle); } },
};
