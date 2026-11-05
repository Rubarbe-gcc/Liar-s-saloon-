/**
 * LÉGENDES — les effets (le « juice ») : un moteur de particules sur un canvas (étincelles, braises, éclats,
 * flocons, pétales), l'éclair blanc, l'écran qui tremble, l'arrêt sur image à l'impact. Partagé par les
 * animations plein écran et l'arène du combat.
 *
 * Les particules vivent dans un tableau réutilisé (pas d'objets créés à chaque image) ; en mode « moins
 * d'animations » (prefers-reduced-motion), on en fait beaucoup moins et l'écran ne tremble pas.
 */

const DOUX = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX = DOUX ? 150 : 900;

/** Un calque de particules posé sur un élément (il prend toute sa place). */
export function creerParticules(hote) {
  const c = document.createElement('canvas');
  c.className = 'particules';
  hote.appendChild(c);
  const g = c.getContext('2d');
  const P = [];
  let vivant = true, dernier = performance.now(), w = 1, h = 1;
  const taille = () => { const r = window.devicePixelRatio || 1; w = c.clientWidth; h = c.clientHeight; c.width = w * r; c.height = h * r; g.setTransform(r, 0, 0, r, 0, 0); };
  taille();
  function boucle(t) {
    if (!vivant) return;
    const dt = Math.min(0.05, (t - dernier) / 1000);
    dernier = t;
    if (c.clientWidth !== w || c.clientHeight !== h) taille();
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.vie -= dt;
      if (p.vie <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      p.vx *= 1 - p.frein * dt; p.vy = p.vy * (1 - p.frein * dt) + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const k = p.vie / p.vieMax;
      g.globalAlpha = Math.min(1, k * 1.6) * p.alpha;
      g.fillStyle = p.couleur;
      if (p.forme === 'trait') {
        g.strokeStyle = p.couleur; g.lineWidth = p.taille * k;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke();
      } else if (p.forme === 'carre') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); const s = p.taille * (0.4 + 0.6 * k); g.fillRect(-s / 2, -s / 2, s, s); g.restore();
      } else {
        const s = p.taille * (p.grossit ? 1 + (1 - k) * 2 : 0.3 + 0.7 * k);
        const d = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
        d.addColorStop(0, '#ffffff'); d.addColorStop(0.3, p.couleur); d.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = d; g.beginPath(); g.arc(p.x, p.y, s, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);
  const ajouter = (o) => { if (P.length >= MAX) return; P.push({ vx: 0, vy: 0, grav: 0, frein: 0, rot: 0, vr: 0, alpha: 1, forme: 'rond', taille: 6, couleur: '#fff', ...o, vieMax: o.vie }); };
  const n = (k) => Math.ceil(k * (DOUX ? 0.2 : 1));
  return {
    /** Une gerbe d'étincelles au point (x, y) en pixels du calque. */
    gerbe(x, y, couleur = '#ffd23f', k = 40, vitesse = 600) {
      for (let i = 0; i < n(k); i++) { const a = Math.random() * Math.PI * 2, v = vitesse * (0.3 + Math.random()); ajouter({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, frein: 3, grav: 400, vie: 0.4 + Math.random() * 0.5, forme: 'trait', taille: 2 + Math.random() * 3, couleur }); }
    },
    /** Des éclats lumineux qui grossissent (l'impact). */
    eclats(x, y, couleur = '#fff', k = 6) {
      for (let i = 0; i < n(k); i++) ajouter({ x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 60, vie: 0.35 + Math.random() * 0.2, taille: 30 + Math.random() * 50, grossit: true, couleur });
    },
    /** L'aura qui monte autour d'un point (la charge d'une super). */
    aura(x, y, rayon, couleur, k = 6) {
      for (let i = 0; i < n(k); i++) { const a = Math.random() * Math.PI * 2; ajouter({ x: x + Math.cos(a) * rayon * Math.random(), y: y + Math.sin(a) * rayon * 0.6 + rayon * 0.3, vy: -200 - Math.random() * 300, vx: (Math.random() - 0.5) * 60, vie: 0.6 + Math.random() * 0.5, taille: 8 + Math.random() * 14, couleur }); }
    },
    /** Des débris carrés (la pierre, le métal) qui retombent. */
    debris(x, y, couleur = '#8a7a6a', k = 18) {
      for (let i = 0; i < n(k); i++) { const a = -Math.PI * Math.random(); const v = 300 + Math.random() * 500; ajouter({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 1400, vie: 0.8 + Math.random() * 0.5, forme: 'carre', taille: 6 + Math.random() * 10, vr: (Math.random() - 0.5) * 12, couleur, alpha: 0.9 }); }
    },
    /** Une pluie (flocons, pétales, braises) sur toute la largeur. */
    pluie(couleur, k = 40, vers = 1) {
      for (let i = 0; i < n(k); i++) ajouter({ x: Math.random() * w, y: vers > 0 ? -20 - Math.random() * h * 0.3 : h + 20, vy: vers * (150 + Math.random() * 250), vx: (Math.random() - 0.5) * 80, vie: 2 + Math.random(), taille: 3 + Math.random() * 6, couleur, alpha: 0.85 });
    },
    get largeur() { return w; },
    get hauteur() { return h; },
    detruire() { vivant = false; c.remove(); },
  };
}

/** L'écran (un élément) qui tremble : force en pixels, durée en ms (avec atténuation). */
export function secouer(el, force = 10, duree = 300) {
  if (DOUX || !el) return;
  const t0 = performance.now();
  const pas = (t) => {
    const k = 1 - (t - t0) / duree;
    if (k <= 0) { el.style.transform = ''; return; }
    el.style.transform = `translate(${(Math.random() - 0.5) * 2 * force * k}px, ${(Math.random() - 0.5) * 2 * force * k}px)`;
    requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

/** L'arrêt sur image : une courte pause (ms) au moment d'un gros impact. */
export const arret = (ms = 70) => new Promise((r) => setTimeout(r, DOUX ? 0 : ms));
export const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
export const moinsDAnimations = DOUX;
