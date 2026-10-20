/**
 * CROCHET — la salle et le ring en 3D : le plateau surélevé, ses quatre poteaux
 * (un coin rouge, un coin bleu, deux coins neutres), les trois rangs de cordes
 * qui ploient quand un boxeur s'y appuie, le tapis au nom de l'arcade, les
 * gradins tout autour dans la pénombre et le public qui saute (les outils de
 * la salle du basket : basket/js/trois/salle3d.js).
 *
 * Repère : moteur (x, y) → 3D (x, HAUT, -y) ; HAUT : la hauteur du tapis.
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { foule, gradins, couleursPublic, texCanvas, cubeSuspendu, lambert, basique, boite } from '../../../basket/js/trois/salle3d.js';

/** La hauteur du tapis, le demi-côté du ring (entre les cordes), la place des poteaux. */
export const HAUT = 1.05;
const RING = 3.2, POTEAU = 3.45;
const CORDES = [0.48, 0.88, 1.28];

/** Le tapis : une toile claire, le logo au centre, les coins teintés. */
function tapis(scene, couleurs) {
  const t = texCanvas(1024, 1024, (g, w, h) => {
    g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, w, h);
    // Un grain de toile.
    for (let k = 0; k < 6000; k++) { g.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 3;
    g.strokeRect(40, 40, w - 80, h - 80);
    // Le logo.
    g.save(); g.translate(w / 2, h / 2);
    g.fillStyle = 'rgba(200,60,40,.85)';
    g.beginPath(); g.arc(0, 0, 190, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e9e4d8'; g.font = '900 92px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('CROCHET', 0, -10);
    g.font = '700 30px Arial, sans-serif'; g.fillText('PLEIN STADE', 0, 70);
    g.restore();
    // Les coins des deux boxeurs.
    for (const [cx, cy, c] of [[60, h - 60, couleurs[0]], [w - 60, 60, couleurs[1]]]) {
      g.fillStyle = c; g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (cx < w / 2 ? 160 : -160), cy); g.lineTo(cx, cy + (cy < h / 2 ? 160 : -160)); g.fill();
      g.globalAlpha = 1;
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * POTEAU + 0.4, 2 * POTEAU + 0.4), new THREE.MeshLambertMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = HAUT + 0.005;
  m.receiveShadow = true;
  scene.add(m);
}

/** Les cordes : chaque côté, trois rangs ; on garde leurs points pour les faire ployer. */
function cordes(scene, couleur) {
  const mat = new THREE.MeshLambertMaterial({ color: couleur });
  const cotes = [];
  // Les quatre côtés : de poteau à poteau.
  const coins = [[-POTEAU, -POTEAU], [POTEAU, -POTEAU], [POTEAU, POTEAU], [-POTEAU, POTEAU]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = coins[k], [bx, bz] = coins[(k + 1) % 4];
    for (const h of CORDES) {
      const n = 12;
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(ax + ((bx - ax) * i) / n, HAUT + h, az + ((bz - az) * i) / n));
      const courbe = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(courbe, 24, 0.03, 6, false);
      const tube = new THREE.Mesh(geo, mat);
      scene.add(tube);
      cotes.push({ tube, pts, courbe, ax, az, bx, bz, h, ploie: 0, ou: 0.5 });
    }
  }
  return cotes;
}

/**
 * La salle de boxe.
 * @param {THREE.Scene} scene
 * @param {{ qualite: string, couleurs: [string, string] }} o  couleurs : les gants des deux boxeurs (le public, les coins)
 */
export function creerRing(scene, { qualite, couleurs }) {
  scene.background = new THREE.Color('#06070b');
  scene.fog = new THREE.Fog('#06070b', 30, 80);
  const hemi = new THREE.HemisphereLight('#c8ccff', '#22180f', 0.75);
  scene.add(hemi);
  // Le projecteur au-dessus du ring : un cône de lumière chaude.
  const spot = new THREE.SpotLight('#fff3dc', 260, 30, 0.62, 0.45, 1.6);
  spot.position.set(0, 13, 0);
  spot.target.position.set(0, HAUT, 0);
  scene.add(spot, spot.target);
  if (qualite === 'haute') {
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005;
  }
  const lampe = new THREE.DirectionalLight('#ffffff', 0.7);
  lampe.position.set(-6, 14, 9);
  scene.add(lampe);
  // Le sol de la salle, sombre.
  scene.add(boite(70, 0.1, 70, lambert('#101116'), 0, -0.05, 0));
  // Le plateau, sa jupe, les marches.
  const jupe = boite(2 * POTEAU + 0.6, HAUT, 2 * POTEAU + 0.6, lambert('#191a22'), 0, HAUT / 2, 0);
  jupe.receiveShadow = true;
  scene.add(jupe);
  const liseré = basique('#c8442c');
  for (const [sx, sz, x, z] of [[2 * POTEAU + 0.62, 0.12, 0, POTEAU + 0.31], [2 * POTEAU + 0.62, 0.12, 0, -POTEAU - 0.31], [0.12, 2 * POTEAU + 0.62, POTEAU + 0.31, 0], [0.12, 2 * POTEAU + 0.62, -POTEAU - 0.31, 0]]) scene.add(boite(sx, 0.08, sz, liseré, x, HAUT - 0.06, z));
  for (let k = 0; k < 3; k++) scene.add(boite(1.1, 0.33 * (k + 1), 0.4, lambert('#2a2c36'), POTEAU - 0.6, 0.165 * (k + 1), POTEAU + 0.5 + (2 - k) * 0.4));
  tapis(scene, couleurs);
  // Les poteaux et leurs protections : coin rouge (le boxeur 0), coin bleu (le boxeur 1), deux coins blancs.
  const coinsCouleurs = { '-1,1': '#c8302c', '1,-1': '#2c5ac8', '1,1': '#f2f2f2', '-1,-1': '#f2f2f2' };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    scene.add(boite(0.14, 1.65, 0.14, lambert('#c9ccd2'), sx * POTEAU, HAUT + 0.82, sz * POTEAU));
    scene.add(boite(0.26, 1.0, 0.26, lambert(coinsCouleurs[`${sx},${-sz}`]), sx * POTEAU, HAUT + 0.88, sz * POTEAU));
  }
  const out = { cordes: cordes(scene, '#f2f2f2') };
  // Les gradins tout autour, la foule.
  const beton = lambert('#1d1f27');
  const places = [
    ...gradins(scene, beton, { x0: -13, x1: 13, z0: -7.5, sens: -1, rangs: 12, base: 0.4, hauteur: 0.48 }),
    ...gradins(scene, beton, { x0: -13, x1: 13, z0: 8, sens: 1, rangs: 8, base: 0.4, hauteur: 0.48 }),
    ...gradins(scene, beton, { x0: -7, x1: 7, z0: 8.2, sens: 1, rangs: 10, axe: 'z', base: 0.4, hauteur: 0.48 }),
    ...gradins(scene, beton, { x0: -7, x1: 7, z0: -8.2, sens: -1, rangs: 10, axe: 'z', base: 0.4, hauteur: 0.48 }),
  ];
  const kits = couleurs.map((c) => ({ fond: c, motifC: '#ffffff', short: c }));
  out.foule = foule(scene, places, couleursPublic(kits), qualite);
  // Les tables des juges, au pied du ring.
  for (const x of [-2.5, 0, 2.5]) scene.add(boite(1.6, 0.8, 0.6, lambert('#222533'), x, 0.4, -POTEAU - 1.3));
  out.ecran = cubeSuspendu(scene);
  let t = 0;
  out.maj = (dt, excitation, boxeurs) => {
    t += dt;
    out.foule.uTemps.value = t; out.foule.uAmp.value = 0.03 + excitation * 0.3;
    // Les cordes ploient sous le dos d'un boxeur qui s'y appuie.
    for (const c of out.cordes) {
      let cible = 0, ou = c.ou;
      for (const p of boxeurs || []) {
        const px = p.x, pz = -p.y;
        const ux = c.bx - c.ax, uz = c.bz - c.az, l2 = ux * ux + uz * uz;
        const u = Math.max(0, Math.min(1, ((px - c.ax) * ux + (pz - c.az) * uz) / l2));
        const qx = c.ax + ux * u, qz = c.az + uz * u;
        const d = Math.hypot(px - qx, pz - qz);
        if (d < 0.55) { cible = Math.max(cible, (0.55 - d) * 0.5); ou = u; }
      }
      c.ploie += (cible - c.ploie) * Math.min(1, dt * 8);
      c.ou += (ou - c.ou) * Math.min(1, dt * 8);
      if (Math.abs(c.ploie) < 0.002 && !c.vu) continue;
      c.vu = Math.abs(c.ploie) >= 0.002;
      // Vers l'extérieur du ring.
      const nx = Math.sign(c.ax + c.bx) || 0, nz = Math.sign(c.az + c.bz) || 0;
      c.pts.forEach((p, i) => {
        const u = i / (c.pts.length - 1);
        const k = Math.max(0, 1 - Math.abs(u - c.ou) * 2.2) * c.ploie;
        p.x = c.ax + (c.bx - c.ax) * u + nx * k;
        p.z = c.az + (c.bz - c.az) * u + nz * k;
      });
      c.tube.geometry.dispose();
      c.tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(c.pts), 24, 0.03, 6, false);
    }
  };
  return out;
}
