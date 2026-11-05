/**
 * LÉGENDES — les animations plein écran :
 *   l'invocation : le portail qui tourne, les sphères qui tombent (leur couleur trahit la meilleure rareté),
 *     le portail qui s'ouvre dans un éclat, puis chaque SSR, LR ou nouveau personnage révélé en grand (la
 *     carte qui se retourne, des rayons derrière), et le résumé des dix ;
 *   la super attaque : le fond de l'élément, les lignes de vitesse, le gros plan qui entre, le nom de
 *     l'attaque dans une bande, puis l'effet propre à son style (rayon, combo, lame, tir, explosion, ombre,
 *     météore, glace) et l'impact (éclair blanc, l'écran qui tremble) ;
 *   la fin d'un combat.
 * Tout se passe d'un appui (sauf la fin d'un combat, qui attend un bouton).
 */

import { PERSO, RARETES, ELEMENTS, peutDevenirLR, formeLR } from '../../../shared/legendes/persos.js';
import { portrait } from './portrait.js';
import * as son from './sons.js';
import { illustration, rendreReactif } from './art.js';
import { ennemi as dessinEnnemi } from './portrait.js';
import { creerParticules, secouer, arret } from './effets.js';

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const ORDRE = ['R', 'SR', 'SSR', 'LR'];

/** Les lignes de vitesse (un canvas qui tourne autour du centre). */
function lignesDeVitesse(hote, couleur = '#ffffff') {
  const c = document.createElement('canvas');
  c.className = 'lignes';
  hote.appendChild(c);
  const g = c.getContext('2d');
  let vivant = true;
  const dessiner = () => {
    if (!vivant) return;
    const w = (c.width = c.clientWidth), h = (c.height = c.clientHeight);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = couleur;
    for (let k = 0; k < 70; k++) {
      const a = Math.random() * Math.PI * 2, r0 = 60 + Math.random() * Math.max(w, h) * 0.25, r1 = r0 + 80 + Math.random() * 260;
      g.globalAlpha = 0.15 + Math.random() * 0.45;
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      g.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
      g.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1);
      g.stroke();
    }
    setTimeout(() => requestAnimationFrame(dessiner), 45);
  };
  dessiner();
  return () => { vivant = false; c.remove(); };
}

/** Attend un appui sur la scène (ou le délai). Rend 'passer' si l'on a touché « Passer ». */
function appui(scene, ms = 0) {
  return new Promise((r) => {
    let fini = false;
    const fin = (v) => { if (fini) return; fini = true; scene.removeEventListener('pointerdown', ecoute); r(v); };
    const ecoute = (e) => fin(e.target.closest?.('.passer') ? 'passer' : 'appui');
    scene.addEventListener('pointerdown', ecoute);
    if (ms) setTimeout(() => fin('temps'), ms);
  });
}

/** L'invocation. resultats : [{ id, rarete, nouveau, vedette, eveil, rendu }]. Rend une promesse (le résumé fermé). */
export async function invocation(scene, resultats, garanties = []) {
  scene.classList.remove('cache');
  scene.innerHTML = '';
  // Un personnage qui peut devenir LR (tiré en SSR) : tout le portail devient arc-en-ciel.
  const lrPossible = resultats.some((r) => peutDevenirLR(r.id) && r.rarete !== 'LR');
  const meilleure = lrPossible ? 'LR' : resultats.reduce((m, r) => (ORDRE.indexOf(r.rarete) > ORDRE.indexOf(m) ? r.rarete : m), 'R');
  const couleur = meilleure === 'LR' ? '#ff4dd8' : meilleure === 'SSR' ? '#ffd23f' : meilleure === 'SR' ? '#d7a23a' : '#8aa0b4';
  const inv = document.createElement('div');
  inv.className = 'inv';
  inv.innerHTML = `<div class="anneau"></div><div class="lumiere" style="--c:${couleur}"></div><span class="passer">Passer ›</span>`;
  scene.appendChild(inv);
  son.portail();
  // Les sphères qui tombent, en arc de cercle.
  const n = resultats.length;
  resultats.forEach((r, i) => {
    const o = document.createElement('div');
    o.className = `orbe ${peutDevenirLR(r.id) ? 'LR' : r.rarete}`;
    const a = n === 1 ? Math.PI / 2 : Math.PI * (0.15 + 0.7 * (i / (n - 1)));
    o.style.left = `calc(50% + ${Math.cos(a) * 28}vmin - 4.5vmin)`;
    o.style.top = `calc(46% + ${Math.sin(a) * 18}vmin - 4.5vmin)`;
    o.style.setProperty('--c', r.rarete === 'LR' ? '#ff4dd8' : r.rarete === 'SSR' ? '#ffd23f' : r.rarete === 'SR' ? '#d7a23a' : '#9ab8d4');
    o.style.animationDelay = `${i * 0.12}s`;
    inv.appendChild(o);
    setTimeout(() => son.tinte(ORDRE.indexOf(r.rarete)), i * 120 + 700);
  });
  if (meilleure === 'LR' || meilleure === 'SSR') {
    const t = document.createElement('div');
    t.className = 'texte-inv';
    t.style.setProperty('--c', couleur);
    t.textContent = lrPossible ? 'Un arc-en-ciel… une future légende !' : meilleure === 'LR' ? 'Une légende s’éveille…' : 'Quelque chose brille…';
    setTimeout(() => { if (inv.querySelector('.anneau:not(.ouvre)')) inv.appendChild(t); }, 1300);
  }
  let r = await appui(scene, 2600);
  if (r !== 'passer') {
    inv.querySelector('.anneau').classList.add('ouvre');
    inv.querySelector('.lumiere').classList.add('eclat');
    son.eclat(meilleure);
    await attendre(900);
    // Les révélations : les SSR, les LR et les nouveaux, un par un.
    for (const res of resultats) {
      const haut = res.rarete === 'SSR' || res.rarete === 'LR';
      if (!haut) continue;
      const x = PERSO[res.id];
      const c = RARETES[res.rarete].couleur;
      const rv = document.createElement('div');
      rv.className = 'revele';
      rv.style.setProperty('--c', c);
      const versLR = peutDevenirLR(res.id) && res.rarete !== 'LR';
      const tag = versLR ? 'PEUT DEVENIR LR !' : res.vedette && res.nouveau ? 'NOUVEAU !' : res.rarete === 'LR' ? 'LR !' : res.rarete === 'SSR' ? 'SSR !' : 'NOUVEAU';
      const grandArt = res.rarete === 'LR' || res.rarete === 'UR' || versLR;
      rv.innerHTML = `<div class="rayons" style="--c:${c}"></div>${grandArt ? `<div class="art-revele${versLR ? ' arc' : ''}">${illustration(x, { taille: 300 })}</div>` : portrait(x, { cadre: true, taille: 300, nom: false, anime: true })}<div class="tag${versLR ? ' arc' : ''}">${tag}</div>${versLR ? `<div class="futur-lr">${portrait(PERSO[formeLR(res.id)], { cadre: true, taille: 90, nom: false })}<small>Sa forme LR, par l’éveil</small></div>` : ''}
        <div class="sous"><b>${x.nom}</b>${x.titre}<br>${res.nouveau ? '✨ Nouveau dans ta collection' : `Éveil ★${res.eveil}${res.rendu ? ` · +${res.rendu} jetons` : ''}`}</div><span class="passer">Passer ›</span>`;
      inv.innerHTML = '';
      inv.appendChild(rv);
      son.revele(res.rarete);
      const finArt = grandArt ? rendreReactif(rv) : () => {};
      if (res.rarete === 'LR' || versLR) { const P = creerParticules(rv); P.gerbe(P.largeur / 2, P.hauteur / 2, '#36d39a', 70, 850); P.gerbe(P.largeur / 2, P.hauteur / 2, '#3ae0ff', 70, 800); P.gerbe(P.largeur / 2, P.hauteur / 2, '#ffd23f', 90, 900); P.gerbe(P.largeur / 2, P.hauteur / 2, '#ff4dd8', 90, 800); }
      r = await appui(scene, 0);
      finArt();
      if (r === 'passer') break;
    }
  }
  // Le résumé.
  scene.innerHTML = '';
  const re = document.createElement('div');
  re.className = 'resume';
  re.innerHTML = `<h2>Invocation</h2><div class="grille">${resultats.map((x, i) => portrait(PERSO[x.id], { cadre: true, taille: 100 }).replace('class="carte', `style="animation-delay:${i * 0.06}s" class="carte`).replace(/<\/div>$/, x.nouveau ? '<span class="neuf">NEW</span></div>' : '</div>')).join('')}</div>
    ${garanties.length ? `<p class="garanties">${garanties.join(' · ')}</p>` : ''}<button class="btn">OK</button>`;
  scene.appendChild(re);
  await new Promise((ok) => re.querySelector('.btn').addEventListener('click', ok, { once: true }));
  scene.classList.add('cache');
  scene.innerHTML = '';
}

/** Les effets de chaque style de super attaque. */
const EFFETS = {
  rayon: (f) => { f.insertAdjacentHTML('beforeend', '<div class="rayon"></div>'); return [900]; },
  combo: (f) => { const n = 7; for (let k = 0; k < n; k++) setTimeout(() => { const d = document.createElement('div'); d.className = 'coup'; d.style.left = `${20 + Math.random() * 50}%`; d.style.top = `${20 + Math.random() * 45}%`; f.appendChild(d); son.coup(); }, k * 110); return [n * 110 + 300]; },
  lame: (f) => { for (let k = 0; k < 5; k++) setTimeout(() => { const d = document.createElement('div'); d.className = 'entaille'; d.style.top = `${25 + Math.random() * 45}%`; d.style.setProperty('--r', `${-35 + Math.random() * 70}deg`); f.appendChild(d); son.lame(); }, k * 120); return [800]; },
  tir: (f) => { f.insertAdjacentHTML('beforeend', '<div class="boule"></div>'); return [750]; },
  explosion: (f) => { for (let k = 0; k < 3; k++) setTimeout(() => { const d = document.createElement('div'); d.className = 'onde'; f.appendChild(d); }, k * 160); return [900]; },
  ombre: (f, x) => { for (let k = 0; k < 6; k++) setTimeout(() => { const d = document.createElement('div'); d.className = 'clone'; d.style.left = `${10 + Math.random() * 60}%`; d.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}vw`); d.innerHTML = portrait(x, { taille: 200 }); f.appendChild(d); son.lame(); }, k * 110); return [900]; },
  meteore: (f) => { for (let k = 0; k < 8; k++) setTimeout(() => { const d = document.createElement('div'); d.className = 'meteore'; d.style.left = `${30 + Math.random() * 70}%`; f.appendChild(d); }, k * 90); return [1000]; },
  glace: (f) => { for (let k = 0; k < 12; k++) setTimeout(() => { const d = document.createElement('div'); d.className = 'cristal'; d.style.left = `${8 + Math.random() * 84}%`; d.style.top = `${30 + Math.random() * 40}%`; f.appendChild(d); }, k * 50); return [900]; },
};

/** Le déroulé d'une cinématique qu'on peut passer d'un appui : chaque attente s'arrête si l'on a touché. */
function deroule(scene) {
  let passe = false;
  const ecoute = () => { passe = true; };
  scene.addEventListener('pointerdown', ecoute);
  return {
    get passe() { return passe; },
    attendre: (ms) => (passe ? Promise.resolve() : new Promise((r) => { const t0 = performance.now(); const pas = () => (passe || performance.now() - t0 >= ms ? r() : requestAnimationFrame(pas)); requestAnimationFrame(pas); })),
    fin() { scene.removeEventListener('pointerdown', ecoute); },
  };
}
/** Un plan (un calque plein écran) dans la cinématique. */
function plan(parent, classe, html = '') {
  const d = document.createElement('div');
  d.className = `plan ${classe}`;
  d.innerHTML = html;
  parent.appendChild(d);
  return d;
}
const grand = (n) => n.toLocaleString('fr-FR');

/**
 * La super attaque d'un personnage, en quatre plans (cinq pour l'ultime d'un LR) :
 *   1. la charge : le personnage, l'aura qui monte, les lignes de vitesse, le sol qui tremble ;
 *   2. (l'ultime) l'éveil : tout devient blanc, le mot ULTIME, l'aura divine ;
 *   3. le gros plan sur le regard, et le nom de l'attaque dans une bande en biais ;
 *   4. l'attaque, propre à son style (rayon, combo, lame, tir, explosion, ombre, météores, glace) ;
 *   5. l'impact sur l'ennemi : arrêt sur image, éclair, éclats, l'écran qui tremble, les dégâts en géant.
 * o : { ultime, ennemi (pour le plan de l'impact), degats, crit }
 */
export async function superAttaque(scene, id, o = {}) {
  const { ultime = false, ennemi = null, degats = 0, crit = false } = o;
  const x = PERSO[id], el = ELEMENTS[x.element];
  const coul = ultime ? x.couleurs.aura : el.couleur;
  scene.classList.remove('cache');
  scene.innerHTML = '';
  const s = document.createElement('div');
  s.className = 'super';
  s.style.setProperty('--el', coul);
  scene.appendChild(s);
  const D = deroule(scene);
  const stop = lignesDeVitesse(s);
  const P = creerParticules(s);
  const cx = () => P.largeur / 2, cy = () => P.hauteur / 2;
  son.superDebut(ultime);

  // 1. La charge.
  const p1 = plan(s, 'charge', `<div class="perso">${portrait(x, { taille: 460, anime: true, fond: false })}</div><div class="titre-super">${ultime ? 'Super attaque ultime' : 'Super attaque'}</div>`);
  const aura = setInterval(() => P.aura(cx(), cy() + 60, 160, coul, 8), 40);
  secouer(s, 3, 900);
  await D.attendre(ultime ? 900 : 750);
  clearInterval(aura);
  // 2. L'éveil (l'ultime seulement).
  if (ultime && !D.passe) {
    p1.remove();
    const p2 = plan(s, 'eveil', `<b>ULTIME</b><div class="perso">${portrait(x, { taille: 520, anime: true, fond: false })}</div>`);
    P.eclats(cx(), cy(), '#ffffff', 10);
    P.gerbe(cx(), cy(), coul, 80, 900);
    son.impact(false);
    await D.attendre(800);
    p2.remove();
  } else p1.remove();
  // 3. Le regard, et le nom de l'attaque.
  if (!D.passe) {
    const p3 = plan(s, 'regard', `<div class="yeux">${portrait(x, { taille: 900, fond: false })}</div><div class="bande"><small>${el.glyphe} ${x.nom}</small><b>${ultime ? x.super.ultime.nom : x.super.nom}</b></div>`);
    son.lame();
    await D.attendre(800);
    p3.remove();
  }
  // 4. L'attaque.
  if (!D.passe) {
    const p4 = plan(s, 'attaque effet', `<div class="perso petit">${portrait(x, { taille: 300, fond: false })}</div>`);
    const [duree] = (EFFETS[x.super.style] || EFFETS.rayon)(p4, x);
    const pluie = { glace: '#e8f8ff', meteore: '#ffb347', explosion: '#ff9a3a', ombre: '#b06bff' }[x.super.style];
    if (pluie) P.pluie(pluie, 50);
    const etincelles = setInterval(() => P.gerbe(P.largeur * (0.3 + Math.random() * 0.5), P.hauteur * (0.3 + Math.random() * 0.4), coul, 12, 500), 120);
    await D.attendre(duree);
    clearInterval(etincelles);
    p4.remove();
  }
  // 5. L'impact.
  const p5 = plan(s, 'impact', `${ennemi ? `<div class="cible">${dessinEnnemi(ennemi, 380)}</div>` : ''}<div class="flash"></div>`);
  await arret(90);
  p5.querySelector('.flash').classList.add('go');
  p5.querySelector('.cible')?.classList.add('touche');
  P.eclats(cx(), cy(), coul, 8);
  P.gerbe(cx(), cy(), '#ffffff', 60, 900);
  P.gerbe(cx(), cy(), coul, 60, 700);
  if (x.super.style === 'explosion' || x.super.style === 'meteore') P.debris(cx(), cy() + 80, '#8a6a4a', 24);
  secouer(s, ultime ? 22 : 14, 420);
  son.impact(true);
  if (degats) p5.insertAdjacentHTML('beforeend', `<div class="degats-geant${crit ? ' crit' : ''}">${crit ? '<small>CRITIQUE !</small>' : ''}${grand(degats)}</div>`);
  await D.attendre(degats ? 900 : 450);
  D.fin();
  stop();
  P.detruire();
  scene.classList.add('cache');
  scene.innerHTML = '';
}

/** La super attaque d'un ennemi : l'alerte, son visage, le nom de l'attaque, puis le coup (écran rouge). */
export async function superEnnemi(scene, e, nom, tous = false) {
  scene.classList.remove('cache');
  scene.innerHTML = '';
  const s = document.createElement('div');
  s.className = 'super ennemie';
  s.style.setProperty('--el', ELEMENTS[e.element].couleur);
  scene.appendChild(s);
  const D = deroule(scene);
  const P = creerParticules(s);
  const stop = lignesDeVitesse(s, '#ff6a6a');
  son.alerte();
  const p = plan(s, 'alerte', `<div class="bandes-alerte"><span>DANGER</span><span>DANGER</span><span>DANGER</span></div><div class="cible grand">${dessinEnnemi(e, 420)}</div>
    <div class="bande rouge"><small>Super attaque ennemie${tous ? ' · sur toute l’équipe' : ''}</small><b>${nom}</b></div>`);
  const aura = setInterval(() => P.aura(P.largeur / 2, P.hauteur / 2, 180, '#ff3a3a', 6), 50);
  secouer(s, 4, 1000);
  await D.attendre(1100);
  clearInterval(aura);
  p.insertAdjacentHTML('beforeend', '<div class="flash rouge go"></div>');
  P.gerbe(P.largeur / 2, P.hauteur / 2, '#ff3a3a', 70, 900);
  secouer(s, 18, 380);
  son.impact(true);
  await D.attendre(420);
  D.fin();
  stop();
  P.detruire();
  scene.classList.add('cache');
  scene.innerHTML = '';
}

/** Un boss qui se transforme : il tremble dans le noir, l'aura l'enveloppe, une explosion de lumière, son nouveau nom. */
export async function transformation(scene, e, nom, texte = '') {
  scene.classList.remove('cache');
  scene.innerHTML = '';
  const s = document.createElement('div');
  s.className = 'super transfo';
  s.style.setProperty('--el', ELEMENTS[e.element].couleur);
  scene.appendChild(s);
  const D = deroule(scene);
  const P = creerParticules(s);
  son.portail();
  const p = plan(s, 'mue', `<div class="cible grand tremble">${dessinEnnemi(e, 420)}</div><div class="texte-transfo">${texte || 'Il se transforme !'}</div>`);
  const aura = setInterval(() => P.aura(P.largeur / 2, P.hauteur / 2, 200, ELEMENTS[e.element].couleur, 10), 40);
  secouer(s, 5, 1400);
  await D.attendre(1400);
  clearInterval(aura);
  p.insertAdjacentHTML('beforeend', '<div class="flash go"></div>');
  P.eclats(P.largeur / 2, P.hauteur / 2, '#ffffff', 12);
  P.gerbe(P.largeur / 2, P.hauteur / 2, ELEMENTS[e.element].couleur, 120, 1100);
  secouer(s, 20, 450);
  son.eclat('LR');
  p.querySelector('.texte-transfo').remove();
  p.insertAdjacentHTML('beforeend', `<div class="bande"><small>Nouvelle forme</small><b>${nom}</b></div>`);
  await D.attendre(1200);
  D.fin();
  P.detruire();
  scene.classList.add('cache');
  scene.innerHTML = '';
}

/** La fin d'un combat : victoire (les jetons gagnés) ou défaite. Rend le bouton choisi ('ok' | 'rejouer'). */
export function finCombat(scene, { victoire, texte, rejouer = true }) {
  scene.classList.remove('cache');
  scene.innerHTML = `<div class="fin-combat" style="--c:${victoire ? '#c98a12' : '#5a1020'}"><h2>${victoire ? 'Victoire !' : 'Défaite…'}</h2><p>${texte || ''}</p>
    <button class="btn" data-v="ok">${victoire ? 'Continuer' : 'Retour'}</button>${rejouer && !victoire ? '<button class="btn sec" data-v="rejouer">Réessayer</button>' : ''}</div>`;
  if (victoire) son.victoire(); else son.defaite();
  return new Promise((ok) => scene.querySelector('.fin-combat').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    scene.classList.add('cache');
    scene.innerHTML = '';
    ok(b.dataset.v);
  }));
}
