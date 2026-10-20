/**
 * CROCHET — la boxe : le menu, le choix des boxeurs, le combat (la boucle à
 * 60 images par seconde, le tableau par-dessus la 3D, le compte au tapis), la
 * fin du combat et les cartes des juges.
 *
 * Le combat est joué par le moteur partagé (shared/boxe/combat.js) ; la 3D
 * (trois/rendu3d.js) ne fait que le montrer.
 */

import { BOXEURS, BOXEUR, STYLES, CATEGORIES, noteGenerale } from '../../../../shared/boxe/boxeurs.js';
import { creerCombat, pas, chronoTexte, effortRelever, reglerEntrainement, FPS, T, SANTE_MAX, ENDU_MAX } from '../../../../shared/boxe/combat.js';
import { creerTournoi, matchDuJoueur, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement, TOURS } from '../../../../shared/boxe/tournoi.js';
import * as net from './enligne.js';
import { creerLissage } from '../../commun/lissage.js';
import { NIVEAUX } from '../../../../shared/boxe/ia.js';
import { creerRendu, qualite, reglerQualite } from './trois/rendu3d.js';
import { creerCinematique } from '../../commun/cinematique.js';
import { intro, annonce, badgeSVG } from './cinematiques.js';
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

const CLE = 'crochet.config';
const conf = { moi: 'ribeyrolles', lui: 'lantenac', niveau: 1, minutes: 2 };
try { Object.assign(conf, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch { /* ignore */ }
if (!BOXEUR[conf.moi]) conf.moi = 'ribeyrolles';
if (!BOXEUR[conf.lui] || conf.lui === conf.moi) conf.lui = BOXEURS.find((x) => x.id !== conf.moi).id;
if (![1, 2, 3].includes(conf.minutes)) conf.minutes = 2;
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(conf)); } catch { /* ignore */ } };

/* ------------------------------------------------------------------ */
/* Le choix des boxeurs                                                */
/* ------------------------------------------------------------------ */

let choix = { pour: 'moi', survol: null, mode: 'solo', suite: null };

function carteDuel(el, id, role) {
  const b = BOXEUR[id];
  el.style.setProperty('--c1', b.couleurs.gants);
  el.innerHTML = `${badgeSVG(b, 56)}<span><span class="role">${role}</span><span class="nom">${b.nom}</span><small>« ${b.surnom} » · ${CATEGORIES[b.categorie]}</small></span>`;
}

const barres = (n, chiffres = false) => `<div class="barres">${[['PUIS', n.puissance], ['VIT', n.vitesse], ['ENDU', n.endurance], ['DÉF', n.defense], ['MENT', n.menton]]
  .map(([k, v]) => `<span>${k}${chiffres ? ` ${v}` : ''}</span><i style="--v:${Math.round(((v - 50) / 50) * 100)}%"></i>`).join('')}</div>`;

function fiche(id) {
  const b = BOXEUR[id];
  $('fiche-club').style.setProperty('--c1', b.couleurs.gants);
  $('fiche-club').innerHTML = `<div class="tete">${badgeSVG(b, 40)}<span><b>${b.nom} · « ${b.surnom} »</b><small>${CATEGORIES[b.categorie]} · ${STYLES[b.style].nom} · ${b.ville} · note ${noteGenerale(b)}</small></span></div>
    <p class="devise">« ${b.devise} »</p>${barres(b.notes, true)}`;
}

function rendreEquipes() {
  const deux = choix.mode !== 'tournoi';
  $('duel-lui').classList.toggle('cache', !deux);
  document.querySelector('.duel .vs').classList.toggle('cache', !deux);
  $('equipes-titre').textContent = { solo: 'Combat', tournoi: 'Le Tournoi : ton boxeur', entrainement: 'Entraînement' }[choix.mode];
  $('b-jouer').querySelector('b').textContent = { solo: 'Sur le ring', tournoi: 'Commencer le tournoi', entrainement: 'C’est parti' }[choix.mode];
  $('seg-duree').parentElement.classList.toggle('cache', choix.mode === 'entrainement');
  carteDuel($('duel-moi'), conf.moi, 'Toi');
  carteDuel($('duel-lui'), conf.lui, 'Adversaire');
  $('duel-moi').classList.toggle('choisit', choix.pour === 'moi');
  $('duel-lui').classList.toggle('choisit', choix.pour === 'lui');
  $('consigne-equipes').textContent = choix.pour === 'moi' ? 'Choisis ton boxeur.' : 'Choisis ton adversaire.';
  $('grille-equipes').innerHTML = Object.entries(CATEGORIES).map(([cat, nom]) => `<h3 class="categorie">${nom}</h3><div class="grille-equipes">${BOXEURS.filter((b) => b.categorie === cat).map((b) => {
    const moi = b.id === conf.moi, lui = deux && b.id === conf.lui;
    return `<button class="equipe${moi ? ' moi' : ''}${lui ? ' lui' : ''}" data-id="${b.id}" style="--c1:${b.couleurs.gants}">
      ${moi ? '<span class="marque">TOI</span>' : lui ? '<span class="marque">ADV</span>' : ''}<span class="note">${noteGenerale(b)}</span>
      ${badgeSVG(b, 56)}<span class="nom">${b.nom}</span><span class="surnom">« ${b.surnom} »</span><span class="style">${STYLES[b.style].nom}</span>${barres(b.notes)}</button>`;
  }).join('')}</div>`).join('');
  fiche(choix.survol || (choix.pour === 'moi' ? conf.moi : conf.lui));
  $('seg-niveau').innerHTML = NIVEAUX.map((n, i) => `<button data-v="${i}" class="${conf.niveau === i ? 'oui' : ''}">${n.nom}</button>`).join('');
  $('seg-duree').innerHTML = [1, 2, 3].map((d) => `<button data-v="${d}" class="${conf.minutes === d ? 'oui' : ''}">3 × ${d} min</button>`).join('');
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
  $('equipes-retour').addEventListener('click', () => aller('menu'));
  $('b-jouer').addEventListener('click', () => {
    son.reveiller();
    if (choix.suite) { choix.suite(); return; }
    lancerCombat({ boxeurs: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], minutes: conf.minutes });
  });
}

function ouvrirEquipes(mode = 'solo', suite = null) {
  choix = { pour: 'moi', survol: null, mode, suite };
  rendreEquipes();
  aller('equipes');
}

/* ------------------------------------------------------------------ */
/* Le combat                                                           */
/* ------------------------------------------------------------------ */

const cine = creerCinematique(document.getElementById('s-match'));
let partie = null;
let enPause = false;
let raf = 0;

/** Ce que la 3D a besoin de savoir d'une image du combat. */
function instantane(m) {
  return {
    f: m.f,
    phase: m.phase,
    boxeurs: m.boxeurs.map((p) => {
      const c = p.coup;
      return {
        x: p.x, y: p.y, vx: p.vx, vy: p.vy, dx: p.dx, dy: p.dy, sol: p.sol, garde: p.garde,
        coup: c ? c.type : null, corps: c ? c.corps : false, phase: c ? c.t / 40 : 0, coupT: c ? c.t : 0,
        esquive: p.esquive > 0 ? p.esquive / 16 : 0, esqCote: p.esquive > 0 ? Math.sign(p.esqX * -p.dy + p.esqY * p.dx) : 0,
        sonne: p.sonne > 0 ? Math.min(1, p.sonne / 12) : 0, etourdi: p.etourdi > 0,
      };
    }),
  };
}
function melanger(a, b, t) {
  if (!a || t >= 1) return b;
  const l = (u, v) => u + (v - u) * t;
  return { ...b, boxeurs: b.boxeurs.map((p, i) => { const q = a.boxeurs[i]; return { ...p, x: l(q.x, p.x), y: l(q.y, p.y) }; }) };
}

/** Lance un combat. o : { boxeurs: [id, id], controles, niveaux, minutes, graine } */
function lancerCombat(o) {
  arreterCombat();
  const boxeurs = o.boxeurs.map((id) => BOXEUR[id]);
  const m = creerCombat({ boxeurs: o.boxeurs, graine: o.graine ?? Math.floor(Math.random() * 2 ** 31), minutes: o.minutes, controles: o.controles, niveaux: o.niveaux, entrainement: o.entrainement || null });
  aller('match');
  const rendu = creerRendu($('scene'), { boxeurs });
  if (!rendu) { alert('La 3D n’est pas disponible sur cet appareil.'); aller('menu'); return; }
  partie = { o, m, rendu, boxeurs, local: o.local ?? 0, lisse: o.mode === 'enligne' ? creerLissage(2) : null, acc: 0, prec: null, cour: instantane(m), finVue: 0, dernier: performance.now(), excit: 0 };
  for (let e = 0; e < 2; e++) {
    $(`hud-badge${e}`).innerHTML = badgeSVG(boxeurs[e], 34);
    $(`hud-nom${e}`).textContent = boxeurs[e].nom.split(' ').slice(-1)[0];
  }
  ecranGeant();
  $('p-quitter').textContent = o.entrainement ? 'Quitter l’entraînement' : 'Abandonner le combat';
  if (!o.entrainement) {
    partie.com = creerCommentateur({ boxeur: (e) => boxeurs[e], el: $('commentaire') });
    cine.lancer(intro(partie), { passable: o.mode !== 'enligne', fin: () => partie?.rendu.camera('tele', true) });
    partie.com.debut();
  }
  enPause = false;
  saisie.siJeuEnCours(() => ecran === 'match' && !enPause);
  son.public_(0.15);
  raf = requestAnimationFrame(boucle);
}

function arreterCombat() {
  cancelAnimationFrame(raf);
  if (partie?.o.mode === 'enligne') net.finirSession();
  $('attente-net').classList.add('cache');
  cine.arreter(false);
  if (partie) { partie.com?.arreter(); partie.rendu.detruire(); partie = null; }
  son.couperPublic();
  $('v-pause').classList.add('cache');
  $('compte').classList.add('cache');
}

function ecranGeant(texte) {
  if (!partie?.rendu.ecran) return;
  const { m, boxeurs } = partie;
  partie.rendu.ecran([`${boxeurs[0].nom.split(' ').slice(-1)[0].toUpperCase()} - ${boxeurs[1].nom.split(' ').slice(-1)[0].toUpperCase()}`, texte || (m.entrainement ? 'ENTRAÎNEMENT' : `ROUND ${m.round}`)]);
}

function boucle(t) {
  if (!partie) return;
  raf = requestAnimationFrame(boucle);
  const P = partie;
  const dt = Math.min(0.1, Math.max(0, (t - P.dernier) / 1000));
  P.dernier = t;
  if (cine.actif) { cine.maj(dt); P.acc = 0; }
  else if (!enPause || P.o.mode === 'enligne') {
    // Le ralenti d'un coup critique : le temps du combat passe trois fois moins vite, un court instant.
    let vitesse = 1;
    if (P.ralenti > 0) { P.ralenti -= dt; vitesse = 0.3; }
    P.acc += dt * vitesse;
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

/** Pour le lissage commun (des « joueurs » et un « ballon ») : les boxeurs, et le milieu entre eux. */
const lisible = (v) => v && ({ joueurs: v.boxeurs, ballon: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 } });

/* ---------------- Ce qui se passe ---------------- */

function bandeau(txt, sous = '', long = false) {
  const b = $('bandeau');
  b.innerHTML = `${txt}${sous ? `<small>${sous}</small>` : ''}`;
  b.classList.remove('montre', 'long');
  void b.offsetWidth;
  b.classList.add('montre');
  b.classList.toggle('long', long);
}

const nomCourt = (e) => partie.boxeurs[e].nom.split(' ').slice(-1)[0];

function reagir(evs) {
  const P = partie, m = P.m;
  if (!evs.length) return;
  P.rendu.evenements(evs, P.cour);
  for (const ev of evs) {
    P.com?.evenement(ev, m);
    switch (ev.type) {
      case 'touche':
        son.arret();
        if (ev.critique) {
          // Le coup critique : un instant au ralenti (pas en ligne : les deux écrans doivent rester à la même heure).
          son.occasion(); son.arret();
          bandeau('Coup critique !', `${partie.boxeurs[ev.boxeur].nom.split(' ').slice(-1)[0]} · ${{ jab: 'jab', crochet: 'crochet', upper: 'uppercut' }[ev.coup]}${ev.corps ? ' au corps' : ''}`);
          if (P.o.mode !== 'enligne') P.ralenti = 0.55;
          P.excit = Math.max(P.excit, 1.1);
        }
        if (ev.degats > 6 || ev.contre) { son.occasion(); P.excit = Math.max(P.excit, 0.7); }
        break;
      case 'bloque': son.controle(); break;
      case 'esquive-reussie': if (ev.boxeur === P.local) bandeau('Esquivé !'); break;
      // Notre coup ne trouve que le vide : on dit pourquoi (trop loin, ou il a paré).
      case 'vide': if (ev.boxeur === P.local && P.o.controles[P.local] === 'humain') bandeau(ev.pare ? 'Paré !' : 'Trop loin !', ev.pare ? '' : 'Rapproche-toi pour toucher'); break;
      case 'cloche':
        son.poteau();
        if (ev.debut) { bandeau(`Round ${ev.round}`); ecranGeant(); } else { setTimeout(() => son.poteau(), 250); setTimeout(() => son.poteau(), 500); }
        break;
      case 'kd': son.but(); bandeau('Au tapis !', partie.boxeurs[ev.boxeur].nom, true); ecranGeant('KNOCK-DOWN'); P.excit = 1.5; break;
      case 'compte': son.bip(ev.n >= 8); break;
      case 'debout': son.acclamation(0.8); bandeau('Il se relève !', `${partie.boxeurs[ev.boxeur].nom}, à ${ev.compte}`); ecranGeant(); break;
      case 'repos': son.acclamation(0.6); bandeau(`Fin du round ${ev.round}`, 'Chacun dans son coin', true); break;
      case 'fin': {
        son.but();
        const titre = { ko: 'K.-O. !', arret: 'Arrêt de l’arbitre !', points: 'Décision des juges' }[ev.issue];
        bandeau(titre, `Victoire de ${partie.boxeurs[ev.vainqueur].nom}`, true);
        ecranGeant(`VICTOIRE ${nomCourt(ev.vainqueur).toUpperCase()}`);
        P.finVue = 3;
        break;
      }
      default:
    }
  }
}

/* ---------------- L'affichage ---------------- */

function afficher(dt) {
  const P = partie, m = P.m;
  P.excit *= Math.pow(0.4, dt);
  P.com?.avancer(dt, m);
  const vueCine = cine.actif ? cine.vue() : null;
  if (vueCine) { P.rendu.afficher(vueCine, dt); return; }
  let vue = melanger(P.prec, P.cour, P.acc / (P.periode || PAS));
  if (P.lisse) { const l = P.lisse.appliquer(lisible(vue), dt); vue = { ...vue, boxeurs: l.joueurs }; }
  const humeurs = m.phase === 'fin' ? m.boxeurs.map((p) => (p.e === m.vainqueur ? 'joie' : null)) : null;
  P.rendu.camera('tele');
  P.rendu.afficher({ ...vue, humeurs }, dt);
  // Le tableau : la santé (et ce qu'il en reste au mieux), le souffle, le round.
  for (const p of m.boxeurs) {
    $(`hud-sante${p.e}`).style.width = `${Math.max(0, p.sante / SANTE_MAX) * 100}%`;
    $(`hud-max${p.e}`).style.width = `${(p.santeMax / SANTE_MAX) * 100}%`;
    $(`hud-endu${p.e}`).style.width = `${(p.endu / ENDU_MAX) * 100}%`;
    $(`hud-sante${p.e}`).parentElement.classList.toggle('bas', p.sante < 25 && !p.sol);
  }
  $('hud-round').textContent = m.entrainement ? 'ENTRAÎNEMENT' : m.phase === 'repos' ? 'REPOS' : `ROUND ${m.round}/${m.rounds}`;
  if (P.o.mode === 'enligne') attenteReseau(P);
  $('hud-chrono').textContent = chronoTexte(m);
  // Le compte : le chiffre, et pour nous, la jauge de ce qu'il faut taper pour se relever.
  const auTapis = m.phase === 'compte';
  $('compte').classList.toggle('cache', !auTapis);
  if (auTapis) {
    const d = m.boxeurs[m.auTapis], nous = d.e === P.local && P.o.controles[P.local] === 'humain';
    $('compte-n').textContent = m.compte || '';
    $('compte').classList.toggle('adverse', !nous);
    $('compte-aide').textContent = nous ? 'Tape vite (jab, crochet, uppercut) pour te relever !' : `${nomCourt(d.e)} est au tapis…`;
    $('compte-effort').style.width = `${Math.min(100, (d.relever / effortRelever(d)) * 100)}%`;
  }
  son.public_(Math.min(1, 0.15 + P.excit * 0.5));
  if (m.phase === 'fin' && P.finVue > 0) {
    P.finVue -= dt;
    if (P.finVue <= 0 && P.o.mode === 'enligne' && !net.toutConfirme()) P.finVue = 0.05;
    else if (P.finVue <= 0) { P.finVue = -1; cine.lancer(annonce(P, m.vainqueur, { ceinture: !!P.o.ceinture }), { passable: true, fin: finDuCombat }); }
  }
}

/* ---------------- La fin ---------------- */

function finDuCombat() {
  const P = partie, m = P.m;
  const res = { resume: resumer(m), boxeurs: P.o.boxeurs, vainqueur: m.vainqueur, issue: m.issue, round: m.round, cartes: m.cartes.map((c) => c.map((s) => [...s])), decision: m.decision, stats: JSON.parse(JSON.stringify(m.stats)), chrono: chronoTexte(m) };
  const o = P.o;
  arreterCombat();
  montrerFin(res, o);
}

function montrerFin(res, o) {
  const bx = res.boxeurs.map((id) => BOXEUR[id]);
  const v = res.vainqueur, local = o.local ?? 0;
  $('fin-titre').textContent = o.controles[local] === 'humain' ? (v === local ? 'Victoire !' : 'Défaite') : `Victoire de ${bx[v].nom}`;
  const issue = { ko: `par K.-O. au round ${res.round}`, arret: `par arrêt de l’arbitre au round ${res.round}`, points: { unanime: 'aux points, à l’unanimité', majorite: 'aux points, à la majorité', partagee: 'aux points, décision partagée', arbitre: 'aux points' }[res.decision?.type] }[res.issue];
  $('fin-score').innerHTML = `<div class="eq">${badgeSVG(bx[0], 64)}<span>${bx[0].nom}</span></div>
    <div class="sc">${{ ko: 'K.-O.', arret: 'Arrêt', points: 'Aux points' }[res.issue]}<span class="tab">${bx[v].nom.split(' ').slice(-1)[0]} ${issue}</span></div>
    <div class="eq">${badgeSVG(bx[1], 64)}<span>${bx[1].nom}</span></div>`;
  $('fin-cartes').innerHTML = res.issue === 'points' ? res.cartes.map((c, j) => {
    const t = c.reduce((a, s) => [a[0] + s[0], a[1] + s[1]], [0, 0]);
    return `<div class="carte-juge"><small>Juge ${j + 1}</small><b>${t[0]} – ${t[1]}</b><small>${c.map((s) => `${s[0]}-${s[1]}`).join(' · ')}</small></div>`;
  }).join('') : '';
  const st = res.stats;
  const ligne = (lib, x, y) => {
    const tot = x + y || 1;
    return `<div class="stat"><span>${x}</span><span class="lib">${lib}</span><span>${y}</span>
      <div class="barre"><i style="width:${(x / tot) * 100}%;background:${bx[0].couleurs.gants}"></i><i style="width:${(y / tot) * 100}%;background:${bx[1].couleurs.gants}"></i></div></div>`;
  };
  const pc = (e) => (st.lances[e] ? Math.round((st.touches[e] / st.lances[e]) * 100) : 0);
  $('fin-stats').innerHTML = ligne('Coups portés', st.touches[0], st.touches[1]) + ligne('Précision (%)', pc(0), pc(1)) + ligne('À la tête', st.tete[0], st.tete[1])
    + ligne('Au corps', st.corps[0], st.corps[1]) + ligne('Coups bloqués', st.bloques[0], st.bloques[1]) + ligne('Esquives', st.esquives[0], st.esquives[1]) + ligne('Contres', st.contres[0], st.contres[1]) + ligne('Coups critiques', st.critiques?.[0] ?? 0, st.critiques?.[1] ?? 0) + ligne('Knock-downs', st.kd[0], st.kd[1]);
  const act = $('fin-actions');
  act.innerHTML = '';
  $('fin-attente').textContent = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = `<b>${txt}</b>`; el.addEventListener('click', f); act.appendChild(el); return el; };
  if (o.apres) o.apres(res, bouton);
  else {
    bouton('Revanche', 'vert grand', () => lancerCombat({ ...o, graine: undefined }));
    bouton('Changer de boxeurs', '', () => ouvrirEquipes());
    bouton('Menu', '', () => aller('menu'));
  }
  aller('fin');
}

/* ------------------------------------------------------------------ */
/* L'entraînement                                                      */
/* ------------------------------------------------------------------ */

if (!conf.entr) conf.entr = { adversaire: 'sac' };

/** L'entraînement : on choisit les boxeurs, et c'est parti ; les réglages sont dans la pause. */
function lancerEntrainement() {
  lancerCombat({ boxeurs: [conf.moi, conf.lui], controles: ['humain', 'ia'], niveaux: [1, conf.niveau], minutes: 2, entrainement: { ...conf.entr, niveau: conf.niveau }, abandon: () => aller('menu') });
}

function rendreReglages() {
  const on = !!partie?.m.entrainement;
  $('p-entr').classList.toggle('cache', !on);
  $('panneau-pause').classList.toggle('large', on);
  if (!on) return;
  const seg = (id, valeurs, actuelle, libelle) => { $(id).innerHTML = valeurs.map((v) => `<button data-v="${v}" class="${String(actuelle) === String(v) ? 'oui' : ''}">${libelle(v)}</button>`).join(''); };
  seg('entr-mode', ['sac', 'sparring', 'combat'], conf.entr.adversaire, (v) => ({ sac: 'Un sac de frappe', sparring: 'Un sparring (il ne frappe pas)', combat: 'Un adversaire' }[v]));
  seg('entr-niveau', [0, 1, 2], conf.niveau, (i) => NIVEAUX[i].nom);
  $('entr-bloc-niveau').classList.toggle('cache', conf.entr.adversaire === 'sac');
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
  choisir('entr-mode', (v) => { conf.entr.adversaire = v; });
  choisir('entr-niveau', (v) => { conf.niveau = +v; });
  $('b-entrainement').addEventListener('click', () => { son.reveiller(); ouvrirEquipes('entrainement', lancerEntrainement); });
}

/* ------------------------------------------------------------------ */
/* Le Tournoi                                                          */
/* ------------------------------------------------------------------ */

const CLE_TOURNOI = 'crochet.tournoi';
let tournoi = null;
try { tournoi = JSON.parse(localStorage.getItem(CLE_TOURNOI) || 'null'); } catch { /* ignore */ }
if (tournoi && !tournoi.tours) tournoi = null;
const garderTournoi = () => { try { if (tournoi) localStorage.setItem(CLE_TOURNOI, JSON.stringify(tournoi)); else localStorage.removeItem(CLE_TOURNOI); } catch { /* ignore */ } };

function infoTournoi() {
  $('tournoi-info').textContent = tournoi && !tournoi.fini && !tournoi.elimine ? `En cours : ${TOURS[tournoi.tour].toLowerCase()} avec ${BOXEUR[tournoi.moi].nom.split(' ').slice(-1)[0]}` : 'Huit boxeurs, la ceinture au bout';
}

function ouvrirTournoi() {
  if (tournoi) { rendreTournoi(); aller('tournoi'); return; }
  ouvrirEquipes('tournoi', () => {
    tournoi = creerTournoi({ moi: conf.moi, graine: Math.floor(Math.random() * 2 ** 31), niveau: conf.niveau, minutes: conf.minutes });
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

/** Comment un combat s'est fini, en deux mots : « K.-O. 2 », « Arrêt 3 », « Points ». */
const issueCourte = (r) => (r.issue === 'ko' ? `K.-O. ${r.round}` : r.issue === 'arret' ? `Arrêt ${r.round}` : 'Points');

function ligneTournoi(id, texte, perd) {
  if (!id) return '<div class="ligne"><span></span><span>?</span><b></b></div>';
  const b = BOXEUR[id];
  return `<div class="ligne${perd ? ' perd' : ''}${id === tournoi.moi ? ' toi' : ''}">${badgeSVG(b, 20)}<span>${b.nom.split(' ').slice(-1)[0]}</span><b>${texte ?? ''}</b></div>`;
}

function rendreTournoi() {
  const c = tournoi;
  let html = '';
  for (let t = 0; t < 3; t++) {
    const tour = c.tours[t] || new Array(4 >> t).fill(null).map(() => ({}));
    html += `<div class="tour"><h4>${TOURS[t]}</h4>${tour.map((r) => {
      const fini = !!r.v;
      const joueur = r.a === c.moi || r.b === c.moi;
      return `<div class="rencontre${joueur ? ' joueur' : ''}">${ligneTournoi(r.a, fini && r.v === r.a ? issueCourte(r) : '', fini && r.v !== r.a)}${ligneTournoi(r.b, fini && r.v === r.b ? issueCourte(r) : '', fini && r.v !== r.b)}</div>`;
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
    ? (c.champion === c.moi ? `${BOXEUR[c.moi].nom} remporte la ceinture !` : `${BOXEUR[c.champion].nom} remporte la ceinture.`)
    : c.elimine ? `${BOXEUR[c.moi].nom} est éliminé. Le Tournoi continue sans toi.`
      : `${TOURS[c.tour]} · ${BOXEUR[c.moi].nom} contre ${BOXEUR[adv].nom} · ${NIVEAUX[c.niveau].nom} · 3 × ${c.minutes} min`;
  const act = $('tournoi-actions');
  act.innerHTML = '';
  const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = txt; el.addEventListener('click', f); act.appendChild(el); };
  bouton('<b>Statistiques</b>', 'bleu', () => montrerStats(c.stats, c.moi, () => { rendreTournoi(); aller('tournoi'); }));
  if (m) bouton(`<b>Combattre ${c.tour === 2 ? 'en finale' : c.tour === 1 ? 'en demie' : 'en quart'}</b><small>contre ${BOXEUR[adv].nom}</small>`, 'vert grand', jouerTournoi);
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
    enregistrer(c, r.i, { issue: res.issue, round: res.round, vainqueur: moiA ? res.vainqueur : 1 - res.vainqueur });
    noterStats(c, res.resume);
    finirTour();
  };
  lancerCombat({
    boxeurs: [c.moi, adv], controles: ['humain', 'ia'], niveaux: [1, c.niveau], minutes: c.minutes, ceinture: c.tour === 2,
    apres: (res, bouton) => {
      noter(res);
      const gagne = res.vainqueur === 0;
      $('fin-titre').textContent = gagne ? (tournoi.fini ? 'Champion !' : 'Qualifié !') : 'Éliminé';
      bouton('Le tableau', 'vert grand', () => { rendreTournoi(); aller('tournoi'); });
      bouton('Menu', '', () => { infoTournoi(); aller('menu'); });
    },
    // Abandonner un combat du tournoi : défaite par arrêt.
    abandon: () => { noter({ issue: 'arret', round: 1, vainqueur: 1, resume: [] }); rendreTournoi(); aller('tournoi'); },
  });
}

/* ---------------- Les statistiques du tournoi ---------------- */

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
function montrerStats(stats, moi, retour) {
  const ligne = (x, valeur, detail) => {
    const b = BOXEUR[x.id];
    return `<li class="ligne-stat${x.id === moi ? ' toi' : ''}"><span class="rg">${x.rang}</span>${badgeSVG(b, 26)}<span class="qui"><b>${b.nom}</b><small>« ${b.surnom} »</small></span><span class="val">${valeur}<small>${detail}</small></span></li>`;
  };
  const bloc = (titre, cle, mot, vide) => {
    const l = classement(stats, cle);
    return `<section class="classement-stat"><h3>${titre}</h3>${l.length ? `<ol>${l.map((x) => ligne(x, pluriel(x[cle], mot), pluriel(x.combats, 'combat'))).join('')}</ol>` : `<p class="vide">${vide}</p>`}</section>`;
  };
  $('stats-corps').innerHTML = `<div class="stats-grille">${[
    bloc('Coups portés', 'touches', 'coup', 'Aucun combat pour l’instant.'),
    bloc('Knock-downs', 'kd', 'knock-down', 'Personne n’est encore allé au tapis.'),
    bloc('Victoires avant la limite', 'avantLimite', 'victoire', 'Aucune victoire par K.-O. pour l’instant.'),
  ].join('')}</div>`;
  $('stats-retour').onclick = retour;
  aller('stats');
}

/* ------------------------------------------------------------------ */
/* En ligne (un contre un, avec un code : enligne.js, server/boxe.js)  */
/* ------------------------------------------------------------------ */

const CLE_NOM = 'crochet.nom';
const STATUTS = { connexion: 'Connexion au serveur…', connecte: 'Connecté ! Crée une salle, ou rejoins celle d’un ami avec son code.', perdu: 'Connexion perdue. Nouvelle tentative…', injoignable: 'Le serveur ne répond pas. On réessaie…' };

function nomEnLigne() {
  const n = $('enligne-nom').value.trim() || succes.pseudo() || 'Joueur';
  try { localStorage.setItem(CLE_NOM, n); } catch { /* ignore */ }
  return n;
}

function attenteReseau(P) {
  const nomAdv = P.o.noms?.[1 - P.local] || 'Ton adversaire';
  const raison = P.netPerdu ? ['Connexion perdue', 'Reconnexion en cours… le combat reprend tout seul.']
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
    const b = s.equipes[n] && BOXEUR[s.equipes[n]];
    const nom = s.noms[n] || '…';
    return `<div class="salon-joueur${n === moi ? ' moi' : ''}${s.prets[n] ? ' pret' : ''}" style="--c1:${b ? b.couleurs.gants : '#3a1a1a'}">
      ${b ? badgeSVG(b, 40) : '<span class="ec-vide">?</span>'}
      <span><small>${n === moi ? 'Toi' : 'Adversaire'}</small><b>${nom}</b><i>${b ? b.nom : present || n === moi ? 'choisit son boxeur…' : 'pas encore là'}</i></span>
      <em>${s.prets[n] ? '✓ Prêt' : ''}</em></div>`;
  };
  $('salon-joueurs').innerHTML = carte(moi) + carte(lui);
  $('salon-equipes').innerHTML = BOXEURS.map((b) => {
    const a = s.equipes[moi] === b.id, pris = s.equipes[lui] === b.id;
    return `<button class="equipe${a ? ' moi' : ''}${pris ? ' lui pris' : ''}" data-id="${b.id}" style="--c1:${b.couleurs.gants}"${pris ? ' disabled' : ''}>
      ${a ? '<span class="marque">TOI</span>' : pris ? `<span class="marque">${s.noms[lui]}</span>` : ''}<span class="note">${noteGenerale(b)}</span>
      ${badgeSVG(b, 46)}<span class="nom">${b.nom}</span><span class="style">${CATEGORIES[b.categorie]} · ${STYLES[b.style].nom}</span></button>`;
  }).join('');
  const pret = s.prets[moi];
  $('salon-pret').innerHTML = pret ? '<b>Pas encore prêt</b><small>Changer d’avis</small>' : '<b>Prêt !</b><small>Le combat part quand vous l’êtes tous les deux</small>';
  $('salon-pret').className = `btn grand ${pret ? '' : 'vert'}`;
  $('salon-pret').disabled = !s.equipes[moi] || !present;
  $('salle-attente').textContent = !present ? 'En attente d’un adversaire… Donne-lui ce code.'
    : s.prets[lui] && !pret ? `${s.noms[lui]} est prêt : à toi !`
      : pret && !s.prets[lui] ? `En attente de ${s.noms[lui]}…` : 'Choisissez vos boxeurs (pas le même), puis « Prêt ! ».';
  if (!autoChoix && !s.equipes[moi] && s.equipes[lui] !== conf.moi) { autoChoix = true; net.choisirEquipe(conf.moi); }
}

function ouvrirEnLigne() {
  let nom = '';
  try { nom = localStorage.getItem(CLE_NOM) || localStorage.getItem('doublepas.nom') || localStorage.getItem('petitpont.nom') || ''; } catch { /* ignore */ }
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
      if (partie?.o.mode === 'enligne') { arreterCombat(); net.quitter(); retourAccueil('La connexion a été coupée trop longtemps (ou le serveur a redémarré) : le combat est interrompu.'); aller('enligne'); }
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
      if (ecran !== 'enligne' && ecran !== 'match') aller('enligne');
      $('enligne-statut').textContent = '';
      rendreSalon(m);
    },
    debut: (m) => lancerEnLigne(m),
    revanche: (m) => { if (ecran === 'fin' && m.n !== net.salle.n) $('fin-attente').textContent = 'Ton adversaire veut sa revanche !'; },
    parti: () => {
      const enMatch = partie?.o.mode === 'enligne';
      if (enMatch) arreterCombat();
      if (enMatch || ecran === 'fin' || ecran === 'enligne') { retourAccueil('Ton adversaire a quitté le combat.'); aller('enligne'); }
    },
    erreur: (msg) => { $('enligne-statut').textContent = msg; },
  });
}

function lancerEnLigne(d) {
  son.reveiller();
  $('fin-attente').textContent = '';
  lancerCombat({
    boxeurs: d.equipes, controles: ['humain', 'humain'], niveaux: [1, 1], minutes: 2, mode: 'enligne',
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
  $('enligne-creer').addEventListener('click', () => { net.creer(nomEnLigne(), 'ring'); $('enligne-statut').textContent = 'Création de la salle…'; });
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
  $('attente-quitter').addEventListener('click', () => { arreterCombat(); net.quitter(); enPause = false; aller('menu'); });
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
  // LB (manette) : l'esquive aussi.
  saisie.ecouterClavier(basculerPause, touches.table(), T.S);
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
    arreterCombat();
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

// Pour les essais (dans la console) : window.crochet.partie() ; avancer(s) : fait passer s secondes d'un coup.
window.crochet = {
  partie: () => partie, lancerCombat,
  avancer(s = 1) { let t = partie?.dernier ?? performance.now(); for (let k = 0; k < s * 60 && partie; k++) { t += 1000 / 60; boucle(t); } cancelAnimationFrame(raf); },
  reprendre() { cancelAnimationFrame(raf); if (partie) { partie.dernier = performance.now(); raf = requestAnimationFrame(boucle); } },
};
