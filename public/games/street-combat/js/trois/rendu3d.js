/**
 * STREET COMBAT — les combattants en 3D.
 *
 * Chaque combattant est un modèle 3D construit par le code (Three.js) à
 * partir de sa fiche : sa carrure, ses couleurs, sa coiffure, ses
 * accessoires. Il prend les poses du squelette 2D (dessin.js → squelette) :
 * les articulations sont les mêmes, à la même place ; la 3D ajoute les
 * volumes, la lumière et la profondeur (les membres de devant plus près, le
 * buste et la tête tournés vers nous).
 *
 * Le modèle est rendu dans une petite image, collée à sa place dans le
 * dessin 2D : tout le jeu (combats, cinématiques, menus, portraits) passe
 * ainsi en 3D sans rien changer ailleurs. Les effets (auras, éclats,
 * projectiles…) restent dessinés par-dessus.
 *
 * Le style : un anime en cel-shading. Des ombres franches en trois tons, un
 * contour encré (une coque inversée, gonflée le long des normales), un
 * contre-jour de la couleur du combattant, et des visages dessinés (une
 * texture par expression : neutre, colère, douleur, K.O., joie).
 *
 * Coordonnées : celles du combattant (x vers l'avant, y vers le bas), avec
 * Y retourné pour la 3D, et Z vers nous.
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';
import { SEGMENTS, teinte, manche, gant } from '../dessin.js';

const rad = (d) => (d * Math.PI) / 180;
/** La qualité choisie dans le menu (haute, moyenne, basse ; « 2d » : sans 3D). Par défaut : moyenne sur un téléphone. */
const QUALITE = (() => { try { const q = JSON.parse(localStorage.getItem('street.graphismes')); if (q) return q; } catch { /* rien */ } return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 'moyenne' : 'haute'; })();
/** La finesse maximale (pixels par unité) et le contour, selon la qualité. */
const FINESSE = { haute: 99, moyenne: 1.7, basse: 1.15 }[QUALITE] || 99;
const TRAIT = QUALITE !== 'basse';

/** Le cadre de l'image, en unités du combattant : assez large pour les ailes, les capes et les armes. */
const CADRE = { x0: -160, x1: 160, y0: -290, y1: 40 };
const CW = CADRE.x1 - CADRE.x0;
const CH = CADRE.y1 - CADRE.y0;
/** La toile de rendu (on ne dessine que dans un coin, à la taille voulue). */
const TOILE = { l: 1024, h: 1056 };

/* ------------------------------------------------------------------ */
/* Le démarrage                                                        */
/* ------------------------------------------------------------------ */

export function creerRendu3D() {
  let renderer;
  try {
    const cv = document.createElement('canvas');
    cv.width = TOILE.l; cv.height = TOILE.h;
    renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  } catch { return null; }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(1);
  renderer.setSize(TOILE.l, TOILE.h, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  // La lumière d'un anime : un ciel presque blanc, des ombres teintées de violet, une seule lumière
  // principale en haut à gauche (le cel-shading la découpe en trois tons) ; le contre-jour est dans les matières.
  const hemi = new THREE.HemisphereLight(0xfff6ee, 0x7a68b0, 1.35);
  scene.add(hemi);
  const cle = new THREE.DirectionalLight(0xfff2e2, 2.6);
  cle.position.set(-480, 420, 260);
  scene.add(cle);

  // La caméra : face au plan du combat, assez loin pour que la perspective reste douce.
  const fov = 22;
  const D = (CH / 2) / Math.tan(rad(fov / 2));
  const camera = new THREE.PerspectiveCamera(fov, CW / CH, D - 400, D + 400);
  camera.position.set((CADRE.x0 + CADRE.x1) / 2, -(CADRE.y0 + CADRE.y1) / 2, D);
  camera.lookAt((CADRE.x0 + CADRE.x1) / 2, -(CADRE.y0 + CADRE.y1) / 2, 0);

  const modeles = new Map();
  let courant = null;
  let ambiance = null;

  return {
    renderer,
    /** Les combattants prennent un peu la lumière de l'arène (sans perdre leurs couleurs). */
    ambiance(a) {
      if (a === ambiance) return;
      ambiance = a;
      const m = (base, c, k) => new THREE.Color(base).lerp(new THREE.Color(c || base), a ? k : 0);
      hemi.color.copy(m('#fff6ee', a?.ciel, 0.3));
      hemi.groundColor.copy(m('#7a68b0', a?.sol, 0.35));
      cle.color.copy(m('#fff2e2', a?.soleil, 0.4));
    },
    /** Dessine le combattant dans `g`, dont le repère est déjà celui du combattant (et son échelle). */
    dessiner(g, perso, sq, o) {
      const cle3d = cleDe(perso);
      let m = modeles.get(cle3d);
      if (!m) {
        m = construire(perso);
        if (TRAIT) encrer(m.groupe);
        modeles.set(cle3d, m);
        if (modeles.size > 60) { const [a] = modeles.keys(); disposer(modeles.get(a)); modeles.delete(a); }
      }
      if (courant !== m.groupe) {
        if (courant) scene.remove(courant);
        scene.add(m.groupe);
        courant = m.groupe;
      }
      poser(m, sq, o);
      // La finesse : autant de pixels que la toile 2D en affiche.
      const tr = g.getTransform();
      const s = Math.sqrt(Math.abs(tr.a * tr.d - tr.b * tr.c)) || 1;
      const k = Math.min(TOILE.l / CW, TOILE.h / CH, FINESSE, Math.max(0.6, s * 1.05));
      const vw = Math.max(16, Math.round(CW * k));
      const vh = Math.max(16, Math.round(CH * k));
      // Le trait : un peu plus épais quand le combattant est petit, pour rester lisible.
      UNI.ep.value = Math.min(2.2, 0.95 + 1.25 / s) * (o.trait ?? 1);
      UNI.rim.value.set(perso.c.aura || perso.c.c1);
      renderer.setScissorTest(true);
      renderer.setViewport(0, TOILE.h - vh, vw, vh);
      renderer.setScissor(0, TOILE.h - vh, vw, vh);
      renderer.clear();
      renderer.render(scene, camera);
      g.drawImage(renderer.domElement, 0, 0, vw, vh, CADRE.x0, CADRE.y0, CW, CH);
    },
  };
}

const cleDe = (p) => p.__cle3d || (p.__cle3d = JSON.stringify([p.id, p.c, p.look, p.figurant ? 1 : 0]));

function disposer(m) {
  m.groupe.traverse((x) => { if (x.geometry && !x.geometry.__partage) x.geometry.dispose(); });
}

/* ------------------------------------------------------------------ */
/* Les briques                                                         */
/* ------------------------------------------------------------------ */

const geos = {};
const partage = (g) => { g.__partage = true; return g; };
const GEO = {
  sphere: () => geos.sphere || (geos.sphere = partage(new THREE.SphereGeometry(1, 28, 20))),
  cylindre: () => geos.cylindre || (geos.cylindre = partage(new THREE.CylinderGeometry(1, 1, 1, 22, 1, true))),
  cone: () => geos.cone || (geos.cone = partage(new THREE.ConeGeometry(1, 1, 18))),
  boite: () => geos.boite || (geos.boite = partage(new THREE.BoxGeometry(1, 1, 1))),
  tore: () => geos.tore || (geos.tore = partage(new THREE.TorusGeometry(1, 0.18, 10, 36))),
  octa: () => geos.octa || (geos.octa = partage(new THREE.OctahedronGeometry(1, 0))),
  dode: () => geos.dode || (geos.dode = partage(new THREE.DodecahedronGeometry(1, 0))),
};

/* Le cel-shading : une rampe de trois tons (ombre, demi-teinte, lumière), un contre-jour
   de la couleur du combattant sur les bords, un reflet net sur ce qui brille. */
const UNI = { rim: { value: new THREE.Color('#9ab8ff') }, ep: { value: 1.4 } };
function rampe(valeurs) {
  const d = new Uint8Array(valeurs.flatMap((v) => { const x = Math.round(Math.min(1, v) * 255); return [x, x, x, 255]; }));
  const t = new THREE.DataTexture(d, valeurs.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const RAMPES = { doux: rampe([0.3, 0.3, 0.66, 1, 1]), metal: rampe([0.1, 0.1, 0.46, 0.82, 1]) };

/** Une matière toon : `reflet` (0 à 0,1) la taille du reflet, `rim` la force du contre-jour. */
function toon(params, { reflet = 0, rim = 1, metal = false } = {}) {
  const m = new THREE.MeshToonMaterial({ gradientMap: metal ? RAMPES.metal : RAMPES.doux, ...params });
  const specul = reflet ? `#if NUM_DIR_LIGHTS > 0
        float sp = dot(normal, normalize(directionalLights[0].direction + geometryViewDir));
        outgoingLight += vec3(1.0, 0.98, 0.94) * smoothstep(${(1 - reflet).toFixed(3)}, ${(1 - reflet + 0.012).toFixed(3)}, sp) * 0.85;
        #endif` : '';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = UNI.rim;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <opaque_fragment>', `{
        float fr = 1.0 - max(dot(normal, geometryViewDir), 0.0);
        float bord = smoothstep(0.56, 0.64, fr) * smoothstep(-0.1, 0.35, dot(normal, normalize(vec3(1.0, 0.45, -0.1))));
        outgoingLight = mix(outgoingLight, uRim * 1.15 + outgoingLight * 0.35, bord * ${(0.75 * rim).toFixed(2)});
        ${specul}
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `toon|${reflet}|${rim}|${metal}`;
  m.userData.toon = true;
  return m;
}

const mats = new Map();
/** Une matière : du tissu, de la peau, du métal, ou une lueur. */
function mat(couleur, sorte = 'tissu') {
  const cle = `${couleur}|${sorte}`;
  if (mats.has(cle)) return mats.get(cle);
  const c = new THREE.Color(couleur);
  // Un tissu presque noir garde un peu de relief : on l'éclaircit vers une ardoise (comme le noir dans un anime).
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (lum < 0.035 && sorte !== 'lueur' && sorte !== 'voile-lueur') c.lerp(new THREE.Color('#4a4058'), 0.4 * (1 - lum / 0.035));
  let m;
  if (sorte === 'metal') m = toon({ color: c }, { reflet: 0.07, metal: true, rim: 1.2 });
  else if (sorte === 'brillant') m = toon({ color: c }, { reflet: 0.035 });
  else if (sorte === 'peau') m = toon({ color: c }, { rim: 0.8 });
  else if (sorte === 'lueur') m = new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color('#ffffff'), 0.25) });
  else if (sorte === 'verre') m = toon({ color: c, transparent: true, opacity: 0.8 }, { reflet: 0.06 });
  else if (sorte === 'voile') m = toon({ color: c, side: THREE.DoubleSide });
  else if (sorte === 'voile-lueur') m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  else m = toon({ color: c });
  mats.set(cle, m);
  return m;
}

/* Le contour encré : la même forme, gonflée le long de ses normales, vue de dos, d'une couleur
   très sombre tirée de la matière (un trait brun sur la peau, bleu nuit sur le bleu…). */
const ENCRE_V = `uniform float uEp;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  mv.xyz += n * uEp;
  gl_Position = projectionMatrix * mv;
}`;
const ENCRE_F = `uniform vec3 uC;
void main() {
  gl_FragColor = vec4(uC, 1.0);
  #include <colorspace_fragment>
}`;
const encres = new Map();
const NUIT = new THREE.Color('#140812');
function encre(couleur) {
  const cle = couleur.getHexString();
  if (!encres.has(cle)) {
    const c = couleur.clone().multiplyScalar(0.16).lerp(NUIT, 0.55);
    encres.set(cle, new THREE.ShaderMaterial({ uniforms: { uEp: UNI.ep, uC: { value: c } }, vertexShader: ENCRE_V, fragmentShader: ENCRE_F, side: THREE.BackSide }));
  }
  return encres.get(cle);
}
/** Ajoute le contour à tout ce qui est opaque (pas aux lueurs ni au verre). */
function encrer(groupe) {
  const a = [];
  groupe.traverse((x) => { if (x.isMesh && x.material?.userData?.toon && !x.material.transparent && !x.userData.sansTrait) a.push(x); });
  for (const x of a) {
    const c = new THREE.Mesh(x.geometry, encre(x.material.userData.encre || x.material.color));
    c.userData.trait = true;
    x.add(c);
  }
}

function maille(geo, matiere, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, matiere);
  m.scale.set(sx, sy, sz);
  return m;
}
const boule = (r, matiere, sy = r, sz = r) => maille(GEO.sphere(), matiere, r, sy, sz);

/** Un segment entre deux points (un membre, un bâton) : un cylindre et deux bouts arrondis. */
function segment(rayon, matiere, rayon2 = rayon) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rayon2, rayon, 1, 22, 1, true), matiere);
  const a = boule(rayon, matiere);
  const b = boule(rayon2, matiere);
  g.add(c, a, b);
  g.userData = { c, a, b };
  return g;
}
const Y = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
/** Place un segment de `a` à `b` (des Vector3). */
function placer(seg, a, b) {
  const { c, a: ba, b: bb } = seg.userData;
  tmp.subVectors(b, a);
  const l = Math.max(0.001, tmp.length());
  c.position.copy(a).addScaledVector(tmp, 0.5);
  c.quaternion.setFromUnitVectors(Y, tmp.normalize());
  c.scale.set(1, l, 1);
  ba.position.copy(a);
  bb.position.copy(b);
}

/** Une forme plate (un profil 2D) extrudée : capes, ailes, lames. */
function plaque(points, epaisseur, matiere) {
  const forme = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: epaisseur > 1.2, bevelSize: Math.min(1.2, epaisseur / 3), bevelThickness: Math.min(1.2, epaisseur / 3), bevelSegments: 2, curveSegments: 10 });
  geo.translate(0, 0, -epaisseur / 2);
  return new THREE.Mesh(geo, matiere);
}


/* ------------------------------------------------------------------ */
/* Les formes sculptées : le tronc, la tête, le poing                   */
/* ------------------------------------------------------------------ */

/** Une texture dessinée au canevas (le visage, le kimono). */
function texture(l, h, dessin) {
  const cv = document.createElement('canvas');
  cv.width = l; cv.height = h;
  dessin(cv.getContext('2d'), l, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Le tronc : un profil tourné (taille, côtes, poitrine, épaules), l'avant (+Z) au milieu de la texture. */
function geoTronc(largeur, taille) {
  const pts = [[taille * 1.03, -5], [taille * 0.97, 3], [taille * 1.0, 11], [largeur * 0.78, 24], [largeur * 0.95, 35], [largeur * 0.98, 42], [largeur * 0.86, 48], [largeur * 0.56, 52.5], [largeur * 0.22, 55], [0.01, 55.6]];
  const courbe = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.LatheGeometry(courbe.getPoints(36), 40, Math.PI, Math.PI * 2);
  // La texture suit la hauteur (pas la longueur du profil) : plus simple à dessiner.
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) + 5) / 60.6);
  return geo;
}
/** Hauteur du tronc → ligne de la texture (h = sa hauteur en pixels). */
const ligneTronc = (y, h) => (1 - (y + 5) / 60.6) * h;

/** Le dessus du corps : le kimono et son col en V, un torse nu dessiné, ou la tenue unie. */
function matTorse(perso, nu, kimono) {
  const k = perso.c;
  const fond = nu ? k.peau : k.tenue;
  const tex = texture(512, 256, (g, l, h) => {
    g.fillStyle = fond; g.fillRect(0, 0, l, h);
    const mx = l / 2;
    if (kimono && !nu) {
      // Le col en V, la peau dedans, les revers du kimono autour.
      const haut = ligneTronc(50, h), pointe = ligneTronc(21, h);
      g.fillStyle = k.peau;
      g.beginPath(); g.moveTo(mx - 70, 0); g.lineTo(mx + 70, 0); g.lineTo(mx + 44, haut); g.lineTo(mx, pointe); g.lineTo(mx - 44, haut); g.closePath(); g.fill();
      // Les pectoraux qu'on devine dans l'ouverture.
      g.strokeStyle = teinte(k.peau, -0.22); g.lineWidth = 3;
      g.beginPath(); g.moveTo(mx - 30, ligneTronc(38, h)); g.quadraticCurveTo(mx - 12, ligneTronc(35, h), mx - 2, ligneTronc(37, h)); g.stroke();
      g.beginPath(); g.moveTo(mx + 30, ligneTronc(38, h)); g.quadraticCurveTo(mx + 12, ligneTronc(35, h), mx + 2, ligneTronc(37, h)); g.stroke();
      for (const c of [-1, 1]) {
        g.strokeStyle = teinte(k.tenue, -0.1); g.lineWidth = 16;
        g.beginPath(); g.moveTo(mx + c * 78, -4); g.lineTo(mx + c * 52, haut); g.lineTo(mx + c * 4, pointe + 6); g.stroke();
        g.strokeStyle = teinte(k.tenue, -0.32); g.lineWidth = 3;
        g.beginPath(); g.moveTo(mx + c * 70, -4); g.lineTo(mx + c * 44, haut); g.lineTo(mx, pointe); g.stroke();
      }
      // Quelques plis à la taille.
      g.strokeStyle = teinte(k.tenue, -0.14); g.lineWidth = 2.5;
      for (const [x, y, dx, dy] of [[-60, 40, 18, -26], [70, 38, -14, -22], [-20, 30, 6, -18], [30, 34, -4, -16]]) {
        g.beginPath(); g.moveTo(mx + x, ligneTronc(y - 30, h)); g.quadraticCurveTo(mx + x + dx * 0.3, ligneTronc(y - 30 - dy * 0.5, h), mx + x + dx, ligneTronc(y - 30 - dy, h)); g.stroke();
      }
    } else if (nu) {
      // Un torse nu : pectoraux, abdominaux, nombril.
      g.strokeStyle = teinte(k.peau, -0.26); g.lineWidth = 3.4; g.lineCap = 'round';
      for (const c of [-1, 1]) {
        g.beginPath(); g.moveTo(mx + c * 74, ligneTronc(40, h)); g.quadraticCurveTo(mx + c * 34, ligneTronc(31, h), mx + c * 3, ligneTronc(35, h)); g.stroke();
      }
      g.beginPath(); g.moveTo(mx, ligneTronc(44, h)); g.lineTo(mx, ligneTronc(6, h)); g.stroke();
      for (const y of [28, 20, 12]) for (const c of [-1, 1]) { g.beginPath(); g.moveTo(mx + c * 4, ligneTronc(y, h)); g.quadraticCurveTo(mx + c * 16, ligneTronc(y + 1.2, h), mx + c * 24, ligneTronc(y - 0.5, h)); g.stroke(); }
      g.fillStyle = teinte(k.peau, -0.32); g.beginPath(); g.ellipse(mx, ligneTronc(3, h), 3, 4.5, 0, 0, Math.PI * 2); g.fill();
    } else {
      // Une tenue : deux coutures sur les côtés, un col.
      g.strokeStyle = teinte(fond, -0.2); g.lineWidth = 3;
      for (const x of [l * 0.25, l * 0.75]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.lineWidth = 8; g.strokeStyle = teinte(fond, -0.12);
      g.beginPath(); g.moveTo(mx - 50, 2); g.quadraticCurveTo(mx, ligneTronc(48, h), mx + 50, 2); g.stroke();
    }
  });
  const m = toon({ map: tex, color: 0xffffff }, { rim: nu ? 0.8 : 1 });
  m.userData.encre = new THREE.Color(fond);
  return m;
}

/** La tête d'un anime : un crâne rond, une mâchoire qui s'affine vers un menton net. Le visage regarde +X. */
GEO.tete = () => {
  if (geos.tete) return geos.tete;
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) {
      const b = -y;
      z *= 1 - 0.36 * b * b;
      x *= x < 0 ? 1 - 0.3 * b * b : 1 - 0.06 * b;
      if (x > 0) x += 0.1 * b * b * x;
      y *= 1 + 0.12 * b;
    } else if (x < 0) x *= 1 + 0.06 * y;   // un crâne un peu plus long derrière
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return (geos.tete = partage(geo));
};

/* Le visage, dessiné sur la texture de la tête (1024 × 512 : un degré vaut 2,84 pixels).
   a : l'angle autour de la tête (+ vers le côté le plus proche de nous), b : la hauteur (+ vers le haut). */
const FACE = { l: 1024, h: 512 };
const PF = (a, b) => [(0.5 - a / 360) * FACE.l, (0.5 - b / 180) * FACE.h];

/** L'expression d'une pose. */
function expression(nomPose) {
  if (nomPose === 'ko' || nomPose === 'sol') return 'ko';
  if (nomPose === 'touche' || nomPose === 'vol') return 'douleur';
  if (nomPose.startsWith('v-')) return 'joie';
  if (['poing', 'pied', 'poing-bas', 'balayage', 'poing-air', 'pied-air', 'saisie', 'lance', 'ruee', 'uppercut', 'tourne', 'ulti'].includes(nomPose)) return 'colere';
  return 'neutre';
}

/**
 * La texture du visage pour une expression.
 * @param {object} o  { yeux: dessiner les yeux (false : des yeux qui brillent, en 3D), seulLoin : seulement l'œil du fond }
 */
function texVisage(perso, expr, o) {
  const k = perso.c;
  const X = perso.look.extras;
  const feminin = ['couettes', 'chignon', 'longs', 'oreilles-renard'].includes(perso.look.tete) || X.includes('robe') || X.includes('jupe');
  const encreC = '#1c0e10';
  const iris = k.yeux || '#5a3420';
  return texture(FACE.l, FACE.h, (g) => {
    g.fillStyle = k.peau; g.fillRect(0, 0, FACE.l, FACE.h);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // Une ombre douce sous les sourcils et sous le nez (le cel-shading fait le reste).
    const ombre = teinte(k.peau, -0.12);
    // Les deux yeux : s = +1 l'œil proche (le coin extérieur vers la gauche de la texture), -1 l'autre.
    for (const s of [1, -1]) {
      if (o.yeux === false || (o.seulLoin && s > 0)) continue;
      const [cx, cy] = PF(s * 19, -1);
      const w = feminin ? 27 : 25, h = feminin ? 33 : 28;
      const ext = cx - s * w, int = cx + s * w;
      if (expr === 'ko') {
        g.strokeStyle = encreC; g.lineWidth = 6;
        g.beginPath(); g.moveTo(ext, cy - 4); g.quadraticCurveTo(cx, cy + 10, int, cy - 2); g.stroke();
        continue;
      }
      if (expr === 'douleur') {
        // > < : les yeux plissés.
        g.strokeStyle = encreC; g.lineWidth = 7;
        g.beginPath(); g.moveTo(ext, cy - 14); g.lineTo(int - s * 6, cy); g.lineTo(ext, cy + 12); g.stroke();
        continue;
      }
      const ferme = expr === 'colere' ? 0.62 : expr === 'joie' ? 0.8 : 1;
      const haut = cy - h * ferme;
      const forme = () => {
        g.beginPath();
        g.moveTo(int, cy + 2);
        g.bezierCurveTo(int - s * w * 0.2, haut - 2, ext + s * w * 0.4, haut - 4, ext - s * 3, cy - h * 0.28 * ferme);
        g.bezierCurveTo(ext + s * w * 0.1, cy + h * 0.55, int - s * w * 0.3, cy + h * 0.62, int, cy + 2);
        g.closePath();
      };
      g.save();
      forme(); g.fillStyle = '#fbf8f4'; g.fill(); g.clip();
      // L'iris (dégradé sombre en haut), la pupille, deux reflets.
      const ix = cx + s * 3, iy = cy + 1, ir = h * 0.78;
      const gr = g.createLinearGradient(0, iy - ir, 0, iy + ir);
      gr.addColorStop(0, teinte(iris, -0.55)); gr.addColorStop(0.55, iris); gr.addColorStop(1, teinte(iris, 0.35));
      g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, ir * 0.78, ir, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0c0608'; g.beginPath(); g.ellipse(ix, iy, ir * (expr === 'colere' ? 0.26 : 0.36), ir * (expr === 'colere' ? 0.42 : 0.5), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(ix - s * ir * 0.3, iy - ir * 0.42, ir * 0.24, ir * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ix + s * ir * 0.3, iy + ir * 0.4, ir * 0.1, 0, Math.PI * 2); g.fill();
      // L'ombre de la paupière en haut du blanc.
      g.fillStyle = 'rgba(80,40,60,0.22)'; g.fillRect(cx - w - 4, haut - 6, w * 2 + 8, h * 0.4);
      g.restore();
      // La paupière : un trait épais, effilé vers le coin extérieur (avec des cils pour les filles).
      g.strokeStyle = encreC; g.lineWidth = feminin ? 8 : 7;
      g.beginPath(); g.moveTo(int + s * 1, cy + 1); g.bezierCurveTo(int - s * w * 0.2, haut - 3, ext + s * w * 0.4, haut - 5, ext - s * 6, cy - h * 0.3 * ferme - 4); g.stroke();
      if (feminin) { g.lineWidth = 4; g.beginPath(); g.moveTo(ext - s * 4, cy - h * 0.3); g.lineTo(ext - s * 14, cy - h * 0.5); g.stroke(); }
      g.lineWidth = 2.6; g.strokeStyle = teinte(k.peau, -0.45);
      g.beginPath(); g.moveTo(ext + s * 4, cy + h * 0.32); g.quadraticCurveTo(cx, cy + h * 0.66, int - s * 6, cy + h * 0.45); g.stroke();
    }
    // Les sourcils : épais, effilés ; froncés en colère, relevés dans la douleur.
    g.strokeStyle = teinte(k.cheveux, -0.25); g.fillStyle = g.strokeStyle;
    for (const s of [1, -1]) {
      const [cx, cy] = PF(s * 19, 12);
      const int = cx + s * 26, ext = cx - s * 26;
      const dyInt = expr === 'colere' ? 12 : expr === 'douleur' ? -10 : expr === 'joie' ? -3 : 2;
      const dyExt = expr === 'colere' ? -10 : expr === 'douleur' ? 8 : -2;
      g.beginPath();
      g.moveTo(int, cy + dyInt - 5);
      g.quadraticCurveTo(cx, cy - 12 + (dyInt + dyExt) / 2, ext - s * 4, cy + dyExt);
      g.quadraticCurveTo(cx, cy - 2 + (dyInt + dyExt) / 2, int, cy + dyInt + 5);
      g.closePath(); g.fill();
    }
    // Le nez : une petite ombre, la bouche selon l'expression.
    const [nx, ny] = PF(1, -14);
    g.fillStyle = ombre; g.beginPath(); g.moveTo(nx + 2, ny - 22); g.quadraticCurveTo(nx - 10, ny - 2, nx - 12, ny + 6); g.lineTo(nx + 4, ny + 6); g.closePath(); g.fill();
    g.strokeStyle = teinte(k.peau, -0.38); g.lineWidth = 3; g.beginPath(); g.moveTo(nx - 10, ny + 6); g.lineTo(nx + 3, ny + 7); g.stroke();
    const [bx, by] = PF(1, -29);
    g.strokeStyle = encreC;
    if (expr === 'colere') {
      // Les dents serrées, la bouche ouverte qui crie.
      g.fillStyle = '#4a0e18'; g.beginPath(); g.moveTo(bx - 26, by - 6); g.quadraticCurveTo(bx, by - 12, bx + 22, by - 7); g.quadraticCurveTo(bx + 4, by + 18, bx - 26, by - 6); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(bx - 22, by - 9, 42, 6);
      g.lineWidth = 3.4; g.beginPath(); g.moveTo(bx - 26, by - 6); g.quadraticCurveTo(bx, by - 12, bx + 22, by - 7); g.stroke();
    } else if (expr === 'douleur') {
      g.fillStyle = '#4a0e18'; g.beginPath(); g.ellipse(bx, by + 2, 16, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(bx - 12, by - 9, 24, 5);
      g.lineWidth = 3; g.beginPath(); g.ellipse(bx, by + 2, 16, 12, 0, 0, Math.PI * 2); g.stroke();
    } else if (expr === 'ko') {
      g.lineWidth = 3.4; g.beginPath(); g.moveTo(bx - 12, by); g.quadraticCurveTo(bx - 4, by - 6, bx + 2, by); g.quadraticCurveTo(bx + 8, by + 6, bx + 14, by); g.stroke();
    } else if (expr === 'joie') {
      g.fillStyle = '#5a1420'; g.beginPath(); g.moveTo(bx - 22, by - 6); g.quadraticCurveTo(bx, by + 22, bx + 20, by - 6); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(bx - 18, by - 6, 36, 5);
      g.lineWidth = 3.4; g.beginPath(); g.moveTo(bx - 24, by - 8); g.quadraticCurveTo(bx, by - 2, bx + 22, by - 8); g.stroke();
    } else {
      g.lineWidth = 3.6; g.beginPath(); g.moveTo(bx - 16, by - 2); g.quadraticCurveTo(bx, by + 2, bx + 14, by - 3); g.stroke();
    }
    if (feminin && expr !== 'ko') {
      g.fillStyle = 'rgba(255,110,130,0.28)';
      for (const s of [1, -1]) { const [cx, cy] = PF(s * 30, -10); g.beginPath(); g.ellipse(cx, cy, 20, 9, 0, 0, Math.PI * 2); g.fill(); }
    }
  });
}

/** Le poing fermé : la paume, les doigts repliés, les jointures, le pouce. Il pointe vers +X (le long de l'avant-bras). */
function poing(r, matiere) {
  const g = new THREE.Group();
  const paume = boule(1, matiere); paume.scale.set(r * 0.92, r * 0.86, r * 0.78);
  const doigts = boule(1, matiere); doigts.scale.set(r * 0.6, r * 0.9, r * 0.8); doigts.position.set(r * 0.5, 0, 0);
  g.add(paume, doigts);
  for (let i = 0; i < 4; i++) { const j = boule(r * 0.27, matiere); j.position.set(r * 0.95, (-0.48 + i * 0.32) * r, r * 0.18); g.add(j); }
  const pouce = boule(1, matiere); pouce.scale.set(r * 0.52, r * 0.26, r * 0.28); pouce.position.set(r * 0.38, -r * 0.62, r * 0.42); pouce.rotation.z = 0.5;
  g.add(pouce);
  return g;
}

/* ------------------------------------------------------------------ */
/* Le modèle                                                           */
/* ------------------------------------------------------------------ */

const CARRURES = { normal: { l: 1, m: 1 }, fin: { l: 0.86, m: 0.84 }, massif: { l: 1.24, m: 1.22 }, geant: { l: 1.38, m: 1.36 } };
/** Les kimonos ouverts : la peau en V sur la poitrine. */
const KIMONO = ['ryuken', 'blazero', 'thunderox', 'pyroclaw'];

function construire(perso) {
  const k = perso.c;
  const L = perso.look;
  const X = L.extras;
  const car = CARRURES[L.corps] || CARRURES.normal;
  const m = car.m;
  const l = car.l;
  const groupe = new THREE.Group();
  const P = { groupe, car };

  const peau = mat(k.peau, 'peau');
  const robeOuJupe = X.includes('robe') || X.includes('jupe');
  const pantalon = mat(robeOuJupe ? k.peau : k.tenue, robeOuJupe ? 'peau' : 'tissu');
  // Les karatékas se battent pieds nus.
  const piedsNus = KIMONO.includes(perso.id);
  const chaussure = piedsNus ? peau : mat(L.tete === 'rocher' ? teinte(k.peau, -0.3) : teinte(k.tenue, -0.55), 'brillant');
  const mancheC = manche(perso);
  const bras = mat(mancheC, mancheC === k.peau ? 'peau' : 'tissu');
  const gantC = gant(perso);
  const gants = mat(gantC, X.includes('gants-boxe') ? 'brillant' : gantC === k.peau ? 'peau' : 'tissu');
  const metallique = ['ironclad', 'stoneback', 'lechaos', 'malvortex'].includes(perso.id) || perso.figurant;
  const tenue = mat(k.tenue, metallique && perso.id === 'ironclad' ? 'metal' : 'tissu');

  /* ---- Le bassin, et les jambes ---- */
  P.bassin = boule(1, pantalon); P.bassin.scale.set(13 * l, 9, 11 * l);
  groupe.add(P.bassin);
  const ample = KIMONO.includes(perso.id) && !robeOuJupe ? 1.18 : 1;
  P.cuisseA = segment(8.6 * m * ample, pantalon, 7.4 * m * ample); P.cuisseR = segment(8.2 * m * ample, pantalon, 7 * m * ample);
  P.tibiaA = segment(7.4 * m * ample, pantalon, 6.4 * m * ample); P.tibiaR = segment(7 * m * ample, pantalon, 6.2 * m * ample);
  const pied = () => {
    const g = new THREE.Group();
    const b = maille(GEO.sphere(), chaussure, 11 * m, 5.6, 6.8 * m);
    b.position.set(5 * m, -1.5, 0);
    const semelle = maille(GEO.boite(), mat('#1a1418'), 22 * m, 2.2, 12 * m);
    semelle.position.set(5 * m, -5.5, 0);
    g.add(b);
    if (!piedsNus) g.add(semelle);
    return g;
  };
  P.piedA = pied(); P.piedR = pied();
  groupe.add(P.cuisseR, P.tibiaR, P.piedR, P.cuisseA, P.tibiaA, P.piedA);
  if (KIMONO.includes(perso.id) && !robeOuJupe) {
    const bas = () => new THREE.Mesh(new THREE.CylinderGeometry(7.2 * m, 9.4 * m, 10, 22, 1), pantalon);
    P.basA = bas(); P.basR = bas();
    groupe.add(P.basA, P.basR);
  }

  /* ---- Le buste : un tronc qui s'élargit vers les épaules, tourné vers nous ---- */
  const buste = new THREE.Group();
  P.buste = buste;
  const largeur = 22 * l;
  const taille = 15 * l;
  const nu = X.includes('torse-nu');
  const haut = nu ? peau : tenue;
  const kimono = KIMONO.includes(perso.id);
  // Le tronc sculpté ; le col en V du kimono, ou les muscles d'un torse nu, sont dessinés dessus.
  const tronc = new THREE.Mesh(geoTronc(largeur, taille), matTorse(perso, nu, kimono));
  tronc.scale.z = 0.62;
  buste.add(tronc);

  // La ceinture, et son nœud.
  const ceinture = new THREE.Mesh(new THREE.CylinderGeometry(taille + 1.6, taille + 1.4, 8, 26, 1), mat(k.ceinture));
  ceinture.scale.z = 0.7; ceinture.position.y = 1;
  const noeud = boule(1, mat(teinte(k.ceinture, -0.08))); noeud.scale.set(4.2, 3.4, 2.6);
  noeud.position.set(taille - 4, 0.5, taille * 0.62);
  buste.add(ceinture, noeud);
  if (kimono || X.includes('ceinture-longue')) {
    const bouts = new THREE.Group();
    for (const [dx, l2, a] of [[-1.5, 18, 0.32], [1.5, 15, -0.12]]) {
      const b = plaque([[-1.8, 0], [1.8, 0], [2.2, -l2], [-1.4, -l2 + 1.2]], 1.4, mat(k.ceinture));
      b.position.set(dx, 0, 0); b.rotation.z = a;
      bouts.add(b);
    }
    bouts.position.set(taille - 4, -1.5, taille * 0.62 + 1.5);
    buste.add(bouts);
    P.bouts = bouts;
  }
  if (X.includes('ceinture-champion')) {
    const boucle = boule(1, mat('#ffd23f', 'metal')); boucle.scale.set(11, 8, 2.5); boucle.position.set(0, 0, taille * 0.7 + 1);
    const rubis = boule(3.4, mat('#d8102a', 'brillant')); rubis.position.set(0, 0, taille * 0.7 + 3.2);
    buste.add(boucle, rubis);
  }
  ajouterTorse(P, perso, buste, { largeur, taille });
  groupe.add(buste);

  /* ---- Jupe, robe, haori ---- */
  if (robeOuJupe || X.includes('haori')) {
    const long = X.includes('robe') ? 46 : X.includes('haori') ? 30 : 24;
    const jupe = new THREE.Mesh(new THREE.CylinderGeometry(16 * l, 24 * l, long, 26, 1, true), mat(X.includes('haori') ? teinte(k.tenue, 0.08) : k.tenue, 'voile'));
    jupe.position.y = -long / 2 + 2;
    jupe.scale.z = 0.75;
    const bord = new THREE.Mesh(new THREE.TorusGeometry(24 * l, 1, 6, 30), mat(k.c1));
    bord.rotation.x = Math.PI / 2; bord.scale.y = 0.75; bord.position.y = -long + 2;
    P.jupe = new THREE.Group(); P.jupe.add(jupe, bord);
    groupe.add(P.jupe);
  }

  /* ---- Les bras ---- */
  P.brasA = segment(6.6 * m, bras, 6 * m); P.avantBrasA = segment(6 * m, bras, 5.4 * m);
  P.brasR = segment(6.2 * m, bras, 5.6 * m); P.avantBrasR = segment(5.6 * m, bras, 5 * m);
  const taillePoing = X.includes('gants-boxe') ? 11.5 : 7.8;
  const boxe = X.includes('gants-boxe');
  P.mainA = boxe ? boule(taillePoing * m, gants) : poing(taillePoing * m, gants);
  P.mainR = boxe ? boule(taillePoing * m * 0.95, gants) : poing(taillePoing * m * 0.95, gants);
  groupe.add(P.brasR, P.avantBrasR, P.mainR, P.brasA, P.avantBrasA, P.mainA);
  // Les épaules, arrondies.
  P.epauleA = boule(8.4 * m * l, haut); P.epauleR = boule(8 * m * l, haut);
  if (KIMONO.includes(perso.id)) {
    const manche = (r) => new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.2, 1, 22, 1), haut);
    P.mancheA = manche(8.2 * m * l); P.mancheR = manche(7.8 * m * l);
    groupe.add(P.mancheA, P.mancheR);
  }
  groupe.add(P.epauleA, P.epauleR);

  /* ---- La tête ---- */
  P.cou = segment(4.6 * m, L.tete === 'ninja' ? mat(teinte(k.c2, -0.55)) : peau);
  groupe.add(P.cou);
  P.tete = construireTete(perso);
  groupe.add(P.tete.groupe);

  ajouterAccessoires(P, perso);
  return P;
}

/* ---- Ce qui se porte sur le buste ---- */
function ajouterTorse(P, perso, buste, { largeur, taille }) {
  const k = perso.c;
  const X = perso.look.extras;
  const devantZ = largeur * 0.62;
  if (X.includes('armure') || X.includes('armure-or') || X.includes('armure-noire')) {
    const c = X.includes('armure-or') ? '#ffd23f' : X.includes('armure-noire') ? '#1a0508' : teinte(k.tenue, 0.35);
    const plastron = plaque([[-largeur + 4, 48], [largeur - 4, 48], [largeur - 8, 22], [0, 12], [-largeur + 8, 22]], 3, mat(c, 'metal'));
    plastron.position.z = devantZ + 0.8;
    buste.add(plastron);
    if (X.includes('armure') && perso.id === 'ironclad') { const coeur = boule(4, mat('#4fd8ff', 'lueur')); coeur.position.set(2, 32, devantZ + 3); buste.add(coeur); }
    if (X.includes('armure-noire')) { const arete = plaque([[-2, 46], [0, 30], [2, 46]], 2, mat('#c80014', 'lueur')); arete.position.z = devantZ + 3; buste.add(arete); }
  }
  if (X.includes('general')) {
    const cuirasse = plaque([[-largeur + 1, 47], [largeur - 1, 47], [largeur - 4, 16], [0, 3], [-largeur + 4, 16]], 3.4, mat('#3a434e', 'metal'));
    cuirasse.position.z = devantZ + 1;
    const bord = plaque([[-largeur + 1, 47], [largeur - 1, 47], [largeur - 1, 44], [-largeur + 1, 44]], 4, mat('#ffd23f', 'metal'));
    bord.position.z = devantZ + 1.4;
    const echarpe = plaque([[-largeur + 2, 47], [-largeur + 11, 47], [largeur - 2, 18], [largeur - 6, 12]], 4.2, mat('#b0102a'));
    echarpe.position.z = devantZ + 2.2;
    const horloge = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 2, 28), mat('#ffd23f', 'metal'));
    horloge.rotation.x = Math.PI / 2; horloge.position.set(1, 29, devantZ + 4);
    const cadran = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 2.4, 28), mat('#2a1a06'));
    cadran.rotation.x = Math.PI / 2; cadran.position.set(1, 29, devantZ + 4.4);
    const aiguille = maille(GEO.boite(), mat('#ffe6a0', 'lueur'), 1.2, 6, 0.8); aiguille.position.set(1, 31, devantZ + 5.8);
    P.aiguille = aiguille;
    buste.add(cuirasse, bord, echarpe, horloge, cadran, aiguille);
    for (let i = 0; i < 3; i++) {
      const med = boule(2.4, mat(i === 1 ? '#e8e8f0' : '#ffd23f', 'metal'), 2.4, 1.2); med.position.set(-largeur + 7 + i * 5, 37, devantZ + 4.2);
      const ruban = maille(GEO.boite(), mat(['#c8102e', '#1a4ad8', '#2a8a4a'][i]), 3.6, 6, 0.8); ruban.position.set(-largeur + 7 + i * 5, 41, devantZ + 4);
      buste.add(med, ruban);
    }
  }
  if (X.includes('insigne')) {
    const fond = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 1.4, 24), mat('#1a1206'));
    fond.rotation.x = Math.PI / 2; fond.position.set(2, 32, devantZ + 1);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1.6, 24), mat(k.ceinture, 'metal'));
    face.rotation.x = Math.PI / 2; face.position.set(2, 32, devantZ + 1.4);
    buste.add(fond, face);
  }
  if (X.includes('ecailles')) {
    for (let y = 10; y < 44; y += 7) for (let x = -largeur + 6; x < largeur - 4; x += 8) {
      const e = boule(2.8, mat(teinte(k.c1, -0.18), 'brillant'), 2.4, 0.45); e.position.set(x + ((y / 7) % 2) * 4, y, devantZ - 0.4); buste.add(e);
    }
  }
  if (X.includes('fissures') || X.includes('mousse')) {
    const mousse = boule(1, mat('#5f8f3a'), 9, 4, 6); mousse.position.set(-largeur + 8, 44, devantZ * 0.6); buste.add(mousse);
  }
  if (X.includes('noeud-pap')) {
    // Le plastron blanc de la chemise, en V, et le nœud papillon.
    const chemise = plaque([[-8, 48], [8, 48], [0, 24]], 1, mat('#f4f0e8')); chemise.position.z = devantZ + 0.5;
    buste.add(chemise);
    for (const s of [-1, 1]) { const a = boule(1, mat(k.c2, 'brillant')); a.scale.set(5, 3.4, 2.2); a.position.set(s * 4.6, 46, devantZ + 2); a.rotation.z = s * 0.25; buste.add(a); }
    const n = boule(1.9, mat(teinte(k.c2, -0.2), 'brillant')); n.position.set(0, 46, devantZ + 3); buste.add(n);
  }
  if (X.includes('fissures-energie')) {
    for (const [x, y, a] of [[-8, 36, 0.4], [-6, 22, -0.3], [8, 34, -0.3], [9, 20, 0.2]]) {
      const f = maille(GEO.boite(), mat(k.c1, 'lueur'), 1.6, 12, 1); f.position.set(x, y, devantZ + 0.5); f.rotation.z = a; buste.add(f);
    }
  }
  void taille;
}

/* ---- La tête ---- */
function construireTete(perso) {
  const k = perso.c;
  const L = perso.look;
  const X = L.extras;
  const groupe = new THREE.Group();
  // Le visage regarde vers l'avant, un peu tourné vers nous.
  const visage = new THREE.Group();
  visage.rotation.y = rad(-60);
  groupe.add(visage);
  const T = { groupe, visage, yeux: [], pupilles: [], bouche: null };
  const peau = mat(k.peau, 'peau');
  const cheveux = mat(k.cheveux);

  // Les têtes à part : le crâne du faucheur, le miroir de Némésis, le heaume des soldats.
  if (L.tete === 'crane') {
    const capuche = mat(teinte(k.tenue, 0.14), 'voile');
    const c = capucheOuverte(21, capuche);
    const os = boule(1, mat('#ece2cc', 'brillant')); os.scale.set(14, 14.5, 13);
    const machoire = maille(GEO.boite(), mat('#d8cdb4', 'brillant'), 12, 9, 11); machoire.position.set(4, -10, 0);
    visage.add(os, machoire);
    for (const z of [-5, 5]) { const orbite = boule(4.3, mat('#0a0010'), 4.8, 3); orbite.position.set(11, 1, z); visage.add(orbite); const l2 = boule(1.6, mat(k.c1, 'lueur')); l2.position.set(13.5, 1, z); visage.add(l2); T.yeux.push(l2); }
    visage.add(c);
    return T;
  }
  if (L.tete === 'miroir') {
    const masque = boule(1, mat('#dfe8ff', 'metal')); masque.scale.set(15, 17, 14);
    visage.add(masque);
    const fente = maille(GEO.boite(), mat('#ffffff', 'lueur'), 2, 2, 11); fente.position.set(13.5, 1, 0); visage.add(fente); T.yeux.push(fente);
    for (let i = 0; i < 5; i++) {
      const a = rad(-60 + i * 30);
      const e = maille(GEO.octa(), mat(i % 2 ? '#e6f2ff' : '#a8c4e8', 'verre'), 2.6, 7, 2.6);
      e.position.set(Math.sin(a) * 6 - 3, Math.cos(a) * 20 + 2, Math.sin(a) * 12); e.rotation.z = -a * 0.6;
      groupe.add(e);
    }
    return T;
  }
  if (L.tete === 'heaume') {
    const general = X.includes('general');
    const acier = mat(teinte(k.tenue, 0.25), 'metal');
    const casque = boule(1, acier); casque.scale.set(17, 18.5, 16);
    const fente = maille(GEO.boite(), mat('#05080a'), 6, 4, 18); fente.position.set(13, 1, 0);
    const lueurY = maille(GEO.boite(), mat(k.c1, 'lueur'), 3, 2, 14); lueurY.position.set(15.5, 1, 0);
    T.yeux.push(lueurY);
    const horloge = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 1.6, 20), mat(k.ceinture, 'metal'));
    horloge.rotation.z = Math.PI / 2; horloge.position.set(16.5, 11, 0);
    visage.add(casque, fente, lueurY, horloge);
    if (general) {
      const or = mat('#ffd23f', 'metal');
      const cimier = plaque([[-12, 14], [-8, 34], [6, 36], [4, 28], [12, 18]], 3, or); visage.add(cimier);
      const bande = new THREE.Mesh(new THREE.TorusGeometry(16.5, 1.3, 8, 30), or); bande.rotation.x = Math.PI / 2; bande.position.y = 7; visage.add(bande);
      for (const z of [-1, 1]) { const aile = plaque([[0, 0], [-20, 16], [-14, 2], [-22, -2], [-2, 4]], 1.6, mat('#e8a030', 'metal')); aile.position.set(-6, 4, z * 16); aile.rotation.y = z * 0.4; visage.add(aile); }
      const panache = plaque([[0, 24], [-24, 34], [-48, 10], [-38, 6], [-30, -4], [-22, 12], [-8, 14]], 3, mat('#b00a20', 'voile'));
      groupe.add(panache);
      T.panache = panache;
    }
    if (X.includes('plumet')) { const p = plaque([[-2, 18], [-16, 40], [-30, 28], [-16, 30], [-8, 16]], 2, mat(k.c1, 'voile')); groupe.add(p); T.panache = p; }
    return T;
  }
  // Le masque du catcheur : toute la tête couverte, des flammes d'or autour des yeux, la bouche à l'air.
  if (L.tete === 'masque-catch') {
    const forme = new THREE.Mesh(GEO.tete(), mat(k.c1, 'brillant'));
    forme.scale.set(14.8, 16.3, 14.1);
    visage.add(forme);
    const or = mat(k.c2, 'metal');
    for (const z of [-5.4, 5.4]) {
      const flamme = plaque([[-3, -4], [4, -5], [8, 0], [4, 5], [-2, 9], [0, 3]], 1.4, or);
      flamme.position.set(12.4, 2, z); flamme.rotation.y = -Math.PI / 2; flamme.scale.set(z > 0 ? -1 : 1, 1, 1);
      const blanc = boule(1, mat('#ffffff', 'brillant')); blanc.scale.set(1.6, 3, 3.1); blanc.position.set(13.2, 2, z);
      const pupille = boule(1, mat('#151018', 'brillant')); pupille.scale.set(1, 1.7, 1.6); pupille.position.set(14.5, 2, z * 0.92);
      visage.add(flamme, blanc, pupille);
      T.yeux.push(blanc); T.pupilles.push(pupille);
    }
    const menton = boule(1, peau); menton.scale.set(6, 5.5, 8.5); menton.position.set(9.5, -9.5, 0); visage.add(menton);
    const bouche = maille(GEO.boite(), mat('#5a2020'), 1.2, 1.6, 5); bouche.position.set(15.1, -9.5, 0); visage.add(bouche); T.bouche = bouche;
    // La crête d'or au milieu du crâne, les lacets dans la nuque.
    visage.add(plaque([[-15, 4], [-8, 17.5], [4, 17], [12, 9], [3, 12], [-6, 12]], 2, or));
    for (let i = 0; i < 3; i++) { const l = maille(GEO.boite(), mat('#ffffff'), 1, 1, 9); l.position.set(-14.6, -2 + i * 4, 0); visage.add(l); }
    return T;
  }

  // Le visage : une tête d'anime, son visage dessiné (une texture par expression).
  const luisants = X.includes('yeux-luisants') || L.tete === 'capuche' || L.tete === 'visiere';
  if (L.tete !== 'rocher') {
    const exprs = {};
    const o = { yeux: !luisants, seulLoin: X.includes('oeil-rouge') };
    T.matExpr = (e) => {
      if (!exprs[e]) { const m = toon({ map: texVisage(perso, e, o), color: 0xffffff }, { rim: 0.8 }); m.userData.encre = new THREE.Color(k.peau); exprs[e] = m; }
      return exprs[e];
    };
    T.forme = new THREE.Mesh(GEO.tete(), T.matExpr('neutre'));
    T.forme.scale.set(14.5, 16, 13.8);
    T.expr = 'neutre';
    visage.add(T.forme);
    for (const z of [-1, 1]) { const o2 = boule(1, peau); o2.scale.set(2.4, 3.8, 1.8); o2.position.set(-0.5, -1, z * 13.4); visage.add(o2); }
    if (X.includes('oeil-rouge')) { const e = boule(1, mat('#ff2020', 'lueur')); e.scale.set(1.2, 2.4, 3.6); e.position.set(11.6, 2, 5.4); visage.add(e); T.yeux.push(e); }
    if (luisants) for (const z of [-5.2, 5.2]) { const e = boule(1, mat(k.c1, 'lueur')); e.scale.set(1.2, 1.6, 3.2); e.position.set(12.4, 2, z); visage.add(e); T.yeux.push(e); }
  } else {
    const forme = maille(GEO.dode(), peau, 15.5, 16, 14.5);
    const machoire = boule(1, mat(teinte(k.peau, -0.05), 'peau')); machoire.scale.set(9.5, 7.5, 10); machoire.position.set(5, -8, 0);
    visage.add(forme, machoire);
  }
  for (const z of L.tete === 'rocher' ? [-5.2, 5.2] : []) {
    if (X.includes('oeil-rouge') && z > 0) {
      const e = boule(1, mat('#ff2020', 'lueur')); e.scale.set(1.2, 2.4, 3.6); e.position.set(12.6, 2, z); visage.add(e); T.yeux.push(e); continue;
    }
    if (luisants) {
      const e = boule(1, mat(k.c1, 'lueur')); e.scale.set(1.2, 1.6, 3.2); e.position.set(12.8, 2, z); visage.add(e); T.yeux.push(e); continue;
    }
    const blanc = boule(1, mat('#ffffff', 'brillant')); blanc.scale.set(1.6, 3, 3.4); blanc.position.set(12.6, 2, z);
    const pupille = boule(1, mat(L.tete === 'ninja' ? k.c1 : '#151018', 'brillant')); pupille.scale.set(1, 1.8, 1.8); pupille.position.set(14, 2, z * 0.92);
    const sourcil = maille(GEO.boite(), mat(teinte(k.cheveux, -0.3)), 2, 1.8, 6.8); sourcil.position.set(13, 7, z); sourcil.rotation.x = z > 0 ? -0.25 : 0.25;
    visage.add(blanc, pupille, sourcil);
    T.yeux.push(blanc); T.pupilles.push(pupille);
  }
  if (L.tete === 'rocher') { const bouche = maille(GEO.boite(), mat('#5a2020'), 1.2, 1.6, 7); bouche.position.set(13.2, -9, 0.5); visage.add(bouche); T.bouche = bouche; }
  if (X.includes('barbe')) {
    const b = boule(1, cheveux); b.scale.set(8, 16, 9); b.position.set(9, -20, 0); visage.add(b);
  }
  if (L.tete === 'ninja') {
    const masque = new THREE.Mesh(new THREE.SphereGeometry(15.4, 24, 14, -Math.PI / 2, Math.PI, Math.PI * 0.52, Math.PI * 0.38), mat(teinte(k.c2, -0.55)));
    masque.rotation.y = -Math.PI / 2; masque.scale.set(1, 1.05, 1.05);
    visage.add(masque);
  }

  coiffure3D(T, perso);
  return T;
}

/** Une capuche : une calotte qui couvre le crâne et la nuque, ouverte sur le visage (vers +X). */
function capucheOuverte(r, matiere) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18, Math.PI * 1.32, Math.PI * 1.36, 0, Math.PI * 0.78), matiere);
  c.position.set(-3, 2, 0);
  return c;
}

/** Les coiffures et ce qui se porte sur la tête. */
function coiffure3D(T, perso) {
  const k = perso.c;
  const L = perso.look;
  const X = L.extras;
  const v = T.visage;
  const cheveux = mat(k.cheveux);
  const clair = mat(teinte(k.cheveux, 0.3));
  /** Le dessus du crâne, couvert de cheveux. */
  const calotte = (couv = 0.48, r = 15.6) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 26, 14, 0, Math.PI * 2, 0, Math.PI * couv), cheveux);
    c.rotation.z = rad(20); c.position.set(-1.5, 1.5, 0); c.scale.set(1, 1.04, 0.95);
    v.add(c);
    return c;
  };
  const pic = (x, y, z, h, r, inclinaison, matiere = cheveux) => {
    const p = maille(GEO.cone(), matiere, r, h, r);
    p.position.set(x, y, z); p.rotation.z = inclinaison; v.add(p);
    return p;
  };
  switch (L.tete) {
    case 'bandeau': {
      calotte(0.5);
      // Des mèches en pics, rejetées en arrière, et quelques-unes qui retombent sur le front.
      for (const [x, y, z, h, r, az, ax] of [[-13, 9, 0, 21, 5, 78, 0], [-10, 13, -7, 19, 4.6, 60, -24], [-10, 13, 7, 19, 4.6, 60, 24], [-5, 16, -3, 18, 4.8, 38, -12], [-5, 16, 5, 17, 4.6, 34, 16], [0, 17, 0, 16, 4.6, 16, 0], [4, 16, -7, 13, 4, -2, -28], [4, 16, 7, 13, 4, -4, 28], [-15, 3, -6, 16, 4.2, 100, -14], [-15, 3, 6, 15, 4.2, 104, 14]]) {
        const p = pic(x, y, z, h, r, rad(az)); p.rotation.x = rad(ax);
      }
      for (const [z, a] of [[-4, -128], [3, -136]]) pic(11, 8, z, 9, 2.6, rad(a));
      const b = new THREE.Mesh(new THREE.TorusGeometry(15, 2.4, 8, 32), mat(k.ceinture));
      b.rotation.x = Math.PI / 2; b.rotation.y = rad(12); b.position.y = 6; b.scale.set(1, 0.95, 1);
      v.add(b);
      if (X.includes('bandeau-long')) {
        const pans = new THREE.Group();
        for (const dz of [-2, 2]) { const p = plaque([[0, 0], [-16, 1], [-30, -3], [-28, -7], [-14, -4], [0, -4]], 1.2, mat(k.ceinture, 'voile')); p.position.z = dz; pans.add(p); }
        pans.position.set(-14, 6, 0);
        T.groupe.add(pans);
        T.pans = pans;
      }
      break;
    }
    case 'pics':
      calotte(0.45);
      for (let i = 0; i < 7; i++) pic(-12 + i * 4, 14 + (i % 3) * 2, -7 + (i % 3) * 7, 18 + (i % 3) * 6, 3.6, rad(40 - i * 6), i % 2 ? cheveux : clair);
      break;
    case 'cristaux':
      calotte(0.42);
      for (let i = 0; i < 5; i++) pic(-8 + i * 4.5, 16, -6 + i * 3, 12 + (i === 2 ? 10 : i % 2 ? 4 : 7), 2.6, rad(10 - i * 5), mat('#e6faff', 'verre'));
      break;
    case 'rase':
      break;
    case 'ninja': {
      for (let i = 0; i < 6; i++) pic(-12 + i * 4, 14, -6 + (i % 3) * 6, 18 + (i % 3) * 4, 3.4, rad(36 - i * 5), i % 2 ? cheveux : clair);
      calotte(0.42);
      const b = new THREE.Mesh(new THREE.TorusGeometry(15.2, 2.4, 8, 32), mat(k.c1));
      b.rotation.x = Math.PI / 2; b.position.y = 6; v.add(b);
      const plaqueF = maille(GEO.boite(), mat('#d8d8e8', 'metal'), 1.4, 5, 8); plaqueF.position.set(15, 6, 0); v.add(plaqueF);
      const pans = new THREE.Group();
      for (const dz of [-2.5, 2.5]) { const p = plaque([[0, 0], [-18, 2], [-38, -2], [-36, -7], [-16, -4], [0, -4]], 1.2, mat(k.c1, 'voile')); p.position.z = dz; pans.add(p); }
      pans.position.set(-14, 6, 0); T.groupe.add(pans); T.pans = pans;
      break;
    }
    case 'capuche': {
      v.add(capucheOuverte(20, mat(teinte(k.tenue, 0.08), 'voile')));
      break;
    }
    case 'crete':
      calotte(0.3, 15.2);
      for (let i = 0; i < 6; i++) pic(-10 + i * 4.2, 17 - Math.abs(i - 2.5), 0, 20 - Math.abs(i - 2.5) * 2.5, 2.6, rad(25 - i * 6));
      break;
    case 'visiere': {
      const casque = new THREE.Mesh(new THREE.SphereGeometry(17.5, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(teinte(k.tenue, 0.2), 'metal'));
      casque.rotation.z = rad(10);
      const visiereM = new THREE.Mesh(new THREE.SphereGeometry(17, 26, 6, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.42, Math.PI * 0.16), mat('#ff3030', 'lueur'));
      visiereM.rotation.y = -Math.PI / 2;
      v.add(casque, visiereM);
      T.yeux.push(visiereM);
      break;
    }
    case 'longs': {
      calotte(0.55, 16);
      const dos = boule(1, cheveux); dos.scale.set(9, 26, 14); dos.position.set(-10, -14, 0); dos.rotation.z = rad(-12);
      v.add(dos);
      T.dos = dos;
      if (X.includes('diademe-lune')) {
        const d = new THREE.Mesh(new THREE.TorusGeometry(7, 1.2, 8, 24, Math.PI), mat('#e8f4ff', 'lueur'));
        d.position.set(10, 13, 0); d.rotation.y = Math.PI / 2; v.add(d);
      }
      break;
    }
    case 'halo': {
      calotte(0.45);
      const h = new THREE.Mesh(new THREE.TorusGeometry(15, 1.8, 10, 40), mat(k.c1, 'lueur'));
      h.rotation.x = Math.PI / 2; h.position.y = 30; T.groupe.add(h); T.halo = h;
      break;
    }
    case 'cornes': {
      calotte(0.42);
      for (const z of [-1, 1]) {
        const courbe = new THREE.QuadraticBezierCurve3(new THREE.Vector3(2, 10, z * 8), new THREE.Vector3(-2, 22, z * 22), new THREE.Vector3(-14, 34, z * 16));
        const corne = new THREE.Mesh(new THREE.TubeGeometry(courbe, 14, 3.4, 10, false), mat(perso.id === 'malvortex' ? '#2a0a0a' : '#e8d6b0', 'brillant'));
        const pointe = maille(GEO.cone(), corne.material, 3.4, 8, 3.4); pointe.position.set(-16, 37, z * 15); pointe.rotation.z = rad(50);
        v.add(corne, pointe);
      }
      break;
    }
    case 'chignon': {
      calotte(0.5);
      const c = boule(6.5, cheveux); c.position.set(-6, 19, 0); v.add(c);
      const pique = maille(GEO.cylindre(), mat(k.c1, 'brillant'), 0.9, 30, 0.9); pique.rotation.x = Math.PI / 2; pique.position.set(-6, 19, 0); v.add(pique);
      break;
    }
    case 'couettes': {
      calotte(0.52);
      for (const z of [-1, 1]) {
        const c = boule(1, cheveux); c.scale.set(7, 18, 7); c.position.set(-6, -4, z * 18); c.rotation.x = z * rad(16); v.add(c);
        const lien = boule(3, mat(k.c1, 'brillant')); lien.position.set(-4, 8, z * 15); v.add(lien);
      }
      break;
    }
    case 'rocher': {
      const mousse = boule(1, mat('#5f8f3a')); mousse.scale.set(9, 3, 8); mousse.position.set(-4, 15, 0); v.add(mousse);
      break;
    }
    case 'plumes':
      for (let i = 0; i < 5; i++) { const p = boule(1, i % 2 ? cheveux : clair); p.scale.set(4, 15, 3); p.position.set(-10 + i * 2.5, 16 + i, -6 + i * 3); p.rotation.z = rad(60 - i * 8); v.add(p); }
      calotte(0.45);
      break;
    case 'casque': {
      const casque = new THREE.Mesh(new THREE.SphereGeometry(17.5, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(teinte(k.tenue, 0.25), 'metal'));
      casque.rotation.z = rad(8);
      const crete = plaque([[-6, 14], [-18, 30], [-28, 26], [-16, 22], [-12, 12]], 2.4, mat(k.c1, 'brillant'));
      v.add(casque, crete);
      break;
    }
    case 'couronne-etoiles': {
      const couronne = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const e = maille(GEO.octa(), mat(i % 3 ? '#e8d4ff' : '#ffd84a', 'lueur'), 3 + (i % 2) * 1.5);
        e.position.set(Math.cos(a) * 22, 14 + Math.sin(a * 2) * 3, Math.sin(a) * 22);
        couronne.add(e);
      }
      T.groupe.add(couronne); T.couronne = couronne;
      calotte(0.45);
      break;
    }
    case 'casquette': {
      // Une casquette portée à l'envers : la calotte, la visière dans la nuque, le bouton ; des mèches sur le front.
      calotte(0.4);
      const tissu = mat(k.c2);
      const cal = new THREE.Mesh(new THREE.SphereGeometry(16.6, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), tissu);
      cal.rotation.z = rad(14); cal.position.set(-1, 2, 0); v.add(cal);
      const visiere = boule(1, tissu); visiere.scale.set(10, 1.3, 11); visiere.position.set(-17, 5, 0); visiere.rotation.z = rad(-14); v.add(visiere);
      const bouton = boule(2, mat(k.c1, 'brillant')); bouton.position.set(-2, 17.5, 0); v.add(bouton);
      for (const z of [-5, 0, 5]) pic(11, 8, z, 9, 2.6, rad(-128));
      break;
    }
    case 'haut-de-forme': {
      // Le chapeau haut de forme du flambeur, son ruban rouge, un as glissé dedans.
      calotte(0.48);
      const feutre = mat(teinte(k.tenue, 0.05), 'brillant');
      const chapeau = new THREE.Group();
      const bord = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 1.6, 30), feutre); bord.position.y = 14; bord.scale.z = 0.9;
      const fut = new THREE.Mesh(new THREE.CylinderGeometry(12.6, 12, 24, 28), feutre); fut.position.y = 27;
      const ruban = new THREE.Mesh(new THREE.CylinderGeometry(12.8, 12.7, 4.5, 28), mat(k.c2)); ruban.position.y = 17.5;
      const as = maille(GEO.boite(), mat('#ffffff'), 0.8, 8, 5.6); as.position.set(4, 22, 11.4); as.rotation.set(0.25, 0, 0.2);
      chapeau.add(bord, fut, ruban, as); chapeau.rotation.z = rad(-8);
      v.add(chapeau);
      break;
    }
    case 'chapeau-cowboy': {
      // Le chapeau de cowboy : un large bord bombé, la calotte cabossée, le ruban.
      calotte(0.5);
      const cuir = mat(teinte(k.c1, -0.3));
      const chapeau = new THREE.Group();
      const bord = boule(1, cuir); bord.scale.set(26, 2.4, 22); bord.position.y = 13;
      const calotteC = boule(1, cuir); calotteC.scale.set(13, 11, 11.5); calotteC.position.y = 19;
      const creux = boule(1, mat(teinte(k.c1, -0.45))); creux.scale.set(9, 2, 4); creux.position.set(0, 29.4, 0);
      const ruban = new THREE.Mesh(new THREE.CylinderGeometry(12.9, 12.9, 3, 28), mat(k.c2)); ruban.position.y = 16; ruban.scale.z = 0.9;
      chapeau.add(bord, calotteC, creux, ruban); chapeau.rotation.z = rad(-6);
      v.add(chapeau);
      break;
    }
    case 'oreilles-renard': {
      // Des cheveux longs, deux oreilles de renarde pointues (le dedans blanc), des mèches sur le front.
      calotte(0.55, 16);
      const dos = boule(1, cheveux); dos.scale.set(8, 23, 13); dos.position.set(-10, -11, 0); dos.rotation.z = rad(-12);
      v.add(dos); T.dos = dos;
      for (const z of [-1, 1]) {
        const o = maille(GEO.cone(), cheveux, 5.6, 16, 3.4); o.position.set(-3, 21, z * 9); o.rotation.set(z * rad(-16), 0, rad(10)); v.add(o);
        const i = maille(GEO.cone(), mat('#fff4ea'), 3.2, 10, 1.6); i.position.set(-1.4, 20, z * 9.3); i.rotation.copy(o.rotation); v.add(i);
      }
      for (const z of [-6, 0, 6]) pic(11, 8, z, 9, 2.6, rad(-128), z ? cheveux : clair);
      break;
    }
    case 'loup': {
      // La crinière hirsute du loup-garou, ses oreilles pointues.
      calotte(0.52);
      for (let i = 0; i < 13; i++) {
        const a = rad(-110 + i * 19);
        pic(-3 + Math.cos(a) * 13, 2 + Math.sin(a) * 13, (i % 2 ? 1 : -1) * (4 + (i % 3) * 3), 13 + (i % 3) * 5, 3.6, a - Math.PI / 2, i % 2 ? cheveux : clair);
      }
      for (const z of [-1, 1]) {
        const o = maille(GEO.cone(), cheveux, 5, 14, 3); o.position.set(-2, 20, z * 9); o.rotation.set(z * rad(-20), 0, rad(14)); v.add(o);
        const i = maille(GEO.cone(), mat('#d88a9a'), 2.6, 8, 1.4); i.position.set(-0.6, 19, z * 9.4); i.rotation.copy(o.rotation); v.add(i);
      }
      break;
    }
    default:
      calotte(0.48);
  }
  // Une couronne de feuilles et de fleurs.
  if (X.includes('couronne-feuilles')) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const f = boule(1, mat(i % 3 ? '#5ad84a' : '#2e9a3a', 'brillant')); f.scale.set(4.6, 1.4, 2.6);
      f.position.set(Math.cos(a) * 15.6 - 1, 9 + Math.sin(a * 2) * 1.4, Math.sin(a) * 15.6); f.rotation.set(0, -a, rad(24));
      v.add(f);
    }
    for (const [a, c] of [[0.5, '#ff8ad8'], [2.3, '#ffe066'], [4.0, '#ff8ad8']]) { const fl = boule(2.4, mat(c, 'brillant')); fl.position.set(Math.cos(a) * 16 - 1, 11, Math.sin(a) * 16); v.add(fl); }
  }
  // Le casque du DJ : l'arceau par-dessus la tête, deux grosses coques, leur anneau qui luit.
  if (X.includes('casque-audio')) {
    const arceau = new THREE.Mesh(new THREE.TorusGeometry(17.4, 1.9, 8, 26, Math.PI), mat(k.c2, 'brillant'));
    arceau.rotation.y = Math.PI / 2; arceau.position.set(-1, 3, 0); v.add(arceau);
    for (const z of [-1, 1]) {
      const coque = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 5.5, 24), mat('#1a1a2a', 'brillant'));
      coque.rotation.x = Math.PI / 2; coque.position.set(-1, 2, z * 16.4); v.add(coque);
      const anneau = new THREE.Mesh(new THREE.TorusGeometry(5.6, 1.1, 6, 24), mat(k.c1, 'lueur')); anneau.position.set(-1, 2, z * 19.3); v.add(anneau);
    }
  }
}

/* ---- Les accessoires : dans le dos, dans les mains, sur les épaules ---- */
function ajouterAccessoires(P, perso) {
  const k = perso.c;
  const X = perso.look.extras;
  const l = P.car.l;
  const g = P.groupe;

  // La cape : un grand voile accroché aux épaules, qui ondule.
  if (X.includes('cape')) {
    const general = X.includes('general');
    const long = general ? 30 : 0;
    const c = plaque([[-14 * l, 0], [8, 0], [-6, -48], [-10, -104 - long], [-50 - long, -98 - long], [-40 - long * 0.6, -46]], 2, mat(general ? '#a0102a' : perso.id === 'malvortex' ? '#5a0010' : perso.look.tete === 'masque-catch' ? k.c1 : teinte(k.tenue, 0.1), 'voile'));
    P.cape = new THREE.Group(); P.cape.add(c);
    if (general) { const bord = plaque([[-10, -104 - long], [-50 - long, -98 - long], [-50 - long, -95 - long], [-10, -101 - long]], 2.4, mat('#ffd23f', 'metal')); P.cape.add(bord); }
    g.add(P.cape);
  }
  // Les ailes : deux grandes plumes (ou membranes de dragon, ou lumière), qui battent.
  if (X.includes('ailes') || X.includes('ailes-dragon') || X.includes('ailes-lumiere')) {
    P.ailes = [];
    for (const [z, f] of [[-1, 0.8], [1, 1]]) {
      let forme;
      if (X.includes('ailes-dragon')) forme = [[0, 0], [-50 * f, 50 * f], [-70 * f, 6], [-52 * f, -4], [-40 * f, -22], [-22 * f, -18]];
      else { forme = [[0, 0]]; for (let i = 0; i <= 5; i++) { const a = rad(200 + i * 18); const rr = (62 - i * 6) * f; forme.push([Math.cos(a) * rr - 6, -Math.sin(a) * rr]); } }
      const matiere = X.includes('ailes-lumiere') ? mat('#fff2a8', 'voile-lueur') : X.includes('ailes-dragon') ? mat(teinte(k.c2, -0.1), 'voile') : mat(teinte(k.cheveux, z < 0 ? -0.25 : 0), 'voile');
      const aile = plaque(forme, 2, matiere);
      const pivot = new THREE.Group(); pivot.add(aile); pivot.userData.z = z;
      g.add(pivot); P.ailes.push(pivot);
    }
  }
  // La queue : un tube courbe derrière les hanches.
  if (X.includes('queue') || X.includes('queue-dragon')) {
    P.queue = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-6, -2, 0), new THREE.Vector3(-40, -30, -6), new THREE.Vector3(-60, -10, -10)), 16, 4.5, 10, false), mat(X.includes('queue-dragon') ? teinte(k.peau, -0.1) : perso.look.tete === 'loup' ? k.cheveux : k.c1, 'brillant'));
    g.add(P.queue);
  }
  // L'écharpe : un long pan qui flotte derrière le cou.
  if (X.includes('echarpe')) {
    const e = new THREE.Group();
    const tour = new THREE.Mesh(new THREE.TorusGeometry(7.5, 3, 8, 24), mat(k.c1));
    tour.rotation.x = Math.PI / 2;
    const pan = plaque([[0, 2], [-26, -2], [-52, 4], [-50, -6], [-28, -10], [0, -6]], 1.4, mat(k.c1, 'voile'));
    e.add(tour, pan); P.echarpe = e; g.add(e);
  }
  // Le katana dans le dos ; l'horloge géante ; les armes en main.
  if (X.includes('katana')) {
    const k1 = new THREE.Group();
    const lame = maille(GEO.boite(), mat('#1a1a22', 'brillant'), 60, 5, 3); lame.position.x = 30;
    const poignee = maille(GEO.boite(), mat(k.c1), 14, 5.5, 3.5); poignee.position.x = -7;
    k1.add(lame, poignee); P.katanaDos = k1; g.add(k1);
    P.katanaMain = lameDroite(k.c1, '#ffffff');
    g.add(P.katanaMain);
  }
  if (X.includes('epee')) { P.epee = lameDroite('#ffe680', '#ffffff'); g.add(P.epee); }
  if (X.includes('epee-general')) { P.epeeGeneral = epeeGeneral(k); g.add(P.epeeGeneral); }
  if (X.includes('horloge')) {
    const h = new THREE.Group();
    const cercle = new THREE.Mesh(new THREE.TorusGeometry(36, 1.8, 10, 48), mat('#ffd23f', 'metal'));
    const fond = new THREE.Mesh(new THREE.CircleGeometry(34, 40), mat(k.c2, 'voile-lueur'));
    fond.position.z = -1;
    const a1 = maille(GEO.boite(), mat('#ffd23f', 'lueur'), 3, 18, 1.5); a1.geometry = GEO.boite();
    const a2 = maille(GEO.boite(), mat('#ffd23f', 'lueur'), 2, 26, 1.5);
    const p1 = new THREE.Group(); a1.position.y = 9; p1.add(a1);
    const p2 = new THREE.Group(); a2.position.y = 13; p2.add(a2);
    h.add(cercle, fond, p1, p2);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const tr = maille(GEO.boite(), mat(k.c1, 'lueur'), 1.6, i % 3 ? 3 : 5, 1); tr.position.set(Math.cos(a) * 30, Math.sin(a) * 30, 0.5); tr.rotation.z = a + Math.PI / 2; h.add(tr); }
    P.horloge = h; P.aiguilles = [p1, p2]; g.add(h);
  }
  if (X.includes('faux')) {
    const f = new THREE.Group();
    const manche3 = maille(GEO.cylindre(), mat('#2a1b10'), 2, 110, 2); manche3.position.y = -15;
    const lame = plaque([[0, 40], [46, 56], [62, 20], [36, 40], [0, 30]], 2, mat('#d8d8e8', 'metal'));
    lame.position.y = 30;
    f.add(manche3, lame); P.faux = f; g.add(f);
  }
  if (X.includes('trident')) {
    const t = new THREE.Group();
    const or = mat('#d4b04a', 'metal');
    const manche3 = maille(GEO.cylindre(), or, 1.8, 100, 1.8); manche3.position.y = -20;
    t.add(manche3);
    for (const x of [-10, 0, 10]) { const dent = maille(GEO.cone(), or, 2.2, 20, 2.2); dent.position.set(x, 40 + (x ? 0 : 6), 0); t.add(dent); }
    const barre = maille(GEO.boite(), or, 24, 3, 3); barre.position.y = 30; t.add(barre);
    P.trident = t; g.add(t);
  }
  if (X.includes('canon')) {
    const c = new THREE.Group();
    const tube = maille(GEO.cylindre(), mat(teinte(k.tenue, 0.3), 'metal'), 8, 26, 8); tube.rotation.z = -Math.PI / 2; tube.position.x = 17;
    const bout3 = boule(4, mat('#ff5050', 'lueur')); bout3.position.x = 31;
    c.add(tube, bout3); P.canon = c; g.add(c);
  }
  if (X.includes('griffes')) {
    const gr = new THREE.Group();
    for (const z of [-4, 0, 4]) { const d = maille(GEO.cone(), mat('#fff2d8', 'brillant'), 1.8, 15, 1.8); d.rotation.z = -Math.PI / 2; d.position.set(13, 0, z); gr.add(d); }
    P.griffes = gr; g.add(gr);
  }
  if (X.includes('nageoires')) {
    const n = plaque([[0, 0], [-14, 12], [-2, -6]], 1.4, mat(k.c1, 'voile'));
    P.nageoire = n; g.add(n);
  }
  // La bombe de peinture du graffeur, dans la main arrière.
  if (X.includes('bombe')) {
    const b = new THREE.Group();
    const corps3 = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 13, 18), mat(k.c2, 'metal')); corps3.rotation.z = -Math.PI / 2; corps3.position.x = 5;
    const etiquette = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 5, 18), mat(k.c1)); etiquette.rotation.z = -Math.PI / 2; etiquette.position.x = 4;
    const tete = boule(2.1, mat('#f0f0f0', 'brillant')); tete.position.x = 12.5;
    b.add(corps3, etiquette, tete); P.bombe = b; g.add(b);
  }
  // L'éventail de papier.
  if (X.includes('eventail')) {
    const e = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const lame = plaque([[0, -1.2], [28, -4.6], [28, 4.6], [0, 1.2]], 0.8, mat(i % 2 ? '#fff6e8' : k.c1, 'voile'));
      lame.rotation.z = rad(-60 + i * 20); e.add(lame);
    }
    e.add(boule(2, mat('#2a1a10', 'brillant')));
    P.eventail = e; g.add(e);
  }
  // Le grand aimant en fer à cheval, qui flotte derrière l'épaule.
  if (X.includes('aimant')) {
    const a = new THREE.Group();
    const fer = new THREE.Mesh(new THREE.TorusGeometry(12, 4.4, 10, 28, Math.PI), mat(k.c1, 'brillant'));
    fer.rotation.z = Math.PI;
    a.add(fer);
    for (const x of [-12, 12]) { const b = maille(GEO.boite(), mat('#d8dce8', 'metal'), 9, 7, 9); b.position.set(x, 3.5, 0); a.add(b); }
    for (const x of [-12, 12]) { const l = boule(2.6, mat(x < 0 ? k.c1 : k.c2, 'lueur')); l.position.set(x, 8, 0); a.add(l); }
    P.aimant = a; g.add(a);
  }
  // Le revolver du pistolero.
  if (X.includes('revolver')) {
    const r = new THREE.Group();
    const acier = mat('#5a5a6a', 'metal');
    const canon3 = maille(GEO.boite(), acier, 18, 2.8, 2.8); canon3.position.set(12, 2, 0);
    const barillet = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 6.5, 12), acier); barillet.rotation.z = Math.PI / 2; barillet.position.set(3, 1.5, 0);
    const crosse = maille(GEO.boite(), mat('#6a3a1a', 'brillant'), 4.2, 10, 3.4); crosse.position.set(-2, -4, 0); crosse.rotation.z = -0.35;
    r.add(canon3, barillet, crosse); P.revolver = r; g.add(r);
  }
  // Les queues de la renarde : cinq grandes queues touffues au bout blanc, en éventail.
  if (X.includes('queues')) {
    P.queues = [];
    for (let i = 0; i < 5; i++) {
      const q = new THREE.Group();
      const fourrure = mat(i % 2 ? k.cheveux : teinte(k.cheveux, 0.14), 'brillant');
      q.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-26, 4, 0), new THREE.Vector3(-36, 32, 0)), 14, 5.8, 10, false), fourrure));
      const bout = boule(1, mat('#fff6ee', 'brillant')); bout.scale.set(6.2, 9.5, 6.2); bout.position.set(-36, 36, 0);
      q.add(bout);
      q.userData.i = i; g.add(q); P.queues.push(q);
    }
  }
  // Sur les épaules.
  const ep = new THREE.Group();
  if (X.includes('epaulettes-glace')) for (const dx of [-4, 6]) { const c = maille(GEO.cone(), mat('#e6faff', 'verre'), 4, 18, 4); c.position.set(dx, 10, 0); c.rotation.z = rad(dx * 2); ep.add(c); }
  if (X.includes('armure') || X.includes('armure-or') || X.includes('armure-noire')) {
    const c = X.includes('armure-or') ? '#ffd23f' : X.includes('armure-noire') ? '#2a0a10' : teinte(k.tenue, 0.4);
    const sp = new THREE.Mesh(new THREE.SphereGeometry(13 * l, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(c, 'metal'));
    sp.scale.y = 0.75; ep.add(sp);
    if (X.includes('armure-noire')) { const pique = maille(GEO.cone(), mat('#c80014', 'lueur'), 3, 14, 3); pique.position.y = 12; ep.add(pique); }
  }
  if (X.includes('general')) {
    for (let i = 2; i >= 0; i--) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry((18 - i * 2.5) * l, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat('#3a434e', 'metal'));
      sp.scale.y = 0.6; sp.position.y = -i * 6; ep.add(sp);
      const bord = new THREE.Mesh(new THREE.TorusGeometry((18 - i * 2.5) * l * 0.98, 0.9, 6, 30), mat('#ffd23f', 'metal'));
      bord.rotation.x = Math.PI / 2; bord.position.y = -i * 6 + 1.6; ep.add(bord);
    }
    for (let i = 0; i < 3; i++) { const p = maille(GEO.cone(), mat('#ffd23f', 'metal'), 2.6, 14 + (i === 1 ? 5 : 0), 2.6); p.position.set(-8 + i * 8, 10, 0); ep.add(p); }
  }
  if (ep.children.length) { P.epauliere = ep; g.add(ep); }
  if (X.includes('brassards')) { const b = new THREE.Mesh(new THREE.TorusGeometry(7, 2, 8, 24), mat('#ffd23f', 'metal')); P.brassard = b; g.add(b); }
}

function lameDroite(c, pointe) {
  const e = new THREE.Group();
  const lame = plaque([[4, -2.5], [74, -1], [80, 0], [74, 1], [4, 2.5]], 1.4, mat(pointe, 'metal'));
  const reflet = plaque([[6, 0], [72, 0], [72, 0.8], [6, 1.2]], 1.6, mat(c, 'lueur'));
  const garde = maille(GEO.boite(), mat('#ffd23f', 'metal'), 4, 12, 6);
  const poignee = maille(GEO.boite(), mat('#2a1a10'), 14, 4.4, 4.4); poignee.position.x = -8;
  e.add(lame, reflet, garde, poignee);
  return e;
}

function epeeGeneral(k) {
  const e = new THREE.Group();
  const lame = plaque([[12, -6.5], [92, -4.5], [108, 0], [92, 4.5], [12, 6.5]], 2.2, mat('#c8d2e2', 'metal'));
  const fil = plaque([[14, -0.8], [84, -0.5], [84, 0.5], [14, 0.8]], 2.6, mat(k.c1, 'lueur'));
  const garde = plaque([[8, -3], [11, -14], [17, -13], [13, -3], [13, 3], [17, 13], [11, 14], [8, 3]], 5, mat('#ffd23f', 'metal'));
  const pierre = boule(2.6, mat('#c8102e', 'brillant')); pierre.position.set(10.5, 0, 3);
  const poignee = maille(GEO.cylindre(), mat('#3a2210'), 2.8, 20, 2.8); poignee.rotation.z = Math.PI / 2; poignee.position.x = -2;
  const pommeau = boule(5, mat('#ffd23f', 'metal')); pommeau.position.x = -14;
  e.add(lame, fil, garde, pierre, poignee, pommeau);
  e.userData.fil = fil;
  return e;
}

/* ------------------------------------------------------------------ */
/* La pose                                                             */
/* ------------------------------------------------------------------ */

const V = (p, z = 0) => new THREE.Vector3(p.x, -p.y, z);

function poser(P, sq, o) {
  const { pose, hanche, jambes, epaule, cou, tete, epA, epR, coudeA, mainA, coudeR, mainR } = sq;
  const t = o.t || 0;
  const l = P.car.l;
  const zJ = 8 * l;
  const zB = 15 * l;
  P.bassin.position.copy(V(hanche)); P.bassin.position.y -= 3;
  // Les jambes : celle de devant vers nous, l'autre derrière.
  // Le haut des cuisses un peu sous la ceinture (sinon leur rondeur dépasse).
  const H_A = V(hanche, zJ * 0.8); const H_R = V(hanche, -zJ * 0.8);
  H_A.y -= 4; H_R.y -= 4;
  const KA = V(jambes.ka, zJ); const FA = V(jambes.fa, zJ);
  const KR = V(jambes.kr, -zJ); const FR = V(jambes.fr, -zJ);
  placer(P.cuisseA, H_A, KA); placer(P.tibiaA, KA, FA);
  placer(P.cuisseR, H_R, KR); placer(P.tibiaR, KR, FR);
  const orienterPied = (pied, f, kk, z) => {
    pied.position.copy(f);
    const a = Math.atan2(f.y - kk.y, f.x - kk.x) + Math.PI / 2;
    pied.rotation.set(0, 0, a * 0.2);
    pied.position.z = z;
  };
  orienterPied(P.piedA, FA, KA, zJ); orienterPied(P.piedR, FR, KR, -zJ);

  // Le buste : planté sur les hanches, penché comme la pose, tourné vers nous.
  P.buste.position.copy(V(hanche));
  P.buste.rotation.set(0, rad(-14), rad(pose.b));
  if (P.jupe) { P.jupe.position.copy(V(hanche)); P.jupe.rotation.set(0, 0, Math.sin(t / 7) * 0.04); }

  // Les bras : l'épaule de devant vers nous.
  const EA = V(epA, zB); const ER = V(epR, -zB);
  P.epauleA.position.copy(EA); P.epauleR.position.copy(ER);
  const CA = V(coudeA, zB + 2); const MA = V(mainA, zB + 3);
  const CR = V(coudeR, -zB - 1); const MR = V(mainR, -zB - 2);
  placer(P.brasA, EA, CA); placer(P.avantBrasA, CA, MA);
  placer(P.brasR, ER, CR); placer(P.avantBrasR, CR, MR);
  P.mainA.position.copy(MA); P.mainR.position.copy(MR);
  if (P.mancheA) {
    const manche = (mc, e, c) => { tmp.subVectors(e, c); const l2 = tmp.length() * 0.42; tmp.normalize(); mc.position.copy(e).addScaledVector(tmp, -l2 / 2 - 1); mc.quaternion.setFromUnitVectors(Y, tmp); mc.scale.set(1, l2, 1); };
    manche(P.mancheA, EA, CA); manche(P.mancheR, ER, CR);
  }
  // Le poing prolonge l'avant-bras.
  P.mainA.rotation.set(0, 0, Math.atan2(MA.y - CA.y, MA.x - CA.x));
  P.mainR.rotation.set(0, 0, Math.atan2(MR.y - CR.y, MR.x - CR.x));
  if (P.basA) {
    const evase = (bas, f, kk) => { tmp.subVectors(kk, f).normalize(); bas.position.copy(f).addScaledVector(tmp, 5.5); bas.quaternion.setFromUnitVectors(Y, tmp); };
    evase(P.basA, FA, KA); evase(P.basR, FR, KR);
  }
  if (P.bouts) P.bouts.rotation.set(0, 0, Math.sin(t / 6) * 0.1 - rad(pose.b) * 0.8);

  // Le cou, la tête.
  const T = P.tete;
  placer(P.cou, V(cou), V(tete).add(new THREE.Vector3(0, -8, 0)));
  T.groupe.position.copy(V(tete));
  T.groupe.rotation.set(0, 0, rad((pose.b + (pose.tt || 0)) * 0.35));
  const touche = ['touche', 'vol', 'ko', 'sol'].includes(o.pose);
  const ko = o.pose === 'ko';
  // K.O. : les yeux se ferment.
  for (const e of T.yeux) { e.userData.sy ??= e.scale.y; e.scale.y = ko ? e.userData.sy * 0.18 : e.userData.sy; }
  for (const p of T.pupilles) p.visible = !ko;
  if (T.bouche) { T.bouche.scale.y = touche ? 4.4 : 1.6; T.bouche.scale.z = touche ? 4 : 7; }
  if (T.forme) { const e = expression(sq.nomPose); if (e !== T.expr) { T.expr = e; T.forme.material = T.matExpr(e); } }
  if (T.pans) T.pans.rotation.set(0, 0, Math.sin(t / 5) * 0.12 - 0.05);
  if (T.panache) T.panache.rotation.z = Math.sin(t / 6) * 0.06;
  if (T.halo) T.halo.position.y = 30 + Math.sin(t / 10) * 2;
  if (T.couronne) T.couronne.rotation.y = t / 40;
  if (T.dos) T.dos.rotation.z = rad(-12) + Math.sin(t / 8) * 0.05;

  // Les accessoires suivent le corps.
  const dos = V(epaule, -10 * l);
  if (P.cape) { P.cape.position.copy(dos); P.cape.rotation.set(0, 0, rad(pose.b) * 0.5 + Math.sin(t / 7) * 0.05); }
  if (P.ailes) for (const a of P.ailes) {
    a.position.set(epaule.x - 6, -(epaule.y + 6), -14 * l + a.userData.z * 4);
    a.rotation.set(0, a.userData.z * 0.35, Math.sin(t / 6) * 0.14 + (pose.rot ? 0.3 : 0));
  }
  if (P.queue) { P.queue.position.copy(V(hanche, -6)); P.queue.rotation.set(0, 0, Math.sin(t / 6) * 0.1); }
  if (P.echarpe) {
    P.echarpe.position.copy(V(cou)); P.echarpe.rotation.set(0, rad(-28), Math.sin(t / 5) * 0.06);
    P.echarpe.children[1].rotation.set(0, rad(28), rad(-14) + Math.sin(t / 4) * 0.06);
  }
  if (P.katanaDos) {
    const attaque = ['poing', 'ruee', 'tourne', 'uppercut', 'lance', 'ulti', 'poing-air', 'saisie'].includes(o.pose);
    P.katanaDos.visible = !attaque; P.katanaMain.visible = attaque;
    P.katanaDos.position.copy(V(epaule, -12 * l)); P.katanaDos.rotation.set(0, 0, rad(130));
    if (attaque) tenir(P.katanaMain, MA, CA);
  }
  if (P.epee) tenir(P.epee, MA, CA);
  if (P.epeeGeneral) {
    const attaque = ['poing', 'ruee', 'tourne', 'uppercut', 'lance', 'ulti', 'poing-air', 'saisie'].includes(o.pose);
    if (attaque) tenir(P.epeeGeneral, MA, CA); else { P.epeeGeneral.position.copy(MA); P.epeeGeneral.rotation.set(0, 0, -rad(72)); }
    P.epeeGeneral.userData.fil.visible = attaque;
  }
  if (P.horloge) {
    P.horloge.position.set(epaule.x - 14, -(epaule.y - 26), -26 * l);
    P.aiguilles[0].rotation.z = -t / 40; P.aiguilles[1].rotation.z = -t / 6;
  }
  if (P.faux) { P.faux.position.copy(MR); P.faux.rotation.set(0, 0, Math.atan2(MR.y - CR.y, MR.x - CR.x) - Math.PI / 2); }
  if (P.trident) { P.trident.position.copy(MR); P.trident.rotation.set(0, 0, Math.atan2(MR.y - CR.y, MR.x - CR.x) - Math.PI / 2); }
  if (P.canon) tenir(P.canon, MA, CA, true);
  if (P.griffes) tenir(P.griffes, MA, CA);
  if (P.nageoire) { P.nageoire.position.copy(MR); }
  if (P.bombe) tenir(P.bombe, MR, CR);
  if (P.eventail) tenir(P.eventail, MR, CR);
  if (P.revolver) tenir(P.revolver, MA, CA);
  if (P.aimant) { P.aimant.position.set(epaule.x - 38, -(epaule.y + 4) + Math.sin(t / 12) * 3, -24 * l); P.aimant.rotation.set(0, 0, 0.9 + Math.sin(t / 20) * 0.12); P.aimant.scale.setScalar(1.25); }
  if (P.queues) for (const q of P.queues) {
    const i = q.userData.i;
    q.position.copy(V(hanche, -6 - i * 1.5));
    q.rotation.set(rad((i - 2) * 16), 0, rad(-34 + i * 17) + Math.sin(t / 7 + i) * 0.12);
  }
  if (P.epauliere) { P.epauliere.position.copy(V(epaule, zB * 0.7)); P.epauliere.position.y -= 2; P.epauliere.rotation.set(0, 0, rad(pose.b) * 0.6 - 0.15); }
  if (P.brassard) { P.brassard.position.copy(CA).lerp(EA, 0.5); P.brassard.rotation.set(Math.PI / 2, 0, Math.atan2(CA.y - EA.y, CA.x - EA.x)); }
  if (P.aiguille) P.aiguille.rotation.z = -t / 30;
}

/** Une arme tenue en main : elle prolonge l'avant-bras (ou part du coude, pour le canon). */
function tenir(obj, main, coude, depuisCoude = false) {
  const a = Math.atan2(main.y - coude.y, main.x - coude.x);
  obj.position.copy(depuisCoude ? coude : main);
  obj.rotation.set(0, 0, a);
}
