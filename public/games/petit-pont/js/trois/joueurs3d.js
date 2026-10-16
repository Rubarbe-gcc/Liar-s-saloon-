/**
 * PETIT PONT — les joueurs en 3D, construits par le code (pas de fichier).
 *
 * Un joueur : des boîtes et des polyèdres à facettes (le style « low-poly »),
 * articulés (bassin, torse, tête, épaules, coudes, hanches, genoux). Le
 * maillot porte le motif de l'équipe, le numéro et le nom dans le dos.
 * Chaque joueur a sa tête : la peau, la coiffure et sa couleur se tirent de
 * son nom (toujours les mêmes pour le même joueur).
 *
 * `poser(fig, pose, k)` amène les articulations vers une pose (en douceur) ;
 * les poses (course, frappe, tacle, plongeon, célébrations…) sont calculées
 * par `poseDe` à partir de l'état du moteur.
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';
import { nuance } from '../ecusson.js';

const PEAUX = ['#f3cfb1', '#e4b18c', '#c98d62', '#a36b44', '#7a4d2e', '#5a3820', '#f0c2a0'];
const CHEVEUX = ['#1a120d', '#3a2414', '#5e3b1e', '#b8864a', '#e3c27e', '#2b2b2b', '#7c2f16', '#0d0d0d'];
const COIFFES = ['court', 'boucle', 'crete', 'chauve', 'queue', 'long', 'court', 'boucle', 'rase', 'court'];
const CHAUSSURES = ['#111111', '#f4f4f4', '#ff3d6e', '#2fd7ff', '#ffd23f', '#7cff6b'];

export function hacher(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/* Les géométries, partagées entre tous les joueurs. */
const GEO = {};
function geo() {
  if (GEO.buste) return GEO;
  const boite = (x, y, z, dy = 0) => { const g = new THREE.BoxGeometry(x, y, z); g.translate(0, dy, 0); return g; };
  GEO.buste = new THREE.BoxGeometry(0.46, 0.56, 0.27);
  GEO.buste.translate(0, 0.3, 0);
  GEO.cou = boite(0.13, 0.12, 0.13, 0.62);
  GEO.tete = new THREE.IcosahedronGeometry(0.165, 1);
  GEO.oeil = new THREE.BoxGeometry(0.03, 0.04, 0.012);
  GEO.bras = boite(0.13, 0.33, 0.13, -0.15);
  GEO.avantBras = boite(0.105, 0.28, 0.105, -0.14);
  GEO.main = boite(0.11, 0.1, 0.12, -0.31);
  GEO.short = boite(0.47, 0.22, 0.28, -0.03);
  GEO.cuisse = boite(0.17, 0.42, 0.18, -0.21);
  GEO.tibia = boite(0.14, 0.38, 0.15, -0.19);
  GEO.pied = new THREE.BoxGeometry(0.14, 0.09, 0.27);
  GEO.pied.translate(0, -0.355, 0.05);
  GEO.cheveuxCourt = new THREE.IcosahedronGeometry(0.178, 1);
  GEO.afro = new THREE.IcosahedronGeometry(0.215, 1);
  GEO.crete = new THREE.BoxGeometry(0.07, 0.12, 0.3);
  GEO.chignon = new THREE.IcosahedronGeometry(0.075, 0);
  GEO.meche = new THREE.BoxGeometry(0.3, 0.32, 0.09);
  return GEO;
}

const MATS = new Map();
const mat = (couleur) => {
  if (!MATS.has(couleur)) MATS.set(couleur, new THREE.MeshLambertMaterial({ color: couleur, flatShading: true }));
  return MATS.get(couleur);
};

/** Le maillot : devant (motif), dos (nom et numéro), côtés. */
function texturesMaillot(kit, numero, nom, gardien) {
  const fond = gardien || kit.fond;
  const fabrique = (dos) => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = fond;
    g.fillRect(0, 0, 128, 128);
    if (!gardien) {
      g.fillStyle = kit.motifC;
      if (kit.motif === 'rayures') for (const x of [14, 50, 86]) g.fillRect(x, 0, 18, 128);
      if (kit.motif === 'cerceaux') for (const y of [18, 58, 98]) g.fillRect(0, y, 128, 18);
      if (kit.motif === 'demi') g.fillRect(dos ? 0 : 64, 0, 64, 128);
      if (kit.motif === 'bande') { g.beginPath(); g.moveTo(0, 30); g.lineTo(128, 90); g.lineTo(128, 116); g.lineTo(0, 56); g.fill(); }
    } else {
      // Le gardien : des épaules plus sombres.
      g.fillStyle = nuance(fond, -0.35);
      g.fillRect(0, 0, 128, 16);
    }
    // Le col.
    g.fillStyle = nuance(fond, -0.45);
    g.fillRect(40, 0, 48, 7);
    const ncoul = gardien ? '#111111' : kit.num;
    if (dos) {
      g.font = '900 58px "Arial Black", Impact, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 7; g.strokeStyle = nuance(fond, -0.5);
      g.strokeText(String(numero), 64, 76);
      g.fillStyle = ncoul;
      g.fillText(String(numero), 64, 76);
      g.font = '800 15px Arial, sans-serif';
      g.fillText(nom.split(' ').slice(-1)[0].toUpperCase().slice(0, 10), 64, 30);
    } else {
      g.font = '900 22px "Arial Black", Impact, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = ncoul;
      g.fillText(String(numero), 88, 44);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return new THREE.MeshLambertMaterial({ map: t, flatShading: true });
  };
  const cote = mat(fond);
  return [cote, cote, cote, cote, fabrique(false), fabrique(true)];
}

/**
 * Un joueur. kit : la tenue de son équipe (equipes.js) ; gardien : la couleur
 * du gardien (ou null). Rend un groupe (posé sur le sol, regard vers +z) et
 * ses articulations.
 */
export function creerJoueur({ kit, numero, nom, gardien = null }) {
  const G = geo();
  const h = hacher(nom);
  const peau = mat(PEAUX[h % PEAUX.length]);
  const cheveux = mat(CHEVEUX[(h >>> 4) % CHEVEUX.length]);
  const coiffe = COIFFES[(h >>> 8) % COIFFES.length];
  const short = mat(gardien ? nuance(gardien, -0.5) : kit.short);
  const bas = mat(gardien ? nuance(gardien, -0.2) : kit.bas);
  const chaussure = mat(CHAUSSURES[(h >>> 12) % CHAUSSURES.length]);
  const manche = mat(gardien || kit.fond);
  const gants = gardien ? mat('#f4f4f4') : peau;

  const racine = new THREE.Group();
  const corps = new THREE.Group();
  racine.add(corps);
  const bassin = new THREE.Group();
  bassin.position.y = 0.92;
  corps.add(bassin);
  const torse = new THREE.Group();
  bassin.add(torse);
  const buste = new THREE.Mesh(G.buste, texturesMaillot(kit, numero, nom, gardien));
  torse.add(buste, new THREE.Mesh(G.cou, peau));
  const tete = new THREE.Group();
  tete.position.y = 0.8;
  torse.add(tete);
  tete.add(new THREE.Mesh(G.tete, peau));
  for (const s of [-1, 1]) { const o = new THREE.Mesh(G.oeil, mat('#141414')); o.position.set(s * 0.058, 0.02, 0.152); tete.add(o); }
  const ajout = (geom, x, y, z, sx = 1, sy = 1, sz = 1) => { const c = new THREE.Mesh(geom, cheveux); c.position.set(x, y, z); c.scale.set(sx, sy, sz); tete.add(c); return c; };
  if (coiffe === 'court' || coiffe === 'queue' || coiffe === 'long') ajout(G.cheveuxCourt, 0, 0.045, -0.02, 1, 0.72, 1);
  if (coiffe === 'rase') ajout(G.cheveuxCourt, 0, 0.03, -0.01, 0.97, 0.62, 0.97);
  if (coiffe === 'boucle') ajout(G.afro, 0, 0.07, -0.03, 1, 0.82, 1);
  if (coiffe === 'crete') ajout(G.crete, 0, 0.17, -0.02);
  if (coiffe === 'queue') ajout(G.chignon, 0, 0.06, -0.19);
  if (coiffe === 'long') ajout(G.meche, 0, -0.1, -0.11);

  const bras = (s) => {
    const ep = new THREE.Group();
    ep.position.set(s * 0.3, 0.52, 0);
    const b = new THREE.Mesh(G.bras, manche);
    const coude = new THREE.Group();
    coude.position.y = -0.31;
    coude.add(new THREE.Mesh(G.avantBras, gardien ? manche : peau), new THREE.Mesh(G.main, gants));
    ep.add(b, coude);
    torse.add(ep);
    return { ep, coude };
  };
  const jambe = (s) => {
    const hanche = new THREE.Group();
    hanche.position.set(s * 0.12, -0.08, 0);
    const genou = new THREE.Group();
    genou.position.y = -0.42;
    genou.add(new THREE.Mesh(G.tibia, bas), new THREE.Mesh(G.pied, chaussure));
    hanche.add(new THREE.Mesh(G.cuisse, peau), genou);
    bassin.add(hanche);
    return { hanche, genou };
  };
  bassin.add(new THREE.Mesh(G.short, short));
  const A = bras(1), B = bras(-1), JA = jambe(1), JB = jambe(-1);
  racine.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  const fig = { racine, corps, bassin, torse, tete, A, B, JA, JB, actuel: poseNeutre(), phase: (h % 100) / 16 };
  return fig;
}

/** Une pose : les angles de chaque articulation (et la hauteur du corps). */
export function poseNeutre() {
  return {
    y: 0, rx: 0, rz: 0, by: 0.92, torse: 0.05, torseZ: 0, tete: 0,
    epAx: 0, epAz: 0.08, coudeA: -0.25, epBx: 0, epBz: -0.08, coudeB: -0.25,
    hancheA: 0, genouA: 0.05, hancheB: 0, genouB: 0.05,
  };
}

/** Amène la figure vers la pose (k : la part du chemin faite à cette image). */
export function poser(fig, cible, k) {
  const a = fig.actuel;
  for (const c of Object.keys(cible)) a[c] += (cible[c] - a[c]) * k;
  fig.corps.position.y = a.y;
  fig.bassin.position.y = a.by;
  fig.bassin.rotation.set(a.rx, 0, a.rz);
  fig.torse.rotation.set(a.torse, 0, a.torseZ);
  fig.tete.rotation.x = a.tete;
  fig.A.ep.rotation.set(a.epAx, 0, a.epAz);
  fig.B.ep.rotation.set(a.epBx, 0, a.epBz);
  fig.A.coude.rotation.x = a.coudeA;
  fig.B.coude.rotation.x = a.coudeB;
  fig.JA.hanche.rotation.x = a.hancheA;
  fig.JB.hanche.rotation.x = a.hancheB;
  fig.JA.genou.rotation.x = a.genouA;
  fig.JB.genou.rotation.x = a.genouB;
}

const doux = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

/**
 * La pose d'un joueur, d'après l'état du moteur.
 * o : { p (le joueur), vitesse (m/s), sprint, t (secondes), gardien, cote (le côté du plongeon,
 *       dans le repère du joueur : 1 vers sa gauche), humeur ('joie' | 'heros' | 'decu' | null),
 *       tab (attente des tirs au but) }
 */
export function poseDe(fig, o, dt) {
  const { p, vitesse } = o;
  const P = poseNeutre();
  const a = Math.min(1, vitesse / 6.5);
  fig.phase += vitesse * dt * 2.25;
  const ph = fig.phase;
  // La course (ou la marche, ou l'attente).
  if (vitesse > 0.4) {
    const s = Math.sin(ph), c = Math.cos(ph);
    P.hancheA = -s * 0.85 * a; P.hancheB = s * 0.85 * a;
    P.genouA = a * (0.25 + 0.95 * Math.max(0, c)); P.genouB = a * (0.25 + 0.95 * Math.max(0, -c));
    P.epAx = s * 0.75 * a; P.epBx = -s * 0.75 * a;
    P.coudeA = -0.5 - 0.7 * a; P.coudeB = -0.5 - 0.7 * a;
    P.torse = 0.1 + 0.2 * a + (o.sprint ? 0.12 : 0);
    P.y = Math.abs(Math.sin(ph)) * 0.06 * a;
  } else {
    P.y = Math.sin(o.t * 2.2 + fig.phase) * 0.006;
    P.epAz = 0.1 + Math.sin(o.t * 1.7 + ph) * 0.03; P.epBz = -P.epAz;
  }
  // Le gardien, prêt : genoux fléchis, bras écartés.
  if (o.gardien && vitesse < 3 && p.etat === 'normal') {
    P.hancheA += -0.35; P.hancheB += -0.35; P.genouA += 0.6; P.genouB += 0.6; P.by = 0.84;
    P.torse += 0.3; P.epAz = 0.55; P.epBz = -0.55; P.epAx = -0.5; P.epBx = -0.5; P.coudeA = -0.6; P.coudeB = -0.6;
  }
  if (o.charge > 0) {
    // Il arme : la jambe en arrière, les bras pour l'équilibre.
    const u = Math.min(1, o.charge);
    P.hancheB = 0.5 + 0.5 * u; P.genouB = 0.9 + 0.5 * u; P.epAz = 0.6; P.epBz = -0.9; P.torse = 0.05;
  }
  if (p.frappe > 0) {
    // La frappe : l'élan, le coup de pied, l'accompagnement.
    const u = 1 - p.frappe / 16;
    const lance = doux(u / 0.3), frappe = doux((u - 0.25) / 0.3), fin = doux((u - 0.7) / 0.3);
    P.hancheB = 0.8 * lance - 2.1 * frappe + 1.3 * fin;
    P.genouB = 1.3 * lance - 1.2 * frappe;
    P.hancheA = -0.1; P.genouA = 0.35;
    P.epAz = 0.9; P.epBz = -0.4; P.epBx = -0.6; P.torse = -0.05;
  }
  switch (p.etat) {
    case 'tacle':
      Object.assign(P, { by: 0.32, rx: -1.15, torse: 0.55, hancheA: -0.15, genouA: 0.1, hancheB: 0.2, genouB: 1.3, epAx: 0.9, epAz: 0.4, epBx: -0.3, epBz: -0.9, tete: 0.5, y: 0 });
      break;
    case 'sol':
      Object.assign(P, { by: 0.2, rx: -1.45, torse: 0.15, hancheA: -0.3, genouA: 0.9, hancheB: 0.1, genouB: 0.3, epAx: 0.4, epAz: 1.2, epBx: 0.2, epBz: -1.3, coudeA: -0.3, coudeB: -0.3, tete: 0.6, y: 0 });
      break;
    case 'plonge': {
      const haut = p.haut ? 0.95 : 0.55;
      Object.assign(P, { by: haut, rz: -o.cote * 1.35, rx: 0, torse: 0.05, tete: 0, hancheA: -0.2, genouA: 0.5, hancheB: 0.1, genouB: 0.3, epAx: 0, epAz: o.cote > 0 ? 2.9 : 2.4, epBx: 0, epBz: o.cote > 0 ? -2.4 : -2.9, coudeA: -0.1, coudeB: -0.1, y: 0 });
      break;
    }
    case 'tient':
      Object.assign(P, { epAx: -1.25, epBx: -1.25, epAz: -0.15, epBz: 0.15, coudeA: -0.5, coudeB: -0.5 });
      break;
    default:
  }
  if (o.humeur === 'joie') {
    const saut = Math.abs(Math.sin(o.t * 7 + fig.phase));
    Object.assign(P, { epAz: 2.7, epBz: -2.7, epAx: 0, epBx: 0, coudeA: -0.2, coudeB: -0.2, torse: -0.1 });
    if (vitesse < 1) P.y = saut * 0.22;
  } else if (o.humeur === 'heros') {
    if (vitesse > 1.5) Object.assign(P, { epAz: 1.5, epBz: -1.5, epAx: 0, epBx: 0, coudeA: 0, coudeB: 0, torseZ: Math.sin(o.t * 4) * 0.25 });
    else Object.assign(P, { by: 0.5, hancheA: -0.2, hancheB: -0.2, genouA: 1.75, genouB: 1.75, torse: -0.35, epAz: 2.5, epBz: -2.5, epAx: -0.3, epBx: -0.3, coudeA: -0.4, coudeB: -0.4, tete: -0.4, y: 0 });
  } else if (o.humeur === 'decu') {
    Object.assign(P, { tete: 0.55, torse: 0.2, epAz: 0.5, epBz: -0.5, epAx: -0.2, epBx: -0.2, coudeA: -1.9, coudeB: -1.9 });
  }
  if (o.tab && vitesse < 0.4 && p.etat === 'normal') Object.assign(P, { epAz: 0.45, epBz: -0.45, coudeA: -0.2, coudeB: -0.2 });
  return P;
}
