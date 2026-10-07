/**
 * STREET COMBAT — les cinématiques : une scène qui bouge (l'arène, les
 * combattants qui entrent, sautent, apparaissent, des effets), des
 * dialogues avec portrait et texte qui s'écrit, des cartons de chapitre.
 *
 * Une cinématique est une liste d'étapes, jouées l'une après l'autre :
 *   { decor: 'dojo' }                                   change l'arène
 *   { titre: 'CHAPITRE 1', sous: '…', sur: '…' }        un carton
 *   { narre: '…' }                                      une voix off
 *   { entre: 'hero'|id, cote: 'g'|'d'|'c', comment: 'marche'|'saut'|'chute'|'apparait'|'teleport'|'place', p }
 *   { dit: 'hero'|id, texte: '…', pose }                une réplique
 *   { pose: 'hero'|id, p: 'garde' }                     change une pose
 *   { effet: 'fracture'|'eclair'|'flash'|'secousse'|'gel'|'aube'|'nuit', duree }
 *   { sort: 'hero'|id, comment: 'teleport'|'marche' }  quelqu'un s'en va
 *   { attendre: 40 }                                    une pause (en images)
 *   { debloque: id }                                    un combattant rejoint le roster
 *
 * 'hero' désigne le combattant du joueur ; « {hero} » dans un texte, son nom.
 */

import { PERSO } from '../../../shared/street/persos.js';
import { dessinerCombattant, dessinerPortrait, rgba } from './dessin.js';
import { ARENE, fondArene, animerArene } from './arenes.js';
import { jouer as son } from './son.js';

const $ = (id) => document.getElementById(id);
const L = 1000;
const H = 600;
const SOL = 470;
const POS = { g: 300, d: 700, gg: 180, dd: 820, c: 500 };

let scene = null;

/** Joue une cinématique. Rend une promesse, résolue à la fin (ou quand on passe). */
export function jouerCine(etapes, { hero, debloquer = () => {} } = {}) {
  return new Promise((fini) => {
    scene = {
      etapes: [...etapes], i: 0, hero, debloquer, fini,
      decor: 'dojo', acteurs: new Map(), effets: [], t: 0, attente: null, secousse: 0, saute: false,
    };
    $('cine-boite').hidden = true;
    $('cine-titre').hidden = true;
    $('cine-debloque').hidden = true;
    dimensionner();
    boucle();
    suivante();
  });
}

const qui = (w) => (w === 'hero' ? scene.hero : w);
const nomDe = (w) => (w === 'narrateur' ? '' : PERSO[qui(w)]?.nom || w);
const remplir = (texte) => texte.replaceAll('{hero}', PERSO[scene.hero]?.nom || 'toi');

/* ------------------------------------------------------------------ */
/* Les étapes                                                          */
/* ------------------------------------------------------------------ */

function suivante() {
  const S = scene;
  if (!S) return;
  if (S.i >= S.etapes.length) { terminer(); return; }
  const e = S.etapes[S.i++];
  if (e.decor) { S.decor = e.decor; suivante(); return; }
  if (e.pose) { const a = S.acteurs.get(qui(e.pose)); if (a) a.pose = e.p; suivante(); return; }
  if (e.attendre) { S.attente = { fin: S.t + e.attendre }; return; }
  if (e.effet) {
    S.effets.push({ nom: e.effet, t: 0, duree: e.duree || 70, x: e.x });
    if (e.effet === 'eclair' || e.effet === 'flash') son('impact-lourd');
    if (e.effet === 'fracture') son('ulti');
    if (e.effet === 'secousse') { S.secousse = 14; son('boum'); }
    if (e.effet === 'gel') son('contre');
    S.attente = e.attendre === false ? null : { fin: S.t + Math.min(e.duree || 70, 60) };
    if (!S.attente) suivante();
    return;
  }
  if (e.entre) {
    const id = qui(e.entre);
    const cote = e.cote || 'd';
    const x = e.x ?? POS[cote];
    const dir = e.dir ?? (x < L / 2 ? 1 : -1);
    const comment = e.comment || 'marche';
    const a = { id, x, y: SOL, dir, pose: e.p || 'repos', alpha: 1, t: 0, comment, cible: x, entree: 0 };
    if (comment === 'marche') { a.x = x < L / 2 ? -80 : L + 80; a.pose = 'marche'; }
    if (comment === 'saut') { a.depart = x < L / 2 ? -80 : L + 80; }
    if (comment === 'chute') a.y = -200;
    if (comment === 'apparait' || comment === 'teleport') a.alpha = 0;
    if (comment === 'teleport') son('combo');
    a.poseFinale = e.p || 'repos';
    S.acteurs.set(id, a);
    // « place » : il est déjà là, sans entrée.
    if (comment === 'place') { a.entree = 1; suivante(); return; }
    S.attente = { acteur: a };
    return;
  }
  if (e.sort) {
    const a = S.acteurs.get(qui(e.sort));
    if (!a) { suivante(); return; }
    a.sortie = e.comment || 'teleport';
    a.entree = 0;
    S.attente = { sortie: a };
    return;
  }
  if (e.titre) { montrerTitre(e); return; }
  if (e.narre) { parler(null, e.narre); return; }
  if (e.dit) {
    const a = S.acteurs.get(qui(e.dit));
    if (a && e.p) a.pose = e.p;
    parler(e.dit, e.texte);
    return;
  }
  if (e.debloque) { montrerDebloque(e.debloque); return; }
  suivante();
}

function terminer() {
  const S = scene;
  scene = null;
  cancelAnimationFrame(raf);
  $('cine-boite').hidden = true;
  $('cine-titre').hidden = true;
  $('cine-debloque').hidden = true;
  if (S) S.fini();
}

/** Toucher l'écran : finir d'écrire la réplique, ou passer à la suivante. */
export function avancerCine() {
  const S = scene;
  if (!S) return;
  if (S.ecrit && S.ecrit.n < S.ecrit.texte.length) { S.ecrit.n = S.ecrit.texte.length; return; }
  if (S.attente?.tap) {
    S.attente = null;
    $('cine-boite').hidden = true;
    $('cine-titre').hidden = true;
    $('cine-debloque').hidden = true;
    S.ecrit = null;
    son('tic');
    suivante();
  }
}

/** Passer : on saute tout, sauf les combattants débloqués (on les montre quand même). */
export function passerCine() {
  const S = scene;
  if (!S) return;
  const reste = S.etapes.slice(S.i);
  const deb = reste.filter((e) => e.debloque);
  S.etapes = [...reste.filter((e) => e.decor), ...deb];
  S.i = 0;
  S.attente = null;
  S.ecrit = null;
  $('cine-boite').hidden = true;
  $('cine-titre').hidden = true;
  suivante();
}

function parler(w, texte) {
  const S = scene;
  const boite = $('cine-boite');
  boite.hidden = false;
  boite.classList.toggle('narration', !w);
  const pc = $('cine-portrait');
  pc.hidden = !w;
  const nom = $('cine-nom');
  if (w) {
    const p = PERSO[qui(w)];
    const g = pc.getContext('2d');
    g.clearRect(0, 0, pc.width, pc.height);
    dessinerPortrait(g, p, pc.width, { t: 8, dir: 1 });
    nom.textContent = p.nom;
    nom.style.color = p.c.c1;
    boite.style.setProperty('--c', p.c.c1);
  } else {
    nom.textContent = '';
    boite.style.setProperty('--c', '#b9a8d6');
  }
  S.ecrit = { texte: remplir(texte), n: 0, qui: w ? qui(w) : null };
  $('cine-texte').textContent = '';
  S.attente = { tap: true };
}

function montrerTitre(e) {
  const S = scene;
  $('cine-titre-sur').textContent = e.sur || '';
  $('cine-titre-texte').textContent = e.titre;
  $('cine-titre-sous').textContent = e.sous || '';
  const c = $('cine-titre');
  c.hidden = false;
  c.classList.remove('entre'); void c.offsetWidth; c.classList.add('entre');
  son('annonce');
  S.attente = { tap: true };
}

function montrerDebloque(id) {
  const S = scene;
  const p = PERSO[id];
  S.debloquer(id);
  const d = $('cine-debloque');
  d.innerHTML = `<small>NOUVEAU COMBATTANT DÉBLOQUÉ</small><canvas width="260" height="260"></canvas><b style="color:${p.c.c1}">${p.nom}</b><span>${p.style}</span>`;
  dessinerPortrait(d.querySelector('canvas').getContext('2d'), p, 260, { aura: 1, t: 10, pose: 'repos' });
  d.hidden = false;
  son('victoire');
  S.attente = { tap: true };
}

/* ------------------------------------------------------------------ */
/* L'image                                                             */
/* ------------------------------------------------------------------ */

let raf = 0;

export function dimensionner() {
  const cv = $('cine-canvas');
  const r = Math.min(2, window.devicePixelRatio || 1);
  const e = Math.min(innerWidth / L, innerHeight / H);
  cv.style.width = `${L * e}px`;
  cv.style.height = `${H * e}px`;
  cv.width = Math.round(L * e * r);
  cv.height = Math.round(H * e * r);
}

function boucle() {
  raf = requestAnimationFrame(boucle);
  const S = scene;
  if (!S) return;
  S.t += 1;
  avancer(S);
  dessiner(S);
}

function avancer(S) {
  // Le texte s'écrit, lettre par lettre.
  if (S.ecrit && S.ecrit.n < S.ecrit.texte.length) {
    S.ecrit.n = Math.min(S.ecrit.texte.length, S.ecrit.n + 1.2);
    $('cine-texte').textContent = S.ecrit.texte.slice(0, Math.floor(S.ecrit.n));
    if (Math.floor(S.ecrit.n) % 3 === 0) son('tic');
  }
  for (const a of S.acteurs.values()) {
    a.t += 1;
    if (a.sortie) {
      a.entree += 1;
      if (a.sortie === 'marche') { a.pose = 'marche'; a.dir = a.x < L / 2 ? -1 : 1; a.x += a.dir * 9; }
      else a.alpha = Math.max(0, 1 - a.entree / 20);
      if (a.entree > 40) S.acteurs.delete(a.id);
      continue;
    }
    if (a.entree >= 1) continue;
    const p = Math.min(1, a.t / 45);
    if (a.comment === 'marche') { a.x = a.x + (a.cible - a.x) * 0.09; if (Math.abs(a.x - a.cible) < 2) { a.x = a.cible; a.entree = 1; } }
    else if (a.comment === 'saut') { a.x = a.depart + (a.cible - a.depart) * p; a.y = SOL - Math.sin(p * Math.PI) * 220; a.pose = p < 1 ? 'saut' : a.poseFinale; if (p >= 1) { a.entree = 1; son('chute'); S.secousse = 6; } }
    else if (a.comment === 'chute') { a.y = Math.min(SOL, -200 + (SOL + 200) * p * p); a.pose = p < 1 ? 'saut' : a.poseFinale; if (p >= 1) { a.entree = 1; S.secousse = 10; son('chute'); } }
    else { a.alpha = p; if (p >= 1) a.entree = 1; }
    if (a.entree === 1) a.pose = a.poseFinale;
  }
  for (const f of S.effets) f.t += 1;
  S.effets = S.effets.filter((f) => f.t < f.duree || f.nom === 'gel' || f.nom === 'nuit' || f.nom === 'aube' || f.nom === 'fracture');
  S.secousse *= 0.88;
  // Ce qu'on attend est fini : la suite.
  const at = S.attente;
  if (at && !at.tap) {
    const fini = (at.fin !== undefined && S.t >= at.fin) || (at.acteur && at.acteur.entree >= 1) || (at.sortie && !S.acteurs.has(at.sortie.id));
    if (fini) { S.attente = null; suivante(); }
  }
}

function dessiner(S) {
  const cv = $('cine-canvas');
  const g = cv.getContext('2d');
  const e = cv.width / L;
  g.setTransform(e, 0, 0, e, 0, 0);
  g.save();
  if (S.secousse > 0.3) g.translate((Math.random() - 0.5) * S.secousse, (Math.random() - 0.5) * S.secousse);
  const arene = ARENE[S.decor] || ARENE.dojo;
  g.drawImage(fondArene(arene), 0, 0, L, H);
  animerArene(g, arene, S.t);
  for (const f of S.effets) effetFond(g, f, S);
  // Les combattants, celui qui parle un peu mis en avant.
  for (const a of S.acteurs.values()) {
    const parle = S.ecrit && S.ecrit.qui === a.id && S.ecrit.n < S.ecrit.texte.length;
    dessinerCombattant(g, PERSO[a.id], {
      x: a.x, y: a.y, dir: a.dir, pose: a.pose, t: a.t + (parle ? Math.floor(S.t / 4) : 0), p: 1, alpha: a.alpha,
      aura: a.comment === 'apparait' && a.entree < 1 ? 1 - a.alpha : 0, echelle: 1.15, enLAir: a.y < SOL - 2,
    });
    if ((a.comment === 'teleport' || a.comment === 'apparait') && a.alpha < 1 && !a.sortie) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(a.x, a.y - 90, 0, a.x, a.y - 90, 140);
      gr.addColorStop(0, rgba(PERSO[a.id].c.c1, 0.7 * (1 - a.alpha))); gr.addColorStop(1, rgba(PERSO[a.id].c.c1, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(a.x, a.y - 90, 140, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
  for (const f of S.effets) effetDevant(g, f, S);
  g.restore();
  // Les bandes de cinéma.
  g.fillStyle = '#000';
  g.fillRect(0, 0, L, 46); g.fillRect(0, H - 46, L, 46);
}

/** Les effets derrière les combattants (le ciel qui se fend, la nuit, l'aube). */
function effetFond(g, f, S) {
  if (f.nom === 'fracture') {
    const p = Math.min(1, f.t / 50);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba('#ff50ff', 0.8); g.lineWidth = 6 + Math.sin(S.t / 4) * 2;
    g.shadowColor = '#c814ff'; g.shadowBlur = 30;
    g.beginPath(); g.moveTo(500, 40);
    const pts = [[470, 90], [530, 140], [480, 200], [540, 250], [500, 300]];
    for (let i = 0; i < pts.length * p; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
    const gr = g.createRadialGradient(500, 170, 10, 500, 170, 260 * p);
    gr.addColorStop(0, 'rgba(200,20,255,0.35)'); gr.addColorStop(1, 'rgba(200,20,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, L, SOL);
    g.restore();
  }
  if (f.nom === 'nuit') { g.fillStyle = `rgba(0,0,20,${Math.min(0.5, f.t / 60)})`; g.fillRect(0, 0, L, H); }
  if (f.nom === 'aube') {
    const gr = g.createLinearGradient(0, 0, 0, SOL);
    gr.addColorStop(0, `rgba(255,170,90,${Math.min(0.45, f.t / 80)})`); gr.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, L, H);
  }
}

/** Les effets devant (l'éclair, le flash, le temps figé). */
function effetDevant(g, f, S) {
  const v = 1 - f.t / f.duree;
  if (f.nom === 'flash') { g.fillStyle = `rgba(255,255,255,${Math.max(0, v)})`; g.fillRect(0, 0, L, H); }
  if (f.nom === 'eclair' && f.t < 20) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.shadowColor = '#c8c8ff'; g.shadowBlur = 24;
    const x = f.x ?? 500;
    g.beginPath(); g.moveTo(x + 40, 0);
    for (let y = 0; y < SOL; y += 60) g.lineTo(x + (Math.sin(y * 13.1) * 40), y);
    g.lineTo(x, SOL); g.stroke();
    g.fillStyle = `rgba(255,255,255,${0.5 * (1 - f.t / 20)})`; g.fillRect(0, 0, L, H);
    g.restore();
  }
  if (f.nom === 'gel') {
    // Le temps s'arrête : tout pâlit, une horloge apparaît.
    g.fillStyle = `rgba(150,220,210,${Math.min(0.35, f.t / 40)})`; g.fillRect(0, 0, L, H);
    g.save(); g.globalAlpha = Math.min(0.6, f.t / 40);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 5;
    g.beginPath(); g.arc(500, 220, 140, 0, Math.PI * 2); g.stroke();
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(500, 220); g.lineTo(500, 120); g.moveTo(500, 220); g.lineTo(560, 220); g.stroke();
    g.restore();
  }
}
