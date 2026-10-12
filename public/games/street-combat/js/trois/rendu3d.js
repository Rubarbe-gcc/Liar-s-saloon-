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
 * Coordonnées : celles du combattant (x vers l'avant, y vers le bas), avec
 * Y retourné pour la 3D, et Z vers nous.
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';
import { SEGMENTS, teinte, manche, gant } from '../dessin.js';

const rad = (d) => (d * Math.PI) / 180;

/** Le cadre de l'image, en unités du combattant : assez large pour les ailes, les capes et les armes. */
const CADRE = { x0: -160, x1: 160, y0: -290, y1: 40 };
const CW = CADRE.x1 - CADRE.x0;
const CH = CADRE.y1 - CADRE.y0;
/** La toile de rendu (on ne dessine que dans un coin, à la taille voulue). */
const TOILE = { l: 760, h: 784 };

/* ------------------------------------------------------------------ */
/* Le démarrage                                                        */
/* ------------------------------------------------------------------ */

/** Ce que les métaux reflètent : un studio (un ciel bleuté, un sol sombre, deux grandes lumières). */
function environnement(renderer) {
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(100, 32, 16);
  const couleurs = [];
  const pos = geo.attributes.position;
  const haut = new THREE.Color('#cfdcff');
  const milieu = new THREE.Color('#7a6a8a');
  const bas = new THREE.Color('#1a1420');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 100;
    const c = y > 0 ? milieu.clone().lerp(haut, y) : milieu.clone().lerp(bas, -y);
    couleurs.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [x, y, z, c, i] of [[-60, 50, 60, '#fff4e0', 6], [70, 30, -50, '#a8c4ff', 4]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
    p.position.set(x, y, z); p.lookAt(0, 0, 0);
    env.add(p);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  return tex;
}

/** Démarre le rendu 3D ; null si le navigateur ne sait pas faire de WebGL. */
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.environment = environnement(renderer);
  // La lumière : le ciel et le sol, une lumière principale en haut à gauche, un contre-jour derrière.
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3048, 0.7));
  const cle = new THREE.DirectionalLight(0xfff2e0, 2.1);
  cle.position.set(-260, 420, 520);
  scene.add(cle);
  const contre = new THREE.DirectionalLight(0x9ab8ff, 1.6);
  contre.position.set(320, 180, -460);
  scene.add(contre);
  const bas = new THREE.DirectionalLight(0xffc8a0, 0.35);
  bas.position.set(0, -300, 300);
  scene.add(bas);

  // La caméra : face au plan du combat, assez loin pour que la perspective reste douce.
  const fov = 22;
  const D = (CH / 2) / Math.tan(rad(fov / 2));
  const camera = new THREE.PerspectiveCamera(fov, CW / CH, D - 400, D + 400);
  camera.position.set((CADRE.x0 + CADRE.x1) / 2, -(CADRE.y0 + CADRE.y1) / 2, D);
  camera.lookAt((CADRE.x0 + CADRE.x1) / 2, -(CADRE.y0 + CADRE.y1) / 2, 0);

  const modeles = new Map();
  let courant = null;

  return {
    renderer,
    /** Dessine le combattant dans `g`, dont le repère est déjà celui du combattant (et son échelle). */
    dessiner(g, perso, sq, o) {
      const cle3d = cleDe(perso);
      let m = modeles.get(cle3d);
      if (!m) {
        m = construire(perso);
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
      const k = Math.min(TOILE.l / CW, TOILE.h / CH, Math.max(0.6, s * 1.05));
      const vw = Math.max(16, Math.round(CW * k));
      const vh = Math.max(16, Math.round(CH * k));
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

const mats = new Map();
/** Une matière : du tissu, de la peau, du métal, ou une lueur. */
function mat(couleur, sorte = 'tissu') {
  const cle = `${couleur}|${sorte}`;
  if (mats.has(cle)) return mats.get(cle);
  const c = new THREE.Color(couleur);
  let m;
  if (sorte === 'metal') m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.85 });
  else if (sorte === 'brillant') m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.2 });
  else if (sorte === 'peau') m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0 });
  else if (sorte === 'lueur') m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.4 });
  else if (sorte === 'verre') m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.75 });
  else if (sorte === 'voile') m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide });
  else if (sorte === 'voile-lueur') m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  else m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 });
  mats.set(cle, m);
  return m;
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
  const chaussure = mat(L.tete === 'rocher' ? teinte(k.peau, -0.3) : teinte(k.tenue, -0.55), 'brillant');
  const mancheC = manche(perso);
  const bras = mat(mancheC, mancheC === k.peau ? 'peau' : 'tissu');
  const gantC = gant(perso);
  const gants = mat(gantC, X.includes('gants-boxe') ? 'brillant' : gantC === k.peau ? 'peau' : 'tissu');
  const metallique = ['ironclad', 'stoneback', 'lechaos', 'malvortex'].includes(perso.id) || perso.figurant;
  const tenue = mat(k.tenue, metallique && perso.id === 'ironclad' ? 'metal' : 'tissu');

  /* ---- Le bassin, et les jambes ---- */
  P.bassin = boule(1, pantalon); P.bassin.scale.set(13 * l, 9, 11 * l);
  groupe.add(P.bassin);
  P.cuisseA = segment(8.6 * m, pantalon, 7.4 * m); P.cuisseR = segment(8.2 * m, pantalon, 7 * m);
  P.tibiaA = segment(7.4 * m, pantalon, 6.2 * m); P.tibiaR = segment(7 * m, pantalon, 6 * m);
  const pied = () => {
    const g = new THREE.Group();
    const b = maille(GEO.sphere(), chaussure, 11 * m, 5.6, 6.8 * m);
    b.position.set(5 * m, -1.5, 0);
    const semelle = maille(GEO.boite(), mat('#1a1418'), 22 * m, 2.2, 12 * m);
    semelle.position.set(5 * m, -5.5, 0);
    g.add(b, semelle);
    return g;
  };
  P.piedA = pied(); P.piedR = pied();
  groupe.add(P.cuisseR, P.tibiaR, P.piedR, P.cuisseA, P.tibiaA, P.piedA);

  /* ---- Le buste : un tronc qui s'élargit vers les épaules, tourné vers nous ---- */
  const buste = new THREE.Group();
  P.buste = buste;
  const largeur = 22 * l;
  const taille = 15 * l;
  const nu = X.includes('torse-nu');
  const haut = nu ? peau : tenue;
  const tronc = new THREE.Mesh(new THREE.CylinderGeometry(largeur * 0.92, taille, 46, 26, 1), haut);
  tronc.position.y = 25;
  tronc.scale.z = 0.62;
  const poitrine = boule(1, haut, 1, 1); poitrine.scale.set(largeur * 0.98, 9, largeur * 0.5); poitrine.position.y = 43;
  const ventre = boule(1, haut); ventre.scale.set(taille * 1.02, 8, taille * 0.66); ventre.position.y = 3;
  buste.add(tronc, poitrine, ventre);
  if (KIMONO.includes(perso.id)) {
    const v = plaque([[-7, 48], [9, 48], [1, 20]], 1, peau);
    v.position.set(0, 0, largeur * 0.6 + 0.4);
    buste.add(v);
  }
  if (nu) {
    for (const y of [36, 26, 17]) { const ligne = maille(GEO.boite(), mat(teinte(k.peau, -0.3), 'peau'), 12, 1.2, 1); ligne.position.set(0, y, taille * 0.66 + 1.5); buste.add(ligne); }
  }
  // La ceinture, et son nœud.
  const ceinture = new THREE.Mesh(new THREE.CylinderGeometry(taille + 1.6, taille + 1.4, 8, 26, 1), mat(k.ceinture));
  ceinture.scale.z = 0.7; ceinture.position.y = 1;
  const noeud = maille(GEO.boite(), mat(teinte(k.ceinture, -0.2)), 5, 12, 2);
  noeud.position.set(taille - 3, -6, taille * 0.5); noeud.rotation.z = 0.35;
  buste.add(ceinture, noeud);
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
  const poing = X.includes('gants-boxe') ? 11.5 : 7.5;
  P.mainA = boule(poing * m, gants); P.mainR = boule(poing * m * 0.95, gants);
  groupe.add(P.brasR, P.avantBrasR, P.mainR, P.brasA, P.avantBrasA, P.mainA);
  // Les épaules, arrondies.
  P.epauleA = boule(8.4 * m * l, haut); P.epauleR = boule(8 * m * l, haut);
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
  visage.rotation.y = rad(-38);
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

  // Le visage.
  const forme = L.tete === 'rocher' ? maille(GEO.dode(), peau, 15.5, 16, 14.5) : boule(1, peau);
  if (L.tete !== 'rocher') forme.scale.set(14.5, 16, 13.8);
  const machoire = boule(1, mat(teinte(k.peau, -0.05), 'peau')); machoire.scale.set(9.5, 7.5, 10); machoire.position.set(5, -8, 0);
  const nez = boule(1, peau); nez.scale.set(3.2, 2.6, 2.2); nez.position.set(14.2, -2, 0);
  visage.add(forme, machoire, nez);
  for (const z of [-1, 1]) { const o = boule(1, peau); o.scale.set(2.6, 4.2, 2); o.position.set(0, -1, z * 13.6); visage.add(o); }

  // Les yeux, les sourcils, la bouche.
  const luisants = X.includes('yeux-luisants') || L.tete === 'capuche' || L.tete === 'visiere';
  for (const z of [-5.2, 5.2]) {
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
  const bouche = maille(GEO.boite(), mat('#5a2020'), 1.2, 1.6, 7); bouche.position.set(13.2, -9, 0.5);
  visage.add(bouche); T.bouche = bouche;
  if (X.includes('barbe')) {
    const b = boule(1, cheveux); b.scale.set(8, 18, 9); b.position.set(8, -20, 0); visage.add(b);
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
      for (let i = 0; i < 5; i++) pic(-10 + i * 4, 15, -6 + (i % 2) * 6, 12, 3.4, rad(30 - i * 4));
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
    default:
      calotte(0.48);
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
    const c = plaque([[-14 * l, 0], [8, 0], [-6, -48], [-10, -104 - long], [-50 - long, -98 - long], [-40 - long * 0.6, -46]], 2, mat(general ? '#a0102a' : perso.id === 'malvortex' ? '#5a0010' : teinte(k.tenue, 0.1), 'voile'));
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
    P.queue = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-6, -2, 0), new THREE.Vector3(-40, -30, -6), new THREE.Vector3(-60, -10, -10)), 16, 4.5, 10, false), mat(X.includes('queue-dragon') ? teinte(k.peau, -0.1) : k.c1, 'brillant'));
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
  const H_A = V(hanche, zJ * 0.8); const H_R = V(hanche, -zJ * 0.8);
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
  P.buste.rotation.set(0, rad(-28), -rad(pose.b));
  if (P.jupe) { P.jupe.position.copy(V(hanche)); P.jupe.rotation.set(0, 0, Math.sin(t / 7) * 0.04); }

  // Les bras : l'épaule de devant vers nous.
  const EA = V(epA, zB); const ER = V(epR, -zB);
  P.epauleA.position.copy(EA); P.epauleR.position.copy(ER);
  const CA = V(coudeA, zB + 2); const MA = V(mainA, zB + 3);
  const CR = V(coudeR, -zB - 1); const MR = V(mainR, -zB - 2);
  placer(P.brasA, EA, CA); placer(P.avantBrasA, CA, MA);
  placer(P.brasR, ER, CR); placer(P.avantBrasR, CR, MR);
  P.mainA.position.copy(MA); P.mainR.position.copy(MR);

  // Le cou, la tête.
  const T = P.tete;
  placer(P.cou, V(cou), V(tete).add(new THREE.Vector3(0, -8, 0)));
  T.groupe.position.copy(V(tete));
  T.groupe.rotation.set(0, 0, -rad((pose.b + (pose.tt || 0)) * 0.35));
  const touche = ['touche', 'vol', 'ko', 'sol'].includes(o.pose);
  const ko = o.pose === 'ko';
  // K.O. : les yeux se ferment.
  for (const e of T.yeux) { e.userData.sy ??= e.scale.y; e.scale.y = ko ? e.userData.sy * 0.18 : e.userData.sy; }
  for (const p of T.pupilles) p.visible = !ko;
  if (T.bouche) { T.bouche.scale.y = touche ? 4.4 : 1.6; T.bouche.scale.z = touche ? 4 : 7; }
  if (T.pans) T.pans.rotation.set(0, 0, Math.sin(t / 5) * 0.12 - 0.05);
  if (T.panache) T.panache.rotation.z = Math.sin(t / 6) * 0.06;
  if (T.halo) T.halo.position.y = 30 + Math.sin(t / 10) * 2;
  if (T.couronne) T.couronne.rotation.y = t / 40;
  if (T.dos) T.dos.rotation.z = rad(-12) + Math.sin(t / 8) * 0.05;

  // Les accessoires suivent le corps.
  const dos = V(epaule, -10 * l);
  if (P.cape) { P.cape.position.copy(dos); P.cape.rotation.set(0, 0, -rad(pose.b) * 0.5 + Math.sin(t / 7) * 0.05); }
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
  if (P.epauliere) { P.epauliere.position.copy(V(epaule, zB * 0.7)); P.epauliere.position.y -= 2; P.epauliere.rotation.set(0, 0, -rad(pose.b) * 0.6 - 0.15); }
  if (P.brassard) { P.brassard.position.copy(CA).lerp(EA, 0.5); P.brassard.rotation.set(Math.PI / 2, 0, Math.atan2(CA.y - EA.y, CA.x - EA.x)); }
  if (P.aiguille) P.aiguille.rotation.z = -t / 30;
}

/** Une arme tenue en main : elle prolonge l'avant-bras (ou part du coude, pour le canon). */
function tenir(obj, main, coude, depuisCoude = false) {
  const a = Math.atan2(main.y - coude.y, main.x - coude.x);
  obj.position.copy(depuisCoude ? coude : main);
  obj.rotation.set(0, 0, a);
}
