/**
 * CROCHET — le combat en 3D.
 *
 * Ce module ne joue pas : il montre une « vue » du combat (où sont les deux
 * boxeurs, ce qu'ils font), venue du moteur (shared/boxe/combat.js). Les
 * boxeurs partent du joueur commun (commun/trois/joueurs3d.js) : torse nu, le
 * short et les gants à leurs couleurs. Leurs poses de boxe (la garde, le jab,
 * le crochet, l'uppercut, l'esquive, la tête qui part sous un coup, le tapis)
 * et la caméra de télévision, de côté, qui suit les deux boxeurs.
 *
 * Repère : moteur (x, y) → 3D (x, HAUT, -y).
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { creerJoueur, poseDe, poser } from '../../../commun/trois/joueurs3d.js';
import { creerRing, HAUT } from './ring3d.js';
import { creerFeux, creerPresse } from '../../../commun/trois/fete3d.js';
import { COUPS } from '../../../../../shared/boxe/terrain.js';

export { THREE, HAUT };

const CLE_QUALITE = 'crochet.qualite';
export function qualite() {
  try { const q = localStorage.getItem(CLE_QUALITE); if (q) return q; } catch { /* ignore */ }
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'moyenne' : 'haute';
}
export function reglerQualite(q) { try { localStorage.setItem(CLE_QUALITE, q); } catch { /* ignore */ } }

/** Un boxeur : le joueur commun, torse nu, le short et les gants à ses couleurs. */
/** L'arbitre : chemise blanche, nœud papillon et pantalon noirs (le joueur commun, rhabillé). */
function creerArbitre() {
  const kit = { fond: '#f4f4f4', motif: 'uni', motifC: '#f4f4f4', short: '#16161a', bas: '#16161a', num: '#f4f4f4' };
  const f = creerJoueur({ kit, numero: '', nom: 'Gaston Verdelet' });
  const noir = new THREE.MeshLambertMaterial({ color: '#16161a', flatShading: true });
  // Le pantalon : les cuisses en noir aussi.
  for (const j of [f.JA, f.JB]) j.hanche.children[0].material = noir;
  // Le nœud papillon, sous le menton.
  const noeud = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.03), noir);
  noeud.position.set(0, 0.58, 0.145);
  f.torse.add(noeud);
  f.racine.scale.setScalar(1.06);
  f.racine.visible = false;
  return f;
}

function creerBoxeur(b) {
  const kit = { fond: '#000000', motif: 'uni', motifC: '#000000', short: b.couleurs.short, bas: '#f4f4f4', num: '#ffffff' };
  const f = creerJoueur({ kit, numero: '', nom: b.nom });
  // La peau à lui (le matériau commun est partagé) : le visage et le corps rougissent sous les coups.
  const base = f.tete.children[0].material;
  const visage = base.clone(), peau = base.clone();
  f.tete.children[0].material = visage;
  f.torse.children[0].material = peau;
  f.torse.children[1].material = peau;
  f.marques = creerMarques(f, visage, peau);
  const gant = new THREE.MeshLambertMaterial({ color: b.couleurs.gants, flatShading: true });
  for (const bras of [f.A, f.B]) {
    bras.ep.children[0].material = peau;
    bras.coude.children[0].material = peau;
    const main = bras.coude.children[1];
    main.material = gant;
    main.scale.set(1.9, 1.5, 1.8);
    main.position.y = 0.11;
  }
  // La ceinture du short, au liseré.
  const ceinture = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.06, 0.3), new THREE.MeshLambertMaterial({ color: b.couleurs.liseré, flatShading: true }));
  ceinture.position.y = 0.07;
  f.bassin.add(ceinture);
  f.racine.scale.setScalar(1.08 * b.taille);
  return f;
}

/**
 * Les marques des coups, qui s'installent au fil du combat : le visage qui rougit, les bleus aux pommettes
 * et au front, le nez qui saigne, un œil puis l'autre qui gonflent (et se ferment), l'arcade ouverte et le
 * filet de sang ; au corps, la peau qui rougit et des marques sur les côtes.
 * Chacune a son seuil (les dégâts reçus à la tête ou au corps) et apparaît peu à peu.
 */
const BLEU = '#5e2350', SANG = '#8f0c12';
function creerMarques(f, visage, peau) {
  const plaque = (parent, l, h, x, y, z, couleur, ry = 0, origineHaut = false) => {
    const g = new THREE.BoxGeometry(l, h, 0.01);
    if (origineHaut) g.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: couleur, transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z); m.rotation.y = ry; m.visible = false;
    parent.add(m);
    return m;
  };
  const gonfle = (x) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), new THREE.MeshLambertMaterial({ color: BLEU, flatShading: true }));
    m.position.set(x, 0.025, 0.138); m.visible = false;
    f.tete.add(m);
    return m;
  };
  const yeux = f.tete.children.filter((c) => c.geometry?.type === 'BoxGeometry' && Math.abs(c.position.z - 0.152) < 0.001);
  return {
    visage, peau, teint: visage.color.clone(), teintCorps: peau.color.clone(), yeux,
    // [la marque, seuil, pleine à (dégâts en plus), opacité max] — seuils à la tête (un combat : ~170 en tout).
    tete: [
      [plaque(f.tete, 0.095, 0.075, 0.088, -0.03, 0.148, BLEU, 0.55), 20, 40, 0.8],
      [plaque(f.tete, 0.095, 0.075, -0.088, -0.03, 0.148, BLEU, -0.55), 40, 40, 0.8],
      [plaque(f.tete, 0.11, 0.05, 0.02, 0.095, 0.152, BLEU, 0), 60, 40, 0.7],
      [plaque(f.tete, 0.05, 1, 0, -0.04, 0.168, SANG, 0, true), 50, 70, 0.95],
      [plaque(f.tete, 0.07, 0.02, -0.062, 0.074, 0.162, SANG, -0.2), 100, 20, 1],
      [plaque(f.tete, 0.022, 1, -0.085, 0.07, 0.158, SANG, -0.35, true), 105, 80, 0.95],
    ],
    oeilG: gonfle(0.058), oeilD: gonfle(-0.058),
    corps: [
      [plaque(f.torse, 0.11, 0.09, 0.14, 0.22, 0.137, '#a3263a'), 10, 20, 0.6],
      [plaque(f.torse, 0.11, 0.09, -0.14, 0.2, 0.137, '#a3263a'), 22, 20, 0.6],
      [plaque(f.torse, 0.08, 0.07, 0.15, 0.36, 0.137, BLEU), 38, 20, 0.6],
    ],
    // Le sang qui a coulé sur la poitrine (seuil à la tête).
    poitrine: plaque(f.torse, 0.05, 1, -0.02, 0.56, 0.138, SANG, 0, true),
  };
}

const _ROUGE = new THREE.Color('#a32f3f');
/** Met les marques à jour d'après les dégâts reçus (gardés tels quels quand la vue ne les donne pas : les cinématiques). */
function majMarques(f, p) {
  const M = f.marques;
  if (p.degTete !== undefined) { M.dt = p.degTete; M.dc = p.degCorps; }
  const dt = M.dt || 0, dc = M.dc || 0;
  const montee = (d, seuil, plein) => Math.max(0, Math.min(1, (d - seuil) / plein));
  for (const [m, seuil, plein, op] of M.tete) {
    const k = montee(dt, seuil, plein);
    m.visible = k > 0;
    m.material.opacity = k * op;
    // Le sang coule : le filet s'allonge avec les coups.
    if (m.geometry.parameters.height === 1) m.scale.y = 0.02 + k * (m.position.x === 0 ? 0.12 : 0.17);
  }
  const kp = montee(dt, 130, 80);
  M.poitrine.visible = kp > 0; M.poitrine.material.opacity = kp * 0.85; M.poitrine.scale.y = 0.02 + kp * 0.24;
  for (const [m, seuil, plein, op] of M.corps) { const k = montee(dc, seuil, plein); m.visible = k > 0; m.material.opacity = k * op; }
  // Les yeux : le gauche gonfle, puis le droit ; à fond, l'œil n'est plus qu'une fente.
  [[M.oeilG, 75, 70, 0], [M.oeilD, 140, 60, 1]].forEach(([m, seuil, plein, i]) => {
    const k = montee(dt, seuil, plein);
    m.visible = k > 0;
    m.scale.set(0.6 + 0.9 * k, 0.5 + 0.6 * k, 0.4 + 0.45 * k);
    const oeil = M.yeux.find((y) => Math.sign(y.position.x) === Math.sign(m.position.x));
    if (oeil) oeil.scale.y = 1 - 0.8 * k;
  });
  M.visage.color.copy(M.teint).lerp(_ROUGE, Math.min(0.6, dt / 330));
  M.peau.color.copy(M.teintCorps).lerp(_ROUGE, Math.min(0.45, dc / 100 + dt / 900));
}

/** Combien il est entamé (0 : frais ; 1 : à bout) : la santé et le souffle. */
const usure = (p) => (p.sante === undefined ? 0 : Math.max(0, Math.min(1, (1 - p.sante / 100) * 0.6 + (1 - p.endu / 100) * 0.4)));

/** La ceinture du champion : une large bande de cuir, la grande plaque d'or au centre, deux petites de chaque côté. */
function creerCeinture() {
  const g = new THREE.Group();
  const cuir = new THREE.MeshLambertMaterial({ color: '#1a1416' });
  const or = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.85, roughness: 0.25, emissive: '#3a2a00' });
  const bande = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.03), cuir);
  g.add(bande);
  const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 24), or);
  plaque.rotation.x = Math.PI / 2;
  plaque.position.z = 0.02;
  g.add(plaque);
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 6), new THREE.MeshStandardMaterial({ color: '#c8302c', metalness: 0.4, roughness: 0.4 }));
  centre.rotation.x = Math.PI / 2;
  centre.position.z = 0.03;
  g.add(centre);
  for (const s of [-1, 1]) for (const k of [1, 2]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.025), or);
    p.position.set(s * (0.13 + k * 0.14), 0, 0.02);
    g.add(p);
  }
  return g;
}

/** La garde : le corps tourné de trois quarts (l'épaule gauche devant). */
const GARDE = -0.42;
/** Ce que le coup fait tourner aux épaules (le crochet amène l'épaule droite, le jab pousse la gauche). */
function torsion(p) {
  if (!p.coup || p.sol) return 0;
  const u = avancement(p), w = armement(p);
  if (p.coup === 'jab') return -0.18 * u;
  if (p.coup === 'crochet') return 0.75 * u - 0.15 * w;
  return 0.35 * u - 0.1 * w;
}

const doux = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

/**
 * La garde de boxe : de trois quarts (l'épaule gauche devant), les appuis décalés, les genoux
 * souples ; le buste qui plonge à l'esquive, la tête qui part sous un coup, le tapis.
 * Les bras, eux, sont posés à part (brasBoxe) : on dit où va le poing, l'épaule et le coude suivent.
 */
function poseBoxe(f, p, o, dt) {
  const couche = p.sol || p.aTerre === 'dessous';
  const P = poseDe(f, { ...o, p: { etat: couche ? 'sol' : 'normal', frappe: 0, geste: 0, gesteType: 0, volee: 0 }, gardien: false, cote: 0, tab: false, charge: 0 }, dt);
  if (couche || o.humeur) return P;
  if (p.aTerre === 'dessus') {
    // À genoux sur l'autre, le buste penché vers lui (un peu plus quand il frappe).
    const frappe = o.sol?.coupT ? Math.sin(Math.min(1, o.sol.coupT / 10) * Math.PI) : 0;
    return Object.assign(P, { by: 0.5, y: 0, rx: 0, rz: 0, hancheA: -0.25, hancheB: -0.25, genouA: 1.7, genouB: 1.7, torse: 0.3 + 0.2 * frappe, torseZ: 0, tete: 0.35 });
  }
  if (p.amenee > 0) {
    // Le plongeon : on se baisse d'un coup et on fonce, la tête devant.
    const u = Math.min(1, p.amenee / 6);
    return Object.assign(P, { by: 0.86 - 0.3 * u, y: 0, torse: 0.16 + 0.75 * u, tete: -0.2 * u, hancheA: -0.32 - 0.6 * u, genouA: 0.42 + 0.6 * u, hancheB: 0.2 + 0.3 * u, genouB: 0.5 + 0.3 * u });
  }
  const marche = o.vitesse > 0.3;
  // Les appuis : jambe gauche devant, droite derrière, genoux fléchis ; un petit sautillement sur place
  // (qui s'éteint quand il est entamé : le dos se voûte, la tête tombe, il souffle fort).
  const u = usure(p), souffle = p.endu === undefined ? 0 : 1 - p.endu / 100;
  const rebond = Math.sin(o.t * 7 + f.phase) * 0.012 * (1 - u);
  Object.assign(P, { by: 0.86 + rebond - 0.04 * u, torse: 0.16 + 0.16 * u + Math.sin(o.t * 4.5 + f.phase) * 0.035 * souffle, tete: 0.12 + 0.14 * u });
  if (!marche) Object.assign(P, { hancheA: -0.32, genouA: 0.42, hancheB: 0.2, genouB: 0.5, y: 0 });
  else { P.hancheA -= 0.15; P.hancheB += 0.1; P.genouA += 0.25; P.genouB += 0.25; }
  if (p.coup) {
    const u = avancement(p);
    if (p.coup === 'jab') P.torse += 0.12 * u;
    else if (p.coup === 'crochet') { P.torseZ = 0.1 * u; P.torse += 0.06; }
    else { P.by = 0.8 + 0.1 * u; P.torse += 0.2 * (1 - u) - 0.08 * u; P.genouA += 0.35 * (1 - u); P.genouB += 0.35 * (1 - u); }
    if (p.corps) { P.by -= 0.1; P.genouA += 0.3; P.genouB += 0.3; P.torse += 0.1; }
  }
  if (p.garde === 'basse') { P.torse += 0.18; P.by -= 0.04; }
  if (p.esquive > 0) {
    // L'esquive : le buste plonge sur le côté (ou en arrière), les genoux plient.
    const v = Math.sin(Math.min(1, p.esquive) * Math.PI);
    if (p.esqCote) { P.torseZ = p.esqCote * 0.5 * v; P.torse += 0.15 * v; } else P.torse -= 0.35 * v;
    P.by -= 0.14 * v; P.genouA += 0.4 * v; P.genouB += 0.4 * v;
  }
  if (p.sonne > 0) {
    // Touché : la tête part en arrière, le buste suit.
    const v = Math.min(1, p.sonne);
    P.tete = -0.55 * v; P.torse -= 0.3 * v; P.rx = -0.1 * v;
  }
  if (p.etourdi) { P.torseZ += Math.sin(o.t * 3.5) * 0.16; P.genouA += 0.35; P.genouB += 0.2; }
  return P;
}

/** Où en est le coup : 0 (armé) à 1 (impact), puis le retour vers 0. */
function avancement(p) {
  const C = COUPS[p.coup];
  const t = p.coupT;
  if (t < C.armer) return doux(t / C.armer) * 0.2;
  if (t < C.armer + C.frapper) return 1;
  return 1 - doux((t - C.armer - C.frapper) / C.retour);
}

/** La part « armer » d'un coup (0 au départ, 1 juste avant de lancer, puis 0). */
function armement(p) {
  const C = COUPS[p.coup];
  return p.coupT < C.armer ? doux(p.coupT / C.armer) : 0;
}

/* ---------------- Les bras : du poing vers l'épaule (deux segments) ---------------- */

const L_BRAS = 0.31, L_AVANT = 0.36;
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _D = new THREE.Vector3(), _U = new THREE.Vector3(), _E = new THREE.Vector3(), _F = new THREE.Vector3(), _P = new THREE.Vector3();
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _M = new THREE.Matrix4();

/**
 * Pose un bras pour que le poing aille en `cible` (dans le repère du buste : +z devant, +y en haut),
 * le coude tiré vers `pole`. Les longueurs sont celles du joueur commun (bras 0,31 m, avant-bras et gant 0,36 m).
 */
function poserBras(bras, cible, pole) {
  _S.copy(bras.ep.position);
  _T.copy(cible);
  _D.subVectors(_T, _S);
  const d = Math.min(L_BRAS + L_AVANT - 0.002, Math.max(0.08, _D.length()));
  _D.normalize();
  // L'angle à l'épaule (loi des cosinus), dans le plan qui contient le pôle.
  const cosA = (L_BRAS * L_BRAS + d * d - L_AVANT * L_AVANT) / (2 * L_BRAS * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  _P.copy(pole).addScaledVector(_D, -pole.dot(_D)).normalize();
  _U.copy(_D).multiplyScalar(Math.cos(a)).addScaledVector(_P, Math.sin(a)).normalize();
  _E.copy(_S).addScaledVector(_U, L_BRAS);
  _F.copy(_S).addScaledVector(_D, d).sub(_E).normalize();
  // Le repère de l'épaule : le bras pend selon -Y ; l'avant-bras se plie vers +Z.
  _Y.copy(_U).negate();
  _Z.copy(_F).addScaledVector(_U, -_F.dot(_U));
  if (_Z.lengthSq() < 1e-6) _Z.set(0, 0, 1).addScaledVector(_U, -_U.z);
  _Z.normalize();
  _X.crossVectors(_Y, _Z).normalize();
  _M.makeBasis(_X, _Y, _Z);
  bras.ep.quaternion.setFromRotationMatrix(_M);
  bras.coude.rotation.set(-Math.acos(Math.max(-1, Math.min(1, _U.dot(_F)))), 0, 0);
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const melV = (a, b, t) => a.clone().lerp(b, t);
/** Faire tourner un point autour de l'axe vertical (la garde est de trois quarts : le buste ne regarde pas tout droit). */
const tourner = (v, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return V(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); };
const POLE_BAS = V(0, -1, -0.2), POLE_G = V(1, -0.6, -0.3), POLE_D = V(-1, -0.6, -0.3);

/** L'avancée du corps sur un coup (le poids passe sur la jambe avant). */
function elan(p) {
  if (!p.coup || p.sol) return 0;
  return { jab: 0.14, crochet: 0.1, upper: 0.08 }[p.coup] * avancement(p);
}

/** Une courbe de Bézier à trois points (le crochet décrit un arc). */
const bezier = (a, c, b, u) => a.clone().multiplyScalar((1 - u) * (1 - u)).addScaledVector(c, 2 * u * (1 - u)).addScaledVector(b, u * u);

/**
 * Les deux poings d'un boxeur, d'après ce qu'il fait. Le bras gauche (A) est le bras avant (le jab),
 * le droit (B) celui du crochet et de l'uppercut. Les coups visent la vraie tête (ou le ventre) de
 * l'adversaire, `cible` (en 3D) : à portée, le gant arrive dessus ; trop loin, le bras s'allonge dans le vide.
 * `garde` : de combien le buste est tourné par rapport à l'adversaire (la garde de trois quarts).
 */
function brasBoxe(f, p, t, garde, cible) {
  // La garde : les gants devant le menton (plus haut en garde haute, devant le ventre en garde basse).
  let gA = V(0.14, 0.7, 0.26), gB = V(-0.1, 0.68, 0.2);
  if (p.garde === 'haute') { gA = V(0.09, 0.8, 0.22); gB = V(-0.08, 0.8, 0.2); }
  if (p.garde === 'basse') { gA = V(0.14, 0.36, 0.24); gB = V(-0.12, 0.36, 0.22); }
  if (p.etourdi) { gA.y -= 0.2; gB.y -= 0.22; }
  // Entamé : les gants pèsent, la garde descend.
  const u = usure(p);
  gA.y -= 0.14 * u; gB.y -= 0.16 * u;
  // Un léger va-et-vient des gants en garde.
  gA.z += Math.sin(t * 5.5) * 0.02; gB.z += Math.sin(t * 5.5 + 1.7) * 0.015;
  gA = tourner(gA, garde); gB = tourner(gB, garde);
  let A = gA, B = gB, poleA = tourner(POLE_BAS, garde), poleB = poleA;
  if (p.coup && !p.sol) {
    const u = avancement(p), w = armement(p);
    // Là où frappe le gant, dans le repère du buste : un peu avant la surface (la tête n'est pas un point).
    f.racine.updateMatrixWorld(true);
    let impact = cible ? f.torse.worldToLocal(cible.clone()) : tourner(V(0.04, 0.7 + (p.corps ? -0.3 : 0), 0.8), garde);
    const sh = (p.coup === 'jab' ? f.A : f.B).ep.position;
    const vers = impact.clone().sub(sh);
    impact = sh.clone().addScaledVector(vers, Math.max(0, vers.length() - 0.12) / (vers.length() || 1));
    if (p.coup === 'jab') {
      // Le jab : le bras avant part droit sur la cible.
      A = melV(gA, impact, u);
      poleA = tourner(POLE_G, garde);
    } else if (p.coup === 'crochet') {
      // Le crochet : le poing part de côté, coude levé, et balaie à l'horizontale jusqu'à la cible.
      const cote = tourner(V(-0.55, 0, 0.05), garde).add(V(0, impact.y, 0));
      B = w > 0 ? melV(gB, tourner(V(-0.34, 0.66, 0.08), garde), w) : bezier(tourner(V(-0.34, 0.66, 0.08), garde), cote, impact, u);
      poleB = tourner(V(-0.5, 1, -0.5), garde);
    } else {
      // L'uppercut : le poing descend à la ceinture, puis remonte sous le menton adverse.
      const bas0 = tourner(V(-0.1, 0.24, 0.24), garde);
      const menton = impact.clone().add(V(0, -0.1, 0));
      B = w > 0 ? melV(gB, bas0, w) : melV(bas0, menton, u);
      poleB = tourner(V(0, -1, -0.6), garde);
    }
  }
  poserBras(f.A, A, poleA);
  poserBras(f.B, B, poleB);
}

/**
 * Les bras au sol. Celui du dessus : une main qui tient, l'autre qui frappe (coupT), ou les deux sur la prise
 * (la gorge, le bras, la jambe) ; celui du dessous : les gants devant le visage s'il se protège.
 */
function brasSol(f, o, p, sol) {
  if (p.aTerre === 'dessous') {
    if (sol.garde && !sol.prise) { poserBras(f.A, V(0.09, 0.82, 0.22), POLE_BAS); poserBras(f.B, V(-0.08, 0.82, 0.2), POLE_BAS); }
    else if (sol.prise) { poserBras(f.A, V(0.2, 0.75, 0.35), POLE_BAS); poserBras(f.B, V(-0.2, 0.75, 0.35), POLE_BAS); }
    return;
  }
  f.racine.updateMatrixWorld(true);
  o.racine.updateMatrixWorld(true);
  const local = (w) => f.torse.worldToLocal(w);
  const tete = o.tete.getWorldPosition(new THREE.Vector3());
  const poitrine = o.torse.localToWorld(V(0, 0.2, 0.1));
  // Un petit tremblement quand il serre (plus fort quand la jauge monte).
  const tremble = sol.prise ? Math.sin(performance.now() / 30) * 0.015 * (0.5 + sol.jauge) : 0;
  if (sol.prise === 'gorge') {
    poserBras(f.A, local(tete.clone().add(V(0.12, -0.12 + tremble, 0))), POLE_G);
    poserBras(f.B, local(tete.clone().add(V(-0.12, -0.12 - tremble, 0))), POLE_D);
  } else if (sol.prise === 'bras') {
    const coude = o.A.coude.getWorldPosition(new THREE.Vector3());
    poserBras(f.A, local(coude.clone().add(V(0, 0.05 + tremble, 0))), POLE_G);
    poserBras(f.B, local(coude.clone().lerp(tete, 0.3).add(V(0, 0.05 - tremble, 0))), POLE_D);
  } else if (sol.prise === 'cheville') {
    const genou = o.JA.genou.localToWorld(V(0, -0.36, 0));
    poserBras(f.A, local(genou.clone().add(V(0.06, 0.08 + tremble, 0))), POLE_G);
    poserBras(f.B, local(genou.clone().add(V(-0.06, 0.08 - tremble, 0))), POLE_D);
  } else {
    // Les coups : le poing monte, puis s'abat sur la tête.
    poserBras(f.A, local(poitrine), POLE_G);
    const t = sol.coupT || 0;
    const haut = V(-0.12, 0.85, 0.12);
    const cible = local(tete.clone().add(V(0, 0.1, 0)));
    poserBras(f.B, t <= 0 ? haut : t < 6 ? melV(haut, V(-0.15, 1.0, 0.0), t / 6) : melV(V(-0.15, 1.0, 0.0), cible, Math.min(1, (t - 6) / 4)), POLE_D);
  }
}

/**
 * Crée la scène dans `hote`.
 * @param {HTMLElement} hote
 * @param {{ boxeurs: [object, object], qualite?: string }} o
 */
export function creerRendu(hote, o) {
  const q = o.qualite || qualite();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: q !== 'basse', powerPreference: 'high-performance' }); } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'haute' ? 2 : q === 'moyenne' ? 1.5 : 1) * (q === 'basse' ? 0.75 : 1));
  renderer.shadowMap.enabled = q === 'haute';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'scene3d';
  hote.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.3, 300);
  const ring = creerRing(scene, { qualite: q, couleurs: o.boxeurs.map((b) => b.couleurs.gants) });
  const figs = o.boxeurs.map((b) => { const f = creerBoxeur(b); scene.add(f.racine); return f; });
  if (q !== 'haute') for (const f of figs) f.racine.traverse((x) => { x.castShadow = false; });
  // La sueur qui gicle sous un gros coup.
  const gouttes = [];
  const texGoutte = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  // Le sang sur le tapis : des taches qui restent (les plus vieilles s'effacent au-delà de quarante).
  const taches = [];
  const geoTache = new THREE.CircleGeometry(1, 9);
  const tacher = (x, z, r = 0.05) => {
    const t = new THREE.Mesh(geoTache, new THREE.MeshBasicMaterial({ color: '#6e0b12', transparent: true, opacity: 0.55 + Math.random() * 0.3, depthWrite: false }));
    t.rotation.x = -Math.PI / 2;
    t.position.set(x + (Math.random() - 0.5) * 0.3, HAUT + 0.004 + taches.length * 0.00002, z + (Math.random() - 0.5) * 0.3);
    t.scale.set(r * (0.7 + Math.random() * 0.8), r * (0.6 + Math.random() * 0.6), 1);
    scene.add(t); taches.push(t);
    if (taches.length > 40) { const v = taches.shift(); scene.remove(v); v.material.dispose(); }
  };
  const gicler = (x, y, z, n, couleur = '#dff3ff') => {
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGoutte, color: couleur, transparent: true, opacity: 0.85, depthWrite: false }));
      s.position.set(x, y, z); s.scale.setScalar(0.07);
      s.v = new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 2, (Math.random() - 0.5) * 2.4);
      s.vie = 0.5 + Math.random() * 0.3;
      scene.add(s); gouttes.push(s);
    }
  };
  // Les flashs des photographes, au bord du ring, sur les gros coups.
  const flashs = [];
  for (let k = 0; k < 6; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGoutte, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(-4 + k * 1.6, HAUT - 0.2, -4.6);
    s.scale.setScalar(0.9);
    scene.add(s); flashs.push(s);
  }
  // L'éclat d'un coup critique.
  const eclat = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGoutte, color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(eclat);
  // La fête : la ceinture (le trophée commun), les feux d'artifice, la presse.
  const ceinture = creerCeinture();
  ceinture.visible = false;
  scene.add(ceinture);
  const feux = creerFeux(scene);
  const presse = creerPresse(scene);
  // L'arbitre : il n'entre qu'à la fin, pour annoncer le vainqueur.
  const arbitre = creerArbitre();
  scene.add(arbitre.racine);
  if (q !== 'haute') arbitre.racine.traverse((x) => { x.castShadow = false; });
  let annonce = null;

  /**
   * L'annonce : l'arbitre au centre, un boxeur de chaque côté. Il tient leurs poignets ;
   * quand vient le moment, il lève le bras du vainqueur (leve : 0 ou 1, -1 tant qu'on attend).
   */
  function poserAnnonce(v, dt) {
    if (!annonce) { arbitre.racine.visible = false; return; }
    arbitre.racine.visible = true;
    arbitre.racine.position.set(annonce.x, HAUT, -annonce.y);
    arbitre.racine.rotation.y = 0;
    const P = poseDe(arbitre, { p: { etat: 'normal', frappe: 0, geste: 0, gesteType: 0, volee: 0 }, vitesse: 0, t: temps, gardien: false, cote: 0, tab: false, charge: 0, humeur: null }, dt);
    poser(arbitre, P, Math.min(1, dt * 10));
    arbitre.racine.updateMatrixWorld(true);
    // De chaque côté : sa main et celle du boxeur se rejoignent (en bas, ou tout en haut pour le vainqueur).
    annonce.leveK = (annonce.leveK || 0) + ((annonce.leve >= 0 ? 1 : 0) - (annonce.leveK || 0)) * Math.min(1, dt * 7);
    for (let i = 0; i < 2; i++) {
      const b = v.boxeurs[i], f = figs[i];
      const sx = Math.sign(b.x - annonce.x) || (i === 0 ? -1 : 1);
      const leve = annonce.leve === i ? annonce.leveK : 0;
      // Le perdant, lâché, baisse la tête : on ne le tient plus.
      if (annonce.leve >= 0 && annonce.leve !== i) continue;
      const main = new THREE.Vector3(annonce.x + sx * (0.4 - 0.08 * leve), HAUT + 1.0 + 1.45 * leve, -annonce.y + 0.12);
      poserBras(sx > 0 ? arbitre.A : arbitre.B, arbitre.torse.worldToLocal(main.clone()), V(0, -1, -0.2));
      f.racine.updateMatrixWorld(true);
      // Le bras du boxeur du côté de l'arbitre : le gauche s'il est à gauche de l'arbitre… vu de l'arbitre.
      poserBras(sx < 0 ? f.A : f.B, f.torse.worldToLocal(main.clone().add(new THREE.Vector3(sx * 0.06, 0.04, 0))), V(0, -1, -0.2));
    }
  }

  /* ---------------- La caméra ---------------- */
  const cam = { mode: 'tele', pos: new THREE.Vector3(0, 3.6, 7), vise: new THREE.Vector3(0, HAUT + 1.1, 0), secousse: 0, cote: 1 };
  let largeur = 1, hauteur = 1;
  function dimensionner() {
    largeur = hote.clientWidth || 1; hauteur = hote.clientHeight || 1;
    renderer.setSize(largeur, hauteur, false);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(dimensionner);
  ro.observe(hote);
  dimensionner();

  function placerCamera(v, dt) {
    const [a, b] = v.boxeurs;
    let pos, vise;
    if (cam.mode === 'libre' && cam.libre) { pos = cam.libre.pos.clone(); vise = cam.libre.vise.clone(); }
    else {
      // De côté, comme à la télévision : perpendiculaire à la ligne des deux boxeurs, du côté du public d'en face.
      // L'angle suit lentement (les boxeurs tournent l'un autour de l'autre : la caméra ne doit pas valser).
      const mx = (a.x + b.x) / 2, mz = -(a.y + b.y) / 2;
      const px = -(b.y - a.y), pz = -(b.x - a.x);
      // Des deux côtés possibles, celui qui est le plus près d'où l'on est déjà (pas de bascule d'un bord à l'autre).
      if (cam.ang === undefined) cam.ang = 0;
      let voulu = Math.atan2(px, pz);
      const ecartAng = (x) => { let d = x - cam.ang; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
      let dAng = ecartAng(voulu);
      if (Math.abs(ecartAng(voulu + Math.PI)) < Math.abs(dAng)) dAng = ecartAng(voulu + Math.PI);
      cam.ang += cam.saut ? dAng : dAng * Math.min(1, dt * 3.4);
      const ecart = Math.hypot(a.x - b.x, a.y - b.y);
      const recul = (5.6 + ecart * 0.8) * (camera.aspect < 1 ? 1.45 : 1);
      // Le centre du cadre suit le milieu des boxeurs, sans coller au moindre pas.
      cam.cx = cam.cx === undefined || cam.saut ? mx : cam.cx + (mx - cam.cx) * Math.min(1, dt * 2.5);
      cam.cz = cam.cz === undefined || cam.saut ? mz : cam.cz + (mz - cam.cz) * Math.min(1, dt * 2.5);
      const bas = v.sol ? 1 : 0;
      pos = new THREE.Vector3(cam.cx + Math.sin(cam.ang) * recul * (1 - 0.15 * bas), HAUT + 2.45 - 0.6 * bas, cam.cz + Math.cos(cam.ang) * recul * (1 - 0.15 * bas));
      vise = new THREE.Vector3(cam.cx, HAUT + 1.15 - 0.65 * bas, cam.cz);
    }
    const k = cam.mode === 'libre' ? 1 : Math.min(1, dt * 4);
    if (cam.saut) { cam.pos.copy(pos); cam.vise.copy(vise); cam.saut = false; }
    else { cam.pos.lerp(pos, k); cam.vise.lerp(vise, k); }
    camera.position.copy(cam.pos);
    if (cam.secousse > 0.001) {
      camera.position.x += (Math.random() - 0.5) * cam.secousse;
      camera.position.y += (Math.random() - 0.5) * cam.secousse;
      cam.secousse *= Math.pow(0.003, dt);
    }
    camera.lookAt(cam.vise);
  }

  /* ---------------- Une image ---------------- */
  let temps = 0, excitation = 0;
  function afficher(v, dt) {
    temps += dt;
    excitation *= Math.pow(0.35, dt);
    placerCamera(v, dt);
    // À l'écran, les deux boxeurs un peu plus près l'un de l'autre que dans le moteur : les gants touchent vraiment.
    const [a, b] = v.boxeurs;
    const ecart = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const rapproche = Math.min(0.16, Math.max(0, ecart - 0.7)) / 2;
    v.boxeurs.forEach((p, i) => {
      const f = figs[i];
      const vit = Math.hypot(p.vx, p.vy);
      const humeur = v.humeurs?.[i] || null;
      // La clé de cheville : celui du dessus se retourne vers les jambes de l'autre.
      const cheville = p.aTerre === 'dessus' && v.sol?.prise === 'cheville';
      const ang = Math.atan2(p.dx, -p.dy) + (cheville ? Math.PI : 0);
      const P = poseBoxe(f, p, { vitesse: vit * 1.4, sprint: false, t: temps, humeur, sol: v.sol }, dt);
      const enGarde = !p.sol && !humeur && !p.aTerre;
      let da = ang + (enGarde ? GARDE + torsion(p) : 0) - f.racine.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      f.racine.rotation.y += da * Math.min(1, dt * (p.coup ? 26 : 14));
      poser(f, P, Math.min(1, dt * (p.coup ? 30 : 16)));
      majMarques(f, p);
      // L'arcade ouverte saigne : de temps en temps, une goutte tombe sur le tapis.
      if (!humeur && (f.marques.dt || 0) > 110) {
        f.marques.goutte = (f.marques.goutte ?? 1) - dt * (0.4 + (f.marques.dt - 110) / 120);
        if (f.marques.goutte <= 0) {
          f.marques.goutte = 1;
          const t = f.tete.localToWorld(new THREE.Vector3(-0.07, -0.05, 0.15));
          gicler(t.x, t.y, t.z, 1, '#a0101a');
          tacher(t.x, t.z, 0.025);
        }
      }
      const k = p.aTerre ? (cheville ? -0.6 : 0) : rapproche + (enGarde ? elan(p) : 0);
      f.racine.position.set(p.x + p.dx * k, HAUT, -p.y - p.dy * k);
      if (enGarde) {
        // Les bras : là où doivent aller les poings, dans le repère du buste (qui ne regarde pas tout droit).
        let decale = f.racine.rotation.y - ang;
        while (decale > Math.PI) decale -= Math.PI * 2;
        while (decale < -Math.PI) decale += Math.PI * 2;
        // La cible : la tête de l'autre (ou son ventre, pour un coup au corps), là où elle est à l'écran.
        const o = figs[1 - i];
        let cible = null;
        if (p.coup) {
          o.racine.updateMatrixWorld(true);
          cible = p.corps ? o.bassin.localToWorld(new THREE.Vector3(0, 0.32, 0.12)) : o.tete.getWorldPosition(new THREE.Vector3());
        }
        if (p.amenee > 0) { poserBras(f.A, V(0.2, 0.3, 0.5), POLE_BAS); poserBras(f.B, V(-0.2, 0.3, 0.5), POLE_BAS); }
        else brasBoxe(f, p, temps, -decale, cible);
      }
    });
    if (v.sol) v.boxeurs.forEach((p, i) => brasSol(figs[i], figs[1 - i], p, v.sol));
    for (let k = gouttes.length - 1; k >= 0; k--) {
      const s = gouttes[k];
      s.vie -= dt;
      s.v.y -= 6 * dt;
      s.position.addScaledVector(s.v, dt);
      s.material.opacity = Math.max(0, s.vie) * 1.4;
      if (s.vie <= 0) { scene.remove(s); s.material.dispose(); gouttes.splice(k, 1); }
    }
    for (const s of flashs) s.material.opacity = Math.max(0, s.material.opacity - dt * 6);
    if (eclat.material.opacity > 0) { eclat.material.opacity = Math.max(0, eclat.material.opacity - dt * 2.2); eclat.scale.multiplyScalar(1 + dt * 5); }
    ring.maj(dt, Math.min(1, excitation), v.boxeurs);
    feux.maj(dt);
    presse.maj(dt);
    poserAnnonce(v, dt);
    renderer.render(scene, camera);
  }

  /** Ce qui se passe dans le combat : des effets. */
  function evenements(evs, v) {
    for (const ev of evs) {
      if (ev.type === 'touche') {
        const d = v.boxeurs[ev.cible];
        const fort = ev.degats > 6 || ev.contre;
        gicler(d.x, HAUT + (ev.corps ? 1.2 : 1.75) * 1.08, -d.y, fort ? 10 : 4);
        // Un visage déjà ouvert : du sang à l'impact.
        if (!ev.corps && (figs[ev.cible].marques.dt || 0) > 70) {
          gicler(d.x, HAUT + 1.75 * 1.08, -d.y, fort ? 6 : 2, '#b3121a');
          if (fort || Math.random() < 0.3) tacher(d.x, -d.y, fort ? 0.08 : 0.04);
        }
        excitation = Math.max(excitation, fort ? 0.8 : 0.35);
        if (fort) { cam.secousse = Math.max(cam.secousse, 0.06 + ev.degats * 0.008); for (const s of flashs) if (Math.random() < 0.5) s.material.opacity = 1; }
        if (ev.critique) {
          // Le critique : un éclat de lumière à l'impact, la caméra qui tremble, plus de sueur.
          eclat.position.set(d.x, HAUT + (ev.corps ? 1.2 : 1.75) * 1.08, -d.y);
          eclat.scale.setScalar(0.5);
          eclat.material.opacity = 1;
          gicler(d.x, HAUT + (ev.corps ? 1.2 : 1.75) * 1.08, -d.y, 14);
          cam.secousse = Math.max(cam.secousse, 0.3);
          excitation = 1.4;
          for (const s of flashs) s.material.opacity = 1;
        }
      } else if (ev.type === 'frappe-sol') {
        const t = figs[ev.cible].tete.getWorldPosition(new THREE.Vector3());
        gicler(t.x, t.y, t.z, ev.fatal ? 16 : ev.garde ? 2 : 6);
        excitation = Math.max(excitation, ev.fatal ? 1.5 : 0.5);
        cam.secousse = Math.max(cam.secousse, ev.fatal ? 0.3 : 0.05);
        if (ev.fatal) { eclat.position.copy(t); eclat.scale.setScalar(0.5); eclat.material.opacity = 1; for (const s of flashs) s.material.opacity = 1; }
      } else if (ev.type === 'amenee') { excitation = Math.max(excitation, 1); cam.secousse = Math.max(cam.secousse, 0.18); for (const s of flashs) if (Math.random() < 0.5) s.material.opacity = 1; }
      else if (ev.type === 'prise') excitation = Math.max(excitation, 1.1);
      else if (ev.type === 'soumission') { excitation = 1.5; for (const s of flashs) s.material.opacity = 1; }
      else if (ev.type === 'kd') { excitation = 1.5; cam.secousse = 0.25; for (const s of flashs) s.material.opacity = 1; }
      else if (ev.type === 'fin') excitation = 1.5;
    }
  }

  const proj = new THREE.Vector3();
  return {
    afficher,
    evenements,
    dimensionner,
    versEcran(x, y, z = 0) {
      proj.set(x, HAUT + z, -y).project(camera);
      return { x: (proj.x * 0.5 + 0.5) * largeur, y: (-proj.y * 0.5 + 0.5) * hauteur };
    },
    camera(mode, saut = false) { if (cam.mode !== mode) { cam.mode = mode; cam.saut = saut; } },
    cadrer(pos, vise, saut = false) {
      cam.libre = { pos: new THREE.Vector3(pos[0], pos[2], -pos[1]), vise: new THREE.Vector3(vise[0], vise[2], -vise[1]) };
      if (cam.mode !== 'libre' || saut) cam.saut = saut;
      cam.mode = 'libre';
    },
    /** La ceinture : en (x, y) du moteur, à la hauteur h au-dessus du tapis ; null pour la cacher. */
    /** L'annonce du vainqueur : { x, y (le centre), leve : -1 (on attend), 0 ou 1 } ; null : l'arbitre s'en va. */
    annonce(a) { annonce = a ? { ...annonce, ...a } : null; },
    /** Les flashs des photographes, tous à la fois. */
    flash() { for (const s of flashs) s.material.opacity = 1; },
    trophee(t) { ceinture.visible = !!t; if (t) { ceinture.position.set(t.x, HAUT + t.h, -t.y); ceinture.rotation.y = Math.sin(performance.now() / 600) * 0.4; ceinture.scale.setScalar(t.echelle || 1); } },
    presse(p) { if (p) presse.montrer({ ...p }); else presse.cacher(); },
    feuArtifice(couleurs) { feux.lancer((Math.random() - 0.5) * 18, 9 + Math.random() * 4, -6 - Math.random() * 6, couleurs); },
    ecran: ring.ecran,
    secouer(f) { cam.secousse = Math.max(cam.secousse, f); },
    /** Pour les essais : où sont les gants et les têtes (en 3D). */
    etatPoings: () => figs.map((f) => { const w = (o) => o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)); const g = (o) => o.localToWorld(new THREE.Vector3(0, -0.31, 0)).toArray().map((v) => +v.toFixed(2)); return { gA: g(f.A.coude.children[1]), gB: g(f.B.coude.children[1]), tete: w(f.tete), ventre: w(f.bassin) }; }),
    /** Pour les essais : l'arbitre (visible ? ses mains). */
    etatArbitre: () => { const g = (o) => o.localToWorld(new THREE.Vector3(0, -0.31, 0)).toArray().map((v) => +v.toFixed(2)); return { visible: arbitre.racine.visible, mainA: g(arbitre.A.coude.children[1]), mainB: g(arbitre.B.coude.children[1]), tete: arbitre.tete.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) }; },
    /** Pour les essais : où est la caméra, où elle regarde. */
    etatCamera: () => ({ mode: cam.mode, ang: cam.ang, pos: camera.position.toArray().map((v) => +v.toFixed(2)), vise: cam.vise.toArray().map((v) => +v.toFixed(2)) }),
    qualite: q,
    detruire() {
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((x) => { x.geometry?.dispose?.(); });
    },
  };
}
