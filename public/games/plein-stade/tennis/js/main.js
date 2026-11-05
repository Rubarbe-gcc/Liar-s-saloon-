/**
 * REVERS — le tennis : le menu, le choix des joueurs, le match (la boucle à 60 images par seconde, le tableau
 * du score par-dessus la 3D, la jauge du coup armé, l'aide au service), la fin du match et ses statistiques,
 * l'entraînement, le Tournoi et le jeu en ligne.
 *
 * Le match est joué par le moteur partagé (shared/tennis/match.js) ; la 3D (trois/rendu3d.js) ne fait que le
 * montrer. Sur le modèle de la boxe (boxe/js/main.js).
 */

import { JOUEURS, JOUEUR, STYLES, SURFACES, noteGenerale } from '../../../../shared/tennis/joueurs.js';
import { creerMatch, pas, pointsTexte, enjeu, reglerEntrainement, FORMATS, FPS, T } from '../../../../shared/tennis/match.js';
import { creerTournoi, matchDuJoueur, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement, TOURS } from '../../../../shared/tennis/tournoi.js';
import { NIVEAUX } from '../../../../shared/tennis/ia.js';
import * as net from './enligne.js';
import { creerLissage } from '../../commun/lissage.js';
import { creerRendu, qualite, reglerQualite } from './trois/rendu3d.js';
import { creerCinematique } from '../../commun/cinematique.js';
import { intro, victoire, badgeSVG, scoreFinal } from './cinematiques.js';
import * as saisie from '../../commun/saisie.js';
import * as son from '../../commun/son.js';
import * as succes from '../../../../shared/succes.js';
import * as touches from './touches.js';
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

/* ------------------------------------------------------------------ */
/* Les réglages gardés d'une fois sur l'autre                          */
/* ------------------------------------------------------------------ */

const CLE = 'revers.config';
const conf = { moi: 'valmont', lui: 'karsten', niveau: 1, format: 'court', surface: 'dur', entr: { serveur: 'moi' } };
try { Object.assign(conf, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch { /* ignore */ }
if (!JOUEUR[conf.moi]) conf.moi = 'valmont';
if (!JOUEUR[conf.lui] || conf.lui === conf.moi) conf.lui = JOUEURS.find((x) => x.id !== conf.moi).id;
if (!FORMATS[conf.format]) conf.format = 'court';
if (!SURFACES[conf.surface]) conf.surface = 'dur';
if (!conf.entr || !['moi', 'lui'].includes(conf.entr.serveur)) conf.entr = { serveur: 'moi' };
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(conf)); } catch { /* ignore */ } };
const nomCourtDe = (j) => j.nom.split(' ').slice(-1)[0];

/* ------------------------------------------------------------------ */
/* Le choix des joueurs                                                */
/* ------------------------------------------------------------------ */

let choix = { pour: 'moi', survol: null, mode: 'solo', suite: null };

function carteDuel(el, id, role) {
  const j = JOUEUR[id];
  el.style.setProperty('--c1', j.couleurs.maillot);
  el.innerHTML = `${badgeSVG(j, 56)}<span><span class="role">${role}</span><span class="nom">${j.nom}</span><small>« ${j.surnom} » · ${STYLES[j.style].nom}</small></span>`;
}

const barres = (n, chiffres = false) => `<div class="barres">${[['SERV', n.service], ['CD', n.coupDroit], ['REV', n.revers], ['VOL', n.volee], ['VIT', n.vitesse]]
  .map(([k, v]) => `<span>${k}${chiffres ? ` ${v}` : ''}</span><i style="--v:${Math.round(((v - 50) / 50) * 100)}%"></i>`).join('')}</div>`;

function fiche(id) {
  const j = JOUEUR[id];
  $('fiche-club').style.setProperty('--c1', j.couleurs.maillot);
  $('fiche-club').innerHTML = `<div class="tete">${badgeSVG(j, 40)}<span><b>${j.nom} · « ${j.surnom} »</b><small>${STYLES[j.style].nom} · ${j.ville} · note ${noteGenerale(j)}</small></span></div>${barres(j.notes, true)}`;
}

const segments = (id, valeurs, actuelle, libelle) => { $(id).innerHTML = valeurs.map((v) => `<button data-v="${v}" class="${String(actuelle) === String(v) ? 'oui' : ''}">${libelle(v)}</button>`).join(''); };

function rendreEquipes() {
  const deux = choix.mode !== 'tournoi';
  $('duel-lui').classList.toggle('cache', !deux);
  document.querySelector('.duel .vs').classList.toggle('cache', !deux);
  $('equipes-titre').textContent = { solo: 'Match', tournoi: 'Le Tournoi : ton joueur', entrainement: 'Entraînement' }[choix.mode];
  $('b-jouer').querySelector('b').textContent = { solo: 'Sur le court', tournoi: 'Commencer le tournoi', entrainement: 'C’est parti' }[choix.mode];
  $('seg-format').parentElement.classList.toggle('cache', choix.mode === 'entrainement');
  carteDuel($('duel-moi'), conf.moi, 'Toi');
  carteDuel($('duel-lui'), conf.lui, 'Adversaire');
  $('duel-moi').classList.toggle('choisit', choix.pour === 'moi');
  $('duel-lui').classList.toggle('choisit', choix.pour === 'lui');
  $('consigne-equipes').textContent = choix.pour === 'moi' ? 'Choisis ton joueur.' : 'Choisis ton adversaire.';
  $('grille-equipes').innerHTML = JOUEURS.map((j) => {
    const moi = j.id === conf.moi, lui = deux && j.id === conf.lui;
    return `<button class="equipe${moi ? ' moi' : ''}${lui ? ' lui' : ''}" data-id="${j.id}" style="--c1:${j.couleurs.maillot}">
      ${moi ? '<span class="marque">TOI</span>' : lui ? '<span class="marque">ADV</span>' : ''}<span class="note">${noteGenerale(j)}</span>
      ${badgeSVG(j, 56)}<span class="nom">${j.nom}</span><span class="surnom">« ${j.surnom} »</span><span class="style">${STYLES[j.style].nom}</span>${barres(j.notes)}</button>`;
  }).join('');
  fiche(choix.survol || (choix.pour === 'moi' ? conf.moi : conf.lui));
  segments('seg-niveau', [0, 1, 2], conf.niveau, (i) => NIVEAUX[i].nom);
  segments('seg-format', Object.keys(FORMATS), conf.format, (f) => FORMATS[f].nom);
  segments('seg-surface', Object.keys(SURFACES), conf.surface, (s) => SURFACES[s].nom);
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
  const seg = (id, f) => $(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { f(b.dataset.v); garder(); rendreEquipes(); } });
  seg('seg-niveau', (v) => { conf.niveau = +v; });
  seg('seg-format', (v) => { conf.format = v; });
  seg('seg-surface', (v) => { conf.surface = v; });
  $('equipes-retour').addEventListener('click', () => aller('menu'));
  $('b-jouer').addEventListener('click', () => {
    son.reveiller();
    if (choix.suite) { choix.suite(); return; }
    lancerMatch({ joueurs: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], format: conf.format, surface: conf.surface });
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
  const b = m.balle;
  return {
    f: m.f,
    phase: m.phase,
    serveur: m.serveur,
    joueurs: m.joueurs.map((p) => ({ e: p.e, x: p.x, y: p.y, vx: p.vx, vy: p.vy, lance: p.lance, prepa: p.prepa ? { type: p.prepa.type, t: p.prepa.t } : null, anim: p.anim ? { ...p.anim } : null })),
    balle: { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, tenue: b.tenue },
  };
}
function melanger(a, b, t) {
  if (!a || t >= 1 || a.phase !== b.phase) return b;
  const l = (u, v) => u + (v - u) * t;
  const balle = b.balle.tenue || a.balle.tenue ? b.balle : { ...b.balle, x: l(a.balle.x, b.balle.x), y: l(a.balle.y, b.balle.y), z: l(a.balle.z, b.balle.z) };
  return { ...b, balle, joueurs: b.joueurs.map((p, i) => { const q = a.joueurs[i]; return { ...p, x: l(q.x, p.x), y: l(q.y, p.y) }; }) };
}
/** Pour le lissage commun (des « joueurs » et un « ballon »). */
const lisible = (v) => v && ({ joueurs: v.joueurs, ballon: v.balle });

/** Lance un match. o : { joueurs: [id, id], controles, niveaux, format, surface, graine, entrainement, mode, local, noms, apres, abandon, trophee } */
function lancerMatch(o) {
  arreterMatch();
  const joueurs = o.joueurs.map((id) => JOUEUR[id]);
  const m = creerMatch({ joueurs: o.joueurs, graine: o.graine ?? Math.floor(Math.random() * 2 ** 31), format: o.format, surface: o.surface, controles: o.controles, niveaux: o.niveaux, entrainement: o.entrainement || null });
  aller('match');
  const local = o.local ?? 0;
  const rendu = creerRendu($('scene'), { joueurs, surface: m.surface, local });
  if (!rendu) { alert('La 3D n’est pas disponible sur cet appareil.'); aller('menu'); return; }
  partie = { o, m, rendu, joueurs, local, lisse: o.mode === 'enligne' ? creerLissage(2) : null, acc: 0, prec: null, cour: instantane(m), finVue: 0, dernier: performance.now(), excit: 0, vitesse: null };
  for (let e = 0; e < 2; e++) {
    $(`hud-badge${e}`).innerHTML = badgeSVG(joueurs[e], 24);
    $(`hud-nom${e}`).textContent = nomCourtDe(joueurs[e]);
  }
  $('vitesse').textContent = '';
  ecranGeant();
  $('p-quitter').textContent = o.entrainement ? 'Quitter l’entraînement' : 'Abandonner le match';
  if (!o.entrainement) {
    partie.com = creerCommentateur({ joueur: (e) => joueurs[e], el: $('commentaire') });
    cine.lancer(intro(partie), { passable: o.mode !== 'enligne', fin: () => partie?.rendu.camera('tele', true) });
    partie.com.debut();
  } else rendu.camera('tele', true);
  enPause = false;
  saisie.siJeuEnCours(() => ecran === 'match' && !enPause);
  son.public_(0.1);
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

/** Le grand écran du stade : les noms, et le score des jeux. */
function ecranGeant(texte) {
  if (!partie?.rendu.ecran) return;
  const { m, joueurs } = partie;
  const S = m.score;
  const sets = S.sets.map((s) => `${s[0]}-${s[1]}`).join('  ');
  partie.rendu.ecran([`${nomCourtDe(joueurs[0]).toUpperCase()} - ${nomCourtDe(joueurs[1]).toUpperCase()}`, texte || (m.entrainement ? 'ENTRAÎNEMENT' : `${sets ? `${sets}   ` : ''}JEUX ${S.jeux[0]}-${S.jeux[1]}`)]);
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
    P.periode = P.o.mode === 'enligne' ? PAS * (1 + Math.min(0.08, Math.max(0, (net.ecart() - 1) * 0.03))) : PAS;
    let n = 0;
    while (P.acc >= P.periode && n < 6) { uneImage(); P.acc -= P.periode; n += 1; }
    if (n >= 6) P.acc = 0;
  }
  if (!partie) return;
  afficher(dt);
}

function uneImage() {
  const P = partie;
  if (P.o.mode === 'enligne') {
    const r = net.pasEnLigne(saisie.lire());
    if (!r) return;
    P.gel = r.attente && !r.retenue ? (P.gel || 0) + 1 : 0;
    if (r.attente) return;
    P.prec = P.cour;
    P.cour = instantane(P.m);
    P.lisse.apres(lisible(P.prec), lisible(P.cour), Math.max(1, P.cour.f - P.prec.f) * PAS);
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

const nomCourt = (e) => nomCourtDe(partie.joueurs[e]);
const RAISONS = { ace: 'Ace !', gagnant: 'Coup gagnant', dehors: 'Faute : dehors', filet: 'Faute : filet', doublefaute: 'Double faute' };

function reagir(evs) {
  const P = partie, m = P.m;
  if (!evs.length) return;
  P.rendu.evenements(evs, P.cour);
  for (const ev of evs) {
    P.com?.evenement(ev, m);
    switch (ev.type) {
      case 'frappe':
        son.frappe(Math.min(1, 0.3 + (ev.vitesse || 60) / 220));
        if (ev.coup === 'service') { P.vitesse = { kmh: ev.vitesse, t: 2.5 }; $('vitesse').innerHTML = `${ev.vitesse}<small>km/h</small>`; }
        if (ev.coup === 'smash') { son.occasion(); P.excit = Math.max(P.excit, 0.6); }
        break;
      case 'rebond': if (ev.n === 1) son.controle(); break;
      case 'faute':
        son.sifflet(1);
        if (!ev.double) bandeau(ev.raison === 'filet' ? 'Filet !' : 'Faute !', 'Deuxième balle');
        break;
      case 'point': {
        const nous = ev.gagnant === P.local;
        if (ev.raison === 'filet') son.filet();
        son.acclamation(Math.min(1, 0.35 + ev.echange * 0.04 + (ev.raison === 'ace' ? 0.3 : 0)));
        P.excit = Math.max(P.excit, Math.min(1.2, 0.3 + ev.echange * 0.05));
        if (ev.raison === 'ace' || ev.raison === 'doublefaute' || ev.echange >= 12) bandeau(RAISONS[ev.raison] || 'Point', ev.echange >= 12 ? `${ev.echange} frappes · point ${nomCourt(ev.gagnant)}` : `Point ${nomCourt(ev.gagnant)}`);
        else if (P.o.controles[P.local] === 'humain' && (ev.raison === 'dehors' || ev.raison === 'filet') && !nous) bandeau(RAISONS[ev.raison]);
        break;
      }
      case 'jeu':
        if (!m.entrainement) { bandeau(ev.break ? 'Break !' : `Jeu ${nomCourt(ev.gagnant)}`, `${ev.jeux[0]}-${ev.jeux[1]}`); ecranGeant(); }
        if (ev.break) { son.but(); P.excit = Math.max(P.excit, 1); }
        break;
      case 'tiebreak': bandeau('Jeu décisif', 'Le premier à 7 points, deux d’écart', true); son.poteau(); break;
      case 'set':
        if (m.phase !== 'fin') { bandeau(`Set ${nomCourt(ev.gagnant)}`, ev.sets.map((s) => s.join('-')).join(' · '), true); son.but(); ecranGeant(); }
        break;
      case 'fin':
        son.but();
        bandeau('Jeu, set et match', nomCourt(ev.vainqueur), true);
        ecranGeant('JEU, SET ET MATCH');
        P.finVue = 1.8;
        break;
      default:
    }
  }
}

/* ---------------- L'affichage ---------------- */

const NOMS_COUPS = { lift: 'Lift', slice: 'Slice', lob: 'Lob', amortie: 'Amortie' };

function afficher(dt) {
  const P = partie, m = P.m;
  P.excit *= Math.pow(0.4, dt);
  P.com?.avancer(dt, m);
  const vueCine = cine.actif ? cine.vue() : null;
  if (vueCine) { P.rendu.afficher(vueCine, dt); return; }
  let vue = melanger(P.prec, P.cour, P.acc / (P.periode || PAS));
  if (P.lisse) { const l = P.lisse.appliquer(lisible(vue), dt); vue = { ...vue, joueurs: l.joueurs, balle: l.ballon }; }
  P.rendu.camera('tele');
  P.rendu.afficher(vue, dt);
  // Le tableau : un joueur par ligne, ses sets, ses jeux, ses points ; la balle du serveur.
  const S = m.score, pts = pointsTexte(m);
  for (let e = 0; e < 2; e++) {
    $(`hud-l${e}`).classList.toggle('sert', m.serveur === e && m.phase !== 'fin');
    $(`hud-sets${e}`).innerHTML = S.sets.map((s) => `<span class="${s[e] > s[1 - e] ? 'gagne' : ''}">${s[e]}</span>`).join('');
    $(`hud-jeux${e}`).textContent = m.entrainement ? '–' : S.jeux[e];
    $(`hud-pts${e}`).textContent = m.entrainement ? m.stats.points[e] : m.phase === 'fin' ? '' : pts[e];
  }
  const x = enjeu(m);
  $('hud-enjeu').textContent = x && (m.phase === 'service' || m.phase === 'faute') ? `${{ break: 'Balle de break', set: 'Balle de set', match: 'Balle de match' }[x.type]} · ${nomCourt(x.e)}` : S.tb && m.phase !== 'fin' ? 'Jeu décisif' : '';
  if (P.o.mode === 'enligne') attenteReseau(P);
  // La jauge du coup armé (le nôtre), l'aide au service.
  const moi = m.joueurs[P.local], humain = P.o.controles[P.local] === 'humain';
  const arme = humain && moi.prepa && m.phase === 'jeu';
  $('jauge').classList.toggle('cache', !arme);
  if (arme) { $('jauge-nom').textContent = NOMS_COUPS[moi.prepa.type] || ''; $('jauge-val').style.width = `${Math.min(100, (moi.prepa.t / 40) * 100)}%`; }
  const t = (a) => `<kbd>${touches.nomTouche(touches.toucheDe(a))}</kbd>`;
  $('aide-service').innerHTML = humain && m.phase === 'service' && m.serveur === P.local
    ? (moi.lance ? `Frappe quand la balle est tout en haut ! ${saisie.estTactile() ? '' : t('lift')}` : `${m.deuxieme ? 'Deuxième balle · ' : ''}${saisie.estTactile() ? 'Lift' : t('lift')} pour lancer la balle · la direction vise`)
    : '';
  if (P.vitesse) { P.vitesse.t -= dt; if (P.vitesse.t <= 0) { P.vitesse = null; $('vitesse').textContent = ''; } }
  son.public_(Math.min(1, 0.08 + P.excit * 0.45));
  if (m.phase === 'fin' && P.finVue > 0) {
    P.finVue -= dt;
    if (P.finVue <= 0 && P.o.mode === 'enligne') P.attenteFin ??= performance.now();
    if (P.finVue <= 0 && P.o.mode === 'enligne' && !net.toutConfirme() && performance.now() - P.attenteFin <= 3000) P.finVue = 0.05;
    else if (P.finVue <= 0) { P.finVue = -1; cine.lancer(victoire(P, m.vainqueur, { trophee: !!P.o.trophee }), { passable: true, fin: finDuMatch }); }
  }
}

/* ---------------- La fin ---------------- */

function finDuMatch() {
  const P = partie, m = P.m;
  const res = { resume: resumer(m), joueurs: P.o.joueurs, vainqueur: m.vainqueur, sets: m.score.sets.map((s) => [...s]), stats: JSON.parse(JSON.stringify(m.stats)), score: scoreFinal(m, m.vainqueur) };
  const o = P.o;
  arreterMatch();
  montrerFin(res, o);
}

function montrerFin(res, o) {
  const js = res.joueurs.map((id) => JOUEUR[id]);
  const v = res.vainqueur, local = o.local ?? 0;
  $('fin-titre').textContent = o.controles[local] === 'humain' ? (v === local ? 'Victoire !' : 'Défaite') : `Victoire de ${js[v].nom}`;
  $('fin-score').innerHTML = `<div class="eq">${badgeSVG(js[0], 64)}<span>${js[0].nom}</span></div>
    <div class="sc">${res.sets.filter((s) => s[0] > s[1]).length} – ${res.sets.filter((s) => s[1] > s[0]).length}<span class="tab">${nomCourtDe(js[v])} : ${res.score}</span></div>
    <div class="eq">${badgeSVG(js[1], 64)}<span>${js[1].nom}</span></div>`;
  $('fin-sets').innerHTML = res.sets.map((s) => `<span>${s[0]}-${s[1]}</span>`).join('');
  const st = res.stats;
  const ligne = (lib, x, y) => {
    const tot = x + y || 1;
    return `<div class="stat"><span>${x}</span><span class="lib">${lib}</span><span>${y}</span>
      <div class="barre"><i style="width:${(x / tot) * 100}%;background:${js[0].couleurs.maillot}"></i><i style="width:${(y / tot) * 100}%;background:${js[1].couleurs.maillot}"></i></div></div>`;
  };
  const pc = (e) => (st.premiersTentes[e] ? Math.round((st.premiers[e] / st.premiersTentes[e]) * 100) : 0);
  $('fin-stats').innerHTML = ligne('Points gagnés', st.points[0], st.points[1]) + ligne('Aces', st.aces[0], st.aces[1]) + ligne('Doubles fautes', st.doubles[0], st.doubles[1])
    + ligne('1res balles (%)', pc(0), pc(1)) + ligne('Coups gagnants', st.gagnants[0], st.gagnants[1]) + ligne('Fautes', st.fautes[0], st.fautes[1])
    + ligne('Service le plus rapide (km/h)', st.vitesseMax[0], st.vitesseMax[1])
    + `<p class="consigne">Le plus long échange : ${st.plusLong} frappes.</p>`;
  const act = $('fin-actions');
  act.innerHTML = '';
  $('fin-attente').textContent = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = `<b>${txt}</b>`; el.addEventListener('click', f); act.appendChild(el); return el; };
  if (o.apres) o.apres(res, bouton);
  else {
    bouton('Revanche', 'vert grand', () => lancerMatch({ ...o, graine: undefined }));
    bouton('Changer de joueurs', '', () => ouvrirEquipes());
    bouton('Menu', '', () => aller('menu'));
  }
  aller('fin');
}

/* ------------------------------------------------------------------ */
/* L'entraînement                                                      */
/* ------------------------------------------------------------------ */

/** L'entraînement : des points sans compter ; qui sert et le niveau d'en face se règlent dans la pause. */
function lancerEntrainement() {
  lancerMatch({ joueurs: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], format: 'court', surface: conf.surface, entrainement: { ...conf.entr }, abandon: () => aller('menu') });
}

function rendreReglages() {
  const on = !!partie?.m.entrainement;
  $('p-entr').classList.toggle('cache', !on);
  $('panneau-pause').classList.toggle('large', on);
  if (!on) return;
  segments('entr-serveur', ['moi', 'lui'], conf.entr.serveur, (v) => ({ moi: 'Toi', lui: 'Lui' }[v]));
  segments('entr-niveau', [0, 1, 2], conf.niveau, (i) => NIVEAUX[i].nom);
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
  choisir('entr-serveur', (v) => { conf.entr.serveur = v === 'lui' ? 'lui' : 'moi'; });
  choisir('entr-niveau', (v) => { conf.niveau = +v; });
  $('b-entrainement').addEventListener('click', () => { son.reveiller(); ouvrirEquipes('entrainement', lancerEntrainement); });
}

/* ------------------------------------------------------------------ */
/* Le Tournoi                                                          */
/* ------------------------------------------------------------------ */

const CLE_TOURNOI = 'revers.tournoi';
let tournoi = null;
try { tournoi = JSON.parse(localStorage.getItem(CLE_TOURNOI) || 'null'); } catch { /* ignore */ }
if (tournoi && !tournoi.tours) tournoi = null;
const garderTournoi = () => { try { if (tournoi) localStorage.setItem(CLE_TOURNOI, JSON.stringify(tournoi)); else localStorage.removeItem(CLE_TOURNOI); } catch { /* ignore */ } };

function infoTournoi() {
  $('tournoi-info').textContent = tournoi && !tournoi.fini && !tournoi.elimine ? `En cours : ${TOURS[tournoi.tour].toLowerCase()} avec ${nomCourtDe(JOUEUR[tournoi.moi])}` : 'Huit joueurs, le trophée au bout';
}

function ouvrirTournoi() {
  if (tournoi) { rendreTournoi(); aller('tournoi'); return; }
  ouvrirEquipes('tournoi', () => {
    tournoi = creerTournoi({ moi: conf.moi, graine: Math.floor(Math.random() * 2 ** 31), niveau: conf.niveau, format: conf.format, surface: conf.surface });
    garderTournoi();
    rendreTournoi();
    aller('tournoi');
  });
}

function finirTour() {
  for (const i of aJouer(tournoi)) jouerSansMoi(tournoi, i);
  avancer(tournoi);
  garderTournoi();
}

/** Le score d'une rencontre, vu du vainqueur : « 3-1 » ou « 6-4 7-6 ». */
const scoreCourt = (r) => (r.sets || []).map((s) => (r.v === r.a ? `${s[0]}-${s[1]}` : `${s[1]}-${s[0]}`)).join(' ');

function ligneTournoi(id, texte, perd) {
  if (!id) return '<div class="ligne"><span></span><span>?</span><b></b></div>';
  const j = JOUEUR[id];
  return `<div class="ligne${perd ? ' perd' : ''}${id === tournoi.moi ? ' toi' : ''}">${badgeSVG(j, 20)}<span>${nomCourtDe(j)}</span><b>${texte ?? ''}</b></div>`;
}

function rendreTournoi() {
  const c = tournoi;
  let html = '';
  for (let t = 0; t < 3; t++) {
    const tour = c.tours[t] || new Array(4 >> t).fill(null).map(() => ({}));
    html += `<div class="tour"><h4>${TOURS[t]}</h4>${tour.map((r) => {
      const fini = !!r.v;
      const joueur = r.a === c.moi || r.b === c.moi;
      return `<div class="rencontre${joueur ? ' joueur' : ''}">${ligneTournoi(r.a, fini && r.v === r.a ? scoreCourt(r) : '', fini && r.v !== r.a)}${ligneTournoi(r.b, fini && r.v === r.b ? scoreCourt(r) : '', fini && r.v !== r.b)}</div>`;
    }).join('')}</div>`;
  }
  html += `<div class="tour"><h4>Champion</h4><div class="coupe-trophee">🏆</div>${c.champion ? `<div class="rencontre${c.champion === c.moi ? ' joueur' : ''}">${ligneTournoi(c.champion, '')}</div>` : ''}</div>`;
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
    ? (c.champion === c.moi ? `${JOUEUR[c.moi].nom} remporte le tournoi !` : `${JOUEUR[c.champion].nom} remporte le tournoi.`)
    : c.elimine ? `${JOUEUR[c.moi].nom} est éliminé. Le Tournoi continue sans toi.`
      : `${TOURS[c.tour]} · ${JOUEUR[c.moi].nom} contre ${JOUEUR[adv].nom} · ${NIVEAUX[c.niveau].nom} · ${FORMATS[c.format].nom} · ${SURFACES[c.surface].nom}`;
  const act = $('tournoi-actions');
  act.innerHTML = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = txt; el.addEventListener('click', f); act.appendChild(el); };
  bouton('<b>Statistiques</b>', 'bleu', () => montrerStats(c.stats, c.moi, () => { rendreTournoi(); aller('tournoi'); }));
  if (m) bouton(`<b>Jouer ${c.tour === 2 ? 'la finale' : c.tour === 1 ? 'la demie' : 'le quart'}</b><small>contre ${JOUEUR[adv].nom}</small>`, 'vert grand', jouerTournoi);
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
    // Les sets, vus du joueur « a » de la rencontre.
    const sets = res.sets.map((s) => (moiA ? [s[0], s[1]] : [s[1], s[0]]));
    enregistrer(c, r.i, { sets, vainqueur: moiA ? res.vainqueur : 1 - res.vainqueur });
    noterStats(c, res.resume);
    finirTour();
  };
  lancerMatch({
    joueurs: [c.moi, adv], controles: ['humain', 'ia'], niveaux: [1, c.niveau], format: c.format, surface: c.surface, trophee: c.tour === 2,
    apres: (res, bouton) => {
      noter(res);
      const gagne = res.vainqueur === 0;
      $('fin-titre').textContent = gagne ? (tournoi.fini ? 'Champion !' : 'Qualifié !') : 'Éliminé';
      bouton('Le tableau', 'vert grand', () => { rendreTournoi(); aller('tournoi'); });
      bouton('Menu', '', () => { infoTournoi(); aller('menu'); });
    },
    // Abandonner un match du tournoi : défaite.
    abandon: () => { noter({ sets: [[0, FORMATS[c.format].jeux]], vainqueur: 1, resume: [] }); rendreTournoi(); aller('tournoi'); },
  });
}

/* ---------------- Les statistiques du tournoi ---------------- */

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
function montrerStats(stats, moi, retour) {
  const ligne = (x, valeur, detail) => {
    const j = JOUEUR[x.id];
    return `<li class="ligne-stat${x.id === moi ? ' toi' : ''}"><span class="rg">${x.rang}</span>${badgeSVG(j, 26)}<span class="qui"><b>${j.nom}</b><small>« ${j.surnom} »</small></span><span class="val">${valeur}<small>${detail}</small></span></li>`;
  };
  const bloc = (titre, cle, mot, vide) => {
    const l = classement(stats, cle);
    return `<section class="classement-stat"><h3>${titre}</h3>${l.length ? `<ol>${l.map((x) => ligne(x, pluriel(x[cle], mot), pluriel(x.matchs, 'match').replace('matchs', 'matchs'))).join('')}</ol>` : `<p class="vide">${vide}</p>`}</section>`;
  };
  $('stats-corps').innerHTML = `<div class="stats-grille">${[
    bloc('Aces', 'aces', 'ace', 'Aucun ace pour l’instant.'),
    bloc('Coups gagnants', 'gagnants', 'coup gagnant', 'Aucun match pour l’instant.'),
    bloc('Jeux gagnés', 'jeux', 'jeu', 'Aucun match pour l’instant.'),
  ].join('')}</div>`;
  $('stats-retour').onclick = retour;
  aller('stats');
}

/* ------------------------------------------------------------------ */
/* En ligne (un contre un, avec un code : enligne.js, server/tennis.js) */
/* ------------------------------------------------------------------ */

const CLE_NOM = 'revers.nom';
const STATUTS = { connexion: 'Connexion au serveur…', connecte: 'Connecté ! Crée une salle, ou rejoins celle d’un ami avec son code.', perdu: 'Connexion perdue. Nouvelle tentative…', injoignable: 'Le serveur ne répond pas. On réessaie…' };
/** Le « stade » du protocole : la surface et le format. */
const stadeDe = (surface, format) => `${surface}-${format}`;
const lireStade = (s) => { const [a, b] = String(s || '').split('-'); return { surface: SURFACES[a] ? a : 'dur', format: FORMATS[b] ? b : 'court' }; };

function nomEnLigne() {
  const n = $('enligne-nom').value.trim() || succes.pseudo() || 'Joueur';
  try { localStorage.setItem(CLE_NOM, n); } catch { /* ignore */ }
  return n;
}

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

let autoChoix = false;
function rendreSalon(s) {
  const moi = s.n, lui = 1 - s.n;
  const present = !!s.noms[lui];
  const carte = (n) => {
    const j = s.equipes[n] && JOUEUR[s.equipes[n]];
    const nom = s.noms[n] || '…';
    return `<div class="salon-joueur${n === moi ? ' moi' : ''}${s.prets[n] ? ' pret' : ''}" style="--c1:${j ? j.couleurs.maillot : '#1a3a2a'}">
      ${j ? badgeSVG(j, 40) : '<span class="ec-vide">?</span>'}
      <span><small>${n === moi ? 'Toi' : 'Adversaire'}</small><b>${nom}</b><i>${j ? j.nom : present || n === moi ? 'choisit son joueur…' : 'pas encore là'}</i></span>
      <em>${s.prets[n] ? '✓ Prêt' : ''}</em></div>`;
  };
  $('salon-joueurs').innerHTML = carte(moi) + carte(lui);
  $('salon-equipes').innerHTML = JOUEURS.map((j) => {
    const a = s.equipes[moi] === j.id, pris = s.equipes[lui] === j.id;
    return `<button class="equipe${a ? ' moi' : ''}${pris ? ' lui pris' : ''}" data-id="${j.id}" style="--c1:${j.couleurs.maillot}"${pris ? ' disabled' : ''}>
      ${a ? '<span class="marque">TOI</span>' : pris ? `<span class="marque">${s.noms[lui]}</span>` : ''}<span class="note">${noteGenerale(j)}</span>
      ${badgeSVG(j, 46)}<span class="nom">${j.nom}</span><span class="style">${STYLES[j.style].nom}</span></button>`;
  }).join('');
  // La surface et le format : l'hôte choisit, l'autre voit.
  const st = lireStade(net.salle.stade);
  const desactive = moi === 0 ? '' : ' disabled';
  $('salon-surface').innerHTML = Object.keys(SURFACES).map((v) => `<button data-v="${v}" class="${st.surface === v ? 'oui' : ''}"${desactive}>${SURFACES[v].nom}</button>`).join('');
  $('salon-format').innerHTML = Object.keys(FORMATS).map((v) => `<button data-v="${v}" class="${st.format === v ? 'oui' : ''}"${desactive}>${FORMATS[v].nom}</button>`).join('');
  const pret = s.prets[moi];
  $('salon-pret').innerHTML = pret ? '<b>Pas encore prêt</b><small>Changer d’avis</small>' : '<b>Prêt !</b><small>Le match part quand vous l’êtes tous les deux</small>';
  $('salon-pret').className = `btn grand ${pret ? '' : 'vert'}`;
  $('salon-pret').disabled = !s.equipes[moi] || !present;
  $('salle-attente').textContent = !present ? 'En attente d’un adversaire… Donne-lui ce code.'
    : s.prets[lui] && !pret ? `${s.noms[lui]} est prêt : à toi !`
      : pret && !s.prets[lui] ? `En attente de ${s.noms[lui]}…` : 'Choisissez vos joueurs (pas le même), puis « Prêt ! ».';
  if (!autoChoix && !s.equipes[moi] && s.equipes[lui] !== conf.moi) { autoChoix = true; net.choisirEquipe(conf.moi); }
}

function ouvrirEnLigne() {
  let nom = '';
  try { nom = localStorage.getItem(CLE_NOM) || localStorage.getItem('crochet.nom') || localStorage.getItem('doublepas.nom') || localStorage.getItem('petitpont.nom') || ''; } catch { /* ignore */ }
  $('enligne-nom').value = nom || succes.pseudo() || '';
  $('enligne-accueil').classList.toggle('cache', !!net.salle.code);
  $('enligne-salle').classList.toggle('cache', !net.salle.code);
  aller('enligne');
  const retourAccueil = (texte) => { $('enligne-accueil').classList.remove('cache'); $('enligne-salle').classList.add('cache'); $('enligne-statut').textContent = texte; };
  net.connecter({
    statut: (st) => {
      if (!net.salle.code) $('enligne-statut').textContent = STATUTS[st] || '';
      if (partie?.o.mode === 'enligne' && (st === 'perdu' || st === 'injoignable' || st === 'connexion')) partie.netPerdu = true;
    },
    session: (m) => {
      if (m.repris) { if (partie) partie.netPerdu = false; return; }
      if (partie?.o.mode === 'enligne') { arreterMatch(); net.quitter(); retourAccueil('La connexion a été coupée trop longtemps (ou le serveur a redémarré) : le match est interrompu.'); aller('enligne'); }
      else if (net.salle.code) { net.quitter(); retourAccueil('La connexion a été coupée : la salle est fermée. Crées-en une autre.'); }
    },
    absent: (m) => { if (partie?.o.mode === 'enligne') partie.absent = true; else $('salle-attente').textContent = `${m.nom} a perdu la connexion… on l’attend.`; },
    revenu: (m) => { if (partie) partie.absent = false; else $('salle-attente').textContent = `${m.nom} est de retour.`; },
    salle: (m) => {
      $('enligne-accueil').classList.add('cache');
      $('enligne-salle').classList.remove('cache');
      $('salle-code').textContent = m.code;
      $('enligne-statut').textContent = '';
      autoChoix = false;
      rendreSalon({ n: 0, noms: [nomEnLigne(), null], equipes: [null, null], prets: [false, false] });
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
    },
    debut: (m) => lancerEnLigne(m),
    stade: () => rendreSalon(net.salle.salon || { n: 0, noms: [nomEnLigne(), null], equipes: [null, null], prets: [false, false] }),
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
  const st = lireStade(d.stade);
  lancerMatch({
    joueurs: d.equipes, controles: ['humain', 'humain'], niveaux: [1, 1], format: st.format, surface: st.surface, mode: 'enligne',
    graine: d.graine, local: d.n, noms: d.noms,
    apres: (res, bouton) => {
      const moi = d.n;
      $('fin-titre').textContent = res.vainqueur === moi ? `Victoire contre ${d.noms[1 - moi]} !` : `Défaite contre ${d.noms[1 - moi]}`;
      const b = bouton('Revanche', 'vert grand', () => { net.revanche(); b.disabled = true; $('fin-attente').textContent = 'En attente de ton adversaire…'; });
      bouton('Changer de joueurs', '', () => net.retourSalon());
      bouton('Quitter', '', () => { net.quitter(); aller('menu'); });
    },
    abandon: () => { net.quitter(); aller('menu'); },
  });
  if (partie) net.demarrerSession({ m: partie.m, n: d.n });
}

function brancherEnLigne() {
  $('b-enligne').addEventListener('click', () => { son.reveiller(); ouvrirEnLigne(); });
  $('enligne-retour').addEventListener('click', () => { if (net.salle.code) net.quitter(); aller('menu'); });
  const choixStade = (id, f) => $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || net.salle.n !== 0) return;
    const st = lireStade(net.salle.stade);
    f(st, b.dataset.v);
    conf.surface = st.surface; conf.format = st.format;
    garder();
    net.choisirStade(stadeDe(st.surface, st.format));
  });
  choixStade('salon-surface', (st, v) => { st.surface = v; });
  choixStade('salon-format', (st, v) => { st.format = v; });
  $('enligne-creer').addEventListener('click', () => { net.creer(nomEnLigne(), stadeDe(conf.surface, conf.format)); $('enligne-statut').textContent = 'Création de la salle…'; });
  $('salon-equipes').addEventListener('click', (e) => {
    const b = e.target.closest('.equipe');
    if (!b || b.disabled) return;
    son.bip();
    conf.moi = b.dataset.id;
    garder();
    net.choisirEquipe(b.dataset.id);
  });
  $('salon-pret').addEventListener('click', () => { const s = net.salle.salon; if (!s) return; son.reveiller(); net.pret(!s.prets[s.n]); });
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
  $('attente-quitter').addEventListener('click', () => { arreterMatch(); net.quitter(); enPause = false; aller('menu'); });
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); $('net-diag').classList.toggle('cache'); } });
}

/* ------------------------------------------------------------------ */
/* Les touches, au choix                                               */
/* ------------------------------------------------------------------ */

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

function brancher() {
  saisie.ecouterClavier(basculerPause, touches.table());
  brancherTouches();
  saisie.brancherTactile($('zone-joy'), document.querySelectorAll('.bj'));
  const doigt = () => document.body.classList.add('doigt');
  if (saisie.estTactile()) doigt();
  addEventListener('touchstart', doigt, { once: true, passive: true });
  addEventListener('keydown', () => document.body.classList.remove('doigt'));
  $('b-solo').addEventListener('click', () => { son.reveiller(); ouvrirEquipes(); });
  $('b-tournoi').addEventListener('click', () => { son.reveiller(); ouvrirTournoi(); });
  $('tournoi-retour').addEventListener('click', () => { infoTournoi(); aller('menu'); });
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
brancherEntrainement();
brancherEnLigne();
infoTournoi();

// Pour les essais (dans la console) : window.revers.partie() ; avancer(s) : fait passer s secondes d'un coup.
window.revers = {
  partie: () => partie, lancerMatch, T,
  avancer(s = 1) { let t = partie?.dernier ?? performance.now(); for (let k = 0; k < s * 60 && partie; k++) { t += 1000 / 60; boucle(t); } cancelAnimationFrame(raf); },
  reprendre() { cancelAnimationFrame(raf); if (partie) { partie.dernier = performance.now(); raf = requestAnimationFrame(boucle); } },
};
