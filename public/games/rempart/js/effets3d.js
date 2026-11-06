/**
 * REMPART — les effets : particules, ondes, éclairs, traces au sol, lueurs.
 * Tout est en réserve (pool) : rien n'est créé ni jeté pendant la partie.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';

const VERTEX = `
attribute float taille;
attribute float alpha;
attribute vec3 couleur;
uniform float echelle;
varying float vA;
varying vec3 vC;
void main() {
  vA = alpha; vC = couleur;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = taille * echelle / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAGMENT = `
varying float vA;
varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  if (r > 1.0) discard;
  float a = 1.0 - r;
  gl_FragColor = vec4(vC, vA * a * a);
}`;

/** Un nuage de particules : additif (feu, étincelles, magie) ou normal (fumée, débris). */
function creerNuage(scene, max, additif) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), alp = new Float32Array(max), tai = new Float32Array(max);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('couleur', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alpha', new THREE.BufferAttribute(alp, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('taille', new THREE.BufferAttribute(tai, 1).setUsage(THREE.DynamicDrawUsage));
  g.setDrawRange(0, 0);
  const m = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: { echelle: { value: 400 } },
    transparent: true, depthWrite: false, blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = additif ? 5 : 4;
  scene.add(pts);
  const p = { vx: new Float32Array(max), vy: new Float32Array(max), vz: new Float32Array(max), vie: new Float32Array(max), vieMax: new Float32Array(max), grav: new Float32Array(max), frein: new Float32Array(max), t0: new Float32Array(max), t1: new Float32Array(max), a0: new Float32Array(max), sol: new Uint8Array(max) };
  let n = 0;
  const c = new THREE.Color();

  function ajouter(x, y, z, vx, vy, vz, vie, couleur, taille, { grav = 0, frein = 1, croit = 1, alpha = 1, sol = false } = {}) {
    if (n >= max) return;
    const i = n++;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz;
    p.vie[i] = p.vieMax[i] = vie;
    p.grav[i] = grav; p.frein[i] = frein; p.t0[i] = taille; p.t1[i] = taille * croit; p.a0[i] = alpha; p.sol[i] = sol ? 1 : 0;
    c.set(couleur);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    alp[i] = alpha; tai[i] = taille;
  }

  function copier(a, b) {
    pos[a * 3] = pos[b * 3]; pos[a * 3 + 1] = pos[b * 3 + 1]; pos[a * 3 + 2] = pos[b * 3 + 2];
    col[a * 3] = col[b * 3]; col[a * 3 + 1] = col[b * 3 + 1]; col[a * 3 + 2] = col[b * 3 + 2];
    alp[a] = alp[b]; tai[a] = tai[b];
    for (const k in p) p[k][a] = p[k][b];
  }

  function maj(dt) {
    for (let i = 0; i < n; i++) {
      p.vie[i] -= dt;
      if (p.vie[i] <= 0) { copier(i, --n); i--; continue; }
      const f = Math.pow(p.frein[i], dt);
      p.vx[i] *= f; p.vy[i] = p.vy[i] * f - p.grav[i] * dt; p.vz[i] *= f;
      pos[i * 3] += p.vx[i] * dt; pos[i * 3 + 1] += p.vy[i] * dt; pos[i * 3 + 2] += p.vz[i] * dt;
      if (p.sol[i] && pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; p.vy[i] *= -0.3; p.vx[i] *= 0.6; p.vz[i] *= 0.6; }
      const u = 1 - p.vie[i] / p.vieMax[i];
      tai[i] = p.t0[i] + (p.t1[i] - p.t0[i]) * u;
      alp[i] = p.a0[i] * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
    }
    g.setDrawRange(0, n);
    for (const k of ['position', 'couleur', 'alpha', 'taille']) g.attributes[k].needsUpdate = true;
  }

  return { ajouter, maj, m, vider: () => { n = 0; g.setDrawRange(0, 0); } };
}

export function creerEffets(scene) {
  const feu = creerNuage(scene, 2600, true);
  const fumee = creerNuage(scene, 1200, false);
  const alea = (a, b) => a + Math.random() * (b - a);

  /** Une gerbe : n particules partant d'un point. */
  function gerbe(x, y, z, { n = 10, couleurs = ['#ffffff'], vitesse = 2, haut = 1, vie = 0.6, taille = 0.15, grav = 0, frein = 0.2, croit = 0.4, additif = true, disp = 0.05, sol = false, alpha = 1 } = {}) {
    const nuage = additif ? feu : fumee;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, v = vitesse * alea(0.4, 1);
      const h = Math.sqrt(1 - e * e);
      nuage.ajouter(x + alea(-disp, disp), y + alea(-disp, disp), z + alea(-disp, disp),
        Math.cos(a) * h * v, (Math.abs(e) * haut + (haut > 1 ? 0.3 : 0)) * v, Math.sin(a) * h * v,
        vie * alea(0.6, 1.2), couleurs[i % couleurs.length], taille * alea(0.7, 1.3), { grav, frein, croit, sol, alpha });
    }
  }

  /* ----- ondes au sol */
  const ondes = [];
  const geoOnde = new THREE.RingGeometry(0.82, 1, 40);
  geoOnde.rotateX(-Math.PI / 2);
  for (let i = 0; i < 16; i++) {
    const o = new THREE.Mesh(geoOnde, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff' }));
    o.visible = false;
    o.renderOrder = 3;
    scene.add(o);
    ondes.push({ o, vie: 0 });
  }
  function onde(x, y, z, { couleur = '#ffcc66', r0 = 0.1, r1 = 1.5, vie = 0.45, opacite = 0.9 } = {}) {
    const s = ondes.find(q => q.vie <= 0) || ondes[0];
    Object.assign(s, { vie, vieMax: vie, r0, r1, opacite });
    s.o.position.set(x, y, z);
    s.o.material.color.set(couleur);
    s.o.visible = true;
  }

  /* ----- traces au sol (brûlures d'obus) */
  const traces = [];
  const geoTrace = new THREE.CircleGeometry(1, 16);
  geoTrace.rotateX(-Math.PI / 2);
  for (let i = 0; i < 24; i++) {
    const o = new THREE.Mesh(geoTrace, new THREE.MeshBasicMaterial({ color: '#1a120c', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    o.visible = false;
    o.renderOrder = 1;
    scene.add(o);
    traces.push({ o, vie: 0 });
  }
  let iTrace = 0;
  function trace(x, z, r, y = 0.015) {
    const s = traces[iTrace++ % traces.length];
    s.vie = 7;
    s.o.position.set(x, y, z);
    s.o.scale.setScalar(r * alea(0.8, 1.1));
    s.o.rotation.y = Math.random() * 6;
    s.o.visible = true;
  }

  /* ----- éclairs */
  const eclairs = [];
  for (let i = 0; i < 10; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const coeur = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fffbe0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const halo = new THREE.Line(g2, new THREE.LineBasicMaterial({ color: '#ffd23f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (const l of [coeur, halo]) { l.frustumCulled = false; l.visible = false; l.renderOrder = 6; scene.add(l); }
    eclairs.push({ coeur, halo, vie: 0, pts: null });
  }
  function zigzag(line, pts, ampl) {
    const a = line.geometry.attributes.position.array;
    let k = 0;
    for (let i = 0; i < pts.length - 1 && k < 63; i++) {
      const A = pts[i], B = pts[i + 1];
      const L = Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z);
      const n = Math.max(2, Math.min(10, Math.round(L / 0.25)));
      for (let j = 0; j < n && k < 63; j++, k++) {
        const u = j / n, bord = j === 0 ? 0 : ampl;
        a[k * 3] = A.x + (B.x - A.x) * u + (Math.random() - 0.5) * bord;
        a[k * 3 + 1] = A.y + (B.y - A.y) * u + (Math.random() - 0.5) * bord;
        a[k * 3 + 2] = A.z + (B.z - A.z) * u + (Math.random() - 0.5) * bord;
      }
    }
    const fin = pts[pts.length - 1];
    a[k * 3] = fin.x; a[k * 3 + 1] = fin.y; a[k * 3 + 2] = fin.z;
    line.geometry.setDrawRange(0, k + 1);
    line.geometry.attributes.position.needsUpdate = true;
  }
  function eclair(pts, { coeur = '#fffbe0', halo = '#ffd23f', ampl = 0.12, vie = 0.2 } = {}) {
    const s = eclairs.find(q => q.vie <= 0) || eclairs[0];
    Object.assign(s, { vie, vieMax: vie, pts, ampl });
    s.coeur.material.color.set(coeur);
    s.halo.material.color.set(halo);
    s.coeur.visible = s.halo.visible = true;
    for (const q of pts.slice(1)) gerbe(q.x, q.y, q.z, { n: 6, couleurs: [coeur, halo], vitesse: 2.5, vie: 0.3, taille: 0.1 });
  }

  /* ----- lueurs (un petit nombre de lumières toujours présentes) */
  const lueurs = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight('#ffaa55', 0, 5, 1.6);
    scene.add(l);
    lueurs.push({ l, vie: 0, i0: 0 });
  }
  function lueur(x, y, z, couleur, intensite = 6, vie = 0.25) {
    const s = lueurs.reduce((a, b) => (a.vie < b.vie ? a : b));
    Object.assign(s, { vie, vieMax: vie, i0: intensite });
    s.l.color.set(couleur);
    s.l.position.set(x, y, z);
  }

  function maj(dt, echelle) {
    feu.m.uniforms.echelle.value = fumee.m.uniforms.echelle.value = echelle;
    feu.maj(dt); fumee.maj(dt);
    for (const s of ondes) {
      if (s.vie <= 0) continue;
      s.vie -= dt;
      const u = 1 - Math.max(0, s.vie) / s.vieMax;
      const r = s.r0 + (s.r1 - s.r0) * (1 - (1 - u) ** 3);
      s.o.scale.set(r, 1, r);
      s.o.material.opacity = s.opacite * (1 - u);
      if (s.vie <= 0) s.o.visible = false;
    }
    for (const s of traces) {
      if (s.vie <= 0) continue;
      s.vie -= dt;
      s.o.material.opacity = Math.min(0.55, s.vie / 3);
      if (s.vie <= 0) s.o.visible = false;
    }
    for (const s of eclairs) {
      if (s.vie <= 0) continue;
      s.vie -= dt;
      zigzag(s.coeur, s.pts, s.ampl);
      zigzag(s.halo, s.pts, s.ampl * 2.5);
      s.coeur.material.opacity = s.halo.material.opacity = Math.max(0, s.vie / s.vieMax);
      if (s.vie <= 0) s.coeur.visible = s.halo.visible = false;
    }
    for (const s of lueurs) {
      if (s.vie <= 0) { s.l.intensity = 0; continue; }
      s.vie -= dt;
      s.l.intensity = s.i0 * Math.max(0, s.vie / s.vieMax);
    }
  }

  function vider() {
    feu.vider(); fumee.vider();
    for (const s of [...ondes, ...traces]) { s.vie = 0; s.o.visible = false; }
    for (const s of eclairs) { s.vie = 0; s.coeur.visible = s.halo.visible = false; }
    for (const s of lueurs) { s.vie = 0; s.l.intensity = 0; }
  }

  return { gerbe, onde, trace, eclair, lueur, maj, vider, feu, fumee };
}
