/**
 * RAID — les figurines : des personnages en bois taillé au couteau, à
 * facettes, peints à la main, chacun sur son petit socle. Les héros, les
 * monstres, les maîtres de chapitre, et les pièces de la carte.
 *
 * Tout est construit par le code (aucun fichier à charger). Une figurine
 * mesure environ une unité de haut ; un boss, deux. `userData.corps` est ce
 * qui bouge (le socle reste posé), `userData.hauteur` sa taille.
 */

import { THREE, bois, alea, hacher } from './scene3d.js';
import { PEUPLES } from '../../../../shared/raid/heros.js';
import { ECOLES } from '../../../../shared/raid/ecoles.js';

/* ------------------------------------------------------------------ */
/* Les briques                                                         */
/* ------------------------------------------------------------------ */

function maille(geo, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.r) m.rotation.set(...o.r);
  if (o.s) m.scale.set(...[].concat(o.s, o.s, o.s).slice(0, 3));
  m.castShadow = true;
  return m;
}
const boule = (r, mat, x, y, z, o) => maille(new THREE.IcosahedronGeometry(r, 1), mat, x, y, z, o);
const tige = (r1, r2, h, mat, x, y, z, o) => maille(new THREE.CylinderGeometry(r1, r2, h, 7), mat, x, y, z, o);
const pointe = (r, h, mat, x, y, z, o) => maille(new THREE.ConeGeometry(r, h, 6), mat, x, y, z, o);
const bloc = (l, h, p, mat, x, y, z, o) => maille(new THREE.BoxGeometry(l, h, p), mat, x, y, z, o);
const tour = (profil, mat, x = 0, y = 0, z = 0, n = 8) => maille(new THREE.LatheGeometry(profil.map(([a, b]) => new THREE.Vector2(a, b)), n), mat, x, y, z);

/** Le socle de bois brut, sous chaque figurine. */
function socle(r = 0.3) {
  const s = new THREE.Group();
  s.add(maille(new THREE.CylinderGeometry(r, r * 1.08, 0.08, 10), bois('#5a3a22'), 0, 0.04, 0));
  s.add(maille(new THREE.CylinderGeometry(r * 0.92, r * 0.95, 0.02, 10), bois('#7a5432'), 0, 0.09, 0));
  return s;
}
/** Une figurine : son socle, et ce qui bouge par-dessus. */
function figurine(r = 0.3, hauteur = 1) {
  const g = new THREE.Group();
  const corps = new THREE.Group();
  corps.position.y = 0.1;
  g.add(socle(r), corps);
  g.userData = { corps, hauteur, rayon: r };
  return g;
}
const sombre = (c, k = 0.55) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const clair = (c, k = 0.35) => '#' + new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k).getHexString();
/** Deux yeux : des points noirs, ou des braises. */
function yeux(c, y, z, ecart = 0.06, r = 0.022, couleur = '#120c08', lueur = 0) {
  for (const s of [-1, 1]) c.add(boule(r, bois(couleur, { lueur }), s * ecart, y, z));
}

/* ------------------------------------------------------------------ */
/* Les héros                                                           */
/* ------------------------------------------------------------------ */

/** L'arme et la coiffe selon la classe. */
function equipement(classe, role) {
  if (/Mage/.test(classe)) return { arme: 'baton', coiffe: 'pointu' };
  if (/Démoniste|Chronomancien/.test(classe)) return { arme: 'baton', coiffe: 'capuche' };
  if (/Chasseur|Archère/.test(classe)) return { arme: 'arc', coiffe: 'capuche' };
  if (/Assassin/.test(classe)) return { arme: 'dagues', coiffe: 'capuche' };
  if (/Paladin|Forgeron/.test(classe)) return { arme: 'marteau', coiffe: 'casque', bouclier: /Paladin/.test(classe) };
  if (/Croisé/.test(classe)) return { arme: 'espadon', coiffe: 'casque' };
  if (/Druide/.test(classe)) return { arme: 'branche', coiffe: 'couronne' };
  if (/Chaman/.test(classe)) return { arme: 'totem', coiffe: 'plumes' };
  if (/Moine/.test(classe)) return { arme: 'poings', coiffe: 'rien' };
  if (/Prêtre|Oracle/.test(classe)) return { arme: 'baton', coiffe: 'capuche' };
  if (role === 'tank') return { arme: 'epee', coiffe: 'casque', bouclier: true };
  if (role === 'soigneur') return { arme: 'baton', coiffe: 'capuche' };
  return { arme: 'epee', coiffe: 'rien' };
}

/**
 * Un héros : `h` = { peuple, ecole, role, classe, id }. Le peuple donne la tête,
 * la classe l'arme et la coiffe, l'école la peinture.
 */
export function figurineHeros(h) {
  const f = figurine(0.3, 1.05);
  const c = f.userData.corps;
  const ec = ECOLES[h.ecole] || ECOLES.feu;
  const R = alea(hacher(h.id || h.nom || 'h'));
  const peauC = (PEUPLES[h.peuple] || PEUPLES.humain).peau;
  const peau = bois(peauC);
  const tenue = bois(sombre(ec.teinte, 0.62));
  const tenue2 = bois(sombre(ec.teinte, 0.38));
  const accent = bois(ec.teinte);
  const metal = bois('#a8b0b8', { metal: 0.6 });
  const cuir = bois('#5a3a1e');
  const petit = h.peuple === 'gnome' || h.peuple === 'gobelin' ? 0.82 : h.peuple === 'nain' ? 0.9 : 1;
  const large = h.peuple === 'nain' || h.peuple === 'orc' || h.peuple === 'troll' ? 1.18 : 1;
  const { arme, coiffe, bouclier } = equipement(h.classe || '', h.role);

  // Le corps : une robe ou une tunique taillée, la ceinture.
  c.add(tour([[0, 0], [0.24 * large, 0], [0.22 * large, 0.22], [0.17 * large, 0.46], [0.13 * large, 0.58], [0, 0.6]], tenue));
  c.add(maille(new THREE.TorusGeometry(0.19 * large, 0.03, 5, 10), cuir, 0, 0.3, 0, { r: [Math.PI / 2, 0, 0] }));
  // Les épaules et les bras, collés au corps.
  for (const s of [-1, 1]) {
    c.add(boule(0.075 * large, tenue2, s * 0.17 * large, 0.52, 0));
    c.add(tige(0.05, 0.045, 0.3, tenue, s * 0.2 * large, 0.38, 0.02, { r: [0, 0, s * 0.12] }));
    c.add(boule(0.05, peau, s * 0.22 * large, 0.22, 0.04));
  }
  // La tête.
  const yT = 0.74;
  const tete = boule(0.14, peau, 0, yT, 0, { s: h.peuple === 'troll' ? [1, 1.15, 1] : 1 });
  c.add(tete);
  yeux(c, yT + 0.01, 0.125, 0.055);
  if (h.peuple === 'mortvivant') { for (const s of [-1, 1]) c.add(boule(0.04, bois('#1a1a1a'), s * 0.055, yT + 0.01, 0.11)); }
  if (h.peuple === 'elfe' || h.peuple === 'gobelin') for (const s of [-1, 1]) c.add(pointe(0.035, h.peuple === 'gobelin' ? 0.22 : 0.18, peau, s * 0.15, yT + 0.04, 0, { r: [0, 0, -s * 1.2] }));
  if (h.peuple === 'nain') c.add(pointe(0.12, 0.26, bois(R() < 0.5 ? '#8a5a2a' : '#c8c0b0'), 0, yT - 0.16, 0.06, { r: [Math.PI + 0.25, 0, 0] }));
  if (h.peuple === 'orc' || h.peuple === 'troll') for (const s of [-1, 1]) c.add(pointe(0.022, 0.08, bois('#f0e8d0'), s * 0.05, yT - 0.06, 0.11));
  if (h.peuple === 'gnome') c.add(boule(0.045, peau, 0, yT - 0.01, 0.14));

  // La coiffe.
  if (coiffe === 'pointu') { c.add(maille(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10), tenue2, 0, yT + 0.1, 0)); c.add(pointe(0.13, 0.34, tenue2, 0, yT + 0.27, -0.02, { r: [-0.15, 0, 0.1] })); }
  if (coiffe === 'capuche') c.add(maille(new THREE.SphereGeometry(0.165, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), tenue2, 0, yT + 0.03, -0.02, { r: [-0.35, 0, 0] }));
  if (coiffe === 'casque') { c.add(maille(new THREE.SphereGeometry(0.155, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), metal, 0, yT + 0.02, 0)); c.add(bloc(0.03, 0.12, 0.03, metal, 0, yT - 0.02, 0.15)); }
  if (coiffe === 'couronne') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.add(boule(0.04, bois('#4a9a3a'), Math.cos(a) * 0.13, yT + 0.1, Math.sin(a) * 0.13)); }
  if (coiffe === 'plumes') for (let i = 0; i < 3; i++) c.add(pointe(0.025, 0.2, accent, -0.04 + i * 0.04, yT + 0.2, -0.06, { r: [-0.3, 0, (i - 1) * 0.3] }));
  if (coiffe === 'rien' && h.peuple !== 'mortvivant') c.add(maille(new THREE.SphereGeometry(0.145, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.4), bois(R() < 0.5 ? '#3a2414' : '#c89a4a'), 0, yT + 0.02, -0.01));

  // L'arme, dans la main droite (côté +x), et le bouclier à gauche.
  const mx = 0.24 * large, my = 0.24;
  if (arme === 'epee' || arme === 'espadon') { const l = arme === 'espadon' ? 0.62 : 0.42; c.add(bloc(0.04, l, 0.015, metal, mx + 0.02, my + l / 2 + 0.04, 0.06)); c.add(bloc(0.14, 0.03, 0.03, bois('#c8a040', { metal: 0.5 }), mx + 0.02, my + 0.04, 0.06)); }
  if (arme === 'marteau') { c.add(tige(0.018, 0.018, 0.5, cuir, mx + 0.02, my + 0.2, 0.06)); c.add(bloc(0.16, 0.1, 0.1, metal, mx + 0.02, my + 0.46, 0.06)); }
  if (arme === 'baton' || arme === 'branche' || arme === 'totem') {
    c.add(tige(0.016, 0.02, 0.86, cuir, mx + 0.03, my + 0.3, 0.04));
    if (arme === 'baton') c.add(boule(0.06, bois(ec.teinte, { lueur: 0.8 }), mx + 0.03, my + 0.76, 0.04));
    if (arme === 'branche') for (let i = 0; i < 3; i++) c.add(boule(0.045, bois('#4a9a3a'), mx + 0.03 + (i - 1) * 0.04, my + 0.74 + (i % 2) * 0.04, 0.04));
    if (arme === 'totem') c.add(bloc(0.1, 0.12, 0.08, accent, mx + 0.03, my + 0.72, 0.04));
  }
  if (arme === 'arc') c.add(maille(new THREE.TorusGeometry(0.26, 0.016, 4, 12, Math.PI), cuir, mx + 0.02, my + 0.2, 0.05, { r: [0, Math.PI / 2, Math.PI / 2] }));
  if (arme === 'dagues') for (const s of [-1, 1]) c.add(bloc(0.025, 0.18, 0.012, metal, s * mx, my + 0.1, 0.07, { r: [0.3, 0, 0] }));
  if (arme === 'poings') for (const s of [-1, 1]) c.add(maille(new THREE.TorusGeometry(0.05, 0.015, 4, 8), bois('#e8dcc0'), s * 0.22 * large, my, 0.04));
  if (bouclier) c.add(maille(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 8), accent, -mx - 0.04, my + 0.12, 0.08, { r: [Math.PI / 2, 0, 0] }));
  c.scale.setScalar(petit);
  return f;
}

/* ------------------------------------------------------------------ */
/* Les monstres                                                        */
/* ------------------------------------------------------------------ */

/** Chaque monstre a sa figurine ; un boss est deux fois plus grand. `couleur` : celle de son école. */
export function figurineMonstre(m) {
  const id = m.modeleId || m.id;
  const fab = MONSTRES[id] || MONSTRES[m.silhouette] || MONSTRES.bete;
  const boss = m.rang === 'boss';
  const elite = m.rang === 'elite';
  const f = figurine(boss ? 0.62 : elite ? 0.42 : 0.32, boss ? 2.2 : elite ? 1.4 : 1);
  const ec = ECOLES[m.ecole] || ECOLES.ombre;
  fab(f.userData.corps, { ec: ec.teinte, R: alea(hacher(id)) });
  if (boss) f.userData.corps.scale.setScalar(2);
  else if (elite) f.userData.corps.scale.setScalar(1.35);
  return f;
}

const MONSTRES = {
  /* ---- le fretin ---- */
  gnoll(c, { ec }) {
    const poil = bois('#8a6a3a'); const tache = bois('#4a3a20');
    c.add(tour([[0, 0], [0.16, 0], [0.2, 0.25], [0.15, 0.5], [0, 0.56]], poil, 0, 0, 0, 7));
    c.add(boule(0.12, poil, 0, 0.62, 0.04));
    c.add(bloc(0.09, 0.08, 0.18, poil, 0, 0.6, 0.16));
    c.add(boule(0.03, tache, 0, 0.62, 0.25));
    for (const s of [-1, 1]) { c.add(pointe(0.04, 0.12, poil, s * 0.08, 0.74, 0.0)); c.add(boule(0.02, bois('#ffcc40', { lueur: 0.5 }), s * 0.05, 0.66, 0.12)); }
    c.add(tige(0.015, 0.015, 0.9, bois('#5a3a1e'), 0.2, 0.4, 0.05));
    c.add(pointe(0.04, 0.14, bois(ec), 0.2, 0.9, 0.05));
  },
  ogre(c) {
    const peau = bois('#8a9a5a');
    c.add(boule(0.3, peau, 0, 0.32, 0, { s: [1, 1.05, 0.9] }));
    c.add(boule(0.11, peau, 0, 0.68, 0.06));
    yeux(c, 0.7, 0.16, 0.04);
    for (const s of [-1, 1]) c.add(tige(0.07, 0.06, 0.3, peau, s * 0.3, 0.3, 0.05, { r: [0, 0, s * 0.2] }));
    c.add(tige(0.04, 0.09, 0.55, bois('#5a3a1e'), 0.36, 0.38, 0.12, { r: [0.4, 0, -0.3] }));
    c.add(bloc(0.36, 0.12, 0.3, bois('#6a4a2a'), 0, 0.1, 0));
  },
  vase(c, { ec }) {
    const gelee = new THREE.MeshStandardMaterial({ color: new THREE.Color(ec).lerp(new THREE.Color('#6aff8a'), 0.5), roughness: 0.2, transparent: true, opacity: 0.8, flatShading: true });
    c.add(boule(0.3, gelee, 0, 0.22, 0, { s: [1, 0.75, 1] }));
    c.add(boule(0.16, gelee, 0.04, 0.45, 0.02));
    yeux(c, 0.36, 0.26, 0.08, 0.035, '#ffffff');
    c.add(boule(0.06, bois('#e8dcc0'), -0.12, 0.18, 0.12));
  },
  golem(c, { ec }) {
    const pierre = bois('#6a6a72');
    c.add(bloc(0.42, 0.36, 0.28, pierre, 0, 0.32, 0, { r: [0, 0.2, 0] }));
    c.add(bloc(0.2, 0.18, 0.18, pierre, 0, 0.62, 0.02));
    for (const s of [-1, 1]) { c.add(bloc(0.14, 0.38, 0.14, pierre, s * 0.3, 0.26, 0)); c.add(bloc(0.12, 0.14, 0.12, pierre, s * 0.1, 0.07, 0)); }
    c.add(bloc(0.1, 0.03, 0.02, bois(ec, { lueur: 1.2 }), 0, 0.64, 0.12));
    c.add(boule(0.05, bois(ec, { lueur: 1 }), 0, 0.36, 0.15));
  },
  araignee(c, { ec }) {
    const noir = bois('#2a2228');
    c.add(boule(0.2, noir, 0, 0.22, -0.12, { s: [1, 0.85, 1.2] }));
    c.add(boule(0.12, noir, 0, 0.2, 0.12));
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const z = 0.12 - i * 0.08;
      c.add(tige(0.015, 0.015, 0.26, noir, s * 0.2, 0.25, z, { r: [0, 0, s * 1.0] }));
      c.add(tige(0.012, 0.012, 0.26, noir, s * 0.36, 0.12, z, { r: [0, 0, -s * 0.5] }));
    }
    for (let i = 0; i < 4; i++) c.add(boule(0.022, bois('#ff3a3a', { lueur: 0.8 }), -0.04 + (i % 2) * 0.08, 0.24 + Math.floor(i / 2) * 0.04, 0.22));
    c.add(boule(0.06, bois(ec), 0, 0.34, -0.14));
  },
  squelette(c) {
    const os = bois('#e8e0c8');
    c.add(tige(0.025, 0.025, 0.4, os, 0, 0.3, 0));
    for (let i = 0; i < 3; i++) c.add(maille(new THREE.TorusGeometry(0.11 - i * 0.015, 0.018, 4, 10), os, 0, 0.42 - i * 0.07, 0, { r: [Math.PI / 2, 0, 0], s: [1, 0.7, 1] }));
    c.add(boule(0.12, os, 0, 0.66, 0));
    for (const s of [-1, 1]) { c.add(boule(0.035, bois('#120c08'), s * 0.045, 0.67, 0.1)); c.add(tige(0.02, 0.02, 0.3, os, s * 0.06, 0.06, 0)); c.add(tige(0.018, 0.018, 0.3, os, s * 0.15, 0.36, 0, { r: [0, 0, s * 0.2] })); }
    c.add(bloc(0.04, 0.4, 0.015, bois('#8a8a90', { metal: 0.5 }), 0.2, 0.42, 0.06));
  },
  cultiste(c, { ec }) {
    const robe = bois('#4a1018'); const ombre = bois('#0a0606');
    c.add(tour([[0, 0], [0.26, 0], [0.2, 0.3], [0.13, 0.62], [0, 0.66]], robe));
    c.add(maille(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.7), robe, 0, 0.7, 0, { r: [-0.2, 0, 0] }));
    c.add(boule(0.11, ombre, 0, 0.69, 0.04));
    yeux(c, 0.7, 0.14, 0.04, 0.018, '#ff5a3a', 1.2);
    c.add(tige(0.02, 0.02, 0.12, bois('#e8dcc0'), 0.16, 0.36, 0.14));
    c.add(boule(0.025, bois(ec, { lueur: 1.5 }), 0.16, 0.44, 0.14));
  },
  troll(c) {
    const peau = bois('#5a8a7a');
    c.add(tour([[0, 0], [0.2, 0], [0.22, 0.3], [0.18, 0.58], [0, 0.62]], peau));
    c.add(boule(0.13, peau, 0, 0.72, 0.08, { s: [1, 1, 1.2] }));
    yeux(c, 0.75, 0.2, 0.05, 0.022, '#ffd040', 0.6);
    for (const s of [-1, 1]) { c.add(tige(0.05, 0.06, 0.5, peau, s * 0.26, 0.32, 0.06, { r: [0.2, 0, s * 0.15] })); c.add(pointe(0.02, 0.08, bois('#f0e8d0'), s * 0.05, 0.66, 0.2)); }
  },
  follet(c, { ec }) {
    const feu = bois(ec, { lueur: 1.6 });
    c.add(pointe(0.14, 0.5, feu, 0, 0.55, 0));
    c.add(boule(0.14, bois(clair(ec, 0.6), { lueur: 1.4 }), 0, 0.36, 0));
    yeux(c, 0.4, 0.13, 0.05, 0.025);
    for (let i = 0; i < 3; i++) c.add(boule(0.035, feu, Math.cos(i * 2.1) * 0.22, 0.3 + i * 0.1, Math.sin(i * 2.1) * 0.22));
  },

  /* ---- les élites ---- */
  minotaure(c) {
    const poil = bois('#6a3a1e');
    c.add(tour([[0, 0], [0.22, 0], [0.26, 0.3], [0.2, 0.56], [0, 0.6]], poil));
    c.add(boule(0.14, poil, 0, 0.7, 0.06, { s: [1, 1, 1.25] }));
    c.add(bloc(0.12, 0.08, 0.1, bois('#4a2a14'), 0, 0.66, 0.2));
    for (const s of [-1, 1]) c.add(pointe(0.035, 0.24, bois('#e8dcc0'), s * 0.16, 0.82, 0.04, { r: [0, 0, -s * 1.1] }));
    yeux(c, 0.74, 0.18, 0.06, 0.022, '#ff3a2a', 0.8);
    c.add(tige(0.02, 0.02, 0.8, bois('#5a3a1e'), 0.3, 0.4, 0.06));
    c.add(maille(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 8, 1, false, 0, Math.PI), bois('#9aa0a8', { metal: 0.6 }), 0.3, 0.74, 0.06, { r: [Math.PI / 2, 0, 0] }));
  },
  tisseuse(c, a) {
    MONSTRES.araignee(c, a);
    c.add(maille(new THREE.TorusGeometry(0.14, 0.02, 4, 10), bois('#e8e0f0'), 0, 0.26, -0.14, { r: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < 3; i++) c.add(boule(0.05, bois('#e8e0f0'), (i - 1) * 0.12, 0.05, -0.32));
  },
  hurlefer(c, { ec }) {
    const fer = bois('#5a5e66', { metal: 0.6 });
    c.add(bloc(0.22, 0.2, 0.46, fer, 0, 0.32, 0));
    c.add(bloc(0.16, 0.16, 0.2, fer, 0, 0.48, 0.26, { r: [-0.3, 0, 0] }));
    c.add(bloc(0.1, 0.07, 0.14, fer, 0, 0.44, 0.38));
    for (const s of [-1, 1]) { c.add(pointe(0.04, 0.12, fer, s * 0.06, 0.6, 0.22)); for (const z of [-0.16, 0.16]) c.add(tige(0.035, 0.03, 0.24, fer, s * 0.08, 0.12, z)); }
    yeux(c, 0.5, 0.36, 0.05, 0.022, ec, 1.4);
    c.add(tige(0.02, 0.01, 0.3, fer, 0, 0.42, -0.34, { r: [0.9, 0, 0] }));
  },
  banshie(c, { ec }) {
    const voile = new THREE.MeshStandardMaterial({ color: '#d8e0e8', roughness: 0.6, transparent: true, opacity: 0.75, flatShading: true });
    c.add(tour([[0, 0.12], [0.24, 0.05], [0.2, 0.3], [0.12, 0.6], [0, 0.64]], voile));
    c.add(boule(0.12, voile, 0, 0.72, 0));
    c.add(boule(0.05, bois('#0a0a10'), 0, 0.68, 0.1));
    yeux(c, 0.75, 0.1, 0.045, 0.02, ec, 1.5);
    for (let i = 0; i < 5; i++) c.add(pointe(0.03, 0.35, bois('#c8d0d8'), -0.1 + i * 0.05, 0.6, -0.08, { r: [Math.PI, 0, 0] }));
  },
  sentinelle(c, { ec }) {
    const fer = bois('#7a7e88', { metal: 0.6 });
    c.add(tour([[0, 0], [0.22, 0], [0.24, 0.32], [0.2, 0.56], [0, 0.6]], fer));
    c.add(maille(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 8), fer, 0, 0.72, 0));
    c.add(bloc(0.16, 0.025, 0.02, bois(ec, { lueur: 1.2 }), 0, 0.74, 0.13));
    c.add(bloc(0.32, 0.52, 0.04, bois(sombre(ec, 0.5)), -0.28, 0.36, 0.14));
    c.add(tige(0.016, 0.016, 1, bois('#4a3a2a'), 0.26, 0.5, 0.06));
    c.add(pointe(0.05, 0.18, fer, 0.26, 1.06, 0.06));
  },
  bete(c, a) { MONSTRES.gnoll(c, a); },
  brute(c, a) { MONSTRES.ogre(c, a); },
  spectre(c, a) { MONSTRES.cultiste(c, a); },
  colosse(c, a) { MONSTRES.golem(c, a); },

  /* ---- les maîtres de chapitre (dessinés à taille 1, puis doublés) ---- */
  morvase(c, { ec }) {
    const algue = bois('#2a6a5a'); const peau = bois('#8ac0b0');
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; c.add(tige(0.04, 0.015, 0.4, algue, Math.cos(a) * 0.18, 0.15, Math.sin(a) * 0.18, { r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6] })); }
    c.add(tour([[0, 0.2], [0.18, 0.2], [0.15, 0.5], [0.1, 0.62], [0, 0.64]], bois('#1a4a44')));
    c.add(boule(0.12, peau, 0, 0.74, 0));
    yeux(c, 0.75, 0.11, 0.045, 0.02, ec, 1.4);
    for (let i = 0; i < 5; i++) c.add(pointe(0.025, 0.07, bois('#ffd45e', { metal: 0.5 }), -0.08 + i * 0.04, 0.88, 0));
    for (let i = 0; i < 4; i++) c.add(pointe(0.03, 0.3, algue, -0.08 + i * 0.055, 0.62, -0.08, { r: [Math.PI, 0, 0] }));
  },
  vorgath(c) {
    const chair = bois('#a87a6a'); const fer = bois('#6a6a70', { metal: 0.5 });
    c.add(boule(0.3, chair, 0, 0.34, 0, { s: [1.1, 1.1, 0.95] }));
    c.add(bloc(0.42, 0.36, 0.05, bois('#e8dcc0'), 0, 0.3, 0.27));
    c.add(bloc(0.42, 0.3, 0.05, bois('#8a1a1a'), 0, 0.26, 0.29, { s: [0.6, 0.6, 1] }));
    c.add(maille(new THREE.CylinderGeometry(0.12, 0.13, 0.2, 7), fer, 0, 0.72, 0));
    c.add(bloc(0.16, 0.025, 0.02, bois('#1a1a1e'), 0, 0.72, 0.12));
    c.add(tige(0.025, 0.025, 0.3, bois('#4a2a14'), 0.36, 0.4, 0.1));
    c.add(bloc(0.04, 0.26, 0.22, fer, 0.36, 0.62, 0.16));
  },
  kharn(c, { ec }) {
    const fer = bois('#3a3030', { metal: 0.4 }); const braise = bois('#ff8a3a', { lueur: 1.6 });
    c.add(bloc(0.5, 0.42, 0.32, fer, 0, 0.42, 0));
    c.add(bloc(0.24, 0.16, 0.06, braise, 0, 0.44, 0.17));
    c.add(bloc(0.22, 0.2, 0.2, fer, 0, 0.74, 0.02));
    yeux(c, 0.76, 0.13, 0.05, 0.025, ec, 1.6);
    for (const s of [-1, 1]) { c.add(bloc(0.14, 0.4, 0.14, fer, s * 0.34, 0.38, 0)); c.add(bloc(0.14, 0.22, 0.14, fer, s * 0.12, 0.1, 0)); }
    c.add(tige(0.025, 0.025, 0.5, bois('#4a2a14'), 0.42, 0.42, 0.1));
    c.add(bloc(0.22, 0.14, 0.14, fer, 0.42, 0.7, 0.1));
  },
  ysolde(c, { ec }) {
    const glace = bois('#c8eef8'); const robe = bois('#5a90b0');
    c.add(tour([[0, 0], [0.28, 0], [0.18, 0.4], [0.1, 0.62], [0, 0.66]], robe));
    c.add(boule(0.1, bois('#e8f4f8'), 0, 0.74, 0));
    yeux(c, 0.75, 0.09, 0.04, 0.018, ec, 1.4);
    for (let i = 0; i < 5; i++) c.add(pointe(0.025, 0.12 + (i === 2 ? 0.08 : 0), bois('#aee6ff', { lueur: 0.5 }), -0.08 + i * 0.04, 0.88, 0));
    c.add(tige(0.012, 0.012, 0.9, glace, 0.22, 0.42, 0.06));
    c.add(maille(new THREE.OctahedronGeometry(0.06), bois('#aee6ff', { lueur: 1 }), 0.22, 0.9, 0.06));
  },
  sarkhavel(c, { ec }) {
    const ecaille = bois('#4a3a32'); const ventre = bois('#8a6a4a');
    c.add(bloc(0.36, 0.26, 0.56, ecaille, 0, 0.3, 0));
    c.add(bloc(0.2, 0.16, 0.42, ventre, 0, 0.2, 0.02));
    for (const s of [-1, 1]) for (const z of [-0.18, 0.18]) c.add(tige(0.05, 0.05, 0.22, ecaille, s * 0.16, 0.1, z));
    c.add(tige(0.07, 0.1, 0.4, ecaille, 0, 0.56, 0.3, { r: [-0.6, 0, 0] }));
    c.add(bloc(0.16, 0.14, 0.26, ecaille, 0, 0.76, 0.44));
    yeux(c, 0.82, 0.52, 0.06, 0.022, ec, 1.6);
    for (const s of [-1, 1]) { c.add(pointe(0.03, 0.18, bois('#c8b090'), s * 0.05, 0.9, 0.38, { r: [-0.6, 0, -s * 0.3] })); c.add(maille(new THREE.ConeGeometry(0.34, 0.03, 3), bois(sombre(ec, 0.5)), s * 0.36, 0.55, -0.05, { r: [0, 0, -s * 1.2], s: [1.4, 1, 1] })); }
    c.add(tige(0.06, 0.01, 0.5, ecaille, 0, 0.22, -0.46, { r: [1.2, 0, 0] }));
  },
  yggmar(c, { ec }) {
    const ecorce = bois('#5a3a1e');
    c.add(tige(0.18, 0.28, 0.7, ecorce, 0, 0.35, 0));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; c.add(tige(0.02, 0.05, 0.4, ecorce, Math.cos(a) * 0.15, 0.82, Math.sin(a) * 0.15, { r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6] })); c.add(boule(0.1, bois('#3a7a2a'), Math.cos(a) * 0.3, 1.0, Math.sin(a) * 0.3)); }
    c.add(boule(0.09, bois(ec, { lueur: 1.5 }), 0, 0.42, 0.2));
    yeux(c, 0.62, 0.22, 0.06, 0.025, ec, 1.2);
  },
  nelizar(c, { ec }) {
    const robe = bois('#2a2a34'); const os = bois('#e8e0c8');
    c.add(tour([[0, 0], [0.24, 0], [0.18, 0.36], [0.12, 0.6], [0, 0.64]], robe));
    c.add(boule(0.11, os, 0, 0.72, 0));
    for (const s of [-1, 1]) c.add(boule(0.03, bois(ec, { lueur: 1.5 }), s * 0.04, 0.73, 0.09));
    c.add(bloc(0.22, 0.03, 0.16, bois('#6a4a2a'), 0, 0.42, 0.2, { r: [0.4, 0, 0] }));
    for (let i = 0; i < 4; i++) c.add(bloc(0.05, 0.05, 0.01, bois(ec, { lueur: 1.2 }), Math.cos(i * 1.6) * 0.3, 0.6 + i * 0.08, Math.sin(i * 1.6) * 0.3));
  },
  seraphiel(c, { ec }) {
    const or = bois('#ffd45e', { metal: 0.5 }); const robe = bois('#f0e8d8');
    c.add(tour([[0, 0], [0.24, 0], [0.18, 0.36], [0.12, 0.6], [0, 0.64]], robe));
    c.add(boule(0.1, bois('#f0d8b8'), 0, 0.73, 0));
    yeux(c, 0.74, 0.09, 0.04);
    c.add(maille(new THREE.TorusGeometry(0.12, 0.015, 4, 14), bois('#fff0b0', { lueur: 1.4 }), 0, 0.93, 0, { r: [Math.PI / 2.4, 0, 0] }));
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) c.add(bloc(0.5, 0.14, 0.02, bois('#fff6e0'), s * 0.32, 0.55 + k * 0.16, -0.08, { r: [0, s * 0.3, s * (0.4 - k * 0.3)] }));
    c.add(bloc(0.03, 0.5, 0.012, or, 0.22, 0.5, 0.08));
  },
  ozrath(c, { ec }) {
    const chair = bois('#3a2a4a');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.add(tige(0.03, 0.06, 0.4, chair, Math.cos(a) * 0.14, 0.18, Math.sin(a) * 0.14, { r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] })); }
    c.add(tige(0.06, 0.1, 0.3, chair, 0, 0.42, 0));
    c.add(boule(0.26, bois('#e8e0f0'), 0, 0.74, 0));
    c.add(boule(0.13, bois(ec, { lueur: 1.4 }), 0, 0.76, 0.17));
    c.add(boule(0.06, bois('#000000'), 0, 0.77, 0.26));
  },
  azhar(c, { ec }) {
    const noir = bois('#1a1418', { metal: 0.3 }); const or = bois('#ffd45e', { metal: 0.6 });
    c.add(tour([[0, 0], [0.28, 0], [0.26, 0.32], [0.2, 0.58], [0, 0.62]], noir));
    c.add(bloc(0.5, 0.6, 0.03, bois('#3a0a14'), 0, 0.34, -0.2));
    c.add(boule(0.12, noir, 0, 0.72, 0));
    yeux(c, 0.73, 0.11, 0.045, 0.02, ec, 1.6);
    for (let i = 0; i < 5; i++) c.add(pointe(0.025, 0.12, or, -0.08 + i * 0.04, 0.88, 0));
    c.add(bloc(0.05, 0.7, 0.015, bois('#8a8a90', { metal: 0.5 }), 0.3, 0.5, 0.08));
    c.add(bloc(0.16, 0.03, 0.03, or, 0.3, 0.2, 0.08));
  },
};

/* ------------------------------------------------------------------ */
/* Les pièces de la carte                                              */
/* ------------------------------------------------------------------ */

/** Ce qui se dresse sur une salle de la carte, selon son type (ou une porte, si on ne sait pas). */
export function pieceCarte(type) {
  const g = new THREE.Group();
  const add = (m) => { g.add(m); return m; };
  switch (type) {
    case 'combat':
      add(boule(0.16, bois('#4a3a26'), 0, 0, 0, { s: [1, 0.4, 1] }));
      for (const s of [-1, 1]) { add(bloc(0.04, 0.5, 0.015, bois('#b8c0c8', { metal: 0.5 }), s * 0.06, 0.26, 0, { r: [0, 0, s * 0.45] })); add(bloc(0.14, 0.03, 0.03, bois('#c89a4a'), s * 0.15, 0.4, 0, { r: [0, 0, s * 0.45] })); }
      break;
    case 'elite':
      add(tige(0.015, 0.015, 0.5, bois('#4a3018'), 0, 0.25, 0));
      add(boule(0.11, bois('#e8e0c8'), 0, 0.55, 0));
      for (const s of [-1, 1]) add(boule(0.03, bois('#ff3a2a', { lueur: 1.2 }), s * 0.04, 0.56, 0.09));
      add(bloc(0.08, 0.04, 0.05, bois('#e8e0c8'), 0, 0.46, 0.06));
      break;
    case 'repos': {
      for (let i = 0; i < 4; i++) add(tige(0.035, 0.035, 0.34, bois('#5a3a1e'), 0, 0.06, 0, { r: [Math.PI / 2, (i / 4) * Math.PI, 0.25] }));
      add(pointe(0.1, 0.26, bois('#ff9a30', { lueur: 1.8 }), 0, 0.2, 0));
      add(pointe(0.05, 0.16, bois('#fff0a0', { lueur: 2 }), 0, 0.17, 0));
      const l = new THREE.PointLight('#ff9a40', 2.2, 3, 1.6); l.position.y = 0.4; add(l);
      break;
    }
    case 'marchand':
      add(bloc(0.42, 0.18, 0.2, bois('#6a4a2a'), 0, 0.09, 0));
      for (const s of [-1, 1]) add(tige(0.015, 0.015, 0.42, bois('#4a3018'), s * 0.19, 0.3, -0.08));
      for (let i = 0; i < 4; i++) add(bloc(0.11, 0.025, 0.26, bois(i % 2 ? '#e8dcc0' : '#2a8a4a'), -0.165 + i * 0.11, 0.52, 0.02, { r: [0.35, 0, 0] }));
      add(boule(0.05, bois('#ffd45e', { metal: 0.5 }), -0.08, 0.22, 0.05)); add(boule(0.04, bois('#c83a3a'), 0.08, 0.21, 0.05));
      break;
    case 'tresor':
      add(bloc(0.34, 0.18, 0.22, bois('#7a4a1e'), 0, 0.09, 0));
      add(maille(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 8, 1, false, 0, Math.PI), bois('#8a5a26'), 0, 0.18, 0, { r: [0, 0, Math.PI / 2] }));
      for (const x of [-0.12, 0.12]) add(bloc(0.03, 0.3, 0.24, bois('#ffd45e', { metal: 0.5 }), x, 0.15, 0));
      add(bloc(0.05, 0.06, 0.02, bois('#ffd45e', { metal: 0.5 }), 0, 0.18, 0.12));
      break;
    case 'evenement':
      add(maille(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), bois('#e8dcb8'), 0, 0.05, 0, { r: [0, 0, Math.PI / 2] }));
      add(maille(new THREE.TorusGeometry(0.09, 0.03, 5, 10, Math.PI * 1.5), bois('#e8c060'), 0, 0.4, 0, { r: [0, 0, -Math.PI * 0.25] }));
      add(tige(0.03, 0.03, 0.1, bois('#e8c060'), 0, 0.24, 0));
      add(boule(0.035, bois('#e8c060'), 0, 0.14, 0));
      break;
    case 'compagnon': {
      const h = figurineHeros({ peuple: 'humain', ecole: 'nature', role: 'dps', classe: 'Voyageur', id: 'voyageur' });
      h.scale.setScalar(0.5); add(h);
      break;
    }
    case 'recrutement':
      add(maille(new THREE.ConeGeometry(0.26, 0.36, 4), bois('#b89a6a'), 0, 0.18, 0, { r: [0, Math.PI / 4, 0] }));
      add(bloc(0.08, 0.16, 0.01, bois('#3a2410'), 0, 0.08, 0.17));
      add(tige(0.01, 0.01, 0.3, bois('#4a3018'), 0, 0.5, 0));
      add(bloc(0.12, 0.07, 0.01, bois('#c83a3a'), 0.06, 0.6, 0));
      break;
    case 'boss':
      break;
    default:
      // Une porte close, dans son arche de pierre.
      add(bloc(0.3, 0.38, 0.06, bois('#7a7a72'), 0, 0.19, 0));
      add(bloc(0.2, 0.3, 0.07, bois('#4a2c14'), 0, 0.15, 0.01));
      add(boule(0.02, bois('#c8a040', { metal: 0.5 }), 0.06, 0.15, 0.05));
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
