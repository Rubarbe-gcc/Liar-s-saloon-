/**
 * CROCHET — le combat en 3D.
 *
 * Ce module ne joue pas : il montre une « vue » du combat (où sont les deux
 * boxeurs, ce qu'ils font), venue du moteur (shared/boxe/combat.js). Les
 * boxeurs partent du joueur commun (commun/trois/joueurs3d.js) : torse nu, le
 * short et les gants à leurs couleurs. Leurs poses de boxe (la garde, le jab,
 * le crochet, l'uppercut, l'esquive, la tête qui part sous un coup, le tapis)
 * et la caméra de télévision, de côté, qui suit les deux boxeurs.
 *
 * Repère : moteur (x, y) → 3D (x, HAUT, -y).
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { creerJoueur, poseDe, poser } from '../../../commun/trois/joueurs3d.js';
import { creerRing, HAUT } from './ring3d.js';
import { creerFeux, creerPresse } from '../../../commun/trois/fete3d.js';
import { COUPS } from '../../../../../shared/boxe/terrain.js';

export { THREE, HAUT };

const CLE_QUALITE = 'crochet.qualite';
export function qualite() {
  try { const q = localStorage.getItem(CLE_QUALITE); if (q) return q; } catch { /* ignore */ }
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'moyenne' : 'haute';
}
export function reglerQualite(q) { try { localStorage.setItem(CLE_QUALITE, q); } catch { /* ignore */ } }

/** Un boxeur : le joueur commun, torse nu, le short et les gants à ses couleurs. */
function creerBoxeur(b) {
  const kit = { fond: '#000000', motif: 'uni', motifC: '#000000', short: b.couleurs.short, bas: '#f4f4f4', num: '#ffffff' };
  const f = creerJoueur({ kit, numero: '', nom: b.nom });
  const peau = f.tete.children[0].material;
  f.torse.children[0].material = peau;
  const gant = new THREE.MeshLambertMaterial({ color: b.couleurs.gants, flatShading: true });
  for (const bras of [f.A, f.B]) {
    bras.ep.children[0].material = peau;
    bras.coude.children[0].material = peau;
    const main = bras.coude.children[1];
    main.material = gant;
    main.scale.set(1.9, 1.5, 1.8);
    main.position.y = 0.11;
  }
  // La ceinture du short, au liseré.
  const ceinture = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.06, 0.3), new THREE.MeshLambertMaterial({ color: b.couleurs.liseré, flatShading: true }));
  ceinture.position.y = 0.07;
  f.bassin.add(ceinture);
  f.racine.scale.setScalar(1.08 * b.taille);
  return f;
}

/** La ceinture du champion : une large bande de cuir, la grande plaque d'or au centre, deux petites de chaque côté. */
function creerCeinture() {
  const g = new THREE.Group();
  const cuir = new THREE.MeshLambertMaterial({ color: '#1a1416' });
  const or = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.85, roughness: 0.25, emissive: '#3a2a00' });
  const bande = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.03), cuir);
  g.add(bande);
  const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 24), or);
  plaque.rotation.x = Math.PI / 2;
  plaque.position.z = 0.02;
  g.add(plaque);
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 6), new THREE.MeshStandardMaterial({ color: '#c8302c', metalness: 0.4, roughness: 0.4 }));
  centre.rotation.x = Math.PI / 2;
  centre.position.z = 0.03;
  g.add(centre);
  for (const s of [-1, 1]) for (const k of [1, 2]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.025), or);
    p.position.set(s * (0.13 + k * 0.14), 0, 0.02);
    g.add(p);
  }
  return g;
}

const doux = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

/**
 * La pose de boxe d'un boxeur, d'après la vue. p : { etat, coup, phase (0 à 1 dans le coup), garde, esquive, sonne, etourdi, sol, … }.
 * Rend la pose et un supplément de rotation du corps (le crochet tourne les épaules).
 */
function poseBoxe(f, p, o, dt) {
  const P = poseDe(f, { ...o, p: { etat: p.sol ? 'sol' : 'normal', frappe: 0, geste: 0, gesteType: 0, volee: 0 }, gardien: false, cote: 0, tab: false, charge: 0 }, dt);
  let tourne = 0;
  if (p.sol || o.humeur) return { P, tourne };
  // La garde de base : les poings près du menton, les genoux un peu fléchis.
  Object.assign(P, { epAx: -1.25, epBx: -1.25, epAz: 0.32, epBz: -0.32, coudeA: -2.1, coudeB: -2.1, torse: P.torse + 0.12, by: 0.88 });
  P.hancheA -= 0.12; P.hancheB -= 0.12; P.genouA += 0.25; P.genouB += 0.25;
  if (p.garde === 'haute') Object.assign(P, { epAx: -1.65, epBx: -1.65, epAz: 0.12, epBz: -0.12, coudeA: -2.45, coudeB: -2.45, tete: 0.2, torse: P.torse + 0.06 });
  if (p.garde === 'basse') Object.assign(P, { epAx: -0.75, epBx: -0.75, epAz: 0.2, epBz: -0.2, coudeA: -1.75, coudeB: -1.75, torse: P.torse + 0.28 });
  if (p.coup) {
    const C = COUPS[p.coup];
    const total = C.armer + C.frapper + C.retour;
    const t = p.coupT ?? p.phase * total;
    // u : de 0 (armé) à 1 (bras tendu), puis retour.
    const u = t < C.armer ? doux(t / C.armer) * 0.25 : t < C.armer + C.frapper ? 1 : 1 - doux((t - C.armer - C.frapper) / C.retour);
    const corps = p.corps ? 0.45 : 0;
    if (p.coup === 'jab') {
      // Le bras avant (gauche) part droit devant.
      P.epAx = -1.25 - 0.4 * u + corps; P.coudeA = -2.1 + 2.0 * u; P.epAz = 0.32 - 0.25 * u;
      P.torse += 0.05 * u;
    } else if (p.coup === 'crochet') {
      // Le bras arrière (droit) part en arc, coude plié ; les épaules tournent.
      P.epBx = -1.25 - 0.3 * u + corps; P.epBz = -0.32 - 1.05 * u; P.coudeB = -2.1 + 0.7 * u;
      tourne = -0.5 * u;
      P.torseZ = 0.12 * u;
    } else {
      // L'uppercut : le poing remonte de la ceinture vers le menton adverse.
      const a = t < C.armer ? doux(t / C.armer) : 0;
      P.epBx = -0.6 * a - (-2.6 + corps * 1.4) * -u - 0.5; P.coudeB = -1.9 + 0.5 * u; P.epBz = -0.2;
      P.torse += 0.25 * a - 0.15 * u; P.by = 0.84 + 0.08 * u;
      tourne = -0.25 * u;
    }
  }
  if (p.esquive > 0) {
    // L'esquive : le buste plonge sur le côté (ou en arrière).
    const v = Math.sin(Math.min(1, p.esquive) * Math.PI);
    P.torseZ = (p.esqCote || 1) * 0.45 * v; P.by = 0.88 - 0.12 * v; P.torse += p.esqCote ? 0.1 : -0.25 * v;
  }
  if (p.sonne > 0) {
    // Touché : la tête part en arrière, le buste suit.
    const v = Math.min(1, p.sonne);
    P.tete = -0.45 * v; P.torse -= 0.22 * v; P.rx = -0.08 * v;
  }
  if (p.etourdi) { P.torseZ += Math.sin(o.t * 3.5) * 0.14; P.genouA += 0.3; P.genouB += 0.15; P.epAx = -0.8; P.epBx = -0.7; }
  return { P, tourne };
}

/**
 * Crée la scène dans `hote`.
 * @param {HTMLElement} hote
 * @param {{ boxeurs: [object, object], qualite?: string }} o
 */
export function creerRendu(hote, o) {
  const q = o.qualite || qualite();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: q !== 'basse', powerPreference: 'high-performance' }); } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'haute' ? 2 : q === 'moyenne' ? 1.5 : 1) * (q === 'basse' ? 0.75 : 1));
  renderer.shadowMap.enabled = q === 'haute';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'scene3d';
  hote.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.3, 300);
  const ring = creerRing(scene, { qualite: q, couleurs: o.boxeurs.map((b) => b.couleurs.gants) });
  const figs = o.boxeurs.map((b) => { const f = creerBoxeur(b); scene.add(f.racine); return f; });
  if (q !== 'haute') for (const f of figs) f.racine.traverse((x) => { x.castShadow = false; });
  // La sueur qui gicle sous un gros coup.
  const gouttes = [];
  const texGoutte = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const gicler = (x, y, z, n) => {
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGoutte, color: '#dff3ff', transparent: true, opacity: 0.85, depthWrite: false }));
      s.position.set(x, y, z); s.scale.setScalar(0.07);
      s.v = new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 2, (Math.random() - 0.5) * 2.4);
      s.vie = 0.5 + Math.random() * 0.3;
      scene.add(s); gouttes.push(s);
    }
  };
  // Les flashs des photographes, au bord du ring, sur les gros coups.
  const flashs = [];
  for (let k = 0; k < 6; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGoutte, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(-4 + k * 1.6, HAUT - 0.2, -4.6);
    s.scale.setScalar(0.9);
    scene.add(s); flashs.push(s);
  }
  // La fête : la ceinture (le trophée commun), les feux d'artifice, la presse.
  const ceinture = creerCeinture();
  ceinture.visible = false;
  scene.add(ceinture);
  const feux = creerFeux(scene);
  const presse = creerPresse(scene);

  /* ---------------- La caméra ---------------- */
  const cam = { mode: 'tele', pos: new THREE.Vector3(0, 3.6, 7), vise: new THREE.Vector3(0, HAUT + 1.1, 0), secousse: 0, cote: 1 };
  let largeur = 1, hauteur = 1;
  function dimensionner() {
    largeur = hote.clientWidth || 1; hauteur = hote.clientHeight || 1;
    renderer.setSize(largeur, hauteur, false);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(dimensionner);
  ro.observe(hote);
  dimensionner();

  function placerCamera(v, dt) {
    const [a, b] = v.boxeurs;
    let pos, vise;
    if (cam.mode === 'libre' && cam.libre) { pos = cam.libre.pos.clone(); vise = cam.libre.vise.clone(); }
    else {
      // De côté : perpendiculaire à la ligne des deux boxeurs, du côté du public d'en face ; plus loin s'ils s'écartent.
      const mx = (a.x + b.x) / 2, mz = -(a.y + b.y) / 2;
      let px = -(b.y - a.y), pz = -(b.x - a.x);
      const l = Math.hypot(px, pz) || 1;
      px /= l; pz /= l;
      if (pz < 0) { px = -px; pz = -pz; }
      const ecart = Math.hypot(a.x - b.x, a.y - b.y);
      const recul = (4.2 + ecart * 0.9) * (camera.aspect < 1 ? 1.5 : 1) * (cam.mode === 'gros' ? 0.6 : 1);
      pos = new THREE.Vector3(mx + px * recul, HAUT + 1.9 - (cam.mode === 'gros' ? 0.5 : 0), mz + pz * recul);
      vise = new THREE.Vector3(mx, HAUT + 1.05, mz);
    }
    const k = cam.mode === 'libre' ? 1 : Math.min(1, dt * 3.5);
    if (cam.saut) { cam.pos.copy(pos); cam.vise.copy(vise); cam.saut = false; }
    else { cam.pos.lerp(pos, k); cam.vise.lerp(vise, k); }
    camera.position.copy(cam.pos);
    if (cam.secousse > 0.001) {
      camera.position.x += (Math.random() - 0.5) * cam.secousse;
      camera.position.y += (Math.random() - 0.5) * cam.secousse;
      cam.secousse *= Math.pow(0.003, dt);
    }
    camera.lookAt(cam.vise);
  }

  /* ---------------- Une image ---------------- */
  let temps = 0, excitation = 0;
  function afficher(v, dt) {
    temps += dt;
    excitation *= Math.pow(0.35, dt);
    placerCamera(v, dt);
    v.boxeurs.forEach((p, i) => {
      const f = figs[i];
      const vit = Math.hypot(p.vx, p.vy);
      f.racine.position.set(p.x, HAUT, -p.y);
      const ang = Math.atan2(p.dx, -p.dy);
      const { P, tourne } = poseBoxe(f, p, { vitesse: vit * 1.4, sprint: false, t: temps, humeur: v.humeurs?.[i] || null }, dt);
      let da = ang + tourne - f.racine.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      f.racine.rotation.y += da * Math.min(1, dt * 18);
      poser(f, P, Math.min(1, dt * (p.coup ? 30 : 16)));
    });
    for (let k = gouttes.length - 1; k >= 0; k--) {
      const s = gouttes[k];
      s.vie -= dt;
      s.v.y -= 6 * dt;
      s.position.addScaledVector(s.v, dt);
      s.material.opacity = Math.max(0, s.vie) * 1.4;
      if (s.vie <= 0) { scene.remove(s); s.material.dispose(); gouttes.splice(k, 1); }
    }
    for (const s of flashs) s.material.opacity = Math.max(0, s.material.opacity - dt * 6);
    ring.maj(dt, Math.min(1, excitation), v.boxeurs);
    feux.maj(dt);
    presse.maj(dt);
    renderer.render(scene, camera);
  }

  /** Ce qui se passe dans le combat : des effets. */
  function evenements(evs, v) {
    for (const ev of evs) {
      if (ev.type === 'touche') {
        const d = v.boxeurs[ev.cible];
        const fort = ev.degats > 6 || ev.contre;
        gicler(d.x, HAUT + (ev.corps ? 1.2 : 1.75) * 1.08, -d.y, fort ? 10 : 4);
        excitation = Math.max(excitation, fort ? 0.8 : 0.35);
        if (fort) { cam.secousse = Math.max(cam.secousse, 0.06 + ev.degats * 0.008); for (const s of flashs) if (Math.random() < 0.5) s.material.opacity = 1; }
      } else if (ev.type === 'kd') { excitation = 1.5; cam.secousse = 0.25; for (const s of flashs) s.material.opacity = 1; }
      else if (ev.type === 'fin') excitation = 1.5;
    }
  }

  const proj = new THREE.Vector3();
  return {
    afficher,
    evenements,
    dimensionner,
    versEcran(x, y, z = 0) {
      proj.set(x, HAUT + z, -y).project(camera);
      return { x: (proj.x * 0.5 + 0.5) * largeur, y: (-proj.y * 0.5 + 0.5) * hauteur };
    },
    camera(mode, saut = false) { if (cam.mode !== mode) { cam.mode = mode; cam.saut = saut; } },
    cadrer(pos, vise, saut = false) {
      cam.libre = { pos: new THREE.Vector3(pos[0], pos[2], -pos[1]), vise: new THREE.Vector3(vise[0], vise[2], -vise[1]) };
      if (cam.mode !== 'libre' || saut) cam.saut = saut;
      cam.mode = 'libre';
    },
    /** La ceinture : en (x, y) du moteur, à la hauteur h au-dessus du tapis ; null pour la cacher. */
    trophee(t) { ceinture.visible = !!t; if (t) { ceinture.position.set(t.x, HAUT + t.h, -t.y); ceinture.rotation.y = Math.sin(performance.now() / 600) * 0.4; ceinture.scale.setScalar(t.echelle || 1); } },
    presse(p) { if (p) presse.montrer({ ...p }); else presse.cacher(); },
    feuArtifice(couleurs) { feux.lancer((Math.random() - 0.5) * 18, 9 + Math.random() * 4, -6 - Math.random() * 6, couleurs); },
    ecran: ring.ecran,
    secouer(f) { cam.secousse = Math.max(cam.secousse, f); },
    qualite: q,
    detruire() {
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((x) => { x.geometry?.dispose?.(); });
    },
  };
}
