/**
 * ROUCOULETTE — le match en 3D.
 *
 * Ce module ne joue pas : il montre une « vue » du match (la position de
 * chacun, son état, le ballon), venue du moteur (shared/handball/match.js).
 * La caméra (vue télé qui suit le ballon, gros plan sur le buteur,
 * cinématiques), les poses du handball (le bras armé du tir en suspension,
 * le gardien en étoile, la défense bras levés) posées sur les joueurs communs
 * (commun/trois/joueurs3d.js), et les effets (le filet qui se gonfle, les
 * confettis, le public qui saute).
 *
 * Repère : moteur (x, y, z) → 3D (x, z, -y).
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { creerJoueur, poseDe, poser } from '../../../commun/trois/joueurs3d.js';
import { creerSalle } from './salle3d.js';
import { creerTrophee, creerFeux, creerTropheeHommeDuMatch, creerPresse } from '../../../commun/trois/fete3d.js';

export { THREE };

const CLE_QUALITE = 'roucoulette.qualite';
export function qualite() {
  try { const q = localStorage.getItem(CLE_QUALITE); if (q) return q; } catch { /* ignore */ }
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return mobile ? 'moyenne' : 'haute';
}
export function reglerQualite(q) { try { localStorage.setItem(CLE_QUALITE, q); } catch { /* ignore */ } }

const R_BALLE = 0.095;
const COUL_HUMAINS = ['#ffd23f', '#4fd2ff'];
const ECHELLE = 1.08;
const N = 7;
/** Les couleurs des gardiens (une tenue à part, différente des deux équipes). */
const GARDIENS = ['#2ad18a', '#ff9a1a', '#c84aff', '#1ac8ff'];

/** Le ballon de handball : blanc, des panneaux de couleur. */
function creerBallon() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 128);
  const cols = ['#e8302a', '#1f5fae', '#ffd23f'];
  for (let k = 0; k < 6; k++) {
    g.fillStyle = cols[k % 3];
    g.beginPath();
    const x = k * 43;
    g.moveTo(x, 64); g.quadraticCurveTo(x + 21, k % 2 ? 10 : 118, x + 43, 64); g.quadraticCurveTo(x + 21, k % 2 ? 40 : 88, x, 64);
    g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
  for (const x of [0, 64, 128, 192]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(R_BALLE, 20, 14), new THREE.MeshLambertMaterial({ map: t }));
  m.castShadow = true;
  return m;
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
 * La pose de handball : celle de la course (commune), puis les bras et les jambes du handball.
 * p : le joueur de la vue (x, y, z, etat, charge, porte, defend, gardien, cote, haut…).
 */
function poseHand(f, p, o, dt) {
  const base = { ...p, etat: p.gardien && p.etat === 'plonge' ? 'plonge' : 'normal', frappe: 0, geste: 0, gesteType: 0, volee: 0, haut: p.haut };
  const P = poseDe(f, { ...o, p: base, gardien: p.gardien, cote: p.cote || 0, tab: false, charge: 0 }, dt);
  if (o.humeur) return P;
  const enAir = p.z > 0.02;
  if (p.gardien) {
    if (p.etat === 'plonge') return P;
    if (p.porte) Object.assign(P, { epAx: -1.25, epBx: -1.25, epAz: -0.15, epBz: 0.15, coudeA: -0.5, coudeB: -0.5 });
    else if (p.alerte) Object.assign(P, { epAz: 1.6, epBz: -1.6, epAx: -0.2, epBx: -0.2, coudeA: -0.6, coudeB: -0.6, hancheA: -0.25, hancheB: -0.25, genouA: 0.45, genouB: 0.45, by: 0.86 });
    return P;
  }
  if (p.etat === 'tir') {
    // Le tir en suspension : le bras armé haut derrière la tête, l'autre devant, une jambe repliée.
    Object.assign(P, { epAx: 0.6, epAz: 2.55, coudeA: -1.6, epBx: -1.4, epBz: -0.3, coudeB: -0.3, torse: -0.12, torseZ: -0.12, tete: -0.15 });
    if (enAir) Object.assign(P, { hancheA: -1.1, genouA: 1.5, hancheB: 0.15, genouB: 0.35 });
    else Object.assign(P, { hancheA: -0.4, hancheB: -0.4, genouA: 0.8, genouB: 0.8, by: 0.82 });
  } else if (p.lance > 0) {
    // Le bras qui vient de lancer : tendu vers l'avant, le corps penché.
    Object.assign(P, { epAx: -2.1, epAz: 0.25, coudeA: -0.1, epBx: 0.5, epBz: -0.5, torse: 0.35, torseZ: 0.1 });
    if (enAir) Object.assign(P, { hancheA: -0.9, genouA: 1.3, hancheB: 0.3, genouB: 0.4 });
  } else if (p.etat === 'saut' || (enAir && !p.porte)) {
    // Le contre : les deux bras en l'air.
    Object.assign(P, { epAz: 2.85, epBz: -2.85, epAx: -0.3, epBx: -0.3, coudeA: -0.1, coudeB: -0.1, hancheA: -0.3, hancheB: -0.3, genouA: 0.6, genouB: 0.6, torse: -0.05, tete: -0.3 });
  } else if (p.remise) {
    Object.assign(P, { epAx: -1.2, epBx: -1.2, epAz: -0.2, epBz: 0.2, coudeA: -0.6, coudeB: -0.6 });
  } else if (p.porte) {
    // Le ballon dans la main (ou le dribble).
    const h = Math.min(1, Math.max(0, (p.balleZ - 0.1) / 1.05));
    P.epAx = -0.45 - h * 0.6;
    P.coudeA = -0.5 - (1 - h) * 0.4;
    P.epAz = 0.3;
    P.torse += 0.12;
    if (p.feinte) { P.torseZ = 0.3; P.by = 0.84; }
  } else if (p.defend) {
    // La défense : fléchi, les bras levés devant (on montre ses mains au tireur).
    Object.assign(P, { by: 0.84, hancheA: P.hancheA - 0.3, hancheB: P.hancheB - 0.3, genouA: P.genouA + 0.5, genouB: P.genouB + 0.5, torse: P.torse + 0.15, epAz: 1.9, epBz: -1.9, epAx: -0.9, epBx: -0.9, coudeA: -0.7, coudeB: -0.7 });
  }
  if (p.surpris) Object.assign(P, { torseZ: 0.3, rz: 0.15 });
  return P;
}

/**
 * Crée la scène dans `hote`.
 * @param {HTMLElement} hote
 * @param {{ salle: string, equipes: [object, object], kits: [object, object], qualite?: string }} o
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
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.3, 800);
  const salle = creerSalle(scene, o.salle, { qualite: q, equipes: o.equipes, kits: o.kits });

  // Les gardiens : une couleur loin des deux tenues.
  const ecartC = (a, b) => { const A = new THREE.Color(a), B = new THREE.Color(b); return Math.abs(A.r - B.r) + Math.abs(A.g - B.g) + Math.abs(A.b - B.b); };
  const couleurGardien = (e) => {
    const autres = [o.kits[0].fond, o.kits[1].fond];
    let best = GARDIENS[e], bv = -1;
    GARDIENS.forEach((c, k) => { if (k % 2 !== e % 2) return; const v = Math.min(...autres.map((a) => ecartC(a, c))); if (v > bv) { bv = v; best = c; } });
    return best;
  };
  // Les joueurs.
  const figs = [];
  for (let e = 0; e < 2; e++) {
    for (let i = 0; i < N; i++) {
      const j = o.equipes[e].joueurs[i];
      const f = creerJoueur({ kit: o.kits[e], numero: j.numero, nom: j.nom, gardien: i === 0 ? couleurGardien(e) : null });
      f.racine.scale.setScalar(ECHELLE + (i === 6 ? 0.05 : i === 1 || i === 5 ? -0.04 : 0));
      f.ombre = ombre(1.3);
      scene.add(f.racine, f.ombre);
      figs.push(f);
    }
  }
  if (q !== 'haute') for (const f of figs) f.racine.traverse((x) => { x.castShadow = false; });
  const ballon = creerBallon();
  const ombreB = ombre(0.45);
  scene.add(ballon, ombreB);
  // La traînée des tirs.
  const trainee = [];
  const texTrainee = texRond('rgba(255,220,160,1)');
  for (let k = 0; k < 10; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texTrainee, color: '#ffe0b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.28);
    scene.add(s);
    trainee.push(s);
  }
  const historique = [];
  // Les anneaux sous les joueurs dirigés par un humain, et la flèche au-dessus.
  const anneaux = COUL_HUMAINS.map((c) => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 28), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.02;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), new THREE.MeshBasicMaterial({ color: c }));
    fl.rotation.x = Math.PI; fl.position.y = 2.6;
    g.add(r, fl);
    g.visible = false;
    g.fleche = fl;
    scene.add(g);
    return g;
  });
  // Les confettis (un seul nuage de points).
  const NCONF = q === 'basse' ? 160 : 380;
  const confPos = new Float32Array(NCONF * 3), confVit = new Float32Array(NCONF * 3), confCol = new Float32Array(NCONF * 3);
  const confGeo = new THREE.BufferGeometry();
  confGeo.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
  confGeo.setAttribute('color', new THREE.BufferAttribute(confCol, 3));
  const confettis = new THREE.Points(confGeo, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, depthWrite: false }));
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
  const lance = new Array(2 * N).fill(0);

  /* ---------------- La caméra ---------------- */
  const cam = { mode: 'tele', cx: 0, cz: 0, pos: new THREE.Vector3(0, 14, 24), vise: new THREE.Vector3(0, 0, 0), secousse: 0 };
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

  /** La distance de la caméra télé : on veut voir ~25 m de large (moins sur un écran en hauteur). */
  function distanceTele() {
    const a = camera.aspect;
    const couvre = Math.max(15, 25 * Math.min(1, a / 1.65));
    return couvre / 2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * a);
  }

  function placerCamera(v, dt) {
    const b = v.ballon;
    const bx = b.x, bz = -b.y;
    const k = Math.min(1, dt * 3);
    let pos, vise;
    if (cam.mode === 'libre' && cam.libre) {
      pos = cam.libre.pos.clone();
      vise = cam.libre.vise.clone();
    } else if (cam.mode === 'but' && v.heros >= 0) {
      // Le buteur, de face, un peu en contre-plongée.
      const h = v.joueurs[v.heros];
      const hx = h.x, hz = -h.y;
      pos = new THREE.Vector3(hx - Math.sign(hx || 1) * 4.4, 2.6, hz + 6.4);
      vise = new THREE.Vector3(hx, 1.5, hz);
    } else {
      const d = distanceTele();
      const demi = d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const lim = Math.max(0, 21.5 - demi + 1);
      cam.cx += (THREE.MathUtils.clamp(bx * 0.95 + b.vx * 0.15, -lim, lim) - cam.cx) * k;
      cam.cz += (THREE.MathUtils.clamp(bz * 0.3, -3, 3) - cam.cz) * k;
      vise = new THREE.Vector3(cam.cx, 1, cam.cz + 0.5);
      pos = new THREE.Vector3(cam.cx, 1 + Math.sin(0.55) * d, cam.cz + 0.5 + Math.cos(0.55) * d);
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
  let temps = 0, excitation = 0;
  const axe = new THREE.Vector3(), quat = new THREE.Quaternion(), vB = new THREE.Vector3();

  /**
   * Montre une vue du match.
   * v : { joueurs: [{ x, y, z, vx, vy, dx, dy, etat, porte, remise, defend, gardien, cote, haut, … }], ballon: { x, y, z, vx, vy, vz, porteur },
   *       phase, actifs: [i0, i1] (-1 si personne), humeurs: [..14], heros }
   */
  function afficher(v, dt) {
    temps += dt;
    excitation *= Math.pow(0.35, dt);
    placerCamera(v, dt);
    v.joueurs.forEach((p, i) => {
      const f = figs[i];
      f.racine.visible = f.ombre.visible = !p.absent;
      if (p.absent) return;
      if (lance[i] > 0) lance[i] -= dt;
      const vit = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * (p.z > 0.02 ? 0 : 1);
      f.racine.position.set(p.x, p.z || 0, -p.y);
      const ang = Math.atan2(p.dx, -p.dy);
      let da = ang - f.racine.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      f.racine.rotation.y += da * Math.min(1, dt * 14);
      const pose = poseHand(f, { ...p, lance: lance[i] }, { vitesse: vit, sprint: vit > 6.4, t: temps, humeur: v.humeurs?.[i] || null }, dt);
      poser(f, pose, Math.min(1, dt * (vit > 0.4 || p.z > 0 || p.etat === 'plonge' ? 20 : 12)));
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
      a.visible = i >= 0 && v.phase === 'jeu';
      if (!a.visible) return;
      const p = v.joueurs[i];
      a.position.set(p.x, 0, -p.y);
      a.fleche.position.y = 2.6 + (p.z || 0) + Math.sin(temps * 6) * 0.08;
      a.fleche.rotation.y += dt * 3;
    });
    const b = v.ballon;
    ballon.position.set(b.x, b.z, -b.y);
    vB.set(b.vx, b.vz, -b.vy);
    const sp = vB.length();
    if (b.porteur < 0 && sp > 0.1) {
      axe.set(0, 1, 0).cross(vB).normalize();
      quat.setFromAxisAngle(axe, (sp * dt) / R_BALLE * 0.6);
      ballon.quaternion.premultiply(quat);
    } else if (b.porteur >= 0) ballon.rotation.y += dt * 2;
    ombreB.position.set(b.x, 0.013, -b.y);
    const ho = 1 / (1 + b.z * 0.5);
    ombreB.scale.set(ho, 1, ho);
    ombreB.material.opacity = ho;
    historique.unshift(ballon.position.clone());
    if (historique.length > trainee.length) historique.pop();
    const vite = v.tirEnVol;
    trainee.forEach((s, k) => {
      const p = historique[k];
      s.visible = !!p && vite;
      if (!s.visible) return;
      s.position.copy(p);
      s.material.opacity = 0.4 * (1 - k / trainee.length);
      s.scale.setScalar(0.28 * (1 - k / trainee.length * 0.6));
    });
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
    salle.maj(dt, Math.min(1, excitation));
    renderer.render(scene, camera);
  }

  /** Ce qui se passe dans le match : des effets à déclencher. */
  function evenements(evs, v) {
    for (const ev of evs) {
      const b = v.ballon;
      const cote = b.x > 0 ? 0 : 1;
      switch (ev.type) {
        case 'tir': case 'passe': if (ev.joueur >= 0) lance[ev.joueur] = 0.3; if (ev.type === 'tir') excitation = Math.max(excitation, 0.35); break;
        case 'but': {
          salle.buts[cote].gonfle = 1;
          excitation = 1.2;
          eclair.position.set(b.x, 1.2, -b.y); eclair.scale.setScalar(1.6); eclair.material.opacity = ev.lucarne || ev.enOr ? 0.9 : 0.55;
          if (ev.lucarne || ev.enOr || ev.contre) lancerConfettis(b.x > 0 ? 1 : -1, ev.equipe);
          break;
        }
        case 'poteau': salle.buts[cote].tremble = 1; cam.secousse = Math.max(cam.secousse, 0.12); break;
        case 'arret': excitation = Math.max(excitation, 0.9); cam.secousse = Math.max(cam.secousse, 0.1); break;
        case 'contre': cam.secousse = Math.max(cam.secousse, 0.15); excitation = Math.max(excitation, 0.8); break;
        case 'vol': case 'interception': excitation = Math.max(excitation, 0.5); break;
        default:
      }
    }
  }

  function lancerConfettis(cote, e) {
    const k = o.kits[e];
    const cols = [k.fond, k.motifC, k.short, '#ffffff', '#ffb347'].map((c) => new THREE.Color(c));
    for (let i = 0; i < NCONF; i++) {
      confPos[i * 3] = cote * (13 + Math.random() * 7);
      confPos[i * 3 + 1] = 7 + Math.random() * 5;
      confPos[i * 3 + 2] = (Math.random() - 0.5) * 20;
      confVit[i * 3] = (Math.random() - 0.5) * 4 - cote * 1.5;
      confVit[i * 3 + 1] = Math.random() * 3;
      confVit[i * 3 + 2] = (Math.random() - 0.5) * 4;
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
    feuArtifice(couleurs) { feux.lancer((Math.random() - 0.5) * 30, 10 + Math.random() * 4, -9 - Math.random() * 6, couleurs); },
    confettis(cote, e) { lancerConfettis(cote, e); },
    ecran: salle.ecran || null,
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
