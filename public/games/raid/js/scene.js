/**
 * RAID — l'écran de combat.
 *
 * Ce module ne décide de rien : il montre l'état que `combat.js` lui donne et
 * rejoue, un par un, les événements que le moteur renvoie. C'est ce qui permet
 * d'animer honnêtement — chaque nombre qui monte à l'écran vient d'un calcul,
 * jamais d'une mise en scène qui s'arrangerait avec les règles.
 *
 * Le fil est toujours le même :
 *      geste du joueur → appel au moteur → file d'événements → animations
 */

import {
  choisir, tracer, attaquer, modesDisponibles, estimerDegats, utiliserObjet,
  vue, estFini, PHASE, SEUIL_SPECIAL, SEUIL_ULTIME, MANA_MAX,
} from '../../../shared/raid/combat.js';
import {
  COLONNES, LIGNES, LONGUEUR_MAX, voisines, x as colDe, y as ligneDe,
} from '../../../shared/raid/globes.js';
import { ECOLES, ESSENCE, multiplicateur } from '../../../shared/raid/ecoles.js';
import { ROLES } from '../../../shared/raid/heros.js';
import { spriteSvg } from '../../../shared/raid/sprites.js';
import { conseilChemin } from '../../../shared/raid/auto.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const teinte = (aff) => (ECOLES[aff] || ECOLES.vermeil).teinte;

/* ------------------------------------------------------------------ */
/* État local de l'écran                                               */
/* ------------------------------------------------------------------ */

let etat = null;
let fini = null;            // rappel de fin de combat
let lieu = '';
let cible = 0;              // ennemi visé par le joueur
let chemin = [];            // chemin en cours de tracé
let aBouge = false;         // le doigt a-t-il glissé, ou s'agit-il de touches ?
let enTrace = false;        // le doigt (ou le bouton) est-il enfoncé ?
let enTrain = false;        // une animation joue : on ignore les gestes
let cellules = [];          // les trente globes, dans l'ordre du plateau

/* ------------------------------------------------------------------ */
/* Entrée                                                              */
/* ------------------------------------------------------------------ */

export async function lancer(combat, { lieu: nom = '', onFini = () => {}, onQuitter = () => {} } = {}) {
  etat = combat;
  fini = onFini;
  lieu = nom;
  cible = premierVivant();
  chemin = [];
  enTrain = false;

  $('b-quitter').onclick = () => { if (!enTrain) onQuitter(); };
  $('b-potion').onclick = boirePotion;
  $('b-valider').onclick = valider;
  $('b-effacer').onclick = () => { chemin = []; majTrace(); };

  construirePlateau();
  construireScene();
  rendre();
  await annonce(`TOUR ${etat.tour}`, 700);
  rendre();
}

const premierVivant = () => Math.max(0, etat.ennemis.findIndex((e) => e.pv > 0));

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

function construirePlateau() {
  const plateau = $('plateau');
  plateau.innerHTML = '';
  cellules = [];
  for (let i = 0; i < COLONNES * LIGNES; i++) {
    const o = document.createElement('div');
    o.className = 'globe';
    o.dataset.i = String(i);
    plateau.appendChild(o);
    cellules.push(o);
  }
  plateau.onpointerdown = debutTrace;
  plateau.onpointermove = suiteTrace;
  plateau.onpointerup = finTrace;
  plateau.onpointercancel = finTrace;
}

function construireScene() {
  const zone = $('ennemis');
  zone.innerHTML = '';
  etat.ennemis.forEach((e, i) => {
    const el = document.createElement('div');
    el.className = 'bete';
    el.style.setProperty('--aff', teinte(e.ecole));
    el.dataset.i = String(i);
    el.innerHTML =
      `<div class="peau">${spriteSvg(e, 'repos')}</div>`
      + `<div class="nom">${txt(e.nom)}</div>`
      + `<div class="jauge"><i class="jauge-fond"></i><i class="jauge-remplie"></i></div>`
      + `<div class="traits"></div>`;
    el.onclick = () => {
      if (enTrain || etat.ennemis[i].pv <= 0) return;
      cible = i;
      sfx.tap();
      rendre();
    };
    zone.appendChild(el);
  });
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

export function rendre() {
  if (!etat) return;
  const v = vue(etat);

  $('hud-lieu').textContent = lieu;
  $('hud-tour').textContent = `Tour ${v.tour} · le boss frappe au ${ordinal(v.fenetre)}`;
  $('potion-n').textContent = String(v.objets);
  $('b-potion').disabled = v.objets <= 0 || v.phase !== PHASE.CHOIX;

  rendreVie(v);
  rendreEnnemis(v);
  rendreHeros(v);
  rendreRotation(v);
  rendrePlateau(v);
  rendreActions(v);
  rendreConsigne(v);
}

function rendreVie(v) {
  const part = Math.max(0, v.vie.actuel / v.vie.max);
  const jauge = $('vie-barre').parentElement;
  jauge.classList.toggle('est-bas', part <= 0.5);
  jauge.classList.toggle('est-critique', part <= 0.22);
  $('vie-barre').style.width = `${part * 100}%`;
  $('vie-fantome').style.width = `${part * 100}%`;
  $('vie-texte').textContent = `${Math.round(v.vie.actuel).toLocaleString('fr-FR')} / ${v.vie.max.toLocaleString('fr-FR')}`;

  const etats = [];
  if (v.elan) etats.push(`<span class="etat est-elan">Élan +${Math.round(v.elan.valeur * 100)} %</span>`);
  if (v.garde) etats.push(`<span class="etat est-garde">Garde ${Math.round(v.garde * 100)} %</span>`);
  $('etats').innerHTML = etats.join('');
}

function rendreEnnemis(v) {
  v.ennemis.forEach((e, i) => {
    const el = $('ennemis').children[i];
    if (!el) return;
    el.classList.toggle('est-cible', i === cible && e.pv > 0 && v.ennemis.filter((z) => z.pv > 0).length > 1);
    el.classList.toggle('est-enrage', !!e.enrage);
    el.querySelector('.jauge-remplie').style.width = `${Math.max(0, e.pv / e.pvMax) * 100}%`;

    const traits = [];
    const imminent = e.charge.reste <= 1;
    traits.push(`<span class="trait est-charge${imminent ? ' imminent' : ''}">`
      + `${imminent ? `⚠ ${txt(e.charge.nom)}` : `${txt(e.charge.nom)} dans ${e.charge.reste - 1}`}</span>`);
    if (e.entrave) traits.push(`<span class="trait est-entrave">entravé −${Math.round(e.entrave * 100)} %</span>`);
    if (e.brasier) traits.push(`<span class="trait est-brasier">brasier ${e.brasier.toLocaleString('fr-FR')}</span>`);
    el.querySelector('.traits').innerHTML = traits.join('');
  });
}

function rendreHeros(v) {
  const zone = $('heros-scene');
  const attendus = v.rotation.join(',');
  if (zone.dataset.rotation !== attendus) {
    zone.dataset.rotation = attendus;
    zone.innerHTML = v.rotation.map((i) => {
      const h = etat.equipe[i];
      return `<div class="personnage" data-i="${i}" style="--aff:${teinte(h.ecole)}">`
        + `<div class="peau">${spriteSvg(h, 'repos')}</div></div>`;
    }).join('');
  }
  [...zone.children].forEach((el) => {
    const i = +el.dataset.i;
    el.classList.toggle('est-actif', v.actif === i);
    el.classList.toggle('est-pale', !v.ordreRestant.includes(i) && v.actif !== i);
  });
}

function rendreRotation(v) {
  const zone = $('rotation');
  const attendus = v.rotation.join(',');
  if (zone.dataset.rotation !== attendus) {
    zone.dataset.rotation = attendus;
    zone.innerHTML = v.rotation.map((i) => {
      const h = etat.equipe[i];
      return `<button class="jeton" data-i="${i}" style="--aff:${teinte(h.ecole)}">`
        + `<span class="liens"></span>`
        + `${spriteSvg(h, 'repos')}`
        + `<span class="corps">`
        + `<span class="nom"><em class="vise" hidden title="a l’aggro">◉</em>${txt(h.nom)}</span>`
        + `<span class="mana-barre"><i class="mana-plein"></i>`
        + `<span class="mana-seuils">`
        + `<i style="left:${SEUIL_SPECIAL / MANA_MAX * 100}%"></i>`
        + `<i style="left:${SEUIL_ULTIME / MANA_MAX * 100}%"></i></span></span>`
        + `<span class="mana-texte"></span>`
        + `</span>`
        + `<span class="role-pastille" style="--role:${ROLES[h.role].teinte}">${ROLES[h.role].glyphe}</span>`
        + `</button>`;
    }).join('');
    [...zone.children].forEach((el) => {
      el.onclick = () => prendreLaMain(+el.dataset.i);
    });
  }

  [...zone.children].forEach((el) => {
    const i = +el.dataset.i;
    const mana = v.mana[i] || 0;
    const jouable = v.phase === PHASE.CHOIX && v.ordreRestant.includes(i);
    el.classList.toggle('est-jouable', jouable);
    el.classList.toggle('est-actif', v.actif === i);
    el.classList.toggle('est-fait', !v.ordreRestant.includes(i) && v.actif !== i);
    el.classList.toggle('est-vise', v.vise === i);
    el.querySelector('.vise').hidden = v.vise !== i;
    el.disabled = !jouable;
    el.querySelector('.mana-plein').style.width = `${Math.min(1, mana / MANA_MAX) * 100}%`;

    const txteKi = el.querySelector('.mana-texte');
    txteKi.textContent = mana >= SEUIL_ULTIME ? `${mana} mana · ultime !`
      : mana >= SEUIL_SPECIAL ? `${mana} mana · spéciale`
      : `${mana} / ${SEUIL_SPECIAL} mana`;
    txteKi.className = 'mana-texte'
      + (mana >= SEUIL_ULTIME ? ' est-ultime' : mana >= SEUIL_SPECIAL ? ' est-super' : '');

    const liens = v.equipe[i].liens;
    el.querySelector('.liens').textContent = liens.length ? `⛓ ${liens.length}` : '';
    el.querySelector('.liens').title = liens.join(' · ');
  });
}

function rendrePlateau(v) {
  const ecole = v.actif != null ? etat.equipe[v.actif].ecole : null;
  v.plateau.forEach((globe, i) => {
    const el = cellules[i];
    el.style.setProperty('--aff', globe === ESSENCE ? '#ffffff' : teinte(globe));
    el.classList.toggle('est-essence', globe === ESSENCE);
    el.classList.toggle('est-mienne', !!ecole && (globe === ecole || globe === ESSENCE));
    el.classList.toggle('est-prise', chemin.includes(i));
  });
  $('plateau').style.pointerEvents = v.phase === PHASE.GLOBES && !enTrain ? '' : 'none';
  $('plateau').style.opacity = v.phase === PHASE.GLOBES ? '1' : '.55';
  dessinerTrace();
  majKiFlottant(v);
  majBoutons();
}

function rendreActions(v) {
  const zone = $('actions');
  if (v.phase !== PHASE.ACTION || v.actif == null) { zone.hidden = true; return; }

  const ennemi = etat.ennemis[cible]?.pv > 0 ? etat.ennemis[cible] : etat.ennemis[premierVivant()];
  const h = etat.equipe[v.actif];
  zone.hidden = false;
  zone.innerHTML = modesDisponibles(etat, v.actif).map((m) => {
    const d = estimerDegats(etat, v.actif, m.mode, ennemi);
    const classe = m.mode === 'ultime' ? 'est-ultime' : m.mode === 'special' ? 'est-special' : '';
    const nom = m.mode === 'normale' ? 'Auto-attaque' : m.nom;
    return `<button class="coup ${classe}" data-mode="${m.mode}" ${m.ouvert ? '' : 'disabled'}`
      + ` style="--aff:${teinte(h.ecole)}">`
      + `<span class="mult">×${m.mult.toFixed(2)}</span>`
      + `<b>${txt(nom)}</b>`
      + `<span class="degat">${d.degats.toLocaleString('fr-FR')}</span>`
      + `<i>${m.ouvert ? etiquetteType(d.type) : `${m.mana} mana requis`}</i>`
      + `</button>`;
  }).join('');
  [...zone.children].forEach((el) => {
    el.onclick = () => frapper(el.dataset.mode);
  });
}

/** « 1er », puis « 2e », « 3e » — l'abréviation française n'est pas régulière. */
const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);

const etiquetteType = (mult) => mult > 1 ? 'vulnérable ✦' : mult < 1 ? 'résistant' : 'neutre';

function rendreConsigne(v) {
  const c = $('consigne');
  if (estFini(etat)) { c.textContent = ''; return; }
  if (v.phase === PHASE.CHOIX) {
    const vise = etat.equipe[v.vise];
    c.innerHTML = `À qui le tour ? <b>${txt(vise.nom)}</b> a l'aggro, le boss frappe après le `
      + `<b>${ordinal(v.fenetre)}</b> personnage.`;
  } else if (v.phase === PHASE.GLOBES) {
    const h = etat.equipe[v.actif];
    c.innerHTML = `<b>${txt(h.nom)}</b> ramasse : glissez — ou touchez — les globes voisins. `
      + `Les globes <b>${ECOLES[h.ecole].nom.toLowerCase()}</b> et l'essence pure comptent double.`;
  } else if (v.phase === PHASE.ACTION) {
    c.innerHTML = `Choisissez le sort${etat.ennemis.filter((e) => e.pv > 0).length > 1 ? ' — et la cible, en touchant l’adversaire' : ''}.`;
  } else {
    c.textContent = '';
  }
}

/* ------------------------------------------------------------------ */
/* Gestes du joueur                                                    */
/* ------------------------------------------------------------------ */

function prendreLaMain(i) {
  if (enTrain || etat.phase !== PHASE.CHOIX) return;
  if (!choisir(etat, i).ok) return;
  sfx.clic();
  chemin = [];
  rendre();
  // Une aide discrète : le meilleur globe de départ scintille un instant.
  const c = conseilChemin(etat);
  if (c) cellules[c.chemin[0]].classList.add('arrive');
}

function globeSous(ev) {
  const el = document.elementFromPoint(ev.clientX, ev.clientY);
  if (!el || !el.classList.contains('globe')) return null;
  return +el.dataset.i;
}

/**
 * Deux façons de jouer, et il faut que les deux marchent : on glisse le doigt
 * d'un globe à l'autre, ou on les touche un par un. La distinction se fait
 * au relâchement — si le doigt n'a pas bougé, c'est une touche, et le chemin
 * reste ouvert jusqu'au bouton « Ramasser ».
 */
function debutTrace(ev) {
  if (enTrain || etat.phase !== PHASE.GLOBES) return;
  const i = globeSous(ev);
  if (i == null) return;
  ev.preventDefault();
  $('plateau').setPointerCapture?.(ev.pointerId);
  enTrace = true;
  aBouge = false;

  const dernier = chemin[chemin.length - 1];
  if (chemin.length) {
    if (i === dernier) { valider(); return; }              // toucher le dernier, c'est ramasser
    if (chemin.length > 1 && i === chemin[chemin.length - 2]) { chemin.pop(); majTrace(); return; }
    if (!chemin.includes(i) && voisines(dernier, i) && chemin.length < LONGUEUR_MAX) {
      chemin.push(i);
      sfx.globe(chemin.length);
      majTrace();
      return;
    }
    if (chemin.includes(i)) return;                        // un globe déjà pris : on ignore
  }
  chemin = [i];
  sfx.globe(1);
  majTrace();
}

function suiteTrace(ev) {
  // Sans ce garde-fou, promener la souris au-dessus du plateau, bouton relâché,
  // allongerait le chemin tout seul.
  if (!enTrace || !chemin.length || etat.phase !== PHASE.GLOBES) return;
  const i = globeSous(ev);
  if (i == null) return;
  const dernier = chemin[chemin.length - 1];
  if (i === dernier) return;

  // Revenir sur ses pas efface le dernier globe : on corrige sans relâcher.
  if (chemin.length > 1 && i === chemin[chemin.length - 2]) {
    chemin.pop();
    aBouge = true;
    majTrace();
    return;
  }
  if (chemin.includes(i)) return;
  if (!voisines(dernier, i)) return;
  if (chemin.length >= LONGUEUR_MAX) return;

  chemin.push(i);
  aBouge = true;
  sfx.globe(chemin.length);
  majTrace();
}

function majTrace() {
  cellules.forEach((el, i) => el.classList.toggle('est-prise', chemin.includes(i)));
  dessinerTrace();
  majKiFlottant(vue(etat));
  majBoutons();
}

/** Le bandeau « Ramasser » n'existe que tant qu'un chemin est ouvert. */
function majBoutons() {
  const barre = $('valider');
  const ouvert = etat.phase === PHASE.GLOBES && chemin.length > 0 && !enTrain;
  barre.hidden = !ouvert;
  if (ouvert) $('valider-n').textContent = `${chemin.length} globe${chemin.length > 1 ? 's' : ''}`;
}

function finTrace() {
  enTrace = false;
  if (!chemin.length || etat.phase !== PHASE.GLOBES || enTrain) return;
  if (aBouge) return valider();
  majTrace();                       // simple touche : le chemin reste ouvert
  return undefined;
}

async function valider() {
  if (!chemin.length || etat.phase !== PHASE.GLOBES || enTrain) return;
  const voulu = [...chemin];
  chemin = [];
  enTrace = false;
  majBoutons();
  const r = tracer(etat, voulu);
  if (!r.ok) { majTrace(); return; }
  await jouer(r.evenements);
  rendre();
}

async function frapper(mode) {
  if (enTrain || etat.phase !== PHASE.ACTION) return;
  const r = attaquer(etat, { mode, cible });
  if (!r.ok) return;
  $('actions').hidden = true;
  await jouer(r.evenements);
  if (etat.ennemis[cible]?.pv <= 0) cible = premierVivant();
  rendre();
  if (estFini(etat)) fini(etat.phase === PHASE.VICTOIRE);
}

async function boirePotion() {
  if (enTrain) return;
  const r = utiliserObjet(etat);
  if (!r.ok) return;
  await jouer(r.evenements);
  rendre();
}

/* ------------------------------------------------------------------ */
/* Tracé                                                               */
/* ------------------------------------------------------------------ */

/** Centre d'une case dans le repère du SVG (600 × 500, étiré sur le plateau). */
const centre = (i) => ({
  cx: (colDe(i) + 0.5) / COLONNES * 600,
  cy: (ligneDe(i) + 0.5) / LIGNES * 500,
});

function dessinerTrace() {
  const svg = $('trace');
  if (chemin.length < 2) { svg.innerHTML = ''; return; }
  const points = chemin.map((i) => { const c = centre(i); return `${c.cx},${c.cy}`; }).join(' ');
  svg.innerHTML = `<polyline points="${points}"/>`;
  const aff = etat.actif != null ? teinte(etat.equipe[etat.actif].ecole) : '#fff';
  svg.style.setProperty('--aff', aff);
}

function majKiFlottant(v) {
  const boite = $('mana-flottant');
  if (v.phase !== PHASE.GLOBES || !chemin.length) { boite.hidden = true; return; }
  const h = etat.equipe[v.actif];
  let mana = 0;
  for (const i of chemin) {
    const o = v.plateau[i];
    mana += (o === h.ecole || o === ESSENCE) ? 2 : 1;
  }
  const total = Math.min(MANA_MAX, (v.mana[v.actif] || 0) + mana);
  boite.hidden = false;
  boite.innerHTML = `<b>${total}</b> mana`
    + (total >= SEUIL_ULTIME ? ' · ultime !' : total >= SEUIL_SPECIAL ? ' · spéciale' : '');
  boite.style.setProperty('--aff', total >= SEUIL_ULTIME ? '#ff6a3d' : total >= SEUIL_SPECIAL ? '#e8c060' : teinte(h.ecole));
}

/* ------------------------------------------------------------------ */
/* Animations                                                          */
/* ------------------------------------------------------------------ */

/** Rejoue la file d'événements du moteur, dans l'ordre, en prenant son temps. */
async function jouer(evenements) {
  enTrain = true;
  $('plateau').style.pointerEvents = 'none';
  for (const e of evenements) {
    try { await jouerUn(e); } catch { /* une animation ratée n'arrête pas la partie */ }
  }
  enTrain = false;
}

async function jouerUn(e) {
  switch (e.type) {
    case 'recolte':   return animerRecolte(e);
    case 'frappe':    return animerFrappe(e);
    case 'coupEnnemi': return animerCoupEnnemi(e);
    case 'brasier':   return nombreSurBete(indexDe(e.ennemi), e.degats, 'est-degat', '🔥 ');
    case 'ennemiSoin': return nombreSurBete(indexDe(e.ennemi), e.soin, 'est-soin', '+');
    case 'retour':
    case 'venin':     return degatsEquipe(e.degats, e.type === 'venin' ? '☠ ' : '↩ ');
    case 'soin':      return soinEquipe(e.montant, e.drain);
    case 'objet':     return soinEquipe(e.montant, false);
    case 'garde':     sfx.garde(); return annonce('BOUCLIER', 520);
    case 'elan':      sfx.arme(); return annonce('BUFF', 520);
    case 'entrave':   return annonce('AFFAIBLI', 520);
    case 'mana':      sfx.mana(); return annonce('INFUSION', 480);
    case 'brasierPose': return annonce('DOT POSÉ', 480);
    case 'rage':      sfx.rage(); secouer(true); return annonce('ENRAGE !', 800);
    case 'ennemiVaincu': return animerKo(indexDe(e.ennemi));
    case 'tour':      rendre(); return annonce(`TOUR ${e.tour}`, 640);
    case 'victoire':  sfx.victoire(); return annonce('BOSS DOWN', 900);
    case 'defaite':   sfx.defaite(); return annonce('WIPE', 900);
    default:          return null;
  }
}

const indexDe = (ennemi) => etat.ennemis.indexOf(ennemi);

/** Les globes ramassés filent vers la jauge de mana, puis la grille se retasse. */
async function animerRecolte(e) {
  const { recolte } = e;
  const jeton = [...$('rotation').children].find((el) => +el.dataset.i === e.heros);
  const arrivee = jeton ? jeton.getBoundingClientRect() : null;

  recolte.ramassees.forEach((i, n) => {
    const el = cellules[i];
    el.classList.add('part');
    if (!arrivee) return;
    const depart = el.getBoundingClientRect();
    const grain = document.createElement('div');
    grain.className = 'grain';
    grain.style.left = `${depart.left + depart.width / 2 - 6}px`;
    grain.style.top = `${depart.top + depart.height / 2 - 6}px`;
    grain.style.setProperty('--aff', getComputedStyle(el).getPropertyValue('--aff'));
    document.body.appendChild(grain);
    grain.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        {
          transform: `translate(${arrivee.left + arrivee.width / 2 - depart.left - depart.width / 2}px,`
            + `${arrivee.top + arrivee.height / 2 - depart.top - depart.height / 2}px) scale(.4)`,
          opacity: 0,
        },
      ],
      { duration: 380, delay: n * 34, easing: 'cubic-bezier(.4,0,.2,1)' },
    ).onfinish = () => grain.remove();
  });

  sfx.mana();
  await attendre(180 + recolte.ramassees.length * 34);

  // Chute : on connaît les déplacements, il suffit de les rejouer à l'envers.
  const pas = cellules[COLONNES].offsetTop - cellules[0].offsetTop;
  const v = vue(etat);
  rendrePlateau(v);
  cellules.forEach((el) => el.classList.remove('part'));

  for (const { de, vers } of recolte.chutes) {
    const dy = (ligneDe(de) - ligneDe(vers)) * pas;
    cellules[vers].animate(
      [{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
      { duration: 260, easing: 'cubic-bezier(.3,1.1,.4,1)' },
    );
  }
  for (const i of recolte.neuves) {
    cellules[i].classList.remove('arrive');
    void cellules[i].offsetWidth;          // relance l'animation
    cellules[i].classList.add('arrive');
  }

  rendreRotation(v);
  if (v.mana[e.heros] >= SEUIL_SPECIAL && e.avant < SEUIL_SPECIAL) sfx.arme();
  await attendre(240);
}

async function animerFrappe(e) {
  const heros = etat.equipe[e.heros];
  const el = [...$('heros-scene').children].find((z) => +z.dataset.i === e.heros);
  const bete = $('ennemis').children[e.cible];

  if (e.mode !== 'normale') {
    await cutIn(heros, e.nom, e.mode === 'ultime' ? 'sort ultime' : 'sort');
  }

  if (el) {
    el.querySelector('.peau').innerHTML = spriteSvg(heros, 'frappe');
    el.classList.add(e.mode === 'normale' ? 'frappe' : 'charge');
    await attendre(e.mode === 'normale' ? 150 : 320);
    if (e.mode !== 'normale') { el.classList.remove('charge'); el.classList.add('frappe'); }
  }

  if (e.mode === 'ultime') sfx.ultime();
  else if (e.mode === 'special') sfx.special();
  else sfx.frappe();

  for (let coup = 0; coup < e.coups; coup++) {
    if (coup) await attendre(160);
    impact(bete, teinte(heros.ecole));
    if (bete) {
      bete.classList.remove('touche');
      void bete.offsetWidth;
      bete.classList.add('touche');
    }
  }

  flash(e.mode === 'ultime' ? 'est-blanc' : null);
  secouer(e.mode === 'ultime');

  const style = e.mode === 'ultime' ? 'est-super' : 'est-degat';
  const prefixe = e.typeMult > 1 ? '✦ ' : '';
  nombreSurBete(e.cible, e.degats, style, prefixe);
  rendreEnnemis(vue(etat));

  await attendre(520);
  if (el) {
    el.classList.remove('frappe', 'charge');
    el.querySelector('.peau').innerHTML = spriteSvg(heros, 'repos');
  }
}

async function animerCoupEnnemi(e) {
  const i = indexDe(e.ennemi);
  const bete = $('ennemis').children[i];
  const cibleEl = [...$('heros-scene').children].find((z) => +z.dataset.i === e.cible);

  if (e.charge) { sfx.charge(); await annonce(e.nom.toUpperCase(), 700); }

  if (bete) {
    bete.querySelector('.peau').innerHTML = spriteSvg(etat.ennemis[i], 'frappe');
    bete.classList.add('frappe');
  }
  await attendre(260);

  sfx.subi();
  flash('est-rouge');
  secouer(e.charge);
  if (cibleEl) {
    cibleEl.querySelector('.peau').innerHTML = spriteSvg(etat.equipe[e.cible], 'repos');
    cibleEl.classList.add('encaisse');
  }
  degatsEquipe(e.degats, e.charge ? '⚡ ' : '');
  rendreVie(vue(etat));

  await attendre(420);
  if (bete) {
    bete.classList.remove('frappe');
    bete.querySelector('.peau').innerHTML = spriteSvg(etat.ennemis[i], 'repos');
  }
  if (cibleEl) cibleEl.classList.remove('encaisse');
  rendre();
}

async function animerKo(i) {
  const bete = $('ennemis').children[i];
  if (!bete) return;
  sfx.ko();
  bete.classList.add('vaincue');
  await attendre(560);
}

/* ---------------------------- primitives --------------------------- */

function nombreSurBete(i, montant, style, prefixe = '') {
  const bete = $('ennemis').children[i];
  if (!bete) return;
  const r = bete.getBoundingClientRect();
  const s = $('scene').getBoundingClientRect();
  poserNombre(r.left - s.left + r.width / 2, r.top - s.top + r.height * 0.35, montant, style, prefixe);
}

function degatsEquipe(montant, prefixe = '') {
  const s = $('scene').getBoundingClientRect();
  poserNombre(s.width / 2, s.height - 40, montant, 'est-subi', `−${prefixe}`);
}

function soinEquipe(montant, drain) {
  if (montant <= 0) return;
  if (!drain) sfx.soin();
  const s = $('scene').getBoundingClientRect();
  poserNombre(s.width / 2, s.height - 62, montant, 'est-soin', '+');
  rendreVie(vue(etat));
}

function poserNombre(gx, gy, montant, style, prefixe) {
  const n = document.createElement('div');
  n.className = `nombre ${style}`;
  n.style.left = `${gx}px`;
  n.style.top = `${gy}px`;
  n.textContent = `${prefixe}${Math.round(montant).toLocaleString('fr-FR')}`;
  $('effets').appendChild(n);
  setTimeout(() => n.remove(), 1100);
}

function impact(bete, couleur) {
  if (!bete) return;
  const r = bete.getBoundingClientRect();
  const s = $('scene').getBoundingClientRect();
  const gx = r.left - s.left + r.width / 2;
  const gy = r.top - s.top + r.height / 2;

  const boum = document.createElement('div');
  boum.className = 'impact';
  boum.style.left = `${gx}px`;
  boum.style.top = `${gy}px`;
  boum.style.setProperty('--aff', couleur);
  $('effets').appendChild(boum);
  setTimeout(() => boum.remove(), 460);

  for (let k = 0; k < 9; k++) {
    const p = document.createElement('div');
    p.className = 'etincelle';
    const angle = (k / 9) * Math.PI * 2 + Math.random();
    const loin = 34 + Math.random() * 46;
    p.style.left = `${gx}px`;
    p.style.top = `${gy}px`;
    p.style.setProperty('--aff', couleur);
    p.style.setProperty('--dx', `${Math.cos(angle) * loin}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * loin}px`);
    $('effets').appendChild(p);
    setTimeout(() => p.remove(), 640);
  }
}

function flash(classe) {
  if (!classe) return;
  const f = $('flash');
  f.className = 'flash';
  void f.offsetWidth;
  f.classList.add(classe);
}

function secouer(fort = false) {
  const s = $('scene');
  s.classList.remove('secousse', 'secousse-forte');
  void s.offsetWidth;
  s.classList.add(fort ? 'secousse-forte' : 'secousse');
  setTimeout(() => s.classList.remove('secousse', 'secousse-forte'), fort ? 1250 : 420);
}

async function annonce(texte, duree = 700) {
  const b = $('banniere');
  b.hidden = false;
  b.firstElementChild.textContent = texte;
  b.style.setProperty('--aff', etat && etat.actif != null
    ? teinte(etat.equipe[etat.actif].ecole) : '#e8c060');
  const anim = b.firstElementChild;
  anim.style.animation = 'none';
  void anim.offsetWidth;
  anim.style.animation = '';
  await attendre(duree);
  b.hidden = true;
}

async function cutIn(heros, nom, sous) {
  const c = $('cutin');
  c.hidden = false;
  c.style.setProperty('--aff', teinte(heros.ecole));
  $('cutin-portrait').innerHTML = spriteSvg(heros, 'frappe');
  $('cutin-nom').textContent = nom;
  $('cutin-sous').textContent = sous;
  await attendre(820);
  c.hidden = true;
}

/** Échappement : les noms viennent des données, mais rien n'oblige à les croire. */
function txt(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export { txt, teinte };
