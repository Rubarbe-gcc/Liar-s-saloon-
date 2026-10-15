/**
 * RAID — les petits objets sculptés de la table du Conteur : la bourse d'or,
 * les fioles, la plume, le trèfle, le parchemin, la besace, la boussole, le
 * livre, la lettre, la clochette, la bougie, les boîtes des sauvegardes, les
 * pions de difficulté.
 *
 * Ils servent deux fois : vivants, sur la table du menu (fond3d.js), et figés,
 * en petites images à gros pixels (`icone`, `portrait`) partout ailleurs —
 * dans les ressources, le groupe, les boutons.
 */

import { THREE, bois } from './scene3d.js';
import { figurineHeros, pieceCarte } from './figurines3d.js';

function m(geo, mat, x = 0, y = 0, z = 0, r = null) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  if (r) o.rotation.set(...r);
  o.castShadow = true;
  return o;
}

/** Une fiole : la panse ronde, le col, le bouchon. */
function fiole(couleur) {
  const g = new THREE.Group();
  g.add(m(new THREE.IcosahedronGeometry(0.32, 1), bois(couleur, { lueur: 0.5 }), 0, 0.32, 0));
  g.add(m(new THREE.CylinderGeometry(0.09, 0.12, 0.26, 7), bois('#d8e8f0'), 0, 0.68, 0));
  g.add(m(new THREE.CylinderGeometry(0.1, 0.09, 0.1, 7), bois('#8a5a2a'), 0, 0.84, 0));
  return g;
}

/** Une boîte de bois, fermée ou ouverte (le couvercle relevé). */
function boite(ouverte, couleur = '#6a4422') {
  const g = new THREE.Group();
  const b = bois(couleur), f = bois('#c89a4a', { metal: 0.5 });
  g.add(m(new THREE.BoxGeometry(1.2, 0.5, 0.8), b, 0, 0.25, 0));
  const couvercle = new THREE.Group();
  couvercle.add(m(new THREE.BoxGeometry(1.24, 0.14, 0.84), b, 0, 0.07, 0.42));
  couvercle.add(m(new THREE.BoxGeometry(0.14, 0.16, 0.06), f, 0, 0.04, 0.86));
  couvercle.position.set(0, 0.5, -0.42);
  couvercle.rotation.x = ouverte ? -1.9 : 0;
  g.add(couvercle);
  for (const x of [-0.45, 0.45]) g.add(m(new THREE.BoxGeometry(0.06, 0.52, 0.82), f, x, 0.26, 0));
  if (ouverte) g.add(m(new THREE.BoxGeometry(1.08, 0.04, 0.68), bois('#3a1a10'), 0, 0.46, 0));
  g.userData.couvercle = couvercle;
  return g;
}

/** Les fabriques : chaque nom donne un objet neuf (environ une unité de haut). */
export const OBJETS = {
  or() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) g.add(m(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 12), bois('#ffd45e', { metal: 0.6 }), (i % 2) * 0.05, 0.05 + i * 0.1, 0));
    g.add(m(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 12), bois('#ffd45e', { metal: 0.6 }), 0.5, 0.05, 0.1, [0.2, 0, 1.3]));
    return g;
  },
  potion: () => fiole('#d83a3a'),
  elixir: () => fiole('#3a7ad8'),
  phenix() {
    const g = new THREE.Group();
    const p = m(new THREE.IcosahedronGeometry(0.3, 0), bois('#ff7a2a', { lueur: 0.6 }), 0, 0.5, 0);
    p.scale.set(0.45, 1.6, 0.12); p.rotation.z = 0.4;
    g.add(p, m(new THREE.CylinderGeometry(0.02, 0.02, 1, 5), bois('#e8dcc0'), 0.06, 0.45, 0.02, [0, 0, 0.4]));
    return g;
  },
  chance() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; g.add(m(new THREE.IcosahedronGeometry(0.2, 1), bois('#3ab84a'), Math.cos(a) * 0.2, 0.62 + Math.sin(a) * 0.2, 0)); }
    g.add(m(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), bois('#2a7a2a'), 0, 0.25, 0));
    return g;
  },
  parchemin() {
    const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(0.16, 0.16, 1, 10), bois('#e8d8b0'), 0, 0.16, 0, [0, 0, Math.PI / 2]));
    for (const x of [-0.52, 0.52]) g.add(m(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), bois('#6a4422'), x, 0.16, 0, [0, 0, Math.PI / 2]));
    g.add(m(new THREE.BoxGeometry(0.06, 0.34, 0.02), bois('#c83a2a'), 0, 0.16, 0.16));
    return g;
  },
  sac() {
    const g = new THREE.Group();
    const s = m(new THREE.IcosahedronGeometry(0.45, 1), bois('#8a5a2a'), 0, 0.42, 0); s.scale.set(1, 0.9, 0.8);
    g.add(s, m(new THREE.TorusGeometry(0.16, 0.05, 5, 10), bois('#5a3a1a'), 0, 0.82, 0, [Math.PI / 2, 0, 0]));
    g.add(m(new THREE.ConeGeometry(0.18, 0.22, 7), bois('#8a5a2a'), 0, 0.94, 0));
    g.add(m(new THREE.TorusGeometry(0.42, 0.04, 4, 14, Math.PI), bois('#5a3a1a'), 0, 0.6, -0.1, [0, 0, 0]));
    return g;
  },
  boussole() {
    const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(0.5, 0.52, 0.16, 16), bois('#c89a4a', { metal: 0.6 }), 0, 0.08, 0));
    g.add(m(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 16), bois('#f0e8d0'), 0, 0.17, 0));
    g.add(m(new THREE.ConeGeometry(0.06, 0.4, 4), bois('#d83a3a'), 0, 0.2, -0.14, [-Math.PI / 2, 0, 0]));
    g.add(m(new THREE.ConeGeometry(0.06, 0.4, 4), bois('#2a2a3a'), 0, 0.2, 0.14, [Math.PI / 2, 0, 0]));
    g.add(m(new THREE.TorusGeometry(0.1, 0.03, 5, 10), bois('#c89a4a', { metal: 0.6 }), 0, 0.2, -0.56));
    return g;
  },
  livre() {
    const g = new THREE.Group();
    g.add(m(new THREE.BoxGeometry(1.1, 0.08, 0.8), bois('#6a1a1a'), 0, 0.04, 0));
    g.add(m(new THREE.BoxGeometry(1.02, 0.22, 0.74), bois('#f0e4c8'), 0.02, 0.19, 0));
    g.add(m(new THREE.BoxGeometry(1.1, 0.08, 0.8), bois('#6a1a1a'), 0, 0.34, 0));
    g.add(m(new THREE.BoxGeometry(0.08, 0.38, 0.8), bois('#4a1010'), -0.53, 0.19, 0));
    g.add(m(new THREE.BoxGeometry(0.3, 0.02, 0.3), bois('#ffd45e', { metal: 0.6 }), 0.1, 0.39, 0));
    return g;
  },
  lettre() {
    const g = new THREE.Group();
    g.add(m(new THREE.BoxGeometry(1, 0.05, 0.66), bois('#f0e8d4'), 0, 0.03, 0));
    g.add(m(new THREE.ConeGeometry(0.5, 0.33, 4, 1), bois('#e0d4b8'), 0, 0.07, -0.16, [Math.PI / 2, Math.PI / 4, 0]));
    g.add(m(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 10), bois('#c8202a'), 0, 0.09, 0.02));
    return g;
  },
  cloche() {
    const g = new THREE.Group();
    g.add(m(new THREE.LatheGeometry([[0, 0.2], [0.42, 0.2], [0.36, 0.3], [0.28, 0.6], [0.2, 0.78], [0, 0.82]].map(([a, b]) => new THREE.Vector2(a, b)), 12), bois('#c89a4a', { metal: 0.7 })));
    g.add(m(new THREE.IcosahedronGeometry(0.07, 0), bois('#8a6a2a', { metal: 0.6 }), 0, 0.2, 0));
    g.add(m(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), bois('#3a2410'), 0, 0.95, 0));
    return g;
  },
  bougie() {
    const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(0.4, 0.44, 0.06, 14), bois('#6a5a40', { metal: 0.5 }), 0, 0.03, 0));
    g.add(m(new THREE.CylinderGeometry(0.18, 0.2, 0.7, 10), bois('#e8dcc0'), 0, 0.4, 0));
    g.add(m(new THREE.ConeGeometry(0.07, 0.24, 7), new THREE.MeshBasicMaterial({ color: '#ffdf8a' }), 0, 0.88, 0));
    return g;
  },
  boite: () => boite(false),
  boiteOuverte: () => boite(true),
  facile() {
    const g = socle();
    for (let i = 0; i < 3; i++) g.add(m(new THREE.IcosahedronGeometry(0.16, 0), bois('#5ac84a'), (i - 1) * 0.15, 0.42 + (i % 2) * 0.12, 0, [0, 0, (i - 1) * 0.6]));
    g.add(m(new THREE.CylinderGeometry(0.03, 0.04, 0.34, 5), bois('#3a8a2a'), 0, 0.26, 0));
    return g;
  },
  normal() { const g = socle(); const p = pieceCarte('combat'); p.scale.setScalar(1.6); p.position.y = 0.08; g.add(p); return g; },
  difficile() {
    const g = socle();
    g.add(m(new THREE.ConeGeometry(0.22, 0.7, 7), bois('#ff8a2a', { lueur: 1.4 }), 0, 0.45, 0));
    g.add(m(new THREE.ConeGeometry(0.12, 0.4, 7), bois('#fff0a0', { lueur: 1.6 }), 0, 0.34, 0.04));
    return g;
  },
  hardcore() { const g = socle(); const p = pieceCarte('elite'); p.scale.setScalar(1.5); p.position.y = 0.08; g.add(p); return g; },
};
function socle() {
  const g = new THREE.Group();
  g.add(m(new THREE.CylinderGeometry(0.38, 0.42, 0.1, 12), bois('#5a3a22'), 0, 0.05, 0));
  return g;
}

/* ------------------------------------------------------------------ */
/* Les images figées                                                   */
/* ------------------------------------------------------------------ */

let rendu = null;
const images = new Map();

/** Rend un objet en petite image à gros pixels (une seule fois par clé). Null sans WebGL. */
function photographier(cle, fabrique, { taille = 72, buste = false } = {}) {
  if (images.has(cle)) return images.get(cle);
  if (!rendu) {
    try {
      const cv = document.createElement('canvas');
      rendu = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, preserveDrawingBuffer: true });
      rendu.setPixelRatio(1);
      rendu.outputColorSpace = THREE.SRGBColorSpace;
      rendu.toneMapping = THREE.ACESFilmicToneMapping;
    } catch { rendu = false; }
  }
  if (!rendu) return null;
  rendu.setSize(taille, taille, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#c8b8a8', '#2a1810', 1.1));
  const l = new THREE.DirectionalLight('#ffd8a0', 2.2); l.position.set(2, 4, 3); scene.add(l);
  const objet = fabrique();
  scene.add(objet);
  const boite3 = new THREE.Box3().setFromObject(objet);
  const centre = boite3.getCenter(new THREE.Vector3());
  const t = boite3.getSize(new THREE.Vector3());
  // Le buste : on cadre le haut de la figurine (la tête et les épaules).
  if (buste) { centre.y = boite3.max.y - t.y * 0.28; t.y *= 0.5; }
  const rayon = Math.max(t.x, t.y, t.z) * 0.62;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const d = rayon / Math.tan((15 * Math.PI) / 180);
  camera.position.copy(centre).add(new THREE.Vector3(0, d * 0.42, d * 0.9));
  camera.lookAt(centre);
  rendu.render(scene, camera);
  const url = rendu.domElement.toDataURL('image/png');
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  images.set(cle, url);
  return url;
}

/** Une icône d'objet (`or`, `potion`, `sac`…), en image ; null sans WebGL. */
export const icone = (nom) => (OBJETS[nom] ? photographier(nom, OBJETS[nom]) : null);
/** Le portrait d'un héros : le haut de sa figurine, en image. */
export const portrait = (h) => photographier(`h:${h.id}:${h.ecole}:${h.peuple}`, () => { const f = figurineHeros(h); f.rotation.y = 0.35; return f; }, { taille: 80, buste: true });
