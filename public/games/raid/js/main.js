/**
 * RAID — les écrans de l'aventure.
 *
 * Ce module tient la navigation, la carte, les étapes (butin, dons,
 * événements, marchand, feu de camp…), la fiche du groupe et la sauvegarde.
 * Il ne décide de rien : toutes les règles vivent dans `shared/raid/`, et le
 * combat a son propre écran (`combat.js`).
 */

import * as A from '../../../shared/raid/aventure.js';
import { PAR_ID } from '../../../shared/raid/heros.js';
import {
  creerPersonnage, statsDe, progressionNiveau, SEUILS_XP, NIVEAU_MAX, NIVEAU_ULTIME, sortsDe, DEPARTS,
} from '../../../shared/raid/personnages.js';
import { valeurPiece, EMPLACEMENTS } from '../../../shared/raid/equipement.js';
import { TYPES, ACTES, RANGEES, COLONNES } from '../../../shared/raid/carte.js';
import { OBJETS } from '../../../shared/raid/bataille.js';
import { spriteSvg } from '../../../shared/raid/sprites.js';
import { lancerCombat, basculerAuto } from './combat.js';
import { jouerCinematique } from './cinematique.js';
import { versCode, depuisCode } from './transfert.js';
import { scenesIntro, scenesBoss, scenesFin, scenesChapitre, CHAPITRES, artBoss } from './histoire.js';
import { MODELES_PAR_ID } from '../../../shared/raid/ennemis.js';
import { EVEILS, texteEveil, COUT_EVEIL, eveilDe } from '../../../shared/raid/eveils.js';
import { rendreRegles } from './regles.js';
import { sfx, basculer as basculerSon, estActif as sonActif, debloquer } from './sfx.js';
import { installerMusique } from '../../../shared/musique.js';
import {
  txt, pc, teinte, nomEcole, nomRole, texteSort, cartePiece, couleurRarete, carteRelique, ligneEveil,
} from './textes.js';
import {
  ARBRES, RANG_MAX, rangDe, pointsLibres, peutApprendre, apprendre, texteTalent,
} from '../../../shared/raid/talents.js';

const $ = (id) => document.getElementById(id);
const CLE = 'raid.aventure';

let av = null;        // l'aventure en cours
/**
 * La progression : jusqu'où l'histoire a été lue, toutes aventures confondues.
 * C'est elle qui débloque les chapitres.
 */
const CLE_PROGRES = 'raid.progression';
const progres = { max: 1, fini: false };
try { Object.assign(progres, JSON.parse(localStorage.getItem(CLE_PROGRES) || '{}')); } catch { /* première fois */ }
progres.max = Math.max(1, Math.min(ACTES.length, progres.max | 0));
function noterProgres() {
  if (!av) return;
  const avant = JSON.stringify(progres);
  progres.max = Math.max(progres.max, av.acte);
  if (av.victoire) progres.fini = true;
  if (JSON.stringify(progres) !== avant) {
    try { localStorage.setItem(CLE_PROGRES, JSON.stringify(progres)); } catch { /* ignore */ }
  }
}
let chapitreDepart = 1;   // chapitre où commencera la prochaine aventure

let finJouee = false;   // la cinématique de fin ne passe qu'une fois
let depart = DEPARTS[0];
let difficulte = 'normal';
try { difficulte = localStorage.getItem('raid.difficulte') || 'normal'; } catch { /* ignore */ }
if (!A.DIFFICULTES[difficulte]) difficulte = 'normal';
const COULEUR_DIFF = { facile: '#7fc95c', normal: '#e8c060', difficile: '#ff8a3d', hardcore: '#e04b48' };

/* ------------------------------------------------------------------ */
/* Sauvegarde                                                          */
/* ------------------------------------------------------------------ */

function sauver() {
  try {
    if (!av || av.termine) localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, JSON.stringify(av));
  } catch { /* stockage plein ou interdit : on joue quand même */ }
}

function charger() {
  try {
    localStorage.removeItem('raid.partie');   // l'ancien raid à six ne se reprend pas
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const x = JSON.parse(brut);
    if (x.version !== 2 || !Array.isArray(x.groupe) || !x.groupe.every((p) => PAR_ID[p.id])) return null;
    return x;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

const RENDUS = {
  menu: rendreMenu,
  choix: rendreChoix,
  carte: rendreCarte,
  groupe: rendreGroupe,
  regles: () => { $('regles').innerHTML = rendreRegles(); },
  chapitres: rendreChapitres,
  transfert: rendreTransfert,
};

function aller(nom) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('is-active', s.id === `s-${nom}`);
  if (RENDUS[nom]) RENDUS[nom]();
  scrollTo(0, 0);
}

let minuteToast = null;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(minuteToast);
  minuteToast = setTimeout(() => { t.hidden = true; }, 3200);
}

/** Montre ce que l'aventure attend : la carte, un combat ou une étape. */
function suite() {
  sauver();
  if (!av) return aller('menu');
  noterProgres();
  const e = av.etape;
  // Un nouveau chapitre s'ouvre : sa cinématique, une seule fois.
  const cle = `chap-${av.acte}`;
  if (!av.termine && !(av.cines || []).includes(cle) && (!e || e.type !== 'combat')) {
    av.cines = [...(av.cines || []), cle];
    sauver();
    const a = ACTES[av.acte - 1];
    jouerCinematique(scenesChapitre(av.acte, a.nom, a.ecole), { sfx }).then(suite);
    return;
  }
  if (!e) return aller('carte');
  if (e.type === 'combat') return combattre();
  if (e.type === 'victoire' && !finJouee) {
    finJouee = true;
    jouerCinematique(scenesFin(av.groupe), { sfx }).then(() => { aller('etape'); rendreEtape(); });
    return;
  }
  aller('etape');
  rendreEtape();
}

/* ------------------------------------------------------------------ */
/* Menu et choix du héros                                              */
/* ------------------------------------------------------------------ */

function rendreMenu() {
  const ok = av && !av.termine;
  $('b-continuer').hidden = !ok;
  if (ok) {
    const h = A.heros(av);
    $('continuer-note').textContent = `${A.difficulteDe(av).glyphe} ${A.difficulteDe(av).nom} · ${h.nom} · niveau ${h.niveau} · chapitre ${av.acte}/${ACTES.length}`
      + (av.groupe.length > 1 ? ` · ${av.groupe.length} dans le groupe` : ' · seul');
  }
  $('b-son').querySelector('.bi').textContent = sonActif() ? '🔊' : '🔇';
  $('chapitres-note').textContent = progres.fini ? 'Histoire terminée · 10/10 débloqués'
    : `${progres.max}/${ACTES.length} débloqué${progres.max > 1 ? 's' : ''}`;
}

function statsHtml(p, bonus = {}) {
  const s = statsDe(p, bonus);
  return `<div class="stats">
    <div class="stat">PV <b>${Math.max(0, Math.round(p.pv))}/${s.pvMax}</b></div>
    <div class="stat">PM <b>${Math.round(p.pm)}/${s.pmMax}</b></div>
    <div class="stat">ATQ <b>${s.atk}</b></div>
    <div class="stat">DEF <b>${s.def}</b></div>
    <div class="stat">VIT <b>${s.vit}</b></div>
    <div class="stat">CRIT <b>+${s.crit} %</b></div>
  </div>`;
}

function sortsHtml(p) {
  const s = sortsDe(PAR_ID[p.id]);
  const ligne = (cle, sort) => {
    const verrou = cle === 'ultime' && p.niveau < NIVEAU_ULTIME;
    return `<div class="sort${verrou ? ' verrou' : ''}"><b>${cle === 'ultime' ? '★ ' : ''}${txt(sort.nom)}</b> · ${sort.cout} PM
      <i>${verrou ? `🔒 S’apprend au niveau ${NIVEAU_ULTIME}. ` : ''}${txt(texteSort(sort))}</i></div>`;
  };
  const ev = eveilDe(p);
  return `<div class="sorts">${ligne('special', s.special)}${ligne('ultime', s.ultime)}${ev ? ligneEveil(ev, texteEveil(ev), COUT_EVEIL) : ''}</div>`;
}

function tetePerso(p, extra = '') {
  return `<div class="fp-tete">
    ${spriteSvg(p)}
    <div>
      <h3>${PAR_ID[p.id].legendaire ? '🌟 ' : ''}${txt(p.nom)}${p.niveau ? ` <small class="tag">niv. ${p.niveau}</small>` : ''}</h3>
      <p>${txt(p.titre)} · ${txt(p.classe)}</p>
      <div class="fp-tags"><span class="tag">${nomRole(p.role)}</span>
        <span class="tag ecole" style="--aff:${teinte(p.ecole)}">${nomEcole(p.ecole)}</span>${PAR_ID[p.id].legendaire ? '<span class="tag legende">Légendaire</span>' : ''}${p.eveil ? '<span class="tag eveil">✦ Éveil</span>' : ''}${extra}</div>
    </div>
  </div>`;
}

const CONSEILS = {
  tank: 'Solide mais lent à tuer : seul, il frappe plus fort. Un départ sûr.',
  dps: 'Frappe fort et tôt, mais encaisse mal. Il faudra vite trouver un soigneur.',
  soigneur: 'Se soigne seul et tient longtemps : seul, il frappe plus fort. Un départ patient.',
};

function rendreChoix() {
  $('departs').innerHTML = DEPARTS.map((id) => {
    const f = PAR_ID[id];
    return `<button class="depart${id === depart ? ' choisi' : ''}" data-id="${id}" style="--aff:${teinte(f.ecole)}">
      ${spriteSvg(f)}<b>${txt(f.nom)}</b><i>${nomRole(f.role)}</i></button>`;
  }).join('');
  for (const el of $('departs').querySelectorAll('.depart')) {
    el.addEventListener('click', () => { sfx.tap(); depart = el.dataset.id; rendreChoix(); });
  }
  const p = creerPersonnage(depart, 1);
  $('fiche-depart').style.setProperty('--aff', teinte(p.ecole));
  $('fiche-depart').innerHTML = `${tetePerso({ ...p, niveau: 0 })}${statsHtml(p)}${sortsHtml(p)}
    <p class="fp-note">${CONSEILS[p.role]}</p>`;

  $('difficultes').innerHTML = Object.entries(A.DIFFICULTES).map(([k, d]) =>
    `<button class="diff${k === difficulte ? ' choisi' : ''}" data-d="${k}" role="radio" aria-checked="${k === difficulte}">
      <span>${d.glyphe}</span>${d.nom}</button>`).join('');
  for (const el of $('difficultes').querySelectorAll('.diff')) {
    el.addEventListener('click', () => {
      sfx.tap();
      difficulte = el.dataset.d;
      try { localStorage.setItem('raid.difficulte', difficulte); } catch { /* ignore */ }
      rendreChoix();
    });
  }
  $('diff-texte').textContent = A.texteDifficulte(difficulte);
  const dc = $('depart-chapitre');
  dc.hidden = chapitreDepart <= 1;
  if (chapitreDepart > 1) {
    dc.innerHTML = `📖 Départ au <b>chapitre ${chapitreDepart} — ${txt(ACTES[chapitreDepart - 1].nom)}</b> : héros au niveau ${A.niveauDuChapitre(chapitreDepart)}, de l’équipement, des reliques, et ${Math.min(3, chapitreDepart - 1)} compagnon${chapitreDepart > 2 ? 's' : ''} à choisir.
      <button class="mini-btn" id="b-chap-1">Repartir du chapitre 1</button>`;
    $('b-chap-1').addEventListener('click', () => { chapitreDepart = 1; rendreChoix(); });
  }
}

/* ------------------------------------------------------------------ */
/* Changer d'appareil                                                  */
/* ------------------------------------------------------------------ */

function rendreTransfert() {
  const ok = av && !av.termine;
  const h = ok ? A.heros(av) : null;
  $('tr-etat').innerHTML = ok
    ? `Partie en cours : <b>${txt(h.nom)}</b>, niveau ${h.niveau}, chapitre ${av.acte}/${ACTES.length}, ${av.groupe.length} dans le groupe.`
    : `Pas de partie en cours sur cet appareil. Le code emportera seulement vos chapitres débloqués (${progres.max}/${ACTES.length}).`;
  $('tr-sortie').hidden = true;
  $('tr-message').textContent = '';
}

/** Le code de ce qui est enregistré ici : la partie en cours et la progression. */
async function codeCourant() {
  const partie = av && !av.termine ? av : { version: 2, vide: true, groupe: [{ id: 'aucun' }] };
  const code = await versCode(partie, progres);
  $('tr-sortie').value = code;
  $('tr-sortie').hidden = false;
  return code;
}

async function chargerCode() {
  const msg = $('tr-message');
  const r = await depuisCode($('tr-entree').value);
  if (!r.ok) { msg.textContent = `⚠ ${r.raison}`; return; }
  const vide = !!r.partie.vide;
  if (!vide && !r.partie.groupe.every((p) => PAR_ID[p.id])) { msg.textContent = '⚠ Ce code vient d’une version du jeu que cet appareil ne connaît pas : rechargez la page, puis réessayez.'; return; }
  if (!vide && av && !av.termine
      && !confirm('Une partie est déjà en cours sur cet appareil. La remplacer par celle du code ?')) return;
  if (r.progression) {
    progres.max = Math.max(progres.max, Math.min(ACTES.length, r.progression.max | 0));
    progres.fini = progres.fini || !!r.progression.fini;
    try { localStorage.setItem(CLE_PROGRES, JSON.stringify(progres)); } catch { /* ignore */ }
  }
  if (!vide) {
    av = r.partie;
    finJouee = false;
    sauver();
  }
  sfx.victoire();
  $('tr-entree').value = '';
  toast(vide ? 'Chapitres débloqués récupérés.' : 'Partie chargée : vous pouvez continuer.');
  aller('menu');
}

/* ------------------------------------------------------------------ */
/* Chapitres                                                           */
/* ------------------------------------------------------------------ */

/**
 * Les dix chapitres, à faire défiler. Un chapitre atteint une fois reste
 * débloqué : on peut relire son histoire, et y recommencer une aventure.
 */
function rendreChapitres() {
  const enCours = av && !av.termine ? av.acte : 0;
  $('chapitres-sous').textContent = progres.fini
    ? 'Histoire terminée. Tous les chapitres sont ouverts.'
    : `${progres.max} chapitre${progres.max > 1 ? 's' : ''} sur ${ACTES.length}. Un chapitre se débloque quand vous l’atteignez.`;
  $('chapitres').innerHTML = ACTES.map((a, i) => {
    const n = i + 1;
    const ouvert = n <= progres.max;
    const fait = progres.fini || n < progres.max;
    const boss = { ...MODELES_PAR_ID[a.boss], modeleId: a.boss, ecole: a.ecoleBoss || a.ecole, rang: 'boss' };
    const etat = n === enCours ? 'En cours' : fait ? 'Terminé' : ouvert ? 'Débloqué' : 'Verrouillé';
    return `<article class="chapitre${ouvert ? '' : ' verrou'}${n === enCours ? ' courant' : ''}" style="--aff:${teinte(a.ecole)}" data-n="${n}">
      <div class="chap-num">Chapitre ${n} <span>${etat}</span></div>
      <div class="chap-art">${ouvert ? artBoss(boss) : '<div class="cine-glyphe">🔒</div>'}</div>
      <h3>${ouvert ? txt(a.nom) : '???'}</h3>
      <p class="chap-boss">${ouvert ? `👑 ${txt(boss.nom)}` : 'Boss inconnu'}</p>
      <p class="chap-resume">${ouvert ? txt(CHAPITRES[i].resume) : 'Atteignez ce chapitre pour le découvrir.'}</p>
      ${ouvert ? `<div class="chap-actions">
        ${n === enCours ? '<button class="btn btn-go btn-wide" data-chap-continuer>Continuer l’aventure</button>' : ''}
        <button class="btn btn-ghost btn-wide" data-chap-revoir="${n}">▶ Revoir la cinématique</button>
        ${n !== enCours ? `<button class="btn btn-ghost btn-wide" data-chap-partir="${n}">Commencer une aventure ici</button>` : ''}
      </div>` : ''}
    </article>`;
  }).join('');
  $('chap-points').innerHTML = ACTES.map((_, i) => `<i class="${i + 1 <= progres.max ? 'ouvert' : ''}"></i>`).join('');

  const zone = $('chapitres');
  for (const el of zone.querySelectorAll('[data-chap-revoir]')) {
    el.addEventListener('click', () => {
      const n = +el.dataset.chapRevoir;
      const a = ACTES[n - 1];
      const boss = { ...MODELES_PAR_ID[a.boss], modeleId: a.boss, ecole: a.ecoleBoss || a.ecole };
      jouerCinematique([...scenesChapitre(n, a.nom, a.ecole), ...scenesBoss(boss, n, a.nom)], { sfx });
    });
  }
  for (const el of zone.querySelectorAll('[data-chap-partir]')) {
    el.addEventListener('click', () => { sfx.clic(); chapitreDepart = +el.dataset.chapPartir; aller('choix'); });
  }
  for (const el of zone.querySelectorAll('[data-chap-continuer]')) {
    el.addEventListener('click', () => { sfx.clic(); suite(); });
  }
  // On s'ouvre sur le chapitre en cours, ou sur le dernier débloqué.
  const cible = zone.querySelector(`[data-n="${enCours || progres.max}"]`);
  if (cible) zone.scrollLeft = cible.offsetLeft - (zone.clientWidth - cible.clientWidth) / 2;
  const points = [...$('chap-points').children];
  const marquer = () => {
    const milieu = zone.scrollLeft + zone.clientWidth / 2;
    let proche = 0, ecart = Infinity;
    [...zone.children].forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - milieu);
      if (d < ecart) { ecart = d; proche = i; }
    });
    points.forEach((p, i) => p.classList.toggle('ici', i === proche));
  };
  zone.onscroll = marquer;
  marquer();
}

/* ------------------------------------------------------------------ */
/* Carte                                                               */
/* ------------------------------------------------------------------ */

function ressources() {
  const i = av.inventaire;
  return `<span title="Or">💰 ${av.or}</span><span title="Potions">🧪 ${i.potion}</span>`
    + `<span title="Élixirs">🔷 ${i.elixir}</span><span title="Plumes de phénix">🪶 ${i.phenix}</span>`
    + `<span title="Chance">🍀 ${av.chance}</span>`;
}

function groupeMini() {
  const bonus = A.bonusDe(av);
  const cases = av.groupe.map((p) => {
    const s = statsDe(p, bonus);
    const v = Math.max(0, p.pv) / s.pvMax;
    return `<div class="mini${p.pv <= 0 ? ' tombe' : ''}" style="--aff:${teinte(p.ecole)}">${spriteSvg(p)}
      <div class="mini-corps"><b>${txt(p.nom)} · ${p.niveau}</b>
        <div class="jauge pv${v < 0.3 ? ' bas' : ''}" style="--v:${v.toFixed(3)}"><i></i></div>
        <div class="jauge pm" style="--v:${(p.pm / s.pmMax).toFixed(3)}"><i></i></div></div></div>`;
  });
  for (const a of av.absents || []) {
    cases.push(`<div class="mini vide absent">🚶 ${txt(a.perso.nom)} · retour dans ${Math.max(1, a.reste)} salle${a.reste > 1 ? 's' : ''}</div>`);
  }
  while (cases.length < A.TAILLE_GROUPE) cases.push('<div class="mini vide">compagnon ?</div>');
  return cases.join('');
}

function rendreCarte() {
  if (!av) return aller('menu');
  const acte = ACTES[av.acte - 1];
  $('acte-nom').textContent = acte.nom;
  $('acte-num').innerHTML = `Chapitre ${av.acte} / ${ACTES.length} · <span class="badge-diff" style="--d:${COULEUR_DIFF[av.difficulte] || COULEUR_DIFF.normal}">${A.difficulteDe(av).glyphe} ${A.difficulteDe(av).nom}</span>`;
  $('ressources').innerHTML = ressources();
  $('groupe-mini').innerHTML = groupeMini();

  const ouvertes = new Set(A.sallesAccessibles(av).map((n) => n.id));
  const vues = new Set(av.visites);
  const pos = (n) => ({
    x: n.type === 'boss' ? 50 : ((n.col + 0.5) / COLONNES) * 100,
    y: 100 - ((n.rangee + 0.5) / (RANGEES + 1)) * 100,
  });
  let lignes = '';
  for (const n of av.carte.noeuds) {
    const a = pos(n);
    for (const id of n.suivants) {
      const m = av.carte.noeuds.find((x) => x.id === id);
      const b = pos(m);
      const i = av.visites.indexOf(n.id);
      const fait = i >= 0 && av.visites[i + 1] === id;
      const ouvert = n.id === av.position && ouvertes.has(id);
      lignes += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${fait ? 'fait' : ouvert ? 'ouvert' : ''}"/>`;
    }
  }
  // Brouillard : on ne sait ce qu'une salle cache qu'en y entrant. Seuls le
  // boss, au sommet, les marchands (leur enseigne se voit de loin) et les
  // salles déjà traversées se montrent.
  const connue = (n) => n.type === 'boss' || n.type === 'marchand' || vues.has(n.id);
  const salles = av.carte.noeuds.map((n) => {
    const p = pos(n);
    const etat = [n.type === 'boss' ? 'boss' : '', vues.has(n.id) ? 'vue' : '',
      n.id === av.position ? 'ici' : '', ouvertes.has(n.id) ? 'ouverte' : '',
      connue(n) ? '' : 'cachee'].join(' ');
    const nom = connue(n) ? TYPES[n.type].nom : 'Porte close';
    return `<span class="socle ${etat}" style="left:${p.x}%;top:${p.y}%"></span>
      <button class="salle ${etat}" data-id="${n.id}" style="left:${p.x}%;top:${p.y}%"
      title="${txt(nom)}" aria-label="${txt(nom)}">${connue(n) ? TYPES[n.type].glyphe : '🚪'}</button>`;
  }).join('');
  $('carte').innerHTML = `<svg class="liens" viewBox="0 0 100 100" preserveAspectRatio="none">${lignes}</svg>${salles}`;
  for (const el of $('carte').querySelectorAll('.salle')) {
    el.addEventListener('click', () => entrerSalle(el.dataset.id));
  }
  $('carte-aide').textContent = av.position
    ? 'Choisissez une porte qui brille. Seuls les marchands 💰 se voient de loin.'
    : `${acte.texte} Choisissez une porte pour commencer.`;
  const libres = av.groupe.reduce((n, p) => n + pointsLibres(p), 0);
  $('groupe-libelle').innerHTML = libres
    ? `Groupe et sac <b class="pastille">${libres} talent${libres > 1 ? 's' : ''}</b>` : 'Groupe et sac';
  const q = av.quete;
  $('quete-titre').textContent = q ? `${A.QUETES_PAR_ID[q.id].glyphe} ${A.QUETES_PAR_ID[q.id].nom} — ${q.progres}/${q.but}` : 'Quêtes';
  $('quete-note').textContent = q ? A.texteQuete(q)
    : (av.offresQuetes || []).length ? `${av.offresQuetes.length} quête${av.offresQuetes.length > 1 ? 's' : ''} proposée${av.offresQuetes.length > 1 ? 's' : ''} pour cet acte` : 'Rien à faire ici pour l’instant';
  $('legende').innerHTML = '<span>🚪 Porte close</span>' + Object.values(TYPES).map((t) => `<span>${t.glyphe} ${t.nom}</span>`).join('');
}

function entrerSalle(id) {
  const n = av.carte.noeuds.find((x) => x.id === id);
  if (!A.sallesAccessibles(av).some((x) => x.id === id)) {
    const connue = n && (n.type === 'boss' || n.type === 'marchand' || av.visites.includes(n.id));
    if (n) toast(connue ? `${TYPES[n.type].nom} — ${TYPES[n.type].texte}` : 'Porte close : il faut la pousser pour savoir.');
    return;
  }
  debloquer();
  sfx.clic();
  A.entrer(av, id);
  suite();
}

/* ------------------------------------------------------------------ */
/* Combat                                                              */
/* ------------------------------------------------------------------ */

function combattre() {
  const e = av.etape;
  // Chaque boss a droit à son entrée — une seule fois : on ne la rejoue pas
  // après une défaite.
  const cle = `boss-${av.acte}`;
  if (e.salle === 'boss' && !(av.cines || []).includes(cle)) {
    av.cines = [...(av.cines || []), cle];
    sauver();
    const boss = e.ennemis.find((x) => x.rang === 'boss') || e.ennemis[0];
    jouerCinematique(scenesBoss(boss, av.acte, ACTES[av.acte - 1].nom), { sfx }).then(combattre);
    return;
  }
  aller('combat');
  const menaces = e.salle === 'boss' ? A.menacesDuBoss(av) : null;
  let intro = e.salle === 'boss' ? `👑 <b>${txt(e.ennemis[0].nom)}</b>, maître de l’acte, vous attend.`
    : e.salle === 'elite' ? `💀 Un adversaire redoutable : <b>${txt(e.ennemis[0].nom)}</b>.`
      : e.salle === 'embuscade' ? '⚠ <b>Embuscade !</b> Les monstres vous attendaient : ils frappent les premiers.'
        : e.salle === 'chasse' ? `Vous débusquez des monstres dans ${txt(ACTES[(e.acte || av.acte) - 1].nom)}.`
          : 'Des monstres surgissent !';
  if (menaces && menaces.sources.length) intro += ' Vos choix l’ont marqué.';
  if (e.salle === 'boss' && A.blessuresBoss(av)) intro += ` Il porte encore les blessures de votre dernier assaut (−${pc(A.blessuresBoss(av))} de vie).`;
  if (A.bonusSolo(av)) intro += ` Seul contre tous : +${pc(A.bonusSolo(av))} de dégâts.`;
  lancerCombat(A.bataillePour(av), {
    intro: `<span>${intro}</span>`,
    dernier: e.salle === 'boss' && av.acte === ACTES.length,
    sfx,
    toast,
    surFin: (victoire) => {
      A.conclureCombat(av, victoire);
      suite();
    },
  });
}

/* ------------------------------------------------------------------ */
/* Étapes                                                              */
/* ------------------------------------------------------------------ */

const tete = (glyphe, titre, texte = '') =>
  `<div class="et-tete"><div class="et-glyphe">${glyphe}</div><h2>${titre}</h2>${texte ? `<p>${texte}</p>` : ''}</div>`;

/** Boutons « équiper sur … » pour une pièce du sac. */
function boutonsEquiper(it) {
  return av.groupe.map((p, idx) => {
    const d = Math.round(valeurPiece(it) - valeurPiece(p.equip[it.emplacement]));
    return `<button class="mini-btn ${d > 0 ? 'mieux' : 'moins'}" data-equiper="${it.uid}" data-idx="${idx}">
      ${txt(p.nom)} ${d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '='}</button>`;
  }).join('');
}

function brancherEquiper(racine, apres) {
  for (const el of racine.querySelectorAll('[data-equiper]')) {
    el.addEventListener('click', () => {
      const r = A.equiper(av, +el.dataset.idx, el.dataset.equiper);
      if (r.ok) { sfx.garde(); toast(`${av.groupe[+el.dataset.idx].nom} s’équipe.`); }
      sauver();
      apres();
    });
  }
}

function rendreEtape() {
  const e = av.etape;
  const zone = $('etape');
  const rendus = {
    recompense: etapeRecompense,
    don: etapeDon,
    evenement: etapeEvenement,
    resultat: etapeResultat,
    marchand: etapeMarchand,
    repos: etapeRepos,
    tresor: etapeTresor,
    compagnon: etapeCompagnon,
    defaite: etapeDefaite,
    balade: etapeBalade,
    depart: etapeDepart,
    quetes: etapeQuetes,
    victoire: etapeVictoire,
  };
  zone.innerHTML = rendus[e.type] ? rendus[e.type](e) : '';
  const clic = (sel, f) => { for (const el of zone.querySelectorAll(sel)) el.addEventListener('click', () => { sfx.clic(); f(el); }); };

  switch (e.type) {
    case 'recompense':
      clic('[data-prendre]', (el) => {
        const idx = el.dataset.idx;
        const uid = el.dataset.prendre;
        A.prendreRecompense(av, uid);
        sfx.butin();
        if (idx !== undefined && idx !== '') A.equiper(av, +idx, uid);
        toast(idx ? `${av.groupe[+idx].nom} s’équipe.` : 'Rangé dans le sac.');
        suite();
      });
      clic('#b-rien', () => { A.prendreRecompense(av, null); suite(); });
      break;
    case 'don':
      clic('[data-don]', (el) => { A.choisirDon(av, el.dataset.don); sfx.butin(); suite(); });
      break;
    case 'evenement':
      clic('[data-choix]', (el) => { A.choisirEvenement(av, el.dataset.choix); suite(); });
      break;
    case 'resultat':
      brancherEquiper(zone, rendreEtape);
      clic('#b-suite', () => { A.terminerEtape(av); suite(); });
      break;
    case 'marchand':
      clic('[data-acheter]', (el) => {
        const r = A.acheter(av, el.dataset.acheter);
        if (r.ok) sfx.butin(); else toast('Pas assez d’or.');
        sauver();
        rendreEtape();
      });
      clic('[data-vendre]', (el) => { A.vendre(av, el.dataset.vendre); sfx.clic(); sauver(); rendreEtape(); });
      brancherEquiper(zone, rendreEtape);
      clic('#b-suite', () => { A.terminerEtape(av); suite(); });
      break;
    case 'repos':
      clic('[data-repos]', (el) => { A.faireRepos(av, el.dataset.repos); sfx.soin(); suite(); });
      break;
    case 'tresor':
      clic('#b-ouvrir', () => { A.prendreTresor(av); sfx.butin(); suite(); });
      break;
    case 'compagnon':
      clic('[data-recruter]', (el) => {
        const r = A.recruter(av, el.dataset.recruter, el.dataset.remplace ? +el.dataset.remplace : null);
        if (r.ok) sfx.victoire();
        suite();
      });
      clic('#b-suite', () => { A.terminerEtape(av); suite(); });
      break;
    case 'defaite':
      clic('#b-reprendre', () => { A.reprendre(av); suite(); });
      clic('#b-fin-hardcore', () => { av = null; sauver(); aller('choix'); });
      break;
    case 'depart':
      clic('[data-depart]', (el) => { A.choisirDepart(av, el.dataset.depart); suite(); });
      break;
    case 'quetes':
      clic('[data-quete]', (el) => {
        const r = A.accepterQuete(av, el.dataset.quete);
        if (r.ok) { sfx.butin(); toast('Quête acceptée.'); } else toast(r.raison || 'Impossible.');
        sauver();
        rendreEtape();
      });
      clic('#b-suite', () => { A.terminerEtape(av); suite(); });
      break;
    case 'balade':
      clic('[data-zone]', (el) => { A.choisirZone(av, +el.dataset.zone); sauver(); rendreEtape(); });
      clic('#b-chasser', () => {
        const r = A.chasser(av);
        if (r.embuscade) { sfx.charge(); toast('⚠ Embuscade !'); }
        if (r.marchand) { sfx.butin(); toast('🛒 Un marchand ambulant croise votre route.'); }
        suite();
      });
      clic('#b-suite', () => { A.terminerEtape(av); suite(); });
      break;
    case 'victoire':
      clic('#b-nouvelle', () => { av = null; sauver(); aller('choix'); });
      clic('#b-menu', () => { av = null; sauver(); aller('menu'); });
      break;
    default: break;
  }
}

function etapeRecompense(e) {
  const titre = e.salle === 'boss' ? 'Le maître de l’acte est tombé !' : e.salle === 'elite' ? 'L’élite est vaincue !'
    : e.salle === 'embuscade' ? 'Embuscade repoussée !' : 'Victoire !';
  const gains = e.xp.map((g) => {
    const p = av.groupe.find((x) => x.id === g.id);
    const monte = g.apres > g.avant
      ? `<span class="monte">Niveau ${g.apres} !${g.apprend ? ` Ultime appris : ${txt(sortsDe(PAR_ID[g.id]).ultime.nom)}` : ''}</span>` : '';
    const prog = p.niveau >= NIVEAU_MAX ? 1 : progressionNiveau(p.xp);
    return `<div class="gain" style="--aff:${teinte(p.ecole)}">${spriteSvg(p)}
      <div><span><b>${txt(p.nom)}</b> +${g.gain} XP ${monte}</span>
      <div class="jauge xp" style="--v:${prog.toFixed(3)}"><i></i></div></div></div>`;
  }).join('');
  const pieces = e.pieces.map((it) => {
    const conseil = A.conseilEquipement(av, it);
    const actions = av.groupe.map((p, idx) => {
      const d = Math.round(valeurPiece(it) - valeurPiece(p.equip[it.emplacement]));
      return `<button class="mini-btn ${d > 0 ? 'mieux' : 'moins'}" data-prendre="${it.uid}" data-idx="${idx}">
        Équiper · ${txt(p.nom)} ${d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '='}</button>`;
    }).join('') + `<button class="mini-btn" data-prendre="${it.uid}" data-idx="">Au sac</button>`;
    return cartePiece(it, { actions, note: conseil !== null ? `idéal pour ${av.groupe[conseil].nom}` : '' });
  }).join('');
  return tete(e.salle === 'boss' ? '👑' : '🏆', titre)
    + `<div class="et-effet">+${e.or} pièces d’or</div>`
    + `<div class="gains">${gains}</div>`
    + (e.relique ? `<h3 class="section">Relique du boss</h3><div class="et-liste">${carteRelique(A.RELIQUES_PAR_ID[e.relique])}</div>` : '')
    + (e.pieces.length ? `<h3 class="section">Butin — une pièce au choix</h3><div class="et-liste">${pieces}</div>` : '')
    + `<button class="btn ${e.pieces.length ? 'btn-ghost' : 'btn-go'} btn-wide" id="b-rien">${e.pieces.length ? 'Ne rien prendre' : 'Continuer'}</button>`;
}

function etapeDon(e) {
  return tete('✨', 'Un don', `${txt(A.heros(av).nom)} gagne en expérience : choisissez un don. Il vaut pour tout le groupe, jusqu’au bout de l’aventure.`)
    + `<div class="et-liste">${e.choix.map((d) => `<button class="choix" data-don="${d.id}">
      <b>${d.glyphe} ${txt(d.nom)}</b><i>${txt(A.texteDon(d))}</i></button>`).join('')}</div>`;
}

function etapeEvenement() {
  const ev = A.evenementCourant(av);
  const choix = ev.choix.map((c) => {
    const exige = !c.possible && c.exige
      ? ` — il faut ${c.exige.or ? `${c.exige.or} or` : `${c.exige.objets} potion`}` : '';
    const chance = c.chance !== null ? ` <span class="pc">(${pc(c.chance)} de réussite)</span>` : '';
    return `<button class="choix" data-choix="${c.id}" ${c.possible ? '' : 'disabled'}>
      <b>${txt(c.label)}${chance}</b><i>${txt(c.annonce)}${txt(exige)}</i></button>`;
  }).join('');
  return tete(ev.glyphe, txt(ev.titre), txt(ev.texte))
    + `<div class="et-liste">${choix}</div>`
    + `<p class="carte-aide">🍀 Votre chance (${av.chance}) augmente les réussites.</p>`;
}

function etapeResultat(e) {
  const titre = e.reussi === true ? `${txt(e.titre)} — réussite` : e.reussi === false ? `${txt(e.titre)} — échec` : txt(e.titre);
  const it = e.piece && av.sac.find((x) => x.uid === e.piece.uid);
  return tete(e.glyphe, titre, txt(e.dit))
    + (e.effet && e.effet !== 'aucun effet' ? `<div class="et-effet">${txt(e.effet)}</div>` : '')
    + (it ? `<div class="et-liste">${cartePiece(it, { actions: boutonsEquiper(it) })}</div>` : '')
    + (e.relique ? `<div class="et-liste">${carteRelique(A.RELIQUES_PAR_ID[e.relique])}</div>` : '')
    + (e.eveil && EVEILS[e.eveil] ? `<div class="sorts" style="margin-bottom:14px">${ligneEveil(EVEILS[e.eveil], texteEveil(EVEILS[e.eveil]), COUT_EVEIL)}</div>` : '')
    + '<button class="btn btn-go btn-wide" id="b-suite">Continuer</button>';
}

function etapeMarchand(e) {
  const prix = A.prixObjets(av);
  const objets = Object.entries(OBJETS).map(([k, o]) => `<button class="choix" data-acheter="${k}" ${av.or < prix[k] ? 'disabled' : ''}>
    <b>${o.glyphe} ${txt(o.nom)} — ${prix[k]} or</b><i>${txt(o.texte)} (vous en avez ${av.inventaire[k]})</i></button>`).join('');
  const stock = e.stock.map((it) => {
    const conseil = A.conseilEquipement(av, it);
    return cartePiece(it, {
      note: conseil !== null ? `idéal pour ${av.groupe[conseil].nom}` : 'personne n’y gagne',
      actions: `<button class="mini-btn mieux" data-acheter="${it.uid}" ${av.or < A.prixPour(av, it.prix) ? 'disabled' : ''}>Acheter · ${A.prixPour(av, it.prix)} or</button>`,
    });
  }).join('') || '<p class="vide-note">Tout est vendu.</p>';
  const sac = av.sac.map((it) => cartePiece(it, {
    actions: `${boutonsEquiper(it)}<button class="mini-btn" data-vendre="${it.uid}">Vendre · +${A.prixRevente(it)} or</button>`,
  })).join('') || '<p class="vide-note">Votre sac est vide.</p>';
  return (e.ambulant
    ? tete('🛒', 'Un marchand ambulant', 'Il traîne sa carriole entre deux salles. « Vous avez l’air d’avoir de l’or… et des ennuis. »')
    : tete('💰', 'Le marchand', '« Tout se vend, tout s’achète. Surtout les potions, par ici. »'))
    + `<div class="or-dispo">Vous avez <b>${av.or} or</b></div>`
    + `<div class="et-liste">${objets}</div>`
    + (e.relique ? `<h3 class="section">En vitrine</h3><div class="et-liste">${carteRelique(A.RELIQUES_PAR_ID[e.relique.id], {
      actions: `<button class="mini-btn mieux" data-acheter="relique" ${av.or < A.prixPour(av, e.relique.prix) ? 'disabled' : ''}>Acheter · ${A.prixPour(av, e.relique.prix)} or</button>`,
    })}</div>` : '')
    + `<h3 class="section">Équipement</h3><div class="et-liste">${stock}</div>`
    + `<h3 class="section">Votre sac</h3><div class="et-liste">${sac}</div>`
    + '<button class="btn btn-go btn-wide" id="b-suite">Quitter la boutique</button>';
}

function etapeRepos() {
  const gain = 20 + 12 * av.acte;
  return tete('🔥', 'Feu de camp', 'La partie est sauvegardée ici : en cas de défaite, vous reviendrez à ce feu.')
    + `<div class="groupe-mini">${groupeMini()}</div>`
    + `<div class="et-liste">
      <button class="choix" data-repos="repos"><b>😴 Se reposer</b><i>+45 % de vie, mana au maximum pour tout le groupe.</i></button>
      <button class="choix" data-repos="entrainement"><b>⚔ S’entraîner</b><i>+${gain} XP pour chacun. Vie et mana restent comme ils sont.</i></button>
    </div>`;
}

function etapeTresor(e) {
  return tete('📦', 'Un coffre', 'Il n’est pas piégé. Pour une fois.')
    + `<button class="btn btn-go btn-wide" id="b-ouvrir">Ouvrir le coffre</button>`;
}

function etapeCompagnon(e) {
  const niveau = A.niveauRecrue(av);
  const complet = av.groupe.length >= A.TAILLE_GROUPE;
  const offres = e.offres.map((id) => {
    const p = creerPersonnage(id, niveau);
    const legende = !!PAR_ID[id].legendaire;
    const boutons = complet
      ? `<p class="fp-note">Le groupe est complet : qui cède sa place ? Son équipement retournera dans le sac.</p>
        <div class="piece-actions">${av.groupe.slice(1).map((m, i) => `<button class="mini-btn mieux" data-recruter="${id}" data-remplace="${i + 1}">Remplacer ${txt(m.nom)} (niv. ${m.niveau})</button>`).join('')}</div>`
      : `<button class="btn btn-go btn-wide" data-recruter="${id}" style="margin-top:10px">Recruter ${txt(p.nom)}</button>`;
    return `<div class="carte-perso${legende ? ' legendaire' : ''}" style="--aff:${teinte(p.ecole)}">${tetePerso(p)}${statsHtml(p)}${sortsHtml(p)}${boutons}</div>`;
  }).join('');
  const legendaire = e.offres.some((id) => PAR_ID[id].legendaire);
  const texte = e.depart
    ? 'Avant de reprendre l’histoire, des compagnons de route se présentent. Choisissez qui vous suit.'
    : legendaire
    ? 'Une silhouette que les chansons décrivent se tient devant vous. Un héros légendaire propose de marcher à vos côtés.'
    : e.apresBoss
      ? 'Votre victoire a fait du bruit. Des aventuriers proposent de se joindre à vous.'
      : 'Au détour d’un couloir, deux aventuriers cherchent une troupe. Un seul vous suivra.';
  return tete(legendaire ? '🌟' : '🤝', legendaire ? 'Une rencontre légendaire' : 'Une rencontre', `${texte} (${av.groupe.length}/${A.TAILLE_GROUPE} dans le groupe)`)
    + `<div class="membres">${offres}</div>`
    + '<button class="btn btn-ghost btn-wide" id="b-suite" style="margin-top:12px">Continuer sans eux</button>';
}

function etapeBalade(e) {
  const zones = ACTES.slice(0, av.acte).map((a, i) => {
    const n = i + 1;
    const note = n === av.acte ? 'zone en cours : expérience et or au plein tarif' : 'zone passée : monstres plus faibles, gains plus maigres';
    return `<button class="choix zone${n === e.acte ? ' choisi' : ''}" data-zone="${n}">
      <b>Chapitre ${n} — ${txt(a.nom)}</b><i>${note}</i></button>`;
  }).join('');
  return tete('🧭', 'Rôder', 'Retournez dans une zone déjà ouverte pour y chasser : de l’expérience et de l’or, autant de fois que vous voulez.')
    + `<p class="alerte-embuscade">⚠ À chaque chasse, ${pc(A.CHANCE_EMBUSCADE)} de risque d’<b>embuscade</b> : une élite du chapitre ${av.acte} vous tombe dessus et frappe la première.</p>`
    + `<div class="groupe-mini">${groupeMini()}</div>`
    + `<div class="zones">${zones}</div>`
    + `<div class="et-liste">
      <button class="btn btn-go btn-wide" id="b-chasser">Chasser dans cette zone</button>
      <button class="btn btn-ghost btn-wide" id="b-suite">Revenir à la carte</button></div>`;
}

function etapeDepart() {
  const d = A.departCourant(av);
  const choix = d.choix.map((c) => `<button class="choix" data-depart="${c.id}" ${c.possible ? '' : 'disabled'}>
    <b>${txt(c.label)}</b><i>${txt(c.annonce)}</i></button>`).join('');
  return tete(d.glyphe, txt(d.titre), txt(d.texte))
    + `<div class="carte-perso" style="--aff:${teinte(d.perso.ecole)};margin-bottom:14px">${tetePerso(d.perso)}
      ${d.eveil ? `<p class="fp-note">S’il y a un retour, ${txt(d.perso.nom)} rapportera une compétence d’éveil :</p><div class="sorts">${ligneEveil(d.eveil, texteEveil(d.eveil), COUT_EVEIL)}</div>` : ''}</div>`
    + `<div class="et-liste">${choix}</div>`;
}

function etapeQuetes() {
  const carte = (q, bouton) => {
    const d = A.QUETES_PAR_ID[q.id];
    return `<div class="piece" style="--r:#ffd76a">
      <b>${d.glyphe} ${txt(d.nom)}</b>
      <i>${txt(A.texteQuete(q))}</i>
      <small>Récompense : ${txt(A.texteEffet(q.recompense))}</small>
      ${bouton}</div>`;
  };
  const q = av.quete;
  const enCours = q
    ? `<h3 class="section">En cours</h3><div class="et-liste">${carte(q, `<div class="jauge xp" style="--v:${(q.progres / q.but).toFixed(3)}"><i></i></div><small>${q.progres} / ${q.but}</small>`)}</div>` : '';
  const offres = (av.offresQuetes || []).map((o) => carte(o,
    `<div class="piece-actions"><button class="mini-btn mieux" data-quete="${o.id}" ${q ? 'disabled' : ''}>Accepter</button></div>`)).join('');
  return tete('📜', 'Quêtes', 'Une seule quête à la fois. Elle vaut pour l’acte en cours : au boss vaincu, le tableau se renouvelle.')
    + enCours
    + (offres ? `<h3 class="section">Proposées</h3><div class="et-liste">${offres}</div>` : (q ? '' : '<p class="vide-note">Plus de quête à prendre dans cet acte.</p>'))
    + '<button class="btn btn-go btn-wide" id="b-suite">Revenir à la carte</button>';
}

function etapeDefaite(e) {
  if (e.definitive) {
    const h = A.heros(av);
    return tete('💀', 'Mort définitive', `Mode Hardcore : il n’y a pas de feu de camp où revenir. ${txt(h.nom)} tombe au niveau ${h.niveau}, au chapitre ${av.acte}, après ${av.stats.combats} combat${av.stats.combats > 1 ? "s" : ""}. L’aventure repart de zéro.`)
      + '<button class="btn btn-go btn-wide" id="b-fin-hardcore">Recommencer une aventure</button>';
  }
  const blesse = A.blessuresBoss(av);
  return tete('💀', 'Le groupe est tombé', 'Vous revenez au dernier feu de camp (ou au début de l’acte). '
    + 'La moitié de l’expérience gagnée depuis reste acquise, mais l’or et le butin sont perdus.'
    + (blesse ? ` Le boss, lui, garde ses blessures : −${pc(blesse)} de vie au prochain assaut.` : ''))
    + '<button class="btn btn-go btn-wide" id="b-reprendre">Revenir au feu de camp</button>';
}

function etapeVictoire() {
  const s = av.stats;
  return tete('🐉', 'Le Dragon Cendré est tombé !', `Au départ, ${txt(A.heros(av).nom)} voyageait seul. Au sommet du Pic de l’Aube, le groupe compte ${av.groupe.length} héros.`)
    + `<div class="gains">${av.groupe.map((p) => `<div class="gain">${spriteSvg(p)}<div><b>${txt(p.nom)}</b> niveau ${p.niveau}</div></div>`).join('')}</div>`
    + `<div class="journal-voyage"><div>Combats : <b>${s.combats}</b> · Défaites : <b>${s.morts}</b> · Or amassé : <b>${s.ors}</b></div></div>`
    + `<div class="et-liste" style="margin-top:14px">
      <button class="btn btn-go btn-wide" id="b-nouvelle">Nouvelle aventure</button>
      <button class="btn btn-ghost btn-wide" id="b-menu">Menu</button></div>`;
}

/* ------------------------------------------------------------------ */
/* Groupe                                                              */
/* ------------------------------------------------------------------ */

function rendreGroupe() {
  if (!av) return aller('menu');
  const bonus = A.bonusDe(av);
  $('groupe-sous').textContent = `${av.groupe.length}/${A.TAILLE_GROUPE} personnages · 💰 ${av.or} · 🍀 ${av.chance}`;
  $('membres').innerHTML = av.groupe.map((p, idx) => {
    const s = statsDe(p, bonus);
    const prochain = p.niveau >= NIVEAU_MAX ? 'niveau maximum' : `${p.xp - SEUILS_XP[p.niveau]} / ${SEUILS_XP[p.niveau + 1] - SEUILS_XP[p.niveau]} XP`;
    const slots = Object.entries(EMPLACEMENTS).map(([k, e]) => {
      const it = p.equip[k];
      return it
        ? `<button class="slot-equip plein" style="--r:${couleurRarete(it.rarete)}" data-retirer="${k}" data-idx="${idx}" title="Toucher pour retirer">
            <b>${it.glyphe} ${txt(it.nom)}</b><i>${txt(texteBonusCourt(it))}</i></button>`
        : `<div class="slot-equip"><i>${e.glyphe} ${e.nom}</i><i>vide</i></div>`;
    }).join('');
    const objets = [
      p.pv > 0 && p.pv < s.pvMax && av.inventaire.potion > 0 ? `<button class="mini-btn" data-objet="potion" data-idx="${idx}">🧪 Potion</button>` : '',
      p.pv > 0 && p.pm < s.pmMax && av.inventaire.elixir > 0 ? `<button class="mini-btn" data-objet="elixir" data-idx="${idx}">🔷 Élixir</button>` : '',
      p.pv <= 0 && av.inventaire.phenix > 0 ? `<button class="mini-btn" data-objet="phenix" data-idx="${idx}">🪶 Relever</button>` : '',
    ].join('');
    return `<div class="carte-perso" style="--aff:${teinte(p.ecole)}">${tetePerso(p)}
      <div class="cp-xp"><span>${prochain}</span><div class="jauge xp" style="--v:${(p.niveau >= NIVEAU_MAX ? 1 : progressionNiveau(p.xp)).toFixed(3)}"><i></i></div></div>
      ${statsHtml(p, bonus)}${sortsHtml(p)}
      <div class="equip">${slots}</div>
      ${talentsHtml(p, idx)}
      ${objets ? `<div class="cp-objets">${objets}</div>` : ''}</div>`;
  }).join('');

  $('sac').innerHTML = av.sac.map((it) => cartePiece(it, { actions: boutonsEquiper(it) })).join('')
    || '<p class="sac-vide">Le sac est vide. Les pièces se trouvent sur les monstres, dans les coffres et chez le marchand.</p>';

  $('reliques').innerHTML = A.reliquesDe(av).map((r) => carteRelique(r)).join('')
    || '<p class="sac-vide">Aucune relique. Les boss en lâchent une, certaines quêtes aussi, et les boutiques en vendent parfois.</p>';

  const lignes = [];
  for (const a of av.absents || []) {
    lignes.push(`<div>🚶 <b>${txt(a.perso.nom)}</b> est en voyage : retour dans ${Math.max(1, a.reste)} salle${a.reste > 1 ? 's' : ''}.</div>`);
  }
  if (A.bonusSolo(av)) lignes.push(`<div>⚔ <b>Seul contre tous</b> : +${pc(A.bonusSolo(av))} de dégâts tant que ${txt(A.heros(av).nom)} voyage seul.</div>`);
  for (const id of av.dons) {
    const d = A.DONS_PAR_ID[id];
    lignes.push(`<div>${d.glyphe} <b>${txt(d.nom)}</b> — ${txt(A.texteDon(d))}</div>`);
  }
  const autres = A.texteEffet({ butin: av.benedictions });
  if (autres !== 'aucun effet') lignes.push(`<div>✨ <b>Toutes vos bénédictions</b> — ${txt(autres)}</div>`);
  for (const m of av.menaces) {
    lignes.push(`<div>⚠ <b>${txt(m.source)}</b> — ${txt(A.texteEffet({ boss: m }))}</div>`);
  }
  $('voyage').innerHTML = lignes.join('') || '<div>Rien encore : l’aventure ne fait que commencer.</div>';

  const racine = $('s-groupe');
  for (const el of racine.querySelectorAll('[data-retirer]')) {
    el.addEventListener('click', () => { A.desequiper(av, +el.dataset.idx, el.dataset.retirer); sfx.clic(); sauver(); rendreGroupe(); });
  }
  for (const el of racine.querySelectorAll('[data-objet]')) {
    el.addEventListener('click', () => {
      const r = A.utiliser(av, el.dataset.objet, +el.dataset.idx);
      if (r.ok) sfx.soin();
      sauver();
      rendreGroupe();
    });
  }
  for (const el of racine.querySelectorAll('[data-talent]')) {
    el.addEventListener('click', () => {
      const p = av.groupe[+el.dataset.idx];
      const r = apprendre(p, el.dataset.talent);
      if (r.ok) sfx.butin(); else toast(r.raison);
      sauver();
      rendreGroupe();
    });
  }
  brancherEquiper(racine, rendreGroupe);
}

/** L'arbre de talents d'un personnage : deux branches, trois paliers, trois rangs. */
function talentsHtml(p, idx) {
  const libres = pointsLibres(p);
  const branches = (ARBRES[p.role] || []).map((br) => {
    const talents = br.talents.map((tal) => {
      const rang = rangDe(p, tal.id);
      const peut = peutApprendre(p, tal.id);
      const etat = rang >= RANG_MAX ? 'max' : peut.ok ? 'dispo' : rang > 0 ? 'pris' : 'bloque';
      const pips = '●'.repeat(rang) + '○'.repeat(RANG_MAX - rang);
      const texte = rang > 0 ? texteTalent(tal, rang) : texteTalent(tal, 1);
      const note = rang >= RANG_MAX ? 'rang maximum' : peut.ok ? `suivant : ${texteTalent(tal, rang + 1)}` : peut.raison;
      return `<button class="talent ${etat}" data-talent="${tal.id}" data-idx="${idx}">
        <b>${tal.glyphe} ${txt(tal.nom)} <span class="pips">${pips}</span></b>
        <i>${txt(texte)}</i><small>${txt(note)}</small></button>`;
    }).join('');
    return `<div class="branche"><div class="br-nom">${br.glyphe} ${txt(br.nom)}</div>${talents}</div>`;
  }).join('');
  return `<div class="talents">
    <div class="tal-tete">Talents ${libres ? `<b class="pastille">${libres} point${libres > 1 ? 's' : ''} à dépenser</b>` : '<span>aucun point à dépenser</span>'}</div>
    <div class="branches">${branches}</div></div>`;
}

const SIGLES = { atk: 'ATQ', def: 'DEF', pv: 'PV', pm: 'PM', vit: 'VIT', crit: '% CRIT' };
const texteBonusCourt = (it) => Object.keys(SIGLES)
  .filter((k) => it[k]).map((k) => `${it[k] > 0 ? '+' : ''}${it[k]} ${SIGLES[k]}`).join(' ');

/* ------------------------------------------------------------------ */
/* Branchements                                                        */
/* ------------------------------------------------------------------ */

function brancher() {
  for (const el of document.querySelectorAll('[data-go]')) {
    el.addEventListener('click', () => {
      debloquer();
      sfx.tap();
      const but = el.dataset.go;
      if (but === 'carte' && av && av.etape) return suite();
      aller(but);
    });
  }
  $('b-continuer').addEventListener('click', () => { debloquer(); sfx.clic(); suite(); });
  $('b-quetes').addEventListener('click', () => { debloquer(); sfx.clic(); if (av && A.ouvrirQuetes(av).ok) suite(); });
  $('b-roder').addEventListener('click', () => { debloquer(); sfx.clic(); if (av && A.roder(av).ok) suite(); });
  $('b-partir').addEventListener('click', () => {
    debloquer();
    if (av && !av.termine && !confirm('Une aventure est en cours. L’abandonner pour en commencer une nouvelle ?')) return;
    av = A.creerAventure({ heros: depart, difficulte, chapitre: chapitreDepart });
    finJouee = false;
    sfx.victoire();
    if (chapitreDepart > 1) { av.cines = ['intro']; suite(); return; }
    av.cines = ['intro', 'chap-1'];
    sauver();
    jouerCinematique(scenesIntro(A.heros(av), ACTES[0].nom), { sfx }).then(suite);
  });
  $('b-son').addEventListener('click', () => { basculerSon(); rendreMenu(); });
  $('tr-copier').addEventListener('click', async () => {
    const code = await codeCourant();
    try { await navigator.clipboard.writeText(code); toast('Code copié.'); } catch {
      $('tr-sortie').select();
      toast('Sélectionné : copiez-le à la main.');
    }
  });
  $('tr-partager').addEventListener('click', async () => {
    const code = await codeCourant();
    if (navigator.share) {
      try { await navigator.share({ title: 'Ma partie RAID', text: code }); return; } catch { /* annulé : on copie */ }
    }
    try { await navigator.clipboard.writeText(code); toast('Code copié : collez-le dans un message à vous-même.'); } catch {
      $('tr-sortie').select();
      toast('Sélectionné : copiez-le à la main.');
    }
  });
  $('tr-coller').addEventListener('click', async () => {
    try { $('tr-entree').value = await navigator.clipboard.readText(); } catch { toast('Collez le code à la main dans la case.'); }
  });
  $('tr-charger').addEventListener('click', chargerCode);
  $('b-auto').addEventListener('click', () => { sfx.tap(); basculerAuto(); });
}

av = charger();
brancher();
installerMusique('raid', { actif: sonActif });
rendreMenu();

/* Service worker : rend le jeu installable et jouable sans réseau.
   Un échec ici ne doit jamais empêcher de jouer. */
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[pwa] service worker non enregistré :', err));
  });
}
