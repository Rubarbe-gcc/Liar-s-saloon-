/**
 * PLEIN STADE — la fête en 3D, commune à tous les sports : le trophée (fait par
 * le code : une coupe dorée tournée sur un socle, deux anses) et les feux
 * d'artifice (des gerbes de points colorés qui retombent).
 */

import * as THREE from '../../../../vendor/three/three.module.min.js';

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
