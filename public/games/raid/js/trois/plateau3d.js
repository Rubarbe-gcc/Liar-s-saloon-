/**
 * RAID — la carte en 3D : le plateau de jeu posé sur la table du Conteur.
 *
 * Un plateau encadré de bois, une forêt dense de cônes taillés tout autour
 * des chemins, des pas japonais, et sur chaque salle une petite pièce
 * sculptée (deux épées, un crâne, un feu de bûches, une échoppe, un coffre,
 * un parchemin, une tente… ou une porte close). Le chef du groupe avance en
 * figurine ; le maître du chapitre attend au sommet. Chaque chapitre a son
 * décor (mares, ruines, forge, glace, cendres, racines, tombes, tours,
 * néant, obsidienne).
 *
 * Ce module ne décide de rien : il dessine ce que main.js lui donne. Les
 * clics restent sur les boutons de la carte, posés pile sur les pièces
 * (`ecran(id)` dit où) : le clavier et la logique du jeu ne changent pas.
 */

import { THREE, creerScene, alea, hacher, texture, bois, qualite, reglerQualite } from './scene3d.js';
import { figurineHeros, figurineMonstre, pieceCarte } from './figurines3d.js';

export { qualite, reglerQualite };

/* ------------------------------------------------------------------ */
/* Les chapitres                                                       */
/* ------------------------------------------------------------------ */

/** Pour chaque chapitre : le sol, les arbres, la lumière, et son décor. */
const THEMES = [
  { sol: ['#1a2420', '#24302a'], arbres: ['#5a8a5a', '#6a9a62', '#4a7a4e'], lumiere: '#ffd890', decor: 'eau' },
  { sol: ['#1c1820', '#28222c'], arbres: ['#4a4458', '#5a546a', '#3a3446'], lumiere: '#e8c8ff', decor: 'cloitre' },
  { sol: ['#241410', '#30201a'], arbres: ['#5a3428', '#6a4030', '#4a2a20'], lumiere: '#ffa060', decor: 'forge' },
  { sol: ['#2a3440', '#36404c'], arbres: ['#a8c8dc', '#c8e0ee', '#88a8c0'], lumiere: '#d8f0ff', decor: 'glace' },
  { sol: ['#201a18', '#2c2420'], arbres: ['#4a403c', '#5a4e48', '#3a3230'], lumiere: '#ffb070', decor: 'cendre' },
  { sol: ['#1a2214', '#24301c'], arbres: ['#4a7a34', '#5a9a40', '#3a6a2a'], lumiere: '#e8ffb0', decor: 'racines' },
  { sol: ['#161a1e', '#20262a'], arbres: ['#3a4c4c', '#465a5a', '#2c3c3c'], lumiere: '#b0ffd8', decor: 'tombes' },
  { sol: ['#22201a', '#2e2a22'], arbres: ['#7a7050', '#9a8c60', '#5a5440'], lumiere: '#fff0b0', decor: 'tours' },
  { sol: ['#14121e', '#1e1a2a'], arbres: ['#3a3a68', '#4a4888', '#2a2a50'], lumiere: '#c8c0ff', decor: 'neant' },
  { sol: ['#1a0e0c', '#261612'], arbres: ['#2a1e1c', '#3a2622', '#1e1412'], lumiere: '#ff7a4a', decor: 'obsidienne' },
];

/** Une carte (pourcentages, comme la carte 2D) → le plateau (unités du monde). */
const LARGE = 0.1;
const PROFOND = 0.15;
const versMonde = (x, y) => new THREE.Vector3((x - 50) * LARGE, 0, (y - 50) * PROFOND);
/** Là où attend le groupe avant d'entrer dans la première salle. */
const ENTREE = new THREE.Vector3(0, 0, 7.6);
/** Le plateau : sa taille, son épaisseur. */
const PLATEAU = { l: 17, p: 22, z: -1.2, ep: 0.35 };
/** Le Conteur, derrière le plateau : où sont ses yeux (on veut toujours les voir). */
const CONTEUR = { z: -14, y: -8.5, echelle: 1.75, mains: { ecart: 5.2, y: -0.35, z: -13.2 } };
const YEUX = new THREE.Vector3(0, CONTEUR.y + 8 * CONTEUR.echelle, CONTEUR.z + 2 * CONTEUR.echelle);

/** Les liens de la carte, plus ceux qui partent de l'entrée vers la première rangée. */
function liensAvecEntree(etat) {
  const bas = Math.max(...etat.noeuds.filter((n) => n.type !== 'boss').map((n) => n.y));
  const premiers = etat.noeuds.filter((n) => n.type !== 'boss' && n.y === bas);
  return [...etat.liens, ...premiers.map((n) => ({ a: 'entree', b: n.id, fait: etat.visitesPremiere === n.id, ouvert: !etat.position }))];
}

/* ------------------------------------------------------------------ */
/* Le plateau                                                          */
/* ------------------------------------------------------------------ */

/**
 * Crée le plateau dans `hote` (un élément positionné). Rend null si WebGL manque.
 * @returns {{ maj(etat, placer), ecran(id), survol(id) } | null}
 */
export function creerPlateau(hote) {
  const S = creerScene(hote, {
    table: { largeur: 60, profondeur: 50, y: -PLATEAU.ep, z: -4 },
    bougies: [[-10.2, 5.5, 1.6], [10.4, 3.2, 1.1]],
    conteur: CONTEUR,
    forceBougies: 30,
    expo: 1.4,
  });
  if (!S) return null;
  const { scene, camera } = S;
  const q = S.qualite;

  // Une lampe au-dessus du plateau, chaude, qui fait briller le centre.
  const lanterne = new THREE.PointLight('#ffd890', 70, 26, 1.6);
  lanterne.position.set(0, 7, 0.5);
  lanterne.castShadow = q === 'haute';
  lanterne.shadow.mapSize.set(1024, 1024); lanterne.shadow.bias = -0.002;
  const lueurBoss = new THREE.PointLight('#ff4a3a', 14, 6, 1.6);
  scene.add(lanterne, lueurBoss);

  let monde = null;
  let cleMonde = '';
  const jetons = new Map();
  let pas = null;
  let chef = null;
  let cleChef = '';
  let survole = null;
  const anim = { depuis: null, vers: null, t: 1 };
  let lucioles = null;
  let reperes = [];

  function vider(obj) {
    obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (!m.__partage) m.dispose(); }); });
  }

  /** Le décor du chapitre : le plateau, la forêt, les pièces, le maître du chapitre. */
  function construire(etat) {
    if (monde) { scene.remove(monde); vider(monde); }
    monde = new THREE.Group();
    scene.add(monde);
    jetons.clear();
    chef = null; cleChef = '';
    const th = THEMES[(etat.acte - 1) % THEMES.length];
    const R = alea(hacher(cleMonde));
    lanterne.color.set(th.lumiere);

    // Le plateau : un sol taché, encadré de planches.
    const sol = texture(512, (g, n) => {
      g.fillStyle = th.sol[0]; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = R() < 0.5 ? th.sol[1] : 'rgba(0,0,0,0.25)';
        g.globalAlpha = 0.25 + R() * 0.4;
        g.beginPath(); g.arc(R() * n, R() * n, 1 + R() * 5, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    });
    sol.wrapS = sol.wrapT = THREE.RepeatWrapping; sol.repeat.set(3, 4);
    const fond = new THREE.Mesh(new THREE.BoxGeometry(PLATEAU.l, PLATEAU.ep, PLATEAU.p), [bois('#2a1a10'), bois('#2a1a10'), new THREE.MeshStandardMaterial({ map: sol, roughness: 1 }), bois('#2a1a10'), bois('#2a1a10'), bois('#2a1a10')]);
    fond.position.set(0, -PLATEAU.ep / 2, PLATEAU.z); fond.receiveShadow = true;
    monde.add(fond);
    const cadre = bois('#5a3a22');
    for (const [l, p, x, z] of [[PLATEAU.l + 0.8, 0.4, 0, PLATEAU.z + PLATEAU.p / 2 + 0.2], [PLATEAU.l + 0.8, 0.4, 0, PLATEAU.z - PLATEAU.p / 2 - 0.2], [0.4, PLATEAU.p, -PLATEAU.l / 2 - 0.2, PLATEAU.z], [0.4, PLATEAU.p, PLATEAU.l / 2 + 0.2, PLATEAU.z]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(l, 0.5, p), cadre);
      b.position.set(x, -0.1, z); b.castShadow = true; b.receiveShadow = true;
      monde.add(b);
    }

    // Les salles et leurs liens, dans le monde.
    const P = new Map(etat.noeuds.map((n) => [n.id, versMonde(n.x, n.y)]));
    const haut = [...P.values()].reduce((a, p) => (p.z < a.z ? p : a));
    reperes = [...P.values(), new THREE.Vector3(0, 1, ENTREE.z + 0.5), new THREE.Vector3(haut.x, 2.2, haut.z), YEUX];
    const segments = [];
    for (const l of liensAvecEntree(etat)) segments.push([l.a === 'entree' ? ENTREE : P.get(l.a), P.get(l.b)]);
    const clairieres = [{ x: ENTREE.x, z: ENTREE.z, r: 0.9 }];
    const loin = (x, z, dSeg, dNoeud) => {
      for (const p of P.values()) if (Math.hypot(p.x - x, p.z - z) < dNoeud) return false;
      for (const c of clairieres) if (Math.hypot(c.x - x, c.z - z) < c.r) return false;
      for (const [a, b] of segments) {
        const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1;
        const u = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / L2));
        if (Math.hypot(a.x + vx * u - x, a.z + vz * u - z) < dSeg) return false;
      }
      return true;
    };

    // Le décor du chapitre d'abord (ses clairières), la forêt ensuite.
    DECORS[th.decor]?.(monde, { R, loin, clairieres, q, th });

    const pts = [];
    const pasF = q === 'haute' ? 0.42 : 0.55;
    const bordX = PLATEAU.l / 2 - 0.4, bordZ = PLATEAU.p / 2 - 0.4;
    for (let z = PLATEAU.z - bordZ; z <= PLATEAU.z + bordZ; z += pasF) for (let x = -bordX; x <= bordX; x += pasF) {
      const px = x + (R() - 0.5) * pasF * 0.9, pz = z + (R() - 0.5) * pasF * 0.9;
      if (Math.abs(px) > bordX || Math.abs(pz - PLATEAU.z) > bordZ) continue;
      if (loin(px, pz, 0.62, 0.85) && R() < 0.92) pts.push([px, pz]);
    }
    const pique = ['neant', 'obsidienne', 'cendre'].includes(th.decor);
    const geoArbre = new THREE.ConeGeometry(pique ? 0.16 : 0.26, 1, pique ? 5 : 7);
    geoArbre.translate(0, 0.5, 0);
    const foret = new THREE.InstancedMesh(geoArbre, new THREE.MeshStandardMaterial({ roughness: th.decor === 'obsidienne' ? 0.3 : 0.85, metalness: th.decor === 'obsidienne' ? 0.4 : 0, flatShading: true }), pts.length);
    const m = new THREE.Matrix4(); const c = new THREE.Color();
    pts.forEach(([x, z], i) => {
      const bord = Math.min(1, Math.hypot(x / 7, (z - PLATEAU.z) / 9));
      const h = (0.55 + R() * 0.9 + bord * 0.5) * (pique ? 1.3 : 1);
      const r = 0.8 + R() * 0.6;
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * (pique ? 0.3 : 0.08), R() * 6, (R() - 0.5) * (pique ? 0.3 : 0.08))), new THREE.Vector3(r, h, r));
      foret.setMatrixAt(i, m);
      foret.setColorAt(i, c.set(th.arbres[(R() * th.arbres.length) | 0]).multiplyScalar(0.8 + R() * 0.35));
    });
    foret.castShadow = q === 'haute'; foret.receiveShadow = true;
    monde.add(foret);

    // Les salles : une pierre ronde, et la pièce qui dit ce qu'on y trouve.
    for (const n of etat.noeuds) {
      const p = P.get(n.id);
      const boss = n.type === 'boss';
      const r = boss ? 0.75 : 0.44;
      const j = new THREE.Group();
      j.position.copy(p);
      const pierre = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.16, 12), new THREE.MeshStandardMaterial({ color: boss ? '#3a1210' : '#4a4036', roughness: 0.9, flatShading: true }));
      pierre.position.y = 0.08; pierre.castShadow = true; pierre.receiveShadow = true;
      const anneau = new THREE.Mesh(new THREE.TorusGeometry(r * 1.14, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0 }));
      anneau.rotation.x = -Math.PI / 2; anneau.position.y = 0.05;
      const support = new THREE.Group(); support.position.y = 0.16;
      j.add(pierre, anneau, support);
      j.userData = { pierre, anneau, support, n, piece: null, cle: '' };
      monde.add(j);
      jetons.set(n.id, j);
      if (boss) {
        const f = figurineMonstre({ modeleId: etat.boss, rang: 'boss', ecole: etat.ecoleBoss });
        f.scale.setScalar(0.62); f.rotation.y = 0;
        support.add(f);
        j.userData.figBoss = f;
        lueurBoss.position.set(p.x, 1.8, p.z + 0.6);
      }
    }

    // Des lucioles, dans la lumière.
    const nL = q === 'haute' ? 70 : 35;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(nL * 3);
    for (let i = 0; i < nL; i++) { pos[i * 3] = (R() - 0.5) * 14; pos[i * 3 + 1] = 0.3 + R() * 2.4; pos[i * 3 + 2] = PLATEAU.z + (R() - 0.5) * 18; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lucioles = new THREE.Points(geo, new THREE.PointsMaterial({ color: th.lumiere, size: 0.08, transparent: true, opacity: 0.8, depthWrite: false }));
    lucioles.userData.base = pos.slice();
    monde.add(lucioles);
  }

  /** Les pas japonais des chemins : dorés là où l'on est passé, clairs là où l'on peut aller. */
  function poserChemins(etat) {
    if (pas) { monde.remove(pas); pas.geometry.dispose(); pas.material.dispose(); }
    const P = new Map(etat.noeuds.map((n) => [n.id, versMonde(n.x, n.y)]));
    const pierres = [];
    for (const l of liensAvecEntree(etat)) {
      const a = l.a === 'entree' ? ENTREE : P.get(l.a), b = P.get(l.b);
      const d = a.distanceTo(b);
      const nb = Math.max(1, Math.floor((d - 0.9) / 0.34));
      for (let k = 1; k <= nb; k++) {
        const u = (0.45 + ((d - 0.9) * k) / (nb + 1)) / d;
        pierres.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, etat: l.fait ? 'fait' : l.ouvert ? 'ouvert' : '' });
      }
    }
    pas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 7), new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true, emissive: '#ffffff', emissiveIntensity: 0 }), pierres.length);
    const m = new THREE.Matrix4(); const c = new THREE.Color();
    const R = alea(7);
    pierres.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x + (R() - 0.5) * 0.05, 0.025, p.z + (R() - 0.5) * 0.05), new THREE.Quaternion(), new THREE.Vector3(1 + R() * 0.3, 1, 1 + R() * 0.3));
      pas.setMatrixAt(i, m);
      pas.setColorAt(i, c.set(p.etat === 'fait' ? '#ffd27a' : p.etat === 'ouvert' ? '#fff0c8' : '#6a6050'));
    });
    pas.receiveShadow = true;
    monde.add(pas);
  }

  function dimensionner() {
    const d = S.cadrer(reperes, new THREE.Vector3(0, 0, -0.8), new THREE.Vector3(0, 13.5, 11.1), { x: 0.94, bas: -0.92, haut: 0.93 }, 10, 40);
    void d;
  }
  S.surDimension(() => { dimensionner(); placer?.(); });

  /** Où se trouve une salle à l'écran (en pixels dans l'hôte). */
  function ecran(id) {
    const j = jetons.get(id);
    if (!j) return null;
    return S.versEcran(new THREE.Vector3(j.position.x, 0.3, j.position.z));
  }
  let placer = null;

  // Les animations : les salles ouvertes battent, le chef marche, les lucioles flottent.
  S.animer((dt, horloge) => {
    for (const [id, j] of jetons) {
      const { anneau, n } = j.userData;
      const ouvert = j.userData.ouvert;
      const pulse = 0.5 + 0.5 * Math.sin(horloge * 4.4);
      anneau.material.opacity = ouvert ? 0.35 + 0.6 * pulse : j.userData.ici ? 0.5 : 0;
      anneau.material.color.set(j.userData.ici ? '#e8c060' : n.type === 'boss' ? '#ff6a5a' : '#ffe9a8');
      const hauteur = ouvert ? 0.06 + 0.06 * pulse : 0;
      j.position.y += (hauteur - j.position.y) * Math.min(1, dt * 10);
      const s = survole === id && ouvert ? 1.18 : 1;
      j.scale.setScalar(j.scale.x + (s - j.scale.x) * Math.min(1, dt * 12));
      if (j.userData.piece) j.userData.piece.rotation.y = Math.sin(horloge * 0.6 + j.position.x) * 0.25;
      if (j.userData.figBoss) j.userData.figBoss.rotation.y = Math.sin(horloge * 0.5) * 0.3;
    }
    if (chef && anim.vers) {
      anim.t = Math.min(1, anim.t + dt / 0.9);
      const u = anim.t * anim.t * (3 - 2 * anim.t);
      const de = anim.depuis || anim.vers;
      chef.position.set(de.x + (anim.vers.x - de.x) * u, 0.16 + (anim.t < 1 ? Math.abs(Math.sin(u * Math.PI * 3)) * 0.2 : 0), de.z + (anim.vers.z - de.z) * u);
      chef.rotation.z = anim.t < 1 ? Math.sin(u * Math.PI * 6) * 0.12 : 0;
      chef.rotation.y = Math.PI + Math.sin(horloge * 1.3) * 0.15;
    }
    if (lucioles) {
      const p = lucioles.geometry.attributes.position; const b = lucioles.userData.base;
      for (let i = 0; i < p.count; i++) { p.array[i * 3] = b[i * 3] + Math.sin(horloge * 0.7 + i) * 0.3; p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(horloge * 1.1 + i * 2) * 0.2; }
      p.needsUpdate = true;
      lucioles.material.opacity = 0.5 + 0.3 * Math.sin(horloge * 3);
    }
    lanterne.intensity = 70 * (0.95 + 0.05 * Math.sin(horloge * 9) * Math.sin(horloge * 5.3));
    if (pas) pas.material.emissiveIntensity = 0.1 + 0.08 * Math.sin(horloge * 4.4);
  });

  return {
    /**
     * etat = { acte, cle, boss, ecoleBoss, chef: { peuple, ecole, role, classe, id },
     * noeuds: [{ id, x, y, type, ouverte, ici, vue, cachee }], liens: [{ a, b, fait, ouvert }],
     * position, visitesPremiere } ; `placerBoutons` repose les boutons sur les pièces.
     */
    maj(etat, placerBoutons) {
      placer = placerBoutons;
      if (etat.cle !== cleMonde || !monde) { cleMonde = etat.cle; construire(etat); }
      S.dimensionner();
      dimensionner();
      // Les pièces : une salle montre ce qu'elle cache quand on la connaît.
      for (const n of etat.noeuds) {
        const j = jetons.get(n.id);
        if (!j) continue;
        const cle = n.type === 'boss' ? 'boss' : n.cachee ? 'porte' : n.type;
        if (j.userData.cle !== cle) {
          if (j.userData.piece) { j.userData.support.remove(j.userData.piece); vider(j.userData.piece); }
          j.userData.piece = cle === 'boss' ? null : pieceCarte(cle === 'porte' ? null : cle);
          if (j.userData.piece) { j.userData.piece.scale.setScalar(1.75); j.userData.support.add(j.userData.piece); }
          j.userData.cle = cle;
        }
        j.userData.ouvert = n.ouverte; j.userData.ici = n.ici;
        j.userData.pierre.material.color.set(n.type === 'boss' ? '#3a1210' : n.vue ? '#7a6038' : n.cachee ? '#3a342c' : '#4a4036');
        if (j.userData.piece) j.userData.piece.visible = !n.ici;
      }
      poserChemins(etat);
      // Le chef du groupe, en figurine.
      const cc = etat.chef ? `${etat.chef.id}|${etat.chef.ecole}` : '';
      if (cc !== cleChef) {
        if (chef) { monde.remove(chef); }
        chef = figurineHeros(etat.chef || { peuple: 'humain', ecole: 'sacre', role: 'dps', classe: '', id: 'chef' });
        chef.scale.setScalar(0.9);
        monde.add(chef);
        cleChef = cc;
        anim.vers = null;
      }
      const ou = etat.position ? jetons.get(etat.position)?.position.clone() : ENTREE.clone();
      if (ou) {
        ou.y = 0;
        if (!anim.vers) { anim.vers = ou; anim.depuis = ou; anim.t = 1; chef.position.set(ou.x, 0.16, ou.z); chef.rotation.y = Math.PI; }
        else if (anim.vers.distanceTo(ou) > 0.01) { anim.depuis = chef.position.clone(); anim.vers = ou; anim.t = 0; }
      }
      S.rendre();
      placer?.();
      S.relancer();
    },
    ecran,
    survol(id) { survole = id; S.relancer(); },
  };
}

/* ------------------------------------------------------------------ */
/* Les décors propres à chaque chapitre                                 */
/* ------------------------------------------------------------------ */

/** Pose `n` objets dans des clairières libres (loin des chemins) ; `poser(x, z, r)` les dessine. */
function semer(n, { R, loin, clairieres }, rMin, rMax, poser) {
  for (let i = 0, essais = 0; i < n && essais < 500; essais++) {
    const x = (R() - 0.5) * 15, z = PLATEAU.z + (R() - 0.5) * 20;
    const r = rMin + R() * (rMax - rMin);
    if (!loin(x, z, r + 0.35, r + 0.5)) continue;
    clairieres.push({ x, z, r: r + 0.15 });
    poser(x, z, r);
    i++;
  }
}

const DECORS = {
  /** Les galeries noyées : des mares sombres qui brillent, des roseaux. */
  eau(monde, a) {
    const eau = new THREE.MeshStandardMaterial({ color: '#0e3a44', roughness: 0.08, metalness: 0.6, emissive: '#06222a', emissiveIntensity: 0.6 });
    semer(a.q === 'haute' ? 14 : 9, a, 0.5, 1.2, (x, z, r) => {
      const mare = new THREE.Mesh(new THREE.CircleGeometry(r, 20), eau);
      mare.rotation.x = -Math.PI / 2; mare.position.set(x, 0.02, z); mare.scale.set(1, 0.7 + a.R() * 0.5, 1);
      monde.add(mare);
      for (let k = 0; k < 7; k++) {
        const an = a.R() * Math.PI * 2, h = 0.4 + a.R() * 0.5;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, h, 4), bois('#8a9a4a'));
        t.position.set(x + Math.cos(an) * r * 0.95, h / 2, z + Math.sin(an) * r * 0.7); t.rotation.z = (a.R() - 0.5) * 0.4;
        monde.add(t);
      }
    });
  },
  /** Le cloître profané : des colonnes brisées, des arches, des pierres tombées. */
  cloitre(monde, a) {
    const pierre = bois('#7a7480');
    semer(9, a, 0.4, 0.7, (x, z, r) => {
      const h = 0.6 + a.R() * 1.2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, h, 8), pierre); col.position.set(x, h / 2, z); col.castShadow = true; monde.add(col);
      const chap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), pierre); chap.position.set(x, h + 0.06, z); chap.rotation.y = a.R(); monde.add(chap);
      if (a.R() < 0.5) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), pierre); b.position.set(x + r * 0.7, 0.1, z); b.rotation.y = a.R() * 3; monde.add(b); }
    });
    semer(3, a, 0.6, 0.8, (x, z) => {
      const arche = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 6, 12, Math.PI), pierre); arche.position.set(x, 0, z); arche.rotation.y = a.R() * 3; arche.castShadow = true; monde.add(arche);
    });
  },
  /** La forge ardente : des coulées de lave, des enclumes, des braises. */
  forge(monde, a) {
    const lave = new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4a0a', emissiveIntensity: 1.6, roughness: 0.6 });
    semer(8, a, 0.4, 0.9, (x, z, r) => {
      const c = new THREE.Mesh(new THREE.CircleGeometry(r, 9), lave); c.rotation.x = -Math.PI / 2; c.position.set(x, 0.02, z); c.scale.set(1, 0.6, 1); monde.add(c);
      if (a.q === 'haute' && a.R() < 0.5) { const l = new THREE.PointLight('#ff6a1a', 4, 3, 1.6); l.position.set(x, 0.6, z); monde.add(l); }
    });
    semer(4, a, 0.35, 0.45, (x, z) => {
      const enclume = new THREE.Group();
      enclume.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.16), bois('#3a3a40', { metal: 0.6 })));
      const dessus = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.2), bois('#4a4a52', { metal: 0.6 })); dessus.position.y = 0.17; enclume.add(dessus);
      enclume.position.set(x, 0.12, z); enclume.rotation.y = a.R() * 3;
      enclume.traverse((o) => { o.castShadow = true; }); monde.add(enclume);
    });
  },
  /** Le sanctuaire gelé : des cristaux de glace qui luisent, de la neige au pied des arbres. */
  glace(monde, a) {
    const cristal = new THREE.MeshStandardMaterial({ color: '#aee6ff', emissive: '#5ec0ff', emissiveIntensity: 0.5, roughness: 0.15, transparent: true, opacity: 0.85, flatShading: true });
    semer(12, a, 0.3, 0.7, (x, z, r) => {
      for (let k = 0; k < 3; k++) { const h = 0.4 + a.R() * 0.9; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), cristal); c.scale.set(0.6, h * 2, 0.6); c.position.set(x + (a.R() - 0.5) * r, h * 0.8, z + (a.R() - 0.5) * r); c.rotation.set((a.R() - 0.5) * 0.5, a.R() * 3, (a.R() - 0.5) * 0.5); c.castShadow = true; monde.add(c); }
    });
  },
  /** Le pic cendré : des roches volcaniques, des braises qui rougeoient dans la cendre. */
  cendre(monde, a) {
    semer(12, a, 0.3, 0.6, (x, z, r) => {
      const roc = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), bois('#2a2422')); roc.position.set(x, r * 0.5, z); roc.scale.y = 0.7; roc.rotation.set(a.R(), a.R(), a.R()); roc.castShadow = true; monde.add(roc);
      const braise = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff7a2a' })); braise.position.set(x + r * 0.6, 0.05, z); monde.add(braise);
    });
  },
  /** Les racines du monde : des racines géantes, des champignons. */
  racines(monde, a) {
    const ecorce = bois('#4a3018');
    semer(6, a, 0.6, 1, (x, z) => {
      const tronc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.6, 8), ecorce); tronc.position.set(x, 1.3, z); tronc.castShadow = true; monde.add(tronc);
      for (let k = 0; k < 4; k++) { const an = (k / 4) * Math.PI * 2 + a.R(); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 0.9, 5), ecorce); r.position.set(x + Math.cos(an) * 0.45, 0.15, z + Math.sin(an) * 0.45); r.rotation.set(Math.sin(an) * 1.2, 0, -Math.cos(an) * 1.2); monde.add(r); }
      const houppe = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), bois('#3a7a2a')); houppe.position.set(x, 2.9, z); houppe.castShadow = true; monde.add(houppe);
    });
    semer(10, a, 0.15, 0.25, (x, z) => {
      const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5), bois('#e8dcc0')); pied.position.set(x, 0.08, z); monde.add(pied);
      const chapeau = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), bois(a.R() < 0.5 ? '#c83a3a' : '#e8a040')); chapeau.position.set(x, 0.15, z); monde.add(chapeau);
    });
  },
  /** La nécropole engloutie : des tombes de travers, une crypte, des feux follets verts. */
  tombes(monde, a) {
    const pierre = bois('#6a7070');
    semer(14, a, 0.25, 0.4, (x, z) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.08), pierre); t.position.set(x, 0.2, z); t.rotation.set((a.R() - 0.5) * 0.3, a.R() * 0.6 - 0.3, (a.R() - 0.5) * 0.3); t.castShadow = true; monde.add(t);
      if (a.R() < 0.4) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#7affb8' })); f.position.set(x, 0.7, z); monde.add(f); }
    });
  },
  /** La citadelle inversée : des tours de pierre, et d'autres qui pendent la tête en bas. */
  tours(monde, a) {
    const pierre = bois('#8a8070');
    semer(6, a, 0.4, 0.6, (x, z) => {
      const h = 1.2 + a.R() * 1.2;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 8), pierre); t.position.set(x, h / 2, z); t.castShadow = true; monde.add(t);
      const toit = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.5, 8), bois('#5a3a2a')); toit.position.set(x, h + 0.25, z); monde.add(toit);
      const inv = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 8), pierre); inv.position.set(x + 0.2, 4 + a.R(), z); monde.add(inv);
      const pointeInv = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 8), bois('#5a3a2a')); pointeInv.position.set(x + 0.2, 3.35 + a.R() * 0.01, z); pointeInv.rotation.x = Math.PI; monde.add(pointeInv);
    });
  },
  /** Le seuil du néant : des éclats qui flottent et luisent au-dessus du sol. */
  neant(monde, a) {
    const eclat = new THREE.MeshStandardMaterial({ color: '#8a7aff', emissive: '#6a4aff', emissiveIntensity: 0.9, roughness: 0.2, flatShading: true });
    semer(16, a, 0.2, 0.5, (x, z, r) => {
      const e = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.6, 0), eclat); e.position.set(x, 0.6 + a.R() * 1.8, z); e.scale.y = 1.8; e.rotation.set(a.R() * 3, a.R() * 3, 0); monde.add(e);
    });
  },
  /** Le trône sans aube : des pics d'obsidienne, des fissures de braise. */
  obsidienne(monde, a) {
    const obs = new THREE.MeshStandardMaterial({ color: '#120c10', roughness: 0.2, metalness: 0.5, flatShading: true });
    semer(10, a, 0.3, 0.6, (x, z, r) => {
      for (let k = 0; k < 3; k++) { const h = 0.8 + a.R() * 1.4; const p = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 5), obs); p.position.set(x + (a.R() - 0.5) * r, h / 2, z + (a.R() - 0.5) * r); p.rotation.z = (a.R() - 0.5) * 0.4; p.castShadow = true; monde.add(p); }
      const f = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, 0.01, 0.05), new THREE.MeshBasicMaterial({ color: '#ff5a2a' })); f.position.set(x, 0.02, z + r * 0.4); f.rotation.y = a.R() * 3; monde.add(f);
    });
  },
};
