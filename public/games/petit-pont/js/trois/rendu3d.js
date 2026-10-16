/**
 * PETIT PONT — le match en 3D.
 *
 * Ce module ne joue pas : il montre une « vue » du match (la position de
 * chacun, son état, le ballon), qu'elle vienne du moteur en direct ou du
 * ralenti enregistré. Il s'occupe de la caméra (vue télé, gros plan sur le
 * buteur, ralenti au ras du sol, derrière le tireur pendant les tirs au but),
 * des effets (confettis, traînée des frappes, poussière des tacles, filet qui
 * se gonfle, public qui saute) et de projeter un point du terrain sur l'écran
 * (pour l'interface : la jauge de frappe, le nom du joueur dirigé).
 *
 * Repère : moteur (x, y, z) → 3D (x, z, -y).
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';
import { creerJoueur, poseDe, poser } from './joueurs3d.js';
import { creerStade } from './stade3d.js';

export { THREE };

/** La qualité graphique : réglée par le joueur, devinée la première fois. */
const CLE_QUALITE = 'petitpont.qualite';
export function qualite() {
  try { const q = localStorage.getItem(CLE_QUALITE); if (q) return q; } catch { /* ignore */ }
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return mobile ? 'moyenne' : 'haute';
}
export function reglerQualite(q) { try { localStorage.setItem(CLE_QUALITE, q); } catch { /* ignore */ } }

const R_BALLON = 0.17;
const COUL_HUMAINS = ['#ffd23f', '#4fd2ff'];

/** Le ballon : un polyèdre à facettes, pentagones noirs. */
function creerBallon() {
  const g = new THREE.IcosahedronGeometry(R_BALLON, 2).toNonIndexed();
  const base = new THREE.IcosahedronGeometry(1, 0);
  const sommets = [];
  const bp = base.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const v = new THREE.Vector3(bp.getX(i), bp.getY(i), bp.getZ(i)).normalize();
    if (!sommets.some((s) => s.distanceTo(v) < 1e-3)) sommets.push(v);
  }
  const p = g.attributes.position;
  const cols = [];
  for (let i = 0; i < p.count; i += 3) {
    const c = new THREE.Vector3();
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3(p.getX(i + k), p.getY(i + k), p.getZ(i + k)));
    c.normalize();
    const noir = sommets.some((s) => s.dot(c) > 0.965);
    for (let k = 0; k < 3; k++) cols.push(...(noir ? [0.08, 0.08, 0.1] : [0.97, 0.97, 0.95]));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.castShadow = true;
  return m;
}

let texOmbre = null;
function ombreTexture() {
  if (texOmbre) return texOmbre;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  texOmbre = new THREE.CanvasTexture(c);
  return texOmbre;
}
function ombre(taille) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(taille, taille), new THREE.MeshBasicMaterial({ map: ombreTexture(), transparent: true, depthWrite: false }));
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
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 700);
  const stade = creerStade(scene, o.stade, { qualite: q, equipes: o.equipes, kits: o.kits });

  // Les joueurs.
  const figs = [];
  for (let e = 0; e < 2; e++) {
    for (let i = 0; i < 5; i++) {
      const j = o.equipes[e].joueurs[i];
      const f = creerJoueur({ kit: o.kits[e], numero: j.numero, nom: j.nom, gardien: i === 0 ? o.equipes[e].gardien : null });
      f.racine.scale.setScalar(1.12);
      f.ombre = ombre(1.3);
      scene.add(f.racine, f.ombre);
      figs.push(f);
    }
  }
  if (q !== 'haute') for (const f of figs) f.racine.traverse((x) => { x.castShadow = false; });
  // Le ballon, son ombre, sa traînée.
  const ballon = creerBallon();
  const ombreB = ombre(0.6);
  scene.add(ballon, ombreB);
  const trainee = [];
  const texTrainee = texRond('rgba(255,255,255,1)');
  for (let k = 0; k < 10; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texTrainee, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.4);
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
    fl.rotation.x = Math.PI; fl.position.y = 2.35;
    g.add(r, fl);
    g.visible = false;
    g.fleche = fl;
    scene.add(g);
    return g;
  });

  // Les confettis (un seul nuage de points).
  const NCONF = q === 'basse' ? 160 : 420;
  const confPos = new Float32Array(NCONF * 3), confVit = new Float32Array(NCONF * 3), confCol = new Float32Array(NCONF * 3);
  const confGeo = new THREE.BufferGeometry();
  confGeo.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
  confGeo.setAttribute('color', new THREE.BufferAttribute(confCol, 3));
  const confettis = new THREE.Points(confGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false }));
  confettis.visible = false;
  scene.add(confettis);
  let confVie = 0;
  // Les nuages de poussière (tacles, plongeons).
  const texPoussiere = texRond('rgba(235,225,200,.9)');
  const poussieres = [];
  const poussiere = (x, z, n = 6, couleur = '#e8dcc0') => {
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPoussiere, color: couleur, transparent: true, opacity: 0.6, depthWrite: false }));
      s.position.set(x + (Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.2, z + (Math.random() - 0.5) * 0.6);
      s.scale.setScalar(0.4);
      s.v = new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.5 + Math.random(), (Math.random() - 0.5) * 1.5);
      s.vie = 0.6 + Math.random() * 0.3;
      scene.add(s);
      poussieres.push(s);
    }
  };
  // L'éclair d'une frappe.
  const eclair = new THREE.Sprite(new THREE.SpriteMaterial({ map: texRond('rgba(255,250,220,1)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(eclair);

  /* ---------------- La caméra ---------------- */
  const cam = { mode: 'tele', cx: 0, cz: 0, pos: new THREE.Vector3(0, 14, 26), vise: new THREE.Vector3(0, 0, 0), secousse: 0, zoom: 1 };
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

  /** La distance de la caméra télé : on veut voir ~30 m de large (moins sur un écran en hauteur). */
  function distanceTele() {
    const a = camera.aspect;
    const couvre = Math.max(17, 31 * Math.min(1, a / 1.65)) * cam.zoom;
    return couvre / 2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * a);
  }

  function placerCamera(v, dt) {
    const b = v.ballon;
    const bx = b.x, bz = -b.y;
    const k = Math.min(1, dt * 3.2);
    let pos, vise;
    if (cam.mode === 'tab') {
      // Derrière le tireur, un peu de côté : on voit le but, le gardien et la frappe.
      pos = new THREE.Vector3(8.2, 3, 3.4);
      vise = new THREE.Vector3(20, 0.9, -0.5);
    } else if (cam.mode === 'but' && v.heros >= 0) {
      const h = v.joueurs[v.heros];
      const hx = h.x, hz = -h.y;
      pos = new THREE.Vector3(hx - Math.sign(hx || 1) * 3.5, 3.2, hz + 7.5);
      vise = new THREE.Vector3(hx, 1.1, hz);
    } else if (cam.mode === 'ralenti') {
      const s = bx >= 0 ? 1 : -1;
      pos = new THREE.Vector3(bx - s * 7, 2.6, bz + 6.5);
      pos.x = THREE.MathUtils.clamp(pos.x, -24, 24);
      vise = new THREE.Vector3(bx, Math.max(0.6, b.z), bz);
    } else {
      const d = distanceTele();
      const demi = (d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const lim = Math.max(0, 21 - demi + 1.5);
      cam.cx += (THREE.MathUtils.clamp(bx * 0.92 + b.vx * 0.25, -lim, lim) - cam.cx) * k;
      cam.cz += (THREE.MathUtils.clamp(bz * 0.3, -2.5, 2.5) - cam.cz) * k;
      vise = new THREE.Vector3(cam.cx, 0, cam.cz + 0.9);
      pos = new THREE.Vector3(cam.cx, Math.sin(0.58) * d, cam.cz + 0.9 + Math.cos(0.58) * d);
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
  const vBallon = new THREE.Vector3();
  const axe = new THREE.Vector3(), quat = new THREE.Quaternion();

  /**
   * Montre une vue du match.
   * v : { joueurs: [{ x, y, vx, vy, dx, dy, etat, frappe, charge, haut, vyPlonge }], ballon: { x, y, z, vx, vy, vz, porteur },
   *       phase, actifs: [i0, i1] (-1 si personne), humeurs: [..10] , heros, tab }
   * dt : secondes (de rendu) ; ralenti : le temps du jeu va plus lentement.
   */
  function afficher(v, dt, vitesseJeu = 1) {
    temps += dt;
    excitation *= Math.pow(0.35, dt);
    placerCamera(v, dt);
    const dtj = dt * vitesseJeu;
    // Les joueurs.
    v.joueurs.forEach((p, i) => {
      const f = figs[i];
      const vit = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      f.racine.position.set(p.x, 0, -p.y);
      const ang = Math.atan2(p.dx, -p.dy);
      // Le plongeon du gardien : de quel côté, dans son propre repère ?
      let cote = 0;
      if (p.etat === 'plonge') {
        const lx = Math.cos(ang), lz = -Math.sin(ang);
        cote = Math.sign((0 * lx) + (-(p.vyPlonge || 0)) * lz) || 1;
      }
      // Il se tourne en douceur (le moteur garde la direction exacte).
      let da = ang - f.racine.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      f.racine.rotation.y += da * Math.min(1, dtj * 16);
      // La roulette : un tour complet sur lui-même.
      if (p.spin) f.racine.rotation.y = ang + p.spin * Math.PI * 2;
      const pose = poseDe(f, { p, vitesse: vit, sprint: vit > 6.9, t: temps, gardien: (i % 5) === 0, cote, humeur: v.humeurs?.[i] || null, tab: v.tab, charge: p.charge }, dtj);
      poser(f, pose, Math.min(1, dtj * (vit > 0.4 ? 22 : 12)));
      f.ombre.position.set(p.x, 0.012, -p.y);
      const allonge = p.etat === 'plonge' || p.etat === 'sol' || p.etat === 'tacle';
      f.ombre.scale.set(allonge ? 1.6 : 1, 1, allonge ? 1.6 : 1);
    });
    // Les joueurs dirigés.
    anneaux.forEach((a, n) => {
      const i = v.actifs?.[n] ?? -1;
      a.visible = i >= 0 && v.phase !== 'tab' && v.phase !== 'but';
      if (!a.visible) return;
      const p = v.joueurs[i];
      a.position.set(p.x, 0, -p.y);
      a.fleche.position.y = 2.35 + Math.sin(temps * 6) * 0.08;
      a.fleche.rotation.y += dt * 3;
    });
    // Le ballon : il roule (la rotation suit sa vitesse).
    const b = v.ballon;
    ballon.position.set(b.x, b.z + R_BALLON, -b.y);
    // Pendant la roulette, le ballon reste collé à la semelle et tourne avec le joueur.
    const porteurV = b.porteur >= 0 ? v.joueurs[b.porteur] : null;
    if (porteurV && porteurV.spin) {
      const a0 = Math.atan2(porteurV.dx, -porteurV.dy) + porteurV.spin * Math.PI * 2;
      ballon.position.set(porteurV.x + Math.sin(a0) * 0.32, R_BALLON, -porteurV.y + Math.cos(a0) * 0.32);
    }
    vBallon.set(b.vx, 0, -b.vy);
    const sp = vBallon.length();
    if (sp > 0.05) {
      axe.set(0, 1, 0).cross(vBallon).normalize();
      quat.setFromAxisAngle(axe, (sp * dtj) / R_BALLON);
      ballon.quaternion.premultiply(quat);
    }
    ombreB.position.set(b.x, 0.013, -b.y);
    const ho = 1 / (1 + b.z * 0.6);
    ombreB.scale.set(ho, 1, ho);
    ombreB.material.opacity = ho;
    // La traînée des balles qui fusent.
    historique.unshift(ballon.position.clone());
    if (historique.length > trainee.length) historique.pop();
    const vite = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz) > 15 && b.porteur < 0;
    trainee.forEach((s, k) => {
      const p = historique[k];
      s.visible = !!p && vite;
      if (!s.visible) return;
      s.position.copy(p);
      s.material.opacity = 0.45 * (1 - k / trainee.length);
      s.scale.setScalar(0.38 * (1 - k / trainee.length * 0.6));
    });
    // Les effets.
    if (eclair.material.opacity > 0) { eclair.material.opacity = Math.max(0, eclair.material.opacity - dt * 5); eclair.scale.multiplyScalar(1 + dt * 6); }
    for (let k = poussieres.length - 1; k >= 0; k--) {
      const s = poussieres[k];
      s.vie -= dt;
      s.position.addScaledVector(s.v, dt);
      s.v.multiplyScalar(Math.pow(0.1, dt));
      s.scale.multiplyScalar(1 + dt * 1.8);
      s.material.opacity = Math.max(0, s.vie) * 0.9;
      if (s.vie <= 0) { scene.remove(s); s.material.dispose(); poussieres.splice(k, 1); }
    }
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
    stade.maj(dt, Math.min(1, excitation));
    renderer.render(scene, camera);
  }

  /** Ce qui se passe dans le match : des effets à déclencher. */
  function evenements(evs, v) {
    for (const ev of evs) {
      const b = v.ballon;
      switch (ev.type) {
        case 'tir':
          eclair.position.set(b.x, b.z + 0.3, -b.y); eclair.scale.setScalar(0.6 + ev.puissance); eclair.material.opacity = 0.9;
          excitation = Math.max(excitation, 0.25);
          if (ev.puissance > 0.8) cam.secousse = Math.max(cam.secousse, 0.08);
          if (ev.geste === 'volee') { cam.secousse = Math.max(cam.secousse, 0.2); excitation = Math.max(excitation, 0.7); }
          break;
        case 'but': {
          excitation = 1.6;
          cam.secousse = 0.5;
          const cote = b.x > 0 ? 0 : 1;
          stade.buts[cote].gonfle = 1;
          lancerConfettis(b.x > 0 ? 1 : -1, ev.equipe);
          break;
        }
        case 'poteau': cam.secousse = Math.max(cam.secousse, 0.18); excitation = Math.max(excitation, 0.6); break;
        case 'geste': excitation = Math.max(excitation, ev.nom === 'arc-en-ciel' ? 0.9 : 0.5); if (ev.nom === 'arc-en-ciel') cam.secousse = Math.max(cam.secousse, 0.06); break;
        case 'filet': { const cote = b.x > 0 ? 0 : 1; stade.buts[cote].gonfle = Math.max(stade.buts[cote].gonfle, 0.6); break; }
        case 'arret': excitation = Math.max(excitation, 0.5); break;
        case 'tacle': if (ev.reussi) { const p = v.joueurs[ev.joueur]; poussiere(p.x, -p.y, 7, o.stade === 'plage' ? '#f0d9a8' : o.stade === 'halle' ? '#d8c8b0' : '#cfe0b0'); } break;
        case 'glisse': { const p = v.joueurs[ev.joueur]; poussiere(p.x, -p.y, 4, o.stade === 'plage' ? '#f0d9a8' : '#cfe0b0'); break; }
        case 'plonge': { const p = v.joueurs[ev.joueur]; poussiere(p.x, -p.y, 4); break; }
        case 'tab-but': excitation = 1.2; stade.buts[0].gonfle = 1; break;
        default:
      }
    }
  }

  function lancerConfettis(cote, e) {
    const k = o.kits[e];
    const cols = [k.fond, k.motifC, k.short, '#ffffff', '#ffd23f'].map((c) => new THREE.Color(c));
    for (let i = 0; i < NCONF; i++) {
      confPos[i * 3] = cote * (17 + Math.random() * 5);
      confPos[i * 3 + 1] = 6 + Math.random() * 6;
      confPos[i * 3 + 2] = (Math.random() - 0.5) * 22;
      confVit[i * 3] = (Math.random() - 0.5) * 4 - cote * 2;
      confVit[i * 3 + 1] = Math.random() * 3;
      confVit[i * 3 + 2] = (Math.random() - 0.5) * 4;
      const c = cols[i % cols.length];
      confCol[i * 3] = c.r; confCol[i * 3 + 1] = c.g; confCol[i * 3 + 2] = c.b;
    }
    confGeo.attributes.color.needsUpdate = true;
    confVie = 5;
    confettis.visible = true;
  }

  const proj = new THREE.Vector3();
  return {
    afficher,
    evenements,
    dimensionner,
    /** Un point du terrain (repère du moteur) → un point de l'écran, en pixels. */
    versEcran(x, y, z = 0) {
      proj.set(x, z, -y).project(camera);
      return { x: (proj.x * 0.5 + 0.5) * largeur, y: (-proj.y * 0.5 + 0.5) * hauteur, devant: proj.z < 1 };
    },
    camera(mode, saut = false) { if (cam.mode !== mode) { cam.mode = mode; cam.saut = saut; } },
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
