/**
 * RAFFUT — le match en 3D.
 *
 * Ce module ne joue pas : il montre une « vue » du match (la position de
 * chacun, son état, le ballon), venue du moteur (shared/rugby/match.js).
 * La caméra (vue télé qui suit le ballon, gros plan sur le marqueur, derrière
 * le buteur pour la transformation, cinématiques), les poses du rugby (le
 * ballon sous le bras, le plongeon du plaqueur, au sol, la mêlée, le saut en
 * touche, le raffut) posées sur les joueurs communs (commun/trois/joueurs3d.js),
 * et les effets (les confettis, la foule qui saute, les poteaux qui vibrent).
 *
 * Repère : moteur (x, y, z) → 3D (x, z, -y).
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { creerJoueur, poseDe, poser } from '../../../commun/trois/joueurs3d.js';
import { creerStade } from './stade3d.js';
import { creerTrophee, creerFeux, creerTropheeHommeDuMatch, creerPresse } from '../../../commun/trois/fete3d.js';
import { DEMI_L, MORT, BARRE_Z } from '../../../../../shared/rugby/terrain.js';

export { THREE };

const CLE_QUALITE = 'raffut.qualite';
export function qualite() {
  try { const q = localStorage.getItem(CLE_QUALITE); if (q) return q; } catch { /* ignore */ }
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return mobile ? 'moyenne' : 'haute';
}
export function reglerQualite(q) { try { localStorage.setItem(CLE_QUALITE, q); } catch { /* ignore */ } }

const R_BALLE = 0.14;
const COUL_HUMAINS = ['#ffd23f', '#4fd2ff'];
const ECHELLE = 1.1;

/** Le ballon ovale : blanc, ses bandes colorées, ses coutures. */
function creerBallon() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#d23a2a';
  for (const x of [52, 188]) g.fillRect(x, 0, 16, 128);
  g.fillStyle = '#1f3f8a';
  for (const x of [74, 166]) g.fillRect(x, 0, 6, 128);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
  for (const y of [32, 96]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(R_BALLE * 1.5, 22, 14);
  // La sphère s'allonge le long de x (son axe long).
  geo.rotateZ(Math.PI / 2);
  geo.scale(1, 0.62, 0.62);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: t }));
  mesh.castShadow = true;
  const racine = new THREE.Group();
  racine.add(mesh);
  racine.mesh = mesh;
  return racine;
}

let texOmbre = null;
function ombre(taille) {
  if (!texOmbre) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    texOmbre = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(taille, taille), new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}
function texRond(couleur) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, couleur); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * La pose du rugby : celle de la course (commune), puis ce qui est propre au rugby.
 * p : le joueur de la vue (x, y, z, etat, porte, frappe, charge, melee, ruck, raffut…).
 */
function poseRugby(f, p, o, dt) {
  const base = { ...p, etat: p.porte && p.etat === 'normal' && !p.bloque ? 'tient' : p.etat === 'sol' ? 'sol' : 'normal', frappe: p.frappe || 0, geste: 0, gesteType: 0, volee: 0 };
  const P = poseDe(f, { ...o, p: base, gardien: false, cote: 0, tab: false, charge: p.etat === 'pied' ? p.charge : 0 }, dt);
  if (o.humeur) return P;
  if (p.etat === 'plonge') {
    // Le plongeon : couché vers l'avant, les bras tendus pour ceinturer.
    Object.assign(P, { by: 0.5, rx: 1.15, y: 0, torse: 0.2, tete: -0.5, hancheA: 0.2, genouA: 0.4, hancheB: 0.5, genouB: 0.9, epAx: -2.5, epBx: -2.5, epAz: 0.25, epBz: -0.25, coudeA: -0.3, coudeB: -0.3 });
  } else if (p.melee || p.ruck) {
    // La mêlée, le ruck : penché, les jambes fléchies, les bras sur les épaules des autres.
    const fort = p.melee ? 1 : 0.75;
    Object.assign(P, { by: 0.92 - 0.2 * fort, torse: 1.2 * fort, tete: -0.9 * fort, hancheA: -0.9 * fort, hancheB: -0.7 * fort, genouA: 1.1 * fort, genouB: 0.9 * fort, epAx: -1.4, epBx: -1.4, epAz: 0.6, epBz: -0.6, coudeA: -0.4, coudeB: -0.4 });
  } else if (p.z > 0.05) {
    // Le sauteur de la touche : les bras tendus vers le ballon.
    Object.assign(P, { epAz: 2.9, epBz: -2.9, epAx: -0.2, epBx: -0.2, coudeA: -0.05, coudeB: -0.05, hancheA: -0.1, hancheB: -0.1, genouA: 0.2, genouB: 0.2, tete: -0.4 });
  } else if (p.lance) {
    // Le talonneur lance en touche : le ballon au-dessus de la tête.
    Object.assign(P, { epAx: -2.8, epBx: -2.8, epAz: 0.2, epBz: -0.2, coudeA: -1.2, coudeB: -1.2, torse: -0.1 });
  } else if (p.geste === 'crochet') {
    // Le crochet : penché sur l'appui, le ballon serré, le bras libre écarté.
    Object.assign(P, { torseZ: Math.sign(p.vy * p.dx - p.vx * p.dy) * 0.35, by: 0.82, genouA: P.genouA + 0.4, genouB: P.genouB + 0.4, epBz: -1.1, coudeB: -0.2 });
  } else if (p.geste === 'roulette') {
    // La roulette : groupé, le ballon contre le ventre, les coudes sortis.
    Object.assign(P, { by: 0.84, torse: 0.45, epAx: -0.9, epBx: -0.9, epAz: 0.6, epBz: -0.6, coudeA: -1.6, coudeB: -1.6 });
  } else if (p.geste === 'feinte') {
    // La feinte de passe : les deux bras partent sur le côté… et le ballon reste.
    const u = Math.min(1, Math.max(0, (18 - (p.tg || 0)) / 9));
    const aller = u < 1 ? u : 1;
    Object.assign(P, { epAx: -1.1, epBx: -1.1, epAz: 0.2 + aller * 0.9, epBz: -0.2 + aller * 0.9, coudeA: -0.5, coudeB: -0.5, torseZ: aller * 0.3 });
  } else if (p.raffut) {
    // Le raffut : un bras tendu devant, la main ouverte.
    Object.assign(P, { epBx: -1.55, epBz: -0.35, coudeB: -0.05 });
  } else if (p.defend && p.etat === 'normal') {
    Object.assign(P, { by: 0.86, torse: P.torse + 0.25, hancheA: P.hancheA - 0.2, hancheB: P.hancheB - 0.2, genouA: P.genouA + 0.35, genouB: P.genouB + 0.35, epAz: 0.5, epBz: -0.5, epAx: -0.5, epBx: -0.5 });
  }
  return P;
}

/**
 * Crée la scène dans `hote`.
 * @param {HTMLElement} hote
 * @param {{ stade: string, equipes: [object, object], kits: [object, object], qualite?: string }} o
 */
export function creerRendu(hote, o) {
  const q = o.qualite || qualite();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: q !== 'basse', powerPreference: 'high-performance' });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'haute' ? 2 : q === 'moyenne' ? 1.5 : 1) * (q === 'basse' ? 0.75 : 1));
  renderer.shadowMap.enabled = q === 'haute';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'scene3d';
  hote.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.3, 900);
  const stade = creerStade(scene, o.stade, { qualite: q, equipes: o.equipes, kits: o.kits });

  // Les joueurs (les avants un peu plus massifs).
  const figs = [];
  for (let e = 0; e < 2; e++) {
    for (let i = 0; i < 7; i++) {
      const j = o.equipes[e].joueurs[i];
      const f = creerJoueur({ kit: o.kits[e], numero: j.numero, nom: j.nom });
      if (i <= 2) f.racine.scale.set(ECHELLE * 1.14, ECHELLE * 1.02, ECHELLE * 1.14);
      else f.racine.scale.setScalar(ECHELLE * (i === 6 ? 0.98 : 1));
      f.ombre = ombre(1.4);
      scene.add(f.racine, f.ombre);
      figs.push(f);
    }
  }
  if (q !== 'haute') for (const f of figs) f.racine.traverse((x) => { x.castShadow = false; });
  const ballon = creerBallon();
  const ombreB = ombre(0.55);
  scene.add(ballon, ombreB);
  // La traînée des coups de pied.
  const trainee = [];
  const texTrainee = texRond('rgba(255,240,200,1)');
  for (let k = 0; k < 12; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texTrainee, color: '#fff0c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.35);
    scene.add(s);
    trainee.push(s);
  }
  const historique = [];
  // La visée de la transformation : des points au sol, et une cible entre les poteaux.
  const viseePoints = [];
  const texVise = texRond('rgba(255,230,120,1)');
  for (let k = 0; k < 14; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texVise, color: '#ffe680', transparent: true, opacity: 0.8, depthWrite: false }));
    s.scale.setScalar(0.32);
    s.visible = false;
    scene.add(s);
    viseePoints.push(s);
  }
  const cibleVise = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  cibleVise.rotation.y = Math.PI / 2;
  cibleVise.visible = false;
  scene.add(cibleVise);
  // Les anneaux sous les joueurs dirigés par un humain, et la flèche au-dessus.
  const anneaux = COUL_HUMAINS.map((c) => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 28), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.02;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 4), new THREE.MeshBasicMaterial({ color: c }));
    fl.rotation.x = Math.PI; fl.position.y = 2.7;
    g.add(r, fl);
    g.visible = false;
    g.fleche = fl;
    scene.add(g);
    return g;
  });
  // Les confettis (un seul nuage de points).
  const NCONF = q === 'basse' ? 200 : 460;
  const confPos = new Float32Array(NCONF * 3), confVit = new Float32Array(NCONF * 3), confCol = new Float32Array(NCONF * 3);
  const confGeo = new THREE.BufferGeometry();
  confGeo.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
  confGeo.setAttribute('color', new THREE.BufferAttribute(confCol, 3));
  const confettis = new THREE.Points(confGeo, new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, depthWrite: false }));
  confettis.visible = false;
  scene.add(confettis);
  let confVie = 0;
  const eclair = new THREE.Sprite(new THREE.SpriteMaterial({ map: texRond('rgba(255,240,200,1)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(eclair);
  // La fête.
  const trophee = creerTrophee();
  trophee.visible = false;
  scene.add(trophee);
  const feux = creerFeux(scene);
  const tropheeHdm = creerTropheeHommeDuMatch();
  tropheeHdm.visible = false;
  scene.add(tropheeHdm);
  const presse = creerPresse(scene);
  let porteHdm = -1;
  const main1 = new THREE.Vector3(), main2 = new THREE.Vector3();

  /* ---------------- La caméra ---------------- */
  const cam = { mode: 'tele', cx: 0, cz: 0, pos: new THREE.Vector3(0, 18, 30), vise: new THREE.Vector3(0, 0, 0), secousse: 0 };
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

  /** La distance de la caméra télé : on veut voir ~32 m de large (moins sur un écran en hauteur). */
  function distanceTele() {
    const a = camera.aspect;
    const couvre = Math.max(18, 32 * Math.min(1, a / 1.65));
    return couvre / 2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * a);
  }

  function placerCamera(v, dt) {
    const b = v.ballon;
    const bx = b.x, bz = -b.y;
    const k = Math.min(1, dt * 2.6);
    let pos, vise;
    if (cam.mode === 'libre' && cam.libre) {
      pos = cam.libre.pos.clone();
      vise = cam.libre.vise.clone();
    } else if (cam.mode === 'essai' && v.heros >= 0) {
      // Le marqueur, de face, un peu en contre-plongée.
      const h = v.joueurs[v.heros];
      const hx = h.x, hz = -h.y;
      pos = new THREE.Vector3(hx - Math.sign(hx || 1) * 5, 2.8, hz + 6.5);
      vise = new THREE.Vector3(hx, 1.2, hz);
    } else if (cam.mode === 'transfo' && v.transfo) {
      // Derrière le buteur : le ballon, les poteaux au loin.
      const t = v.transfo, s = t.sens;
      const dx = s * DEMI_L - t.bx, dy = t.vise - t.by, l = Math.hypot(dx, dy) || 1;
      pos = new THREE.Vector3(t.bx - (dx / l) * 6.5, 2.6, -(t.by - (dy / l) * 6.5));
      vise = new THREE.Vector3(s * DEMI_L, 3.2, -t.vise * 0.7 - t.by * 0.3);
      if (t.parti) vise = new THREE.Vector3(b.x, Math.max(2, b.z), -b.y);
    } else {
      const d = distanceTele();
      const demi = d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const lim = Math.max(0, MORT + 4 - demi);
      cam.cx += (THREE.MathUtils.clamp(bx * 0.95 + b.vx * 0.25, -lim, lim) - cam.cx) * k;
      cam.cz += (THREE.MathUtils.clamp(bz * 0.45, -6, 6) - cam.cz) * k;
      vise = new THREE.Vector3(cam.cx, 1, cam.cz + 0.5);
      pos = new THREE.Vector3(cam.cx, 1 + Math.sin(0.52) * d, cam.cz + 0.5 + Math.cos(0.52) * d);
    }
    const kk = cam.mode === 'tele' ? 1 : Math.min(1, dt * 2.6);
    if (cam.saut) { cam.pos.copy(pos); cam.vise.copy(vise); cam.saut = false; }
    else { cam.pos.lerp(pos, kk); cam.vise.lerp(vise, kk); }
    camera.position.copy(cam.pos);
    if (cam.secousse > 0.001) {
      camera.position.x += (Math.random() - 0.5) * cam.secousse;
      camera.position.y += (Math.random() - 0.5) * cam.secousse;
      cam.secousse *= Math.pow(0.004, dt);
    }
    camera.lookAt(cam.vise);
  }

  /* ---------------- Une image ---------------- */
  let temps = 0, excitation = 0, tourne = 0, spirale = 0;

  /**
   * Montre une vue du match.
   * v : { joueurs: [{ x, y, z, vx, vy, dx, dy, etat, porte, … }], ballon: { x, y, z, vx, vy, vz, porteur, pied },
   *       phase, actifs: [i0, i1] (-1 si personne), humeurs: [..14], heros, transfo }
   */
  function afficher(v, dt) {
    temps += dt;
    excitation *= Math.pow(0.35, dt);
    placerCamera(v, dt);
    v.joueurs.forEach((p, i) => {
      const f = figs[i];
      f.racine.visible = f.ombre.visible = !p.absent;
      if (p.absent) return;
      const vit = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * (p.etat === 'normal' || p.etat === 'pied' ? 1 : 0);
      f.racine.position.set(p.x, p.z || 0, -p.y);
      const ang = Math.atan2(p.dx, -p.dy);
      let da = ang - f.racine.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      f.racine.rotation.y += da * Math.min(1, dt * 12);
      // La roulette : un tour complet sur lui-même, le temps du geste.
      if (p.geste === 'roulette') f.racine.rotation.y = ang + (1 - (p.tg || 0) / 26) * Math.PI * 2;
      const pose = poseRugby(f, p, { vitesse: vit, sprint: vit > 7, t: temps, humeur: v.humeurs?.[i] || null }, dt);
      poser(f, pose, Math.min(1, dt * (vit > 0.4 || p.etat !== 'normal' ? 18 : 10)));
      f.ombre.position.set(p.x, 0.012, -p.y);
      const ho = 1 / (1 + (p.z || 0) * 0.8);
      f.ombre.scale.set(ho, 1, ho);
    });
    if (porteHdm >= 0) {
      const f = figs[porteHdm];
      f.racine.updateMatrixWorld(true);
      f.A.coude.localToWorld(main1.set(0, -0.34, 0));
      f.B.coude.localToWorld(main2.set(0, -0.34, 0));
      tropheeHdm.position.set((main1.x + main2.x) / 2, (main1.y + main2.y) / 2 - 0.02, (main1.z + main2.z) / 2);
      tropheeHdm.rotation.y = f.racine.rotation.y + Math.sin(temps * 1.2) * 0.12;
    }
    presse.maj(dt);
    anneaux.forEach((a, n) => {
      const i = v.actifs?.[n] ?? -1;
      a.visible = i >= 0 && (v.phase === 'jeu' || v.phase === 'ruck');
      if (!a.visible) return;
      const p = v.joueurs[i];
      a.position.set(p.x, 0, -p.y);
      a.fleche.position.y = 2.7 + (p.z || 0) + Math.sin(temps * 6) * 0.08;
      a.fleche.rotation.y += dt * 3;
    });
    // Le ballon : sous le bras (dans le sens de la course), en vrille sur les passes, en culbute sur les coups de pied.
    const b = v.ballon;
    ballon.position.set(b.x, b.z, -b.y);
    const vh = Math.hypot(b.vx, b.vy);
    if (b.porteur >= 0) {
      const p = v.joueurs[b.porteur];
      ballon.rotation.set(0, Math.atan2(p.dy, p.dx), 0);
      ballon.mesh.rotation.set(0, 0, 0.25);
    } else if (vh > 0.6 || b.z > 0.3) {
      ballon.rotation.set(0, Math.atan2(b.vy, b.vx), 0);
      if (b.pied) { tourne += dt * 11; ballon.mesh.rotation.set(0, 0, tourne); }
      else { spirale += dt * 18; ballon.mesh.rotation.set(spirale, 0, Math.atan2(b.vz, vh) * 0.6); }
    } else ballon.mesh.rotation.z += (0 - ballon.mesh.rotation.z) * Math.min(1, dt * 6);
    ombreB.position.set(b.x, 0.013, -b.y);
    const ho = 1 / (1 + b.z * 0.4);
    ombreB.scale.set(ho, 1, ho);
    ombreB.material.opacity = ho;
    historique.unshift(ballon.position.clone());
    if (historique.length > trainee.length) historique.pop();
    const vite = !!b.pied && b.porteur < 0 && b.z > 0.5;
    trainee.forEach((s, k) => {
      const p = historique[k];
      s.visible = !!p && vite;
      if (!s.visible) return;
      s.position.copy(p);
      s.material.opacity = 0.35 * (1 - k / trainee.length);
      s.scale.setScalar(0.35 * (1 - (k / trainee.length) * 0.6));
    });
    // La visée de la transformation.
    const tr = v.transfo;
    const montre = !!tr && !tr.parti && tr.humain;
    cibleVise.visible = montre;
    viseePoints.forEach((s, k) => {
      s.visible = montre;
      if (!montre) return;
      const u = (k + 1) / (viseePoints.length + 1);
      const x = tr.bx + (tr.sens * DEMI_L - tr.bx) * u, y = tr.by + (tr.vise - tr.by) * u;
      s.position.set(x, 0.1 + Math.sin(u * Math.PI) * 2.5, -y);
      s.material.opacity = 0.35 + 0.5 * Math.abs(Math.sin(temps * 4 - k * 0.5));
    });
    if (montre) { cibleVise.position.set(tr.sens * DEMI_L, BARRE_Z + 2.5, -tr.vise); cibleVise.scale.setScalar(1 + Math.sin(temps * 5) * 0.08); }
    if (eclair.material.opacity > 0) { eclair.material.opacity = Math.max(0, eclair.material.opacity - dt * 3); eclair.scale.multiplyScalar(1 + dt * 5); }
    if (confVie > 0) {
      confVie -= dt;
      for (let k = 0; k < NCONF; k++) {
        confVit[k * 3 + 1] -= 6 * dt;
        confVit[k * 3] *= Math.pow(0.6, dt); confVit[k * 3 + 2] *= Math.pow(0.6, dt);
        confVit[k * 3 + 1] = Math.max(confVit[k * 3 + 1], -2.2);
        confPos[k * 3] += (confVit[k * 3] + Math.sin(temps * 5 + k) * 0.6) * dt;
        confPos[k * 3 + 1] = Math.max(0.02, confPos[k * 3 + 1] + confVit[k * 3 + 1] * dt);
        confPos[k * 3 + 2] += confVit[k * 3 + 2] * dt;
      }
      confGeo.attributes.position.needsUpdate = true;
      confettis.material.opacity = Math.min(1, confVie);
      confettis.visible = confVie > 0;
    }
    feux.maj(dt);
    stade.maj(dt, Math.min(1, excitation));
    renderer.render(scene, camera);
  }

  /** Ce qui se passe dans le match : des effets à déclencher. */
  function evenements(evs, v) {
    for (const ev of evs) {
      const b = v.ballon;
      switch (ev.type) {
        case 'essai':
          excitation = 1.5;
          eclair.position.set(b.x, 1, -b.y); eclair.scale.setScalar(3); eclair.material.opacity = 0.8;
          lancerConfettis(Math.sign(b.x) || 1, ev.equipe);
          cam.secousse = Math.max(cam.secousse, 0.2);
          break;
        case 'drop': excitation = 1.3; lancerConfettis(Math.sign(b.x) || 1, ev.equipe); break;
        case 'transfo': if (ev.reussi) excitation = Math.max(excitation, 0.9); break;
        case 'poteau': { const p = stade.poteaux[b.x > 0 ? 1 : 0]; p.tremble = 1; break; }
        case 'plaquage': cam.secousse = Math.max(cam.secousse, 0.12); excitation = Math.max(excitation, 0.5); break;
        case 'plaquage-rate': excitation = Math.max(excitation, ev.franchi ? 1 : 0.6); break;
        case 'interception': case 'grattage': excitation = Math.max(excitation, 0.7); break;
        case 'pied': excitation = Math.max(excitation, 0.3); break;
        default:
      }
    }
  }

  function lancerConfettis(cote, e) {
    const k = o.kits[e];
    const cols = [k.fond, k.motifC, k.short, '#ffffff', '#ffb347'].map((c) => new THREE.Color(c));
    for (let i = 0; i < NCONF; i++) {
      confPos[i * 3] = cote * (24 + Math.random() * 10);
      confPos[i * 3 + 1] = 8 + Math.random() * 6;
      confPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      confVit[i * 3] = (Math.random() - 0.5) * 5 - cote * 1.5;
      confVit[i * 3 + 1] = Math.random() * 3;
      confVit[i * 3 + 2] = (Math.random() - 0.5) * 5;
      const c = cols[i % cols.length];
      confCol[i * 3] = c.r; confCol[i * 3 + 1] = c.g; confCol[i * 3 + 2] = c.b;
    }
    confGeo.attributes.color.needsUpdate = true;
    confVie = 4.5;
    confettis.visible = true;
  }

  const proj = new THREE.Vector3();
  return {
    afficher,
    evenements,
    dimensionner,
    versEcran(x, y, z = 0) {
      proj.set(x, z, -y).project(camera);
      return { x: (proj.x * 0.5 + 0.5) * largeur, y: (-proj.y * 0.5 + 0.5) * hauteur, devant: proj.z < 1 };
    },
    camera(mode, saut = false) { if (cam.mode !== mode) { cam.mode = mode; cam.saut = saut; } },
    cadrer(pos, vise, saut = false) {
      cam.libre = { pos: new THREE.Vector3(pos[0], pos[2], -pos[1]), vise: new THREE.Vector3(vise[0], vise[2], -vise[1]) };
      if (cam.mode !== 'libre' || saut) cam.saut = saut;
      cam.mode = 'libre';
    },
    trophee(t) {
      trophee.visible = !!t;
      if (t) { trophee.position.set(t.x, t.h, -t.y); trophee.rotation.y += 0.02; trophee.scale.setScalar(t.echelle || 1.2); }
    },
    tropheeMain(i) { porteHdm = i ?? -1; tropheeHdm.visible = porteHdm >= 0; },
    presse(p) { if (p) presse.montrer(p); else presse.cacher(); },
    feuArtifice(couleurs) { feux.lancer((Math.random() - 0.5) * 30, 12 + Math.random() * 5, -12 - Math.random() * 8, couleurs); },
    confettis(cote, e) { lancerConfettis(cote, e); },
    ecran: stade.ecran || null,
    secouer(f) { cam.secousse = Math.max(cam.secousse, f); },
    exciter(f) { excitation = Math.max(excitation, f); },
    qualite: q,
    detruire() {
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((x) => { x.geometry?.dispose?.(); });
    },
  };
}
