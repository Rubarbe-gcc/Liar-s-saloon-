/**
 * REVERS — le court et le stade en 3D : la surface (dur, terre battue ou gazon), les lignes, le filet et ses
 * poteaux, la chaise de l'arbitre, les juges de ligne, les panneaux, les tribunes tout autour et le public (les
 * outils de la salle du basket : basket/js/trois/salle3d.js), un grand écran pour le score, le ciel et le soleil.
 *
 * Repère : moteur (x, y) → 3D (x, 0, -y).
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { foule, gradins, couleursPublic, texCanvas, ecranTexture, lambert, basique, boite } from '../../../basket/js/trois/salle3d.js';
import { LONG, DEMI_SIMPLE, SERVICE } from '../../../../../shared/tennis/terrain.js';

/** La demi-largeur du double, le recul derrière les lignes (la zone de jeu), la place des tribunes. */
const DEMI_DOUBLE = 5.485, FOND = 6.4, COTE = 3.7;
const BORD_X = DEMI_DOUBLE + COTE, BORD_Z = LONG + FOND;

export const SURFACES_3D = {
  dur: { court: '#2f63a8', autour: '#2f7a52', grain: 0.04, ciel: ['#7fb6ea', '#d8ecff'] },
  terre: { court: '#c4643a', autour: '#c4643a', grain: 0.12, ciel: ['#8cbde8', '#f3e5cf'] },
  gazon: { court: '#4f9a3c', autour: '#4f9a3c', grain: 0.07, ciel: ['#79aee0', '#e6f3ff'], rayures: true },
};

/** Le sol : la surface du court (et autour), ses lignes blanches, peintes dans une seule texture. */
function sol(scene, S, qualite) {
  const L = 2 * BORD_X, H = 2 * BORD_Z, px = 34; // pixels par mètre
  const t = texCanvas(Math.round(L * px), Math.round(H * px), (g, w, h) => {
    const X = (x) => (x + BORD_X) * px, Z = (z) => (z + BORD_Z) * px;
    g.fillStyle = S.autour; g.fillRect(0, 0, w, h);
    g.fillStyle = S.court; g.fillRect(X(-DEMI_DOUBLE), Z(-LONG), DEMI_DOUBLE * 2 * px, LONG * 2 * px);
    if (S.rayures) for (let k = -BORD_Z; k < BORD_Z; k += 2.4) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, Z(k), w, 1.2 * px); }
    // Le grain de la surface (la terre surtout).
    for (let k = 0; k < (qualite === 'basse' ? 4000 : 16000); k++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * S.grain})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // Les lignes : 5 cm de large.
    g.fillStyle = '#f7f7f2';
    g.fillRect(X(-DEMI_DOUBLE), Z(-LONG), DEMI_DOUBLE * 2 * px, 0.05 * px);
    g.fillRect(X(-DEMI_DOUBLE), Z(LONG) - 0.05 * px, DEMI_DOUBLE * 2 * px, 0.05 * px);
    for (const x of [-DEMI_DOUBLE, -DEMI_SIMPLE, DEMI_SIMPLE - 0.05, DEMI_DOUBLE - 0.05]) g.fillRect(X(x), Z(-LONG), 0.05 * px, LONG * 2 * px);
    for (const z of [-SERVICE, SERVICE - 0.05]) g.fillRect(X(-DEMI_SIMPLE), Z(z), DEMI_SIMPLE * 2 * px, 0.05 * px);
    g.fillRect(X(-0.025), Z(-SERVICE), 0.05 * px, SERVICE * 2 * px);
    for (const z of [-LONG, LONG - 0.15]) g.fillRect(X(-0.025), Z(z), 0.05 * px, 0.15 * px);
    // Le nom du tournoi, au fond de chaque côté.
    g.save();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `900 ${1.1 * px}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('REVERS', X(0), Z(LONG + 3.2));
    g.translate(X(0), Z(-LONG - 3.2)); g.rotate(Math.PI); g.fillText('REVERS', 0, 0);
    g.restore();
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(L, H), new THREE.MeshLambertMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  scene.add(m);
  // Plus loin, le sol du stade.
  scene.add(boite(120, 0.1, 120, lambert('#3a3d44'), 0, -0.06, 0));
}

/** Le filet : la toile en losanges (transparente), la bande blanche, la sangle du centre, les poteaux. */
function filet(scene) {
  const larg = 2 * (DEMI_DOUBLE + 0.914);
  const t = texCanvas(1024, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(20,20,24,.85)'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  // La toile pend un peu au centre : un plan découpé, le haut abaissé vers le milieu.
  const geo = new THREE.PlaneGeometry(larg, 1, 24, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), haut = p.getY(i) > 0;
    const hy = 1.07 - (1.07 - 0.914) * (1 - (x / (larg / 2)) ** 2);
    p.setY(i, haut ? hy : 0.02);
  }
  geo.computeVertexNormals();
  const toile = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(toile);
  // La bande blanche, le long du haut.
  const pts = [];
  for (let k = 0; k <= 24; k++) { const x = -larg / 2 + (larg * k) / 24; pts.push(new THREE.Vector3(x, 1.07 - (1.07 - 0.914) * (1 - (x / (larg / 2)) ** 2) + 0.02, 0)); }
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.03, 6, false), lambert('#fbfbf6')));
  scene.add(boite(0.05, 0.92, 0.02, basique('#fbfbf6'), 0, 0.46, 0));
  for (const s of [-1, 1]) {
    const poteau = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.12, 10), lambert('#1f4a33'));
    poteau.position.set(s * larg / 2, 0.56, 0);
    poteau.castShadow = true;
    scene.add(poteau);
  }
}

/** La chaise de l'arbitre, au bord du filet ; deux juges de ligne au fond. */
function chaise(scene) {
  const g = new THREE.Group();
  const bois = lambert('#2c4a3a');
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) g.add(boite(0.07, 2, 0.07, bois, x, 1, z));
  g.add(boite(0.9, 0.08, 0.9, bois, 0, 2, 0));
  g.add(boite(0.9, 0.7, 0.08, bois, 0, 2.35, 0.42));
  g.add(boite(0.6, 0.6, 0.1, lambert('#16334d'), 0, 2.4, -0.35));
  // L'arbitre, assis : un buste, une tête.
  g.add(boite(0.42, 0.55, 0.3, lambert('#1d2a44'), 0, 2.4, 0.15));
  const tete = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lambert('#d8a27a'));
  tete.position.set(0, 2.82, 0.12);
  g.add(tete);
  g.position.set(-(DEMI_DOUBLE + 1.35), 0, 0);
  g.rotation.y = -Math.PI / 2;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  for (const s of [-1, 1]) {
    const j = new THREE.Group();
    j.add(boite(0.4, 0.5, 0.3, lambert('#1d2a44'), 0, 0.75, 0), boite(0.45, 0.45, 0.45, lambert('#20262f'), 0, 0.22, 0));
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lambert('#c98f68'));
    t.position.y = 1.12;
    j.add(t);
    j.position.set(DEMI_DOUBLE + 2.6, 0, s * (LONG + 0.2));
    scene.add(j);
  }
}

/** Les panneaux tout autour du court (les noms des sports de l'arcade : pas de vraie marque). */
function panneaux(scene) {
  const mots = ['PLEIN STADE', 'INSERT COIN', 'REVERS', 'PETIT PONT', 'DOUBLE PAS', 'CROCHET'];
  const t = texCanvas(2048, 64, (g, w, h) => {
    g.fillStyle = '#0f2a1d'; g.fillRect(0, 0, w, h);
    g.font = '900 40px "Arial Black", Impact, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    mots.forEach((m, i) => { g.fillStyle = i % 2 ? '#f2d33a' : '#f4f4f4'; g.fillText(m, (w * (i + 0.5)) / mots.length, h / 2); });
  });
  const mat = new THREE.MeshBasicMaterial({ map: t });
  const h = 0.9;
  for (const s of [-1, 1]) {
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(2 * BORD_X, h), mat);
    fond.position.set(0, h / 2, s * BORD_Z);
    fond.rotation.y = s > 0 ? Math.PI : 0;
    scene.add(fond);
    const cote = new THREE.Mesh(new THREE.PlaneGeometry(2 * BORD_Z, h), mat);
    cote.position.set(s * BORD_X, h / 2, 0);
    cote.rotation.y = -s * Math.PI / 2;
    scene.add(cote);
  }
}

/**
 * Le stade.
 * @param {{ qualite: string, surface: string, couleurs: [string, string] }} o  couleurs : les maillots des deux joueurs (le public)
 */
export function creerCourt(scene, { qualite, surface, couleurs }) {
  const S = SURFACES_3D[surface] || SURFACES_3D.dur;
  // Le ciel : un dégradé, de la brume au loin.
  scene.background = texCanvas(4, 256, (g, w, h) => { const d = g.createLinearGradient(0, 0, 0, h); d.addColorStop(0, S.ciel[0]); d.addColorStop(1, S.ciel[1]); g.fillStyle = d; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(S.ciel[1], 70, 160);
  scene.add(new THREE.HemisphereLight('#eef6ff', '#5a5040', 1.25));
  const soleil = new THREE.DirectionalLight('#fff3dc', 1.7);
  soleil.position.set(-14, 30, 12);
  soleil.target.position.set(0, 0, 0);
  scene.add(soleil, soleil.target);
  if (qualite === 'haute') {
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(2048, 2048);
    const c = soleil.shadow.camera;
    c.left = -16; c.right = 16; c.top = 24; c.bottom = -24; c.near = 5; c.far = 70;
    soleil.shadow.bias = -0.0006;
  }
  sol(scene, S, qualite);
  filet(scene);
  chaise(scene);
  panneaux(scene);
  // Les tribunes, sur les quatre côtés.
  const beton = lambert('#5d6470');
  const places = [
    ...gradins(scene, beton, { x0: -BORD_X - 3, x1: BORD_X + 3, z0: -BORD_Z - 0.6, sens: -1, rangs: 12, base: 1.2, hauteur: 0.5 }),
    ...gradins(scene, beton, { x0: -BORD_X - 3, x1: BORD_X + 3, z0: BORD_Z + 0.6, sens: 1, rangs: 9, base: 1.2, hauteur: 0.5 }),
    ...gradins(scene, beton, { x0: -BORD_Z, x1: BORD_Z, z0: BORD_X + 0.6, sens: 1, rangs: 13, axe: 'z', base: 1.2, hauteur: 0.5 }),
    ...gradins(scene, beton, { x0: -BORD_Z, x1: BORD_Z, z0: -BORD_X - 0.6, sens: -1, rangs: 13, axe: 'z', base: 1.2, hauteur: 0.5 }),
  ];
  const kits = couleurs.map((c) => ({ fond: c, motifC: '#ffffff', short: c }));
  // Le public des deux bouts : celui du fond (z < 0) plutôt pour le joueur du haut.
  const publicCouleurs = couleursPublic(kits);
  const out = { foule: foule(scene, places.filter((_, i) => i % (qualite === 'basse' ? 2 : 1) === 0), (p, R) => publicCouleurs({ x: p.z < 0 ? 1 : -1 }, R), qualite) };
  // Le grand écran, au-dessus des tribunes du fond.
  const { t, ecrire } = ecranTexture(9, 3.6);
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6), new THREE.MeshBasicMaterial({ map: t, fog: false }));
  ecran.position.set(0, 10.5, -BORD_Z - 11.5);
  scene.add(ecran, boite(9.4, 4, 0.3, lambert('#1b1e24'), 0, 10.5, -BORD_Z - 11.7), boite(0.4, 9, 0.4, lambert('#2a2e36'), 0, 4.5, -BORD_Z - 11.8));
  out.ecran = ecrire;
  let temps = 0;
  out.maj = (dt, excitation) => {
    temps += dt;
    out.foule.uTemps.value = temps;
    out.foule.uAmp.value = 0.01 + excitation * 0.3;
  };
  return out;
}
