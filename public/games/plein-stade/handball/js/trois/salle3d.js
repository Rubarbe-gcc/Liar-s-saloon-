/**
 * ROUCOULETTE — les salles en 3D : le terrain et ses lignes (la zone des 6 m,
 * la ligne des 9 m en pointillés), les deux buts rayés rouge et blanc avec
 * leurs filets qui se gonflent, les gradins et leur public qui saute.
 *
 *   arene    : l'Arène, une grande salle dans la pénombre, un cube d'écrans suspendu ;
 *   gymnase  : le Gymnase du quartier, clair, une seule tribune en bois ;
 *   plage    : la Plage, du sable, en plein air au coucher du soleil.
 *
 * La foule, les gradins et l'écran viennent du basket (basket/js/trois/salle3d.js).
 * Repère : moteur (x, y, z) → 3D (x, z, -y).
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { ecussonImage, nuance } from '../../../commun/ecusson.js';
import { foule, gradins, couleursPublic, texCanvas, cubeSuspendu, ecranTexture, lambert, basique, boite } from '../../../basket/js/trois/salle3d.js';

const L = 20, W = 10, DEMI_BUT = 1.5, BUT_H = 2;

export const SALLES = [
  { id: 'arene', nom: 'L’Arène', desc: 'La grande salle, dans la pénombre.' },
  { id: 'gymnase', nom: 'Le Gymnase', desc: 'La salle du quartier, pleine de lumière.' },
  { id: 'plage', nom: 'La Plage', desc: 'Sur le sable, au coucher du soleil.' },
];
export const SALLE = Object.fromEntries(SALLES.map((s) => [s.id, s]));

function alea(graine) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
}
function ciel(scene, haut, horizon, bas = horizon) {
  const g = new THREE.SphereGeometry(400, 24, 12);
  const cols = [];
  const ch = new THREE.Color(haut), co = new THREE.Color(horizon), cb = new THREE.Color(bas);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 400;
    const c = y > 0 ? co.clone().lerp(ch, Math.pow(y, 0.6)) : co.clone().lerp(cb, Math.min(1, -y * 3));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  m.renderOrder = -10;
  scene.add(m);
}

/* ------------------------------------------------------------------ */
/* Le terrain                                                          */
/* ------------------------------------------------------------------ */

const MARGE = 2.2;

/** La ligne à `r` du but (deux quarts de cercle autour des poteaux, un trait entre les deux). */
function tracerZone(g, X, Y, px, s, r) {
  const gx = s * L;
  g.beginPath();
  // Du côté +y : le quart de cercle autour du poteau (gx, 1,5), de la ligne de but vers le terrain.
  if (s > 0) {
    g.arc(X(gx), Y(DEMI_BUT), r * px, -Math.PI / 2, -Math.PI, true);
    g.lineTo(X(gx - r), Y(-DEMI_BUT));
    g.arc(X(gx), Y(-DEMI_BUT), r * px, Math.PI, Math.PI / 2, true);
  } else {
    g.arc(X(gx), Y(DEMI_BUT), r * px, -Math.PI / 2, 0, false);
    g.lineTo(X(gx + r), Y(-DEMI_BUT));
    g.arc(X(gx), Y(-DEMI_BUT), r * px, 0, Math.PI / 2, false);
  }
}

/** Le terrain et ses lignes, dessinés sur une toile (vu de dessus, x vers la droite, y vers le haut). */
function dessinerTerrain(g, w, h, style) {
  const lx = L + MARGE, ly = W + MARGE;
  const px = w / (2 * lx);
  const X = (x) => (x + lx) * px, Y = (y) => (ly - y) * px;
  const R = alea(3);
  if (style.sable) {
    // Le sable : un beige plein de grains.
    g.fillStyle = style.sol; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 26000; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,230' : '120,90,50'},${0.05 + R() * 0.1})`; g.fillRect(R() * w, R() * h, 2, 2); }
    for (let k = 0; k < 60; k++) { g.strokeStyle = 'rgba(120,90,50,.08)'; g.lineWidth = 6 + R() * 10; g.beginPath(); g.arc(R() * w, R() * h, 20 + R() * 90, 0, Math.PI * 2); g.stroke(); }
  } else {
    // Le pourtour, puis le terrain (une couleur pleine, un léger grain), puis les zones.
    g.fillStyle = style.pourtour; g.fillRect(0, 0, w, h);
    if (style.bois) {
      const latte = 0.2 * px;
      for (let y = 0; y < h; y += latte) {
        let x = -R() * 300;
        while (x < w) { const long = (1.2 + R() * 1.6) * px; const t = R(); g.fillStyle = style.bois[t < 0.33 ? 0 : t < 0.66 ? 1 : 2]; g.fillRect(x, y, long, latte); g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x, y, 1.5, latte); x += long; }
      }
      g.fillStyle = 'rgba(0,0,0,.15)';
      g.fillRect(0, 0, w, Y(W)); g.fillRect(0, Y(-W), w, h - Y(-W)); g.fillRect(0, 0, X(-L), h); g.fillRect(X(L), 0, w - X(L), h);
      g.globalAlpha = 0.78;
    }
    g.fillStyle = style.terrain; g.fillRect(X(-L), Y(W), 2 * L * px, 2 * W * px);
    g.globalAlpha = 1;
    for (let k = 0; k < 7000; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + R() * 0.03})`; g.fillRect(X(-L) + R() * 2 * L * px, Y(W) + R() * 2 * W * px, 2, 2); }
  }
  // Les zones des 6 m, en couleur.
  for (const s of [-1, 1]) {
    g.fillStyle = style.zone;
    tracerZone(g, X, Y, px, s, 6);
    g.lineTo(X(s * L), Y(DEMI_BUT + 6)); g.lineTo(X(s * L), Y(-DEMI_BUT - 6));
    g.closePath();
    g.fill();
  }
  // Les lignes.
  g.strokeStyle = style.lignes || '#ffffff';
  g.lineWidth = 0.08 * px;
  g.strokeRect(X(-L), Y(W), 2 * L * px, 2 * W * px);
  g.beginPath(); g.moveTo(X(0), Y(W)); g.lineTo(X(0), Y(-W)); g.stroke();
  for (const s of [-1, 1]) {
    tracerZone(g, X, Y, px, s, 6); g.stroke();
    // La ligne des 9 m, en pointillés (elle s'arrête aux lignes de côté).
    g.save();
    g.beginPath(); g.rect(X(-L), Y(W), 2 * L * px, 2 * W * px); g.clip();
    g.setLineDash([0.15 * px, 0.15 * px]);
    tracerZone(g, X, Y, px, s, 9); g.stroke();
    g.restore();
    // Le point des 7 m, la ligne des 4 m du gardien.
    g.beginPath(); g.moveTo(X(s * (L - 7)), Y(0.5)); g.lineTo(X(s * (L - 7)), Y(-0.5)); g.stroke();
    g.beginPath(); g.moveTo(X(s * (L - 4)), Y(0.075)); g.lineTo(X(s * (L - 4)), Y(-0.075)); g.stroke();
  }
  // Le rond central (un petit, pour l'engagement).
  g.beginPath(); g.arc(X(0), Y(0), 1.5 * px, 0, Math.PI * 2); g.stroke();
}

function terrain(scene, style, qualite, eq) {
  const lx = L + MARGE, ly = W + MARGE;
  const l = qualite === 'basse' ? 1024 : 2048;
  const tex = texCanvas(l, Math.round((l * ly) / lx), (g, w, h) => dessinerTerrain(g, w, h, style));
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(2 * lx, 2 * ly), new THREE.MeshLambertMaterial({ map: tex }));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);
  if (!style.sable) {
    const vernis = new THREE.Mesh(new THREE.PlaneGeometry(2 * L, 2 * W), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.045, depthWrite: false }));
    vernis.rotation.x = -Math.PI / 2; vernis.position.y = 0.005;
    scene.add(vernis);
  }
  // L'écusson du club qui reçoit, au centre.
  ecussonImage(eq, 256).then((img) => {
    if (!img) return;
    const t = texCanvas(256, 256, (g) => { g.globalAlpha = style.sable ? 0.55 : 0.85; g.drawImage(img, 28, 18, 200, 220); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.01;
    scene.add(m);
  });
}

/* ------------------------------------------------------------------ */
/* Les buts                                                            */
/* ------------------------------------------------------------------ */

/** Une texture rayée (les poteaux de handball : des bandes de 20 cm). */
function texRayee(c1, c2) {
  const t = texCanvas(16, 128, (g, w, h) => { for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? c2 : c1; g.fillRect(0, (k * h) / 10, w, h / 10); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function but(scene, s, style) {
  const g = new THREE.Group();
  const raye = new THREE.MeshLambertMaterial({ map: texRayee(style.poteau || '#e8302a', '#f6f6f2') });
  const rayeB = new THREE.MeshLambertMaterial({ map: texRayee(style.poteau || '#e8302a', '#f6f6f2') });
  rayeB.map.repeat.set(1, 1.5);
  const poteau = new THREE.BoxGeometry(0.08, BUT_H, 0.08);
  for (const t of [-1, 1]) { const p = new THREE.Mesh(poteau, raye); p.position.set(0.04, BUT_H / 2, t * (DEMI_BUT + 0.04)); p.castShadow = true; g.add(p); }
  const barre = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2 * DEMI_BUT + 0.16), rayeB);
  barre.position.set(0.04, BUT_H + 0.04, 0); barre.castShadow = true;
  g.add(barre);
  // Le filet : un quadrillage (en lignes), qui se gonfle quand le ballon y entre.
  const filet = new THREE.Group();
  const pts = [];
  const P = 0.9, PH = 0.7, H = BUT_H, D = DEMI_BUT, pasF = 0.12;
  const profondeur = (y) => PH + (P - PH) * (1 - y / H);
  for (let z = -D; z <= D + 1e-6; z += pasF) pts.push(profondeur(0), 0, z, profondeur(H), H, z);
  for (let y = 0; y <= H + 1e-6; y += pasF) pts.push(profondeur(y), y, -D, profondeur(y), y, D);
  for (const t of [-1, 1]) {
    for (let x = 0; x <= P + 1e-6; x += pasF) pts.push(x, 0, t * D, Math.min(x, PH), H, t * D);
    for (let y = 0; y <= H + 1e-6; y += pasF) pts.push(0, y, t * D, profondeur(y), y, t * D);
  }
  for (let x = 0; x <= PH + 1e-6; x += pasF) pts.push(x, H, -D, x, H, D);
  for (let z = -D; z <= D + 1e-6; z += pasF) pts.push(0, H, z, PH, H, z);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  filet.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: '#f2f2f2', transparent: true, opacity: 0.6 })));
  g.add(filet);
  const fond = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.05), basique('#0b0d10', { transparent: true, opacity: 0.3 }));
  fond.position.set(P + 0.02, 1.02, 0); fond.rotation.y = -Math.PI / 2;
  g.add(fond);
  g.position.x = s * L;
  if (s < 0) g.rotation.y = Math.PI;
  scene.add(g);
  return { g, filet, gonfle: 0, tremble: 0, t: 0 };
}

/* ------------------------------------------------------------------ */
/* La salle                                                            */
/* ------------------------------------------------------------------ */

export function creerSalle(scene, id, { qualite, equipes, kits }) {
  const R = alea(id.length * 97 + 13);
  const publicCouleurs = couleursPublic(kits);
  const hemi = new THREE.HemisphereLight('#ffffff', '#554433', 1.2);
  scene.add(hemi);
  const lampe = new THREE.DirectionalLight('#ffffff', 2.2);
  lampe.position.set(-8, 34, 14);
  scene.add(lampe, lampe.target);
  if (qualite === 'haute') {
    lampe.castShadow = true;
    lampe.shadow.mapSize.set(2048, 2048);
    const c = lampe.shadow.camera;
    c.left = -26; c.right = 26; c.top = 16; c.bottom = -16; c.near = 5; c.far = 90;
    lampe.shadow.bias = -0.0008;
  }
  const out = { buts: [], foule: null, ecran: null };
  const eq = equipes[0];

  if (id === 'gymnase') {
    const style = { bois: ['#e2b57c', '#dcae73', '#e8bd86'], pourtour: '#d9aa70', terrain: '#3f8f5a', zone: '#e6a23c', poteau: '#1d4fa0' };
    scene.background = new THREE.Color('#d9d2c4');
    scene.fog = new THREE.Fog('#d9d2c4', 60, 140);
    hemi.color.set('#fffaf0'); hemi.groundColor.set('#a08060'); hemi.intensity = 1.5;
    lampe.intensity = 1.8;
    terrain(scene, style, qualite, eq);
    out.buts = [but(scene, 1, style), but(scene, -1, style)];
    // Les murs : peints en bas, des fenêtres en haut, la charpente.
    const mur = lambert('#e9e2d2'), bas = lambert(nuance(eq.maillot.fond, -0.25));
    scene.add(boite(64, 13, 0.4, mur, 0, 6.5, -18), boite(64, 2.2, 0.42, bas, 0, 1.1, -17.98));
    scene.add(boite(0.4, 13, 38, mur, -27, 6.5, 0), boite(0.4, 13, 38, mur, 27, 6.5, 0));
    const vitre = basique('#cfe8ff');
    for (let k = -5; k <= 5; k++) scene.add(boite(3.4, 2.4, 0.1, vitre, k * 5.4, 9.4, -17.75));
    for (let k = -4; k <= 4; k++) scene.add(boite(0.35, 0.6, 38, lambert('#8a6a48'), k * 6.5, 12.6, 0));
    const bois = lambert('#b98a55');
    const places = gradins(scene, bois, { x0: -19, x1: 19, z0: -12.4, sens: -1, rangs: 6, base: 0.45, hauteur: 0.42 });
    out.foule = foule(scene, places, publicCouleurs, qualite);
    // Les bancs des remplaçants, de l'autre côté.
    for (const s of [-1, 1]) scene.add(boite(6, 0.45, 0.5, bois, s * 7, 0.22, 11.6));
    const { t, ecrire } = ecranTexture(7, 2.6);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshBasicMaterial({ map: t }));
    e.position.set(0, 9.2, -17.7);
    scene.add(boite(7.4, 3, 0.2, lambert('#202226'), 0, 9.2, -17.82), e);
    out.ecran = ecrire;
  } else if (id === 'plage') {
    const style = { sable: true, sol: '#e6cf9a', zone: 'rgba(255,120,60,.18)', lignes: '#1f6fd0', poteau: '#ff8a1a' };
    ciel(scene, '#2a2a6a', '#ff9a6a', '#3a2a40');
    scene.fog = new THREE.Fog('#c07a6a', 70, 280);
    hemi.color.set('#ffe0c0'); hemi.groundColor.set('#6a5040'); hemi.intensity = 1.3;
    lampe.color.set('#ffd6a8'); lampe.intensity = 2.1; lampe.position.set(-34, 20, -24);
    scene.add(boite(200, 0.1, 140, lambert('#d8be86'), 0, -0.06, 0));
    terrain(scene, style, qualite, eq);
    out.buts = [but(scene, 1, style), but(scene, -1, style)];
    // La mer, au loin, et le soleil qui se couche.
    const mer = new THREE.Mesh(new THREE.PlaneGeometry(600, 200), new THREE.MeshLambertMaterial({ color: '#3a5a8a' }));
    mer.rotation.x = -Math.PI / 2; mer.position.set(0, -0.02, -140);
    scene.add(mer);
    const soleil = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: '#ffb070', fog: false }));
    soleil.position.set(-60, 14, -300);
    scene.add(soleil);
    // Les drapeaux et les cordes qui ferment le terrain.
    const corde = lambert('#f4f4f4');
    for (const z of [-W - 1.6, W + 1.6]) scene.add(boite(2 * L + 4, 0.04, 0.04, corde, 0, 0.9, -z));
    for (let x = -L - 2; x <= L + 2; x += 4.4) for (const z of [-W - 1.6, W + 1.6]) {
      scene.add(boite(0.06, 1.4, 0.06, lambert('#5a4030'), x, 0.7, -z));
      const d = boite(0.5, 0.32, 0.02, lambert([kits[0].fond, kits[1].fond][Math.floor(R() * 2)]), x + 0.27, 1.25, -z);
      scene.add(d);
    }
    // Des palmiers (un tronc, des palmes).
    for (let k = 0; k < 10; k++) {
      const x = -50 + k * 11 + R() * 4, z = -24 - R() * 12;
      const h = 6 + R() * 4;
      const tronc = boite(0.4, h, 0.4, lambert('#7a5a3a'), x, h / 2, z);
      tronc.rotation.z = (R() - 0.5) * 0.2;
      scene.add(tronc);
      for (let f = 0; f < 6; f++) {
        const palme = boite(3.2, 0.06, 0.7, lambert('#2f7a3a'), x, h, z);
        palme.rotation.y = (f / 6) * Math.PI * 2;
        palme.rotation.z = -0.35;
        palme.geometry.translate(1.5, 0, 0);
        scene.add(palme);
      }
    }
    // Le public : sur des gradins de bois, d'un côté.
    const bois = lambert('#8a6a4a');
    const places = gradins(scene, bois, { x0: -20, x1: 20, z0: -12.6, sens: -1, rangs: 5, base: 0.4, hauteur: 0.45 });
    out.foule = foule(scene, places, publicCouleurs, qualite);
    const { t, ecrire } = ecranTexture(6, 2.4);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), new THREE.MeshBasicMaterial({ map: t }));
    e.position.set(0, 6.4, -16.2);
    scene.add(boite(0.25, 6.4, 0.25, lambert('#2a2c30'), -2.6, 3.2, -16.4), boite(0.25, 6.4, 0.25, lambert('#2a2c30'), 2.6, 3.2, -16.4), boite(6.4, 2.8, 0.2, lambert('#202226'), 0, 6.4, -16.32), e);
    out.ecran = ecrire;
  } else {
    // L'Arène : la pénombre, le terrain bleu sous les projecteurs, des tribunes tout autour.
    const style = { pourtour: '#c9572c', terrain: '#1f5fae', zone: '#e8742c', poteau: '#e8302a' };
    scene.background = new THREE.Color('#07080d');
    scene.fog = new THREE.Fog('#07080d', 55, 130);
    hemi.color.set('#d8dcff'); hemi.groundColor.set('#2a1e14'); hemi.intensity = 1.05;
    lampe.color.set('#fff6e0'); lampe.intensity = 2.6;
    terrain(scene, style, qualite, eq);
    out.buts = [but(scene, 1, style), but(scene, -1, style)];
    scene.add(boite(90, 0.05, 60, lambert('#14161c'), 0, -0.03, 0));
    const panneauT = texCanvas(1024, 48, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, kits[0].fond); gr.addColorStop(0.5, '#2a8aff'); gr.addColorStop(1, kits[1].fond);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = '900 30px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let k = 0; k < 4; k++) g.fillText('ROUCOULETTE', (k + 0.5) * w / 4, h / 2);
    });
    const panneauM = new THREE.MeshBasicMaterial({ map: panneauT });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(46, 0.8, 0.2), panneauM);
    p1.position.set(0, 0.4, -12.4);
    scene.add(p1);
    for (const s of [-1, 1]) { const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 22), panneauM); p2.position.set(s * 23.4, 0.4, 0); scene.add(p2); }
    // La table de marque.
    scene.add(boite(6, 0.9, 0.9, lambert('#1b1d24'), 0, 0.45, -11.4), boite(6, 0.08, 1.1, lambert('#2d3140'), 0, 0.92, -11.4));
    const beton = lambert('#22252e');
    const places = [
      ...gradins(scene, beton, { x0: -26, x1: 26, z0: -13.4, sens: -1, rangs: 14, base: 1, hauteur: 0.5 }),
      ...gradins(scene, beton, { x0: -26, x1: 26, z0: 13.6, sens: 1, rangs: 8, base: 1, hauteur: 0.5 }),
      ...gradins(scene, beton, { x0: -12, x1: 12, z0: 25, sens: 1, rangs: 10, axe: 'z', base: 1, hauteur: 0.5 }),
      ...gradins(scene, beton, { x0: -12, x1: 12, z0: -25, sens: -1, rangs: 10, axe: 'z', base: 1, hauteur: 0.5 }),
    ];
    out.foule = foule(scene, places, publicCouleurs, qualite);
    for (const z of [-7, 0, 7]) scene.add(boite(40, 0.15, 0.4, basique('#fff4d0'), 0, 15, z));
    out.ecran = cubeSuspendu(scene);
  }
  let t = 0;
  out.maj = (dt, excitation) => {
    t += dt;
    if (out.foule) { out.foule.uTemps.value = t; out.foule.uAmp.value = 0.04 + excitation * 0.32; }
    for (const b of out.buts) {
      // Le filet qui se gonfle (un but) ; le but qui vibre (un poteau, une barre).
      b.gonfle *= Math.pow(0.03, dt);
      b.tremble *= Math.pow(0.02, dt);
      b.t += dt;
      b.filet.scale.x = 1 + b.gonfle * 0.5;
      b.g.position.y = Math.sin(b.t * 40) * b.tremble * 0.015;
    }
  };
  return out;
}
