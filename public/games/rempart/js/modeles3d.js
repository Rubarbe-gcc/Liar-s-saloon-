/**
 * REMPART — les modèles 3D, faits de formes simples (style « low-poly »).
 *
 * Tours : un socle qui change avec le niveau (bois, pierre, pierre claire et
 * or) et une tête propre à chaque type, qui se garnit à chaque niveau.
 * Ennemis : les Rouilleux, bêtes de ferraille rouillée aux yeux qui brillent.
 * Chaque modèle se tourne vers +z (son « devant »).
 */

import * as THREE from '../../../vendor/three/three.module.min.js';

const G = {}, M = {};
const geo = (k, f) => (G[k] ??= f());
const mat = (k, o) => (M[k] ??= new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.72, metalness: 0.08, ...o }));

function piece(g, m, x = 0, y = 0, z = 0, parent = null) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  if (parent) parent.add(o);
  return o;
}

const cyl = (rt, rb, h, s = 8) => geo(`cyl${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const boite = (x, y, z) => geo(`box${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z));
const boule = (r, w = 10, h = 8) => geo(`sph${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const octa = r => geo(`oct${r}`, () => new THREE.OctahedronGeometry(r));
const cone = (r, h, s = 6) => geo(`cone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const tore = (r, t, s = 8, n = 16) => geo(`tor${r},${t}`, () => new THREE.TorusGeometry(r, t, s, n));

const lueur = (couleur, i = 1.2) => mat(`lueur${couleur}${i}`, { color: couleur, emissive: couleur, emissiveIntensity: i, roughness: 0.4 });

/* ================================================================ TOURS */

const SOCLES = [
  { corps: '#8a5a32', bas: '#8d8a84', h: 0.34, r: 0.36 },
  { corps: '#a29d94', bas: '#77736d', h: 0.46, r: 0.39 },
  { corps: '#d8d0bf', bas: '#9a9284', h: 0.58, r: 0.41 },
  { corps: '#4a4458', bas: '#2e2a38', h: 0.64, r: 0.43 },
];

function socle(niveau, accent, g, eclat = accent) {
  const s = SOCLES[niveau - 1];
  piece(cyl(s.r + 0.08, s.r + 0.11, 0.1, 8), mat(`socleBas${niveau}`, { color: s.bas }), 0, 0.05, 0, g);
  piece(cyl(s.r, s.r + 0.06, s.h, 8), mat(`socle${niveau}`, { color: s.corps }), 0, 0.1 + s.h / 2, 0, g);
  if (niveau >= 2) piece(cyl(s.r + 0.02, s.r + 0.02, 0.06, 8), niveau >= 3 ? OR : METAL, 0, 0.1 + s.h * 0.72, 0, g);
  if (niveau >= 3) {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      piece(cone(0.05, niveau === 4 ? 0.24 : 0.16, 4), niveau === 4 ? lueur(eclat, 1.4) : OR, Math.cos(a) * s.r, 0.18 + s.h, Math.sin(a) * s.r, g);
    }
  }
  if (niveau === 4) piece(cyl(s.r + 0.03, s.r + 0.03, 0.04, 8), lueur(eclat, 1.1), 0, 0.1 + s.h * 0.35, 0, g);
  // Une gemme à la couleur de la tour, sur le devant du socle.
  const gemme = piece(octa(0.06), lueur(accent, 0.9), 0, 0.1 + s.h * 0.45, s.r + 0.03, g);
  gemme.scale.set(1, 1.4, 0.6);
  return 0.1 + s.h;
}

const METAL = mat('metal', { color: '#5d6470', metalness: 0.55, roughness: 0.45 });
const METAL_SOMBRE = mat('metalSombre', { color: '#34383f', metalness: 0.6, roughness: 0.45 });
const OR = mat('or', { color: '#e8b84a', metalness: 0.85, roughness: 0.3, emissive: '#5a3a00', emissiveIntensity: 0.3 });
const CUIVRE = mat('cuivre', { color: '#c17a43', metalness: 0.7, roughness: 0.35 });
const BOIS = mat('bois', { color: '#7a4f2c' });
const GLACE = mat('glace', { color: '#a8ecff', emissive: '#2a9fe0', emissiveIntensity: 0.55, transparent: true, opacity: 0.88, roughness: 0.1, metalness: 0.1 });

const TETES = {
  rafale(n, t, b) {
    const corps = piece(boite(0.34, 0.24, 0.34), n === 1 ? BOIS : n === 2 ? METAL : METAL_SOMBRE, 0, 0.12, 0, t);
    if (n === 3) piece(boite(0.36, 0.04, 0.36), OR, 0, 0.26, 0, t);
    piece(cyl(0.1, 0.1, 0.12, 10), lueur('#ff9a3c', 0.8), 0.2, 0.14, -0.04, t).rotation.z = Math.PI / 2;
    const canons = new THREE.Group();
    canons.position.set(0, 0.13, 0.17);
    t.add(canons);
    if (b === 1) {
      // Le Tireur d'élite : un seul canon, très long, et une lunette.
      piece(cyl(0.035, 0.05, 0.9, 8), METAL_SOMBRE, 0, 0, 0.42, canons).rotation.x = Math.PI / 2;
      piece(cyl(0.04, 0.04, 0.26, 8), lueur('#ff5a3c', 1.2), 0, 0.09, 0.12, canons).rotation.x = Math.PI / 2;
      return { canons };
    }
    const nb = b === 0 ? 5 : n, rond = nb >= 3, ray = nb >= 5 ? 0.09 : 0.075;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2;
      const x = rond ? Math.cos(a) * ray : (i - (nb - 1) / 2) * 0.12;
      const y = rond ? Math.sin(a) * ray : 0;
      piece(cyl(0.04, 0.05, 0.44, 8), rond ? METAL : METAL_SOMBRE, x, y, 0.22, canons).rotation.x = Math.PI / 2;
    }
    if (n >= 2) piece(cyl(0.065, 0.065, 0.05, 10), n === 3 ? OR : CUIVRE, 0, 0, 0.36, canons).rotation.x = Math.PI / 2;
    void corps;
    return { canons, tourne: rond ? canons : null };
  },
  mortier(n, t) {
    piece(cyl(0.3, 0.34, 0.22, 10), METAL_SOMBRE, 0, 0.11, 0, t);
    if (n >= 2) piece(tore(0.31, 0.03), n === 3 ? OR : CUIVRE, 0, 0.2, 0, t).rotation.x = Math.PI / 2;
    const canons = new THREE.Group();
    canons.position.set(0, 0.22, 0);
    canons.rotation.x = 0.75;
    t.add(canons);
    const nb = n === 3 ? 2 : 1;
    for (let i = 0; i < nb; i++) {
      const x = nb > 1 ? (i - 0.5) * 0.24 : 0;
      const r = 0.12 + n * 0.015;
      piece(cyl(r, r + 0.04, 0.5, 10), mat('tubeMortier', { color: '#2f2c2a', metalness: 0.5 }), x, 0.22, 0, canons);
      piece(tore(r + 0.01, 0.025), n >= 2 ? CUIVRE : BOIS, x, 0.42, 0, canons).rotation.x = Math.PI / 2;
      piece(cyl(r - 0.03, r - 0.03, 0.02, 10), lueur('#ff5a2a', 1.4), x, 0.475, 0, canons);
    }
    return { canons };
  },
  givre(n, t) {
    piece(cyl(0.08, 0.13, 0.34, 6), mat('givrePilier', { color: '#d9eef5' }), 0, 0.17, 0, t);
    const cristal = new THREE.Group();
    cristal.position.y = 0.62 + n * 0.04;
    t.add(cristal);
    const gros = piece(octa(0.17 + n * 0.035), GLACE, 0, 0, 0, cristal);
    gros.scale.y = 1.5;
    const orbite = new THREE.Group();
    cristal.add(orbite);
    if (n >= 2) {
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        piece(octa(0.06), GLACE, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, orbite).scale.y = 1.6;
      }
    }
    if (n === 3) piece(tore(0.38, 0.018, 6, 32), lueur('#7fe0ff', 1.2), 0, 0, 0, orbite).rotation.x = Math.PI / 2;
    return { cristal, orbite, fixe: true };
  },
  perce(n, t) {
    piece(boite(0.3, 0.14, 0.3), METAL_SOMBRE, 0, 0.07, 0, t);
    const canons = new THREE.Group();
    canons.position.y = 0.2;
    t.add(canons);
    const violet = mat('perceViolet', { color: '#3a3350', metalness: 0.5, roughness: 0.4 });
    const rails = n === 3 ? [-0.06, 0.06] : [0];
    for (const x of rails) piece(boite(0.07, 0.07, 0.95), violet, x, 0, 0.12, canons);
    const lg = 0.36 + n * 0.06;
    for (const s of [-1, 1]) {
      const bras = piece(boite(lg, 0.05, 0.06), n === 1 ? BOIS : METAL, s * lg / 2, 0.02, 0.38, canons);
      bras.rotation.y = s * 0.35;
    }
    if (n >= 2) for (const z of [-0.1, 0.12]) piece(tore(0.09, 0.022), lueur('#b06cff', 1), 0, 0, z, canons);
    const carreau = piece(boite(0.03, 0.03, 0.5), lueur('#d9a8ff', 1.6), 0, 0.06, 0.3, canons);
    if (n === 3) piece(boite(0.05, 0.02, 0.8), lueur('#b06cff', 1.4), 0, 0.045, 0.12, canons);
    return { canons, carreau };
  },
  braise(n, t) {
    // Un brasero de fer, une citerne et une buse qui crache le feu.
    piece(cyl(0.26, 0.2, 0.2, 10), METAL_SOMBRE, 0, 0.1, 0, t);
    piece(cyl(0.22, 0.22, 0.03, 10), lueur('#ff6a1a', 1.6), 0, 0.2, 0, t);
    for (let i = 0; i < n; i++) piece(boule(0.1, 8, 6), mat('citerne', { color: '#a8321e', metalness: 0.4 }), (i - (n - 1) / 2) * 0.17, 0.2, -0.2, t);
    const canons = new THREE.Group();
    canons.position.set(0, 0.22, 0.05);
    t.add(canons);
    piece(cyl(0.05, 0.08, 0.36, 8), n >= 3 ? OR : CUIVRE, 0, 0, 0.18, canons).rotation.x = Math.PI / 2;
    const flamme = piece(cone(0.07, 0.22, 6), lueur('#ffb347', 2), 0, 0, 0.44, canons);
    flamme.rotation.x = Math.PI / 2;
    flamme.castShadow = false;
    return { canons, flamme };
  },
  phare(n, t) {
    // Un phare rayé, une lanterne et un faisceau qui tourne.
    const blanc = mat('phareBlanc', { color: '#f2ece0' }), rouge = mat('phareRouge', { color: '#c0392b' });
    const etages = n + 2;
    for (let i = 0; i < etages; i++) piece(cyl(0.16 - i * 0.012, 0.18 - i * 0.012, 0.16, 10), i % 2 ? rouge : blanc, 0, 0.08 + i * 0.16, 0, t);
    const haut = etages * 0.16;
    piece(cyl(0.16, 0.16, 0.04, 10), METAL_SOMBRE, 0, haut + 0.02, 0, t);
    const lampe = piece(cyl(0.11, 0.11, 0.18, 10), lueur('#fff2b0', 2.2), 0, haut + 0.13, 0, t);
    lampe.castShadow = false;
    piece(cone(0.16, 0.16, 10), n >= 3 ? OR : rouge, 0, haut + 0.3, 0, t);
    const faisceau = new THREE.Group();
    faisceau.position.y = haut + 0.13;
    const rayon = new THREE.Mesh(geo('faisceau', () => { const g = new THREE.ConeGeometry(0.45, 3, 16, 1, true); g.translate(0, -1.5, 0); g.rotateX(-Math.PI / 2); return g; }),
      mat('faisceauMat', { color: '#fff2b0', emissive: '#fff2b0', emissiveIntensity: 1, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    rayon.rotation.x = -0.25;
    faisceau.add(rayon);
    t.add(faisceau);
    return { faisceau, lampe, fixe: true };
  },
  harpon(n, t, b) {
    // Une grande arbalète tournée vers le ciel, un harpon chargé.
    piece(cyl(0.22, 0.26, 0.14, 8), METAL_SOMBRE, 0, 0.07, 0, t);
    const canons = new THREE.Group();
    canons.position.y = 0.26;
    canons.rotation.x = -0.55;
    t.add(canons);
    const vert = mat('harponVert', { color: '#2a6a5a', metalness: 0.4 });
    piece(boite(0.1, 0.1, 0.7 + n * 0.08), vert, 0, 0, 0.1, canons);
    for (const sg of [-1, 1]) piece(boite(0.4 + n * 0.06, 0.05, 0.06), n === 1 ? BOIS : METAL, sg * (0.22 + n * 0.03), 0.02, 0.3, canons).rotation.y = sg * 0.4;
    const carreau = piece(boite(0.04, 0.04, b === 1 ? 0.9 : 0.6), mat('harponFer', { color: '#8aa8a0', metalness: 0.8, roughness: 0.3 }), 0, 0.08, 0.25, canons);
    piece(cone(0.06, 0.14, 4), lueur('#8af0c8', 1.4), 0, 0.08, 0.25 + (b === 1 ? 0.5 : 0.36), canons).rotation.x = Math.PI / 2;
    if (b === 0) piece(tore(0.16, 0.02, 6, 12), lueur('#8af0c8', 1.2), 0, 0.08, 0.5, canons);
    return { canons, carreau };
  },
  piegeur(n, t) {
    // Un atelier trapu : une cuve à mines et un bras qui les lance.
    piece(boite(0.4, 0.22, 0.4), mat('piegeurCaisse', { color: '#6a5a30' }), 0, 0.11, 0, t);
    for (let i = 0; i < n + 1; i++) piece(cyl(0.07, 0.08, 0.05, 8), mat('mineMat', { color: '#4a4030', metalness: 0.6 }), -0.12 + (i % 2) * 0.24, 0.25 + Math.floor(i / 2) * 0.05, -0.1, t);
    const canons = new THREE.Group();
    canons.position.set(0, 0.26, 0.05);
    t.add(canons);
    const bras = piece(boite(0.06, 0.06, 0.4), n >= 3 ? OR : METAL, 0, 0.05, 0.15, canons);
    bras.rotation.x = -0.4;
    piece(boule(0.06, 6, 4), lueur('#ff3a1a', 2), 0, 0.14, 0.33, canons);
    return { canons };
  },
  aimant(n, t, b) {
    // Un grand aimant en fer à cheval sur un pilier.
    piece(cyl(0.1, 0.16, 0.4, 8), METAL_SOMBRE, 0, 0.2, 0, t);
    const aimant = new THREE.Group();
    aimant.position.y = 0.62;
    t.add(aimant);
    const rouge = b === 0 ? lueur('#5ab8ff', 0.6) : mat('aimantRouge', { color: '#d03a3a', metalness: 0.4 });
    const fer = piece(geo('ferCheval', () => new THREE.TorusGeometry(0.2 + n * 0.02, 0.07, 8, 16, Math.PI)), rouge, 0, 0, 0, aimant);
    fer.rotation.z = Math.PI;
    for (const s of [-1, 1]) piece(boite(0.15, 0.12, 0.15), mat('aimantBout', { color: '#d8dce4', metalness: 0.8 }), s * (0.2 + n * 0.02), 0.04, 0, aimant);
    if (n >= 2) piece(tore(0.12, 0.02), n === 3 ? OR : CUIVRE, 0, -0.32, 0, t).rotation.x = Math.PI / 2;
    return { aimant, fixe: true };
  },
  garnison(n, t) {
    // Un petit poste de garde : murs, toit, et un étendard.
    const pierre = mat('poste', { color: n === 1 ? '#8a6a4a' : '#9a9aa8' });
    piece(boite(0.5, 0.3, 0.5), pierre, 0, 0.15, 0, t);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) piece(boite(0.1, 0.1, 0.1), pierre, x, 0.35, z, t);
    const toit = piece(cone(0.32, 0.3, 4), n === 3 ? OR : mat('toit', { color: '#7a3a2a' }), 0, 0.5, 0, t);
    toit.rotation.y = Math.PI / 4;
    piece(cyl(0.015, 0.015, 0.5, 4), METAL, 0.22, 0.55, 0.22, t);
    const etendard = piece(geo('etendard', () => new THREE.PlaneGeometry(0.22, 0.14)), mat('etendardMat', { color: '#3a5aa8', side: THREE.DoubleSide }), 0.33, 0.72, 0.22, t);
    etendard.castShadow = false;
    return { etendard, fixe: true };
  },
  rayon(n, t, b) {
    // Un trépied et une lentille de cristal d'ambre.
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const pied = piece(cyl(0.02, 0.03, 0.4, 4), n === 3 ? OR : METAL, Math.cos(a) * 0.12, 0.18, Math.sin(a) * 0.12, t);
      pied.rotation.z = Math.cos(a) * 0.3; pied.rotation.x = -Math.sin(a) * 0.3;
    }
    const canons = new THREE.Group();
    canons.position.y = 0.42;
    t.add(canons);
    const lentille = piece(octa(0.12 + n * 0.02), lueur(b === 0 ? '#ff8af0' : '#ffc83a', 1.6), 0, 0.05, 0.08, canons);
    lentille.scale.set(1, 1, 0.6);
    piece(tore(0.13 + n * 0.02, 0.02), n >= 2 ? OR : CUIVRE, 0, 0.05, 0.08, canons);
    return { canons, lentille };
  },
  foudre(n, t) {
    piece(cyl(0.09, 0.15, 0.62, 8), CUIVRE, 0, 0.31, 0, t);
    for (let i = 0; i <= n; i++) piece(tore(0.19 - i * 0.025, 0.035), i % 2 ? METAL : CUIVRE, 0, 0.14 + i * 0.15, 0, t).rotation.x = Math.PI / 2;
    const orbe = piece(boule(0.13 + n * 0.03, 12, 10), lueur('#ffe14d', 1.5), 0, 0.72 + n * 0.03, 0, t);
    const orbite = new THREE.Group();
    orbite.position.y = orbe.position.y;
    t.add(orbite);
    if (n === 3) for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      piece(boule(0.05, 8, 6), lueur('#fff6a8', 2), Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, orbite);
    }
    return { orbe, orbite, fixe: true };
  },
};

const ECHELLE_TOUR = 1.22;

/** Une tour, prête à poser : { groupe, tete, parts, hauteur }. */
export function creerTour(type, niveau, accent, branche = null, eclat = accent) {
  const groupe = new THREE.Group();
  const h = socle(niveau, accent, groupe, eclat);
  const tete = new THREE.Group();
  tete.position.y = h;
  groupe.add(tete);
  const parts = TETES[type](Math.min(3, niveau), tete, niveau === 4 ? branche : null);
  if (niveau === 4) {
    // Une couronne d'éclats à la couleur de la spécialisation.
    const couronne = new THREE.Group();
    couronne.position.y = h + 0.5;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const o = piece(octa(0.055), lueur(eclat, 1.8), Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, couronne);
      o.scale.y = 1.6;
      o.castShadow = false;
    }
    groupe.add(couronne);
    parts.couronne = couronne;
  }
  groupe.scale.setScalar(0.01);
  return { groupe, tete, parts, hauteur: h * ECHELLE_TOUR, type, niveau, recul: 0, apparition: 0 };
}

/** Anime une tour : rotation de la tête, recul après un tir, cristaux qui tournent. */
export function animerTour(m, t, dt, angle) {
  const p = m.parts;
  if (!p.fixe && angle != null) {
    let d = angle - m.tete.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.tete.rotation.y += d * Math.min(1, dt * 14);
  }
  m.recul = Math.max(0, m.recul - dt * 5);
  if (p.canons) p.canons.position.z = (m.type === 'rafale' ? 0.17 : 0) - m.recul * 0.08;
  if (p.tourne) p.tourne.rotation.z += dt * (4 + m.recul * 30);
  if (p.carreau) p.carreau.visible = m.recul < 0.3;
  if (p.cristal) { p.cristal.rotation.y += dt * 1.2; p.cristal.position.y = 0.62 + m.niveau * 0.04 + Math.sin(t * 2) * 0.04 + m.recul * 0.06; }
  if (p.orbite) p.orbite.rotation.y -= dt * 2.2;
  if (p.orbe) p.orbe.scale.setScalar(1 + m.recul * 0.5 + Math.sin(t * 9) * 0.03);
  if (p.flamme) { p.flamme.scale.set(1, 1 + m.recul * 2.5 + Math.sin(t * 30) * 0.15, 1); p.flamme.position.z = 0.44 + m.recul * 0.18; }
  if (p.faisceau) p.faisceau.rotation.y += dt * 1.4;
  if (p.lampe) p.lampe.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
  if (p.aimant) p.aimant.scale.setScalar(1 + m.recul * 0.25);
  if (p.etendard) p.etendard.rotation.y = Math.sin(t * 3) * 0.3;
  if (p.lentille) p.lentille.rotation.z += dt * 2;
  if (p.couronne) { p.couronne.rotation.y += dt * 1.6; p.couronne.position.y = m.hauteur / 1.22 + 0.5 + Math.sin(t * 2) * 0.05; }
  // Apparition : la tour sort de terre avec un petit rebond.
  if (m.apparition < 1) {
    m.apparition = Math.min(1, m.apparition + dt * 3);
    const u = m.apparition, s = 1 + Math.sin(u * Math.PI) * 0.18;
    m.groupe.scale.setScalar(s * u * ECHELLE_TOUR);
  }
}

/* ============================================================== ENNEMIS */

const ROUILLE = '#a0522d', ROUILLE_SOMBRE = '#6e3b1f', FER = '#5a5a5a';

/** Chaque ennemi a ses matériaux à lui (pour l'éclat d'un coup, le bleu du gel). */
function matsPropres() {
  const liste = [];
  const m = (couleur, o = {}) => {
    const x = new THREE.MeshStandardMaterial({ color: couleur, flatShading: true, roughness: 0.7, metalness: 0.2, ...o });
    liste.push(x);
    return x;
  };
  return { liste, m };
}

function yeux(g, couleur, x, y, z, r = 0.045) {
  for (const s of [-1, 1]) piece(boule(r, 6, 5), lueur(couleur, 2), s * x, y, z, g).castShadow = false;
}

function pattes(g, n, matP, ecart, long, h = 0.2, ep = 0.05) {
  const liste = [];
  for (let i = 0; i < n; i++) {
    const cote = i % 2 ? 1 : -1, rang = Math.floor(i / 2);
    const pivot = new THREE.Group();
    pivot.position.set(cote * ecart, h, (rang - (n / 2 - 1) / 2) * long);
    piece(boite(ep, h, ep), matP, 0, -h / 2, 0, pivot);
    g.add(pivot);
    liste.push({ pivot, phase: (i % 2) * Math.PI + rang * Math.PI });
  }
  return liste;
}

const ENNEMIS3D = {
  rodeur(g, m) {
    const corps = piece(boule(0.26, 10, 8), m(ROUILLE), 0, 0.3, 0, g);
    corps.scale.set(1, 0.75, 1.1);
    piece(boite(0.3, 0.06, 0.34), m(ROUILLE_SOMBRE), 0, 0.47, -0.02, g);
    yeux(g, '#ffd23f', 0.08, 0.34, 0.25);
    return { pattes: pattes(g, 4, m(FER), 0.2, 0.26, 0.2), haut: 0.7, rythme: 9 };
  },
  filou(g, m) {
    const corps = piece(geo('capsFilou', () => new THREE.CapsuleGeometry(0.1, 0.26, 4, 8)), m('#c0703a'), 0, 0.24, 0, g);
    corps.rotation.x = Math.PI / 2;
    piece(boule(0.1, 8, 6), m('#8a4a24'), 0, 0.28, 0.2, g);
    for (const s of [-1, 1]) piece(cone(0.04, 0.12, 4), m(ROUILLE_SOMBRE), s * 0.06, 0.4, 0.18, g);
    yeux(g, '#ff4a3a', 0.045, 0.3, 0.29, 0.03);
    const queue = piece(cyl(0.015, 0.025, 0.3, 4), m(FER), 0, 0.36, -0.24, g);
    queue.rotation.x = -0.8;
    return { pattes: pattes(g, 4, m(FER), 0.08, 0.22, 0.17, 0.035), haut: 0.6, rythme: 18, queue };
  },
  cuirasse(g, m) {
    for (const s of [-1, 1]) piece(boite(0.14, 0.18, 0.7), m('#2b2b2b'), s * 0.26, 0.1, 0, g);
    piece(boite(0.42, 0.28, 0.6), m('#5b5f66', { metalness: 0.5 }), 0, 0.32, 0, g);
    piece(boite(0.5, 0.08, 0.5), m(ROUILLE), 0, 0.5, -0.02, g);
    piece(boite(0.3, 0.06, 0.03), lueur('#5ad8ff', 1.8), 0, 0.38, 0.31, g);
    piece(cyl(0.04, 0.05, 0.2, 6), m(FER), 0.12, 0.62, -0.18, g);
    return { haut: 0.85, rythme: 5, chenilles: true };
  },
  bourdon(g, m) {
    const corps = piece(boule(0.17, 10, 8), m('#d9a53a'), 0, 0, 0, g);
    corps.scale.set(1, 0.9, 1.3);
    for (const z of [-0.06, 0.06]) piece(cyl(0.172, 0.172, 0.04, 10), m('#3a2a1a'), 0, 0, z, g).rotation.x = Math.PI / 2;
    piece(boule(0.1, 8, 6), m('#3a2a1a'), 0, 0.02, 0.22, g);
    yeux(g, '#ff3a5a', 0.05, 0.05, 0.29, 0.03);
    piece(cone(0.04, 0.16, 5), m(FER), 0, -0.02, -0.28, g).rotation.x = -Math.PI / 2;
    const aile = geo('aileBourdon', () => new THREE.PlaneGeometry(0.36, 0.16));
    const matAile = mat('aile', { color: '#e8f4ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.2 });
    const ailes = [-1, 1].map(s => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.08, 0.12, 0.02);
      const a = piece(aile, matAile, s * 0.18, 0, 0, pivot);
      a.rotation.x = -Math.PI / 2;
      a.castShadow = false;
      g.add(pivot);
      return { pivot, s };
    });
    return { ailes, haut: 0.45, vol: true };
  },
  grappe(g, m) {
    const vert = m('#5f9a6e'), rouille = m(ROUILLE);
    const boules = [[0, 0.24, 0.08, 0.2], [-0.16, 0.2, -0.08, 0.17], [0.16, 0.2, -0.08, 0.17], [0, 0.42, -0.04, 0.16]].map(([x, y, z, r], i) =>
      piece(boule(r, 9, 7), i === 3 ? rouille : vert, x, y, z, g));
    yeux(g, '#c8ff5a', 0.07, 0.28, 0.26);
    return { boules, haut: 0.75, rythme: 6 };
  },
  grappillon(g, m) {
    const b = piece(boule(0.14, 8, 6), m('#6fb07e'), 0, 0.15, 0, g);
    yeux(g, '#c8ff5a', 0.05, 0.18, 0.12, 0.03);
    return { saut: b, haut: 0.45, rythme: 14 };
  },
  tisseur(g, m) {
    piece(cone(0.22, 0.52, 7), m('#5b3a5a'), 0, 0.26, 0, g);
    piece(boule(0.12, 8, 6), m(FER, { metalness: 0.6 }), 0, 0.58, 0, g);
    yeux(g, '#6dff9a', 0.045, 0.6, 0.1, 0.03);
    for (const s of [-1, 1]) piece(boite(0.04, 0.3, 0.04), m(ROUILLE_SOMBRE), s * 0.2, 0.36, 0.06, g).rotation.z = s * 0.5;
    const orbe = piece(boule(0.08, 8, 6), lueur('#6dff9a', 2.2), 0, 0.86, 0, g);
    orbe.castShadow = false;
    return { orbe, haut: 1.05, rythme: 4 };
  },
  furtif(g, m) {
    // Une silhouette sombre et effilée, presque transparente.
    const voile = { transparent: true, opacity: 0.9 };
    const corps = piece(cone(0.2, 0.55, 6), m('#2a2440', voile), 0, 0.3, 0, g);
    corps.rotation.x = 0.25;
    piece(boule(0.13, 8, 6), m('#3a3458', voile), 0, 0.6, 0.06, g);
    for (const s of [-1, 1]) piece(cone(0.05, 0.3, 4), m('#4a4070', voile), s * 0.18, 0.42, -0.1, g).rotation.z = s * 1.1;
    yeux(g, '#5af0ff', 0.05, 0.62, 0.16, 0.03);
    return { haut: 0.85, rythme: 7, furtif: true };
  },
  fouisseur(g, m) {
    // Une taupe de fer à la foreuse tournante.
    const corps = piece(geo('capsFouis', () => new THREE.CapsuleGeometry(0.2, 0.32, 4, 8)), m('#7a5a3a'), 0, 0.24, -0.05, g);
    corps.rotation.x = Math.PI / 2;
    const foret = new THREE.Group();
    foret.position.set(0, 0.24, 0.3);
    const meche = piece(cone(0.17, 0.36, 6), m('#9a9a9a', { metalness: 0.8 }), 0, 0, 0, foret);
    meche.rotation.x = Math.PI / 2;
    g.add(foret);
    for (const s of [-1, 1]) piece(boite(0.1, 0.12, 0.5), m('#2b2b2b'), s * 0.2, 0.06, -0.05, g);
    yeux(g, '#ffd23f', 0.1, 0.36, 0.14, 0.035);
    return { foret, haut: 0.6, rythme: 6, chenilles: true };
  },
  pavois(g, m) {
    // Un porte-bouclier : un grand pavois d'énergie devant lui.
    const corps = piece(boule(0.27, 10, 8), m('#4a5a7a', { metalness: 0.4 }), 0, 0.32, -0.05, g);
    corps.scale.set(1, 0.85, 1);
    piece(boite(0.5, 0.56, 0.06), m('#6a7a9a', { metalness: 0.5 }), 0, 0.36, 0.26, g);
    piece(octa(0.09), lueur('#6ab8ff', 1.8), 0, 0.4, 0.3, g).scale.set(1, 1.4, 0.5);
    piece(cyl(0.02, 0.02, 0.3, 4), m(FER), 0, 0.68, -0.08, g);
    piece(boule(0.05, 6, 5), lueur('#6ab8ff', 2), 0, 0.85, -0.08, g).castShadow = false;
    yeux(g, '#6ab8ff', 0.08, 0.4, 0.2, 0.03);
    return { pattes: pattes(g, 4, m(FER), 0.2, 0.26, 0.2), haut: 0.95, rythme: 7 };
  },
  bondisseur(g, m) {
    // Une sauterelle de fer aux grandes pattes repliées.
    const corps = piece(boule(0.2, 8, 6), m('#8a9a3a'), 0, 0.32, 0, g);
    corps.scale.set(0.9, 0.8, 1.4);
    piece(boule(0.12, 8, 6), m('#6a7a2a'), 0, 0.4, 0.28, g);
    yeux(g, '#ffd23f', 0.06, 0.44, 0.36, 0.035);
    for (const sg of [-1, 1]) {
      const p = piece(boite(0.05, 0.36, 0.05), m(FER), sg * 0.2, 0.3, -0.12, g);
      p.rotation.x = 0.9;
      piece(boite(0.04, 0.3, 0.04), m(FER), sg * 0.2, 0.12, -0.02, g).rotation.x = -0.6;
    }
    return { pattes: pattes(g, 2, m(FER), 0.12, 0.2, 0.18, 0.035), haut: 0.7, rythme: 8 };
  },
  dirigeable(g, m) {
    // Un ballon de toile rapiécée, une nacelle blindée et deux hélices.
    const ballon = piece(boule(0.4, 12, 8), m('#a87a4a'), 0, 0.35, 0, g);
    ballon.scale.set(0.8, 0.7, 1.4);
    for (const z of [-0.25, 0.1]) piece(cyl(0.33, 0.33, 0.04, 12), m(ROUILLE_SOMBRE), 0, 0.35, z, g).rotation.x = Math.PI / 2;
    piece(boite(0.26, 0.14, 0.4), m('#4a4e56', { metalness: 0.5 }), 0, -0.02, 0, g);
    yeux(g, '#ff8a3a', 0.07, 0, 0.2, 0.04);
    const helices = [-1, 1].map(sg => {
      const h = new THREE.Group();
      h.position.set(sg * 0.18, -0.02, -0.22);
      piece(boite(0.3, 0.03, 0.05), m(FER), 0, 0, 0, h);
      g.add(h);
      return h;
    });
    return { helices, haut: 0.9, vol: true };
  },
  mue(g, m) {
    // Un crabe de fer à la carapace verte qui se reforme.
    const carapace = piece(boule(0.3, 10, 6), m('#4f8a6a', { metalness: 0.3 }), 0, 0.26, 0, g);
    carapace.scale.set(1.2, 0.55, 1);
    piece(boule(0.06, 6, 4), lueur('#6dff9a', 1.6), 0, 0.42, 0, g).castShadow = false;
    for (const sg of [-1, 1]) {
      const pince = piece(boite(0.12, 0.08, 0.2), m(ROUILLE), sg * 0.3, 0.2, 0.22, g);
      pince.rotation.y = sg * 0.4;
    }
    yeux(g, '#c8ff5a', 0.07, 0.32, 0.26, 0.03);
    return { pattes: pattes(g, 6, m(FER), 0.28, 0.16, 0.16, 0.035), haut: 0.6, rythme: 10, carapace };
  },
  hydre(g, m) {
    // Un serpent de métal à trois têtes.
    const vert = m('#3a5a4a', { metalness: 0.5 }), sombre = m('#24342c', { metalness: 0.5 });
    for (let i = 0; i < 5; i++) piece(boule(0.34 - i * 0.04, 10, 8), i % 2 ? sombre : vert, Math.sin(i * 1.2) * 0.12, 0.34, -i * 0.32, g);
    const cous = [];
    for (const [x, rz] of [[-0.3, 0.5], [0, 0], [0.3, -0.5]]) {
      const cou = new THREE.Group();
      cou.position.set(x, 0.45, 0.2);
      cou.rotation.z = rz;
      piece(cyl(0.08, 0.12, 0.7, 6), vert, 0, 0.35, 0, cou);
      piece(cone(0.16, 0.32, 6), sombre, 0, 0.78, 0.08, cou).rotation.x = 1.4;
      yeux(cou, '#ff3a3a', 0.07, 0.82, 0.12, 0.04);
      g.add(cou);
      cous.push(cou);
    }
    return { cous, haut: 1.6, rythme: 3, chenilles: true };
  },
  tete(g, m) {
    const vert = m('#3a5a4a', { metalness: 0.5 });
    for (let i = 0; i < 3; i++) piece(boule(0.2 - i * 0.03, 8, 6), vert, 0, 0.22, -i * 0.22, g);
    const cou = new THREE.Group();
    cou.position.set(0, 0.3, 0.12);
    piece(cyl(0.07, 0.1, 0.4, 6), vert, 0, 0.2, 0, cou);
    piece(cone(0.13, 0.26, 6), m('#24342c'), 0, 0.46, 0.06, cou).rotation.x = 1.4;
    yeux(cou, '#ff3a3a', 0.05, 0.5, 0.1, 0.035);
    g.add(cou);
    return { cous: [cou], haut: 0.85, rythme: 6, chenilles: true };
  },
  seigneur(g, m) {
    // Le Seigneur Rouille : un géant couronné, une masse, un cœur de braise.
    const rouille = m(ROUILLE), sombre = m('#3a2a24', { metalness: 0.5 });
    for (const sg of [-1, 1]) piece(boite(0.3, 0.7, 0.34), sombre, sg * 0.3, 0.35, 0, g);
    piece(boite(1.0, 0.8, 0.6), rouille, 0, 1.1, 0, g);
    piece(boite(1.2, 0.18, 0.7), sombre, 0, 1.52, 0, g);
    piece(boule(0.15, 8, 6), lueur('#ff5a1a', 2.4), 0, 1.15, 0.31, g).castShadow = false;
    piece(boule(0.26, 8, 6), sombre, 0, 1.78, 0.02, g);
    yeux(g, '#ff2a2a', 0.1, 1.82, 0.22, 0.05);
    for (let i = 0; i < 5; i++) piece(cone(0.06, 0.24, 4), OR, (i - 2) * 0.1, 2.05, 0, g);
    const bras = new THREE.Group();
    bras.position.set(0.68, 1.35, 0);
    piece(boite(0.22, 0.7, 0.22), rouille, 0, -0.35, 0, bras);
    piece(boite(0.4, 0.4, 0.4), sombre, 0, -0.8, 0.1, bras);
    g.add(bras);
    piece(boite(0.22, 0.7, 0.22), rouille, -0.68, 1.0, 0, g);
    return { bras, haut: 2.3, rythme: 3 };
  },
  cliquet(g, m) {
    // Un rouage dressé sur la tranche, qui roule à toute vitesse.
    const roue = new THREE.Group();
    roue.position.y = 0.22;
    const metal = m('#b0884a', { metalness: 0.7 });
    const disque = piece(cyl(0.18, 0.18, 0.08, 10), metal, 0, 0, 0, roue);
    disque.rotation.z = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      piece(boite(0.08, 0.07, 0.07), metal, 0, Math.cos(a) * 0.2, Math.sin(a) * 0.2, roue).rotation.x = a;
    }
    g.add(roue);
    yeux(g, '#ffd23f', 0.05, 0.28, 0.1, 0.03);
    return { roue, haut: 0.5, rythme: 12 };
  },
  bastion(g, m) {
    // Une tour de garde qui marche : créneaux, plaque de front, visière.
    const pierre = m('#6a6a72', { metalness: 0.3 }), sombre = m('#3a3a42', { metalness: 0.5 });
    piece(boite(0.6, 0.55, 0.56), pierre, 0, 0.5, 0, g);
    for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) piece(boite(0.14, 0.14, 0.14), pierre, x, 0.84, z, g);
    piece(boite(0.66, 0.5, 0.06), sombre, 0, 0.5, 0.31, g);
    piece(boite(0.36, 0.05, 0.03), lueur('#5ad8ff', 1.8), 0, 0.62, 0.35, g);
    return { pattes: pattes(g, 4, sombre, 0.22, 0.32, 0.24, 0.1), haut: 1.05, rythme: 4 };
  },
  reparateur(g, m) {
    // Un petit mécano : une clé, une lampe verte et une caisse à outils.
    const corps = piece(boule(0.17, 8, 6), m('#c89a4a'), 0, 0.28, 0, g);
    corps.scale.set(1, 1.1, 0.9);
    piece(boite(0.18, 0.12, 0.12), m(ROUILLE_SOMBRE), 0, 0.26, -0.18, g);
    const cle = new THREE.Group();
    cle.position.set(0.18, 0.32, 0.05);
    piece(boite(0.04, 0.26, 0.04), m(FER, { metalness: 0.7 }), 0, 0.1, 0, cle);
    piece(tore(0.05, 0.015, 4, 8), m(FER, { metalness: 0.7 }), 0, 0.24, 0, cle);
    g.add(cle);
    piece(boule(0.05, 6, 4), lueur('#6dff9a', 2.2), 0, 0.52, 0, g).castShadow = false;
    yeux(g, '#6dff9a', 0.05, 0.32, 0.14, 0.03);
    return { pattes: pattes(g, 2, m(FER), 0.08, 0.15, 0.16, 0.04), haut: 0.62, rythme: 10, cle };
  },
  scarabee(g, m) {
    // Un scarabée volant à carapace de laiton.
    const laiton = m('#c8a040', { metalness: 0.8, roughness: 0.3 });
    const corps = piece(boule(0.2, 10, 8), m('#3a2a1a'), 0, 0, 0, g);
    corps.scale.set(1, 0.8, 1.3);
    for (const sg of [-1, 1]) {
      const elytre = piece(boule(0.18, 8, 6), laiton, sg * 0.1, 0.06, -0.02, g);
      elytre.scale.set(0.6, 0.5, 1.4);
    }
    piece(boule(0.09, 8, 6), laiton, 0, 0.02, 0.26, g);
    yeux(g, '#ffd23f', 0.05, 0.05, 0.33, 0.03);
    const aile = geo('aileScarabee', () => new THREE.PlaneGeometry(0.38, 0.16));
    const matAile = mat('aileScarabee', { color: '#f4e8c0', transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 0.2 });
    const ailes = [-1, 1].map(sg => {
      const pivot = new THREE.Group();
      pivot.position.set(sg * 0.1, 0.12, 0);
      const a = piece(aile, matAile, sg * 0.19, 0, 0, pivot);
      a.rotation.x = -Math.PI / 2;
      a.castShadow = false;
      g.add(pivot);
      return { pivot, s: sg };
    });
    return { ailes, haut: 0.5, vol: true };
  },
  colosse(g, m) {
    // Le Colosse de Rouille : un géant voûté, une gueule de fournaise.
    const rouille = m('#8a4a24', { metalness: 0.4 }), sombre = m('#2e2622', { metalness: 0.6 });
    for (const sg of [-1, 1]) piece(boite(0.4, 0.8, 0.44), sombre, sg * 0.42, 0.4, 0, g);
    const tronc = piece(boite(1.3, 0.95, 0.8), rouille, 0, 1.25, 0.1, g);
    tronc.rotation.x = 0.25;
    piece(boite(1.5, 0.22, 0.6), sombre, 0, 1.75, 0, g);
    piece(boite(0.5, 0.18, 0.08), lueur('#ff6a1a', 2.6), 0, 1.25, 0.56, g).castShadow = false;
    piece(boule(0.3, 8, 6), sombre, 0, 1.95, 0.35, g);
    yeux(g, '#ffb020', 0.12, 2.0, 0.6, 0.06);
    const bras = [-1, 1].map(sg => {
      const b = new THREE.Group();
      b.position.set(sg * 0.85, 1.6, 0.1);
      piece(boite(0.3, 1.0, 0.3), rouille, 0, -0.5, 0, b);
      piece(boite(0.5, 0.4, 0.5), sombre, 0, -1.1, 0.05, b);
      g.add(b);
      return b;
    });
    return { brasDouble: bras, haut: 2.5, rythme: 2 };
  },
  brouilleur(g, m) {
    // Une antenne parabolique sur quatre pattes.
    piece(boite(0.36, 0.18, 0.36), m('#4a4a5a', { metalness: 0.5 }), 0, 0.3, 0, g);
    const parabole = piece(geo('parabole', () => new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), m('#9a9ab0', { metalness: 0.6, side: THREE.DoubleSide }), 0, 0.5, 0.05, g);
    parabole.rotation.x = -2.2;
    const antenne = piece(boule(0.05, 6, 4), lueur('#c86aff', 2.2), 0, 0.62, 0.18, g);
    antenne.castShadow = false;
    yeux(g, '#c86aff', 0.08, 0.34, 0.19, 0.03);
    return { pattes: pattes(g, 4, m(FER), 0.16, 0.24, 0.22, 0.04), haut: 0.8, rythme: 7, antenne };
  },
  galopin(g, m) {
    // Un rat de ferraille, long et nerveux.
    const corps = piece(boule(0.15, 8, 6), m('#7a6a5a'), 0, 0.2, 0, g);
    corps.scale.set(0.9, 0.8, 1.6);
    piece(boule(0.1, 8, 6), m('#6a5a4a'), 0, 0.24, 0.24, g);
    for (const s of [-1, 1]) piece(boule(0.05, 6, 4), m('#9a7a6a'), s * 0.07, 0.33, 0.2, g);
    yeux(g, '#ff5a3a', 0.045, 0.27, 0.32, 0.025);
    const queue = piece(cyl(0.01, 0.025, 0.36, 4), m(FER), 0, 0.22, -0.32, g);
    queue.rotation.x = -1.3;
    return { pattes: pattes(g, 4, m(FER), 0.09, 0.2, 0.14, 0.03), haut: 0.5, rythme: 20, queue };
  },
  givrin(g, m) {
    // Une carapace prise dans le givre, hérissée de cristaux.
    const corps = piece(boule(0.27, 10, 8), m('#b8d8ec', { metalness: 0.3, roughness: 0.3 }), 0, 0.32, 0, g);
    corps.scale.set(1, 0.85, 1.1);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const pic = piece(cone(0.05, 0.22, 4), GLACE, Math.cos(a) * 0.18, 0.48, Math.sin(a) * 0.18, g);
      pic.rotation.z = -Math.cos(a) * 0.5; pic.rotation.x = Math.sin(a) * 0.5;
    }
    yeux(g, '#9af0ff', 0.08, 0.36, 0.26, 0.035);
    return { pattes: pattes(g, 4, m('#6a8aa0'), 0.2, 0.26, 0.2), haut: 0.8, rythme: 7 };
  },
  ruche(g, m) {
    // Une ruche de fer qui vole, des trous sombres et deux paires d'ailes.
    const corps = piece(boule(0.32, 10, 8), m('#a8783a', { metalness: 0.3 }), 0, 0, 0, g);
    corps.scale.set(1, 1.15, 1);
    for (const y of [-0.15, 0, 0.15]) piece(cyl(0.33 - Math.abs(y) * 0.4, 0.33 - Math.abs(y) * 0.4, 0.04, 12), m(ROUILLE_SOMBRE), 0, y, 0, g);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      piece(boule(0.05, 6, 4), m('#1a120a'), Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3, g);
    }
    const aile = geo('aileRuche', () => new THREE.PlaneGeometry(0.4, 0.18));
    const matAile = mat('aileRuche', { color: '#f0e8c8', transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 0.2 });
    const ailes = [];
    for (const z of [0.1, -0.12]) for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.2, 0.25, z);
      const a = piece(aile, matAile, s * 0.2, 0, 0, pivot);
      a.rotation.x = -Math.PI / 2;
      a.castShadow = false;
      g.add(pivot);
      ailes.push({ pivot, s });
    }
    return { ailes, haut: 0.9, vol: true };
  },
  golem(g, m) {
    // Un géant d'obsidienne aux fissures violettes.
    const obs = m('#1a1620', { metalness: 0.7, roughness: 0.2 }), fissure = lueur('#a04aff', 1.8);
    for (const s of [-1, 1]) piece(boite(0.38, 0.8, 0.42), obs, s * 0.38, 0.4, 0, g);
    piece(boite(1.15, 1.0, 0.75), obs, 0, 1.3, 0, g);
    piece(boite(0.06, 0.8, 0.02), fissure, -0.2, 1.3, 0.38, g).rotation.z = 0.3;
    piece(boite(0.06, 0.6, 0.02), fissure, 0.25, 1.25, 0.38, g).rotation.z = -0.4;
    piece(boite(0.5, 0.45, 0.45), obs, 0, 2.0, 0.05, g);
    yeux(g, '#c86aff', 0.12, 2.05, 0.28, 0.06);
    const bras = [-1, 1].map(s => {
      const b = new THREE.Group();
      b.position.set(s * 0.75, 1.7, 0);
      piece(boite(0.32, 1.0, 0.32), obs, 0, -0.5, 0, b);
      piece(boite(0.06, 0.6, 0.02), fissure, 0, -0.5, 0.17, b);
      g.add(b);
      return b;
    });
    return { brasDouble: bras, haut: 2.4, rythme: 2 };
  },
  broyeur(g, m) {
    for (const s of [-1, 1]) piece(boite(0.24, 0.34, 1.2), m('#262626'), s * 0.5, 0.17, 0, g);
    piece(boite(0.86, 0.6, 1.0), m('#5a4a3e', { metalness: 0.45 }), 0, 0.6, -0.05, g);
    piece(boite(0.96, 0.12, 0.8), m(ROUILLE), 0, 0.94, -0.1, g);
    for (const s of [-1, 1]) piece(boite(0.12, 0.4, 0.5), m(ROUILLE_SOMBRE), s * 0.5, 0.62, -0.05, g);
    const broyeur = new THREE.Group();
    broyeur.position.set(0, 0.28, 0.62);
    g.add(broyeur);
    piece(cyl(0.22, 0.22, 0.9, 10), m(FER, { metalness: 0.7 }), 0, 0, 0, broyeur).rotation.z = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const dent = piece(cone(0.07, 0.18, 4), m('#9a9a9a', { metalness: 0.8 }), ((i % 3) - 1) * 0.3, Math.cos(a) * 0.26, Math.sin(a) * 0.26, broyeur);
      dent.rotation.x = a + Math.PI / 2;
    }
    yeux(g, '#ff2a2a', 0.22, 0.72, 0.46, 0.07);
    const cheminee = piece(cyl(0.08, 0.1, 0.5, 6), m(FER), -0.25, 1.15, -0.35, g);
    return { broyeur, cheminee, haut: 1.55, rythme: 3, chenilles: true };
  },
  nuee(g, m) {
    const corps = piece(geo('capsNuee', () => new THREE.CapsuleGeometry(0.22, 0.5, 4, 10)), m('#3a2350', { metalness: 0.4 }), 0, 0, -0.05, g);
    corps.rotation.x = Math.PI / 2;
    for (const z of [-0.2, 0, 0.2]) piece(cyl(0.225, 0.225, 0.05, 10), OR, 0, 0, z - 0.05, g).rotation.x = Math.PI / 2;
    piece(boule(0.16, 10, 8), m('#2a1838'), 0, 0.05, 0.42, g);
    yeux(g, '#ff4dd2', 0.08, 0.1, 0.54, 0.05);
    for (let i = 0; i < 5; i++) piece(cone(0.03, 0.14, 4), OR, (i - 2) * 0.05, 0.24, 0.42, g);
    piece(boule(0.12, 8, 6), lueur('#ff4dd2', 1.4), 0, -0.02, -0.48, g).castShadow = false;
    const aile = geo('aileNuee', () => new THREE.PlaneGeometry(0.8, 0.3));
    const matAile = mat('aileNuee', { color: '#d8b8ff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 0.2, emissive: '#5a2a8a', emissiveIntensity: 0.4 });
    const ailes = [];
    for (const z of [0.12, -0.18]) for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.15, 0.18, z);
      const a = piece(aile, matAile, s * 0.4, 0, 0, pivot);
      a.rotation.x = -Math.PI / 2;
      a.castShadow = false;
      g.add(pivot);
      ailes.push({ pivot, s });
    }
    return { ailes, haut: 0.9, vol: true };
  },
};

/** Un Rouilleux : { groupe, corps, anim, mats, haut }. */
export function creerEnnemi(type, taille) {
  const groupe = new THREE.Group();
  const corps = new THREE.Group();
  groupe.add(corps);
  const { liste, m } = matsPropres();
  const anim = ENNEMIS3D[type](corps, m);
  const echelle = ['broyeur', 'nuee', 'hydre', 'seigneur', 'dirigeable', 'colosse', 'bastion', 'golem', 'ruche'].includes(type) ? 1 : taille / 0.45;
  corps.scale.setScalar(echelle);
  return { groupe, corps, anim, mats: liste, haut: anim.haut * echelle, echelle, flash: 0, phase: Math.random() * 10 };
}

const BLEU = new THREE.Color('#4aa8ff'), BLANC = new THREE.Color('#ffffff'), NOIR = new THREE.Color(0);

/** Anime un Rouilleux : pattes, ailes, rebonds ; teinte d'un coup reçu ou du gel. */
const BULLE = new THREE.MeshBasicMaterial({ color: '#6ab8ff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
const OBSIDIENNE = new THREE.MeshBasicMaterial({ color: '#b06aff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });

/** Un garde de Garnison : armure, bouclier, lance. */
export function creerGarde() {
  const g = new THREE.Group();
  piece(geo('capsGarde', () => new THREE.CapsuleGeometry(0.09, 0.18, 4, 8)), METAL, 0, 0.2, 0, g);
  piece(boule(0.08, 8, 6), mat('casque', { color: '#c8ccd8', metalness: 0.8 }), 0, 0.42, 0, g);
  piece(boite(0.16, 0.2, 0.03), mat('ecu', { color: '#3a5aa8' }), 0, 0.22, 0.11, g);
  const lance = piece(cyl(0.012, 0.012, 0.6, 4), BOIS, 0.12, 0.3, 0.05, g);
  lance.rotation.x = 0.3;
  return g;
}

export function animerEnnemi(m, t, dt, { vitesse = 1, ralenti = 0, cache = false, sous = false, bouclier = 0, carapace = false } = {}) {
  const a = m.anim, tt = t + m.phase;
  // Le Furtif : presque invisible tant qu'aucun Phare ne l'éclaire.
  if (a.furtif) for (const x of m.mats) x.opacity = cache ? 0.28 : 0.9;
  // Le Fouisseur s'enfonce dans le sol.
  m.enfoui = (m.enfoui || 0) + ((sous ? 1 : 0) - (m.enfoui || 0)) * Math.min(1, dt * 8);
  m.groupe.position.y -= m.enfoui * 0.6;
  if (a.foret) a.foret.rotation.z += dt * (12 + m.enfoui * 20);
  // La bulle d'un bouclier de Pavois.
  if (a.antenne) a.antenne.scale.setScalar(1 + Math.sin(t * 6) * 0.3);
  if ((bouclier > 0 || carapace) && !m.bulle) {
    m.bulle = new THREE.Mesh(geo('bulle', () => new THREE.IcosahedronGeometry(1, 1)), BULLE);
    m.bulle.position.y = m.haut * 0.45;
    m.bulle.scale.setScalar(Math.max(0.4, m.haut * 0.6));
    m.groupe.add(m.bulle);
  }
  if (m.bulle) { m.bulle.visible = bouclier > 0 || carapace; m.bulle.material = carapace ? OBSIDIENNE : BULLE; m.bulle.rotation.y += dt; }
  const r = a.rythme || 8;
  if (a.pattes) for (const p of a.pattes) p.pivot.rotation.x = Math.sin(tt * r * vitesse + p.phase) * 0.6;
  if (a.ailes) for (const w of a.ailes) w.pivot.rotation.z = w.s * Math.sin(tt * (a.vol && m.echelle > 1.5 ? 20 : 42)) * 0.6;
  if (a.vol) m.corps.position.y = Math.sin(tt * 3) * 0.08;
  else if (a.chenilles) m.corps.position.y = Math.abs(Math.sin(tt * r * 2)) * 0.015;
  else m.corps.position.y = Math.abs(Math.sin(tt * r * vitesse)) * 0.04;
  if (a.queue) a.queue.rotation.z = Math.sin(tt * 12) * 0.4;
  if (a.boules) a.boules.forEach((b, i) => b.scale.setScalar(1 + Math.sin(tt * 6 + i * 1.7) * 0.08));
  if (a.saut) a.saut.position.y = 0.15 + Math.abs(Math.sin(tt * r)) * 0.12;
  if (a.orbe) a.orbe.position.y = 0.86 + Math.sin(tt * 3) * 0.05;
  if (a.broyeur) a.broyeur.rotation.x += dt * 8;
  if (a.helices) for (const h of a.helices) h.rotation.z += dt * 25;
  if (a.roue) a.roue.rotation.x += dt * 14 * vitesse;
  if (a.cle) a.cle.rotation.x = Math.sin(tt * 8) * 0.6;
  if (a.brasDouble) a.brasDouble.forEach((b, i) => { b.rotation.x = Math.sin(tt * 1.2 + i * Math.PI) * 0.4; });
  if (a.cous) a.cous.forEach((c, i) => { c.rotation.x = Math.sin(tt * 2 + i) * 0.25; });
  if (a.bras) a.bras.rotation.x = Math.sin(tt * 1.5) * 0.5;
  if (a.carapace) a.carapace.scale.y = 0.55 + Math.sin(tt * 3) * 0.03;
  m.flash = Math.max(0, m.flash - dt * 7);
  const em = m.flash > 0 ? BLANC : ralenti > 0 ? BLEU : NOIR;
  const k = m.flash > 0 ? m.flash * 0.9 : ralenti > 0 ? 0.35 : 0;
  for (const x of m.mats) { x.emissive.copy(em); x.emissiveIntensity = k; }
}

export function libererEnnemi(m) {
  for (const x of m.mats) x.dispose();
}

/* ============================================================ DÉCOR */

export { piece, cyl, boite, boule, octa, cone, tore, mat, lueur, OR, METAL, CUIVRE, GLACE };
