/**
 * RAFFUT — les stades de rugby, construits par le code.
 *
 * Partout le même terrain (60 m sur 36, deux en-buts de 5 m aux couleurs des
 * équipes, les lignes des 22, des 10 m, des 5 m), des poteaux en H aux deux
 * bouts ; autour, trois décors :
 *   Le Grand Stade   : la nuit, quatre pylônes de projecteurs, des tribunes pleines ;
 *   Le Pré du Village: l'après-midi, une petite tribune en bois, les collines, les arbres ;
 *   Les Falaises     : au bord de la mer, au coucher du soleil.
 *
 * La foule et les gradins viennent de la salle du basket (basket/js/trois/salle3d.js).
 * Repère : x la longueur, y la hauteur, z la largeur (z = -y du moteur).
 */

import * as THREE from '../../../../../vendor/three/three.module.min.js';
import { foule, gradins, couleursPublic, texCanvas, lambert, basique, boite } from '../../../basket/js/trois/salle3d.js';
import { ecussonImage } from '../../../commun/ecusson.js';
import { DEMI_L, MORT, DEMI_W, LIGNE_22, POTEAU_Y, BARRE_Z, POTEAU_H } from '../../../../../shared/rugby/terrain.js';

export const STADES = [
  { id: 'grand', nom: 'Le Grand Stade', desc: 'La nuit, sous les projecteurs, tribunes pleines.' },
  { id: 'village', nom: 'Le Pré du Village', desc: 'Un dimanche après-midi, au milieu des collines.' },
  { id: 'falaises', nom: 'Les Falaises', desc: 'Au bord de la mer, au coucher du soleil.' },
];
export const STADE = Object.fromEntries(STADES.map((s) => [s.id, s]));

/** Un petit hasard reproductible (le décor est le même à chaque match). */
function alea(graine) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
}

/** Le ciel : une grande sphère en dégradé (haut, horizon, bas). */
function ciel(scene, haut, horizon, bas = horizon) {
  const g = new THREE.SphereGeometry(450, 24, 12);
  const cols = [];
  const ch = new THREE.Color(haut), co = new THREE.Color(horizon), cb = new THREE.Color(bas);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 450;
    const c = y > 0 ? co.clone().lerp(ch, Math.pow(y, 0.6)) : co.clone().lerp(cb, Math.min(1, -y * 3));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  m.renderOrder = -10;
  scene.add(m);
}

/* ------------------------------------------------------------------ */
/* La pelouse et ses lignes                                            */
/* ------------------------------------------------------------------ */

const MARGE = 4;
const LX = MORT + MARGE, LY = DEMI_W + MARGE;

function dessinerPelouse(g, l, h, style, kits) {
  const px = l / (2 * LX);
  const X = (x) => (x + LX) * px, Y = (y) => (y + LY) * px;
  const R = alea(91);
  const [c1, c2] = style === 'village' ? ['#4f9a3a', '#5aa844'] : style === 'falaises' ? ['#4a8f3e', '#56a049'] : ['#2f8b40', '#38a04b'];
  for (let k = 0; k < Math.ceil((2 * LX) / 5); k++) {
    g.fillStyle = k % 2 ? c1 : c2;
    g.fillRect(k * 5 * px, 0, 5 * px + 1, h);
  }
  // Les en-buts, aux couleurs de l'équipe qui les défend (à gauche l'équipe 1, qui défend x < 0 en première mi-temps).
  kits.forEach((k, e) => {
    const s = e === 0 ? -1 : 1;
    g.fillStyle = k.fond;
    g.globalAlpha = 0.22;
    g.fillRect(s < 0 ? X(-MORT) : X(DEMI_L), Y(-DEMI_W), EN_BUT_PX(px), 2 * DEMI_W * px);
    g.globalAlpha = 1;
  });
  for (let k = 0; k < (l * h) / 900; k++) {
    g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)';
    g.fillRect(R() * l, R() * h, 2 + R() * 3, 2 + R() * 3);
  }
  // Un peu d'usure devant les poteaux et au milieu.
  for (const x of [-DEMI_L + 4, 0, DEMI_L - 4]) {
    const gr = g.createRadialGradient(X(x), Y(0), 0, X(x), Y(0), 4 * px);
    gr.addColorStop(0, 'rgba(120, 100, 60, .28)'); gr.addColorStop(1, 'rgba(120, 100, 60, 0)');
    g.fillStyle = gr;
    g.fillRect(X(x) - 4 * px, Y(0) - 4 * px, 8 * px, 8 * px);
  }
  g.strokeStyle = 'rgba(255, 255, 255, .92)';
  g.lineWidth = 0.12 * px;
  const ligne = (x1, y1, x2, y2, tirets = false) => {
    g.setLineDash(tirets ? [1 * px, 0.8 * px] : []);
    g.beginPath(); g.moveTo(X(x1), Y(y1)); g.lineTo(X(x2), Y(y2)); g.stroke();
  };
  // Les touches, les lignes de ballon mort, les lignes d'essai, les 22, le milieu, les 10 m.
  ligne(-MORT, -DEMI_W, MORT, -DEMI_W); ligne(-MORT, DEMI_W, MORT, DEMI_W);
  for (const s of [-1, 1]) {
    ligne(s * MORT, -DEMI_W, s * MORT, DEMI_W);
    ligne(s * DEMI_L, -DEMI_W, s * DEMI_L, DEMI_W);
    ligne(s * (DEMI_L - LIGNE_22), -DEMI_W, s * (DEMI_L - LIGNE_22), DEMI_W);
    ligne(s * 6, -DEMI_W, s * 6, DEMI_W, true);
    // Les tirets des 5 m (le long de la ligne d'essai) et des 5 m de la touche.
    ligne(s * (DEMI_L - 5), -DEMI_W + 2, s * (DEMI_L - 5), DEMI_W - 2, true);
  }
  ligne(0, -DEMI_W, 0, DEMI_W);
  for (const t of [-1, 1]) ligne(-DEMI_L, t * (DEMI_W - 5), DEMI_L, t * (DEMI_W - 5), true);
  g.setLineDash([]);
}
const EN_BUT_PX = (px) => (MORT - DEMI_L) * px;

function pelouse(scene, style, qualite, eqDomicile, kits) {
  const l = qualite === 'haute' ? 2048 : 1024;
  const tex = texCanvas(l, Math.round((l * LY) / LX), (g, w, h) => dessinerPelouse(g, w, h, style, kits));
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(2 * LX, 2 * LY), new THREE.MeshLambertMaterial({ map: tex }));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);
  // L'écusson de l'équipe qui reçoit, peint au milieu du terrain.
  ecussonImage(eqDomicile, 256).then((img) => {
    if (!img) return;
    const c = tex.image, g = c.getContext('2d');
    const px = c.width / (2 * LX);
    g.globalAlpha = 0.3;
    const hh = 6 * px, ll = hh * (100 / 120);
    g.drawImage(img, c.width / 2 - ll / 2, c.height / 2 - hh / 2, ll, hh);
    g.globalAlpha = 1;
    tex.needsUpdate = true;
  });
}

/** Les poteaux en H (cote : ±1), avec leurs protections aux couleurs de l'équipe. */
function poteaux(scene, cote, couleur) {
  const g = new THREE.Group();
  const blanc = lambert('#f4f4f4');
  const prot = lambert(couleur);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, POTEAU_H, 10), blanc);
    m.position.set(0, POTEAU_H / 2, s * POTEAU_Y);
    m.castShadow = true;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 10), prot);
    p.position.set(0, 1, s * POTEAU_Y);
    g.add(m, p);
  }
  const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2 * POTEAU_Y, 8), blanc);
  barre.rotation.x = Math.PI / 2;
  barre.position.y = BARRE_Z;
  barre.castShadow = true;
  g.add(barre);
  g.position.x = cote * DEMI_L;
  scene.add(g);
  return g;
}

/** Les drapeaux de coin et des lignes. */
function drapeaux(scene) {
  const mat = basique('#ffffff'), tissu = basique('#ff3a3a', { side: THREE.DoubleSide });
  for (const x of [-MORT, -DEMI_L, -(DEMI_L - LIGNE_22), 0, DEMI_L - LIGNE_22, DEMI_L, MORT]) {
    for (const s of [-1, 1]) {
      const z = s * (DEMI_W + 0.6);
      scene.add(boite(0.04, 1.3, 0.04, mat, x, 0.65, z));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), tissu);
      f.position.set(x + 0.18, 1.15, z);
      scene.add(f);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Le décor                                                            */
/* ------------------------------------------------------------------ */

let texHalo = null;
function lueur(scene, x, y, z, taille, couleur = '#fff6dc') {
  if (!texHalo) texHalo = texCanvas(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,250,220,.55)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: couleur, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.set(x, y, z); s.scale.set(taille, taille, 1);
  scene.add(s);
}
function pylone(scene, x, z, h) {
  scene.add(boite(0.6, h, 0.6, lambert('#5a5e66'), x, h / 2, z));
  const tete = new THREE.Group();
  tete.position.set(x, h, z);
  tete.add(boite(5, 2.6, 0.4, lambert('#30333a')));
  const lampe = basique('#fffbe8');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) tete.add(boite(1, 0.9, 0.1, lampe, -1.8 + i * 1.2, -0.55 + j * 1.1, 0.22));
  tete.lookAt(0, 0, 0);
  scene.add(tete);
  lueur(scene, x * 0.97, h, z * 0.97, 12);
}
function arbre(scene, x, z, R, echelle = 1) {
  const g = new THREE.Group();
  g.add(boite(0.4, 2.4, 0.4, lambert('#6a4a2a'), 0, 1.2, 0));
  const vert = lambert(['#3a7a30', '#4a8a36', '#2f6a2a'][Math.floor(R() * 3)]);
  const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), vert);
  h.position.y = 3.6;
  g.add(h);
  g.position.set(x, 0, z);
  g.scale.setScalar(echelle * (0.8 + R() * 0.5));
  scene.add(g);
}
function colline(scene, x, z, r, h, couleur) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(couleur));
  m.scale.y = h / r;
  m.position.set(x, -0.5, z);
  scene.add(m);
}

/** L'écran géant : un panneau lumineux où l'on écrit le score. */
function ecranGeant(scene, x, y, z, l, h) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round((512 * h) / l);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(l, h), new THREE.MeshBasicMaterial({ map: t, fog: false }));
  ecran.position.set(x, y, z + 0.16);
  scene.add(boite(l + 0.4, h + 0.4, 0.3, lambert('#15171c'), x, y, z), ecran);
  scene.add(boite(0.4, y, 0.4, lambert('#2a2d33'), x - l / 3, y / 2, z - 0.3), boite(0.4, y, 0.4, lambert('#2a2d33'), x + l / 3, y / 2, z - 0.3));
  return (lignes, couleur = '#ffd23f') => {
    const g = c.getContext('2d');
    g.fillStyle = '#050608'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = couleur;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lignes.length;
    lignes.forEach((txt, i) => {
      g.font = `900 ${i ? 34 : 54}px "Arial Black", Impact, sans-serif`;
      g.fillText(txt, c.width / 2, (c.height * (i + 0.6)) / (n + 0.2), c.width - 20);
    });
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let yy = 0; yy < c.height; yy += 4) g.fillRect(0, yy, c.width, 1);
    t.needsUpdate = true;
  };
}

/**
 * Crée le stade `id` dans la scène.
 * kits : les tenues des deux équipes (dans l'ordre du match) ; l'en-but de gauche est celui de l'équipe 0 (qui attaque vers la droite).
 */
export function creerStade(scene, id, { qualite, equipes, kits }) {
  const R = alea(id.length * 131 + 7);
  const out = { poteaux: [], foule: null };
  const publicCouleurs = couleursPublic(kits);
  const hemi = new THREE.HemisphereLight('#ffffff', '#335533', 1.2);
  scene.add(hemi);
  const soleil = new THREE.DirectionalLight('#ffffff', 2.2);
  soleil.position.set(-16, 40, 20);
  scene.add(soleil, soleil.target);
  if (qualite === 'haute') {
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(2048, 2048);
    const c = soleil.shadow.camera;
    c.left = -40; c.right = 40; c.top = 26; c.bottom = -26; c.near = 5; c.far = 110;
    soleil.shadow.bias = -0.0008;
  }
  pelouse(scene, id, qualite, equipes[0], kits);
  out.poteaux = [poteaux(scene, -1, kits[0].fond), poteaux(scene, 1, kits[1].fond)];
  drapeaux(scene);
  const zT = DEMI_W + 4; // le pied des tribunes (au fond)
  if (id === 'grand') {
    ciel(scene, '#03050f', '#1a2240', '#0a0c14');
    scene.fog = new THREE.Fog('#0c1224', 90, 260);
    hemi.color.set('#c8d4ff'); hemi.groundColor.set('#1c2a1c'); hemi.intensity = 1.05;
    soleil.color.set('#fff4dc'); soleil.intensity = 2.5;
    scene.add(boite(190, 0.1, 130, lambert('#22252b'), 0, -0.06, 0));
    const beton = lambert('#3a3e48');
    const places = [
      ...gradins(scene, beton, { x0: -42, x1: 42, z0: -zT, sens: -1, rangs: 14, base: 1.2 }),
      ...gradins(scene, beton, { x0: -42, x1: 42, z0: zT + 6, sens: 1, rangs: 6, base: 1.2 }),
      ...gradins(scene, beton, { x0: -18, x1: 18, z0: MORT + 4, sens: 1, rangs: 10, axe: 'z', base: 1.2 }),
      ...gradins(scene, beton, { x0: -18, x1: 18, z0: -(MORT + 4), sens: -1, rangs: 10, axe: 'z', base: 1.2 }),
    ];
    out.foule = foule(scene, places, publicCouleurs, qualite);
    scene.add(boite(90, 0.5, 5, lambert('#262a33'), 0, 13.5, -(zT + 11)));
    scene.add(boite(88, 0.2, 0.2, basique('#bfe0ff'), 0, 13.2, -(zT + 8.6)));
    for (const [x, z] of [[-46, -30], [46, -30], [-46, 30], [46, 30]]) pylone(scene, x, z, 26);
    out.ecran = ecranGeant(scene, 0, 18, -(zT + 13), 12, 4);
  } else if (id === 'village') {
    ciel(scene, '#5aa0e8', '#cfe6ff', '#9ac07a');
    scene.fog = new THREE.Fog('#cfe6ff', 120, 360);
    hemi.color.set('#ffffff'); hemi.groundColor.set('#5a8a40'); hemi.intensity = 1.35;
    soleil.color.set('#fff2d8'); soleil.intensity = 2.4; soleil.position.set(-30, 45, 25);
    scene.add(boite(300, 0.1, 240, lambert('#5d9a44'), 0, -0.07, 0));
    // La petite tribune en bois, son toit, une buvette, une barrière blanche.
    const bois = lambert('#8a6038');
    const places = gradins(scene, bois, { x0: -18, x1: 18, z0: -zT, sens: -1, rangs: 6, base: 0.6, hauteur: 0.5 });
    scene.add(boite(38, 0.3, 5, lambert('#7a2a22'), 0, 5.4, -(zT + 3)));
    for (const x of [-18, -9, 0, 9, 18]) scene.add(boite(0.25, 5.4, 0.25, lambert('#5a3a20'), x, 2.7, -(zT + 5.2)));
    for (let x = -40; x <= 40; x += 2.5) for (const s of [-1, 1]) scene.add(boite(0.08, 0.9, 0.08, basique('#f4f4f4'), x, 0.45, s * (DEMI_W + 2.5)));
    for (const s of [-1, 1]) scene.add(boite(80, 0.08, 0.08, basique('#f4f4f4'), 0, 0.85, s * (DEMI_W + 2.5)));
    // Quelques spectateurs debout le long de la barrière.
    for (let x = -36; x <= 36; x += 0.8) if (R() < 0.35) places.push({ x, y: 0, z: DEMI_W + 3.2, ry: Math.PI });
    out.foule = foule(scene, places, publicCouleurs, qualite);
    const buvette = new THREE.Group();
    buvette.add(boite(5, 2.6, 3, lambert('#e8d6b0'), 0, 1.3, 0), boite(5.6, 0.3, 3.6, lambert('#c23b3b'), 0, 2.75, 0));
    buvette.position.set(30, 0, -(zT + 3));
    scene.add(buvette);
    for (let k = 0; k < 26; k++) arbre(scene, -70 + k * 5.6 + R() * 3, -(zT + 16 + R() * 12), R, 1.3);
    for (let k = 0; k < 10; k++) arbre(scene, (R() < 0.5 ? -1 : 1) * (MORT + 8 + R() * 10), -20 + R() * 40, R);
    colline(scene, -60, -120, 70, 26, '#6aa84e');
    colline(scene, 40, -140, 90, 34, '#5c9a46');
    colline(scene, 120, -90, 50, 18, '#73b057');
    // Le clocher du village, au loin.
    const clocher = new THREE.Group();
    clocher.add(boite(5, 18, 5, lambert('#d8ccb0'), 0, 9, 0));
    const fleche = new THREE.Mesh(new THREE.ConeGeometry(3.8, 8, 4), lambert('#4a4a58'));
    fleche.position.y = 22; fleche.rotation.y = Math.PI / 4;
    clocher.add(fleche);
    clocher.position.set(-30, 0, -95);
    scene.add(clocher);
  } else {
    // Les falaises : la mer au fond, le soleil qui se couche.
    ciel(scene, '#4a2f7a', '#ff9a52', '#f7c78a');
    scene.fog = new THREE.Fog('#ffb27a', 100, 320);
    hemi.color.set('#ffd6b0'); hemi.groundColor.set('#7a9a50'); hemi.intensity = 1.3;
    soleil.color.set('#ffc890'); soleil.intensity = 2.6; soleil.position.set(-40, 18, -40);
    scene.add(boite(200, 0.1, 80, lambert('#5a9446'), 0, -0.07, 0));
    // Le bord de la falaise, et la mer en contrebas.
    const roche = lambert('#a08060');
    scene.add(boite(200, 30, 6, roche, 0, -15.2, -43));
    const mer = new THREE.Mesh(new THREE.PlaneGeometry(900, 400), lambert('#2d6f9a', { emissive: '#3a2a50', emissiveIntensity: 0.25 }));
    mer.rotation.x = -Math.PI / 2; mer.position.set(0, -30, -240);
    scene.add(mer);
    const disque = new THREE.Mesh(new THREE.CircleGeometry(20, 32), basique('#ffd27a', { fog: false }));
    disque.position.set(-80, 14, -400);
    scene.add(disque);
    lueur(scene, -80, 14, -398, 140, '#ffb070');
    // Une tribune de pierre de l'autre côté, un phare sur la pointe.
    const pierre = lambert('#b8a888');
    const places = gradins(scene, pierre, { x0: -30, x1: 30, z0: zT, sens: 1, rangs: 7, base: 0.6, hauteur: 0.48 });
    for (let x = -36; x <= 36; x += 0.8) if (R() < 0.4) places.push({ x, y: 0, z: -(DEMI_W + 3), ry: 0 });
    out.foule = foule(scene, places, publicCouleurs, qualite);
    const phare = new THREE.Group();
    phare.add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 16, 12), lambert('#f4f4f4')));
    phare.children[0].position.y = 8;
    for (const y of [4, 10]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.95 - y * 0.03, 2.05 - y * 0.03, 2, 12), lambert('#c4202f')); b.position.y = y; phare.add(b); }
    const lanterne = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.6, 10), basique('#fff2b0'));
    lanterne.position.y = 16.8;
    phare.add(lanterne);
    phare.position.set(MORT + 22, 0, -36);
    scene.add(phare);
    lueur(scene, MORT + 22, 16.8, -36, 10, '#fff0a0');
    for (let k = 0; k < 8; k++) arbre(scene, -MORT - 10 - R() * 14, -24 + k * 7, R);
  }
  let t = 0;
  out.maj = (dt, excitation) => {
    t += dt;
    if (out.foule) { out.foule.uTemps.value = t; out.foule.uAmp.value = 0.04 + excitation * 0.32; }
    for (const p of out.poteaux) {
      p.tremble = (p.tremble || 0) * Math.pow(0.02, dt);
      p.rotation.z = Math.sin(t * 40) * 0.01 * p.tremble;
    }
  };
  return out;
}
