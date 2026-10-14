/**
 * STREET COMBAT — les arènes en 3D.
 *
 * Chaque arène est une vraie scène 3D (Three.js) : un ciel, des montagnes
 * ou des immeubles au loin, un sol texturé (planches, dalles, sable, neige,
 * métal…), un soleil qui projette des ombres, du brouillard pour la
 * profondeur. Elle est rendue une fois, dans une image de 1000 × 600 que le
 * jeu garde (arenes.js → fondArene) : les combattants, les effets et ce qui
 * bouge (pluie, pétales, braises…) se dessinent par-dessus, comme avant.
 *
 * La caméra regarde l'arène de face, à l'horizontale : le sol du premier
 * plan (z = 0) tombe exactement sur la ligne où se tiennent les combattants
 * (y = 470), et un pixel de l'arène y vaut une unité. Plus loin (z < 0),
 * tout rapetisse et remonte vers l'horizon (y = 300).
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';

/** La qualité choisie dans le menu (haute, moyenne, basse ; « 2d » : sans 3D). Par défaut : moyenne sur un téléphone. */
const QUALITE = (() => { try { const q = JSON.parse(localStorage.getItem('street.graphismes')); if (q) return q; } catch { /* rien */ } return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 'moyenne' : 'haute'; })();
const L = 1000;
const H = 600;
const SOL = 470;
const FOV = 30;
/** La distance de la caméra : à cette distance, la largeur vue vaut 1000. */
const D = (H / 2) / Math.tan((FOV / 2) * Math.PI / 180);
const HC = SOL - H / 2;

/** Un point de l'écran (en pixels de l'arène), à la profondeur z : sa place dans le monde. */
const auPoint = (xe, ye, z) => {
  const k = (D - z) / D;
  return new THREE.Vector3(L / 2 + (xe - L / 2) * k, HC + (H / 2 - ye) * k, z);
};
/** La taille à donner à un objet, à la profondeur z, pour qu'il paraisse mesurer `px` pixels. */
const aEchelle = (px, z) => px * (D - z) / D;

function alea(graine) {
  let s = graine >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ------------------------------------------------------------------ */
/* Le moteur                                                           */
/* ------------------------------------------------------------------ */

let renderer = null;
/** Rend l'arène en 3D (une image de 1000 × 600) ; null si WebGL manque. */
export function decor3D(a) {
  if (!renderer) {
    try {
      const cv = document.createElement('canvas');
      cv.width = L; cv.height = H;
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(L, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch { renderer = null; return null; }
  }
  const construire = ARENES3D[a.id];
  if (!construire) return null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, L / H, 10, 9000);
  camera.position.set(L / 2, HC, D);
  camera.lookAt(L / 2, HC, 0);
  const R = alea(a.id.length * 7919 + a.id.charCodeAt(0) * 31);
  const c = { scene, a, R, lumieres: {} };
  ciel(c, a.ciel);
  construire(c);
  renderer.toneMappingExposure = c.exposition ?? 1;
  renderer.render(scene, camera);
  // On copie l'image (la toile WebGL resservira pour l'arène suivante).
  const sortie = document.createElement('canvas');
  sortie.width = L; sortie.height = H;
  sortie.getContext('2d').drawImage(renderer.domElement, 0, 0);
  finition(sortie, QUALITE);
  // La lumière de l'arène : les combattants (rendu3d.js) s'éclairent dans les mêmes tons.
  sortie.ambiance = c.ambiance || null;
  // On libère ce qui a servi.
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.emissiveMap?.dispose(); m.dispose(); }); });
  return sortie;
}


/* ------------------------------------------------------------------ */
/* La finition de l'image : halo des lumières, fond flou, vignette       */
/* ------------------------------------------------------------------ */

/** Le navigateur sait-il flouter une toile ? (sinon, on garde l'image telle quelle) */
let filtresOk = null;
function filtres() {
  if (filtresOk === null) {
    const g = document.createElement('canvas').getContext('2d');
    g.filter = 'blur(2px)';
    filtresOk = g.filter === 'blur(2px)';
  }
  return filtresOk;
}

/**
 * Une fois l'arène rendue : ses lumières bavent un peu (un halo, comme dans
 * un anime), le lointain se floute légèrement pour détacher les combattants,
 * et les bords s'assombrissent.
 */
function finition(cv, qualite) {
  const g = cv.getContext('2d');
  if (qualite === 'haute' && filtres()) {
    // Le halo : seulement ce qui est très clair, flouté, ajouté en douceur.
    const p = document.createElement('canvas');
    p.width = L / 4; p.height = H / 4;
    const gp = p.getContext('2d');
    gp.filter = 'brightness(0.75) contrast(3.2) saturate(1.3) blur(3px)';
    gp.drawImage(cv, 0, 0, p.width, p.height);
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.55;
    g.imageSmoothingQuality = 'high';
    g.drawImage(p, 0, 0, L, H);
    g.restore();
    // Le lointain (au-dessus de l'horizon) un peu flou, de plus en plus net vers le sol.
    const f = document.createElement('canvas');
    f.width = L; f.height = H;
    const gf = f.getContext('2d');
    gf.filter = 'blur(1.6px)';
    gf.drawImage(cv, 0, 0);
    gf.filter = 'none';
    gf.globalCompositeOperation = 'destination-in';
    const m = gf.createLinearGradient(0, 0, 0, SOL);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.62, 'rgba(0,0,0,0.9)'); m.addColorStop(0.9, 'rgba(0,0,0,0)');
    gf.fillStyle = m; gf.fillRect(0, 0, L, H);
    g.drawImage(f, 0, 0);
  }
  // La vignette.
  const v = g.createRadialGradient(L / 2, H * 0.55, H * 0.45, L / 2, H * 0.55, L * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = v; g.fillRect(0, 0, L, H);
}

/* ------------------------------------------------------------------ */
/* Les textures (dessinées dans une petite toile, répétées)             */
/* ------------------------------------------------------------------ */

function texture(taille, dessin, repeter = [1, 1]) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = taille;
  dessin(cv.getContext('2d'), taille);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeter);
  t.anisotropy = 8;
  return t;
}
/** Du grain : des taches plus claires et plus sombres. */
function grain(g, n, c, R, taille, rmax = 3, alpha = 0.12) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${alpha * R()})` : `rgba(255,255,255,${alpha * R()})`;
    g.beginPath(); g.arc(R() * taille, R() * taille, R() * rmax + 0.5, 0, Math.PI * 2); g.fill();
  }
  void c;
}
const TEX = {
  planches: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c1; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 8; i++) {
      const y = i * 32;
      g.fillStyle = i % 2 ? c1 : c2; g.fillRect(0, y, n, 32);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(n, y); g.stroke();
      const jx = (R() * n) | 0; g.beginPath(); g.moveTo(jx, y); g.lineTo(jx, y + 32); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1;
      for (let k = 0; k < 5; k++) { const yy = y + 4 + R() * 24; g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(n * 0.3, yy + 3, n * 0.6, yy - 3, n, yy); g.stroke(); }
    }
    grain(g, 900, null, R, n, 1.5, 0.08);
  }, [6, 3]),
  dalles: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c2; g.fillRect(0, 0, n, n);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const t = 0.85 + R() * 0.3;
      g.fillStyle = c1; g.globalAlpha = t; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); g.globalAlpha = 1;
    }
    grain(g, 1500, null, R, n, 2, 0.1);
  }, [8, 4]),
  sable: (c1, c2, R) => texture(256, (g, n) => {
    const gr = g.createLinearGradient(0, 0, n, n); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const y = R() * n; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(n * 0.3, y + 8, n * 0.7, y - 8, n, y); g.stroke(); }
    grain(g, 3000, null, R, n, 1, 0.12);
  }, [6, 4]),
  neige: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c1; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(150,180,220,${0.08 * R()})`; g.beginPath(); g.ellipse(R() * n, R() * n, 30 + R() * 40, 8 + R() * 10, 0, 0, Math.PI * 2); g.fill(); }
    grain(g, 1500, null, R, n, 1.2, 0.1);
    void c2;
  }, [5, 3]),
  roche: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c1; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 60; i++) { g.fillStyle = R() < 0.5 ? c2 : 'rgba(255,255,255,0.05)'; g.beginPath(); g.ellipse(R() * n, R() * n, 10 + R() * 30, 6 + R() * 20, R() * 3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { let x = R() * n; let y = R() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    grain(g, 1500, null, R, n, 1.5, 0.12);
  }, [5, 3]),
  lave: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c1; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 50; i++) { g.fillStyle = c2; g.beginPath(); g.ellipse(R() * n, R() * n, 12 + R() * 26, 8 + R() * 16, R() * 3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#ff6a10'; g.lineWidth = 2.4; g.shadowColor = '#ff4000'; g.shadowBlur = 8;
    for (let i = 0; i < 12; i++) { let x = R() * n; let y = R() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  }, [4, 2]),
  metal: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c1; g.fillRect(0, 0, n, n);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(x * 128 + 2, y * 128 + 2, 124, 124);
      g.fillStyle = c2; for (const [dx, dy] of [[10, 10], [118, 10], [10, 118], [118, 118]]) { g.beginPath(); g.arc(x * 128 + dx, y * 128 + dy, 4, 0, Math.PI * 2); g.fill(); }
    }
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); const y = R() * n; g.moveTo(0, y); g.lineTo(n, y + (R() - 0.5) * 10); g.stroke(); }
  }, [8, 4]),
  herbe: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c1; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2500; i++) { g.strokeStyle = R() < 0.5 ? c2 : 'rgba(255,255,255,0.08)'; g.lineWidth = 1; const x = R() * n; const y = R() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y - 3 - R() * 5); g.stroke(); }
  }, [6, 4]),
  tapis: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c1; g.fillRect(0, 0, n, n);
    g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(6, 6, n - 12, n - 12);
    grain(g, 2500, null, R, n, 1, 0.08);
  }, [3, 1.5]),
  marbre: (c1, c2, R) => texture(256, (g, n) => {
    g.fillStyle = c1; g.fillRect(0, 0, n, n);
    g.strokeStyle = c2; g.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) { let x = R() * n; let y = R() * n; g.globalAlpha = 0.25 + R() * 0.3; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.3) * 40; y += (R() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2;
    for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, n); g.moveTo(0, k * 64); g.lineTo(n, k * 64); g.stroke(); }
  }, [8, 4]),
};

/* ------------------------------------------------------------------ */
/* Les briques du décor                                                */
/* ------------------------------------------------------------------ */

const std = (couleur, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(couleur), roughness: 0.85, metalness: 0, ...o });
const lueur = (couleur, force = 2) => new THREE.MeshStandardMaterial({ color: new THREE.Color(couleur), emissive: new THREE.Color(couleur), emissiveIntensity: force, roughness: 0.5 });
const plat = (couleur, o = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur), fog: true, ...o });

function ajouter(c, geo, matiere, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, matiere);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  if (o.s) m.scale.set(...[].concat(o.s, o.s, o.s).slice(0, 3));
  m.castShadow = o.ombre !== false;
  m.receiveShadow = true;
  c.scene.add(m);
  return m;
}

/** Le ciel : un grand fond en dégradé (les couleurs de l'arène), et le brouillard de l'horizon. */
function ciel(c, couleurs, { brouillard = [1400, 5200] } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 256;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  couleurs.forEach((col, i) => gr.addColorStop(i / (couleurs.length - 1), col));
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  c.scene.background = t;
  const horizon = new THREE.Color(couleurs[couleurs.length - 1]);
  c.scene.fog = new THREE.Fog(horizon, brouillard[0], brouillard[1]);
  c.horizon = horizon;
}

/** Le sol : un grand plan, texturé. */
function sol(c, tex, o = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: o.rugosite ?? 0.85, metalness: o.metal ?? 0, color: o.teinte ? new THREE.Color(o.teinte) : 0xffffff });
  if (o.lueur) { m.emissiveMap = tex; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = o.lueur; }
  const p = ajouter(c, new THREE.PlaneGeometry(7000, 6400), m, L / 2, 0, -1900, { rx: -Math.PI / 2, ombre: false });
  return p;
}

/** La lumière : le ciel et le sol, et un soleil qui projette des ombres. */
function lumiere(c, { ciel: cc = '#ffffff', sol: cs = '#404040', ambiance = 1, soleil = '#ffffff', force = 2.2, dir = [-0.5, 0.8, 0.45] } = {}) {
  c.ambiance = { ciel: cc, sol: cs, soleil };
  c.scene.add(new THREE.HemisphereLight(new THREE.Color(cc), new THREE.Color(cs), ambiance));
  const s = new THREE.DirectionalLight(new THREE.Color(soleil), force);
  s.position.set(L / 2 + dir[0] * 2000, dir[1] * 2000, dir[2] * 2000);
  s.target.position.set(L / 2, 0, -300);
  s.castShadow = true;
  s.shadow.mapSize.set(2048, 2048);
  const cam = s.shadow.camera;
  cam.left = -1400; cam.right = 1400; cam.top = 1200; cam.bottom = -1200; cam.near = 100; cam.far = 6000;
  s.shadow.bias = -0.0006;
  s.shadow.normalBias = 1.5;
  c.scene.add(s, s.target);
  return s;
}

/** Une lumière ponctuelle (lanterne, lave, néon). */
function lampe(c, couleur, x, y, z, force = 2, portee = 600) {
  const p = new THREE.PointLight(new THREE.Color(couleur), force * 40000, portee, 2);
  p.position.set(x, y, z);
  c.scene.add(p);
  return p;
}

/** Un soleil (ou une lune) : un disque lumineux, et son halo, posé au fond. */
function astre(c, xe, ye, r, couleur, halo = 3) {
  const z = -4200;
  const p = auPoint(xe, ye, z);
  const k = aEchelle(1, z);
  const g = document.createElement('canvas'); g.width = g.height = 128;
  const x = g.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, couleur); gr.addColorStop(0.25, couleur); gr.addColorStop(0.32, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(g); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: new THREE.Color(couleur), fog: false, transparent: true, depthWrite: false }));
  s.position.copy(p); s.scale.set(r * halo * 2 * k, r * halo * 2 * k, 1);
  c.scene.add(s);
}

/** Des étoiles au fond du ciel. */
function etoiles(c, n, hauteurMax = SOL) {
  const pos = [];
  for (let i = 0; i < n; i++) { const p = auPoint(c.R() * L, c.R() * hauteurMax * 0.75, -4800); pos.push(p.x, p.y, p.z); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  c.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
}

/** Une chaîne de montagnes, au loin : un relief découpé, avec des pentes. */
function montagnes(c, z, hauteur, couleur, { neige = null, rugosite = 1 } = {}) {
  const w = aEchelle(L, z) * 1.6;
  const n = 90;
  const geo = new THREE.PlaneGeometry(w, hauteur * 1.4, n, 18);
  const pos = geo.attributes.position;
  const R = c.R;
  const pics = Array.from({ length: 9 }, () => [(R() - 0.5) * w, hauteur * (0.45 + R() * 0.55), w * (0.07 + R() * 0.1)]);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let h = 0;
    for (const [px, ph, pw] of pics) h = Math.max(h, ph * Math.max(0, 1 - Math.abs(x - px) / pw));
    h += Math.sin(x * 0.02) * 10 * rugosite + (R() - 0.5) * 8 * rugosite;
    const y = pos.getY(i) + hauteur * 0.7;
    const f = y / (hauteur * 1.4);
    pos.setY(i, Math.min(y, h) );
    pos.setZ(i, -f * 120 + (R() - 0.5) * 20 * rugosite);
  }
  geo.computeVertexNormals();
  const m = std(couleur, { roughness: 1, flatShading: true });
  if (neige) {
    const couleurs = [];
    const base = new THREE.Color(couleur); const blanc = new THREE.Color(neige);
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const t = Math.max(0, Math.min(1, (y - hauteur * 0.55) / (hauteur * 0.25))); const col = base.clone().lerp(blanc, t); couleurs.push(col.r, col.g, col.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
    m.vertexColors = true; m.color = new THREE.Color('#ffffff');
  }
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(L / 2, 0, z);
  mesh.receiveShadow = true;
  c.scene.add(mesh);
  return mesh;
}

/** Un rocher : un polyèdre bosselé. */
function rocher(c, x, y, z, r, couleur) {
  const geo = new THREE.DodecahedronGeometry(r, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pos, i); v.multiplyScalar(0.8 + c.R() * 0.35); pos.setXYZ(i, v.x, v.y * 0.75, v.z); }
  geo.computeVertexNormals();
  return ajouter(c, geo, std(couleur, { flatShading: true, roughness: 1 }), x, y, z);
}

/** Un arbre : un tronc, et un feuillage en boules. */
function arbre(c, x, z, h, tronc, feuilles) {
  ajouter(c, new THREE.CylinderGeometry(h * 0.04, h * 0.06, h * 0.6, 8), std(tronc), x, h * 0.3, z);
  for (let k = 0; k < 5; k++) {
    const r = h * (0.18 + c.R() * 0.12);
    ajouter(c, new THREE.IcosahedronGeometry(r, 1), std(feuilles, { flatShading: true }), x + (c.R() - 0.5) * h * 0.4, h * (0.6 + c.R() * 0.3), z + (c.R() - 0.5) * h * 0.3);
  }
}

/** Un sapin : des cônes empilés, un peu de neige. */
function sapin(c, x, z, h, couleur, neige = null) {
  ajouter(c, new THREE.CylinderGeometry(h * 0.03, h * 0.04, h * 0.2, 6), std('#2a1a10'), x, h * 0.1, z);
  for (let k = 0; k < 3; k++) {
    const r = h * (0.32 - k * 0.08);
    ajouter(c, new THREE.ConeGeometry(r, h * 0.42, 9), std(couleur, { flatShading: true }), x, h * (0.32 + k * 0.22), z);
    if (neige) ajouter(c, new THREE.ConeGeometry(r * 0.5, h * 0.16, 9), std(neige), x, h * (0.48 + k * 0.22), z, { ombre: false });
  }
}

/** Un immeuble : un bloc, ses fenêtres allumées (une texture lumineuse). */
function immeuble(c, x, z, w, h, d, couleur, R = c.R, fenetres = ['#ffd27a', '#7ad8ff']) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 8) for (let xx = 4; xx < 60; xx += 8) if (R() < 0.35) { g.fillStyle = fenetres[(R() * fenetres.length) | 0]; g.fillRect(xx, y, 4, 5); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, w / 60), Math.max(1, h / 120));
  const m = std(couleur, { emissiveMap: t, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.3, roughness: 0.6, metalness: 0.2 });
  return ajouter(c, new THREE.BoxGeometry(w, h, d), m, x, h / 2, z);
}

/** Une forme 2D extrudée (torii, trône, engrenage…). */
function extrusion(points, epaisseur, trous = []) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const tr of trous) s.holes.push(tr);
  const geo = new THREE.ExtrudeGeometry(s, { depth: epaisseur, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1.5, bevelSegments: 2 });
  geo.translate(0, 0, -epaisseur / 2);
  return geo;
}

/** Un engrenage, avec son trou. */
function geoEngrenage(r, dents, ep) {
  const pts = [];
  for (let i = 0; i < dents * 4; i++) {
    const a = (i / (dents * 4)) * Math.PI * 2;
    const rr = (i % 4 < 2) ? r * 1.15 : r;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const trou = new THREE.Path();
  trou.absarc(0, 0, r * 0.45, 0, Math.PI * 2, true);
  return extrusion(pts, ep, [trou]);
}

/** Des nuages : des boules douces, blanches. */
function nuage(c, x, y, z, taille, couleur = '#ffffff', opacite = 0.95) {
  const m = std(couleur, { roughness: 1, transparent: opacite < 1, opacity: opacite });
  for (let k = 0; k < 6; k++) {
    const r = taille * (0.3 + c.R() * 0.3);
    ajouter(c, new THREE.IcosahedronGeometry(r, 2), m, x + (k - 2.5) * taille * 0.32, y + Math.sin(k * 1.7) * taille * 0.12, z + (c.R() - 0.5) * taille * 0.3, { ombre: false });
  }
}

/** Une lanterne japonaise : un fil, une boule de papier qui luit, et sa lumière. */
function lanterne(c, xe, ye, z, couleur = '#ff6a2a') {
  const p = auPoint(xe, ye, z);
  const r = aEchelle(18, z);
  ajouter(c, new THREE.CylinderGeometry(1, 1, aEchelle(400, z), 4), std('#1a0a04'), p.x, p.y + aEchelle(200, z) + r, z, { ombre: false });
  ajouter(c, new THREE.SphereGeometry(r, 18, 12), lueur(couleur, 0.9), p.x, p.y, z, { s: [1, 1.15, 1], ombre: false });
  lampe(c, couleur, p.x, p.y, z + 20, 1.2, 700);
}

/* ------------------------------------------------------------------ */
/* Les arènes                                                          */
/* ------------------------------------------------------------------ */

const ARENES3D = {
  dojo(c) {
    const { R } = c;
    lumiere(c, { ciel: '#ffcf9a', sol: '#3a1a08', ambiance: 0.9, soleil: '#ffb060', force: 2.6, dir: [0.4, 0.35, -0.6] });
    astre(c, 700, 250, 70, '#ffcf6a', 3.2);
    montagnes(c, -3400, 900, '#5a2a10');
    montagnes(c, -2300, 520, '#3a1a0c');
    sol(c, TEX.planches('#6a3a18', '#5a3014', R), { rugosite: 0.6 });
    // La pagode, à gauche.
    const bois = std('#2a1408'); const toit = std('#1a0e0a', { roughness: 0.6 });
    const zp = -1300;
    const base = auPoint(200, SOL, zp);
    for (let i = 0; i < 4; i++) {
      const w = aEchelle(150 - i * 28, zp); const y = i * aEchelle(52, zp);
      ajouter(c, new THREE.BoxGeometry(w * 0.7, aEchelle(40, zp), w * 0.6), bois, base.x, y + aEchelle(20, zp), zp);
      ajouter(c, new THREE.ConeGeometry(w * 0.75, aEchelle(26, zp), 4), toit, base.x, y + aEchelle(46, zp), zp, { ry: Math.PI / 4, s: [1, 1, 0.8] });
    }
    // Le torii, à droite.
    const zt = -700;
    const pt = auPoint(827, SOL, zt);
    const rouge = std('#9a1206', { roughness: 0.5 });
    const ht = aEchelle(170, zt); const ecart = aEchelle(60, zt);
    for (const s of [-1, 1]) ajouter(c, new THREE.CylinderGeometry(aEchelle(7, zt), aEchelle(8, zt), ht, 14), rouge, pt.x + s * ecart, ht / 2, zt);
    ajouter(c, new THREE.BoxGeometry(aEchelle(190, zt), aEchelle(12, zt), aEchelle(14, zt)), std('#1a0806'), pt.x, ht + aEchelle(6, zt), zt);
    ajouter(c, new THREE.BoxGeometry(aEchelle(170, zt), aEchelle(9, zt), aEchelle(10, zt)), rouge, pt.x, ht - aEchelle(28, zt), zt);
    // Les cerisiers, et les lanternes (elles tombent là où brillent les lanternes animées).
    for (const [x, z] of [[-200, -1600], [1250, -1500], [420, -2000]]) arbre(c, x, z, 260 + R() * 80, '#3a2010', '#e890b0');
    for (const x of [90, 330, 640]) lanterne(c, x, 320, -60);
    c.exposition = 1.05;
  },
  dojopluie(c) {
    const { R } = c;
    ciel(c, ['#05080e', '#0e1620', '#1a2430', '#2a3440'], { brouillard: [600, 3600] });
    lumiere(c, { ciel: '#8aa0c0', sol: '#1a1612', ambiance: 0.7, soleil: '#a8c0e0', force: 1, dir: [-0.3, 0.9, 0.3] });
    montagnes(c, -3000, 700, '#1a2028');
    sol(c, TEX.planches('#3a3028', '#2e2620', R), { rugosite: 0.25, metal: 0.2 });
    const zp = -1300; const base = auPoint(200, SOL, zp);
    for (let i = 0; i < 4; i++) {
      const w = aEchelle(150 - i * 28, zp); const y = i * aEchelle(52, zp);
      ajouter(c, new THREE.BoxGeometry(w * 0.7, aEchelle(40, zp), w * 0.6), std('#1a1410'), base.x, y + aEchelle(20, zp), zp);
      ajouter(c, new THREE.ConeGeometry(w * 0.75, aEchelle(26, zp), 4), std('#0e0c0c'), base.x, y + aEchelle(46, zp), zp, { ry: Math.PI / 4, s: [1, 1, 0.8] });
    }
    for (const [x, z] of [[-200, -1600], [1250, -1500]]) arbre(c, x, z, 280, '#1a1410', '#4a5a68');
    for (const x of [90, 330, 640]) lanterne(c, x, 320, -60, '#c86a3a');
    c.exposition = 0.9;
  },
  neon(c) {
    const { R } = c;
    lumiere(c, { ciel: '#3a4a9a', sol: '#08102a', ambiance: 0.5, soleil: '#8ab0ff', force: 0.6, dir: [0.2, 0.9, 0.4] });
    etoiles(c, 80, 220);
    sol(c, TEX.dalles('#141c3a', '#0a1028', R), { rugosite: 0.18, metal: 0.4 });
    // Trois rangées d'immeubles, du plus loin au plus près.
    for (const [z, hmin, hmax, col] of [[-3000, 700, 1400, '#10163a'], [-1900, 420, 900, '#0b1030'], [-1100, 200, 520, '#070a22']]) {
      let x = -900;
      while (x < 1900) { const w = 120 + R() * 200; immeuble(c, x + w / 2, z, w, hmin + R() * (hmax - hmin), 140, col); x += w + 20 + R() * 40; }
    }
    // Les enseignes au néon (leurs reflets sur le sol mouillé sont animés par-dessus).
    for (const [xe, ye, texte, col] of [[190, 200, 'ARCADE', '#ff2a8a'], [690, 160, '格闘', '#2ad8ff'], [830, 270, 'K.O.', '#ffe02a']]) enseigne(c, xe, ye, -500, texte, col);
    c.exposition = 1.2;
  },
  neonfeu(c) {
    ARENES3D.neon(c);
    c.scene.fog = new THREE.Fog(new THREE.Color('#4a1408'), 800, 4200);
    for (const x of [-300, 300, 800, 1300]) lampe(c, '#ff6a20', x, 60, -900, 3, 1600);
    // La fumée.
    for (let i = 0; i < 8; i++) nuage(c, c.R() * 1600 - 300, 500 + c.R() * 500, -2200, 260, '#1a0e0c', 0.8);
    c.exposition = 1.1;
  },
  volcan(c) {
    const { R } = c;
    lumiere(c, { ciel: '#ff6a2a', sol: '#2a0505', ambiance: 0.8, soleil: '#ff7a3a', force: 1.6, dir: [0, 0.5, -0.8] });
    // Le volcan : un grand cône, sa bouche de lave.
    const zv = -2600;
    const pv = auPoint(500, SOL, zv);
    const hv = aEchelle(300, zv);
    const geo = new THREE.CylinderGeometry(aEchelle(60, zv), aEchelle(320, zv), hv, 28, 6, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { pos.setX(i, pos.getX(i) * (0.92 + R() * 0.16)); pos.setZ(i, pos.getZ(i) * (0.92 + R() * 0.16)); }
    geo.computeVertexNormals();
    ajouter(c, geo, std('#2a0a06', { flatShading: true }), pv.x, hv / 2, zv);
    ajouter(c, new THREE.CylinderGeometry(aEchelle(58, zv), aEchelle(58, zv), 10, 24), lueur('#ffb030', 3), pv.x, hv - 2, zv, { ombre: false });
    ajouter(c, new THREE.ConeGeometry(aEchelle(30, zv), hv * 0.9, 8, 1, true), lueur('#ff6010', 1.6), pv.x, hv * 0.55, zv + aEchelle(120, zv), { ombre: false, s: [1, 1, 0.2] });
    lampe(c, '#ff6a10', pv.x, hv, zv + 200, 8, 4000);
    montagnes(c, -1600, 300, '#3a0806');
    sol(c, TEX.lave('#2a0606', '#3a0a08', R), { rugosite: 0.9, lueur: 0.6 });
    for (let i = 0; i < 9; i++) rocher(c, R() * 1600 - 300, 0, -400 - R() * 1200, 40 + R() * 70, '#3a0c08');
    for (const x of [-100, 1100]) lampe(c, '#ff4000', x, 20, -300, 2, 900);
    c.exposition = 1.1;
  },
  toundra(c) {
    const { R } = c;
    lumiere(c, { ciel: '#9ac8ff', sol: '#1a3450', ambiance: 0.9, soleil: '#cfe6ff', force: 1.2, dir: [-0.4, 0.7, -0.4] });
    etoiles(c, 160, 330);
    montagnes(c, -3800, 1200, '#2a4a6a', { neige: '#f0f8ff' });
    montagnes(c, -2200, 520, '#1e3a58', { neige: '#e6f4ff' });
    sol(c, TEX.neige('#dfefff', '#a8c8e8', R), { rugosite: 0.7 });
    for (let i = 0; i < 26; i++) sapin(c, R() * 2000 - 500, -500 - R() * 1500, 140 + R() * 120, '#0e2238', '#f0f8ff');
    c.exposition = 1;
  },
  ruines(c) {
    const { R } = c;
    lumiere(c, { ciel: '#ffd8a0', sol: '#4a3010', ambiance: 0.9, soleil: '#ffc870', force: 2.8, dir: [-0.7, 0.35, -0.3] });
    astre(c, 250, 300, 60, '#ffd27a', 3.5);
    montagnes(c, -3200, 400, '#6a4018');
    sol(c, TEX.dalles('#8a6a38', '#5a4018', R));
    // Les colonnes brisées, et l'arche.
    const pierre = std('#7a5a2c', { roughness: 0.95 });
    for (const [xe, z] of [[120, -700], [300, -1100], [680, -1100], [860, -700]]) {
      const p = auPoint(xe, SOL, z); const h = 200 + R() * 160;
      ajouter(c, new THREE.CylinderGeometry(20, 23, h, 16), pierre, p.x, h / 2, z);
      ajouter(c, new THREE.BoxGeometry(62, 18, 62), pierre, p.x, h + 9, z);
    }
    const za = -1600; const pa = auPoint(780, SOL, za);
    const arche = extrusion([[-110, 0], [-80, 0], [-80, 220], [-40, 270], [40, 270], [80, 220], [80, 0], [110, 0], [110, 240], [60, 300], [-60, 300], [-110, 240]], 40);
    ajouter(c, arche, pierre, pa.x, 0, za);
    for (let i = 0; i < 8; i++) rocher(c, R() * 1400 - 200, 0, -300 - R() * 900, 20 + R() * 30, '#6a4a20');
    c.exposition = 1.05;
  },
  station(c) {
    const { R } = c;
    lumiere(c, { ciel: '#6a6ad8', sol: '#101020', ambiance: 0.6, soleil: '#e0e8ff', force: 1.6, dir: [0.6, 0.5, 0.4] });
    etoiles(c, 300, SOL);
    // La planète, et son anneau.
    const zp = -4000; const pp = auPoint(760, 230, zp); const rp = aEchelle(150, zp);
    const planete = ajouter(c, new THREE.SphereGeometry(rp, 48, 32), std('#2a6ad8', { roughness: 0.7, emissive: new THREE.Color('#0a2a6a'), emissiveIntensity: 0.4, fog: false }), pp.x, pp.y, zp, { ombre: false });
    planete.material.fog = false;
    const anneau = ajouter(c, new THREE.RingGeometry(rp * 1.25, rp * 1.6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c8a0ff'), transparent: true, opacity: 0.45, side: THREE.DoubleSide, fog: false }), pp.x, pp.y, zp, { rx: 1.3, ry: 0.2, ombre: false });
    void anneau;
    sol(c, TEX.metal('#2a2a46', '#6464c8', R), { rugosite: 0.35, metal: 0.7 });
    // Les montants de la baie vitrée.
    const acier = std('#1a1a30', { metalness: 0.7, roughness: 0.4 });
    for (const xe of [0, 330, 660, 990]) { const p = auPoint(xe, SOL, -300); ajouter(c, new THREE.BoxGeometry(26, 700, 26), acier, p.x, 350, -300); ajouter(c, new THREE.BoxGeometry(4, 600, 4), lueur('#c864ff', 2), p.x + 15, 330, -285, { ombre: false }); }
    const ph = auPoint(500, 360, -300); ajouter(c, new THREE.BoxGeometry(1400, 18, 30), acier, ph.x, ph.y, -300);
    c.exposition = 1.1;
  },
  jungle(c) {
    const { R } = c;
    lumiere(c, { ciel: '#a8e890', sol: '#18300a', ambiance: 0.8, soleil: '#fff0b0', force: 2, dir: [-0.3, 0.9, -0.2] });
    c.scene.fog = new THREE.Fog(new THREE.Color('#2a5a28'), 700, 3200);
    sol(c, TEX.herbe('#2a4a14', '#3a6a1c', R));
    for (let i = 0; i < 40; i++) arbre(c, R() * 2400 - 700, -300 - R() * 2400, 380 + R() * 260, '#3a2a10', ['#0e4a14', '#1a6a1e', '#0a3a10'][i % 3]);
    for (let i = 0; i < 16; i++) ajouter(c, new THREE.SphereGeometry(40 + R() * 30, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#145a18', { flatShading: true }), R() * 1400 - 200, 0, -150 - R() * 400, { s: [1.4, 0.6, 1] });
    c.exposition = 1;
  },
  abysses(c) {
    const { R } = c;
    ciel(c, ['#00040e', '#00102a', '#002048', '#00366a'], { brouillard: [500, 2800] });
    lumiere(c, { ciel: '#5ad8ff', sol: '#001020', ambiance: 0.8, soleil: '#9ae6ff', force: 1.6, dir: [0.2, 1, 0.1] });
    sol(c, TEX.sable('#c8b48a', '#8a7a58', R));
    for (let i = 0; i < 14; i++) rocher(c, R() * 2000 - 500, 0, -500 - R() * 1800, 60 + R() * 120, '#0a2a3a');
    // Les coraux.
    for (let i = 0; i < 26; i++) {
      const x = R() * 1600 - 300; const z = -200 - R() * 1200; const col = R() < 0.5 ? '#ff6a8a' : '#ffb04a';
      for (let b = 0; b < 4; b++) ajouter(c, new THREE.CylinderGeometry(3, 6, 40 + R() * 50, 6), std(col, { roughness: 0.6 }), x + (R() - 0.5) * 30, 25, z + (R() - 0.5) * 30, { rz: (R() - 0.5) * 0.8, rx: (R() - 0.5) * 0.6 });
    }
    c.exposition = 1.15;
  },
  celeste(c) {
    const { R } = c;
    lumiere(c, { ciel: '#ffffff', sol: '#c8ccf0', ambiance: 1.1, soleil: '#fff6d0', force: 2.4, dir: [0.5, 0.7, -0.4] });
    astre(c, 820, 120, 50, '#fff6c8', 4);
    sol(c, TEX.marbre('#eef0ff', '#b0b4e0', R), { rugosite: 0.3 });
    // Une mer de nuages sous la cité.
    for (let i = 0; i < 18; i++) nuage(c, R() * 3000 - 1000, -40 + R() * 80, -1500 - R() * 2000, 220 + R() * 160);
    // Les îles flottantes, leurs tours et leurs flèches d'or.
    for (const [xe, ye, z] of [[180, 260, -1800], [520, 200, -2600], [840, 300, -1500]]) {
      const p = auPoint(xe, ye, z);
      ajouter(c, new THREE.ConeGeometry(110, 140, 7), std('#c8b48a', { flatShading: true }), p.x, p.y - 70, z, { rx: Math.PI });
      ajouter(c, new THREE.BoxGeometry(110, 120, 110), std('#f0e6c8'), p.x, p.y + 60, z);
      ajouter(c, new THREE.ConeGeometry(78, 110, 4), std('#ffd23f', { metalness: 0.7, roughness: 0.3 }), p.x, p.y + 175, z, { ry: Math.PI / 4 });
    }
    c.exposition = 1.05;
  },
  desert(c) {
    const { R } = c;
    lumiere(c, { ciel: '#ffd090', sol: '#7a4a10', ambiance: 0.9, soleil: '#ffc060', force: 3, dir: [0, 0.35, -0.9] });
    astre(c, 500, 280, 110, '#ffd26a', 2.2);
    // Les dunes : un sol ondulé, au loin.
    const geo = new THREE.PlaneGeometry(7000, 3000, 120, 60);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); const y = pos.getY(i); pos.setZ(i, Math.max(0, (Math.sin(x / 260) * 60 + Math.sin(x / 120 + y / 200) * 30 + 60) * Math.min(1, Math.max(0, (y + 200) / 900)))); }
    geo.computeVertexNormals();
    const dunes = ajouter(c, geo, new THREE.MeshStandardMaterial({ map: TEX.sable('#d8a050', '#b07830', R), roughness: 1 }), L / 2, 0, -2400, { rx: -Math.PI / 2 });
    dunes.castShadow = false;
    sol(c, TEX.sable('#c8963c', '#a0702a', R));
    // Les cactus, un crâne.
    for (const [xe, z] of [[140, -500], [820, -600], [-200, -1300], [1300, -1200]]) {
      const p = auPoint(xe, SOL, z);
      const vert = std('#3a5a20');
      ajouter(c, new THREE.CylinderGeometry(14, 16, 160, 10), vert, p.x, 80, z);
      ajouter(c, new THREE.CylinderGeometry(10, 10, 60, 8), vert, p.x - 30, 110, z, { rz: 0 });
      ajouter(c, new THREE.CylinderGeometry(9, 9, 34, 8), vert, p.x - 18, 84, z, { rz: Math.PI / 2 });
      ajouter(c, new THREE.CylinderGeometry(10, 10, 50, 8), vert, p.x + 28, 100, z);
      ajouter(c, new THREE.CylinderGeometry(9, 9, 30, 8), vert, p.x + 16, 80, z, { rz: Math.PI / 2 });
    }
    const pc = auPoint(420, SOL, -60); ajouter(c, new THREE.SphereGeometry(10, 12, 8), std('#e8dcc0'), pc.x, 8, -60);
    c.exposition = 1.05;
  },
  foret(c) {
    const { R } = c;
    ciel(c, ['#020602', '#081208', '#0e1e0e', '#1a2a14'], { brouillard: [400, 2600] });
    lumiere(c, { ciel: '#7a5aa0', sol: '#0a1806', ambiance: 0.6, soleil: '#b8a0ff', force: 0.9, dir: [0.3, 0.9, 0.2] });
    c.scene.fog = new THREE.Fog(new THREE.Color('#2a2040'), 400, 2600);
    sol(c, TEX.herbe('#14260c', '#0a1806', R));
    // Des arbres morts, tordus.
    for (let i = 0; i < 30; i++) {
      const x = R() * 2400 - 700; const z = -300 - R() * 2000; const h = 400 + R() * 300;
      const courbe = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(30, h * 0.4, 10), new THREE.Vector3(-40, h * 0.7, -10), new THREE.Vector3(10, h, 0)]);
      ajouter(c, new THREE.TubeGeometry(courbe, 12, 10 + R() * 8, 6), std('#0e1a0c'), x, 0, z);
      for (let b = 0; b < 4; b++) {
        const by = h * (0.5 + b * 0.12);
        const br = new THREE.CatmullRomCurve3([new THREE.Vector3(0, by, 0), new THREE.Vector3((R() - 0.5) * 120, by + 40, (R() - 0.5) * 60), new THREE.Vector3((R() - 0.5) * 180, by + 20, (R() - 0.5) * 80)]);
        ajouter(c, new THREE.TubeGeometry(br, 6, 3, 5), std('#0e1a0c'), x, 0, z);
      }
    }
    c.exposition = 1.2;
  },
  cathedrale(c) {
    const { R } = c;
    ciel(c, ['#3a2a10', '#8a6a28', '#d8b860', '#fff0b4'], { brouillard: [1600, 6000] });
    lumiere(c, { ciel: '#fff0c0', sol: '#8a6a30', ambiance: 1, soleil: '#fff2a8', force: 2.4, dir: [-0.3, 0.8, -0.5] });
    sol(c, TEX.marbre('#e6d6a0', '#a08a50', R), { rugosite: 0.25 });
    // Le mur du fond et ses vitraux (là où passent les rayons animés).
    const zm = -900;
    const pm = auPoint(500, SOL, zm);
    ajouter(c, new THREE.BoxGeometry(aEchelle(1400, zm), 1200, 40), std('#6a5020'), pm.x, 600, zm - 30);
    const cols = ['#ff5a5a', '#5aa0ff', '#ffd23f', '#7aff8a', '#c87aff'];
    for (const xe of [130, 400, 600, 870]) {
      const p = auPoint(xe, 190, zm);
      for (let i = 0; i < 12; i++) ajouter(c, new THREE.PlaneGeometry(aEchelle(32, zm), aEchelle(56, zm)), lueur(cols[i % 5], 1.4), p.x + aEchelle(-35 + (i % 3) * 35, zm), p.y + aEchelle(90 - Math.floor(i / 3) * 60, zm), zm, { ombre: false });
      const ar = auPoint(xe, 60, zm);
      ajouter(c, new THREE.CircleGeometry(aEchelle(48, zm), 32, 0, Math.PI), lueur('#ffe680', 1.6), ar.x, ar.y, zm, { ombre: false });
    }
    // Les grands piliers.
    for (const xe of [20, 265, 500, 735, 980]) { const p = auPoint(xe, SOL, -500); ajouter(c, new THREE.CylinderGeometry(aEchelle(18, -500) * 1.2, aEchelle(20, -500) * 1.2, 1400, 20), std('#c8a860', { roughness: 0.6 }), p.x, 700, -500); }
    void R;
    c.exposition = 1;
  },
  trone(c) {
    const { R } = c;
    lumiere(c, { ciel: '#ff2010', sol: '#140000', ambiance: 0.5, soleil: '#ff3a20', force: 1.4, dir: [0, 0.6, -0.8] });
    astre(c, 500, 230, 40, '#ff2010', 5);
    montagnes(c, -2600, 260, '#2a0000');
    sol(c, TEX.dalles('#2a0404', '#120000', R), { rugosite: 0.4 });
    // Le trône.
    const zt = -1100; const pt = auPoint(500, SOL - 40, zt);
    const trone = extrusion([[-80, 0], [-80, 300], [-50, 350], [-20, 300], [0, 380], [20, 300], [50, 350], [80, 300], [80, 0]], 60);
    ajouter(c, trone, std('#0a0000', { metalness: 0.5, roughness: 0.4 }), pt.x, 0, zt);
    ajouter(c, new THREE.SphereGeometry(12, 16, 12), lueur('#ff0020', 3), pt.x, 270, zt + 35, { ombre: false });
    // Les chaînes qui pendent.
    for (const xe of [100, 260, 740, 900]) {
      const p = auPoint(xe, 150, -600);
      for (let k = 0; k < 18; k++) ajouter(c, new THREE.TorusGeometry(6, 2, 6, 12), std('#2a0a0a', { metalness: 0.7, roughness: 0.4 }), p.x + Math.sin(k / 2.5) * 5, p.y + 300 - k * 18, -600, { ry: k % 2 ? Math.PI / 2 : 0 });
    }
    // Les braseros (où montent les flammes animées).
    for (const xe of [60, 940]) { const p = auPoint(xe, SOL, -10); ajouter(c, new THREE.CylinderGeometry(26, 18, 40, 12), std('#2a0606', { metalness: 0.6 }), p.x, 20, -10); lampe(c, '#ff4000', p.x, 80, 40, 3, 900); }
    c.exposition = 1.15;
  },
  zero(c) {
    const { R } = c;
    ciel(c, ['#000000', '#020005', '#08000c', '#1a0208'], { brouillard: [1200, 5200] });
    lumiere(c, { ciel: '#7800c8', sol: '#500800', ambiance: 0.6, soleil: '#c814ff', force: 1.4, dir: [0.2, 0.7, -0.6] });
    etoiles(c, 90, SOL);
    sol(c, TEX.roche('#1a0400', '#3a0800', R), { rugosite: 0.9, teinte: '#8a3a4a' });
    for (let i = 0; i < 14; i++) { const p = auPoint(R() * L, 80 + R() * 260, -900 - R() * 2400); const r = rocher(c, p.x, p.y, p.z, 30 + R() * 60, '#120818'); r.material.emissive = new THREE.Color('#3a0060'); r.material.emissiveIntensity = 0.4; }
    lampe(c, '#c81400', L / 2, 40, -1500, 6, 3000);
    c.exposition = 1.2;
  },
  horloge(c) {
    const { R } = c;
    lumiere(c, { ciel: '#4fe0d0', sol: '#0a2228', ambiance: 0.7, soleil: '#ffe6a0', force: 1.6, dir: [-0.4, 0.8, 0.3] });
    etoiles(c, 80, SOL);
    sol(c, TEX.dalles('#1a3a40', '#0a2228', R), { rugosite: 0.3, metal: 0.3 });
    // L'horloge géante, au fond, et ses engrenages.
    const zh = -2200; const ph = auPoint(500, 220, zh); const rh = aEchelle(150, zh);
    ajouter(c, new THREE.TorusGeometry(rh, rh * 0.05, 12, 64), std('#ffd23f', { metalness: 0.8, roughness: 0.3 }), ph.x, ph.y, zh);
    ajouter(c, new THREE.CircleGeometry(rh * 0.97, 64), std('#06202a', { roughness: 0.3, metalness: 0.4 }), ph.x, ph.y, zh - 4);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ajouter(c, new THREE.BoxGeometry(rh * 0.03, rh * 0.14, 6), lueur('#ffd23f', 1.2), ph.x + Math.cos(a) * rh * 0.85, ph.y + Math.sin(a) * rh * 0.85, zh, { rz: a + Math.PI / 2, ombre: false }); }
    for (const [xe, ye, r, d, col] of [[140, 180, 110, 14, '#4fe0d0'], [860, 120, 80, 12, '#ffd23f'], [760, 360, 60, 10, '#4fe0d0']]) {
      const z = -1500; const p = auPoint(xe, ye, z);
      ajouter(c, geoEngrenage(aEchelle(r, z), d, 24), std(col, { metalness: 0.8, roughness: 0.35, transparent: true, opacity: 0.55 }), p.x, p.y, z, { ombre: false });
    }
    // Les marches de pierre qui flottent.
    for (let i = 0; i < 6; i++) { const p = auPoint(40 + i * 160 + 45, 400 - (i % 3) * 30, -400); ajouter(c, new THREE.BoxGeometry(110, 18, 70), std('#0e2a30'), p.x, p.y, -400); }
    c.exposition = 1.15;
  },
  engrenages(c) {
    const { R } = c;
    lumiere(c, { ciel: '#ffd23f', sol: '#14100a', ambiance: 0.6, soleil: '#ffe0a0', force: 1.4, dir: [0.3, 0.8, 0.3] });
    etoiles(c, 40, SOL);
    sol(c, TEX.metal('#2a2418', '#ffd23f', R), { rugosite: 0.4, metal: 0.6 });
    for (let i = 0; i < 10; i++) {
      const z = -800 - R() * 2400; const p = auPoint(R() * L, 60 + R() * 300, z);
      ajouter(c, geoEngrenage(aEchelle(40 + R() * 120, z), 8 + ((R() * 10) | 0), 30), std(R() < 0.5 ? '#ffd23f' : '#4fe0d0', { metalness: 0.85, roughness: 0.3 }), p.x, p.y, z, { rz: R() * 3 });
    }
    c.exposition = 1.1;
  },
  citadelle(c) {
    const { R } = c;
    lumiere(c, { ciel: '#ffb070', sol: '#2a1c10', ambiance: 0.9, soleil: '#ffa050', force: 2.6, dir: [0.6, 0.3, -0.7] });
    astre(c, 780, 300, 90, '#ffb050', 2.4);
    sol(c, TEX.sable('#6a4a28', '#4a3420', R));
    // Les remparts, les tours, la grande horloge et sa porte.
    const zc = -1500;
    const brique = std('#3a1e0e', { roughness: 0.95 });
    const p0 = auPoint(500, SOL, zc);
    ajouter(c, new THREE.BoxGeometry(aEchelle(760, zc), aEchelle(200, zc), 120), brique, p0.x, aEchelle(100, zc), zc);
    for (let x = 120; x < 880; x += 40) { const p = auPoint(x + 12, SOL, zc); ajouter(c, new THREE.BoxGeometry(aEchelle(24, zc), aEchelle(18, zc), 120), brique, p.x, aEchelle(209, zc), zc); }
    for (const xe of [140, 880]) { const p = auPoint(xe, SOL, zc); ajouter(c, new THREE.BoxGeometry(aEchelle(80, zc), aEchelle(280, zc), 150), brique, p.x, aEchelle(140, zc), zc + 10); }
    const pt = auPoint(500, SOL, zc + 40);
    ajouter(c, new THREE.BoxGeometry(aEchelle(160, zc), aEchelle(310, zc), 160), std('#4a2a14'), pt.x, aEchelle(155, zc), zc + 40);
    const pH = auPoint(500, 200, zc + 125);
    ajouter(c, new THREE.CylinderGeometry(aEchelle(56, zc), aEchelle(56, zc), 12, 40), std('#e8a030', { metalness: 0.7, roughness: 0.35 }), pH.x, pH.y, zc + 125, { rx: Math.PI / 2 });
    ajouter(c, new THREE.CylinderGeometry(aEchelle(48, zc), aEchelle(48, zc), 14, 40), std('#2a140a'), pH.x, pH.y, zc + 127, { rx: Math.PI / 2 });
    // Les rangs de soldats, au pied des murs.
    const soldat = std('#24140a');
    for (let rang = 0; rang < 2; rang++) for (let i = 0; i < 26; i++) {
      const xe = 20 + i * 38 + rang * 19;
      if (xe > 430 && xe < 570) continue;
      const z = -1250 + rang * 60; const p = auPoint(xe, SOL, z);
      ajouter(c, new THREE.CapsuleGeometry(10, 26, 4, 8), soldat, p.x, 26, z);
      ajouter(c, new THREE.CylinderGeometry(1.5, 1.5, 80, 4), std('#6a5030'), p.x + 12, 50, z);
    }
    c.exposition = 1.05;
  },
  ring(c) {
    const { R } = c;
    ciel(c, ['#05030a', '#0e0818', '#1a0e24', '#24102a'], { brouillard: [800, 4000] });
    lumiere(c, { ciel: '#8a7aff', sol: '#1a1a4a', ambiance: 0.4, soleil: '#fff8e0', force: 2.6, dir: [0, 1, 0.15] });
    sol(c, TEX.tapis('#2a2a6a', '#ffd23f', R), { rugosite: 0.9 });
    // La foule, dans le noir, sur des gradins.
    for (let rang = 0; rang < 6; rang++) {
      const z = -700 - rang * 160; const y = rang * 70;
      for (let i = 0; i < 46; i++) { const x = -600 + i * 50 + (rang % 2) * 25; ajouter(c, new THREE.CapsuleGeometry(14, 24, 4, 8), std(`hsl(${260 + R() * 40}, 20%, ${12 + rang * 2}%)`), x, y + 30, z, { ombre: false }); }
    }
    // L'écran géant.
    const zE = -1600; const pE = auPoint(500, 120, zE);
    const cvE = document.createElement('canvas'); cvE.width = 512; cvE.height = 220;
    const gE = cvE.getContext('2d'); gE.fillStyle = '#0a0a14'; gE.fillRect(0, 0, 512, 220);
    gE.font = '900 92px Impact, sans-serif'; gE.textAlign = 'center'; gE.fillStyle = '#ffd23f'; gE.shadowColor = '#ffd23f'; gE.shadowBlur = 20; gE.fillText('CHAMPION', 256, 145);
    const tE = new THREE.CanvasTexture(cvE); tE.colorSpace = THREE.SRGBColorSpace;
    ajouter(c, new THREE.BoxGeometry(aEchelle(280, zE), aEchelle(120, zE), 20), new THREE.MeshStandardMaterial({ map: tE, emissiveMap: tE, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.4 }), pE.x, pE.y, zE, { ombre: false });
    // Les cordes du ring, et les poteaux.
    for (let i = 0; i < 3; i++) ajouter(c, new THREE.CylinderGeometry(3, 3, 2400, 8), std(['#d8102a', '#f0f0f0', '#1a4ad8'][i], { roughness: 0.4 }), L / 2, 40 + i * 32, -60, { rz: Math.PI / 2 });
    for (const xe of [28, 972]) ajouter(c, new THREE.CylinderGeometry(9, 9, 140, 12), std('#c8c8d8', { metalness: 0.8, roughness: 0.3 }), xe, 70, -60);
    c.exposition = 1.1;
  },
  sommet(c) {
    const { R } = c;
    lumiere(c, { ciel: '#c0d8ff', sol: '#2a2a36', ambiance: 0.8, soleil: '#eef4ff', force: 1.6, dir: [0.6, 0.6, -0.4] });
    etoiles(c, 200, 300);
    astre(c, 800, 120, 46, '#eef4ff', 3);
    sol(c, TEX.dalles('#4a4a5a', '#2a2a36', R));
    // La mer de nuages, en contrebas.
    for (let i = 0; i < 16; i++) nuage(c, R() * 3000 - 1000, -300 + R() * 120, -1600 - R() * 2000, 260 + R() * 160, '#c8d4f0', 0.9);
    // Les créneaux de la tour.
    const pierre = std('#3a3a4a');
    ajouter(c, new THREE.BoxGeometry(3000, 40, 30), pierre, L / 2, 20, -400);
    for (let x = -800; x < 1800; x += 90) ajouter(c, new THREE.BoxGeometry(50, 40, 30), pierre, x, 60, -400);
    c.exposition = 1.05;
  },
  /* ---- Chez eux : les arènes de la nouvelle vague ---- */
  lucha(c) {
    // L'arène de lucha libre : la foule sur les gradins, les fanions de papel picado, l'écran au masque, les cordes.
    const { R } = c;
    ciel(c, ['#0a0414', '#1a0828', '#2a0a30', '#3a0a2a'], { brouillard: [800, 4200] });
    lumiere(c, { ciel: '#ff6aa0', sol: '#0a1a4a', ambiance: 0.45, soleil: '#fff4e0', force: 2.6, dir: [0, 1, 0.15] });
    sol(c, TEX.tapis('#1a5ac8', '#ffd23f', R), { rugosite: 0.9 });
    for (let rang = 0; rang < 6; rang++) {
      const z = -700 - rang * 160; const y = rang * 70;
      for (let i = 0; i < 46; i++) { const x = -600 + i * 50 + (rang % 2) * 25; ajouter(c, new THREE.CapsuleGeometry(14, 24, 4, 8), std(`hsl(${300 + R() * 60}, ${30 + R() * 30}%, ${14 + rang * 2}%)`), x, y + 30, z, { ombre: false }); }
    }
    // Les fanions, en guirlandes au-dessus du ring.
    const cols = ['#ff3a8a', '#ffd23f', '#2ae8a0', '#3ab8ff', '#ff7a2a', '#c86aff'];
    for (const [ye, z] of [[34, -500], [70, -900]]) {
      const p0 = auPoint(0, ye, z); const p1 = auPoint(L, ye, z);
      ajouter(c, new THREE.CylinderGeometry(1, 1, p1.x - p0.x + 400, 4), std('#1a1018'), L / 2, p0.y, z, { rz: Math.PI / 2, ombre: false });
      for (let x = p0.x - 200; x < p1.x + 200; x += aEchelle(34, z)) {
        const f = ajouter(c, new THREE.PlaneGeometry(aEchelle(28, z), aEchelle(32, z)), new THREE.MeshStandardMaterial({ color: new THREE.Color(cols[(R() * cols.length) | 0]), side: THREE.DoubleSide, roughness: 0.8, emissive: new THREE.Color('#200818'), emissiveIntensity: 0.3 }), x, p0.y - aEchelle(18, z), z, { rz: (R() - 0.5) * 0.3, ombre: false });
        void f;
      }
    }
    // L'écran géant, et son masque de catcheur.
    panneau(c, 500, 175, -1000, 300, 150, (g, w, h) => {
      g.fillStyle = '#0a0a14'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8203a'; g.beginPath(); g.ellipse(w / 2, h / 2 + 10, h * 0.32, h * 0.38, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd23f'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * h * 0.13, h / 2, h * 0.11, h * 0.07, s * -0.4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffffff'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * h * 0.13, h / 2, h * 0.055, h * 0.035, 0, 0, Math.PI * 2); g.fill(); }
      g.font = `900 ${h * 0.2}px Impact, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#ffd23f'; g.shadowColor = '#ffd23f'; g.shadowBlur = 16;
      g.fillText('¡LUCHA LIBRE!', w / 2, h * 0.16);
    }, 1.5);
    // Les cordes (rouge, or, vert) et les poteaux.
    for (let i = 0; i < 3; i++) ajouter(c, new THREE.CylinderGeometry(3, 3, 2400, 8), std(['#e8203a', '#ffd23f', '#2a9a4a'][i], { roughness: 0.4 }), L / 2, 40 + i * 32, -60, { rz: Math.PI / 2 });
    for (const xe of [28, 972]) ajouter(c, new THREE.CylinderGeometry(9, 9, 140, 12), std('#ffd23f', { metalness: 0.8, roughness: 0.3 }), xe, 70, -60);
    c.exposition = 1.1;
  },
  ruelle(c) {
    // La ruelle au coucher du soleil : les murs de brique, le grand graffiti, les escaliers de secours, la rampe de skate.
    const { R } = c;
    lumiere(c, { ciel: '#ffb09a', sol: '#4a3a48', ambiance: 1.3, soleil: '#ffb070', force: 2.2, dir: [0.2, 0.6, 0.7] });
    sol(c, TEX.dalles('#4a4a56', '#34343e', R), { rugosite: 0.6 });
    // La ville au loin, au bout de la ruelle.
    for (let i = 0; i < 9; i++) immeuble(c, -200 + i * 190 + R() * 60, -3200, 150 + R() * 80, 500 + R() * 700, 140, '#2a1a2a', R, ['#ffd27a', '#ff8a6a']);
    // Le mur du fond, tagué.
    panneau(c, 500, 270, -900, 760, 380, (g, w, h) => {
      g.fillStyle = '#5a3a34'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = ((y / 18) % 2) * 20; x < w; x += 40) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 18); g.stroke(); } }
      const cols = ['#ff3ad0', '#2ae8a0', '#ffd23f', '#3ab8ff', '#ff7a2a'];
      for (let i = 0; i < 14; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(R() * w, R() * h, 40 + R() * 70, 20 + R() * 40, R() * 3, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      g.font = `900 ${h * 0.34}px "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#10081a'; g.strokeText('GRAFF', w / 2, h * 0.52);
      const gr = g.createLinearGradient(0, h * 0.35, 0, h * 0.7); gr.addColorStop(0, '#ffd23f'); gr.addColorStop(1, '#ff3ad0');
      g.fillStyle = gr; g.fillText('GRAFF', w / 2, h * 0.52);
      g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.strokeText('GRAFF', w / 2 - 4, h * 0.5);
    }, 0.35);
    lampe(c, '#ffc8a0', L / 2, 300, -500, 2.5, 1400);
    // Les murs des côtés, et leurs escaliers de secours.
    const brique = std('#4a2a26', { roughness: 0.95 });
    for (const s of [-1, 1]) {
      const x = L / 2 + s * 820;
      ajouter(c, new THREE.BoxGeometry(320, 1000, 1600), brique, x, 500, -900);
      for (let k = 0; k < 4; k++) {
        ajouter(c, new THREE.BoxGeometry(120, 6, 260), std('#2a2a34', { metalness: 0.6, roughness: 0.5 }), x - s * 220, 220 + k * 190, -700);
        ajouter(c, new THREE.BoxGeometry(4, 60, 260), std('#2a2a34', { metalness: 0.6 }), x - s * 278, 250 + k * 190, -700);
      }
    }
    // La rampe de skate, la benne, le réverbère.
    const pr = auPoint(800, SOL, -300);
    const rampe = new THREE.Shape(); rampe.moveTo(0, 0); rampe.lineTo(120, 0); rampe.lineTo(120, 110); rampe.quadraticCurveTo(110, 10, 0, 0);
    const geoR = new THREE.ExtrudeGeometry(rampe, { depth: 160, bevelEnabled: false }); geoR.translate(0, 0, -80);
    ajouter(c, geoR, std('#6a6a7a', { roughness: 0.6 }), pr.x, 0, -300);
    ajouter(c, new THREE.BoxGeometry(150, 80, 80), std('#1a5a3a', { roughness: 0.7 }), auPoint(170, SOL, -380).x, 40, -380);
    const pl = auPoint(60, SOL, -200);
    ajouter(c, new THREE.CylinderGeometry(4, 5, 360, 8), std('#1a1a22'), pl.x, 180, -200);
    ajouter(c, new THREE.SphereGeometry(14, 12, 8), lueur('#ffd27a', 2), pl.x + 20, 360, -200, { ombre: false });
    lampe(c, '#ffb060', pl.x + 20, 340, -160, 2, 900);
    c.exposition = 1.25;
  },
  bosquet(c) {
    // Le bosquet sacré : un arbre immense, des champignons qui luisent, un cercle de pierres, de l'herbe haute.
    const { R } = c;
    ciel(c, ['#0a2014', '#1a4a28', '#4a8a3a', '#c8e88a'], { brouillard: [700, 3600] });
    lumiere(c, { ciel: '#c8ff9a', sol: '#24480e', ambiance: 0.9, soleil: '#fff0b0', force: 2.4, dir: [-0.3, 0.9, -0.3] });
    c.scene.fog = new THREE.Fog(new THREE.Color('#4a8a4a'), 900, 3800);
    sol(c, TEX.herbe('#3a6a1c', '#4a8a24', R));
    // L'arbre immense au centre, ses racines.
    const za = -1600; const pa = auPoint(500, SOL, za);
    const bois = std('#4a3018', { roughness: 1 });
    ajouter(c, new THREE.CylinderGeometry(70, 130, 900, 14), bois, pa.x, 450, za);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ajouter(c, new THREE.CylinderGeometry(14, 40, 260, 8), bois, pa.x + Math.cos(a) * 130, 40, za + Math.sin(a) * 130, { rz: Math.cos(a) * 1.1, rx: -Math.sin(a) * 1.1 }); }
    for (let k = 0; k < 16; k++) {
      const a = R() * Math.PI * 2; const r = 120 + R() * 380;
      ajouter(c, new THREE.IcosahedronGeometry(170 + R() * 120, 1), std(['#3a8a30', '#4aa83a', '#2e7a2a'][k % 3], { flatShading: true }), pa.x + Math.cos(a) * r, 900 + R() * 280, za + Math.sin(a) * r * 0.5, { ombre: false });
    }
    // D'autres arbres autour.
    for (let i = 0; i < 18; i++) { const x = R() * 2400 - 700; if (x > 200 && x < 800) continue; arbre(c, x, -600 - R() * 1800, 380 + R() * 220, '#3a2a10', ['#2e7a2a', '#3a8a30', '#4aa83a'][i % 3]); }
    // Le cercle de pierres levées.
    for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + 0.7 * (i / 6)); ajouter(c, new THREE.BoxGeometry(40, 120 + R() * 50, 24), std('#7a7a72', { flatShading: true, roughness: 1 }), pa.x + Math.cos(a) * 520, 60, za + 500 - Math.sin(a) * 260, { ry: a }); }
    // Les champignons qui luisent.
    for (let i = 0; i < 14; i++) {
      const x = R() * 1400 - 200; const z = -180 - R() * 600;
      ajouter(c, new THREE.CylinderGeometry(4, 6, 26, 8), std('#e8e0c8'), x, 13, z, { ombre: false });
      ajouter(c, new THREE.SphereGeometry(18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lueur(i % 3 ? '#8aff5a' : '#ff8ad8', 0.8), x, 24, z, { s: [1, 0.6, 1], ombre: false });
      if (i % 4 === 0) lampe(c, '#8aff5a', x, 40, z, 0.8, 300);
    }
    c.exposition = 1.05;
  },
  club(c) {
    // Le club sur le toit : la ville de nuit, la cabine du DJ, les enceintes, la boule à facettes, la piste qui brille.
    const { R } = c;
    ciel(c, ['#02000a', '#0a0420', '#14062e', '#220838'], { brouillard: [1200, 5200] });
    lumiere(c, { ciel: '#a050ff', sol: '#0a0812', ambiance: 0.4, soleil: '#8ae8ff', force: 1.2, dir: [0, 1, 0.3] });
    etoiles(c, 90, 240);
    // La piste de danse : des dalles de couleur qui luisent.
    const piste = texture(256, (g, n) => { const cols = ['#00e5ff', '#a050ff', '#ff3ad0', '#1a1428']; for (let y = 0; y < n; y += 32) for (let x = 0; x < n; x += 32) { g.fillStyle = cols[(R() * cols.length) | 0]; g.fillRect(x + 1, y + 1, 30, 30); } }, [14, 12]);
    sol(c, piste, { rugosite: 0.3, metal: 0.3, lueur: 0.35, teinte: '#8a8aa0' });
    for (const [z, hmin, hmax] of [[-3200, 600, 1300], [-2400, 400, 900]]) { let x = -900; while (x < 1900) { const w = 120 + R() * 180; immeuble(c, x + w / 2, z, w, hmin + R() * (hmax - hmin), 140, '#0a0818', R, ['#a050ff', '#00e5ff', '#ffd27a']); x += w + 30 + R() * 40; } }
    // La cabine du DJ, sa façade qui luit.
    const pd = auPoint(500, SOL, -900);
    ajouter(c, new THREE.BoxGeometry(aEchelle(260, -900), 150, 120), std('#14101e', { roughness: 0.4, metalness: 0.4 }), pd.x, 75, -900);
    ajouter(c, new THREE.BoxGeometry(aEchelle(250, -900), 12, 4), lueur('#00e5ff', 2.5), pd.x, 110, -838, { ombre: false });
    ajouter(c, new THREE.BoxGeometry(aEchelle(250, -900), 8, 4), lueur('#a050ff', 2.5), pd.x, 60, -838, { ombre: false });
    // Les enceintes géantes.
    for (const xe of [150, 850]) {
      const p = auPoint(xe, SOL, -700);
      ajouter(c, new THREE.BoxGeometry(150, 300, 120), std('#0a0812', { roughness: 0.5 }), p.x, 150, -700);
      for (const [y, r] of [[230, 40], [110, 56]]) {
        ajouter(c, new THREE.CylinderGeometry(r, r, 8, 28), std('#2a2638', { roughness: 0.4 }), p.x, y, -638, { rx: Math.PI / 2 });
        ajouter(c, new THREE.TorusGeometry(r * 0.78, 3, 8, 28), lueur('#00e5ff', 1.6), p.x, y, -632, { ombre: false });
      }
    }
    // La boule à facettes.
    const pb = auPoint(500, 70, -500);
    ajouter(c, new THREE.IcosahedronGeometry(aEchelle(34, -500), 2), std('#e0e4f0', { metalness: 1, roughness: 0.15, flatShading: true }), pb.x, pb.y, -500);
    ajouter(c, new THREE.CylinderGeometry(1, 1, 400, 4), std('#1a1a22'), pb.x, pb.y + 220, -500, { ombre: false });
    for (const [x, col] of [[200, '#a050ff'], [500, '#00e5ff'], [800, '#ff3ad0']]) lampe(c, col, auPoint(x, 200, -300).x, 200, -300, 2.2, 1100);
    enseigne(c, 500, 150, -1100, 'ÉCHO', '#00e5ff');
    c.exposition = 1.2;
  },
  papier(c) {
    // Le jardin de papier : des cloisons de papier qui luisent au couchant, les cerisiers, les lanternes, des grues suspendues.
    const { R } = c;
    lumiere(c, { ciel: '#ffc8b0', sol: '#6a4a3a', ambiance: 0.95, soleil: '#ffb090', force: 2.2, dir: [0.5, 0.35, -0.6] });
    astre(c, 760, 210, 70, '#ffe0a0', 3);
    montagnes(c, -3400, 700, '#6a3a4a');
    // Le gravier ratissé.
    const gravier = texture(256, (g, n) => { g.fillStyle = '#d8c8a8'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(120,100,70,0.35)'; g.lineWidth = 2; for (let y = 4; y < n; y += 10) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= n; x += 16) g.lineTo(x, y + Math.sin(x / 20) * 2); g.stroke(); } grain(g, 600, '#a08a60', R, n, 2, 0.2); }, [10, 10]);
    sol(c, gravier, { rugosite: 0.95 });
    // Les cloisons de papier (shoji), lumineuses.
    const zs = -1100;
    for (let i = 0; i < 7; i++) {
      const p = auPoint(30 + i * 156, SOL, zs);
      const w = aEchelle(140, zs), h = aEchelle(250, zs);
      ajouter(c, new THREE.BoxGeometry(w, h, 10), std('#3a2418'), p.x, h / 2, zs - 6);
      const shoji = texture(128, (g, n) => { g.fillStyle = '#fff2dc'; g.fillRect(0, 0, n, n); g.strokeStyle = '#3a2418'; g.lineWidth = 4; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo((k * n) / 4, 0); g.lineTo((k * n) / 4, n); g.stroke(); g.beginPath(); g.moveTo(0, (k * n) / 4); g.lineTo(n, (k * n) / 4); g.stroke(); } });
      ajouter(c, new THREE.PlaneGeometry(w * 0.92, h * 0.94), new THREE.MeshStandardMaterial({ map: shoji, emissiveMap: shoji, emissive: new THREE.Color('#ffd8a0'), emissiveIntensity: 0.55 }), p.x, h / 2, zs, { ombre: false });
    }
    ajouter(c, new THREE.BoxGeometry(aEchelle(1200, zs), aEchelle(30, zs), 90), std('#2a1810'), L / 2, aEchelle(268, zs), zs);
    // Les cerisiers, le petit pont rouge, la lanterne de pierre.
    for (const [x, z] of [[-150, -800], [1150, -900], [280, -1700], [760, -1800]]) arbre(c, x, z, 300 + R() * 80, '#3a2010', '#ffb6d0');
    const pp = auPoint(250, SOL, -500);
    ajouter(c, new THREE.TorusGeometry(100, 8, 8, 24, Math.PI), std('#c8102e', { roughness: 0.5 }), pp.x, 0, -500);
    const pl = auPoint(850, SOL, -350);
    ajouter(c, new THREE.BoxGeometry(30, 70, 30), std('#8a8a82', { flatShading: true }), pl.x, 35, -350);
    ajouter(c, new THREE.BoxGeometry(46, 26, 46), lueur('#ffc870', 0.7), pl.x, 82, -350, { ombre: false });
    ajouter(c, new THREE.ConeGeometry(42, 26, 4), std('#6a6a62', { flatShading: true }), pl.x, 108, -350, { ry: Math.PI / 4 });
    // Les grues de papier suspendues, et les lanternes.
    for (let i = 0; i < 9; i++) {
      const p = auPoint(60 + i * 110, 120 + (i % 3) * 20, -260);
      ajouter(c, new THREE.CylinderGeometry(0.6, 0.6, 300, 3), std('#2a1a10'), p.x, p.y + 150, -260, { ombre: false });
      grue3D(c, p.x, p.y, -260, 18, i % 3 ? '#fff6e8' : '#f04060', R() * 6);
    }
    for (const x of [100, 400, 700]) lanterne(c, x, 300, -80, '#ffb060');
    c.exposition = 1.05;
  },
  labo(c) {
    // Le labo magnétique : l'électroaimant géant, les bobines de cuivre, les tours de Tesla, la ferraille.
    const { R } = c;
    ciel(c, ['#04060c', '#0a1220', '#14223a', '#1e3050'], { brouillard: [600, 3400] });
    lumiere(c, { ciel: '#d8c0ff', sol: '#3a3e4a', ambiance: 1.1, soleil: '#c8d8ff', force: 2, dir: [0.2, 0.7, 0.6] });
    sol(c, TEX.metal('#3a3e4a', '#c8a0ff', R), { rugosite: 0.35, metal: 0.5 });
    // Le mur du fond, ses panneaux et ses tuyaux.
    const zm = -1300;
    ajouter(c, new THREE.BoxGeometry(3600, 1400, 40), std('#2a3448', { metalness: 0.3, roughness: 0.7 }), L / 2, 700, zm - 30);
    for (let i = 0; i < 6; i++) ajouter(c, new THREE.CylinderGeometry(10, 10, 3000, 10), std('#3a4050', { metalness: 0.7, roughness: 0.4 }), L / 2, 120 + i * 140, zm, { rz: Math.PI / 2 });
    // L'électroaimant en fer à cheval, rouge, ses pôles d'argent.
    const pm = auPoint(500, 220, zm + 50);
    ajouter(c, new THREE.TorusGeometry(aEchelle(110, zm), aEchelle(36, zm), 16, 40, Math.PI), std('#d8203a', { roughness: 0.35, metalness: 0.3 }), pm.x, pm.y, zm + 50, { rz: Math.PI });
    for (const s of [-1, 1]) ajouter(c, new THREE.BoxGeometry(aEchelle(76, zm), aEchelle(70, zm), aEchelle(76, zm)), std('#d8dce8', { metalness: 0.9, roughness: 0.2 }), pm.x + s * aEchelle(110, zm), pm.y + aEchelle(30, zm), zm + 50);
    lampe(c, '#c8a0ff', pm.x, pm.y + 80, zm + 200, 3, 1400);
    // Les tours de Tesla (bobines de cuivre, boule qui luit).
    for (const xe of [130, 870]) {
      const p = auPoint(xe, SOL, -700);
      ajouter(c, new THREE.CylinderGeometry(14, 22, 380, 12), std('#2a2a36', { metalness: 0.6 }), p.x, 190, -700);
      for (let k = 0; k < 10; k++) ajouter(c, new THREE.TorusGeometry(26, 6, 8, 20), std('#c8783a', { metalness: 0.8, roughness: 0.3 }), p.x, 60 + k * 26, -700, { rx: Math.PI / 2 });
      ajouter(c, new THREE.SphereGeometry(36, 20, 14), lueur('#c8a0ff', 2.2), p.x, 410, -700, { ombre: false });
      lampe(c, '#c8a0ff', p.x, 420, -600, 2.5, 900);
    }
    // La ferraille au sol.
    for (let i = 0; i < 10; i++) rocher(c, R() * 1600 - 300, 0, -350 - R() * 700, 30 + R() * 50, '#4a4e5a').material.metalness = 0.7;
    c.exposition = 1.15;
  },
  casino(c) {
    // Le Velours Noir : les rideaux de velours, les lustres, les machines à sous, l'enseigne d'or.
    const { R } = c;
    ciel(c, ['#0a0004', '#1a0208', '#2a040e', '#3a0812'], { brouillard: [900, 4200] });
    lumiere(c, { ciel: '#ffb070', sol: '#2a0408', ambiance: 0.55, soleil: '#ffe0a0', force: 1.8, dir: [0, 0.9, 0.4] });
    sol(c, TEX.tapis('#5a0a14', '#ffd23f', R), { rugosite: 0.95 });
    // Les rideaux : de grands plis de velours rouge, au fond.
    const zr = -1200;
    for (let x = -800; x < 1800; x += 60) ajouter(c, new THREE.CylinderGeometry(34, 34, 1400, 12, 1, false, 0, Math.PI), std('#7a0a1a', { roughness: 0.95 }), x, 700, zr, { ry: -Math.PI / 2 });
    // Les lustres d'or.
    for (const xe of [200, 500, 800]) {
      const p = auPoint(xe, 60, -800);
      ajouter(c, new THREE.CylinderGeometry(1.5, 1.5, 300, 4), std('#3a2a10'), p.x, p.y + 160, -800, { ombre: false });
      ajouter(c, new THREE.TorusGeometry(46, 5, 8, 24), std('#ffd23f', { metalness: 0.9, roughness: 0.25 }), p.x, p.y, -800, { rx: Math.PI / 2 });
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ajouter(c, new THREE.SphereGeometry(6, 10, 8), lueur('#fff0a0', 2.4), p.x + Math.cos(a) * 46, p.y + 8, -800 + Math.sin(a) * 46, { ombre: false }); }
      lampe(c, '#ffe0a0', p.x, p.y - 20, -760, 2.4, 1200);
    }
    // Les rangées de machines à sous, de chaque côté.
    for (let i = 0; i < 12; i++) {
      const xe = i < 6 ? -40 + i * 60 : 700 + (i - 6) * 60;
      const p = auPoint(xe, SOL, -600);
      ajouter(c, new THREE.BoxGeometry(48, 150, 46), std('#ffd23f', { metalness: 0.7, roughness: 0.35 }), p.x, 75, -600);
      ajouter(c, new THREE.BoxGeometry(36, 40, 4), lueur(R() < 0.5 ? '#ff4a5a' : '#7ad8ff', 1.4), p.x, 105, -576, { ombre: false });
      ajouter(c, new THREE.CylinderGeometry(2, 2, 40, 6), std('#c8c8d8', { metalness: 0.8 }), p.x + 28, 120, -590, { ombre: false });
      ajouter(c, new THREE.SphereGeometry(5, 10, 8), std('#d8102a'), p.x + 28, 142, -590, { ombre: false });
    }
    enseigne(c, 500, 140, -1000, 'LE VELOURS NOIR', '#ffd23f');
    c.exposition = 1.15;
  },
  saloon(c) {
    // La grand-rue de l'Ouest : le saloon, les maisons de bois, le château d'eau, les mesas au soleil couchant.
    const { R } = c;
    lumiere(c, { ciel: '#ffc890', sol: '#6a4020', ambiance: 0.9, soleil: '#ffb060', force: 2.8, dir: [0.5, 0.3, -0.8] });
    astre(c, 780, 250, 80, '#ffd890', 2.6);
    montagnes(c, -3600, 650, '#a0502a', { rugosite: 0.4 });
    sol(c, TEX.sable('#b08048', '#8a5a2a', R));
    // Les mesas : de grands blocs plats, au loin.
    for (const [xe, w, h] of [[120, 300, 260], [880, 380, 200]]) { const z = -2600; const p = auPoint(xe, SOL, z); ajouter(c, new THREE.CylinderGeometry(w * 0.8, w, h, 8), std('#b05a2a', { flatShading: true, roughness: 1 }), p.x, h / 2, z); }
    // Le saloon, sa véranda, son enseigne, ses portes battantes.
    const zs = -1000; const ps = auPoint(500, SOL, zs);
    const bois = std('#7a4a22', { roughness: 0.9 }); const fonce = std('#4a2a12', { roughness: 0.9 });
    ajouter(c, new THREE.BoxGeometry(aEchelle(380, zs), aEchelle(260, zs), 200), bois, ps.x, aEchelle(130, zs), zs - 60);
    ajouter(c, new THREE.BoxGeometry(aEchelle(440, zs), aEchelle(14, zs), 140), fonce, ps.x, aEchelle(150, zs), zs + 60);
    for (const s of [-1, -0.33, 0.33, 1]) ajouter(c, new THREE.CylinderGeometry(6, 6, aEchelle(150, zs), 8), fonce, ps.x + s * aEchelle(200, zs), aEchelle(75, zs), zs + 120);
    for (const s of [-1, 1]) ajouter(c, new THREE.BoxGeometry(aEchelle(28, zs), aEchelle(46, zs), 6), fonce, ps.x + s * aEchelle(16, zs), aEchelle(50, zs), zs + 42);
    panneau(c, 500, 230, zs + 50, 260, 60, (g, w, h) => { g.fillStyle = '#3a1a08'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff0a0'; g.font = `900 ${h * 0.7}px "Arial Black", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SALOON', w / 2, h / 2 + 2); });
    // Les maisons voisines, le château d'eau.
    for (const [xe, z, w, h, col] of [[-80, -900, 260, 200, '#8a5a2a'], [1080, -900, 260, 230, '#6a4020'], [150, -1500, 200, 170, '#7a5030']]) { const p = auPoint(xe, SOL, z); ajouter(c, new THREE.BoxGeometry(w, h, 160), std(col, { roughness: 0.9 }), p.x, h / 2, z); }
    const pw = auPoint(860, SOL, -1500);
    for (const [dx, dz] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) ajouter(c, new THREE.CylinderGeometry(4, 5, 260, 6), fonce, pw.x + dx, 130, -1500 + dz);
    ajouter(c, new THREE.CylinderGeometry(70, 70, 100, 16), bois, pw.x, 310, -1500);
    ajouter(c, new THREE.ConeGeometry(80, 50, 16), fonce, pw.x, 385, -1500);
    // Les cactus.
    for (const [xe, z] of [[60, -400], [940, -500]]) {
      const p = auPoint(xe, SOL, z); const vert = std('#3a5a20');
      ajouter(c, new THREE.CylinderGeometry(14, 16, 160, 10), vert, p.x, 80, z);
      ajouter(c, new THREE.CylinderGeometry(10, 10, 60, 8), vert, p.x - 30, 110, z);
      ajouter(c, new THREE.CylinderGeometry(9, 9, 34, 8), vert, p.x - 18, 84, z, { rz: Math.PI / 2 });
    }
    c.exposition = 1.05;
  },
  renards(c) {
    // Le temple des renards, la nuit : une allée de torii qui s'enfonce, des renards de pierre, des lanternes de pierre, des feux follets.
    const { R } = c;
    ciel(c, ['#02040e', '#0a1028', '#1a1a40', '#2a2050'], { brouillard: [600, 3600] });
    lumiere(c, { ciel: '#7a9aff', sol: '#2a2a32', ambiance: 0.55, soleil: '#c8d8ff', force: 1.1, dir: [-0.3, 0.9, 0.3] });
    etoiles(c, 180, 300);
    astre(c, 820, 110, 34, '#eef4ff', 3);
    sol(c, TEX.dalles('#4a4a52', '#2a2a32', R), { rugosite: 0.6 });
    // L'allée de torii.
    const rouge = std('#c8102e', { roughness: 0.5 }); const noir = std('#1a0806');
    for (let i = 0; i < 12; i++) {
      const z = -500 - i * 260; const p = auPoint(500, SOL, z);
      const ht = 420; const ecart = 170;
      for (const s of [-1, 1]) ajouter(c, new THREE.CylinderGeometry(14, 16, ht, 12), rouge, p.x + s * ecart, ht / 2, z);
      ajouter(c, new THREE.BoxGeometry(ecart * 2 + 90, 20, 26), noir, p.x, ht + 10, z);
      ajouter(c, new THREE.BoxGeometry(ecart * 2 + 40, 16, 18), rouge, p.x, ht - 50, z);
    }
    // Les renards de pierre, sur leurs socles.
    for (const xe of [170, 830]) {
      const z = -350; const p = auPoint(xe, SOL, z); const pierre = std('#9a9aa2', { flatShading: true, roughness: 1 });
      ajouter(c, new THREE.BoxGeometry(80, 70, 80), std('#6a6a72'), p.x, 35, z);
      ajouter(c, new THREE.CapsuleGeometry(20, 40, 4, 8), pierre, p.x, 110, z);
      ajouter(c, new THREE.SphereGeometry(18, 10, 8), pierre, p.x, 165, z + 8);
      for (const s of [-1, 1]) ajouter(c, new THREE.ConeGeometry(7, 22, 6), pierre, p.x + s * 10, 188, z + 6);
      ajouter(c, new THREE.BoxGeometry(30, 10, 8), std('#c8102e'), p.x, 140, z + 24);
    }
    // Les lanternes de pierre, et les feux follets bleus.
    for (const xe of [60, 940]) { const p = auPoint(xe, SOL, -200); ajouter(c, new THREE.BoxGeometry(26, 80, 26), std('#7a7a82'), p.x, 40, -200); ajouter(c, new THREE.BoxGeometry(40, 26, 40), lueur('#ffb060', 0.9), p.x, 92, -200, { ombre: false }); lampe(c, '#ffb060', p.x, 100, -160, 1.4, 600); }
    for (let i = 0; i < 6; i++) { const p = auPoint(150 + R() * 700, 180 + R() * 160, -700 - R() * 900); ajouter(c, new THREE.SphereGeometry(10, 10, 8), lueur('#7ad8ff', 3), p.x, p.y, p.z, { ombre: false }); lampe(c, '#7ad8ff', p.x, p.y, p.z, 1.2, 500); }
    c.exposition = 1.15;
  },
  clairiere(c) {
    // La clairière de pleine lune : une lune immense, les sapins noirs, le rocher où l'on hurle, la brume.
    const { R } = c;
    ciel(c, ['#02030a', '#060a1a', '#0e1630', '#1a2444'], { brouillard: [600, 3800] });
    lumiere(c, { ciel: '#9ad0ff', sol: '#0e1a0e', ambiance: 0.6, soleil: '#dce8ff', force: 1.5, dir: [0, 0.6, -0.8] });
    etoiles(c, 220, 320);
    astre(c, 500, 190, 150, '#f4f8ff', 1.8);
    sol(c, TEX.herbe('#1a2a1a', '#24361e', R));
    for (let i = 0; i < 36; i++) { const x = R() * 2600 - 800; const z = -500 - R() * 2200; if (x > 280 && x < 720 && z < -1600) continue; sapin(c, x, z, 320 + R() * 260, '#06120c'); }
    // Le rocher qui avance, à droite, d'où l'on hurle à la lune.
    const pr = auPoint(760, SOL, -900);
    for (let i = 0; i < 4; i++) rocher(c, pr.x + i * 40, 40 + i * 50, -900 - i * 30, 110 - i * 18, '#1a2420');
    // La brume, au ras du sol.
    for (let i = 0; i < 10; i++) nuage(c, R() * 2400 - 700, 20 + R() * 40, -500 - R() * 1600, 220, '#9ab0d0', 0.25);
    c.exposition = 1.2;
  },
};

/** Une enseigne au néon : des lettres qui brillent, et la lumière qu'elles jettent. */
function enseigne(c, xe, ye, z, texte, couleur) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.font = '900 86px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const largeur = g.measureText(texte).width;
  if (largeur > 470) g.font = `900 ${Math.floor((86 * 470) / largeur)}px "Arial Black", sans-serif`;
  g.shadowColor = couleur; g.shadowBlur = 24; g.fillStyle = couleur; g.fillText(texte, 256, 64);
  g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.6; g.fillText(texte, 256, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const p = auPoint(xe, ye, z);
  const w = aEchelle(220, z);
  ajouter(c, new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }), p.x, p.y, z, { ombre: false });
  lampe(c, couleur, p.x, p.y, z + 80, 2.2, 900);
}

/** Un panneau peint (un mur tagué, un écran, une enseigne de bois) : une image dessinée, posée à la profondeur z. */
function panneau(c, xe, ye, z, w, h, dessin, lueurForce = 0) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.max(16, Math.round((512 * h) / w));
  dessin(cv.getContext('2d'), cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  if (lueurForce) { m.emissiveMap = t; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = lueurForce; }
  const p = auPoint(xe, ye, z);
  return ajouter(c, new THREE.PlaneGeometry(aEchelle(w, z), aEchelle(h, z)), m, p.x, p.y, z, { ombre: false });
}

/** Une grue de papier : le corps vu de profil, les deux ailes en travers. */
function grue3D(c, x, y, z, r, couleur, rot = 0) {
  const papier = std(couleur, { roughness: 0.7, side: THREE.DoubleSide });
  const corps = extrusion([[-r * 1.4, 0], [-r * 0.3, r * 0.25], [0, r * 1.1], [r * 0.3, r * 0.25], [r * 1.5, r * 0.7], [r * 0.4, -r * 0.1], [0, -r * 0.35]], 1.5);
  ajouter(c, corps, papier, x, y, z, { ry: rot, ombre: false });
  const ailes = extrusion([[-r * 0.5, 0], [0, r * 1.3], [r * 0.5, 0], [0, -r * 1.3]], 1.2);
  ajouter(c, ailes, papier, x, y + r * 0.2, z, { rx: Math.PI / 2, ry: rot, ombre: false });
}
