/**
 * PETIT PONT — les stades, construits par le code.
 *
 * Partout le même terrain (40 m sur 20, des bandes tout autour, deux buts
 * avec leurs filets) ; autour, quatre décors :
 *   Le Chaudron : le grand stade, la nuit, quatre pylônes de projecteurs et
 *                 des tribunes pleines (le public aux couleurs des équipes) ;
 *   Le Toit     : une cage sur un toit, la ville illuminée tout autour ;
 *   La Halle    : le gymnase du quartier, parquet, néons et gradins ;
 *   La Plage    : au bord de l'eau, au coucher du soleil, sous les palmiers.
 *
 * Repère : x la longueur, y la hauteur, z la largeur (z = -y du moteur :
 * le fond de l'écran est vers -z).
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';
import { ecussonImage, nuance } from '../ecusson.js';

const L = 20, W = 10;

/** Un petit hasard reproductible (le décor est le même à chaque match). */
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
  t.anisotropy = 4;
  return t;
}

/** Le ciel : une grande sphère en dégradé (haut, horizon, bas). */
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
  return m;
}

/* ------------------------------------------------------------------ */
/* Le terrain                                                          */
/* ------------------------------------------------------------------ */

function dessinerTerrain(g, l, h, style, eq) {
  const px = l / 41;
  const X = (x) => (x + 20.5) * px, Y = (z) => (z + 10.5) * px;
  const R = alea(77);
  if (style === 'parquet') {
    g.fillStyle = '#c8955a';
    g.fillRect(0, 0, l, h);
    const lame = 0.18 * px;
    for (let y = 0; y < h; y += lame) {
      let x = -R() * 200;
      while (x < l) {
        const long = (1.2 + R() * 1.6) * px;
        g.fillStyle = `hsl(${30 + R() * 6}, ${45 + R() * 12}%, ${50 + R() * 10}%)`;
        g.fillRect(x, y, long - 1, lame - 1);
        x += long;
      }
    }
    // Les surfaces et le rond central peints.
    g.fillStyle = 'rgba(30, 90, 170, .55)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(X(s * 20), Y(-1.5), 6 * px, 0, Math.PI * 2);
      g.arc(X(s * 20), Y(1.5), 6 * px, 0, Math.PI * 2);
      g.fill();
      g.fillRect(X(s > 0 ? 14 : -20), Y(-1.5), 6 * px, 3 * px);
    }
    g.fillStyle = '#c8955a';
    g.fillRect(0, 0, X(-20), h); g.fillRect(X(20), 0, l, h);
  } else {
    const [c1, c2] = style === 'plage' ? ['#4f9a3c', '#5ba845'] : style === 'toit' ? ['#2f8a4a', '#369853'] : ['#2e8b3e', '#37a04a'];
    for (let k = 0; k < 10; k++) {
      g.fillStyle = k % 2 ? c1 : c2;
      g.fillRect(X(-20 + k * 4), 0, 4 * px + 1, h);
    }
    g.fillStyle = c1;
    g.fillRect(0, 0, X(-20), h); g.fillRect(X(20), 0, l, h);
    // Un peu de grain dans l'herbe.
    for (let k = 0; k < (l * h) / 900; k++) {
      g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)';
      g.fillRect(R() * l, R() * h, 2 + R() * 3, 2 + R() * 3);
    }
    // L'usure devant les buts.
    for (const s of [-1, 1]) {
      const gr = g.createRadialGradient(X(s * 18.5), Y(0), 0, X(s * 18.5), Y(0), 3 * px);
      gr.addColorStop(0, 'rgba(120, 100, 60, .35)'); gr.addColorStop(1, 'rgba(120, 100, 60, 0)');
      g.fillStyle = gr;
      g.fillRect(X(s * 18.5) - 3 * px, Y(0) - 3 * px, 6 * px, 6 * px);
    }
  }
  // Les lignes.
  g.strokeStyle = style === 'parquet' ? '#f4f1e8' : 'rgba(255, 255, 255, .92)';
  g.lineWidth = 0.09 * px;
  g.strokeRect(X(-20), Y(-10), 40 * px, 20 * px);
  g.beginPath(); g.moveTo(X(0), Y(-10)); g.lineTo(X(0), Y(10)); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), 3 * px, 0, Math.PI * 2); g.stroke();
  const point = (x, y, r = 0.12) => { g.beginPath(); g.arc(X(x), Y(y), r * px, 0, Math.PI * 2); g.fillStyle = g.strokeStyle; g.fill(); };
  point(0, 0);
  for (const s of [-1, 1]) {
    // La surface du futsal : deux quarts de cercle de 6 m, reliés par un trait.
    g.beginPath();
    if (s < 0) {
      g.arc(X(-20), Y(-1.5), 6 * px, -Math.PI / 2, 0);
      g.lineTo(X(-14), Y(1.5));
      g.arc(X(-20), Y(1.5), 6 * px, 0, Math.PI / 2);
    } else {
      g.arc(X(20), Y(-1.5), 6 * px, -Math.PI / 2, Math.PI, true);
      g.lineTo(X(14), Y(1.5));
      g.arc(X(20), Y(1.5), 6 * px, Math.PI, Math.PI / 2, true);
    }
    g.stroke();
    point(s * 14, 0); point(s * 10, 0);
    for (const t of [-1, 1]) { g.beginPath(); g.arc(X(s * 20), Y(t * 10), 0.3 * px, 0, Math.PI * 2); g.stroke(); }
  }
  return eq;
}

function terrain(scene, style, qualite, eqDomicile) {
  const l = qualite === 'haute' ? 2048 : 1024;
  let tex = null;
  tex = texCanvas(l, l / 2, (g, w, h) => dessinerTerrain(g, w, h, style));
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(41, 20.5), new THREE.MeshLambertMaterial({ map: tex }));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);
  // L'écusson de l'équipe qui reçoit, peint dans le rond central.
  ecussonImage(eqDomicile, 256).then((img) => {
    if (!img) return;
    const c = tex.image, g = c.getContext('2d');
    const px = c.width / 41;
    g.globalAlpha = style === 'parquet' ? 0.7 : 0.32;
    const hh = 4.2 * px, ll = hh * (100 / 120);
    g.drawImage(img, c.width / 2 - ll / 2, c.height / 2 - hh / 2, ll, hh);
    g.globalAlpha = 1;
    tex.needsUpdate = true;
  });
  return sol;
}

/* ------------------------------------------------------------------ */
/* Les bandes et leurs panneaux                                        */
/* ------------------------------------------------------------------ */

const MARQUES = [
  ['INSERT COIN', '#ffd23f', '#1a1030'], ['PETIT PONT', '#ffffff', '#0f7a3a'], ['STREET COMBAT', '#ffc83d', '#c4122f'],
  ['RAID', '#f0dcae', '#3a2410'], ['LE VELOURS NOIR', '#e8c07a', '#160a14'], ['FIESTA', '#ffffff', '#ff4fa3'],
  ['BRASIER', '#ffe0a0', '#d9480f'], ['ZÉNITH', '#fff59d', '#3b1fa3'], ['SKULL KING', '#f4f4f4', '#1b1b1b'], ['ÉCHO', '#ffffff', '#00a3c4'],
];

function texturePanneaux(decalage) {
  return texCanvas(2048, 64, (g, w, h) => {
    let x = 0, k = decalage;
    while (x < w) {
      const [nom, enc, fond] = MARQUES[k % MARQUES.length];
      const lp = 256;
      g.fillStyle = fond; g.fillRect(x, 0, lp, h);
      g.fillStyle = enc;
      g.font = '900 30px "Arial Black", Impact, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(nom, x + lp / 2, h / 2 + 2, lp - 20);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, 0, lp, 6);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + lp - 3, 0, 3, h);
      x += lp; k += 1;
    }
  });
}

function bandes(scene, couleur) {
  const g = new THREE.Group();
  const cote = lambert(couleur);
  const haut = lambert(nuance(couleur, 0.25));
  const panneau = (long, h, x, z, ry, decal) => {
    const t = texturePanneaux(decal);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(long / 22, 1);
    const face = new THREE.MeshBasicMaterial({ map: t });
    const b = new THREE.Mesh(new THREE.BoxGeometry(long, h, 0.14), [cote, cote, haut, cote, face, cote]);
    b.position.set(x, h / 2, z);
    b.rotation.y = ry;
    b.castShadow = true;
    g.add(b);
  };
  // Le côté du fond, le côté de la caméra (plus bas : on voit les pieds), les deux bouts.
  panneau(40.6, 0.95, 0, -W - 0.12, 0, 0);
  panneau(40.6, 0.42, 0, W + 0.12, Math.PI, 3);
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) panneau(8.6, 0.95, s * (L + 0.12), t * 5.85, -s * Math.PI / 2, s > 0 ? 5 : 7);
  }
  scene.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* Les buts                                                            */
/* ------------------------------------------------------------------ */

function but(scene, s) {
  const g = new THREE.Group();
  const blanc = lambert('#f6f6f2', { emissive: '#222222' });
  const poteau = new THREE.CylinderGeometry(0.06, 0.06, 2, 10);
  for (const t of [-1, 1]) { const p = new THREE.Mesh(poteau, blanc); p.position.set(0, 1, t * 1.5); p.castShadow = true; g.add(p); }
  const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.12, 10), blanc);
  barre.rotation.x = Math.PI / 2; barre.position.set(0, 2, 0); barre.castShadow = true;
  g.add(barre);
  // Le filet : un quadrillage (en lignes), qui se gonfle quand le ballon y entre.
  const filet = new THREE.Group();
  const pts = [];
  const P = 1.2, PH = 0.8, H = 2, D = 1.5, pasF = 0.16;
  const profondeur = (y) => PH + (P - PH) * (1 - y / H);
  for (let z = -D; z <= D + 1e-6; z += pasF) { pts.push(profondeur(0), 0, z, profondeur(H), H, z); }
  for (let y = 0; y <= H + 1e-6; y += pasF) { pts.push(profondeur(y), y, -D, profondeur(y), y, D); }
  for (const t of [-1, 1]) {
    for (let x = 0; x <= P + 1e-6; x += pasF) pts.push(x, 0, t * D, Math.min(x, PH), H, t * D);
    for (let y = 0; y <= H + 1e-6; y += pasF) pts.push(0, y, t * D, profondeur(y), y, t * D);
  }
  for (let x = 0; x <= PH + 1e-6; x += pasF) pts.push(x, H, -D, x, H, D);
  for (let z = -D; z <= D + 1e-6; z += pasF) pts.push(0, H, z, PH, H, z);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  filet.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: '#f2f2f2', transparent: true, opacity: 0.55 })));
  g.add(filet);
  // Un fond sombre derrière le filet (on voit mieux le ballon y entrer).
  const fond = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.1), basique('#0b0d10', { transparent: true, opacity: 0.35 }));
  fond.position.set(P + 0.02, 1.05, 0); fond.rotation.y = -Math.PI / 2;
  g.add(fond);
  g.position.x = s * L;
  if (s < 0) g.rotation.y = Math.PI;
  scene.add(g);
  return { g, filet, gonfle: 0 };
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
  const geoms = [corps, tete];
  const pos = [], nrm = [], col = [];
  geoms.forEach((gg, k) => {
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
    const pal = couleurs(p, R);
    c.set(pal);
    im.setColorAt(i, c);
  });
  im.instanceMatrix.needsUpdate = true;
  scene.add(im);
  return U;
}

/** Les gradins : des marches, et une place tous les 60 cm. */
function gradins(scene, mat, { x0, x1, z0, sens, rangs, pasR = 0.85, hauteur = 0.45, base = 0.6, axe = 'x' }) {
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
    const k = r < 0.62 ? kits[camp] : r < 0.75 ? kits[1 - camp] : null;
    if (!k) return neutres[Math.floor(R() * neutres.length)];
    return R() < 0.7 ? k.fond : R() < 0.5 ? k.motifC : k.short;
  };
}

/* ------------------------------------------------------------------ */
/* Les projecteurs, les palmiers, la ville…                            */
/* ------------------------------------------------------------------ */

let texHalo = null;
function halo() {
  if (texHalo) return texHalo;
  texHalo = texCanvas(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,250,220,.55)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  return texHalo;
}
function lueur(scene, x, y, z, taille, couleur = '#fff6dc') {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: couleur, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.set(x, y, z); s.scale.set(taille, taille, 1);
  scene.add(s);
  return s;
}

function pylone(scene, x, z, h) {
  const gris = lambert('#5a5e66');
  const mat = boite(0.5, h, 0.5, gris, x, h / 2, z);
  scene.add(mat);
  const tete = new THREE.Group();
  tete.position.set(x, h, z);
  tete.add(boite(4, 2.2, 0.4, lambert('#30333a')));
  const lampe = basique('#fffbe8');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) tete.add(boite(1.05, 0.8, 0.1, lampe, -1.3 + i * 1.3, -0.5 + j * 1.0, 0.22));
  tete.lookAt(0, 0, 0);
  scene.add(tete);
  lueur(scene, x * 0.97, h, z * 0.97, 9);
}

function palmier(scene, x, z, R) {
  const g = new THREE.Group();
  const tronc = lambert('#8a6a44');
  let px = 0, py = 0;
  const pench = (R() - 0.5) * 0.5;
  for (let k = 0; k < 7; k++) {
    const s = boite(0.32 - k * 0.02, 0.9, 0.32 - k * 0.02, tronc, px, py + 0.45, 0);
    s.rotation.z = pench * k * 0.15;
    g.add(s);
    px += Math.sin(pench * k * 0.15) * -0.9; py += 0.88;
  }
  const feuille = lambert('#2f8a3a');
  for (let k = 0; k < 7; k++) {
    const f = boite(2.6, 0.06, 0.5, feuille, 0, 0, 0);
    const piv = new THREE.Group();
    piv.position.set(px, py, 0);
    f.position.x = 1.3;
    piv.rotation.y = (k / 7) * Math.PI * 2 + R();
    f.rotation.z = -0.45;
    piv.add(f);
    g.add(piv);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

function ville(scene, R) {
  const fen = texCanvas(64, 128, (g, w, h) => {
    g.fillStyle = '#10131c'; g.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) {
      if (R() < 0.42) { g.fillStyle = R() < 0.8 ? '#ffd88a' : '#9ad8ff'; g.fillRect(x, y, 4, 5); }
    }
  });
  fen.wrapS = fen.wrapT = THREE.RepeatWrapping;
  for (let k = 0; k < 70; k++) {
    const a = (k / 70) * Math.PI * 2 + R() * 0.05;
    const d = 55 + R() * 45;
    const h = 12 + R() * 40;
    const l = 6 + R() * 10;
    const t = fen.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.round(l / 6), Math.round(h / 10));
    const b = boite(l, h, l, new THREE.MeshBasicMaterial({ map: t }), Math.cos(a) * d, h / 2 - 8, Math.sin(a) * d);
    b.rotation.y = R() * 3;
    scene.add(b);
  }
}

function etoiles(scene, R, n = 400) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2, h = 0.15 + R() * 0.85;
    pts.push(Math.cos(a) * 300 * (1 - h * 0.5), 40 + h * 220, Math.sin(a) * 300 * (1 - h * 0.5));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, sizeAttenuation: false, fog: false })));
}

/** Une guirlande d'ampoules de couleur, entre deux points. */
function guirlande(scene, a, b, n, R) {
  const cols = ['#ff5a5a', '#ffd23f', '#5affa0', '#5ac8ff', '#ff7ae0'];
  const geo = new THREE.SphereGeometry(0.09, 6, 4);
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const p = new THREE.Vector3().lerpVectors(a, b, u);
    p.y -= Math.sin(u * Math.PI) * 0.9;
    const m = new THREE.Mesh(geo, basique(cols[Math.floor(R() * cols.length)]));
    m.position.copy(p);
    scene.add(m);
  }
}

/** Un grillage (pour la cage du toit). */
function grillage(long, haut) {
  const t = texCanvas(64, 64, (g) => {
    g.strokeStyle = 'rgba(200, 210, 220, .55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(long / 0.5, haut / 0.5);
  return new THREE.Mesh(new THREE.PlaneGeometry(long, haut), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
}

/* ------------------------------------------------------------------ */
/* Le stade                                                            */
/* ------------------------------------------------------------------ */

/**
 * Construit le stade dans la scène.
 * @returns {{ buts, foule, maj(dt, excitation), ecran?(texte) }}
 */
export function creerStade(scene, id, { qualite, equipes, kits }) {
  const R = alea(id.length * 97 + 13);
  const out = { buts: [but(scene, 1), but(scene, -1)], foule: null, lumieres: [] };
  const publicCouleurs = couleursPublic(kits);
  const hemi = new THREE.HemisphereLight('#ffffff', '#335533', 1.2);
  scene.add(hemi);
  const soleil = new THREE.DirectionalLight('#ffffff', 2.2);
  soleil.position.set(-12, 30, 14);
  soleil.target.position.set(0, 0, 0);
  scene.add(soleil, soleil.target);
  if (qualite === 'haute') {
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(2048, 2048);
    const c = soleil.shadow.camera;
    c.left = -26; c.right = 26; c.top = 16; c.bottom = -16; c.near = 5; c.far = 80;
    soleil.shadow.bias = -0.0008;
  }
  out.soleil = soleil;
  out.hemi = hemi;

  if (id === 'chaudron') {
    ciel(scene, '#03050f', '#1a2240', '#0a0c14');
    scene.fog = new THREE.Fog('#0c1224', 70, 220);
    hemi.color.set('#c8d4ff'); hemi.groundColor.set('#1c2a1c'); hemi.intensity = 1.05;
    soleil.color.set('#fff4dc'); soleil.intensity = 2.4; soleil.position.set(-8, 34, 10);
    const sol = boite(140, 0.1, 100, lambert('#22252b'), 0, -0.06, 0);
    sol.receiveShadow = true;
    scene.add(sol);
    terrain(scene, 'herbe', qualite, equipes[0]);
    bandes(scene, '#1d2a44');
    const beton = lambert('#3a3e48');
    const places = [
      ...gradins(scene, beton, { x0: -26, x1: 26, z0: -12.2, sens: -1, rangs: 12, base: 1.2 }),
      ...gradins(scene, beton, { x0: -12, x1: 12, z0: 23.2, sens: 1, rangs: 10, axe: 'z', base: 1.2 }),
      ...gradins(scene, beton, { x0: -12, x1: 12, z0: -23.2, sens: -1, rangs: 10, axe: 'z', base: 1.2 }),
    ];
    out.foule = foule(scene, places, publicCouleurs, qualite);
    // Le toit des tribunes et sa rampe lumineuse.
    scene.add(boite(56, 0.5, 4, lambert('#262a33'), 0, 8.4, -21));
    scene.add(boite(54, 0.18, 0.18, basique('#bfe0ff'), 0, 8.1, -19));
    for (const [x, z] of [[-27, -16], [27, -16], [-27, 15], [27, 15]]) pylone(scene, x, z, 19);
    // L'écran géant, au-dessus du fond.
    out.ecran = ecranGeant(scene, 0, 11.5, -22.5, 9, 3);
  } else if (id === 'toit') {
    ciel(scene, '#0b0820', '#3a2a5a', '#120c20');
    scene.fog = new THREE.Fog('#2a2040', 60, 180);
    etoiles(scene, R);
    hemi.color.set('#b8b0ff'); hemi.groundColor.set('#2a2030'); hemi.intensity = 1.0;
    soleil.color.set('#fff0dc'); soleil.intensity = 2.2;
    const sol = boite(70, 0.1, 50, lambert('#4a4650'), 0, -0.06, 0);
    sol.receiveShadow = true;
    scene.add(sol);
    // Le rebord du toit.
    for (const s of [-1, 1]) { scene.add(boite(70, 1.1, 0.6, lambert('#5a5560'), 0, 0.5, s * 25)); scene.add(boite(0.6, 1.1, 50, lambert('#5a5560'), s * 35, 0.5, 0)); }
    terrain(scene, 'toit', qualite, equipes[0]);
    bandes(scene, '#3a1f5a');
    // La cage : du grillage au fond et aux bouts.
    const g1 = grillage(41, 4.5); g1.position.set(0, 3.2, -W - 0.3); scene.add(g1);
    for (const s of [-1, 1]) { const g2 = grillage(21, 4.5); g2.position.set(s * (L + 0.3), 3.2, 0); g2.rotation.y = Math.PI / 2; scene.add(g2); }
    const poteauM = lambert('#2c2c34');
    for (let x = -20; x <= 20; x += 5) scene.add(boite(0.12, 5.4, 0.12, poteauM, x, 2.7, -W - 0.3));
    for (const s of [-1, 1]) for (let z = -10; z <= 10; z += 5) scene.add(boite(0.12, 5.4, 0.12, poteauM, s * (L + 0.3), 2.7, z));
    for (let x = -20; x < 20; x += 5) guirlande(scene, new THREE.Vector3(x, 5.4, -W - 0.3), new THREE.Vector3(x + 5, 5.4, -W - 0.3), 8, R);
    for (const s of [-1, 1]) guirlande(scene, new THREE.Vector3(s * (L + 0.3), 5.4, -10), new THREE.Vector3(s * (L + 0.3), 5.4, 10), 18, R);
    ville(scene, R);
    // Un château d'eau, des climatiseurs, quelques curieux sur le rebord.
    const bois = lambert('#6a4a30');
    const chateau = new THREE.Group();
    chateau.add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.6, 10), bois));
    chateau.children[0].position.y = 7.5;
    const toitC = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.6, 10), lambert('#3a2a20'));
    toitC.position.y = 10.1;
    chateau.add(toitC);
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) chateau.add(boite(0.2, 5.8, 0.2, lambert('#2a2a2a'), x, 2.9, z));
    chateau.position.set(-27, 0, -18);
    scene.add(chateau);
    for (const [x, z] of [[24, -16], [28, -12], [-30, 12], [26, 18]]) scene.add(boite(2.4, 1.6, 2, lambert('#8a8a92'), x, 0.8, z));
    const places = [];
    for (let x = -30; x <= 30; x += 0.7) if (R() < 0.6) places.push({ x, y: 1.05, z: -24.6, ry: 0 });
    for (let z = -20; z <= 20; z += 0.7) if (R() < 0.5) places.push({ x: 34.6, y: 1.05, z, ry: -Math.PI / 2 }, { x: -34.6, y: 1.05, z, ry: Math.PI / 2 });
    out.foule = foule(scene, places, publicCouleurs, qualite);
    for (const [x, z] of [[-22, -14], [22, -14]]) pylone(scene, x, z, 12);
  } else if (id === 'halle') {
    scene.background = new THREE.Color('#1c1a18');
    hemi.color.set('#fff8ee'); hemi.groundColor.set('#6a5030'); hemi.intensity = 1.6;
    soleil.color.set('#ffffff'); soleil.intensity = 1.6; soleil.position.set(0, 30, 6);
    terrain(scene, 'parquet', qualite, equipes[0]);
    const tour = boite(70, 0.1, 50, lambert('#a87a48'), 0, -0.06, 0);
    tour.receiveShadow = true;
    scene.add(tour);
    bandes(scene, '#2a2a30');
    // Les murs : bas peint, haut clair, et une rangée de fenêtres.
    const murBas = lambert('#3d6fa8'), murHaut = lambert('#e6e0d2');
    scene.add(boite(66, 2.4, 0.4, murBas, 0, 1.2, -19), boite(66, 19.6, 0.4, murHaut, 0, 12.2, -19));
    for (const s of [-1, 1]) scene.add(boite(0.4, 2.4, 40, murBas, s * 31, 1.2, 0), boite(0.4, 19.6, 40, murHaut, s * 31, 12.2, 0));
    const vitre = basique('#9fd0ff');
    for (let x = -28; x <= 28; x += 4) scene.add(boite(2.8, 1.6, 0.1, vitre, x, 9.2, -18.75));
    // Le plafond, ses poutres et ses néons (assez haut pour ne pas gêner la caméra).
    for (let x = -30; x <= 30; x += 6) scene.add(boite(0.4, 0.6, 40, lambert('#5a5a60'), x, 22, 0));
    const neon = basique('#f4fbff');
    for (let x = -24; x <= 24; x += 8) for (const z of [-14, -6]) { scene.add(boite(3.2, 0.12, 0.25, neon, x, 21.4, z)); lueur(scene, x, 21.3, z, 5, '#e8f4ff'); }
    // Les paniers de basket au bout (c'est un gymnase).
    for (const s of [-1, 1]) {
      const pan = new THREE.Group();
      pan.add(boite(1.8, 1.1, 0.06, basique('#ffffff'), 0, 4.2, 0), boite(0.06, 4.6, 0.06, lambert('#333'), 0, 2.3, -0.4));
      const cercle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 16), lambert('#ff5a1a'));
      cercle.rotation.x = Math.PI / 2; cercle.position.set(0, 3.7, 0.3);
      pan.add(cercle);
      pan.position.set(s * 29, 0, 0); pan.rotation.y = -s * Math.PI / 2;
      scene.add(pan);
    }
    // Des gradins au fond, des banderoles aux couleurs des deux équipes.
    const bancs = lambert('#8a6038');
    const places = gradins(scene, bancs, { x0: -22, x1: 22, z0: -12.4, sens: -1, rangs: 6, base: 0.5, hauteur: 0.5 });
    out.foule = foule(scene, places, publicCouleurs, qualite);
    kits.forEach((k, i) => {
      const t = texCanvas(512, 96, (g, w, h) => { g.fillStyle = k.fond; g.fillRect(0, 0, w, h); g.fillStyle = k.motifC; g.fillRect(0, h - 18, w, 18); g.fillStyle = k.num; g.font = '900 52px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(equipes[i].court.toUpperCase(), w / 2, h / 2 - 6, w - 30); });
      const b = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshBasicMaterial({ map: t }));
      b.position.set(i ? 12 : -12, 6.4, -18.7);
      scene.add(b);
    });
  } else {
    // La plage.
    ciel(scene, '#4a2f7a', '#ff9a52', '#f7c78a');
    scene.fog = new THREE.Fog('#ffb27a', 80, 260);
    hemi.color.set('#ffd6b0'); hemi.groundColor.set('#d8b07a'); hemi.intensity = 1.35;
    soleil.color.set('#ffc890'); soleil.intensity = 2.6; soleil.position.set(-26, 14, -30);
    const sable = boite(160, 0.1, 50, lambert('#e8cc94'), 0, -0.06, 0);
    sable.receiveShadow = true;
    scene.add(sable);
    const mer = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), lambert('#2d6f9a', { emissive: '#3a2a50', emissiveIntensity: 0.25 }));
    mer.rotation.x = -Math.PI / 2; mer.position.set(0, -0.1, -170);
    scene.add(mer);
    // Le soleil couchant, et son reflet.
    const disque = new THREE.Mesh(new THREE.CircleGeometry(16, 32), basique('#ffd27a', { fog: false }));
    disque.position.set(-60, 12, -320);
    scene.add(disque);
    lueur(scene, -60, 12, -318, 110, '#ffb070');
    terrain(scene, 'plage', qualite, equipes[0]);
    bandes(scene, '#0e6f8a');
    for (let k = 0; k < 14; k++) palmier(scene, -34 + k * 5.3 + R() * 2, -15 - R() * 6, R);
    for (const x of [-30, 30]) for (const z of [-4, 6]) palmier(scene, x + R() * 2, z, R);
    // Des parasols, une chaise de maître-nageur.
    const toiles = ['#ff5a5a', '#ffd23f', '#3ac8ff', '#ffffff'];
    for (let k = 0; k < 8; k++) {
      const p = new THREE.Group();
      p.add(boite(0.06, 2.2, 0.06, lambert('#dddddd'), 0, 1.1, 0));
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.6, 8), lambert(toiles[k % 4]));
      t.position.y = 2.3;
      p.add(t);
      p.position.set(-28 + k * 8 + R() * 2, 0, 14 + R() * 6);
      scene.add(p);
    }
    const chaise = new THREE.Group();
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) chaise.add(boite(0.12, 2.6, 0.12, lambert('#f4f4f4'), x, 1.3, z));
    chaise.add(boite(1.5, 0.15, 1.5, lambert('#e04040'), 0, 2.6, 0), boite(1.5, 1.1, 0.1, lambert('#e04040'), 0, 3.2, -0.7));
    chaise.position.set(26, 0, -14);
    scene.add(chaise);
    const bois = lambert('#9a7448');
    const places = gradins(scene, bois, { x0: -18, x1: 18, z0: -12.3, sens: -1, rangs: 4, base: 0.45, hauteur: 0.42 });
    out.foule = foule(scene, places, publicCouleurs, qualite);
  }
  let t = 0;
  out.maj = (dt, excitation) => {
    t += dt;
    if (out.foule) { out.foule.uTemps.value = t; out.foule.uAmp.value = 0.04 + excitation * 0.32; }
    for (const b of out.buts) {
      b.gonfle *= Math.pow(0.02, dt);
      b.filet.scale.x = 1 + b.gonfle * 0.45;
    }
  };
  return out;
}

/** L'écran géant : un panneau lumineux où l'on écrit le score. */
function ecranGeant(scene, x, y, z, l, h) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round((512 * h) / l);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const cadre = boite(l + 0.4, h + 0.4, 0.3, lambert('#15171c'), x, y, z);
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(l, h), new THREE.MeshBasicMaterial({ map: t, fog: false }));
  ecran.position.set(x, y, z + 0.16);
  scene.add(cadre, ecran, boite(0.4, y, 0.4, lambert('#2a2d33'), x - l / 3, y / 2, z - 0.3), boite(0.4, y, 0.4, lambert('#2a2d33'), x + l / 3, y / 2, z - 0.3));
  return (lignes, couleur = '#ffd23f') => {
    const g = c.getContext('2d');
    g.fillStyle = '#050608'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = couleur;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lignes.length;
    lignes.forEach((txt, i) => {
      g.font = `900 ${i ? 34 : 54}px "Arial Black", Impact, sans-serif`;
      g.fillText(txt, c.width / 2, (c.height * (i + 0.6)) / (n + 0.2), c.width - 20);
    });
    // Une trame de points (c'est un écran à LED).
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let yy = 0; yy < c.height; yy += 4) g.fillRect(0, yy, c.width, 1);
    t.needsUpdate = true;
  };
}
