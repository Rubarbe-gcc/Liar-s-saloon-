/**
 * DOUBLE PAS — le jeu : le menu, le choix des équipes, le match (la boucle à
 * 60 images par seconde, l'interface par-dessus la 3D), la fin du match.
 *
 * Le match est joué par le moteur partagé (shared/basket/match.js) ; la 3D
 * (trois/rendu3d.js) ne fait que le montrer. Pour l'instant : le match amical
 * contre l'ordinateur (le tournoi et le jeu en ligne viendront ensuite).
 */

import { EQUIPES, EQUIPE, STYLES, POSTES, NOM_POSTE, notesEquipe, noteGenerale, noteJoueur } from '../../../../shared/basket/equipes.js';
import { creerMatch, pas, chronoTexte, reglerEntrainement, FPS, T, CHARGE_IDEALE, CHARGE_MAX } from '../../../../shared/basket/match.js';
import { NIVEAUX } from '../../../../shared/basket/ia.js';
import { creerRendu, qualite, reglerQualite } from './trois/rendu3d.js';
import { SALLES, SALLE } from './trois/salle3d.js';
import { ecussonSVG, tenues } from '../../commun/ecusson.js';
import { creerCinematique } from '../../commun/cinematique.js';
import { intro, miTemps, hommeDuMatch, trophee, meilleurJoueur, detailJoueur } from './cinematiques.js';
import { creerTournoi, matchDuJoueur, salleDuTour, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement, TOURS } from '../../../../shared/basket/tournoi.js';
import * as saisie from '../../commun/saisie.js';
import * as touches from './touches.js';
import * as net from './enligne.js';
import { creerChampionnat, matchDuJoueur as matchDuJoueurChamp, enregistrer as enregistrerChamp, jouerSansMoi as jouerSansMoiChamp, aJouer as aJouerChamp, avancer as avancerChamp, classement as classementChamp, FORMATS as FORMATS_CHAMP } from '../../../../shared/basket/championnat.js';
import { creerLissage } from '../../commun/lissage.js';
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

/** Le choix des équipes : pour un match amical (les deux), ou pour un tournoi (la sienne seulement ; suite : ce qui vient après). */
let choix = { pour: 'moi', survol: null, mode: 'solo', suite: null };

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
  const solo = choix.mode !== 'tournoi' && choix.mode !== 'championnat';
  carteDuel($('duel-moi'), conf.moi, 'Toi');
  carteDuel($('duel-lui'), conf.lui, 'Adversaire');
  $('duel-lui').classList.toggle('cache', !solo);
  document.querySelector('.duel .vs').classList.toggle('cache', !solo);
  $('equipes-titre').textContent = { solo: 'Match amical', tournoi: 'Le Tournoi : ton club', championnat: 'Le Grand Championnat : ton club', entrainement: 'Entraînement : les équipes' }[choix.mode];
  $('b-jouer').querySelector('b').textContent = { solo: 'Entre-deux', tournoi: 'Commencer le tournoi', championnat: 'Commencer le championnat', entrainement: 'C’est parti' }[choix.mode];
  $('opt-format').classList.toggle('cache', choix.mode !== 'championnat');
  $('seg-format').innerHTML = [['simple', 15], ['retour', 30]].map(([v, n]) => `<button data-v="${v}" class="${conf.format === v ? 'oui' : ''}">${FORMATS_CHAMP[v]} · ${n} journées</button>`).join('');
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
      if (choix.mode !== 'tournoi' && choix.mode !== 'championnat') choix.pour = 'lui';
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
    if (choix.suite) { choix.suite(); return; }
    lancerMatch({ equipes: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], minutes: conf.minutes, salle: conf.salle });
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
  return {
    f: m.f,
    phase: m.phase,
    joueurs: m.joueurs.map((p) => ({
      x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, dx: p.dx, dy: p.dy, etat: p.etat, absent: !!p.absent,
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
  const m = creerMatch({ equipes: o.equipes, graine: o.graine ?? Math.floor(Math.random() * 2 ** 31), minutes: o.minutes, controles: o.controles, niveaux: o.niveaux, entrainement: o.entrainement || null });
  aller('match');
  const rendu = creerRendu($('scene'), { salle: o.salle, equipes: eqs, kits });
  if (!rendu) { alert('La 3D n’est pas disponible sur cet appareil.'); aller('menu'); return; }
  partie = { o, m, rendu, eqs, kits, local: o.local ?? 0, lisse: o.mode === 'enligne' ? creerLissage(6) : null, acc: 0, prec: null, cour: instantane(m), finVue: 0, dernier: performance.now(), excit: 0, scoreAffiche: '' };
  for (let e = 0; e < 2; e++) {
    $(`hud-ec${e}`).innerHTML = ecussonSVG(eqs[e], 26);
    $(`hud-abr${e}`).textContent = eqs[e].abr;
  }
  $('tableau-score').classList.toggle('libre', !!o.entrainement);
  $('p-quitter').textContent = o.entrainement ? 'Quitter l’entraînement' : 'Abandonner le match';
  if (o.entrainement) $('hud-score').textContent = 'ENTRAÎNEMENT';
  ecranGeant();
  partie.lieu = LIEUX[o.salle] || '';
  if (!o.entrainement) {
    partie.com = creerCommentateur({ nom: (id) => nomDe(id), equipe: (e) => eqs[e], salle: partie.lieu, el: $('commentaire') });
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
  if (m.entrainement) { partie.rendu.ecran(['DOUBLE PAS', texte || 'ENTRAÎNEMENT']); return; }
  partie.rendu.ecran([`${eqs[0].abr}  ${m.score[0]} - ${m.score[1]}  ${eqs[1].abr}`, texte || 'DOUBLE PAS']);
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
        if (P.o.mode !== 'enligne') cine.lancer(miTemps(P), { passable: true, fin: () => { if (partie?.m.phase === 'pause') partie.m.t = Math.min(partie.m.t, 30); partie?.rendu.camera('tele', true); } });
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
  let vue = melanger(P.prec, P.cour, P.acc / (P.periode || PAS));
  if (P.lisse) vue = P.lisse.appliquer(vue, dt);
  const { h, heros } = humeurs(m);
  if (!cine.actif) P.rendu.camera(m.phase === 'panier' && heros >= 0 && m.t < 80 ? 'panier' : 'tele');
  const eq = m.equipes[P.local];
  const autre = m.equipes[1 - P.local];
  const actifs = [eq.ctrl === 'humain' ? eq.actif : -1, autre.ctrl === 'humain' ? autre.actif : -1];
  P.rendu.afficher({ ...vue, actifs, humeurs: h, heros }, dt);

  // Le tableau d'affichage.
  if (!m.entrainement) {
    const score = `${m.score[0]} - ${m.score[1]}`;
    if (score !== P.scoreAffiche) { $('hud-score').textContent = score; P.scoreAffiche = score; }
    $('hud-chrono').textContent = chronoTexte(m);
    $('hud-mi').textContent = m.enOr ? 'PANIER' : m.periode === 1 ? '1re' : '2e';
  }
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
  if (P.o.mode === 'enligne') attenteReseau(P);
  if (m.phase === 'fin' && P.finVue > 0) {
    P.finVue -= dt;
    // En ligne, on attend que tout soit confirmé : le résultat ne peut plus changer.
    if (P.finVue <= 0 && P.o.mode === 'enligne' && !net.toutConfirme()) P.finVue = 0.05;
    else if (P.finVue <= 0) {
      P.finVue = -1;
      // La finale gagnée : après le joueur du match, le capitaine soulève le trophée.
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
    score: [...m.score], vainqueur: m.vainqueur, enOr: m.enOr, equipes: P.o.equipes,
    paniers: m.paniers.map((p) => ({ ...p, nom: p.j >= 0 ? nomDe(p.j) : '' })),
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

if (!conf.entr) conf.entr = { nous: 3, eux: 3, immobiles: false };

/** L'entraînement : on choisit les équipes, et c'est parti ; les réglages (qui est sur le terrain) sont dans la pause. */
function lancerEntrainement() {
  lancerMatch({
    equipes: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], minutes: 3, salle: conf.salle,
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
  const joueurs = (n) => (n ? `${n} joueur${n > 1 ? 's' : ''}` : 'Personne');
  seg('entr-nous', [1, 2, 3], E.nous, joueurs);
  seg('entr-eux', [0, 1, 2, 3], E.eux, joueurs);
  seg('entr-mode', ['jouent', 'plots'], E.immobiles ? 'plots' : 'jouent', (v) => (v === 'plots' ? 'Immobiles' : 'Jouent'));
  seg('entr-niveau', [0, 1, 2], conf.niveau, (i) => NIVEAUX[i].nom);
  const personne = !E.eux;
  $('entr-bloc-mode').classList.toggle('cache', personne);
  $('entr-bloc-niveau').classList.toggle('cache', personne || E.immobiles);
}

function brancherEntrainement() {
  // Un réglage change : il s'applique tout de suite (l'action repart, le ballon pour nous).
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
/* Le Grand Championnat (shared/basket/championnat.js)                 */
/* ------------------------------------------------------------------ */

const CLE_CHAMP = 'doublepas.championnat';
let champ = null;
let vueChamp = 'classement';
try { champ = JSON.parse(localStorage.getItem(CLE_CHAMP) || 'null'); } catch { /* ignore */ }
if (champ && !champ.journees) champ = null;
const garderChamp = () => { try { if (champ) localStorage.setItem(CLE_CHAMP, JSON.stringify(champ)); else localStorage.removeItem(CLE_CHAMP); } catch { /* ignore */ } };
if (!FORMATS_CHAMP[conf.format]) conf.format = 'simple';

function infoChampionnat() {
  $('championnat-info').textContent = champ && !champ.fini ? `En cours : journée ${champ.journee + 1} sur ${champ.journees.length} avec ${EQUIPE[champ.moi].court}` : 'Les seize clubs, chacun contre tous';
}

function ouvrirChampionnat() {
  if (champ) { vueChamp = 'classement'; rendreChampionnat(); aller('championnat'); return; }
  ouvrirEquipes('championnat', () => {
    champ = creerChampionnat({ moi: conf.moi, graine: Math.floor(Math.random() * 2 ** 31), niveau: conf.niveau, minutes: conf.minutes, salle: conf.salle, format: conf.format });
    garderChamp();
    vueChamp = 'classement';
    rendreChampionnat();
    aller('championnat');
  });
}

/** Les autres matchs de la journée se jouent ; puis la journée suivante. */
function finirJournee() {
  for (const i of aJouerChamp(champ)) jouerSansMoiChamp(champ, i);
  avancerChamp(champ);
  garderChamp();
}

const ligneClub = (id) => { const eq = EQUIPE[id]; return `<span>${ecussonSVG(eq, 20)}<b>${eq.court}</b></span>`; };

function htmlClassement(c) {
  const cl = classementChamp(c);
  return `<div class="poule grand-classement"><h4>Le classement · 2 points la victoire, 1 la défaite</h4>
    <table><thead><tr><th></th><th></th><th>J</th><th>V</th><th>D</th><th>+/-</th><th>Pts</th></tr></thead><tbody>${cl.map((x) => `<tr class="${x.rang === 1 ? 'qualifie' : ''}${x.id === c.moi ? ' toi' : ''}"><td>${x.rang}</td><td class="club">${ligneClub(x.id)}</td><td>${x.j}</td><td>${x.v}</td><td>${x.d}</td><td>${x.diff > 0 ? '+' : ''}${x.diff}</td><td class="pts">${x.pts}</td></tr>`).join('')}</tbody></table></div>`;
}

function htmlJournee(c, k) {
  const j = c.journees[k];
  return `<div class="poule"><h4>Journée ${k + 1} sur ${c.journees.length}</h4><table><tbody>${j.map((r) => {
    const toi = r.a === c.moi || r.b === c.moi;
    const sc = r.score ? `${r.score[0]} - ${r.score[1]}${r.enOr ? ' ★' : ''}` : '–';
    return `<tr class="${toi ? 'toi' : ''}"><td class="club">${ligneClub(r.a)}</td><td class="pts">${sc}</td><td class="club">${ligneClub(r.b)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function rendreChampionnat() {
  const c = champ;
  const m = matchDuJoueurChamp(c);
  const adv = m && (m.a === c.moi ? m.b : m.a);
  const cl = classementChamp(c);
  const moi = cl.find((x) => x.id === c.moi);
  $('championnat-texte').textContent = c.fini
    ? (c.champion === c.moi ? `🏆 ${EQUIPE[c.moi].nom} est champion avec ${moi.pts} points !` : `🏆 ${EQUIPE[c.champion].nom} est champion. ${EQUIPE[c.moi].court} finit ${moi.rang === 1 ? '1er' : `${moi.rang}e`}.`)
    : `Journée ${c.journee + 1} sur ${c.journees.length} · ${EQUIPE[c.moi].court} est ${moi.rang === 1 ? '1er' : `${moi.rang}e`} avec ${moi.pts} points · ${FORMATS_CHAMP[c.format]}`;
  // Les onglets : le classement, la journée en cours, la précédente.
  const onglets = [['classement', 'Le classement'], ['journee', c.fini ? 'La dernière journée' : 'La journée'], ...(c.journee > 0 && !c.fini ? [['avant', 'La précédente']] : [])];
  $('championnat-onglets').innerHTML = onglets.map(([v, l]) => `<button data-v="${v}" class="${vueChamp === v ? 'oui' : ''}">${l}</button>`).join('');
  $('championnat-corps').innerHTML = vueChamp === 'journee' ? htmlJournee(c, c.journee) : vueChamp === 'avant' ? htmlJournee(c, c.journee - 1) : htmlClassement(c);
  const act = $('championnat-actions');
  act.innerHTML = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = txt; el.addEventListener('click', f); act.appendChild(el); };
  if (m) bouton(`<b>Jouer la journée ${c.journee + 1}</b><small>${m.a === c.moi ? 'à domicile' : 'à l’extérieur'}, contre ${EQUIPE[adv].nom}</small>`, 'vert grand', jouerChampionnat);
  bouton('<b>Statistiques</b>', 'bleu', () => montrerStats(c.stats, c.moi, () => { rendreChampionnat(); aller('championnat'); }));
  if (c.fini) bouton('<b>Nouveau championnat</b>', 'vert', () => { champ = null; garderChamp(); ouvrirChampionnat(); });
  else bouton('Abandonner le championnat', 'fin', () => { if (confirm('Abandonner ce championnat ?')) { champ = null; garderChamp(); infoChampionnat(); aller('menu'); } });
  infoChampionnat();
}

function jouerChampionnat() {
  const c = champ, r = matchDuJoueurChamp(c);
  if (!r) return;
  const moiA = r.a === c.moi;
  const adv = moiA ? r.b : r.a;
  const derniere = c.journee + 1 >= c.journees.length;
  const noter = (res) => {
    enregistrerChamp(c, r.i, { score: moiA ? res.score : [res.score[1], res.score[0]], enOr: res.enOr });
    noterStats(c, res.resume);
    finirJournee();
  };
  lancerMatch({
    equipes: [c.moi, adv], controles: ['humain', 'ia'], niveaux: [1, c.niveau], minutes: c.minutes, salle: c.salle,
    apres: (res, bouton) => {
      noter(res);
      const cl = classementChamp(champ), moi = cl.find((x) => x.id === champ.moi);
      $('fin-titre').textContent = champ.fini && champ.champion === champ.moi ? 'Champion !' : res.vainqueur === 0 ? 'Victoire !' : 'Défaite';
      $('fin-attente').textContent = `${derniere ? 'Classement final' : `Après la journée ${champ.journee}`} : ${moi.rang === 1 ? '1er' : `${moi.rang}e`} avec ${moi.pts} points.`;
      bouton('Le classement', 'vert grand', () => { vueChamp = 'classement'; rendreChampionnat(); aller('championnat'); });
      bouton('Menu', '', () => { infoChampionnat(); aller('menu'); });
    },
    // Abandonner un match : défaite 0-20.
    abandon: () => { noter({ score: [0, 20], enOr: false, vainqueur: 1, resume: [] }); rendreChampionnat(); aller('championnat'); },
  });
}

function brancherChampionnat() {
  $('b-championnat').addEventListener('click', () => { son.reveiller(); ouvrirChampionnat(); });
  $('championnat-retour').addEventListener('click', () => { infoChampionnat(); aller('menu'); });
  $('championnat-onglets').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { vueChamp = b.dataset.v; rendreChampionnat(); } });
  $('seg-format').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { conf.format = b.dataset.v; garder(); rendreEquipes(); } });
}

/* ------------------------------------------------------------------ */
/* Le Tournoi                                                          */
/* ------------------------------------------------------------------ */

const CLE_TOURNOI = 'doublepas.tournoi';
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
    tournoi = creerTournoi({ moi: conf.moi, graine: Math.floor(Math.random() * 2 ** 31), niveau: conf.niveau, minutes: conf.minutes, salle: conf.salle });
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
      // ★ : gagné au panier en or.
      const sa = fini ? `${r.score[0]}${r.enOr && r.v === r.a ? ' ★' : ''}` : '', sb = fini ? `${r.score[1]}${r.enOr && r.v === r.b ? ' ★' : ''}` : '';
      const joueur = r.a === c.moi || r.b === c.moi;
      return `<div class="rencontre${joueur ? ' joueur' : ''}">${ligneTournoi(r.a, sa, fini && r.v !== r.a)}${ligneTournoi(r.b, sb, fini && r.v !== r.b)}</div>`;
    }).join('')}</div>`;
  }
  html += `<div class="tour"><h4>Vainqueur</h4><div class="coupe-trophee">🏆</div>${c.champion ? `<div class="rencontre${c.champion === c.moi ? ' joueur' : ''}">${ligneTournoi(c.champion, '')}</div>` : ''}</div>`;
  $('tableau').innerHTML = html;
  // Le tirage : la première fois, les clubs arrivent un à un dans le tableau.
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
      : `${TOURS[c.tour]} · ${EQUIPE[c.moi].court} contre ${EQUIPE[adv].court} · ${NIVEAUX[c.niveau].nom} · ${SALLE[salleDuTour(c)].nom}`;
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
    equipes: [c.moi, adv], controles: ['humain', 'ia'], niveaux: [1, c.niveau], minutes: c.minutes, salle: salleDuTour(c), finale: c.tour === 2,
    apres: (res, bouton) => {
      noter(res);
      const gagne = res.vainqueur === 0;
      $('fin-titre').textContent = gagne ? (tournoi.fini ? 'Champion !' : 'Qualifié !') : 'Éliminé';
      bouton('Le tableau', 'vert grand', () => { rendreTournoi(); aller('tournoi'); });
      bouton('Menu', '', () => { infoTournoi(); aller('menu'); });
    },
    // Abandonner un match du tournoi : défaite par forfait.
    abandon: () => { noter({ score: [0, 20], enOr: false, vainqueur: 1, resume: [] }); rendreTournoi(); aller('tournoi'); },
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
    bloc('Meilleurs marqueurs', 'pts', 'point', 'Personne n’a encore marqué.'),
    bloc('Meilleurs rebondeurs', 'rebonds', 'rebond', 'Aucun rebond pour l’instant.'),
    bloc('Meilleurs passeurs', 'passes', 'passe décisive', 'Aucune passe décisive pour l’instant.'),
    bloc('Meilleurs intercepteurs', 'vols', 'ballon volé', 'Aucun ballon volé pour l’instant.'),
  ].join('')}</div>`;
  $('stats-retour').onclick = retour;
  aller('stats');
}

/* ------------------------------------------------------------------ */
/* En ligne (un contre un, avec un code : enligne.js, server/basket.js) */
/* ------------------------------------------------------------------ */

const CLE_NOM = 'doublepas.nom';
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
    return `<div class="salon-joueur${n === moi ? ' moi' : ''}${s.prets[n] ? ' pret' : ''}" style="--c1:${eq ? eq.maillot.fond : '#3a2a1a'}">
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

/** La salle du match : c'est l'hôte qui la choisit (le champ « stade » du protocole). */
function rendreSallesEnLigne() {
  const hote = net.salle.n === 0;
  const nomHote = net.salle.salon?.noms?.[0];
  $('salle-stade-bloc').firstElementChild.textContent = hote ? 'La salle (c’est toi qui choisis)' : `La salle (choisie par ${nomHote || 'l’hôte'})`;
  $('salle-stades').innerHTML = SALLES.map((x) => `<button data-id="${x.id}" class="${net.salle.stade === x.id ? 'oui' : ''}"${hote ? '' : ' disabled'}>${x.nom}</button>`).join('');
}

function ouvrirEnLigne() {
  let nom = '';
  try { nom = localStorage.getItem(CLE_NOM) || localStorage.getItem('petitpont.nom') || ''; } catch { /* ignore */ }
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
      rendreSallesEnLigne();
    },
    salon: (m) => {
      $('enligne-accueil').classList.add('cache');
      $('enligne-salle').classList.remove('cache');
      if (net.salle.code) $('salle-code').textContent = net.salle.code;
      if (ecran !== 'enligne' && ecran !== 'match') aller('enligne');
      $('enligne-statut').textContent = '';
      rendreSalon(m);
      rendreSallesEnLigne();
    },
    stade: () => rendreSallesEnLigne(),
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
    equipes: d.equipes, controles: ['humain', 'humain'], niveaux: [1, 1], minutes: 3, salle: SALLE[d.stade] ? d.stade : 'palais', mode: 'enligne',
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
  $('b-enligne').addEventListener('click', () => { son.reveiller(); ouvrirEnLigne(); });
  $('enligne-retour').addEventListener('click', () => { if (net.salle.code) net.quitter(); aller('menu'); });
  $('enligne-creer').addEventListener('click', () => { net.creer(nomEnLigne(), conf.salle); $('enligne-statut').textContent = 'Création de la salle…'; });
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
  $('salle-stades').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && net.salle.n === 0) { conf.salle = b.dataset.id; garder(); net.choisirStade(b.dataset.id); } });
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
brancherChampionnat();
infoChampionnat();

// Pour les essais (dans la console) : window.doublePas.partie()
// avancer(s) : fait passer s secondes d'un coup (quand la page est cachée, l'animation s'arrête).
window.doublePas = {
  partie: () => partie, lancerMatch,
  avancer(s = 1) { let t = partie?.dernier ?? performance.now(); for (let k = 0; k < s * 60 && partie; k++) { t += 1000 / 60; boucle(t); } cancelAnimationFrame(raf); },
};
