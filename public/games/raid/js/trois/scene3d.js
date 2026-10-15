/**
 * RAID — la cabane du Conteur : ce que partagent toutes les scènes 3D.
 *
 * On joue sur une vieille table de bois, à la lueur de deux bougies ; de
 * l'autre côté, dans le noir, le Conteur nous regarde — on ne voit que ses
 * yeux, et ses mains quand il pose ou retire une pièce. Pour les boss, il
 * met un masque sculpté.
 *
 * L'image passe par un filtre : rendue en basse résolution puis agrandie en
 * gros pixels, tramée, granuleuse, teintée chaud, la vignette lourde, les
 * couleurs qui se dédoublent un peu sur les bords. C'est elle qui donne
 * l'ambiance « vieille cassette » de la cabane.
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';

export { THREE };

/* ------------------------------------------------------------------ */
/* La qualité                                                          */
/* ------------------------------------------------------------------ */

const CLE_QUALITE = 'raid.graphismes';
/** 'haute' (ombres, plus de détails), 'moyenne' (plus léger), '2d' (l'affichage d'avant). */
export function qualite() {
  try { const q = localStorage.getItem(CLE_QUALITE); if (q === 'haute' || q === 'moyenne' || q === '2d') return q; } catch { /* rien */ }
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 'moyenne' : 'haute';
}
export function reglerQualite(q) { try { localStorage.setItem(CLE_QUALITE, q); } catch { /* rien */ } }

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

export function alea(graine) {
  let s = graine >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export const hacher = (texte) => { let h = 2166136261; for (const c of String(texte)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

export function texture(taille, dessin, l = taille) {
  const cv = document.createElement('canvas');
  cv.width = l; cv.height = taille;
  dessin(cv.getContext('2d'), l, taille);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Du bois : des planches, leurs veines, leurs nœuds. */
export function texBois(c1 = '#4a3020', c2 = '#3a2416', planches = 6) {
  const R = alea(77);
  return texture(512, (g, l, h) => {
    const ph = h / planches;
    for (let i = 0; i < planches; i++) {
      g.fillStyle = i % 2 ? c1 : c2; g.fillRect(0, i * ph, l, ph);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, i * ph); g.lineTo(l, i * ph); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.2;
      for (let k = 0; k < 9; k++) { const y = i * ph + 4 + R() * (ph - 8); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(l * 0.3, y + (R() - 0.5) * 8, l * 0.6, y + (R() - 0.5) * 8, l, y); g.stroke(); }
      if (R() < 0.7) { const x = R() * l, y = i * ph + ph / 2; g.fillStyle = 'rgba(20,10,4,0.45)'; g.beginPath(); g.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); g.fill(); }
    }
    for (let i = 0; i < 1800; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,220,180,0.05)'; g.fillRect(R() * l, R() * h, 1 + R() * 2, 1); }
  });
}

/** Une matière « bois peint » : mate, à facettes, comme une figurine taillée au couteau. */
const mats = new Map();
export function bois(couleur, o = {}) {
  const cle = `${couleur}|${o.lueur || 0}|${o.metal || 0}`;
  if (mats.has(cle)) return mats.get(cle);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(couleur), roughness: o.metal ? 0.45 : 0.82, metalness: o.metal || 0, flatShading: true });
  if (o.lueur) { m.emissive = new THREE.Color(couleur); m.emissiveIntensity = o.lueur; }
  m.__partage = true;
  mats.set(cle, m);
  return m;
}

/* ------------------------------------------------------------------ */
/* Le filtre : basse résolution, tramage, grain, vignette               */
/* ------------------------------------------------------------------ */

const FILTRE_V = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FILTRE_F = `
uniform sampler2D tex;
uniform vec2 res;
uniform float temps;
uniform float grain;
uniform float expo;
varying vec2 vUv;
float bayer(vec2 p) {
  vec2 q = mod(p, 4.0);
  int i = int(q.x) + int(q.y) * 4;
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0;
  return 0.0;
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d);
  float ab = 0.012 * r2;
  vec3 c = vec3(texture2D(tex, vUv + d * ab).r, texture2D(tex, vUv).g, texture2D(tex, vUv - d * ab).b);
  c = srgb(aces(c * expo));
  // Les teintes de la cabane : des lumières chaudes, des ombres qui tirent sur le vert.
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 0.85);
  c *= vec3(1.06, 1.0, 0.84);
  c += vec3(-0.004, 0.018, 0.006) * (1.0 - l);
  // La vignette, lourde.
  c *= mix(1.0, smoothstep(0.85, 0.2, length(d * vec2(1.0, 1.15))), 0.82);
  // Le grain, et le tramage par gros pixels.
  vec2 px = floor(vUv * res);
  float n = fract(sin(dot(px + floor(temps * 24.0) * vec2(7.13, 3.71), vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * grain;
  c = floor(c * 22.0 + bayer(px) - 0.5 + 0.5) / 22.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

/* ------------------------------------------------------------------ */
/* La scène                                                            */
/* ------------------------------------------------------------------ */

/**
 * Une scène de la cabane dans `hote` (un élément positionné) : la toile, la caméra,
 * la table, les bougies, le Conteur. Rend null si WebGL manque ou en qualité 2D.
 * o.table : { largeur, profondeur } ; o.bougies : [[x, z], …] ; o.conteur : { z, y, echelle } | false.
 */
export function creerScene(hote, o = {}) {
  const q = qualite();
  if (q === '2d') return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false }); } catch { return null; }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = q === 'haute';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cv = renderer.domElement;
  cv.className = 'scene3d';
  hote.prepend(cv);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030202');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 120);

  // Le rendu passe par une petite image, agrandie en gros pixels par le filtre.
  const cible = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, depthBuffer: true });
  const filtre = new THREE.ShaderMaterial({
    uniforms: { tex: { value: cible.texture }, res: { value: new THREE.Vector2(4, 4) }, temps: { value: 0 }, grain: { value: q === 'haute' ? 0.07 : 0.05 }, expo: { value: o.expo ?? 1.15 } },
    vertexShader: FILTRE_V, fragmentShader: FILTRE_F, depthTest: false, depthWrite: false,
  });
  const ecranQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), filtre);
  const sceneFiltre = new THREE.Scene(); sceneFiltre.add(ecranQuad);
  const camFiltre = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const HAUTEUR = q === 'haute' ? 380 : 300;

  // La lumière de la cabane : presque rien, sinon les bougies.
  scene.add(new THREE.HemisphereLight('#6a5a7a', '#120806', 0.32));

  // La table.
  if (o.table !== false) {
    const T = o.table || { largeur: 40, profondeur: 40, z: 0 };
    const tb = texBois('#3e2818', '#33200f', 8);
    tb.wrapS = tb.wrapT = THREE.RepeatWrapping; tb.repeat.set(T.largeur / 8, T.profondeur / 8);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(T.largeur, T.profondeur), new THREE.MeshStandardMaterial({ map: tb, roughness: 0.75 }));
    table.rotation.x = -Math.PI / 2; table.position.set(0, T.y ?? -0.02, T.z || 0); table.receiveShadow = true;
    scene.add(table);
  }

  // Les bougies : un pied de cire, la mèche, la flamme qui vacille, et sa lumière.
  const bougies = [];
  for (const [x, z, h = 1.1, y = 0] of o.bougies || []) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const cire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, h, 12), bois('#e8dcc0'));
    cire.position.y = h / 2; cire.castShadow = true;
    const coulure = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.05, 6, 14), bois('#efe4cc'));
    coulure.rotation.x = Math.PI / 2; coulure.position.y = h - 0.05;
    const soucoupe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 16), bois('#6a5a40', { metal: 0.5 }));
    soucoupe.position.y = 0.03;
    const flamme = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 8), new THREE.MeshBasicMaterial({ color: '#ffdf8a' }));
    flamme.position.y = h + 0.18;
    const coeur = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    coeur.position.y = h + 0.1;
    const lum = new THREE.PointLight('#ffb560', o.forceBougies ?? 22, 18, 1.5);
    lum.position.y = h + 0.4;
    lum.castShadow = q === 'haute' && bougies.length === 0;
    lum.shadow.mapSize.set(512, 512); lum.shadow.bias = -0.002;
    g.add(soucoupe, cire, coulure, flamme, coeur, lum);
    scene.add(g);
    bougies.push({ g, flamme, lum, base: lum.intensity, graine: bougies.length * 7.3 });
  }

  // Le Conteur, dans l'ombre derrière la table.
  const conteur = o.conteur === false ? null : creerConteur(o.conteur || {});
  if (conteur) scene.add(conteur.groupe);

  /* ---- La taille, et le cadrage ---- */
  let surDimension = null;
  function dimensionner() {
    const l = hote.clientWidth, h = hote.clientHeight;
    if (!l || !h) return false;
    renderer.setSize(l, h, false);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
    const ph = Math.min(HAUTEUR, h);
    const pl = Math.max(4, Math.round(ph * camera.aspect));
    cible.setSize(pl, ph);
    filtre.uniforms.res.value.set(pl, ph);
    surDimension?.();
    return true;
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (dimensionner()) rendre(); }) : null;
  ro?.observe(hote);

  /** Recule la caméra le long de `axe` (depuis `vise`) jusqu'à voir tous les `points`. */
  function cadrer(points, vise, axe, marges = { x: 0.9, bas: -0.86, haut: 0.9 }, dMin = 6, dMax = 60) {
    const v = new THREE.Vector3();
    const A = axe.clone().normalize();
    for (let d = dMin; d <= dMax; d += 0.25) {
      camera.position.copy(vise).addScaledVector(A, d);
      camera.lookAt(vise);
      camera.updateMatrixWorld();
      if (points.every((p) => { v.copy(p).project(camera); return Math.abs(v.x) < marges.x && v.y > marges.bas && v.y < marges.haut; })) break;
    }
    return camera.position.distanceTo(vise);
  }

  /* ---- Le rendu, et l'animation ---- */
  let horloge = 0;
  const animateurs = new Set();
  function rendre() {
    renderer.setRenderTarget(cible);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    filtre.uniforms.temps.value = horloge;
    renderer.render(sceneFiltre, camFiltre);
  }
  let raf = 0;
  let dernier = performance.now();
  // Visible : affichée (getClientRects marche aussi pour un élément en position fixe), onglet au premier plan.
  const visible = () => hote.isConnected && hote.getClientRects().length > 0 && !document.hidden;
  function boucle(maintenant) {
    raf = 0;
    if (!visible()) return;
    const dt = Math.min(0.05, (maintenant - dernier) / 1000);
    dernier = maintenant;
    horloge += dt;
    for (const b of bougies) {
      const v = 0.86 + 0.14 * Math.sin(horloge * 11 + b.graine) * Math.sin(horloge * 6.3 + b.graine * 2);
      b.lum.intensity = b.base * v;
      b.flamme.scale.set(1, 0.9 + 0.2 * v, 1);
      b.flamme.rotation.z = Math.sin(horloge * 5 + b.graine) * 0.1;
    }
    conteur?.animer(horloge, dt);
    for (const f of animateurs) f(dt, horloge);
    rendre();
    raf = requestAnimationFrame(boucle);
  }
  function relancer() { if (!raf && visible()) { dernier = performance.now(); raf = requestAnimationFrame(boucle); } }
  document.addEventListener('visibilitychange', relancer);

  return {
    THREE, scene, camera, renderer, toile: cv, qualite: q, conteur, bougies,
    dimensionner, cadrer, rendre, relancer,
    /** Une fonction appelée à chaque image : (dt, horloge). */
    animer(f) { animateurs.add(f); return () => animateurs.delete(f); },
    surDimension(f) { surDimension = f; },
    /** Libère tout (la toile, le contexte WebGL) : pour les scènes qu'on ne garde pas. */
    detruire() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      document.removeEventListener('visibilitychange', relancer);
      scene.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) [].concat(x.material).forEach((m) => { if (!m.__partage) { m.map?.dispose(); m.dispose(); } }); });
      cible.dispose(); filtre.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      cv.remove();
    },
    /** Un point de l'écran (pixels dans l'hôte) → le point du plan horizontal y = h. */
    versTable(x, y, h = 0) {
      const v = new THREE.Vector3((x / hote.clientWidth) * 2 - 1, -(y / hote.clientHeight) * 2 + 1, 0.5).unproject(camera);
      const dir = v.sub(camera.position).normalize();
      const t = (h - camera.position.y) / dir.y;
      return camera.position.clone().addScaledVector(dir, t);
    },
    /** Un point du monde → l'écran (pixels dans l'hôte). */
    versEcran(p) {
      const v = p.clone().project(camera);
      return { x: ((v.x + 1) / 2) * hote.clientWidth, y: ((1 - v.y) / 2) * hote.clientHeight };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Le Conteur                                                          */
/* ------------------------------------------------------------------ */

/**
 * Le Conteur : une grande silhouette encapuchonnée, noire sur le noir, deux
 * yeux pâles qui clignent ; ses mains taillées reposent au bord de la table.
 * `masque(id)` lui met le masque d'un boss (ou l'enlève avec null).
 */
function creerConteur({ z: z0 = -14, y: y0 = 0, echelle = 1, x = 0, mains: posMains = null } = {}) {
  let z = z0, y = y0;
  const groupe = new THREE.Group();
  groupe.position.set(x, y, z);
  groupe.scale.setScalar(echelle);
  const noir = new THREE.MeshStandardMaterial({ color: '#1a1412', roughness: 1, flatShading: true });
  const manteau = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [5.2, 0], [4.6, 2.5], [3.6, 5.2], [2.4, 6.6], [1.6, 7.4], [0, 7.6]].map(([a, b]) => new THREE.Vector2(a, b)), 9), noir);
  const capuche = new THREE.Mesh(new THREE.SphereGeometry(1.9, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.62), noir);
  capuche.position.set(0, 8.2, 0.2); capuche.scale.set(1, 1.15, 1);
  const visage = new THREE.Mesh(new THREE.SphereGeometry(1.35, 9, 7), new THREE.MeshStandardMaterial({ color: '#000000', roughness: 1 }));
  visage.position.set(0, 7.9, 0.75);
  const yeux = [-1, 1].map((s) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#f0e8c0', fog: false }));
    o.position.set(s * 0.5, 8.0, 1.95); o.scale.set(1.2, 0.7, 0.5);
    return o;
  });
  const lueur = new THREE.PointLight('#f0e8c0', 2.5, 6, 2);
  lueur.position.set(0, 8, 3);
  // Une lumière froide, derrière lui : sa silhouette se détache à peine du noir.
  const contre = new THREE.PointLight('#5a6a9a', 40, 26, 1.4);
  contre.position.set(0, 12, -5);
  groupe.add(manteau, capuche, visage, ...yeux, lueur, contre);

  // Les mains : une paume taillée, quatre doigts, un pouce.
  const peau = new THREE.MeshStandardMaterial({ color: '#2a1e18', roughness: 0.9, flatShading: true });
  const main = (s) => {
    const m = new THREE.Group();
    const paume = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 1.0), peau);
    m.add(paume);
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.18, 0.75), peau); d.position.set(-0.32 + i * 0.21, -0.04, 0.82); d.rotation.x = 0.35; m.add(d); }
    const pouce = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.55), peau);
    pouce.position.set(s * 0.55, 0, 0.35); pouce.rotation.y = s * 0.7; m.add(pouce);
    const bras = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 3, 7), noir);
    bras.rotation.x = Math.PI / 2.4; bras.position.set(0, 0.55, -1.6); m.add(bras);
    // Au repos, posées sur le bord de la table (positions données dans le monde, si on les a).
    m.userData.cote = s;
    m.userData.repos = posMains
      ? new THREE.Vector3((s * posMains.ecart - x) / echelle, (posMains.y + 0.15 - y) / echelle, (posMains.z - z) / echelle)
      : new THREE.Vector3(s * 3.4, 0.35, 3.2);
    m.scale.setScalar(posMains ? 1 / echelle * 1.6 : 1);
    m.position.copy(m.userData.repos);
    m.rotation.y = -s * 0.25;
    m.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    return m;
  };
  const mains = [main(-1), main(1)];
  groupe.add(...mains);

  let masque = null;
  let geste = null;
  return {
    groupe, mains,
    /** L'éclat de ses yeux (il s'allume quand il parle). */
    lueur(v) { lueur.intensity = v; for (const o of yeux) o.material.color.setScalar(Math.min(1.6, 0.85 + v / 12)); },
    /** Où sont ses yeux, dans le monde, s'il se tenait à (y, z). */
    yeux: (yy = y, zz = z) => new THREE.Vector3(x, yy + 8 * echelle, zz + 1.95 * echelle),
    /** Il se déplace (sa base) ; ses mains restent posées au même endroit de la table. */
    deplacer(ny, nz, mainsMonde = posMains) {
      y = ny; z = nz;
      if (mainsMonde) for (const m of mains) m.userData.repos.set((m.userData.cote * mainsMonde.ecart - x) / echelle, (mainsMonde.y + 0.15 - y) / echelle, (mainsMonde.z - z) / echelle);
    },
    masque(id) {
      if (masque) { groupe.remove(masque); masque = null; }
      if (!id) return;
      masque = MASQUES[id] ? MASQUES[id]() : MASQUES.defaut();
      masque.position.set(0, 7.9, 1.75);
      groupe.add(masque);
    },
    /**
     * Un geste : la main va chercher un point du monde (Vector3), le prend, et l'emporte.
     * `prendre(objet)` est appelé quand elle le touche.
     */
    geste(cote, point, prendre) { geste = { main: mains[cote > 0 ? 1 : 0], point, prendre, t: 0, pris: false }; },
    animer(t, dt) {
      // Il respire, ses yeux clignent de temps en temps.
      groupe.position.set(x, y + Math.sin(t * 0.8) * 0.05, z);
      const cligne = (t % 5.3) < 0.12 ? 0.1 : 1;
      for (const o of yeux) o.scale.y = 0.7 * cligne;
      lueur.intensity = 2.5 * cligne;
      if (masque) masque.rotation.z = Math.sin(t * 0.7) * 0.04;
      for (const m of mains) if (!geste || geste.main !== m) { m.position.lerp(m.userData.repos, Math.min(1, dt * 3)); m.position.y = m.userData.repos.y + Math.sin(t * 1.3 + m.userData.repos.x) * 0.04; }
      if (geste) {
        geste.t += dt;
        const m = geste.main;
        const local = groupe.worldToLocal(geste.point.clone());
        local.y += 0.6;
        if (geste.t < 0.7) m.position.lerp(local, Math.min(1, dt * 7));
        else if (!geste.pris) { geste.pris = true; geste.prendre?.(); }
        else if (geste.t < 1.6) m.position.lerp(new THREE.Vector3(m.userData.repos.x, 3, -1), Math.min(1, dt * 4));
        else geste = null;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Les masques des boss                                                */
/* ------------------------------------------------------------------ */

/** Un masque : un ovale de bois peint, ses trous d'yeux, ses ornements. Chaque boss a le sien. */
function baseMasque(couleur, peinture) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), bois(couleur));
  face.rotation.x = Math.PI / 2; face.scale.set(1, 0.55, 1.25);
  g.add(face);
  for (const s of [-1, 1]) {
    const trou = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#000000' }));
    trou.position.set(s * 0.45, 0.15, 0.6); trou.scale.set(1.3, 0.8, 0.4);
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: '#f0e8c0' }));
    oeil.position.set(s * 0.45, 0.15, 0.66);
    g.add(trou, oeil);
  }
  if (peinture) for (const [x, yy, w, h, c] of peinture) { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), bois(c)); p.position.set(x, yy, 0.66); g.add(p); }
  return g;
}
const corne = (c, s, l = 1.2, x = 0.7, yy = 0.9) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.16, l, 6), bois(c)); m.position.set(s * x, yy, 0); m.rotation.z = -s * 0.5; return m; };
const MASQUES = {
  defaut: () => baseMasque('#c8b090'),
  // La Reine Noyée : vert d'eau, des algues qui pendent.
  morvase: () => { const g = baseMasque('#5a8a7a', [[0, -0.5, 0.1, 0.5, '#2a4a40']]); for (let i = 0; i < 5; i++) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 5), bois('#3a6a4a')); a.position.set(-0.6 + i * 0.3, -0.9, 0.3); a.rotation.x = Math.PI; g.add(a); } return g; },
  // Le Boucher du Cloître : un heaume de fer, une bande rouge.
  vorgath: () => { const g = baseMasque('#6a6a70', [[0, 0.15, 1.6, 0.12, '#1a1a1e'], [0, -0.45, 0.14, 0.7, '#8a1a1a']]); g.add(corne('#4a4a50', -1), corne('#4a4a50', 1)); return g; },
  // Le Titan de la Forge : du métal rouge, des braises.
  kharn: () => { const g = baseMasque('#8a3a1a', [[0, -0.45, 0.9, 0.12, '#ffa040']]); g.add(corne('#2a1a10', -1, 1.4), corne('#2a1a10', 1, 1.4)); return g; },
  // La Reine Gelée : blanc bleuté, une couronne de glace.
  ysolde: () => { const g = baseMasque('#d8eef8', [[0, 0.5, 0.9, 0.06, '#5ed0ff']]); for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5 + (i === 2 ? 0.4 : 0), 5), bois('#aee6ff', { lueur: 0.3 })); c.position.set(-0.6 + i * 0.3, 1.1, 0); g.add(c); } return g; },
  // Le Dragon Cendré : un museau, deux grandes cornes.
  sarkhavel: () => { const g = baseMasque('#4a3a32', [[0, -0.3, 0.5, 0.4, '#2a201c']]); const museau = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.9), bois('#4a3a32')); museau.position.set(0, -0.45, 0.8); g.add(museau, corne('#c8b090', -1, 1.8, 0.8, 1), corne('#c8b090', 1, 1.8, 0.8, 1)); return g; },
  // Le Cœur des Racines : du bois brut, des branches.
  yggmar: () => { const g = baseMasque('#6a4a2a', [[0, -0.3, 0.1, 0.9, '#3a2a14']]); for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 1.6, 5), bois('#4a3018')); b.position.set(s * 0.9, 1.1, 0); b.rotation.z = -s * 0.6; g.add(b); } return g; },
  // Le Scribe de la Nécropole : un crâne pâle, des runes.
  nelizar: () => baseMasque('#e8e0c8', [[0, -0.5, 0.8, 0.08, '#2a2a2a'], [0, -0.7, 0.6, 0.06, '#2a2a2a'], [0, 0.6, 0.2, 0.2, '#3ddc84']]),
  // L'Ange de la Citadelle : de l'or, des ailes.
  seraphiel: () => { const g = baseMasque('#f0d890', [[0, 0.55, 0.1, 0.4, '#fff0b0']]); for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.06), bois('#fff6e0')); a.position.set(s * 1.4, 0.4, -0.1); a.rotation.z = s * 0.4; g.add(a); } return g; },
  // L'Œil du Néant : un seul grand œil.
  ozrath: () => { const g = baseMasque('#2a2a4a'); const o = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), bois('#c8c0ff', { lueur: 0.6 })); o.position.set(0, 0.1, 0.55); g.add(o); return g; },
  // Le Roi Sans Aube : noir et or, une couronne.
  azhar: () => { const g = baseMasque('#1a1418', [[0, -0.35, 0.9, 0.08, '#ffd45e']]); for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 4), bois('#ffd45e', { metal: 0.6 })); c.position.set(-0.6 + i * 0.3, 1.05, 0); g.add(c); } return g; },
};
