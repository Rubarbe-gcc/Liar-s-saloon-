/**
 * STREET COMBAT — les cinématiques : une scène qui bouge (l'arène, les
 * combattants qui entrent, sautent, apparaissent, des effets), des
 * dialogues avec portrait et texte qui s'écrit, des cartons de chapitre,
 * des choix.
 *
 * Une cinématique est une liste d'étapes, jouées l'une après l'autre :
 *   { decor: 'dojo', fondu }                            change l'arène (fondu : au noir, la scène se vide)
 *   { vide: true }                                      tout le monde sort, d'un coup
 *   { titre: 'CHAPITRE 1', sous: '…', sur: '…' }        un carton
 *   { lieu: 'NÉON CITY — 23 h 47' }                     le lieu, en haut à gauche (sans attendre)
 *   { narre: '…' }                                      une voix off
 *   { entre: 'hero'|id, cote: 'g'|'d'|'c'|'gg'|'dd', comment: 'marche'|'saut'|'chute'|'apparait'|'teleport'|'place', p, ombre, corrompu }
 *   { dit: 'hero'|id, texte: '…', p, nom, ombre }       une réplique (nom : « ??? » pour un inconnu)
 *   { pose: 'hero'|id, p: 'garde' }                     change une pose
 *   { devoile: id }                                     une silhouette se révèle
 *   { purifie: id }                                     l'éclat de la Fracture sort de lui : il redevient lui-même
 *   { effet: 'fracture'|'eclair'|'flash'|'secousse'|'gel'|'aube'|'nuit', duree }
 *   { sort: 'hero'|id, comment: 'teleport'|'marche' }  quelqu'un s'en va
 *   { attendre: 40 }                                    une pause (en images)
 *   { choix: [{ texte, drapeau, suite: [...] }], question }   le joueur décide
 *   { si: 'drapeau'|'!drapeau', alors: [...], sinon: [...] }  selon ses choix d'avant
 *   { marque: 'drapeau' }                               lève un drapeau
 *   { debloque: id }                                    un combattant rejoint le roster
 *   { croise: id, indice }                              on le rencontre… on le débloquera plus tard
 *
 * 'hero' désigne le combattant du joueur ; « {hero} » dans un texte, son nom.
 * Les rôles (`roles`) : qui joue qui, quand le héros tient déjà un rôle ;
 * « {id} » dans un texte donne le nom de celui qui le joue.
 */

import { PERSO } from '../../../shared/street/persos.js';
import { dessinerCombattant, dessinerPortrait, rgba } from './dessin.js';
import { ARENE, fondArene, animerArene } from './arenes.js';
import { jouer as son } from './son.js';

const $ = (id) => document.getElementById(id);
const L = 1000;
const H = 600;
const SOL = 470;
const POS = { g: 300, d: 700, gg: 160, dd: 840, c: 500 };

let scene = null;

/**
 * Joue une cinématique. Rend une promesse, résolue à la fin ('fin'), ou
 * quand on la quitte ('quitte'). Les choix faits s'écrivent dans `drapeaux`.
 */
export function jouerCine(etapes, { hero, roles = {}, drapeaux = {}, debloquer = () => {}, croiser = () => {}, quittable = false } = {}) {
  return new Promise((fini) => {
    if (scene) terminer('quitte');
    scene = {
      etapes: [...etapes], i: 0, hero, roles, drapeaux, debloquer, croiser, fini,
      decor: 'dojo', acteurs: new Map(), effets: [], t: 0, attente: null, secousse: 0, rapide: false, fondu: null,
    };
    for (const id of ['cine-boite', 'cine-titre', 'cine-debloque', 'cine-choix']) $(id).hidden = true;
    $('cine-lieu').hidden = true;
    $('cine-quitter').hidden = !quittable;
    dimensionner();
    cancelAnimationFrame(raf);
    boucle();
    suivante();
  });
}

const qui = (w) => (w === 'hero' ? scene.hero : scene.roles[w] || w);
const remplir = (texte) => texte.replace(/\{(\w+)\}/g, (m, id) => (id === 'hero' ? PERSO[scene.hero]?.nom || 'toi' : PERSO[qui(id)]?.nom || m));
const vrai = (cond, d) => (cond.startsWith('!') ? !d[cond.slice(1)] : !!d[cond]);

/* ------------------------------------------------------------------ */
/* Les étapes                                                          */
/* ------------------------------------------------------------------ */

function suivante() {
  const S = scene;
  if (!S) return;
  if (S.i >= S.etapes.length) { terminer('fin'); return; }
  const e = S.etapes[S.i++];
  if (e.decor) {
    // Un fondu au noir : on change de lieu, la scène se vide.
    if (e.fondu && !S.rapide && S.t > 1) { S.fondu = { t: 0, decor: e.decor }; S.attente = { fondu: true }; son('tic'); return; }
    S.decor = e.decor;
    if (e.fondu) S.acteurs.clear();
    suivante();
    return;
  }
  if (e.vide) { S.acteurs.clear(); suivante(); return; }
  if (e.marque) { S.drapeaux[e.marque] = true; suivante(); return; }
  if (e.pose) { const a = S.acteurs.get(qui(e.pose)); if (a) a.pose = e.p; suivante(); return; }
  if (e.si) { S.etapes.splice(S.i, 0, ...((vrai(e.si, S.drapeaux) ? e.alors : e.sinon) || [])); suivante(); return; }
  if (e.lieu) { if (!S.rapide) montrerLieu(e.lieu); suivante(); return; }
  if (e.devoile) {
    const a = S.acteurs.get(qui(e.devoile));
    if (a) a.ombre = false;
    if (S.rapide) { suivante(); return; }
    S.effets.push({ nom: 'flash', t: 0, duree: 30 });
    son('impact-lourd');
    S.attente = { fin: S.t + 30 };
    return;
  }
  if (e.purifie) {
    const a = S.acteurs.get(qui(e.purifie));
    if (!a || !a.corrompu) { suivante(); return; }
    a.corrompu = false;
    if (S.rapide) { suivante(); return; }
    S.effets.push({ nom: 'purif', t: 0, duree: 60, x: a.x, y: a.y - 95 });
    son('ulti');
    S.attente = { fin: S.t + 50 };
    return;
  }
  if (e.choix) { montrerChoix(e); return; }
  if (e.debloque) { montrerCarte(e.debloque, 'debloque'); return; }
  if (e.croise) { montrerCarte(e.croise, 'croise', e.indice); return; }
  // En avance rapide : le reste s'applique sans attendre.
  if (S.rapide) { appliquer(e); suivante(); return; }
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
    const a = nouvelActeur(e);
    if (a.comment === 'teleport') son('combo');
    // « place » : il est déjà là, sans entrée.
    if (a.comment === 'place') { a.entree = 1; suivante(); return; }
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
    parler(e.dit, e.texte, e);
    return;
  }
  suivante();
}

function nouvelActeur(e) {
  const S = scene;
  const id = qui(e.entre);
  const cote = e.cote || 'd';
  const x = e.x ?? POS[cote];
  const dir = e.dir ?? (x < L / 2 ? 1 : -1);
  const comment = e.comment || 'marche';
  const a = { id, x, y: SOL, dir, pose: e.p || 'repos', alpha: 1, t: 0, comment, cible: x, entree: 0, ombre: !!e.ombre, corrompu: !!e.corrompu };
  if (comment === 'marche') { a.x = x < L / 2 ? -80 : L + 80; a.pose = 'marche'; }
  if (comment === 'saut') { a.depart = x < L / 2 ? -80 : L + 80; }
  if (comment === 'chute') a.y = -200;
  if (comment === 'apparait' || comment === 'teleport') a.alpha = 0;
  a.poseFinale = e.p || 'repos';
  S.acteurs.set(id, a);
  return a;
}

/** En avance rapide : l'état que l'étape aurait laissé. */
function appliquer(e) {
  const S = scene;
  if (e.entre) { const a = nouvelActeur(e); a.x = a.cible; a.y = SOL; a.alpha = 1; a.entree = 1; a.pose = a.poseFinale; }
  if (e.sort) S.acteurs.delete(qui(e.sort));
  if (e.dit) { const a = S.acteurs.get(qui(e.dit)); if (a && e.p) a.pose = e.p; }
  if (e.effet && ['gel', 'nuit', 'aube', 'fracture'].includes(e.effet)) S.effets.push({ nom: e.effet, t: 99, duree: 1 });
}

function terminer(comment) {
  const S = scene;
  scene = null;
  cancelAnimationFrame(raf);
  for (const id of ['cine-boite', 'cine-titre', 'cine-debloque', 'cine-choix', 'cine-lieu']) $(id).hidden = true;
  if (S) S.fini(comment);
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

/** Passer : on saute les dialogues, mais pas les choix ni les combattants rencontrés. */
export function passerCine() {
  const S = scene;
  if (!S || S.attente?.choix) return;
  S.rapide = true;
  S.fondu = null;
  if (S.attente?.tap && !$('cine-debloque').hidden) return;
  // Celui qui entrait ou sortait arrive tout de suite.
  for (const a of S.acteurs.values()) {
    if (a.sortie) S.acteurs.delete(a.id);
    else { a.x = a.cible; a.y = SOL; a.alpha = 1; a.entree = 1; a.pose = a.poseFinale; }
  }
  S.attente = null;
  S.ecrit = null;
  $('cine-boite').hidden = true;
  $('cine-titre').hidden = true;
  suivante();
}

/** Quitter en pleine scène (la partie est sauvegardée au début de la scène). */
export function quitterCine() {
  if (scene) terminer('quitte');
}

/** Choisir une réponse au clavier (1, 2, 3). */
export function choisirCine(n) {
  const b = $('cine-choix').querySelectorAll('button')[n];
  if (b && scene?.attente?.choix) b.click();
}

function parler(w, texte, e = {}) {
  const S = scene;
  const boite = $('cine-boite');
  boite.hidden = false;
  boite.classList.toggle('narration', !w);
  const pc = $('cine-portrait');
  pc.hidden = !w;
  const nom = $('cine-nom');
  if (w) {
    const p = PERSO[qui(w)];
    const a = S.acteurs.get(p.id);
    const ombre = e.ombre ?? a?.ombre ?? false;
    const g = pc.getContext('2d');
    g.clearRect(0, 0, pc.width, pc.height);
    dessinerPortrait(g, p, pc.width, { t: 8, dir: 1, ombre, corrompu: !ombre && a?.corrompu });
    nom.textContent = e.nom || (ombre ? '???' : p.nom);
    const c = ombre ? '#a898c8' : p.c.c1;
    nom.style.color = c;
    boite.style.setProperty('--c', c);
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
  $('cine-titre-texte').textContent = remplir(e.titre);
  $('cine-titre-sous').textContent = remplir(e.sous || '');
  const c = $('cine-titre');
  c.hidden = false;
  c.classList.remove('entre'); void c.offsetWidth; c.classList.add('entre');
  son('annonce');
  S.attente = { tap: true };
}

let lieuT = 0;
function montrerLieu(texte) {
  const l = $('cine-lieu');
  l.textContent = remplir(texte);
  l.hidden = false;
  l.classList.remove('entre'); void l.offsetWidth; l.classList.add('entre');
  clearTimeout(lieuT);
  lieuT = setTimeout(() => { l.hidden = true; }, 4200);
}

function montrerChoix(e) {
  const S = scene;
  const boite = $('cine-choix');
  boite.innerHTML = `${e.question ? `<p>${remplir(e.question)}</p>` : ''}${e.choix.map((c, k) => `<button class="btn${k === 0 ? ' rouge' : ' bleu'}" data-k="${k}"><kbd>${k + 1}</kbd> ${remplir(c.texte)}</button>`).join('')}`;
  boite.hidden = false;
  $('cine-boite').hidden = true;
  son('annonce');
  S.attente = { choix: true };
  boite.onclick = (ev) => {
    const b = ev.target.closest('[data-k]');
    if (!b || scene !== S) return;
    ev.stopPropagation();
    const c = e.choix[Number(b.dataset.k)];
    if (c.drapeau) S.drapeaux[c.drapeau] = true;
    boite.hidden = true;
    son('valide');
    S.attente = null;
    S.etapes.splice(S.i, 0, ...(c.suite || []));
    suivante();
  };
}

/** Un combattant débloqué, ou seulement rencontré (on saura où le gagner). */
function montrerCarte(id, sorte, indice = '') {
  const S = scene;
  const p = PERSO[qui(id)];
  const debloque = sorte === 'debloque';
  if (debloque) S.debloquer(p.id); else S.croiser(p.id);
  const d = $('cine-debloque');
  d.classList.toggle('croise', !debloque);
  d.innerHTML = debloque
    ? `<small>NOUVEAU COMBATTANT DÉBLOQUÉ</small><canvas width="260" height="260"></canvas><b style="color:${p.c.c1}">${p.nom}</b><span>${p.style}</span>`
    : `<small>NOUVELLE RENCONTRE</small><canvas width="260" height="260"></canvas><b style="color:${p.c.c1}">${p.nom}</b><span>${p.style}</span><em>🔒 ${remplir(indice)}</em>`;
  dessinerPortrait(d.querySelector('canvas').getContext('2d'), p, 260, { aura: debloque ? 1 : 0.4, t: 10, pose: 'repos' });
  d.hidden = false;
  son(debloque ? 'victoire' : 'annonce');
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
  // Le fondu au noir : à mi-chemin, on change de lieu.
  if (S.fondu) {
    S.fondu.t += 1;
    if (S.fondu.t === 22) { S.decor = S.fondu.decor; S.acteurs.clear(); S.effets = []; }
    if (S.fondu.t >= 44) { S.fondu = null; S.attente = null; suivante(); }
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
  if (at && !at.tap && !at.choix && !at.fondu) {
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
      aura: a.comment === 'apparait' && a.entree < 1 ? 1 - a.alpha : 0, echelle: 1.15, enLAir: a.y < SOL - 2, ombre: a.ombre, corrompu: a.corrompu,
    });
    if ((a.comment === 'teleport' || a.comment === 'apparait') && a.alpha < 1 && !a.sortie) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(a.x, a.y - 90, 0, a.x, a.y - 90, 140);
      gr.addColorStop(0, rgba(a.ombre ? '#8a7aa8' : PERSO[a.id].c.c1, 0.7 * (1 - a.alpha))); gr.addColorStop(1, rgba('#000000', 0));
      g.fillStyle = gr; g.beginPath(); g.arc(a.x, a.y - 90, 140, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
  for (const f of S.effets) effetDevant(g, f, S);
  g.restore();
  if (S.fondu) { g.fillStyle = `rgba(0,0,0,${1 - Math.abs(S.fondu.t - 22) / 22})`; g.fillRect(0, 0, L, H); }
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
  if (f.nom === 'purif') {
    // L'éclat jaillit de sa poitrine, monte et se brise ; une onde violette, puis blanche.
    const p = f.t / f.duree;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [r, c] of [[p * 260, '#c814ff'], [p * 180, '#ffffff']]) {
      g.strokeStyle = rgba(c, Math.max(0, 1 - p)); g.lineWidth = 8 * (1 - p) + 1;
      g.beginPath(); g.ellipse(f.x, f.y, r, r * 0.6, 0, 0, Math.PI * 2); g.stroke();
    }
    const y = f.y - p * 220;
    const gr = g.createRadialGradient(f.x, y, 0, f.x, y, 40);
    gr.addColorStop(0, rgba('#ff9aff', 1 - p)); gr.addColorStop(1, rgba('#c814ff', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(f.x, y, 40, 0, Math.PI * 2); g.fill();
    if (p < 0.7) { g.fillStyle = '#f0a0ff'; g.beginPath(); g.moveTo(f.x, y - 14); g.lineTo(f.x + 7, y); g.lineTo(f.x, y + 14); g.lineTo(f.x - 7, y); g.closePath(); g.fill(); }
    else for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const d = (p - 0.7) * 300; g.fillStyle = rgba('#f0a0ff', 1 - p); g.fillRect(f.x + Math.cos(a) * d, y + Math.sin(a) * d, 4, 4); }
    g.restore();
    if (f.t < 8) { g.fillStyle = `rgba(255,230,255,${0.6 * (1 - f.t / 8)})`; g.fillRect(0, 0, L, H); }
  }
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
