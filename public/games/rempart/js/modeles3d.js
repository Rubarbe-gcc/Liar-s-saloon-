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
];

function socle(niveau, accent, g) {
  const s = SOCLES[niveau - 1];
  piece(cyl(s.r + 0.08, s.r + 0.11, 0.1, 8), mat(`socleBas${niveau}`, { color: s.bas }), 0, 0.05, 0, g);
  piece(cyl(s.r, s.r + 0.06, s.h, 8), mat(`socle${niveau}`, { color: s.corps }), 0, 0.1 + s.h / 2, 0, g);
  if (niveau >= 2) piece(cyl(s.r + 0.02, s.r + 0.02, 0.06, 8), niveau === 3 ? OR : METAL, 0, 0.1 + s.h * 0.72, 0, g);
  if (niveau === 3) {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      piece(cone(0.05, 0.16, 4), OR, Math.cos(a) * s.r, 0.18 + s.h, Math.sin(a) * s.r, g);
    }
  }
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
  rafale(n, t) {
    const corps = piece(boite(0.34, 0.24, 0.34), n === 1 ? BOIS : n === 2 ? METAL : METAL_SOMBRE, 0, 0.12, 0, t);
    if (n === 3) piece(boite(0.36, 0.04, 0.36), OR, 0, 0.26, 0, t);
    piece(cyl(0.1, 0.1, 0.12, 10), lueur('#ff9a3c', 0.8), 0.2, 0.14, -0.04, t).rotation.z = Math.PI / 2;
    const canons = new THREE.Group();
    canons.position.set(0, 0.13, 0.17);
    t.add(canons);
    const nb = n, ray = n === 3 ? 0.075 : 0.07;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2;
      const x = n === 3 ? Math.cos(a) * ray : (i - (nb - 1) / 2) * 0.12;
      const y = n === 3 ? Math.sin(a) * ray : 0;
      piece(cyl(0.04, 0.05, 0.44, 8), n === 3 ? METAL : METAL_SOMBRE, x, y, 0.22, canons).rotation.x = Math.PI / 2;
    }
    if (n >= 2) piece(cyl(0.065, 0.065, 0.05, 10), n === 3 ? OR : CUIVRE, 0, 0, 0.36, canons).rotation.x = Math.PI / 2;
    void corps;
    return { canons, tourne: n === 3 ? canons : null };
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
export function creerTour(type, niveau, accent) {
  const groupe = new THREE.Group();
  const h = socle(niveau, accent, groupe);
  const tete = new THREE.Group();
  tete.position.y = h;
  groupe.add(tete);
  const parts = TETES[type](niveau, tete);
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
  const echelle = type === 'broyeur' || type === 'nuee' ? 1 : taille / 0.45;
  corps.scale.setScalar(echelle);
  return { groupe, corps, anim, mats: liste, haut: anim.haut * echelle, echelle, flash: 0, phase: Math.random() * 10 };
}

const BLEU = new THREE.Color('#4aa8ff'), BLANC = new THREE.Color('#ffffff'), NOIR = new THREE.Color(0);

/** Anime un Rouilleux : pattes, ailes, rebonds ; teinte d'un coup reçu ou du gel. */
export function animerEnnemi(m, t, dt, { vitesse = 1, ralenti = 0 } = {}) {
  const a = m.anim, tt = t + m.phase;
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
