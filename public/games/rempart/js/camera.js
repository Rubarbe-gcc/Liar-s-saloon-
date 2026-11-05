/**
 * REMPART — la caméra qu'on tourne, qu'on penche et qu'on zoome.
 *
 * Souris : glisser = tourner, clic droit (ou Maj) + glisser = déplacer,
 * molette = zoom. Doigts : un doigt = tourner, deux doigts = zoom, déplacer
 * et tourner. Un appui court sans glisser est un « tap » (choisir un
 * emplacement). Clavier : Q/E tourner, flèches déplacer, +/- zoom.
 */

const SEUIL = 8; // pixels avant qu'un appui devienne un glissé

export function creerCamera(camera, dom, { surTap = () => {} } = {}) {
  const voulu = { theta: 0, phi: 0.82, r: 22, x: 10, z: 6 };
  const cur = { ...voulu };
  const bornes = { x0: 0, x1: 20, z0: 0, z1: 12, rMin: 7, rMax: 34 };
  const pointeurs = new Map();
  let geste = null; // { mode, x, y, ... }
  let secousse = 0;
  let auto = 0; // rotation automatique (menu)
  const touches = new Set();

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function borner() {
    voulu.phi = clamp(voulu.phi, 0.42, 1.28);
    voulu.r = clamp(voulu.r, bornes.rMin, bornes.rMax);
    voulu.x = clamp(voulu.x, bornes.x0, bornes.x1);
    voulu.z = clamp(voulu.z, bornes.z0, bornes.z1);
  }

  function deplacer(dx, dy) {
    const k = cur.r * 0.0016;
    const c = Math.cos(cur.theta), s = Math.sin(cur.theta);
    // droite de l'écran = (cos θ, -sin θ) ; haut de l'écran = (-sin θ, -cos θ)
    voulu.x += (-dx * c + dy * -s) * k * 1.4;
    voulu.z += (dx * s + dy * -c) * k * 1.4;
    borner();
  }

  const pos = e => ({ x: e.clientX, y: e.clientY });
  function etatDeux() {
    const [a, b] = [...pointeurs.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  dom.addEventListener('pointerdown', e => {
    dom.setPointerCapture?.(e.pointerId);
    pointeurs.set(e.pointerId, pos(e));
    auto = 0;
    if (pointeurs.size === 1) {
      geste = { mode: 'appui', x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, pan: e.button === 2 || e.button === 1 || e.shiftKey };
    } else if (pointeurs.size === 2) {
      geste = { mode: 'deux', ...etatDeux() };
    }
  });
  dom.addEventListener('pointermove', e => {
    if (!pointeurs.has(e.pointerId)) return;
    pointeurs.set(e.pointerId, pos(e));
    if (!geste) return;
    if (geste.mode === 'deux' && pointeurs.size >= 2) {
      const n = etatDeux();
      if (geste.d > 10) voulu.r *= geste.d / Math.max(10, n.d);
      deplacer(n.cx - geste.cx, n.cy - geste.cy);
      let da = n.ang - geste.ang;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      voulu.theta -= da;
      Object.assign(geste, n);
      borner();
      return;
    }
    if (geste.mode === 'appui' && Math.hypot(e.clientX - geste.x, e.clientY - geste.y) > SEUIL) geste.mode = geste.pan ? 'pan' : 'tour';
    const dx = e.clientX - geste.lx, dy = e.clientY - geste.ly;
    geste.lx = e.clientX; geste.ly = e.clientY;
    if (geste.mode === 'tour') {
      voulu.theta -= dx * 0.0075;
      voulu.phi -= dy * 0.005;
      borner();
    } else if (geste.mode === 'pan') deplacer(dx, dy);
  });
  const fin = e => {
    if (!pointeurs.has(e.pointerId)) return;
    pointeurs.delete(e.pointerId);
    if (geste && geste.mode === 'appui' && e.type === 'pointerup' && pointeurs.size === 0) surTap(e.clientX, e.clientY, e);
    if (pointeurs.size === 0) geste = null;
    else if (pointeurs.size === 1) { const [p] = pointeurs.values(); geste = { mode: 'tour', x: p.x, y: p.y, lx: p.x, ly: p.y }; }
  };
  dom.addEventListener('pointerup', fin);
  dom.addEventListener('pointercancel', fin);
  dom.addEventListener('contextmenu', e => e.preventDefault());
  dom.addEventListener('wheel', e => {
    e.preventDefault();
    voulu.r *= Math.exp(e.deltaY * 0.0012);
    borner();
  }, { passive: false });

  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement) return;
    touches.add(e.key.toLowerCase());
  });
  addEventListener('keyup', e => touches.delete(e.key.toLowerCase()));
  addEventListener('blur', () => touches.clear());

  function maj(dt) {
    if (touches.has('q')) voulu.theta += dt * 1.6;
    if (touches.has('e')) voulu.theta -= dt * 1.6;
    const p = 420 * dt;
    if (touches.has('arrowleft')) deplacer(p, 0);
    if (touches.has('arrowright')) deplacer(-p, 0);
    if (touches.has('arrowup')) deplacer(0, p);
    if (touches.has('arrowdown')) deplacer(0, -p);
    if (touches.has('+') || touches.has('=')) { voulu.r *= 1 - dt * 1.2; borner(); }
    if (touches.has('-')) { voulu.r *= 1 + dt * 1.2; borner(); }
    voulu.theta += auto * dt;
    const k = 1 - Math.exp(-dt * 9);
    for (const c of ['theta', 'phi', 'r', 'x', 'z']) cur[c] += (voulu[c] - cur[c]) * k;
    if (!Number.isFinite(cur.r + cur.x + cur.theta)) Object.assign(cur, voulu);
    const sp = Math.sin(cur.phi), cp = Math.cos(cur.phi);
    camera.position.set(cur.x + cur.r * sp * Math.sin(cur.theta), cur.r * cp, cur.z + cur.r * sp * Math.cos(cur.theta));
    if (secousse > 0.001) {
      camera.position.x += (Math.random() - 0.5) * secousse;
      camera.position.y += (Math.random() - 0.5) * secousse;
      camera.position.z += (Math.random() - 0.5) * secousse;
      secousse *= Math.exp(-dt * 7);
    }
    camera.lookAt(cur.x, 0, cur.z);
  }

  /** Cadre toute la carte selon la forme de l'écran (en portrait, la carte se met en long). */
  function cadrer(W, H, aspect, immediat = false) {
    Object.assign(bornes, { x0: -1, x1: W + 1, z0: -1, z1: H + 1 });
    const portrait = aspect < 0.9;
    const larg = (portrait ? H : W) + 1, prof = (portrait ? W : H) + 1;
    const vfov = camera.fov * Math.PI / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    voulu.phi = portrait ? 0.55 : 0.66;
    const r = Math.max((larg / 2) / Math.tan(hfov / 2), (prof * 0.62) / Math.tan(vfov / 2)) * 1.04;
    bornes.rMax = Math.max(34, r * 1.4);
    voulu.r = r;
    voulu.theta = portrait ? -Math.PI / 2 : 0;
    voulu.x = W / 2; voulu.z = H / 2 + (portrait ? 0 : 0.6);
    borner();
    if (immediat) Object.assign(cur, voulu);
  }

  return {
    maj, cadrer,
    secouer: f => { secousse = Math.min(0.6, secousse + f); },
    tourner: v => { auto = v; },
    get theta() { return cur.theta; },
  };
}
