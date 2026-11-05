/**
 * REMPART — le monde en 3D : terrain en relief, décor, emplacements, Cœur
 * d'Ambre, portails, ciel ; et la mise en scène de la partie (tours,
 * Rouilleux, projectiles, effets) à partir de l'état du moteur.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';
import { TOURS, ALTITUDE } from '../../../shared/rempart/donnees.js';
import { makeRng } from '../../../shared/hasard.js';
import { creerTour, animerTour, creerEnnemi, animerEnnemi, libererEnnemi, piece, cyl, boite, octa, boule, cone, mat, lueur, OR, GLACE } from './modeles3d.js';
import { creerEffets } from './effets3d.js';
import { creerCamera } from './camera.js';

export const AMBIANCES = {
  printemps: {
    ciel: '#4f9cf0', horizon: '#ffe6c0', herbe: '#5d9c44', herbe2: '#8cbd52', chemin: '#cfae72', colline: '#6c8c48', roche: '#8b8378',
    eau: '#3fa9d6', fond: '#2d5a52', feuillage: ['#4f9a3a', '#6fb84a', '#3d8a3a', '#7cc44f'], fleurs: ['#ff7aa8', '#ffd84d', '#ffffff', '#b48aff'],
    soleil: '#fff1d6', intens: 2.5, hemi: 0.8, pins: 0.15, particules: 'pollen',
  },
  automne: {
    ciel: '#6fa2e0', horizon: '#ffd8a6', herbe: '#97963f', herbe2: '#c4983e', chemin: '#d6b27a', colline: '#a86a3c', roche: '#8a7a6c',
    eau: '#4a9ac0', fond: '#3a4a3a', feuillage: ['#e07a2a', '#c94a2a', '#f0b030', '#a83a2a', '#d89a3a'], fleurs: ['#ffcc55', '#ff8a3a', '#fff0c0'],
    soleil: '#ffd9a0', intens: 2.1, hemi: 0.7, pins: 0.1, particules: 'feuilles',
  },
  marais: {
    ciel: '#3d6b78', horizon: '#cfe0a8', herbe: '#4f7a3a', herbe2: '#6b8a3a', chemin: '#8c7a55', colline: '#4a6a3a', roche: '#6a6a5a',
    eau: '#2f6a5a', fond: '#1a2c22', feuillage: ['#3f6a2a', '#5a7a2a', '#2f5a3a', '#4a6a30'], fleurs: ['#c8ff5a', '#ffffff', '#ffe08a'],
    soleil: '#e8ffd0', intens: 1.7, hemi: 0.85, pins: 0.05, particules: 'lucioles', roseaux: true,
  },
  montagne: {
    ciel: '#4f95e8', horizon: '#e8f2ff', herbe: '#6d8f4e', herbe2: '#8aa65a', chemin: '#b8a07a', colline: '#7a8a6a', roche: '#8a8f96',
    eau: '#5ab0e0', fond: '#3a5a6a', feuillage: ['#2f5a3a', '#3a6a42', '#4a7a4a'], fleurs: ['#ffffff', '#a8c8ff'],
    soleil: '#ffffff', intens: 2.7, hemi: 0.8, pins: 0.85, particules: 'neige', neige: '#f4f8ff',
  },
  crepuscule: {
    ciel: '#2b2a5c', horizon: '#ff9a6a', herbe: '#4c7a52', herbe2: '#6a8a5a', chemin: '#b89a6a', colline: '#4a5a5a', roche: '#6a6a7a',
    eau: '#6a6ad0', fond: '#2a2a4a', feuillage: ['#3a6a5a', '#4a5a7a', '#2f5a4a', '#5a4a6a'], fleurs: ['#ffb0d0', '#c0a0ff', '#ffe0a0'],
    soleil: '#ffb080', intens: 1.7, hemi: 0.7, pins: 0.45, particules: 'lucioles', roseaux: true,
  },
  fosse: {
    ciel: '#2a1612', horizon: '#ff7a3a', herbe: '#5a4a3a', herbe2: '#6e5440', chemin: '#7a5a40', colline: '#4a3a32', roche: '#3a3230',
    eau: '#ff6a1a', fond: '#401a0a', feuillage: ['#4a3a28', '#5a4030'], fleurs: ['#ff8a3a'],
    soleil: '#ffa070', intens: 2.4, hemi: 0.85, pins: 0, particules: 'braises', mort: true,
  },
};

const MARGE = 10, SEG = 3;
const COUT_MIN = Math.min(...Object.values(TOURS).map(t => t.niveaux[0].cout));

/* ----------------------------------------------------------------- bruit */
function hash(x, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function bruit(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const lisse = f => { const u = Math.max(0, Math.min(1, (f - 0.18) / 0.64)); return u * u * (3 - 2 * u); };

/* ------------------------------------------------------------- le monde */

export function creerMonde(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  let surTap = () => {};
  const cam = creerCamera(camera, canvas, { surTap: (x, y, e) => surTap(x, y, e) });
  const effets = creerEffets(scene);

  const hemi = new THREE.HemisphereLight('#bfe3ff', '#5a4a30', 0.8);
  scene.add(hemi);
  const soleil = new THREE.DirectionalLight('#fff1d6', 2.5);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(soleil.shadow.camera, { left: -17, right: 17, top: 13, bottom: -13, near: 1, far: 80 });
  soleil.shadow.bias = -0.0005;
  soleil.shadow.normalBias = 0.02;
  scene.add(soleil, soleil.target);

  // Le ciel : un dôme en dégradé.
  const ciel = new THREE.Mesh(new THREE.SphereGeometry(220, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { haut: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 haut; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, haut, pow(smoothstep(0.0, 0.55, h), 0.7)), 1.0); }',
  }));
  ciel.renderOrder = -1;
  scene.add(ciel);

  let niveau = null;          // groupe du lieu chargé
  let jetables = [];          // géométries et matériaux du lieu, à libérer au changement
  let carte = null, amb = AMBIANCES.printemps;
  let hauteur = () => 0;
  let socles = [], capteurs = [], base = null, portails = [], eau = null, nuages = [], feuillages = [];
  const vuesTours = new Map(), vuesEnnemis = new Map(), vuesProj = new Map();
  const reserveProj = {};
  let temps = 0;
  const uTemps = { value: 0 };

  const garder = o => { jetables.push(o); return o; };

  /* ---------------------------------------------------------- terrain */
  function construireTerrain(def) {
    const W = carte.W, H = carte.H;
    const tranchee = new Set();
    for (const ch of carte.chemins) {
      // Le premier point est hors carte, 1,5 case derrière la case de départ.
      const a = ch.points[0], b = ch.points[1];
      const dc = Math.sign(Math.round(a.x - b.x)), dr = Math.sign(Math.round(a.z - b.z));
      const c0 = Math.floor(a.x - dc * 1.5), r0 = Math.floor(a.z - dr * 1.5);
      for (let k = 1; k <= MARGE; k++) tranchee.add(`${c0 + dc * k},${r0 + dr * k}`);
    }
    const C = (h) => new THREE.Color(h);
    const pal = { herbe: C(amb.herbe), herbe2: C(amb.herbe2), chemin: C(amb.chemin), colline: C(amb.colline), roche: C(amb.roche), fond: C(amb.fond), neige: C(amb.neige || '#fff') };
    const cache = new Map();
    function cellule(c, r) {
      const k = c * 1000 + r;
      if (cache.has(k)) return cache.get(k);
      let ch, d = 0;
      if (c >= 0 && c < W && r >= 0 && r < H) ch = def.carte[r][c];
      else {
        const cc = Math.max(0, Math.min(W - 1, c)), rr = Math.max(0, Math.min(H - 1, r));
        d = Math.max(Math.abs(c - cc), Math.abs(r - rr));
        const bord = def.carte[rr][cc];
        ch = tranchee.has(`${c},${r}`) ? '#' : bord === '~' && d <= 3 ? '~' : 'X';
      }
      const n = bruit(c * 0.37 + 11, r * 0.37 + 5);
      let h, col, amp;
      const couleur = new THREE.Color();
      switch (ch) {
        case '#': case 'S': case 'R': case 'B':
          h = 0; amp = 0.01; couleur.copy(pal.chemin).offsetHSL(0, 0, (n - 0.5) * 0.08); break;
        case '~':
          h = -0.7; amp = 0.05; couleur.copy(pal.fond); break;
        case '^':
          h = 1.0 + n * 0.9; amp = 0.35; couleur.copy(pal.colline).lerp(pal.roche, n * 0.7); break;
        case 'X': {
          h = 0.45 + d * 0.32 + n * (0.3 + d * 0.22) + (d > 4 ? (d - 4) * 0.45 : 0);
          amp = 0.4;
          couleur.copy(pal.colline).lerp(pal.roche, Math.min(1, n * 0.5 + d * 0.06));
          if (amb.neige && h > 3.2) couleur.lerp(pal.neige, Math.min(1, (h - 3.2) * 0.8));
          break;
        }
        default:
          h = 0.3; amp = 0.05; couleur.copy(pal.herbe).lerp(pal.herbe2, n);
      }
      col = couleur;
      const v = { h, col, amp, ch };
      cache.set(k, v);
      return v;
    }
    hauteur = (x, z) => {
      const u = x - 0.5, v = z - 0.5;
      const c0 = Math.floor(u), r0 = Math.floor(v);
      const fx = lisse(u - c0), fz = lisse(v - r0);
      const a = cellule(c0, r0), b = cellule(c0 + 1, r0), c = cellule(c0, r0 + 1), d = cellule(c0 + 1, r0 + 1);
      const mix = (k) => (a[k] * (1 - fx) + b[k] * fx) * (1 - fz) + (c[k] * (1 - fx) + d[k] * fx) * fz;
      return mix('h') + mix('amp') * (bruit(x * 1.7, z * 1.7) - 0.5) * 2;
    };
    const larg = W + 2 * MARGE, prof = H + 2 * MARGE;
    const g = garder(new THREE.PlaneGeometry(larg, prof, larg * SEG, prof * SEG));
    g.rotateX(-Math.PI / 2);
    g.translate(W / 2, 0, H / 2);
    const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, hauteur(x, z));
      const u = x - 0.5, v = z - 0.5, c0 = Math.floor(u), r0 = Math.floor(v);
      const fx = lisse(u - c0), fz = lisse(v - r0);
      const a = cellule(c0, r0).col, b = cellule(c0 + 1, r0).col, c = cellule(c0, r0 + 1).col, d = cellule(c0 + 1, r0 + 1).col;
      tmp.copy(a).lerp(b, fx);
      const t2 = c.clone().lerp(d, fx);
      tmp.lerp(t2, fz).offsetHSL(0, 0, (hash(Math.round(x * 3), Math.round(z * 3)) - 0.5) * 0.035);
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const sol = new THREE.Mesh(g, garder(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })));
    sol.receiveShadow = true;
    niveau.add(sol);

    // L'eau (ou la lave, dans la Fosse).
    const lave = amb === AMBIANCES.fosse;
    const ge = garder(new THREE.PlaneGeometry(larg, prof, 48, 36));
    ge.rotateX(-Math.PI / 2);
    ge.translate(W / 2, -0.22, H / 2);
    eau = new THREE.Mesh(ge, garder(new THREE.MeshStandardMaterial({
      color: amb.eau, transparent: true, opacity: lave ? 0.95 : 0.78, roughness: 0.08, metalness: 0.25, flatShading: true,
      emissive: lave ? amb.eau : '#000', emissiveIntensity: lave ? 0.9 : 0,
    })));
    eau.userData.base = Float32Array.from(ge.attributes.position.array);
    eau.receiveShadow = true;
    niveau.add(eau);
    return cellule;
  }

  /* ------------------------------------------------------------ décor */
  function construireDecor(def, cellule) {
    const W = carte.W, H = carte.H;
    const rng = makeRng(def.id * 977 + 13);
    const arbres = [], pins = [], troncs = [], rochers = [], touffes = [], fleurs = [], roseaux = [];
    const pose = (liste, x, z, s, ry = rng() * 6, extra = {}) => liste.push({ x, z, y: hauteur(x, z), s, ry, ...extra });
    const arbre = (x, z, s) => {
      const pin = rng() < amb.pins;
      if (amb.mort && rng() < 0.7) { pose(troncs, x, z, s * 1.3, undefined, { mort: true }); return; }
      pose(troncs, x, z, s);
      pose(pin ? pins : arbres, x, z, s, undefined, { c: amb.feuillage[Math.floor(rng() * amb.feuillage.length)] });
    };
    for (let r = -MARGE; r < H + MARGE; r++) for (let c = -MARGE; c < W + MARGE; c++) {
      const cel = cellule(c, r), x = c + 0.5, z = r + 0.5;
      const j = () => (rng() - 0.5) * 0.6;
      if (cel.ch === '*') { arbre(x + j() - 0.15, z + j(), 0.9 + rng() * 0.4); if (rng() < 0.7) arbre(x + j() + 0.2, z + j(), 0.7 + rng() * 0.3); }
      else if (cel.ch === 'o') { for (let i = 0; i < 2 + rng() * 2; i++) pose(rochers, x + j(), z + j(), 0.5 + rng() * 0.7); }
      else if (cel.ch === '^') { if (rng() < 0.5) arbre(x + j(), z + j(), 0.8 + rng() * 0.4); if (rng() < 0.4) pose(rochers, x + j(), z + j(), 0.6 + rng() * 0.8); }
      else if (cel.ch === 'X') {
        const d = Math.max(-c - 1, c - W, -r - 1, r - H, 0);
        if (d >= 2 && d < 9 && rng() < 0.12 + d * 0.05) arbre(x + j(), z + j(), 0.6 + rng() * 0.4 + d * 0.06);
        else if (d < 2 && rng() < 0.25) pose(touffes, x + j(), z + j(), 1);
        if (rng() < 0.12) pose(rochers, x + j(), z + j(), 0.8 + rng() * 1.4);
      } else if (cel.ch === '.' || cel.ch === 'T') {
        if (cel.ch === '.' && rng() < 0.06) pose(rochers, x + j(), z + j(), 0.25 + rng() * 0.25);
        const n = cel.ch === 'T' ? 1 : 3;
        for (let i = 0; i < n; i++) if (rng() < 0.55) {
          const tx = x + (rng() - 0.5) * 0.9, tz = z + (rng() - 0.5) * 0.9;
          if (cel.ch === 'T' && Math.hypot(tx - x, tz - z) < 0.5) continue;
          pose(touffes, tx, tz, 0.7 + rng() * 0.6);
        }
        if (cel.ch === '.' && rng() < 0.3) for (let i = 0; i < 3; i++) pose(fleurs, x + j(), z + j(), 1, 0, { c: amb.fleurs[Math.floor(rng() * amb.fleurs.length)] });
      } else if (cel.ch === '~' && amb.roseaux) {
        // Roseaux au bord de l'eau.
        const voisins = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => cellule(c + a, r + b).ch !== '~');
        if (voisins) for (let i = 0; i < 3; i++) pose(roseaux, x + j(), z + j(), 0.8 + rng() * 0.6);
      }
    }
    const instances = (geometrie, materiau, liste, regler) => {
      if (!liste.length) return null;
      const im = new THREE.InstancedMesh(geometrie, materiau, liste.length);
      const o = new THREE.Object3D(), c = new THREE.Color();
      liste.forEach((it, i) => {
        o.position.set(it.x, it.y, it.z);
        o.rotation.set(0, it.ry, 0);
        o.scale.setScalar(it.s);
        regler?.(o, it);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        if (it.c) im.setColorAt(i, c.set(it.c));
      });
      im.castShadow = true;
      im.receiveShadow = true;
      niveau.add(im);
      return im;
    };
    const vent = m => {
      m.onBeforeCompile = sh => {
        sh.uniforms.uTemps = uTemps;
        sh.vertexShader = 'uniform float uTemps;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n#ifdef USE_INSTANCING\n float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.53;\n transformed.x += sin(uTemps * 1.6 + ph) * 0.05 * (position.y + 0.3);\n transformed.z += cos(uTemps * 1.3 + ph) * 0.04 * (position.y + 0.3);\n#endif');
      };
      return m;
    };
    const gTronc = garder(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 5)); gTronc.translate(0, 0.3, 0);
    const gFeuille = garder(new THREE.IcosahedronGeometry(0.36, 0)); gFeuille.scale(1, amb === AMBIANCES.marais ? 0.75 : 1, 1); gFeuille.translate(0, 0.78, 0);
    const gPin = garder(new THREE.ConeGeometry(0.34, 0.95, 6)); gPin.translate(0, 0.85, 0);
    const gRoche = garder(new THREE.DodecahedronGeometry(0.22, 0)); gRoche.scale(1, 0.65, 1);
    const gTouffe = garder(new THREE.ConeGeometry(0.05, 0.2, 3)); gTouffe.translate(0, 0.08, 0);
    const gFleur = garder(new THREE.IcosahedronGeometry(0.04, 0)); gFleur.translate(0, 0.1, 0);
    const gRoseau = garder(new THREE.CylinderGeometry(0.012, 0.02, 0.7, 3)); gRoseau.translate(0, 0.1, 0);
    const mTronc = garder(new THREE.MeshStandardMaterial({ color: amb.mort ? '#3a2a20' : '#6b4a2e', flatShading: true, roughness: 0.9 }));
    const mFeuille = garder(vent(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 })));
    const mRoche = garder(new THREE.MeshStandardMaterial({ color: amb.roche, flatShading: true, roughness: 0.9 }));
    const mTouffe = garder(vent(new THREE.MeshStandardMaterial({ color: new THREE.Color(amb.herbe2).offsetHSL(0, 0.05, -0.08), flatShading: true })));
    const mFleur = garder(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6 }));
    const mRoseau = garder(vent(new THREE.MeshStandardMaterial({ color: '#8a9a4a', flatShading: true })));
    instances(gTronc, mTronc, troncs, (o, it) => { if (it.mort) { o.scale.set(it.s, it.s * 1.8, it.s); o.rotation.z = (hash(it.x * 10, it.z * 10) - 0.5) * 0.4; } });
    feuillages = [instances(gFeuille, mFeuille, arbres), instances(gPin, mFeuille, pins, (o, it) => o.scale.set(it.s, it.s * 1.25, it.s))];
    instances(gRoche, mRoche, rochers, (o, it) => o.rotation.set(it.ry, it.ry * 2, 0));
    const t = instances(gTouffe, mTouffe, touffes);
    if (t) t.castShadow = false;
    const f = instances(gFleur, mFleur, fleurs);
    if (f) f.castShadow = false;
    instances(gRoseau, mRoseau, roseaux);

    // Quelques nuages qui passent.
    nuages = [];
    const mNuage = garder(new THREE.MeshStandardMaterial({ color: amb === AMBIANCES.fosse ? '#5a3a30' : '#ffffff', flatShading: true, emissive: amb.horizon, emissiveIntensity: 0.15, transparent: true, opacity: 0.92 }));
    const gNuage = garder(new THREE.IcosahedronGeometry(1, 0));
    for (let i = 0; i < 9; i++) {
      const n = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(gNuage, mNuage);
        b.position.set((k - 1.5) * 1.3 + rng(), rng() * 0.5, rng() - 0.5);
        b.scale.set(1.2 + rng(), 0.7 + rng() * 0.4, 1 + rng() * 0.5);
        n.add(b);
      }
      n.position.set(-30 + rng() * 80, 13 + rng() * 6, -25 + rng() * 60);
      n.userData.v = 0.3 + rng() * 0.4;
      niveau.add(n);
      nuages.push(n);
    }
  }

  /* ---------------------------------------------- emplacements, Cœur, portails */
  function construireLieux() {
    socles = []; capteurs = [];
    const gSocle = garder(new THREE.CylinderGeometry(0.44, 0.5, 0.16, 6));
    const mSocle = garder(new THREE.MeshStandardMaterial({ color: '#9a958c', flatShading: true, roughness: 0.85 }));
    const gRune = garder(new THREE.RingGeometry(0.29, 0.36, 6)); gRune.rotateX(-Math.PI / 2);
    const gCapteur = garder(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 8));
    const mCapteur = garder(new THREE.MeshBasicMaterial({ visible: false }));
    for (const emp of carte.emplacements) {
      const y = hauteur(emp.x, emp.z);
      const s = new THREE.Mesh(gSocle, mSocle);
      s.position.set(emp.x, y + 0.04, emp.z);
      s.rotation.y = Math.PI / 6;
      s.receiveShadow = true; s.castShadow = true;
      const rune = new THREE.Mesh(gRune, garder(new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.4, depthWrite: false })));
      rune.position.y = 0.085;
      s.add(rune);
      niveau.add(s);
      const cap = new THREE.Mesh(gCapteur, mCapteur);
      cap.position.set(emp.x, y + 0.9, emp.z);
      cap.userData.emp = emp.id;
      niveau.add(cap);
      capteurs.push(cap);
      socles.push({ s, rune, y: y + 0.12, emp });
    }

    // Le Cœur d'Ambre, sur son autel.
    const b = carte.base;
    base = new THREE.Group();
    base.position.set(b.x, 0, b.z);
    const pierre = mat('autel', { color: '#b8b0a0' });
    piece(cyl(0.62, 0.72, 0.22, 10), pierre, 0, 0.11, 0, base);
    piece(cyl(0.48, 0.55, 0.16, 10), mat('autel2', { color: '#d8d0bf' }), 0, 0.3, 0, base);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      piece(boite(0.12, 0.7, 0.12), pierre, Math.cos(a) * 0.62, 0.45, Math.sin(a) * 0.62, base);
      piece(octa(0.07), lueur('#ffb347', 1.6), Math.cos(a) * 0.62, 0.86, Math.sin(a) * 0.62, base);
    }
    const ambre = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8a1a', emissiveIntensity: 1.2, transparent: true, opacity: 0.92, roughness: 0.15, flatShading: true });
    garder(ambre);
    const cristal = piece(octa(0.36), ambre, 0, 1.15, 0, base);
    cristal.scale.y = 1.6;
    const eclats = new THREE.Group();
    eclats.position.y = 1.15;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      piece(octa(0.09), ambre, Math.cos(a) * 0.6, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.6, eclats).scale.y = 1.6;
    }
    base.add(eclats);
    const lumiere = new THREE.PointLight('#ffaa44', 4, 7, 1.5);
    lumiere.position.y = 1.3;
    base.add(lumiere);
    base.userData = { cristal, eclats, lumiere, ambre, rouge: 0 };
    niveau.add(base);

    // Les portails d'où sortent les Rouilleux.
    portails = carte.chemins.map(ch => {
      const a = ch.points[0], b2 = ch.points[1];
      const g = new THREE.Group();
      g.position.set(a.x + (b2.x - a.x) * 0.15, 0, a.z + (b2.z - a.z) * 0.15);
      g.rotation.y = Math.atan2(b2.x - a.x, b2.z - a.z);
      const roc = mat('portail', { color: '#4a403a' });
      for (const s of [-1, 1]) {
        piece(boite(0.32, 1.9, 0.4), roc, s * 0.85, 0.95, 0, g).rotation.z = s * 0.06;
        piece(cone(0.12, 0.3, 4), lueur('#ff6a3a', 1.5), s * 0.85, 2.05, 0, g);
      }
      piece(boite(2.1, 0.3, 0.45), roc, 0, 1.95, 0, g);
      const disque = new THREE.Mesh(garder(new THREE.CircleGeometry(0.72, 32)), garder(new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
        uniforms: { t: uTemps },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float t; varying vec2 vU; void main(){ float r = length(vU) * 2.0; float a = atan(vU.y, vU.x); float s = sin(a * 3.0 + r * 9.0 - t * 4.0) * 0.5 + 0.5; vec3 c = mix(vec3(0.35, 0.05, 0.25), vec3(1.0, 0.45, 0.15), s * (1.0 - r)); gl_FragColor = vec4(c, (1.0 - r * r) * 0.95); }',
      })));
      disque.scale.y = 1.25;
      disque.position.y = 0.95;
      g.add(disque);
      niveau.add(g);
      return { g, x: g.position.x, z: g.position.z };
    });
  }

  /* --------------------------------------------- sélection et portée */
  const selection = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffe08a' }));
  selection.rotation.x = -Math.PI / 2;
  selection.visible = false;
  scene.add(selection);
  const portee = new THREE.Group();
  const disque = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.13, depthWrite: false }));
  const bord = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 64), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false }));
  for (const m of [disque, bord]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 2; portee.add(m); }
  portee.visible = false;
  scene.add(portee);

  function montrerPortee(x, z, r, couleur) {
    portee.visible = true;
    portee.position.set(x, 0.34, z);
    portee.scale.set(r, 1, r);
    disque.material.color.set(couleur);
    bord.material.color.set(couleur);
  }

  function selectionner(empId, rayon = null, couleur = '#ffe08a') {
    if (empId == null) { selection.visible = false; portee.visible = false; return; }
    const s = socles[empId];
    selection.visible = true;
    selection.position.set(s.emp.x, s.y + 0.02, s.emp.z);
    if (rayon) montrerPortee(s.emp.x, s.emp.z, rayon, couleur);
    else portee.visible = false;
  }

  /* ------------------------------------------------------- chargement */
  function vider() {
    for (const v of vuesTours.values()) niveau.remove(v.m.groupe);
    for (const v of vuesEnnemis.values()) { niveau.remove(v.m.groupe); libererEnnemi(v.m); }
    for (const v of vuesProj.values()) rendreProj(v);
    vuesTours.clear(); vuesEnnemis.clear(); vuesProj.clear();
    effets.vider();
    if (niveau) scene.remove(niveau);
    for (const j of jetables) j.dispose?.();
    jetables = [];
  }

  function charger(p) {
    vider();
    carte = p.carte;
    amb = AMBIANCES[p.def.ambiance] || AMBIANCES.printemps;
    niveau = new THREE.Group();
    scene.add(niveau);
    const cellule = construireTerrain(p.def);
    construireDecor(p.def, cellule);
    construireLieux();
    ciel.material.uniforms.haut.value.set(amb.ciel);
    ciel.material.uniforms.horizon.value.set(amb.horizon);
    scene.fog = new THREE.Fog(amb.horizon, 45, 120);
    hemi.color.set(amb.ciel).lerp(new THREE.Color('#ffffff'), 0.5);
    hemi.groundColor.set(amb.herbe).multiplyScalar(0.6);
    hemi.intensity = amb.hemi;
    soleil.color.set(amb.soleil);
    soleil.intensity = amb.intens;
    const cx = carte.W / 2, cz = carte.H / 2;
    soleil.position.set(cx - 14, 26, cz + 10);
    soleil.target.position.set(cx, 0, cz);
    selectionner(null);
    redimensionner(true);
  }

  /* --------------------------------------------------------- entités */
  const FOND_BARRE = new THREE.MeshBasicMaterial({ color: '#1a1010', depthTest: false, transparent: true, opacity: 0.8 });
  const BARRES = ['#ff4a3a', '#ffc23a', '#5ade5a'].map(c => new THREE.MeshBasicMaterial({ color: c, depthTest: false }));
  const gBarre = new THREE.PlaneGeometry(1, 1);

  function creerBarre(largeur) {
    const g = new THREE.Group();
    const fond = new THREE.Mesh(gBarre, FOND_BARRE);
    fond.scale.set(largeur + 0.04, 0.09, 1);
    const plein = new THREE.Mesh(gBarre, BARRES[2]);
    plein.scale.set(largeur, 0.06, 1);
    plein.position.z = 0.001;
    fond.renderOrder = 10; plein.renderOrder = 11;
    g.add(fond, plein);
    g.userData = { plein, largeur };
    g.visible = false;
    return g;
  }

  const GEO_PROJ = {
    balle: () => new THREE.Mesh(boule(0.055, 6, 5), lueur('#ffb347', 2.2)),
    obus: () => new THREE.Mesh(boule(0.1, 8, 6), mat('obus', { color: '#2a2622', metalness: 0.5 })),
    eclat: () => new THREE.Mesh(octa(0.09), GLACE),
    trait: () => new THREE.Mesh(boite(0.035, 0.035, 0.42), lueur('#d9a8ff', 2)),
  };
  function prendreProj(k) {
    const r = (reserveProj[k] ??= []);
    const m = r.pop() || GEO_PROJ[k]();
    m.visible = true;
    m.userData.k = k;
    scene.add(m);
    return m;
  }
  function rendreProj(m) {
    scene.remove(m);
    (reserveProj[m.userData.k] ??= []).push(m);
  }

  const lerp = (a, b, u) => a + (b - a) * u;

  function synchroniser(p, alpha, dt, demo) {
    // Tours
    const vues = new Set();
    for (const t of p.tours) {
      vues.add(t.id);
      let v = vuesTours.get(t.id);
      if (!v || v.niveau !== t.niveau) {
        const ancien = v;
        const m = creerTour(t.type, t.niveau, TOURS[t.type].couleur);
        const s = socles[t.emp];
        m.groupe.position.set(t.x, s.y, t.z);
        if (ancien) { niveau.remove(ancien.m.groupe); m.apparition = 0.55; m.tete.rotation.y = ancien.m.tete.rotation.y; }
        niveau.add(m.groupe);
        v = { m, niveau: t.niveau };
        vuesTours.set(t.id, v);
      }
      animerTour(v.m, temps, dt, t.cible != null ? t.angle : null);
    }
    for (const [id, v] of vuesTours) if (!vues.has(id)) { niveau.remove(v.m.groupe); vuesTours.delete(id); }

    // Rouilleux
    vues.clear();
    let boss = null;
    for (const e of p.ennemis) {
      vues.add(e.id);
      let v = vuesEnnemis.get(e.id);
      if (!v) {
        const m = creerEnnemi(e.type, e.def.taille);
        const barre = creerBarre(e.def.boss ? 1.2 : 0.5);
        barre.position.y = m.haut + 0.15;
        m.groupe.add(barre);
        m.groupe.rotation.y = e.angle;
        niveau.add(m.groupe);
        v = { m, barre, pv: e.pv };
        vuesEnnemis.set(e.id, v);
      }
      const x = lerp(e.px, e.x, alpha), z = lerp(e.pz, e.z, alpha);
      const y = e.def.vole ? ALTITUDE : 0; // le chemin est au niveau 0
      v.m.groupe.position.set(x, y, z);
      let d = e.angle - v.m.groupe.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      v.m.groupe.rotation.y += d * Math.min(1, dt * 10);
      if (e.pv < v.pv - 0.01) v.m.flash = 1;
      v.pv = e.pv;
      const frein = e.ralenti * (1 - (e.def.resisteRalenti || 0));
      animerEnnemi(v.m, temps, dt, { vitesse: (1 - frein) * (e.def.vitesse / 1.5), ralenti: e.ralentiT > 0 ? e.ralenti : 0 });
      const r = e.pv / e.pvMax;
      v.barre.visible = r < 0.999 && !demo;
      if (v.barre.visible) {
        const { plein, largeur } = v.barre.userData;
        plein.scale.x = Math.max(0.001, largeur * r);
        plein.position.x = -largeur * (1 - r) / 2;
        plein.material = BARRES[r > 0.6 ? 2 : r > 0.3 ? 1 : 0];
        v.barre.quaternion.copy(v.m.groupe.quaternion).invert().multiply(camera.quaternion);
      }
      // Traînées : fumée du Broyeur, givre sur les ralentis.
      if (e.type === 'broyeur' && Math.random() < dt * 14) {
        const c = v.m.anim.cheminee.getWorldPosition(new THREE.Vector3());
        effets.gerbe(c.x, c.y + 0.3, c.z, { n: 1, couleurs: ['#3a3430'], vitesse: 0.3, haut: 2, vie: 1.6, taille: 0.45, croit: 2.5, additif: false, alpha: 0.6, frein: 0.6 });
      }
      if (e.ralentiT > 0 && Math.random() < dt * 8) effets.gerbe(x, y + 0.3, z, { n: 1, couleurs: ['#bff0ff'], vitesse: 0.4, vie: 0.5, taille: 0.08, grav: -0.5 });
      if (e.def.boss && (!boss || e.pv > boss.pv)) boss = e;
    }
    for (const [id, v] of vuesEnnemis) if (!vues.has(id)) { niveau.remove(v.m.groupe); libererEnnemi(v.m); vuesEnnemis.delete(id); }

    // Projectiles
    vues.clear();
    for (const pr of p.projectiles) {
      vues.add(pr.id);
      let m = vuesProj.get(pr.id);
      if (!m) { m = prendreProj(pr.k); vuesProj.set(pr.id, m); }
      const x = lerp(pr.px, pr.x, alpha), y = lerp(pr.py, pr.y, alpha), z = lerp(pr.pz, pr.z, alpha);
      if (pr.k === 'trait') m.lookAt(x + (pr.x - pr.px), y + (pr.y - pr.py), z + (pr.z - pr.pz));
      if (pr.k === 'eclat') m.rotation.y += dt * 12;
      m.position.set(x, y, z);
      if (pr.k === 'obus') effets.gerbe(x, y, z, { n: 1, couleurs: ['#ff9a3a', '#ffd23f'], vitesse: 0.2, vie: 0.3, taille: 0.14 });
      else if (pr.k === 'eclat') effets.gerbe(x, y, z, { n: 1, couleurs: ['#9fe8ff'], vitesse: 0.1, vie: 0.25, taille: 0.08 });
      else if (pr.k === 'trait') effets.gerbe(x, y, z, { n: 1, couleurs: ['#b06cff'], vitesse: 0.1, vie: 0.2, taille: 0.1 });
    }
    for (const [id, m] of vuesProj) if (!vues.has(id)) { rendreProj(m); vuesProj.delete(id); }

    // Emplacements : la rune luit quand on a de quoi construire.
    const libres = new Set(p.tours.map(t => t.emp));
    const assez = p.or >= COUT_MIN && !demo;
    for (const s of socles) {
      const occupe = libres.has(s.emp.id);
      s.rune.visible = !occupe;
      s.rune.material.opacity = assez ? 0.45 + Math.sin(temps * 3 + s.emp.id) * 0.25 : 0.14;
    }
    // Le Cœur : il tourne, il bat, il rougit quand on le touche.
    const u = base.userData;
    u.cristal.rotation.y += dt * 0.8;
    u.cristal.position.y = 1.15 + Math.sin(temps * 1.6) * 0.08;
    u.eclats.rotation.y -= dt * 1.4;
    u.rouge = Math.max(0, u.rouge - dt * 1.5);
    const vie = p.vies / p.viesMax;
    u.ambre.emissive.setRGB(1, 0.54 * (1 - u.rouge), 0.1 * (1 - u.rouge));
    u.ambre.emissiveIntensity = 0.5 + vie * 0.8 + u.rouge * 1.5 + Math.sin(temps * 3) * 0.1;
    u.lumiere.intensity = 1.5 + vie * 3 + u.rouge * 5;
    u.lumiere.color.setRGB(1, 0.66 * (1 - u.rouge * 0.7), 0.27 * (1 - u.rouge));
    return boss;
  }

  /* ---------------------------------------------------------- événements */
  const MUSEAU = { rafale: ['#ffd23f', '#ff9a3c'], mortier: ['#ffb347', '#ff6a2a'], givre: ['#bff0ff', '#6fd8ff'], perce: ['#e0c0ff', '#b06cff'], foudre: ['#fff6a8', '#ffe14d'] };

  function evenements(evts, p) {
    for (const e of evts) {
      switch (e.k) {
        case 'tir': {
          const v = vuesTours.get(e.tour);
          if (!v) break;
          v.m.recul = 1;
          const t = p.tours.find(x => x.id === e.tour);
          if (!t) break;
          const a = v.m.tete.rotation.y, h = v.m.hauteur + 0.2;
          const fx = t.x + Math.sin(a) * 0.45, fz = t.z + Math.cos(a) * 0.45;
          const y0 = v.m.groupe.position.y;
          if (e.type === 'mortier') {
            effets.gerbe(t.x + Math.sin(a) * 0.3, y0 + h + 0.35, t.z + Math.cos(a) * 0.3, { n: 6, couleurs: ['#8a8078', '#5a5450'], vitesse: 0.6, haut: 1.5, vie: 0.9, taille: 0.3, croit: 2.2, additif: false, alpha: 0.7 });
            effets.gerbe(t.x, y0 + h + 0.3, t.z, { n: 6, couleurs: MUSEAU.mortier, vitesse: 1.4, vie: 0.25, taille: 0.16 });
          } else if (e.type !== 'givre' && e.type !== 'foudre') {
            effets.gerbe(fx, y0 + h, fz, { n: 3, couleurs: MUSEAU[e.type], vitesse: 1.2, vie: 0.14, taille: 0.14 });
          } else if (e.type === 'givre') {
            effets.gerbe(t.x, y0 + h + 0.45, t.z, { n: 5, couleurs: MUSEAU.givre, vitesse: 1, vie: 0.35, taille: 0.1 });
          }
          break;
        }
        case 'explosion':
          effets.gerbe(e.x, 0.2, e.z, { n: 26, couleurs: ['#fff2a8', '#ffb347', '#ff6a2a', '#ff3a1a'], vitesse: 3.2 * e.rayon, haut: 1.4, vie: 0.5, taille: 0.3, frein: 0.05, croit: 0.3 });
          effets.gerbe(e.x, 0.3, e.z, { n: 10, couleurs: ['#6a625a', '#4a4440', '#8a8078'], vitesse: 1.2, haut: 1.2, vie: 1.3, taille: 0.45, croit: 2.2, additif: false, alpha: 0.75, frein: 0.4 });
          effets.gerbe(e.x, 0.2, e.z, { n: 8, couleurs: ['#5a4030', '#3a2a20'], vitesse: 3, haut: 2, vie: 1, taille: 0.09, grav: 9, frein: 0.6, additif: false, sol: true });
          effets.onde(e.x, 0.08, e.z, { couleur: '#ffb347', r1: e.rayon * 1.15, vie: 0.35 });
          effets.trace(e.x, e.z, e.rayon * 0.55);
          effets.lueur(e.x, 0.8, e.z, '#ff8a3a', 7, 0.3);
          cam.secouer(0.04);
          break;
        case 'gel':
          effets.gerbe(e.x, e.y + 0.3, e.z, { n: e.zone ? 18 : 8, couleurs: ['#ffffff', '#bff0ff', '#6fd8ff'], vitesse: e.zone ? 2.4 : 1.4, vie: 0.45, taille: 0.11 });
          if (e.zone) effets.onde(e.x, (e.y || 0) + 0.1, e.z, { couleur: '#7fe0ff', r1: e.zone, vie: 0.4 });
          break;
        case 'impact':
          if (e.p === 'trait') effets.gerbe(e.x, e.y, e.z, { n: 10, couleurs: ['#e0c0ff', '#b06cff', '#ffffff'], vitesse: 2.2, vie: 0.3, taille: 0.12 });
          else effets.gerbe(e.x, e.y, e.z, { n: 3, couleurs: e.blinde ? ['#ffffff', '#c8d8ff'] : ['#ffd23f', '#ff9a3c'], vitesse: 1.6, vie: 0.18, taille: 0.08 });
          break;
        case 'rate':
          effets.gerbe(e.x, e.y, e.z, { n: 2, couleurs: ['#a09080'], vitesse: 0.5, vie: 0.3, taille: 0.1, additif: false, alpha: 0.5 });
          break;
        case 'eclair':
          effets.eclair(e.pts);
          effets.lueur(e.pts[1].x, e.pts[1].y, e.pts[1].z, '#ffe14d', 5, 0.2);
          break;
        case 'mort': {
          const gros = e.boss;
          const y = e.y || 0.3;
          effets.gerbe(e.x, y + 0.25, e.z, { n: gros ? 40 : 10, couleurs: ['#a0522d', '#6e3b1f', '#5a5a5a', '#c0703a'], vitesse: gros ? 4.5 : 2.6, haut: 2, vie: gros ? 1.6 : 0.9, taille: gros ? 0.16 : 0.09, grav: 9, frein: 0.7, additif: false, sol: true });
          effets.gerbe(e.x, y + 0.3, e.z, { n: gros ? 40 : 8, couleurs: ['#fff2a8', '#ffb347', '#ff6a2a'], vitesse: gros ? 4 : 2, vie: gros ? 0.8 : 0.35, taille: gros ? 0.35 : 0.14 });
          effets.gerbe(e.x, y + 0.3, e.z, { n: gros ? 16 : 3, couleurs: ['#5a5450', '#7a7068'], vitesse: 0.8, haut: 1.5, vie: 1.2, taille: gros ? 0.9 : 0.35, croit: 2, additif: false, alpha: 0.6 });
          if (gros) { effets.onde(e.x, 0.1, e.z, { couleur: '#ffcc66', r1: 4, vie: 0.8 }); effets.lueur(e.x, 1.2, e.z, '#ffaa55', 14, 0.6); cam.secouer(0.5); effets.trace(e.x, e.z, 1.4); }
          break;
        }
        case 'division':
          effets.gerbe(e.x, 0.35, e.z, { n: 14, couleurs: ['#8fff9a', '#5f9a6e', '#c8ff5a'], vitesse: 2, vie: 0.5, taille: 0.13 });
          break;
        case 'soin':
          effets.onde(e.x, 0.1, e.z, { couleur: '#6dff9a', r0: 0.2, r1: 1.6, vie: 0.6, opacite: 0.6 });
          effets.gerbe(e.x, 0.9, e.z, { n: 5, couleurs: ['#6dff9a', '#c8ffd0'], vitesse: 0.6, haut: 2, vie: 0.8, taille: 0.1, grav: -0.8 });
          break;
        case 'ponte':
          effets.gerbe(e.x, ALTITUDE, e.z, { n: 16, couleurs: ['#ff4dd2', '#d8b8ff', '#ffffff'], vitesse: 2, vie: 0.5, taille: 0.14 });
          break;
        case 'fuite':
          base.userData.rouge = 1;
          effets.onde(e.x, 0.15, e.z, { couleur: '#ff3a3a', r1: 2.2, vie: 0.6 });
          effets.gerbe(e.x, 1.1, e.z, { n: 16, couleurs: ['#ff6a3a', '#ff3a3a', '#ffd23f'], vitesse: 2.5, vie: 0.6, taille: 0.15 });
          cam.secouer(0.12 * e.vies);
          break;
        case 'apparait': {
          const en = p.ennemis.find(x => x.id === e.id);
          if (en && en.d < 0.3) effets.gerbe(en.x, (en.def.vole ? ALTITUDE : 0.9), en.z, { n: e.boss ? 30 : 6, couleurs: ['#ff6a3a', '#ff4dd2', '#ffb347'], vitesse: e.boss ? 3 : 1.4, vie: 0.5, taille: 0.15 });
          if (e.boss) cam.secouer(0.25);
          break;
        }
        case 'construit': case 'ameliore': {
          const s = socles[p.tours.find(t => t.id === e.tour)?.emp];
          const y = s ? s.y : 0.3;
          effets.gerbe(e.x, y + 0.1, e.z, { n: 12, couleurs: ['#c8b89a', '#a89a80'], vitesse: 1.6, haut: 0.6, vie: 0.8, taille: 0.3, croit: 1.8, additif: false, alpha: 0.6, frein: 0.3 });
          effets.gerbe(e.x, y + 0.6, e.z, { n: e.k === 'ameliore' ? 30 : 14, couleurs: ['#fff2a8', '#ffd27a', '#ffffff'], vitesse: 1.4, haut: 2.5, vie: 0.9, taille: 0.1, grav: -1 });
          effets.onde(e.x, y + 0.05, e.z, { couleur: '#ffd27a', r1: 1.1, vie: 0.5 });
          break;
        }
        case 'vendu':
          effets.gerbe(e.x, 0.6, e.z, { n: 14, couleurs: ['#c8b89a', '#8a8078'], vitesse: 1.6, haut: 1, vie: 0.8, taille: 0.3, croit: 1.6, additif: false, alpha: 0.6 });
          effets.gerbe(e.x, 0.8, e.z, { n: 12, couleurs: ['#ffd84d', '#ffb347'], vitesse: 2, haut: 2, vie: 0.7, taille: 0.1, grav: 6 });
          break;
      }
    }
  }

  /* ------------------------------------------------------ ambiance */
  function ambiance(dt) {
    const W = carte.W, H = carte.H;
    const r = Math.random;
    switch (amb.particules) {
      case 'pollen': if (r() < dt * 10) effets.gerbe(r() * W, 0.4 + r() * 2, r() * H, { n: 1, couleurs: ['#fff8d0'], vitesse: 0.15, vie: 4, taille: 0.06, grav: -0.03, alpha: 0.8 }); break;
      case 'feuilles': if (r() < dt * 6) effets.gerbe(r() * W, 3 + r() * 2, r() * H, { n: 1, couleurs: amb.feuillage, vitesse: 0.5, vie: 5, taille: 0.1, grav: 0.5, frein: 0.4, additif: false }); break;
      case 'lucioles': if (r() < dt * 9) effets.gerbe(r() * W, 0.4 + r() * 1.4, r() * H, { n: 1, couleurs: ['#e8ff8a', '#c8ff5a'], vitesse: 0.25, vie: 3.5, taille: 0.12, grav: -0.05 }); break;
      case 'neige': if (r() < dt * 22) effets.gerbe(-4 + r() * (W + 8), 7, -4 + r() * (H + 8), { n: 1, couleurs: ['#ffffff'], vitesse: 0.2, vie: 6, taille: 0.08, grav: 1.1, frein: 0.6, additif: false, alpha: 0.9 }); break;
      case 'braises': if (r() < dt * 14) effets.gerbe(r() * W, 0.1, r() * H, { n: 1, couleurs: ['#ff8a3a', '#ffd23f', '#ff4a1a'], vitesse: 0.3, vie: 3, taille: 0.08, grav: -0.6 }); break;
    }
    // Les portails crachent quelques étincelles.
    for (const pt of portails) if (r() < dt * 6) effets.gerbe(pt.x, 0.95 + (r() - 0.5) * 1.2, pt.z, { n: 1, couleurs: ['#ff6a3a', '#ff4dd2'], vitesse: 0.6, vie: 0.8, taille: 0.1, grav: -0.4 });
  }

  /* --------------------------------------------------------- rendu */
  let largeur = 1, hauteurEcran = 1;
  let aCadrer = false;
  function redimensionner(recadrer = false) {
    if (recadrer) aCadrer = true;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (!w || !h) return; // fenêtre cachée : on attend une vraie taille
    if (w !== largeur || h !== hauteurEcran || aCadrer) {
      const tourne = (w / h < 0.9) !== (largeur / hauteurEcran < 0.9);
      largeur = w; hauteurEcran = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (carte && (aCadrer || tourne)) cam.cadrer(carte.W, carte.H, w / h, aCadrer);
      aCadrer = false;
    }
  }

  function rendre(p, alpha, dt, { demo = false } = {}) {
    redimensionner();
    temps += dt;
    uTemps.value = temps;
    cam.maj(dt);
    const boss = synchroniser(p, alpha, dt, demo);
    ambiance(dt);
    // L'eau ondule.
    const a = eau.geometry.attributes.position, b = eau.userData.base;
    for (let i = 0; i < a.count; i++) a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(temps * 1.3 + b[i * 3] * 0.9 + b[i * 3 + 2] * 0.7) * 0.035;
    a.needsUpdate = true;
    for (const n of nuages) { n.position.x += n.userData.v * dt; if (n.position.x > 55) n.position.x = -35; }
    if (selection.visible) selection.scale.setScalar(1 + Math.sin(temps * 5) * 0.06);
    effets.maj(dt, renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)));
    renderer.render(scene, camera);
    return boss;
  }

  /* --------------------------------------------------------- choix */
  const rayon = new THREE.Raycaster(), ndc = new THREE.Vector2(), plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3), point = new THREE.Vector3();
  function choisir(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    rayon.setFromCamera(ndc, camera);
    const hit = rayon.intersectObjects(capteurs, false)[0];
    if (hit) return hit.object.userData.emp;
    if (!rayon.ray.intersectPlane(plan, point)) return null;
    let best = null, dmin = 0.85;
    for (const s of socles) {
      const d = Math.hypot(s.emp.x - point.x, s.emp.z - point.z);
      if (d < dmin) { dmin = d; best = s.emp.id; }
    }
    return best;
  }

  const v3 = new THREE.Vector3();
  function projeter(x, y, z) {
    v3.set(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height, visible: v3.z < 1 };
  }

  return {
    charger, rendre, evenements, choisir, projeter, selectionner, montrerPortee,
    cacherPortee: () => { portee.visible = false; },
    camera: cam, redimensionner,
    set surTap(f) { surTap = f; },
    hauteurSocle: id => socles[id]?.y ?? 0.3,
    baseFrappee: () => { if (base) base.userData.rouge = 1; },
  };
}
