/**
 * REVERS — le match en 3D.
 *
 * Ce module ne joue pas : il montre une « vue » du match (où sont les deux joueurs et la balle, ce qu'ils
 * font), venue du moteur (shared/tennis/match.js). Les joueurs partent du joueur commun
 * (commun/trois/joueurs3d.js), en tenue de tennis à leurs couleurs, le bandeau, la raquette dans la main
 * droite. Leurs gestes : la préparation (la raquette en arrière, les épaules tournées), le coup droit, le
 * revers, la volée, le slice, le lob, l'amortie, le service et le smash ; la balle, son ombre, sa traînée
 * et ses traces au sol ; la caméra de télévision, derrière le joueur.
 *
 * Repère : moteur (x, y) → 3D (x, 0, -y).
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { creerJoueur, poseDe, poser } from '../../../commun/trois/joueurs3d.js';
import { creerTrophee, creerFeux } from '../../../commun/trois/fete3d.js';
import { creerCourt } from './court3d.js';
import { LONG } from '../../../../../shared/tennis/terrain.js';

export { THREE };

const CLE_QUALITE = 'revers.qualite';
export function qualite() {
  try { const q = localStorage.getItem(CLE_QUALITE); if (q) return q; } catch { /* ignore */ }
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'moyenne' : 'haute';
}
export function reglerQualite(q) { try { localStorage.setItem(CLE_QUALITE, q); } catch { /* ignore */ } }

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const doux = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
const sensDe = (e) => (e === 0 ? 1 : -1);

/** La raquette : le manche, le cadre (un anneau ovale), le tamis. */
function creerRaquette(couleur) {
  const g = new THREE.Group();
  const cadre = new THREE.MeshLambertMaterial({ color: couleur, flatShading: true });
  const manche = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.2, 8), new THREE.MeshLambertMaterial({ color: '#1b1b1f' }));
  manche.position.y = -0.06;
  const coeur = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.018), cadre);
  coeur.position.y = -0.2;
  const tete = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 6, 22), cadre);
  tete.scale.set(0.82, 1.08, 1);
  tete.position.y = -0.39;
  const tamis = new THREE.Mesh(new THREE.CircleGeometry(0.12, 18), new THREE.MeshBasicMaterial({ color: '#f2f2ea', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  tamis.scale.set(0.82, 1.08, 1);
  tamis.position.y = -0.39;
  g.add(manche, coeur, tete, tamis);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Un joueur de tennis : le joueur commun, le maillot et le short à ses couleurs, le bandeau, la raquette. */
function creerTennisman(j) {
  const kit = { fond: j.couleurs.maillot, motif: 'uni', motifC: j.couleurs.maillot, short: j.couleurs.short, bas: '#f4f4f4', num: j.couleurs.maillot === '#f4f4f4' ? '#1b1b1f' : '#f4f4f4' };
  const f = creerJoueur({ kit, numero: '', nom: j.nom });
  const bandeau = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.045, 16, 1, true), new THREE.MeshLambertMaterial({ color: j.couleurs.bandeau, side: THREE.DoubleSide }));
  bandeau.position.y = 0.06;
  f.tete.add(bandeau);
  const raquette = creerRaquette(j.couleurs.raquette);
  raquette.position.y = -0.33;
  f.B.coude.add(raquette);
  f.raquette = raquette;
  f.racine.scale.setScalar(1.02 * (j.taille || 1));
  f.main = { B: V(-0.2, 0.3, 0.35), A: V(0.1, 0.3, 0.38) };
  f.torsion = 0;
  return f;
}

/* ---------------- Les bras : où va la main (le bras suit) ---------------- */

const L_BRAS = 0.31, L_AVANT = 0.36;
const _S = V(0, 0, 0), _T = V(0, 0, 0), _D = V(0, 0, 0), _U = V(0, 0, 0), _E = V(0, 0, 0), _F = V(0, 0, 0), _P = V(0, 0, 0);
const _X = V(0, 0, 0), _Y = V(0, 0, 0), _Z = V(0, 0, 0), _M = new THREE.Matrix4();

/** Pose un bras pour que la main aille en `cible` (dans le repère du buste : +z devant, +y en haut), le coude tiré vers `pole`. */
function poserBras(bras, cible, pole) {
  _S.copy(bras.ep.position);
  _T.copy(cible);
  _D.subVectors(_T, _S);
  const d = Math.min(L_BRAS + L_AVANT - 0.002, Math.max(0.08, _D.length()));
  _D.normalize();
  const cosA = (L_BRAS * L_BRAS + d * d - L_AVANT * L_AVANT) / (2 * L_BRAS * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  _P.copy(pole).addScaledVector(_D, -pole.dot(_D)).normalize();
  _U.copy(_D).multiplyScalar(Math.cos(a)).addScaledVector(_P, Math.sin(a)).normalize();
  _E.copy(_S).addScaledVector(_U, L_BRAS);
  _F.copy(_S).addScaledVector(_D, d).sub(_E).normalize();
  _Y.copy(_U).negate();
  _Z.copy(_F).addScaledVector(_U, -_F.dot(_U));
  if (_Z.lengthSq() < 1e-6) _Z.set(0, 0, 1).addScaledVector(_U, -_U.z);
  _Z.normalize();
  _X.crossVectors(_Y, _Z).normalize();
  _M.makeBasis(_X, _Y, _Z);
  bras.ep.quaternion.setFromRotationMatrix(_M);
  bras.coude.rotation.set(-Math.acos(Math.max(-1, Math.min(1, _U.dot(_F)))), 0, 0);
}

/**
 * Les gestes : pour chaque coup, la main droite (la raquette), la main gauche et la torsion des épaules,
 * en quelques images clés. 'prep' : armé (avant la frappe) ; puis l'impact (u = 0) et l'accompagnement.
 * Main droite : x < 0 à droite du joueur, x > 0 à sa gauche.
 */
const PRET = { B: V(-0.18, 0.3, 0.38), A: V(0.08, 0.32, 0.4), tors: 0 };
const GESTES = {
  cd: { prep: { B: V(-0.6, 0.42, -0.3), A: V(0.25, 0.4, 0.35), tors: -0.85 }, impact: { B: V(-0.55, 0.28, 0.42), A: V(0.3, 0.32, 0.25), tors: -0.1 }, fin: { B: V(0.28, 0.72, 0.2), A: V(0.2, 0.3, 0.1), tors: 0.65 } },
  rv: { prep: { B: V(0.42, 0.4, -0.25), A: V(0.3, 0.42, 0.1), tors: 0.95 }, impact: { B: V(0.32, 0.3, 0.48), A: V(0.45, 0.35, -0.2), tors: 0.2 }, fin: { B: V(-0.55, 0.78, 0.15), A: V(0.5, 0.4, -0.25), tors: -0.45 } },
  sliceCd: { prep: { B: V(-0.55, 0.72, -0.25), A: V(0.25, 0.45, 0.35), tors: -0.7 }, impact: { B: V(-0.45, 0.32, 0.45), A: V(0.3, 0.35, 0.2), tors: -0.15 }, fin: { B: V(-0.05, 0.22, 0.55), A: V(0.35, 0.35, 0.05), tors: 0.25 } },
  sliceRv: { prep: { B: V(0.42, 0.72, -0.2), A: V(0.3, 0.5, 0.05), tors: 0.9 }, impact: { B: V(0.3, 0.32, 0.5), A: V(0.45, 0.4, -0.2), tors: 0.25 }, fin: { B: V(-0.35, 0.25, 0.5), A: V(0.5, 0.4, -0.25), tors: -0.2 } },
  voleeCd: { prep: { B: V(-0.5, 0.5, 0.05), A: V(0.15, 0.4, 0.35), tors: -0.4 }, impact: { B: V(-0.42, 0.45, 0.55), A: V(0.25, 0.4, 0.3), tors: -0.1 }, fin: { B: V(-0.3, 0.4, 0.55), A: V(0.25, 0.35, 0.25), tors: 0 } },
  voleeRv: { prep: { B: V(0.32, 0.5, 0.1), A: V(0.35, 0.45, 0.15), tors: 0.5 }, impact: { B: V(0.32, 0.45, 0.58), A: V(0.45, 0.4, 0), tors: 0.15 }, fin: { B: V(0.2, 0.4, 0.58), A: V(0.45, 0.35, -0.1), tors: 0 } },
  lob: { prep: { B: V(-0.55, 0.15, -0.2), A: V(0.25, 0.35, 0.35), tors: -0.6 }, impact: { B: V(-0.45, 0.25, 0.45), A: V(0.3, 0.3, 0.2), tors: -0.1 }, fin: { B: V(-0.2, 1.05, 0.35), A: V(0.25, 0.3, 0.1), tors: 0.3 } },
  amortie: { prep: { B: V(-0.5, 0.55, -0.05), A: V(0.2, 0.4, 0.35), tors: -0.45 }, impact: { B: V(-0.4, 0.3, 0.45), A: V(0.25, 0.35, 0.25), tors: -0.1 }, fin: { B: V(-0.3, 0.32, 0.5), A: V(0.25, 0.35, 0.2), tors: -0.05 } },
  service: { prep: { B: V(-0.3, 0.75, -0.3), A: V(0.12, 1.15, 0.3), tors: -0.55 }, impact: { B: V(-0.12, 1.12, 0.32), A: V(0.25, 0.45, 0.3), tors: 0.05 }, fin: { B: V(0.32, 0.12, 0.35), A: V(0.25, 0.2, 0.15), tors: 0.6 } },
};
GESTES.smash = GESTES.service;

/** Le nom du geste d'un coup, du côté où il se joue. */
const geste = (type, cote) => (type === 'slice' ? (cote === 'rv' ? 'sliceRv' : 'sliceCd') : type === 'volee' ? (cote === 'rv' ? 'voleeRv' : 'voleeCd')
  : type === 'lob' || type === 'amortie' || type === 'service' || type === 'smash' ? type : cote === 'rv' ? 'rv' : 'cd');

const melange = (a, b, t) => ({ B: a.B.clone().lerp(b.B, t), A: a.A.clone().lerp(b.A, t), tors: a.tors + (b.tors - a.tors) * t });

/** Où sont les mains et les épaules, à cet instant, pour ce joueur. */
function cibleGeste(p, balle) {
  if (p.anim) {
    const G = GESTES[geste(p.anim.type, p.anim.cote)];
    const u = Math.min(1, p.anim.t / 34);
    if (u < 0.1) return melange(G.prep, G.impact, doux(u / 0.1));
    if (u < 0.45) return melange(G.impact, G.fin, doux((u - 0.1) / 0.35));
    return melange(G.fin, PRET, doux((u - 0.45) / 0.55));
  }
  if (p.lance) {
    // Le lancer : la main gauche monte avec la balle, la raquette part derrière la tête.
    const k = Math.min(1, Math.max(0, (balle.z - 1.2) / 1.2));
    return melange({ B: V(-0.35, 0.35, 0.1), A: V(0.15, 0.4, 0.4), tors: -0.2 }, GESTES.service.prep, doux(k * 1.6));
  }
  if (p.prepa) {
    const cote = (balle.x - p.x) * sensDe(p.e) >= 0 ? 'cd' : 'rv';
    const G = GESTES[geste(balle.z > 2.15 && p.prepa.type !== 'lob' && p.prepa.type !== 'amortie' ? 'smash' : p.prepa.type, cote)];
    return melange(PRET, G.prep, doux(Math.min(1, p.prepa.t / 8 + 0.5)));
  }
  return PRET;
}

/* ---------------- Le rendu ---------------- */

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
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.3, 400);
  const court = creerCourt(scene, { qualite: q, surface: o.surface, couleurs: o.joueurs.map((j) => j.couleurs.maillot) });
  const figs = o.joueurs.map((j) => { const f = creerTennisman(j); scene.add(f.racine); return f; });
  if (q !== 'haute') for (const f of figs) f.racine.traverse((x) => { x.castShadow = false; });

  // La balle, son ombre, sa traînée.
  const balle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshLambertMaterial({ color: '#dff34a', emissive: '#4d5a00', emissiveIntensity: 0.5 }));
  balle.castShadow = q === 'haute';
  scene.add(balle);
  const ombre = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }));
  ombre.rotation.x = -Math.PI / 2;
  scene.add(ombre);
  const NT = 10;
  const trainee = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(NT).fill(0).map(() => V(0, 0, 0))), new THREE.LineBasicMaterial({ color: '#f4ff9a', transparent: true, opacity: 0.55 }));
  trainee.frustumCulled = false;
  scene.add(trainee);
  const passe = [];
  // Les traces des rebonds (sur terre battue, elles restent jusqu'au point suivant).
  const traces = [];
  const geoTrace = new THREE.CircleGeometry(1, 16);
  const marquer = (x, y, dehors = false) => {
    const m = new THREE.Mesh(geoTrace, new THREE.MeshBasicMaterial({ color: o.surface === 'terre' ? '#7a3518' : dehors ? '#ff4d3d' : '#ffffff', transparent: true, opacity: o.surface === 'terre' ? 0.55 : 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(0.055, 0.1, 1);
    m.position.set(x, 0.012, -y);
    m.vie = o.surface === 'terre' ? 99 : dehors ? 3 : 0.9;
    scene.add(m);
    traces.push(m);
  };
  // L'éclat d'une frappe pleine (et de l'ace).
  const texEclat = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const eclat = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEclat, color: '#fff4b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(eclat);
  // Les flashs des photographes, au bord du court.
  const flashs = [];
  for (let k = 0; k < 8; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEclat, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set((k % 2 ? 1 : -1) * (6 + (k % 3)), 0.6, (k < 4 ? 1 : -1) * (LONG + 3.5 + k % 2));
    s.scale.setScalar(0.9);
    scene.add(s); flashs.push(s);
  }
  // La fête : le trophée, les feux d'artifice.
  const trophee = creerTrophee();
  trophee.visible = false;
  trophee.scale.setScalar(1.4);
  scene.add(trophee);
  const feux = creerFeux(scene);

  /* ---------------- La caméra ---------------- */
  const cam = { mode: 'tele', pos: V(0, 7, LONG + 11), vise: V(0, 0.5, -2), secousse: 0, local: o.local ?? 0 };
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
    let pos, vise;
    if (cam.mode === 'libre' && cam.libre) { pos = cam.libre.pos.clone(); vise = cam.libre.vise.clone(); }
    else {
      // Derrière notre joueur, en hauteur, comme à la télévision ; elle suit un peu la balle de gauche à droite.
      const s = sensDe(cam.local);
      const b = v.balle, moi = v.joueurs[cam.local];
      const suit = (b && !b.tenue ? b.x * 0.45 : 0) * 0.5 + moi.x * 0.25;
      cam.cx = cam.cx === undefined || cam.saut ? suit : cam.cx + (suit - cam.cx) * Math.min(1, dt * 1.8);
      const portrait = camera.aspect < 1;
      const recul = portrait ? 1.55 : 1;
      pos = V(cam.cx, 7.4 * (portrait ? 1.35 : 1), s * (LONG + 10.5 * recul));
      vise = V(cam.cx * 0.6, 0.2, -s * (portrait ? 0.5 : 1.8));
    }
    const k = cam.mode === 'libre' ? 1 : Math.min(1, dt * 4);
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
  const POLE_D = V(-1, -0.7, -0.4), POLE_G = V(1, -0.7, -0.4);
  function afficher(v, dt) {
    temps += dt;
    excitation *= Math.pow(0.4, dt);
    placerCamera(v, dt);
    const b = v.balle || { x: 0, y: 0, z: -5, tenue: true };
    v.joueurs.forEach((p, i) => {
      const f = figs[i];
      const humeur = v.humeurs?.[i] || null;
      const vit = Math.hypot(p.vx || 0, p.vy || 0);
      const s = sensDe(p.e ?? i);
      // Il regarde vers le filet (ou ailleurs, dans une cinématique).
      const ang = p.regarde ?? Math.atan2(0, -s);
      const P = poseDe(f, { p: { etat: 'normal', frappe: 0, geste: 0, gesteType: 0, volee: 0 }, vitesse: vit * 1.15, sprint: vit > 6, t: temps, gardien: false, cote: 0, tab: false, charge: 0, humeur }, dt);
      // Prêt à frapper : les genoux fléchis, le buste penché.
      if (!humeur && vit < 2.5) { P.hancheA -= 0.25; P.hancheB -= 0.25; P.genouA += 0.45; P.genouB += 0.45; P.by = 0.86; P.torse += 0.18; }
      const C = humeur ? null : cibleGeste(p, b);
      f.torsion += ((C ? C.tors : 0) - f.torsion) * Math.min(1, dt * (p.anim ? 22 : 10));
      let da = ang + f.torsion * 0.85 - f.racine.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      f.racine.rotation.y += da * Math.min(1, dt * (p.anim ? 30 : 12));
      poser(f, P, Math.min(1, dt * 14));
      f.racine.position.set(p.x, 0, -p.y);
      if (C) {
        const k = Math.min(1, dt * (p.anim ? 26 : 12));
        f.main.B.lerp(C.B, k);
        f.main.A.lerp(C.A, k);
        poserBras(f.B, f.main.B, POLE_D);
        poserBras(f.A, f.main.A, POLE_G);
      }
      // La raquette prolonge l'avant-bras, le tamis de face (tourné d'un quart de tour autour du manche).
      f.raquette.rotation.set(-0.3, Math.PI / 2, 0);
    });
    // La balle.
    const visible = !!v.balle && !(v.balle.tenue && v.phase !== 'service');
    balle.visible = visible;
    ombre.visible = visible;
    if (visible) {
      let bx = b.x, by = b.y, bz = b.z;
      // Tenue dans la main du serveur.
      if (b.tenue) {
        const sv = figs[v.serveur ?? 0];
        sv.racine.updateMatrixWorld(true);
        const m = sv.A.coude.localToWorld(V(0, -0.36, 0.02));
        bx = m.x; by = -m.z; bz = m.y;
      }
      balle.position.set(bx, bz, -by);
      ombre.position.set(bx, 0.011, -by);
      ombre.material.opacity = Math.max(0.08, 0.4 - bz * 0.06);
      ombre.scale.setScalar(1 + bz * 0.25);
      passe.unshift(balle.position.clone());
      if (passe.length > NT) passe.length = NT;
    } else passe.length = 0;
    const pts = trainee.geometry.attributes.position;
    for (let k = 0; k < NT; k++) { const p = passe[Math.min(k, passe.length - 1)] || balle.position; pts.setXYZ(k, p.x, p.y, p.z); }
    pts.needsUpdate = true;
    trainee.visible = visible && !b.tenue && passe.length > 2;
    // Les traces, les éclats.
    for (let k = traces.length - 1; k >= 0; k--) {
      const t = traces[k];
      t.vie -= dt;
      if (t.vie < 0.5) t.material.opacity = Math.max(0, t.vie);
      if (t.vie <= 0) { scene.remove(t); t.material.dispose(); traces.splice(k, 1); }
    }
    for (const s of flashs) s.material.opacity = Math.max(0, s.material.opacity - dt * 6);
    if (eclat.material.opacity > 0) { eclat.material.opacity = Math.max(0, eclat.material.opacity - dt * 4); eclat.scale.multiplyScalar(1 + dt * 4); }
    court.maj(dt, Math.min(1, excitation));
    feux.maj(dt);
    renderer.render(scene, camera);
  }

  /** Ce qui se passe dans le match : des effets. */
  function evenements(evs, v) {
    for (const ev of evs) {
      if (ev.type === 'frappe') {
        const fort = (ev.vitesse || 0) > 105 || ev.coup === 'smash';
        if (fort) {
          eclat.position.copy(balle.position);
          eclat.scale.setScalar(0.35);
          eclat.material.opacity = 0.8;
        }
        if (ev.coup === 'smash') { cam.secousse = Math.max(cam.secousse, 0.08); excitation = Math.max(excitation, 0.7); }
      } else if (ev.type === 'rebond') {
        if (ev.n === 1) marquer(ev.x, ev.y);
      } else if (ev.type === 'point') {
        excitation = Math.max(excitation, ev.raison === 'ace' || ev.echange > 8 ? 1 : 0.6);
        if (ev.ou) marquer(ev.ou.x, ev.ou.y, true);
        if (ev.raison === 'ace' || ev.echange > 10) for (const s of flashs) if (Math.random() < 0.6) s.material.opacity = 1;
      } else if (ev.type === 'jeu' || ev.type === 'set') excitation = Math.max(excitation, ev.type === 'set' ? 1.3 : 0.8);
      else if (ev.type === 'fin') { excitation = 1.5; for (const s of flashs) s.material.opacity = 1; }
    }
    // Un nouveau point : le terrain est balayé (sauf les traces de la terre battue, qui restent un peu).
    if (evs.some((e) => e.type === 'lancer')) for (const t of traces) t.vie = Math.min(t.vie, o.surface === 'terre' ? 4 : t.vie);
  }

  const proj = V(0, 0, 0);
  return {
    afficher,
    evenements,
    dimensionner,
    versEcran(x, y, z = 0) {
      proj.set(x, z, -y).project(camera);
      return { x: (proj.x * 0.5 + 0.5) * largeur, y: (-proj.y * 0.5 + 0.5) * hauteur };
    },
    /** Le côté de la caméra : derrière ce joueur. */
    local(e) { cam.local = e; },
    camera(mode, saut = false) { if (cam.mode !== mode || saut) { cam.mode = mode; cam.saut = saut; } },
    cadrer(pos, vise, saut = false) {
      cam.libre = { pos: V(pos[0], pos[2], -pos[1]), vise: V(vise[0], vise[2], -vise[1]) };
      if (cam.mode !== 'libre' || saut) cam.saut = saut;
      cam.mode = 'libre';
    },
    flash() { for (const s of flashs) s.material.opacity = 1; },
    /** Le trophée : en (x, y) du moteur, à la hauteur h ; null pour le cacher. */
    trophee(t) { trophee.visible = !!t; if (t) { trophee.position.set(t.x, t.h, -t.y); trophee.rotation.y = Math.sin(performance.now() / 600) * 0.4; } },
    feuArtifice(couleurs) { feux.lancer((Math.random() - 0.5) * 30, 14 + Math.random() * 5, -LONG - 10 - Math.random() * 8, couleurs); },
    ecran: court.ecran,
    secouer(f) { cam.secousse = Math.max(cam.secousse, f); },
    /** Pour les essais : où sont la raquette et la main de chacun, où est la caméra. */
    etat: () => ({
      camera: camera.position.toArray().map((x) => +x.toFixed(2)),
      joueurs: figs.map((f) => ({ racine: f.racine.position.toArray().map((x) => +x.toFixed(2)), raquette: f.raquette.localToWorld(V(0, -0.39, 0)).toArray().map((x) => +x.toFixed(2)) })),
      balle: balle.position.toArray().map((x) => +x.toFixed(2)),
    }),
    qualite: q,
    detruire() {
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((x) => { x.geometry?.dispose?.(); });
    },
  };
}
