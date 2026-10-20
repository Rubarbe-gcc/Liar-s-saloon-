/**
 * PLEIN STADE — la fête en 3D, commune à tous les sports : le trophée (fait par
 * le code : une coupe dorée tournée sur un socle, deux anses) et les feux
 * d'artifice (des gerbes de points colorés qui retombent).
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';
import { creerJoueur, poser } from './joueurs3d.js';

/** Le trophée : environ 60 cm de haut, le pied au point d'origine. */
export function creerTrophee() {
  const g = new THREE.Group();
  const or = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.85, roughness: 0.28, emissive: '#3a2600', emissiveIntensity: 0.35 });
  const socle = new THREE.MeshStandardMaterial({ color: '#1d1f24', metalness: 0.3, roughness: 0.6 });
  // Le profil de la coupe, tourné autour de l'axe.
  const profil = [[0, 0], [0.11, 0], [0.11, 0.05], [0.05, 0.08], [0.035, 0.2], [0.05, 0.26], [0.16, 0.33], [0.2, 0.45], [0.21, 0.56], [0.19, 0.57], [0.17, 0.46], [0.13, 0.36], [0, 0.34]].map(([x, y]) => new THREE.Vector2(x, y));
  const coupe = new THREE.Mesh(new THREE.LatheGeometry(profil, 24), or);
  coupe.position.y = 0.12;
  g.add(coupe);
  for (const s of [-1, 1]) {
    const anse = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 16, Math.PI * 1.3), or);
    anse.position.set(s * 0.21, 0.6, 0);
    anse.rotation.z = s > 0 ? -Math.PI * 0.6 : Math.PI * 1.6;
    g.add(anse);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.12, 16), socle);
  base.position.y = 0.06;
  g.add(base);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Les feux d'artifice : `lancer(x, y, z, couleurs)` fait une gerbe ; `maj(dt)` les anime. */
export function creerFeux(scene, n = 900) {
  const pos = new Float32Array(n * 3), vit = new Float32Array(n * 3), col = new Float32Array(n * 3), vie = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pts.frustumCulled = false;
  scene.add(pts);
  let prochain = 0;
  const c = new THREE.Color();
  return {
    lancer(x, y, z, couleurs = ['#ffd23f', '#ff4d6d', '#4fd2ff', '#c6ff3a']) {
      const nb = 110;
      c.set(couleurs[Math.floor(Math.random() * couleurs.length)]);
      for (let k = 0; k < nb; k++) {
        const i = (prochain + k) % n;
        // Une direction au hasard sur une sphère, une vitesse un peu différente pour chaque étincelle.
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        const v = 7 + Math.random() * 3;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        vit[i * 3] = r * Math.cos(a) * v; vit[i * 3 + 1] = u * v; vit[i * 3 + 2] = r * Math.sin(a) * v;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        vie[i] = 1.4 + Math.random() * 0.6;
      }
      prochain = (prochain + nb) % n;
      geo.attributes.color.needsUpdate = true;
    },
    maj(dt) {
      let vivant = false;
      for (let i = 0; i < n; i++) {
        if (vie[i] <= 0) { pos[i * 3 + 1] = -100; continue; }
        vivant = true;
        vie[i] -= dt;
        vit[i * 3 + 1] -= 5 * dt;
        for (let k = 0; k < 3; k++) { vit[i * 3 + k] *= Math.pow(0.35, dt); pos[i * 3 + k] += vit[i * 3 + k] * dt; }
        // Elles s'éteignent en rougissant un peu.
        const f = Math.max(0, Math.min(1, vie[i]));
        col[i * 3 + 1] *= 0.995; col[i * 3 + 2] *= 0.99;
        if (f < 0.3) { col[i * 3] *= 0.95; col[i * 3 + 1] *= 0.95; col[i * 3 + 2] *= 0.95; }
      }
      pts.visible = vivant;
      geo.attributes.position.needsUpdate = true;
      if (vivant) geo.attributes.color.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Le trophée « Homme du match »                                       */
/* ------------------------------------------------------------------ */

/** Une étoile à `n` branches, en forme plate (pour l'extruder). */
function formeEtoile(n, rayonExt, rayonInt) {
  const f = new THREE.Shape();
  for (let k = 0; k < n * 2; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / n, r = k % 2 ? rayonInt : rayonExt;
    if (k === 0) f.moveTo(Math.cos(a) * r, Math.sin(a) * r); else f.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  f.closePath();
  return f;
}

/** Une petite plaque gravée (texte blanc sur fond sombre), pour le socle des trophées. */
export function plaqueTexte(texte, largeur = 0.15, hauteur = 0.04) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(256 * hauteur / largeur);
  const g = c.getContext('2d');
  g.fillStyle = '#c9d1db'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#14213d';
  g.font = `900 ${Math.round(c.height * 0.58)}px "Arial Black", Impact, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texte, c.width / 2, c.height / 2 + 2, c.width - 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(largeur, hauteur), new THREE.MeshBasicMaterial({ map: t }));
}

/**
 * Le petit trophée « Homme du match » : une étoile dorée sur une tige, un socle sombre
 * avec sa plaque gravée. Environ 34 cm de haut, le pied au point d'origine, la plaque vers +z.
 * (Le joueur le tient à deux mains : voir la humeur « exhibe » de joueurs3d.js.)
 */
export function creerTropheeHommeDuMatch() {
  const g = new THREE.Group();
  const or = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.85, roughness: 0.25, emissive: '#3a2600', emissiveIntensity: 0.4 });
  const socle = new THREE.MeshStandardMaterial({ color: '#1d1f24', metalness: 0.3, roughness: 0.55 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 20), socle);
  base.position.y = 0.025;
  const bague = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 20), or);
  bague.position.y = 0.065;
  const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.12, 12), or);
  tige.position.y = 0.14;
  const geoEtoile = new THREE.ExtrudeGeometry(formeEtoile(5, 0.1, 0.045), { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
  geoEtoile.translate(0, 0, -0.0175);
  const etoile = new THREE.Mesh(geoEtoile, or);
  etoile.position.y = 0.27;
  const plaque = plaqueTexte('HOMME DU MATCH', 0.11, 0.028);
  plaque.position.set(0, 0.027, 0.0855);
  plaque.rotation.x = -0.1;
  g.add(base, bague, tige, etoile, plaque);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* ------------------------------------------------------------------ */
/* La presse : journalistes, micros, appareils photo et flashs         */
/* ------------------------------------------------------------------ */

const MANTEAUX = ['#2b3a55', '#4a2f3a', '#33493a', '#5a4a2a', '#3a3a4a', '#6a3a2a'];
const mat = (couleur, o = {}) => new THREE.MeshLambertMaterial({ color: couleur, flatShading: true, ...o });

/**
 * Des journalistes autour d'un point : deux photographes à genoux, devant, appareil au visage
 * (un flash de temps en temps), et des reporters qui tendent leur micro. Tous regardent le centre.
 * Le visuel seulement : le hasard des flashs n'a aucun effet sur le jeu.
 *
 * `montrer({ x, y, rayon, regard, reporters })` les place (coordonnées du jeu) ; `maj(dt)` les anime ; `cacher()`.
 * regard : l'angle (rad, dans le plan du jeu) du centre vers la caméra — les reporters se tiennent sur
 * les côtés, les photographes du côté de la caméra.
 */
export function creerPresse(scene) {
  const groupe = new THREE.Group();
  groupe.visible = false;
  scene.add(groupe);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g2 = c.getContext('2d');
  const deg = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  deg.addColorStop(0, 'rgba(255,255,255,1)'); deg.addColorStop(0.25, 'rgba(255,255,240,.85)'); deg.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = deg; g2.fillRect(0, 0, 64, 64);
  const texFlash = new THREE.CanvasTexture(c);
  const lumiere = new THREE.PointLight('#fff6e0', 0, 9, 1.6);
  groupe.add(lumiere);
  const noir = mat('#15171c'), gris = mat('#8a909c'), verre = mat('#2a4a6a');
  let membres = [], t = 0, eclat = 0;

  function reporter(k) {
    const fig = creerJoueur({ kit: { fond: MANTEAUX[k % MANTEAUX.length], motif: 'uni', motifC: '#ffffff', short: '#1d1f24', bas: '#1d1f24', num: '#ffffff' }, numero: '', nom: `R${k} PRESSE` });
    // Le micro : un manche et une mousse, au bout du bras qui se tend.
    const micro = new THREE.Group();
    const manche = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), noir);
    manche.position.y = -0.37;
    const mousse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), gris);
    mousse.position.y = -0.47;
    micro.add(manche, mousse);
    fig.A.coude.add(micro);
    return { fig, role: 'reporter', k };
  }

  function photographe(k) {
    const fig = creerJoueur({ kit: { fond: MANTEAUX[(k + 3) % MANTEAUX.length], motif: 'uni', motifC: '#ffffff', short: '#1d1f24', bas: '#1d1f24', num: '#ffffff' }, numero: '', nom: `P${k} PRESSE` });
    // L'appareil devant le visage : le boîtier, l'objectif, le flash au-dessus.
    const app = new THREE.Group();
    const boitier = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.1), noir);
    const objectif = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.14, 12), noir);
    objectif.rotation.x = Math.PI / 2; objectif.position.z = 0.12;
    const lentille = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), verre);
    lentille.position.z = 0.192;
    const unite = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.05), gris);
    unite.position.set(0, 0.095, 0);
    app.add(boitier, objectif, lentille, unite);
    app.position.set(0, 0.8, 0.3);
    fig.torse.add(app);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFlash, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    flash.position.set(0, 0.9, 0.4);
    fig.torse.add(flash);
    return { fig, role: 'photographe', k, flash, prochain: 0.2 + Math.random() * 0.8, eclair: 0 };
  }

  function construire(nbReporters) {
    for (const m of membres) groupe.remove(m.fig.racine);
    membres = [photographe(0), photographe(1)];
    for (let k = 0; k < nbReporters; k++) membres.push(reporter(k));
    for (const m of membres) { m.fig.racine.scale.setScalar(1.1); groupe.add(m.fig.racine); }
  }

  return {
    montrer({ x = 0, y = 0, rayon = 2.4, regard = -Math.PI / 2, reporters = 6 } = {}) {
      if (membres.length !== reporters + 2) construire(reporters);
      const place = (m, angle, r) => {
        const a = regard + angle;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        m.fig.racine.position.set(px, 0, -py);
        m.fig.racine.rotation.y = Math.atan2(x - px, -(y - py));
      };
      // Les photographes du côté de la caméra, un de chaque côté de l'axe.
      place(membres[0], -0.36, rayon * 1.25);
      place(membres[1], 0.36, rayon * 1.25);
      // Les reporters en demi-cercle sur les côtés, jamais devant l'objectif.
      membres.slice(2).forEach((m, k) => {
        const cote = k % 2 ? 1 : -1, rang = Math.floor(k / 2);
        place(m, cote * (0.95 + rang * 0.5), rayon * (0.95 + (rang % 2) * 0.12));
      });
      groupe.visible = true;
    },
    cacher() { groupe.visible = false; lumiere.intensity = 0; },
    maj(dt) {
      if (!groupe.visible) return;
      t += dt;
      eclat *= Math.pow(0.0006, dt);
      for (const m of membres) {
        const P = { ...m.fig.actuel };
        const bal = Math.sin(t * 1.6 + m.k * 1.7);
        if (m.role === 'photographe') {
          // À genoux, l'appareil au visage, la tête qui suit un peu.
          Object.assign(P, { by: 0.55, hancheA: -1.1, hancheB: -0.2, genouA: 1.7, genouB: 1.9, torse: 0.1, tete: -0.05 + bal * 0.03, epAx: -1.4, epBx: -1.4, epAz: -0.2, epBz: 0.2, coudeA: -1.35, coudeB: -1.35, y: 0 });
          m.prochain -= dt;
          if (m.prochain <= 0) { m.eclair = 1; m.prochain = 0.35 + Math.random() * 1.3; eclat = Math.max(eclat, 1); lumiere.position.copy(m.fig.racine.position).add(new THREE.Vector3(0, 1.1, 0)); }
          m.eclair = Math.max(0, m.eclair - dt * 7);
          m.flash.material.opacity = m.eclair; m.flash.scale.setScalar(0.5 + m.eclair * 1.1);
        } else {
          // Le micro tendu vers le centre, l'autre bras serré contre soi, un léger balancement.
          Object.assign(P, { epAx: -1.35 + bal * 0.05, epAz: -0.18, coudeA: -0.55, epBx: -0.4, epBz: -0.15, coudeB: -1.5, torse: 0.08, tete: 0.02 + bal * 0.04, y: 0 });
        }
        poser(m.fig, P, Math.min(1, dt * 14));
      }
      lumiere.intensity = 14 * eclat;
    },
  };
}
