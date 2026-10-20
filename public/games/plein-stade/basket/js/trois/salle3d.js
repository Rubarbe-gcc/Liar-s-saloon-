/**
 * DOUBLE PAS — les salles en 3D : le parquet et ses lignes, les deux paniers
 * (planche, arceau, filet qui se soulève), les gradins et leur public qui saute.
 *
 *   palais   : le Palais, une grande salle dans la pénombre, un écran suspendu ;
 *   gymnase  : le Gymnase du quartier, clair, du bois partout, une seule tribune ;
 *   port     : le Terrain du Port, en plein air au coucher du soleil, grillage et immeubles.
 *
 * Repère : moteur (x, y, z) → 3D (x, z, -y). Le décor est le même à chaque match.
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { ecussonImage, nuance } from '../../../commun/ecusson.js';

const L = 14, W = 7.5;
const PANIER_X = 12.425, ANNEAU_Z = 3.05, ANNEAU_R = 0.225, PLANCHE_X = 12.8;

export const SALLES = [
  { id: 'palais', nom: 'Le Palais', desc: 'La grande salle, dans la pénombre.' },
  { id: 'gymnase', nom: 'Le Gymnase', desc: 'La salle du quartier, pleine de lumière.' },
  { id: 'port', nom: 'Le Terrain du Port', desc: 'En plein air, au coucher du soleil.' },
];
export const SALLE = Object.fromEntries(SALLES.map((s) => [s.id, s]));

function alea(graine) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
}
const lambert = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const basique = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
function boite(sx, sy, sz, m, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
  b.position.set(x, y, z);
  return b;
}
function texCanvas(l, h, dessin) {
  const c = document.createElement('canvas');
  c.width = l; c.height = h;
  dessin(c.getContext('2d'), l, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function ciel(scene, haut, horizon, bas = horizon) {
  const g = new THREE.SphereGeometry(400, 24, 12);
  const cols = [];
  const ch = new THREE.Color(haut), co = new THREE.Color(horizon), cb = new THREE.Color(bas);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 400;
    const c = y > 0 ? co.clone().lerp(ch, Math.pow(y, 0.6)) : co.clone().lerp(cb, Math.min(1, -y * 3));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  m.renderOrder = -10;
  scene.add(m);
}

/* ------------------------------------------------------------------ */
/* Le parquet                                                          */
/* ------------------------------------------------------------------ */

const MARGE = 1.6;
/** Le parquet et ses lignes, dessinés sur une toile (vu de dessus, x vers la droite, y vers le haut). */
function dessinerParquet(g, w, h, style, eq) {
  const lx = L + MARGE, ly = W + MARGE;
  const px = w / (2 * lx);
  const X = (x) => (x + lx) * px, Y = (y) => (ly - y) * px;
  // Le sol : des lattes de bois (ou de l'asphalte dehors).
  if (style.asphalte) {
    g.fillStyle = style.sol; g.fillRect(0, 0, w, h);
    const R = alea(7);
    for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + R() * 0.05})`; g.fillRect(R() * w, R() * h, 2, 2); }
    g.fillStyle = style.terrain; g.fillRect(X(-L), Y(W), 2 * L * px, 2 * W * px);
  } else {
    const R = alea(3);
    const latte = 0.18 * px;
    for (let y = 0; y < h; y += latte) {
      let x = -R() * 300;
      while (x < w) {
        const long = (1.2 + R() * 1.6) * px;
        const t = R();
        g.fillStyle = t < 0.33 ? style.bois[0] : t < 0.66 ? style.bois[1] : style.bois[2];
        g.fillRect(x, y, long, latte);
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x, y, 1.5, latte); g.fillRect(x, y, long, 1);
        x += long;
      }
    }
    // Le hors-jeu, plus sombre.
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(0, 0, w, Y(W)); g.fillRect(0, Y(-W), w, h - Y(-W)); g.fillRect(0, 0, X(-L), h); g.fillRect(X(L), 0, w - X(L), h);
  }
  // Les raquettes, aux couleurs du club qui reçoit.
  for (const s of [-1, 1]) {
    const xa = s * L, xb = s * (L - 5.8);
    g.fillStyle = style.raquette || nuance(eq.maillot.fond, -0.15);
    g.globalAlpha = 0.85;
    g.fillRect(Math.min(X(xa), X(xb)), Y(2.45), Math.abs(X(xa) - X(xb)), 4.9 * px);
    g.globalAlpha = 1;
  }
  // Le rond central, teinté.
  g.fillStyle = style.raquette || nuance(eq.maillot.fond, -0.15);
  g.globalAlpha = 0.6;
  g.beginPath(); g.arc(X(0), Y(0), 1.8 * px, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
  // Les lignes.
  g.strokeStyle = style.lignes || '#ffffff';
  g.lineWidth = 0.06 * px;
  g.strokeRect(X(-L), Y(W), 2 * L * px, 2 * W * px);
  g.beginPath(); g.moveTo(X(0), Y(W)); g.lineTo(X(0), Y(-W)); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), 1.8 * px, 0, Math.PI * 2); g.stroke();
  for (const s of [-1, 1]) {
    const hx = s * PANIER_X;
    // La raquette.
    g.strokeRect(Math.min(X(s * L), X(s * (L - 5.8))), Y(2.45), 5.8 * px, 4.9 * px);
    // Le cercle des lancers francs.
    g.beginPath(); g.arc(X(s * (L - 5.8)), Y(0), 1.8 * px, 0, Math.PI * 2); g.stroke();
    // La ligne à 3 points : droite dans les coins, puis l'arc.
    const dc = Math.sqrt(6.75 * 6.75 - 6.6 * 6.6);
    g.beginPath();
    g.moveTo(X(s * L), Y(6.6)); g.lineTo(X(hx - s * dc), Y(6.6));
    const a = Math.asin(6.6 / 6.75);
    if (s > 0) g.arc(X(hx), Y(0), 6.75 * px, Math.PI + a, Math.PI - a, true);
    else g.arc(X(hx), Y(0), 6.75 * px, -a, a, false);
    g.lineTo(X(s * L), Y(-6.6));
    g.stroke();
    // Le demi-cercle sous le panier.
    g.beginPath();
    if (s > 0) g.arc(X(hx), Y(0), 1.25 * px, Math.PI / 2, -Math.PI / 2); else g.arc(X(hx), Y(0), 1.25 * px, -Math.PI / 2, Math.PI / 2);
    g.stroke();
  }
}

function parquet(scene, style, qualite, eq) {
  const lx = L + MARGE, ly = W + MARGE;
  const l = qualite === 'basse' ? 1024 : 2048;
  const tex = texCanvas(l, Math.round((l * ly) / lx), (g, w, h) => dessinerParquet(g, w, h, style, eq));
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(2 * lx, 2 * ly), new THREE.MeshLambertMaterial({ map: tex }));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);
  // Le reflet du vernis (un voile clair, très léger, sous les projecteurs).
  if (!style.asphalte) {
    const vernis = new THREE.Mesh(new THREE.PlaneGeometry(2 * L, 2 * W), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.05, depthWrite: false }));
    vernis.rotation.x = -Math.PI / 2; vernis.position.y = 0.005;
    scene.add(vernis);
  }
  // L'écusson du club qui reçoit, au rond central.
  ecussonImage(eq, 256).then((img) => {
    if (!img) return;
    const t = texCanvas(256, 256, (g) => { g.globalAlpha = 0.9; g.drawImage(img, 28, 18, 200, 220); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.01;
    scene.add(m);
  });
}

/* ------------------------------------------------------------------ */
/* Les paniers                                                         */
/* ------------------------------------------------------------------ */

function panier(scene, s, style) {
  const g = new THREE.Group();
  const metal = lambert(style.poteau || '#2b2f38');
  const mousse = lambert(style.mousse || '#1d4fa0');
  // Le pied (protégé), le mât, le bras jusqu'à la planche.
  g.add(boite(1.1, 1.0, 1.7, mousse, s * 16.1, 0.5, 0));
  g.add(boite(0.22, 3.5, 0.22, metal, s * 15.85, 2.35, 0));
  const bras = boite(3.1, 0.14, 0.14, metal, s * (PLANCHE_X + 1.55), 3.55, 0);
  g.add(bras);
  const diag = boite(2.6, 0.1, 0.1, metal, s * (PLANCHE_X + 1.75), 2.95, 0);
  diag.rotation.z = s * 0.45;
  g.add(diag);
  g.add(boite(0.9, 1.0, 1.65, mousse, s * 15.6, 0.5, 0));
  // La planche : du verre, un cadre, le petit carré.
  const verre = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, 1.8), new THREE.MeshLambertMaterial({ color: '#dfefff', transparent: true, opacity: 0.32, depthWrite: false }));
  verre.position.set(s * PLANCHE_X, 3.425, 0);
  g.add(verre);
  const cadre = basique('#ffffff');
  for (const [sy, sz, y, z] of [[0.05, 1.8, 3.925, 0], [0.05, 1.8, 2.925, 0], [1.05, 0.05, 3.425, 0.875], [1.05, 0.05, 3.425, -0.875]]) g.add(boite(0.04, sy, sz, cadre, s * PLANCHE_X, y, z));
  const rouge = basique(style.carre || '#e8452c');
  for (const [sy, sz, y, z] of [[0.04, 0.59, 3.5, 0], [0.04, 0.59, 3.06, 0], [0.45, 0.04, 3.28, 0.295], [0.45, 0.04, 3.28, -0.295]]) g.add(boite(0.035, sy, sz, rouge, s * (PLANCHE_X - 0.02), y, z));
  // L'arceau et sa fixation.
  const arceau = new THREE.Mesh(new THREE.TorusGeometry(ANNEAU_R, 0.017, 6, 28), lambert('#ff5a1a'));
  arceau.rotation.x = Math.PI / 2;
  arceau.position.set(s * PANIER_X, ANNEAU_Z, 0);
  g.add(arceau);
  g.add(boite(0.16, 0.05, 0.12, lambert('#ff5a1a'), s * (PLANCHE_X - 0.08), ANNEAU_Z, 0));
  // Le filet : un cône ouvert en mailles.
  const geoF = new THREE.CylinderGeometry(ANNEAU_R, 0.13, 0.42, 14, 3, true);
  const filet = new THREE.Mesh(geoF, new THREE.MeshBasicMaterial({ color: '#f6f6f6', wireframe: true, transparent: true, opacity: 0.85 }));
  filet.position.set(s * PANIER_X, ANNEAU_Z - 0.21, 0);
  g.add(filet);
  scene.add(g);
  return { filet, arceau, gonfle: 0, tremble: 0, t: 0 };
}

/* ------------------------------------------------------------------ */
/* Le public                                                           */
/* ------------------------------------------------------------------ */

/** Une foule de petits supporters (une seule géométrie, des milliers d'exemplaires) qui sautent ensemble. */
function foule(scene, places, couleurs, qualite) {
  const corps = new THREE.BoxGeometry(0.42, 0.62, 0.3);
  corps.translate(0, 0.31, 0);
  const tete = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  tete.translate(0, 0.76, 0);
  const pos = [], nrm = [], col = [];
  [corps, tete].forEach((gg, k) => {
    const g2 = gg.toNonIndexed();
    pos.push(...g2.attributes.position.array);
    nrm.push(...g2.attributes.normal.array);
    for (let i = 0; i < g2.attributes.position.count; i++) col.push(k ? 0.85 : 1, k ? 0.7 : 1, k ? 0.55 : 1);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const U = { uTemps: { value: 0 }, uAmp: { value: 0.04 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTemps = U.uTemps; sh.uniforms.uAmp = U.uAmp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTemps; uniform float uAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ou = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float ph = fract(sin(dot(ou.xz, vec2(12.9898, 78.233))) * 43758.5453);
        transformed.y += abs(sin(uTemps * (5.0 + ph * 3.0) + ph * 6.28)) * uAmp * (0.6 + ph);`);
  };
  const garde = qualite === 'basse' ? 0.45 : qualite === 'moyenne' ? 0.75 : 1;
  const R = alea(places.length);
  const choisies = places.filter(() => R() < garde);
  const im = new THREE.InstancedMesh(g, m, choisies.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const c = new THREE.Color();
  choisies.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry + (R() - 0.5) * 0.5);
    const t = 0.9 + R() * 0.2;
    sc.set(t, t, t);
    M.compose(new THREE.Vector3(p.x, p.y, p.z), q, sc);
    im.setMatrixAt(i, M);
    c.set(couleurs(p, R));
    im.setColorAt(i, c);
  });
  im.instanceMatrix.needsUpdate = true;
  scene.add(im);
  return U;
}

/** Des gradins : des marches, et une place tous les 60 cm. axe 'x' : le long du terrain ; 'z' : derrière un panier. */
function gradins(scene, mat, { x0, x1, z0, sens, rangs, pasR = 0.85, hauteur = 0.45, base = 0.5, axe = 'x' }) {
  const places = [];
  for (let k = 0; k < rangs; k++) {
    const d = z0 + sens * k * pasR;
    const y = base + k * hauteur;
    const longueur = x1 - x0;
    const b = axe === 'x'
      ? boite(longueur, y, pasR, mat, (x0 + x1) / 2, y / 2, d + sens * pasR / 2)
      : boite(pasR, y, longueur, mat, d + sens * pasR / 2, y / 2, (x0 + x1) / 2);
    b.receiveShadow = true;
    scene.add(b);
    for (let u = x0 + 0.4; u < x1 - 0.3; u += 0.62) {
      const ry = axe === 'x' ? (sens < 0 ? 0 : Math.PI) : sens < 0 ? Math.PI / 2 : -Math.PI / 2;
      places.push(axe === 'x' ? { x: u, y, z: d + sens * pasR * 0.45, ry } : { x: d + sens * pasR * 0.45, y, z: u, ry });
    }
  }
  return places;
}

/** Les couleurs du public : à gauche plutôt les supporters de l'équipe de gauche, à droite l'autre. */
function couleursPublic(kits) {
  const neutres = ['#d8d8d8', '#3a3a44', '#6b6b78', '#8a5a3a', '#2a3a5a', '#e8e0cc'];
  return (p, R) => {
    const r = R();
    const camp = p.x < 0 ? 0 : 1;
    const k = r < 0.6 ? kits[camp] : r < 0.74 ? kits[1 - camp] : null;
    if (!k) return neutres[Math.floor(R() * neutres.length)];
    return R() < 0.7 ? k.fond : R() < 0.5 ? k.motifC : k.short;
  };
}

/** L'écran : un panneau lumineux où l'on écrit le score (rend la fonction qui écrit). */
function ecranTexture(l, h) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round((512 * h) / l);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const ecrire = (lignes, couleur = '#ffb347') => {
    const g = c.getContext('2d');
    g.fillStyle = '#050608'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = couleur;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lignes.length;
    lignes.forEach((txt, i) => {
      g.font = `900 ${i ? 34 : 54}px "Arial Black", Impact, sans-serif`;
      g.fillText(txt, c.width / 2, (c.height * (i + 0.6)) / (n + 0.2), c.width - 20);
    });
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let yy = 0; yy < c.height; yy += 4) g.fillRect(0, yy, c.width, 1);
    t.needsUpdate = true;
  };
  return { t, ecrire };
}

/** Le cube suspendu au-dessus du rond central (quatre écrans). */
function cubeSuspendu(scene) {
  const { t, ecrire } = ecranTexture(4, 2.2);
  const g = new THREE.Group();
  g.add(boite(4.2, 2.4, 4.2, lambert('#15171c')));
  for (const [x, z, ry] of [[0, 2.11, 0], [0, -2.11, Math.PI], [2.11, 0, Math.PI / 2], [-2.11, 0, -Math.PI / 2]]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.2), new THREE.MeshBasicMaterial({ map: t, fog: false }));
    e.position.set(x, 0, z); e.rotation.y = ry;
    g.add(e);
  }
  g.add(boite(0.08, 6, 0.08, lambert('#222'), 0, 4.2, 0));
  g.position.set(0, 11.5, 0);
  scene.add(g);
  return ecrire;
}

/* ------------------------------------------------------------------ */
/* La salle                                                            */
/* ------------------------------------------------------------------ */

export function creerSalle(scene, id, { qualite, equipes, kits }) {
  const R = alea(id.length * 97 + 13);
  const publicCouleurs = couleursPublic(kits);
  const hemi = new THREE.HemisphereLight('#ffffff', '#554433', 1.2);
  scene.add(hemi);
  const lampe = new THREE.DirectionalLight('#ffffff', 2.2);
  lampe.position.set(-6, 30, 12);
  scene.add(lampe, lampe.target);
  if (qualite === 'haute') {
    lampe.castShadow = true;
    lampe.shadow.mapSize.set(2048, 2048);
    const c = lampe.shadow.camera;
    c.left = -20; c.right = 20; c.top = 14; c.bottom = -14; c.near = 5; c.far = 80;
    lampe.shadow.bias = -0.0008;
  }
  const out = { paniers: [], foule: null, ecran: null };
  const eq = equipes[0];

  if (id === 'gymnase') {
    const style = { bois: ['#e2b57c', '#dcae73', '#e8bd86'], mousse: '#2c62b8' };
    scene.background = new THREE.Color('#d9d2c4');
    scene.fog = new THREE.Fog('#d9d2c4', 50, 120);
    hemi.color.set('#fffaf0'); hemi.groundColor.set('#a08060'); hemi.intensity = 1.5;
    lampe.intensity = 1.8;
    parquet(scene, style, qualite, eq);
    out.paniers = [panier(scene, 1, style), panier(scene, -1, style)];
    // Les murs : briques peintes en bas, des fenêtres en haut, la charpente.
    const mur = lambert('#e9e2d2'), bas = lambert(nuance(eq.maillot.fond, -0.25));
    scene.add(boite(50, 12, 0.4, mur, 0, 6, -15), boite(50, 2.2, 0.42, bas, 0, 1.1, -14.98));
    scene.add(boite(0.4, 12, 32, mur, -21, 6, 0), boite(0.4, 12, 32, mur, 21, 6, 0));
    const vitre = basique('#cfe8ff');
    for (let k = -4; k <= 4; k++) scene.add(boite(3.2, 2.2, 0.1, vitre, k * 5, 8.6, -14.75));
    for (let k = -3; k <= 3; k++) scene.add(boite(0.35, 0.6, 32, lambert('#8a6a48'), k * 6.5, 11.6, 0));
    // Une tribune en bois d'un côté, des bancs de l'autre.
    const bois = lambert('#b98a55');
    const places = gradins(scene, bois, { x0: -15, x1: 15, z0: -9.6, sens: -1, rangs: 6, base: 0.45, hauteur: 0.42 });
    out.foule = foule(scene, places, publicCouleurs, qualite);
    for (const s of [-1, 1]) scene.add(boite(5, 0.45, 0.45, bois, s * 5, 0.22, 9.2));
    // Le tableau d'affichage, accroché au mur.
    const { t, ecrire } = ecranTexture(6, 2.4);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), new THREE.MeshBasicMaterial({ map: t }));
    e.position.set(0, 8.2, -14.7);
    scene.add(boite(6.4, 2.8, 0.2, lambert('#202226'), 0, 8.2, -14.82), e);
    out.ecran = ecrire;
  } else if (id === 'port') {
    const style = { asphalte: true, sol: '#3d4048', terrain: '#2f6aa0', raquette: '#c8442c', lignes: '#f4f4f4', mousse: '#c8442c', poteau: '#1d1f24' };
    ciel(scene, '#2a2a6a', '#ff8a5a', '#2a2030');
    scene.fog = new THREE.Fog('#a05a6a', 60, 260);
    hemi.color.set('#ffd2b0'); hemi.groundColor.set('#40304a'); hemi.intensity = 1.25;
    lampe.color.set('#ffd6a8'); lampe.intensity = 2.0; lampe.position.set(-30, 18, -20);
    const sol = boite(120, 0.1, 90, lambert('#2c2e34'), 0, -0.06, 0);
    scene.add(sol);
    parquet(scene, style, qualite, eq);
    out.paniers = [panier(scene, 1, style), panier(scene, -1, style)];
    // Le grillage autour du terrain.
    const grille = new THREE.MeshBasicMaterial({ color: '#9aa0a8', wireframe: true, transparent: true, opacity: 0.35 });
    for (const [l, x, z, ry] of [[36, 0, -10.5, 0], [36, 0, 10.5, 0], [21, -18, 0, Math.PI / 2], [21, 18, 0, Math.PI / 2]]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(l, 4, Math.round(l * 2), 8), grille);
      f.position.set(x, 2, z); f.rotation.y = ry;
      scene.add(f);
    }
    for (let k = -9; k <= 9; k++) scene.add(boite(0.08, 4, 0.08, lambert('#5a5e66'), k * 2, 2, -10.5));
    // Des immeubles derrière, quelques fenêtres allumées.
    const fen = texCanvas(64, 128, (g, w, h) => {
      g.fillStyle = '#20202c'; g.fillRect(0, 0, w, h);
      const r = alea(11);
      for (let y = 6; y < h; y += 12) for (let x = 6; x < w; x += 12) { g.fillStyle = r() < 0.35 ? '#ffd890' : '#2c2c3a'; g.fillRect(x, y, 6, 7); }
    });
    for (let k = 0; k < 16; k++) {
      const hgt = 12 + R() * 28, lg = 8 + R() * 8;
      const b = new THREE.Mesh(new THREE.BoxGeometry(lg, hgt, 8), new THREE.MeshBasicMaterial({ map: fen, color: '#c8c0d8' }));
      b.position.set(-75 + k * 10 + R() * 4, hgt / 2, -40 - R() * 25);
      scene.add(b);
    }
    // Le public, debout le long du grillage (et sur quelques marches).
    const beton = lambert('#5a5c62');
    const places = gradins(scene, beton, { x0: -16, x1: 16, z0: -11, sens: -1, rangs: 3, base: 0.35, hauteur: 0.4 });
    out.foule = foule(scene, places, publicCouleurs, qualite);
    // Deux lampadaires.
    for (const x of [-17, 17]) {
      scene.add(boite(0.15, 7, 0.15, lambert('#2a2c30'), x, 3.5, -10));
      scene.add(boite(1.2, 0.2, 0.5, basique('#fff2c8'), x, 7, -9.7));
    }
  } else {
    // Le Palais : la pénombre, le terrain sous les projecteurs, des tribunes tout autour.
    const style = { bois: ['#c98f52', '#c38a4c', '#d09859'], mousse: '#1b1d24' };
    scene.background = new THREE.Color('#07080d');
    scene.fog = new THREE.Fog('#07080d', 45, 110);
    hemi.color.set('#d8dcff'); hemi.groundColor.set('#2a1e14'); hemi.intensity = 1.05;
    lampe.color.set('#fff6e0'); lampe.intensity = 2.6;
    parquet(scene, style, qualite, eq);
    out.paniers = [panier(scene, 1, style), panier(scene, -1, style)];
    // Le pourtour du terrain (sombre) et les panneaux lumineux.
    scene.add(boite(70, 0.05, 50, lambert('#14161c'), 0, -0.03, 0));
    const panneauT = texCanvas(1024, 48, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, kits[0].fond); gr.addColorStop(0.5, '#ff8a2a'); gr.addColorStop(1, kits[1].fond);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = '900 30px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let k = 0; k < 4; k++) g.fillText('DOUBLE PAS', (k + 0.5) * w / 4, h / 2);
    });
    const panneauM = new THREE.MeshBasicMaterial({ map: panneauT });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 0.2), panneauM);
    p1.position.set(0, 0.4, -9.6);
    scene.add(p1);
    // La table de marque.
    scene.add(boite(6, 0.9, 0.9, lambert('#1b1d24'), 0, 0.45, -8.7), boite(6, 0.08, 1.1, lambert('#2d3140'), 0, 0.92, -8.7));
    const beton = lambert('#22252e');
    const places = [
      ...gradins(scene, beton, { x0: -20, x1: 20, z0: -10.6, sens: -1, rangs: 14, base: 1, hauteur: 0.5 }),
      ...gradins(scene, beton, { x0: -20, x1: 20, z0: 11.2, sens: 1, rangs: 8, base: 1, hauteur: 0.5 }),
      ...gradins(scene, beton, { x0: -9.5, x1: 9.5, z0: 18.2, sens: 1, rangs: 10, axe: 'z', base: 1, hauteur: 0.5 }),
      ...gradins(scene, beton, { x0: -9.5, x1: 9.5, z0: -18.2, sens: -1, rangs: 10, axe: 'z', base: 1, hauteur: 0.5 }),
    ];
    out.foule = foule(scene, places, publicCouleurs, qualite);
    // Les rampes de projecteurs au plafond.
    for (const z of [-6, 0, 6]) scene.add(boite(30, 0.15, 0.4, basique('#fff4d0'), 0, 14, z));
    out.ecran = cubeSuspendu(scene);
  }
  let t = 0;
  out.maj = (dt, excitation) => {
    t += dt;
    if (out.foule) { out.foule.uTemps.value = t; out.foule.uAmp.value = 0.04 + excitation * 0.32; }
    for (const p of out.paniers) {
      // Le filet qui se soulève (un panier) ; l'arceau qui vibre (un dunk, un tir sur le cercle).
      p.gonfle *= Math.pow(0.05, dt);
      p.tremble *= Math.pow(0.02, dt);
      p.t += dt;
      p.filet.scale.set(1 - p.gonfle * 0.12, 1 - p.gonfle * 0.35, 1 - p.gonfle * 0.12);
      p.filet.position.y = ANNEAU_Z - 0.21 + p.gonfle * 0.07;
      p.filet.rotation.y = Math.sin(p.t * 14) * p.gonfle * 0.4;
      p.arceau.position.y = ANNEAU_Z + Math.sin(p.t * 45) * p.tremble * 0.03;
    }
  };
  return out;
}

/** Pour les autres sports (la boxe) : la foule, les gradins, leurs couleurs, une toile en texture, l'écran suspendu. */
export { foule, gradins, couleursPublic, texCanvas, cubeSuspendu, lambert, basique, boite };
