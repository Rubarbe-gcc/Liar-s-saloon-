/**
 * PARE-FEU — le réseau dessiné sur un canvas 2D, façon terminal néon.
 *
 * La carte (1000 × 1000) tourne pour que la base du joueur soit en bas, et
 * tient dans la zone laissée libre par le HUD. Les lueurs sont des images
 * pré-calculées posées en mode « lighter » (shadowBlur coûte trop cher sur
 * téléphone). Les effets (étincelles, ondes, éclairs, textes) vivent en
 * coordonnées de la carte.
 */

import { COULEURS, COULEUR_NEUTRE, DEFENSES, AMELIORATIONS, LISTE_AMELIORATIONS, EVENEMENTS, TECHS } from '../../../shared/parefeu/donnees.js';
import { voit, allies, evenement, up } from '../../../shared/parefeu/regles.js';

const RAYON = { noyau: 30, nexus: 27, serveur: 18, relais: 15 };
const MIN_PX = { noyau: 13, nexus: 12, serveur: 9, relais: 8 };
const ETENDUE = 900;

/** Les couleurs des joueurs (la sienne peut être personnalisée) et son style. */
let PALETTE = [...COULEURS];
let STYLE = { j: -1, forme: 'hexa', trainee: 'ligne' };
const couleur = (j) => (j >= 0 ? PALETTE[j] : COULEUR_NEUTRE);
/** Une couleur de l'arc-en-ciel (teinte h en degrés), en #rrggbb. */
function arcEnCiel(h) {
  const f = (n) => { const k = (n + h / 30) % 12; const v = 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * v).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const lueurs = new Map();
function lueur(hex) {
  if (lueurs.has(hex)) return lueurs.get(hex);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, rgba(hex, 0.9));
  grad.addColorStop(0.25, rgba(hex, 0.45));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  lueurs.set(hex, c);
  return c;
}

/** Le contour d'un Noyau selon la forme choisie. */
function contourNoyau(g, x, y, r, forme, now) {
  switch (forme) {
    case 'cercle': g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); return;
    case 'losange': polygone(g, x, y, r * 1.1, 4, 0); return;
    case 'octo': polygone(g, x, y, r, 8, Math.PI / 8); return;
    case 'triangle': polygone(g, x, y, r * 1.15, 3, -Math.PI / 2); return;
    case 'etoile': {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.55 : r * 1.12;
        if (i) g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); else g.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
      }
      g.closePath();
      return;
    }
    case 'oeil': {
      const k = 0.55 + 0.1 * Math.sin(now * 2);
      g.beginPath();
      g.moveTo(x - r * 1.2, y);
      g.quadraticCurveTo(x, y - r * 2.2 * k, x + r * 1.2, y);
      g.quadraticCurveTo(x, y + r * 2.2 * k, x - r * 1.2, y);
      g.closePath();
      return;
    }
    default: polygone(g, x, y, r, 6, Math.PI / 6);
  }
}

function polygone(g, x, y, r, n, rot = 0) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
}

export function creerRendu(canvas) {
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let fond = null;
  let zone = { haut: 70, bas: 140 };
  let vue = { s: 1, cx: 0, cy: 0, rot: 0 };
  let secousse = 0;
  let flash = { c: '#fff', a: 0 };
  let glitch = 0;
  let annonce = null;
  const parts = [];
  const eclairs = [];
  const textes = [];
  const flashNoeud = new Map();
  const poussieres = Array.from({ length: 46 }, () => ({ x: Math.random() * 1000, y: Math.random() * 1000, v: 4 + Math.random() * 10, a: 0.15 + Math.random() * 0.35, c: Math.random() < 0.5 ? '01' : '<>' }));

  function taille() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    fond = document.createElement('canvas');
    fond.width = canvas.width; fond.height = canvas.height;
    const f = fond.getContext('2d');
    f.scale(dpr, dpr);
    f.fillStyle = '#03060c'; f.fillRect(0, 0, W, H);
    const rad = f.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    rad.addColorStop(0, 'rgba(14,40,80,.55)'); rad.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = rad; f.fillRect(0, 0, W, H);
    f.lineWidth = 1;
    for (let x = 0; x < W; x += 28) { f.strokeStyle = x % 140 === 0 ? 'rgba(46,242,255,.07)' : 'rgba(46,242,255,.03)'; f.beginPath(); f.moveTo(x + 0.5, 0); f.lineTo(x + 0.5, H); f.stroke(); }
    for (let y = 0; y < H; y += 28) { f.strokeStyle = y % 140 === 0 ? 'rgba(46,242,255,.07)' : 'rgba(46,242,255,.03)'; f.beginPath(); f.moveTo(0, y + 0.5); f.lineTo(W, y + 0.5); f.stroke(); }
  }

  function cadrer(angleMoi) {
    const dispoH = Math.max(160, H - zone.haut - zone.bas);
    const cote = Math.min(W - 12, dispoH);
    vue = { s: cote / ETENDUE, cx: W / 2, cy: zone.haut + dispoH / 2, rot: angleMoi == null ? 0 : ((90 - angleMoi) * Math.PI) / 180 };
  }

  /** Carte → écran. */
  function ecran(x, y) {
    const dx = x - 500, dy = y - 500;
    const c = Math.cos(vue.rot), s = Math.sin(vue.rot);
    return { x: vue.cx + (dx * c - dy * s) * vue.s, y: vue.cy + (dx * s + dy * c) * vue.s };
  }

  const rayonPx = (nd) => {
    const t = nd.eteint ? 'noyau' : nd.type;
    return Math.max(MIN_PX[t], RAYON[t] * vue.s) * (nd.eteint ? 0.85 : 1);
  };

  /** Le nœud sous le doigt (ou -1). */
  function noeudSous(E, x, y) {
    let best = -1, dmin = Infinity;
    for (const nd of E.noeuds) {
      const p = ecran(nd.x, nd.y);
      const d = Math.hypot(p.x - x, p.y - y);
      const lim = Math.max(30, rayonPx(nd) + 16);
      if (d < lim && d < dmin) { dmin = d; best = nd.id; }
    }
    return best;
  }

  /* ---------------------------- effets ---------------------------- */

  function etincelles(x, y, c, n, vit = 120, vie = 0.6, taille = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = vit * (0.3 + Math.random());
      parts.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie, t: 0, c, r: taille * (0.6 + Math.random() * 0.8) });
    }
  }
  const onde = (x, y, c, r1, vie = 0.6, ep = 3) => parts.push({ k: 'o', x, y, c, r1, vie, t: 0, ep });
  const texte = (x, y, s, c, gros = false) => textes.push({ x, y, s, c, t: 0, vie: gros ? 1.8 : 1.1, gros });
  function eclair(x1, y1, x2, y2, c, vie = 0.25, segs = 7) {
    const pts = [[x1, y1]];
    for (let i = 1; i < segs; i++) {
      const f = i / segs;
      const j = 18 * (1 - Math.abs(f - 0.5) * 1.4);
      pts.push([x1 + (x2 - x1) * f + (Math.random() - 0.5) * j, y1 + (y2 - y1) * f + (Math.random() - 0.5) * j]);
    }
    pts.push([x2, y2]);
    eclairs.push({ pts, c, t: 0, vie });
  }

  /** Les événements d'une image deviennent des effets. */
  function effets(evts, E, moi) {
    for (const e of evts) {
      if (e.k === 'evenement') {
        const V = EVENEMENTS[e.ev];
        annonce = { s: V.glyphe + ' ' + V.nom, sous: V.aide, t: 0 };
        glitch = Math.max(glitch, 0.35);
        flash = e.ev === 'panne' ? { c: '#000000', a: 0.6 } : { c: '#ffd54a', a: 0.15 };
        continue;
      }
      if (e.k === 'tech') {
        if (e.j === moi) {
          const core = E.noeuds[E.joueurs[moi].noyau];
          onde(core.x, core.y, '#ffd54a', 120, 0.7, 3);
          texte(core.x, core.y - 60, '▲ ' + TECHS[e.tech].nom.toUpperCase() + ' ' + e.niv, '#ffd54a');
        }
        continue;
      }
      const nd = E.noeuds[e.n];
      if (!nd && e.k !== 'elimine' && e.k !== 'fin') continue;
      const cj = couleur(e.j);
      const pourMoi = moi >= 0 && nd && (allies(E, moi, nd.proprio) || allies(E, moi, e.j));
      switch (e.k) {
        case 'lance': etincelles(nd.x, nd.y, cj, 5, 80, 0.35, 2); break;
        case 'bloque':
          flashNoeud.set(nd.id, { t: 0.25, c: '#9fe8ff' });
          onde(nd.x, nd.y, '#9fe8ff', 46, 0.35, 4);
          etincelles(nd.x, nd.y, '#bdf3ff', 8, 140, 0.4, 2.5);
          if (pourMoi) texte(nd.x, nd.y - 34, 'BLOQUÉ', '#9fe8ff');
          break;
        case 'passe':
          onde(nd.x, nd.y, '#ff3df0', 40, 0.4, 2);
          if (pourMoi) texte(nd.x, nd.y - 34, 'INFILTRÉ', '#ff3df0');
          break;
        case 'impact': {
          const dg = e.dg ?? 0;
          if (e.fort) onde(nd.x, nd.y, '#ffd54a', 55, 0.4, 3);
          flashNoeud.set(nd.id, { t: 0.18, c: '#ffffff' });
          etincelles(nd.x, nd.y, cj, e.type === 'cheval' ? 14 : 7, 160, 0.45, 2.5);
          if (pourMoi) texte(nd.x + (Math.random() - 0.5) * 20, nd.y - 26, `-${dg}`, cj);
          if (moi >= 0 && allies(E, moi, nd.proprio)) secousse = Math.max(secousse, nd.type === 'noyau' ? 5 : 2.5);
          break;
        }
        case 'capture': {
          const c = couleur(e.j);
          onde(nd.x, nd.y, c, 120, 0.8, 6);
          onde(nd.x, nd.y, '#ffffff', 70, 0.4, 2);
          etincelles(nd.x, nd.y, c, 30, 260, 0.9, 3.5);
          flashNoeud.set(nd.id, { t: 0.5, c });
          if (moi >= 0 && allies(E, moi, e.ancien)) { texte(nd.x, nd.y - 40, 'PERDU', '#ff3b5c', true); secousse = Math.max(secousse, 9); }
          else if (moi >= 0 && allies(E, moi, e.j)) texte(nd.x, nd.y - 40, 'CAPTURÉ', c, true);
          break;
        }
        case 'elimine': {
          const P = E.joueurs[e.p];
          const core = E.noeuds[P.noyau];
          for (let i = 0; i < 4; i++) onde(core.x, core.y, i % 2 ? '#ffffff' : couleur(e.p), 200 + i * 90, 0.8 + i * 0.25, 8 - i);
          etincelles(core.x, core.y, couleur(e.p), 70, 420, 1.4, 4.5);
          etincelles(core.x, core.y, couleur(e.j), 40, 300, 1.1, 3);
          texte(core.x, core.y - 60, `NOYAU ${P.nom.toUpperCase()} DÉTRUIT`, '#ffffff', true);
          secousse = 18;
          glitch = 0.7;
          flash = { c: moi >= 0 && allies(E, moi, e.p) ? '#ff3b5c' : couleur(e.j), a: 0.55 };
          break;
        }
        case 'tourelle':
          eclair(nd.x, nd.y, e.x, e.y, '#ffd54a', 0.18, 4);
          etincelles(e.x, e.y, '#ffd54a', 8, 140, 0.35, 2);
          break;
        case 'bouclier': onde(nd.x, nd.y, '#9fe8ff', 40, 0.4, 2); break;
        case 'up':
          onde(nd.x, nd.y, '#ffd54a', 70, 0.6, 4);
          for (let i = 0; i < 12; i++) parts.push({ k: 'p', x: nd.x + (Math.random() - 0.5) * 40, y: nd.y + 10, vx: 0, vy: -50 - Math.random() * 40, vie: 0.7, t: 0, c: '#ffd54a', r: 2.5, plus: true });
          if (pourMoi) texte(nd.x, nd.y - 44, '▲ ' + AMELIORATIONS[e.up].nom.toUpperCase() + ' ' + e.niv, '#ffd54a');
          break;
        case 'tresor': {
          const core = E.noeuds[E.joueurs[e.j].noyau];
          for (let i = 0; i < 16; i++) parts.push({ k: 'f', x: nd.x, y: nd.y, x2: core.x, y2: core.y, t: -i * 0.05, vie: 1, c: '#ffd54a' });
          texte(nd.x, nd.y - 44, '+' + e.v + ' ◈', '#ffd54a', true);
          onde(nd.x, nd.y, '#ffd54a', 160, 0.8, 5);
          break;
        }
        case 'zap': {
          eclair(nd.x, nd.y, e.x, e.y, '#7dff9b');
          etincelles(e.x, e.y, '#7dff9b', 10, 150, 0.4, 2.5);
          onde(e.x, e.y, '#7dff9b', 22, 0.25, 2);
          break;
        }
        case 'absorbe': onde(nd.x, nd.y, '#b48cff', 50, 0.5, 3); etincelles(nd.x, nd.y, '#b48cff', 8, 90, 0.5); if (pourMoi) texte(nd.x, nd.y - 34, 'LEURRÉ', '#b48cff'); break;
        case 'devie': onde(nd.x, nd.y, '#b48cff', 34, 0.4, 2); break;
        case 'sature':
          for (let i = 0; i < 3; i++) onde(nd.x, nd.y, '#ff3b5c', 50 + i * 25, 0.5 + i * 0.15, 3);
          etincelles(nd.x, nd.y, '#ff3b5c', 16, 200, 0.5, 2);
          texte(nd.x, nd.y - 36, 'SATURÉ', '#ff3b5c');
          break;
        case 'vol': {
          const vers = E.noeuds[E.joueurs[e.j].noyau];
          for (let i = 0; i < 10; i++) parts.push({ k: 'f', x: nd.x, y: nd.y, x2: vers.x, y2: vers.y, t: -i * 0.06, vie: 0.9, c: '#ffd54a' });
          if (moi === e.p) texte(nd.x, nd.y - 36, `-${e.v} ¤`, '#ff3b5c', true);
          else if (moi === e.j) texte(nd.x, nd.y - 36, `+${e.v} ¤`, '#ffd54a', true);
          break;
        }
        case 'sonde':
          for (let i = 0; i < 3; i++) onde(nd.x, nd.y, cj, 160 + i * 60, 0.9 + i * 0.2, 1.5);
          if (moi >= 0 && allies(E, moi, e.j)) texte(nd.x, nd.y - 36, 'SONDÉ', cj);
          break;
        case 'defense': {
          const c = { parefeu: '#9fe8ff', antivirus: '#7dff9b', leurre: '#b48cff', chiffrement: '#ffd54a', correctif: '#7dff9b' }[e.type];
          onde(nd.x, nd.y, c, 60, 0.5, 3);
          if (e.parfait) { onde(nd.x, nd.y, '#ffd54a', 90, 0.7, 2); if (moi >= 0 && allies(E, moi, e.j)) texte(nd.x, nd.y - 40, '★ PARFAIT', '#ffd54a'); }
          if (e.type === 'correctif') for (let i = 0; i < 14; i++) parts.push({ k: 'p', x: nd.x + (Math.random() - 0.5) * 40, y: nd.y + 10, vx: 0, vy: -40 - Math.random() * 50, vie: 0.8, t: 0, c, r: 2.5, plus: true });
          else etincelles(nd.x, nd.y, c, 10, 90, 0.5, 2);
          break;
        }
        case 'breche':
          for (let i = 0; i < Math.max(1, e.score); i++) {
            const a = Math.random() * Math.PI * 2;
            eclair(nd.x + Math.cos(a) * 140, nd.y + Math.sin(a) * 140, nd.x, nd.y, '#ffb02e', 0.35, 9);
          }
          onde(nd.x, nd.y, '#ffb02e', 80, 0.5, 4);
          texte(nd.x, nd.y - 40, `BRÈCHE ${e.score}/5`, '#ffb02e', true);
          if (e.score >= 5) secousse = Math.max(secousse, 6);
          break;
        default:
      }
    }
  }

  /* ---------------------------- dessin ---------------------------- */

  function dessiner(E, moi, o = {}) {
    const now = o.now || performance.now() / 1000;
    const dt = Math.min(0.05, o.dt || 0.016);
    const J = moi >= 0 ? E.joueurs[moi] : null;
    zone = o.zone || zone;
    cadrer(J ? J.angle : null);

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(fond, 0, 0, W, H);
    secousse *= Math.pow(0.02, dt);
    if (secousse > 0.3) g.translate((Math.random() - 0.5) * secousse, (Math.random() - 0.5) * secousse);
    const s = vue.s;

    // La poussière de données.
    g.font = `${Math.max(9, 12 * s)}px ui-monospace, monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of poussieres) {
      p.y += p.v * dt; if (p.y > 1000) { p.y = 0; p.x = Math.random() * 1000; }
      const q = ecran(p.x, p.y);
      g.fillStyle = `rgba(46,242,255,${p.a * 0.35})`;
      g.fillText(p.c, q.x, q.y);
    }

    // Les territoires.
    g.globalCompositeOperation = 'lighter';
    for (const nd of E.noeuds) {
      if (nd.proprio < 0) continue;
      const p = ecran(nd.x, nd.y);
      const r = (nd.type === 'noyau' ? 190 : 120) * s;
      g.globalAlpha = 0.16;
      g.drawImage(lueur(couleur(nd.proprio)), p.x - r, p.y - r, 2 * r, 2 * r);
    }
    g.globalAlpha = 1;

    // Les liens.
    const P = E.noeuds.map((nd) => ecran(nd.x, nd.y));
    g.lineCap = 'round';
    for (const [a, b] of E.liens) {
      const na = E.noeuds[a], nb = E.noeuds[b];
      const pa = P[a], pb = P[b];
      const meme = na.proprio === nb.proprio && na.proprio >= 0;
      let style;
      if (meme) style = rgba(couleur(na.proprio), 0.55);
      else if (na.proprio < 0 && nb.proprio < 0) style = 'rgba(107,122,153,.28)';
      else {
        const gr = g.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
        gr.addColorStop(0, rgba(couleur(na.proprio), na.proprio < 0 ? 0.25 : 0.6));
        gr.addColorStop(1, rgba(couleur(nb.proprio), nb.proprio < 0 ? 0.25 : 0.6));
        style = gr;
      }
      g.strokeStyle = style;
      g.globalAlpha = 0.25; g.lineWidth = Math.max(4, 9 * s); g.setLineDash([]);
      g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke();
      g.globalAlpha = 1; g.lineWidth = Math.max(1, 2 * s);
      if (meme) { g.setLineDash([6, 8]); g.lineDashOffset = -now * 24; }
      g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke();
    }
    g.setLineDash([]);

    // Les programmes en route.
    for (const p of E.progs) {
      const a = E.noeuds[p.de], b = E.noeuds[p.vers];
      if (!a || !b) continue;
      const t = Math.min(1, p.t);
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      const q = ecran(x, y);
      const ux = (b.x - a.x) / p.len, uy = (b.y - a.y) / p.len;
      const queue = p.type === 'sonde' ? 70 : p.type === 'ver' ? 34 : 46;
      const qb = ecran(x - ux * Math.min(queue, t * p.len), y - uy * Math.min(queue, t * p.len));
      const tr = p.j === STYLE.j ? STYLE.trainee : 'ligne';
      let c = p.devie ? '#b48cff' : couleur(p.j);
      if (tr === 'arcenciel' && !p.devie) c = arcEnCiel((now * 160 + p.id * 47) % 360);
      const qq = tr === 'comete' ? ecran(x - ux * Math.min(queue * 2, t * p.len), y - uy * Math.min(queue * 2, t * p.len)) : qb;
      const gr = g.createLinearGradient(q.x, q.y, qq.x, qq.y);
      gr.addColorStop(0, rgba(c, 0.95)); gr.addColorStop(1, rgba(c, 0));
      g.strokeStyle = gr;
      const ep = Math.max(2, (p.type === 'ver' ? 3 : 5) * s) * (tr === 'comete' ? 1.8 : 1);
      g.lineWidth = ep;
      if (tr === 'pointilles') g.setLineDash([4, 5]);
      if (tr === 'double') {
        const nx = -(qq.y - q.y), ny = qq.x - q.x, nl = Math.hypot(nx, ny) || 1, d = ep * 0.9;
        for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(q.x + (nx / nl) * d * sg, q.y + (ny / nl) * d * sg); g.lineTo(qq.x + (nx / nl) * d * sg, qq.y + (ny / nl) * d * sg); g.stroke(); }
      } else { g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(qq.x, qq.y); g.stroke(); }
      g.setLineDash([]);
      if (tr === 'etincelles' && Math.random() < 0.35) parts.push({ k: 'p', x, y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, vie: 0.35, t: 0, c, r: 1.6 });
      const r = Math.max(5, 16 * s) * (p.type === 'ver' ? 0.8 : 1.2) * (tr === 'comete' ? 1.4 : 1) * (p.fort ? 1.2 : 1);
      g.drawImage(lueur(c), q.x - r * 1.6, q.y - r * 1.6, r * 3.2, r * 3.2);
      g.fillStyle = '#fff';
      g.strokeStyle = c;
      g.lineWidth = 1.5;
      const ang = Math.atan2(ecran(b.x, b.y).y - ecran(a.x, a.y).y, ecran(b.x, b.y).x - ecran(a.x, a.y).x);
      const rr = Math.max(3, 7 * s);
      switch (p.type) {
        case 'ver': g.beginPath(); g.arc(q.x, q.y, rr * 0.55, 0, Math.PI * 2); g.fill(); break;
        case 'cheval': polygone(g, q.x, q.y, rr * 1.1, 4, ang); g.fill(); g.stroke(); break;
        case 'saturation': g.beginPath(); g.arc(q.x, q.y, rr * (0.9 + 0.3 * Math.sin(now * 20)), 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); break;
        case 'rancon': polygone(g, q.x, q.y, rr, 6, now * 4); g.fillStyle = '#ffd54a'; g.fill(); break;
        case 'sonde': polygone(g, q.x, q.y, rr, 3, ang); g.fill(); break;
        default:
      }
    }

    // Les nœuds.
    g.globalCompositeOperation = 'source-over';
    const attaquables = o.attaquables || new Set();
    const menaces = new Set();
    if (moi >= 0) for (const p of E.progs) if (allies(E, moi, E.noeuds[p.vers].proprio) && !allies(E, moi, p.j)) menaces.add(p.vers);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const nd of E.noeuds) {
      const p = P[nd.id];
      const r = rayonPx(nd);
      const c = couleur(nd.proprio);
      const fl = flashNoeud.get(nd.id);
      const sat = nd.sature > E.temps;
      let x = p.x, y = p.y;
      if (sat) { x += (Math.random() - 0.5) * 2; y += (Math.random() - 0.5) * 2; }

      // Halo
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = nd.proprio >= 0 ? 0.7 : 0.35;
      g.drawImage(lueur(c), x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // Menace : un anneau rouge qui bat.
      if (menaces.has(nd.id)) {
        const k = (now * 2.2) % 1;
        g.strokeStyle = `rgba(255,59,92,${0.8 * (1 - k)})`; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, r * (1.3 + k * 0.9), 0, Math.PI * 2); g.stroke();
      }

      // Forme
      const cotes = nd.type === 'noyau' ? 6 : nd.type === 'nexus' ? 8 : nd.type === 'serveur' ? 6 : 4;
      const rot = nd.type === 'relais' ? 0 : nd.type === 'serveur' ? Math.PI / 6 : nd.type === 'nexus' ? now * 0.2 : Math.PI / 6;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rgba(c, 0.55)); grad.addColorStop(1, 'rgba(4,10,20,.95)');
      const formeNoyau = nd.type === 'noyau' && nd.base === STYLE.j && STYLE.forme !== 'hexa' ? STYLE.forme : null;
      const trace = () => (formeNoyau ? contourNoyau(g, x, y, r, formeNoyau, now) : polygone(g, x, y, r, cotes, rot));
      trace();
      g.fillStyle = grad; g.fill();
      g.strokeStyle = fl ? fl.c : c; g.lineWidth = (fl ? 3 : 2) + up(nd, 'blindage') * 1.2; g.stroke();
      if (up(nd, 'blindage')) { polygone(g, x, y, r * 0.8, cotes, rot); g.strokeStyle = rgba(c, 0.35); g.lineWidth = 1; g.stroke(); }
      if (nd.type === 'noyau' && !nd.eteint) {
        polygone(g, x, y, r * 0.62, 3, -now * 1.2); g.strokeStyle = rgba(c, 0.9); g.lineWidth = 1.5; g.stroke();
        if (formeNoyau) contourNoyau(g, x, y, r * 1.22, formeNoyau, now); else polygone(g, x, y, r * 1.22, 6, Math.PI / 6);
        g.strokeStyle = rgba(c, 0.45); g.lineWidth = 1; g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * 0.16 * (1 + 0.25 * Math.sin(now * 4)), 0, Math.PI * 2); g.fill();
      } else if (nd.type === 'nexus') {
        for (let i = 0; i < 4; i++) {
          g.strokeStyle = rgba(c, 0.6); g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, r * 1.3, -now * 0.8 + (i * Math.PI) / 2, -now * 0.8 + (i * Math.PI) / 2 + 0.9); g.stroke();
        }
        g.fillStyle = rgba('#ffffff', 0.85); g.font = `bold ${Math.max(8, r * 0.5)}px ui-monospace, monospace`; g.fillText('◈', x, y + 1);
      } else if (nd.eteint) {
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.5); g.lineTo(x + r * 0.5, y + r * 0.5); g.stroke();
      } else {
        g.fillStyle = rgba(c, 0.9); g.fillRect(x - r * 0.18, y - r * 0.18, r * 0.36, r * 0.36);
      }
      if (fl) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.min(1, fl.t * 4);
        trace(); g.fillStyle = fl.c; g.fill();
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        fl.t -= dt; if (fl.t <= 0) flashNoeud.delete(nd.id);
      }

      // PV
      const f = Math.max(0, nd.pv / nd.max);
      const rp = r + Math.max(4, 6 * s);
      g.lineWidth = Math.max(2.5, 4 * s);
      g.strokeStyle = 'rgba(255,255,255,.1)';
      g.beginPath(); g.arc(x, y, rp, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = f < 0.3 && Math.sin(now * 12) > 0 ? '#ff3b5c' : c;
      g.beginPath(); g.arc(x, y, rp, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); g.stroke();

      // Défenses
      const vu = moi < 0 || voit(E, moi, nd.id);
      const rd = rp + Math.max(5, 8 * s);
      if (vu && nd.pf > 0) {
        const n = nd.pf;
        g.strokeStyle = '#9fe8ff'; g.lineWidth = Math.max(2, 3.5 * s);
        for (let i = 0; i < n; i++) {
          const a0 = -Math.PI / 2 + (i * Math.PI * 2) / DEFENSES.parefeu.max;
          g.beginPath(); g.arc(x, y, rd, a0 + 0.08, a0 + (Math.PI * 2) / DEFENSES.parefeu.max - 0.08); g.stroke();
        }
      } else if (!vu && nd.proprio >= 0) {
        g.fillStyle = 'rgba(207,233,255,.65)'; g.font = `bold ${Math.max(10, 13 * s)}px ui-monospace, monospace`;
        g.fillText('?', x + rd * 0.8, y - rd * 0.8);
      }
      if (nd.av > E.temps && !sat) {
        const pr = DEFENSES.antivirus.portee * s;
        g.fillStyle = 'rgba(125,255,155,.08)';
        g.beginPath(); g.moveTo(x, y); g.arc(x, y, pr, now * 3, now * 3 + 0.9); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(125,255,155,.35)'; g.lineWidth = 1; g.setLineDash([3, 6]);
        g.beginPath(); g.arc(x, y, pr, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
      if (vu && nd.leurre > E.temps && nd.leurreReste > 0) {
        g.strokeStyle = `rgba(180,140,255,${0.5 + 0.3 * Math.sin(now * 6)})`; g.lineWidth = 2; g.setLineDash([4, 4]);
        g.beginPath(); g.arc(x, y, rd + 6 + 3 * Math.sin(now * 5), 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
        g.globalAlpha = 0.35;
        polygone(g, x + 4 * Math.sin(now * 9), y - 3, r * 1.05, cotes, rot); g.strokeStyle = '#b48cff'; g.stroke();
        g.globalAlpha = 1;
      }
      if (vu && nd.chiffre > E.temps) {
        g.fillStyle = 'rgba(255,213,74,.8)'; g.font = `${Math.max(8, 10 * s)}px ui-monospace, monospace`;
        for (let i = 0; i < 8; i++) {
          const a = now * 0.9 + (i * Math.PI * 2) / 8;
          g.fillText(i % 2 ? '1' : '0', x + Math.cos(a) * (rd + 2), y + Math.sin(a) * (rd + 2));
        }
      }
      if (sat) {
        g.strokeStyle = 'rgba(255,59,92,.8)'; g.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2, d = r * (0.8 + Math.random() * 0.9);
          g.beginPath(); g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); g.lineTo(x + Math.cos(a) * d + (Math.random() - 0.5) * 10, y + Math.sin(a) * d + (Math.random() - 0.5) * 10); g.stroke();
        }
      }

      // Cibles possibles et sélection
      if (attaquables.has(nd.id) && o.selection !== nd.id) {
        g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1; g.setLineDash([2, 5]);
        g.beginPath(); g.arc(x, y, rd + 4, now, now + Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
      if (o.selection === nd.id) {
        const k = rd + 8 + 2 * Math.sin(now * 6);
        g.strokeStyle = '#ffffff'; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i * Math.PI) / 2 + now * 0.6;
          const cx = x + Math.cos(a) * k, cy = y + Math.sin(a) * k;
          g.beginPath();
          g.moveTo(cx + Math.cos(a + 2.3) * 8, cy + Math.sin(a + 2.3) * 8);
          g.lineTo(cx, cy);
          g.lineTo(cx + Math.cos(a - 2.3) * 8, cy + Math.sin(a - 2.3) * 8);
          g.stroke();
        }
      }
      // Les améliorations : de petits badges au-dessus du nœud.
      const ups = LISTE_AMELIORATIONS.filter((k) => up(nd, k) > 0);
      if (ups.length) {
        const tb = Math.max(9, 11 * s);
        g.font = 'bold ' + tb + 'px ui-monospace, monospace';
        const w = tb * 1.6;
        ups.forEach((k, i) => {
          const bx = x + (i - (ups.length - 1) / 2) * w, by = y - rd - tb * 0.9;
          g.fillStyle = 'rgba(4,10,20,.85)'; g.beginPath(); g.arc(bx, by, tb * 0.75, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#ffd54a'; g.lineWidth = 1; g.stroke();
          g.fillStyle = '#ffd54a'; g.fillText(AMELIORATIONS[k].glyphe, bx, by + 0.5);
          for (let l = 0; l < up(nd, k); l++) g.fillRect(bx - 4 + l * 3.2, by + tb * 0.85, 2, 2);
        });
        if (up(nd, 'tourelle')) {
          const a = now * 2;
          g.strokeStyle = 'rgba(255,213,74,.7)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); g.lineTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6)); g.stroke();
        }
      }
      // La cache de données.
      if (E.ev && E.ev.k === 'cache' && E.ev.n === nd.id && E.ev.fin > E.temps) {
        const k = (now * 1.5) % 1;
        g.strokeStyle = 'rgba(255,213,74,' + (1 - k) + ')'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, rd + 6 + k * 30, 0, Math.PI * 2); g.stroke();
        g.font = '900 ' + Math.max(11, 15 * s) + 'px ui-monospace, monospace';
        g.fillStyle = '#ffd54a';
        g.fillText('◈ +' + EVENEMENTS.cache.prime, x, y - rd - Math.max(14, 20 * s));
      }
      if (nd.type === 'noyau' && !nd.eteint && nd.base >= 0) {
        g.font = `bold ${Math.max(9, 12 * s)}px ui-monospace, monospace`;
        g.fillStyle = rgba(c, 0.95);
        g.fillText(E.joueurs[nd.base].nom.toUpperCase(), x, y + rd + Math.max(10, 14 * s));
      }
    }

    // Particules et ondes.
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.vie) { parts.splice(i, 1); continue; }
      if (p.t < 0) continue;
      const k = p.t / p.vie;
      if (p.k === 'p') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93;
        const q = ecran(p.x, p.y);
        const r = Math.max(1.5, p.r * s * 2.2) * (1 - k * 0.6);
        g.globalAlpha = 1 - k;
        if (p.plus) { g.fillStyle = p.c; g.font = `bold ${r * 4}px ui-monospace`; g.fillText('+', q.x, q.y); }
        else g.drawImage(lueur(p.c), q.x - r * 2, q.y - r * 2, r * 4, r * 4);
      } else if (p.k === 'o') {
        const q = ecran(p.x, p.y);
        g.globalAlpha = (1 - k) * 0.9;
        g.strokeStyle = p.c; g.lineWidth = Math.max(1, p.ep * (1 - k));
        g.beginPath(); g.arc(q.x, q.y, Math.max(1, p.r1 * s * (0.2 + k)), 0, Math.PI * 2); g.stroke();
      } else if (p.k === 'f') {
        const e = k * k * (3 - 2 * k);
        const mx = (p.x + p.x2) / 2 + 60, my = (p.y + p.y2) / 2 - 60;
        const bx = (1 - e) * (1 - e) * p.x + 2 * (1 - e) * e * mx + e * e * p.x2;
        const by = (1 - e) * (1 - e) * p.y + 2 * (1 - e) * e * my + e * e * p.y2;
        const q = ecran(bx, by);
        g.globalAlpha = 1;
        g.drawImage(lueur(p.c), q.x - 7, q.y - 7, 14, 14);
      }
    }
    g.globalAlpha = 1;
    for (let i = eclairs.length - 1; i >= 0; i--) {
      const e = eclairs[i];
      e.t += dt;
      if (e.t >= e.vie) { eclairs.splice(i, 1); continue; }
      g.globalAlpha = 1 - e.t / e.vie;
      for (const [lw, col] of [[6, rgba(e.c, 0.35)], [2, '#ffffff']]) {
        g.strokeStyle = col; g.lineWidth = lw;
        g.beginPath();
        e.pts.forEach(([x, y], k) => { const q = ecran(x, y); if (k) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); });
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    // Textes flottants.
    for (let i = textes.length - 1; i >= 0; i--) {
      const t = textes[i];
      t.t += dt;
      if (t.t >= t.vie) { textes.splice(i, 1); continue; }
      const k = t.t / t.vie;
      const q = ecran(t.x, t.y);
      const taille = t.gros ? Math.max(14, 22 * s) : Math.max(11, 15 * s);
      g.font = `900 ${taille * (t.gros && k < 0.1 ? 1.4 - k * 4 : 1)}px ui-monospace, monospace`;
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillText(t.s, q.x + 1.5, q.y - k * 30 + 1.5);
      g.fillStyle = t.c;
      g.fillText(t.s, q.x, q.y - k * 30);
    }
    g.globalAlpha = 1;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Éclair d'écran et glitch.
    if (flash.a > 0.01) {
      g.fillStyle = flash.c; g.globalAlpha = flash.a; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      flash.a *= Math.pow(0.03, dt);
    }
    // Panne : l'écran clignote ; tempête : des traînées de données.
    if (evenement(E, 'panne')) {
      g.fillStyle = 'rgba(0,0,0,' + (0.3 + (Math.sin(now * 23) > 0.6 ? 0.2 : 0)) + ')';
      g.fillRect(0, 0, W, H);
    }
    if (evenement(E, 'tempete')) {
      g.strokeStyle = 'rgba(46,242,255,.14)'; g.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const yy = ((now * 300 + i * 97) % (H + 60)) - 30, xx = (i * 173) % W; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - 40, yy - 70); g.stroke(); }
    }
    if (annonce) {
      annonce.t += dt;
      const k = annonce.t / 2.4;
      if (k >= 1) annonce = null;
      else {
        const al = k < 0.1 ? k / 0.1 : k > 0.75 ? (1 - k) / 0.25 : 1;
        const tt = Math.min(34, W / 14);
        g.globalAlpha = al;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '900 ' + tt + 'px ui-monospace, monospace';
        const yy = zone.haut + 50;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, yy - tt, W, tt * 2.6);
        g.fillStyle = '#ff3df0'; g.fillText(annonce.s, W / 2 + 3, yy);
        g.fillStyle = '#2ef2ff'; g.fillText(annonce.s, W / 2 - 3, yy);
        g.fillStyle = '#ffffff'; g.fillText(annonce.s, W / 2, yy);
        g.font = Math.max(12, tt * 0.42) + 'px ui-monospace, monospace';
        g.fillStyle = '#ffd54a'; g.fillText(annonce.sous, W / 2, yy + tt * 0.95);
        g.globalAlpha = 1;
      }
    }
    if (o.danger > 0) {
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(255,0,40,0)'); v.addColorStop(1, `rgba(255,0,40,${0.28 * o.danger * (0.6 + 0.4 * Math.sin(now * 8))})`);
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    }
    if (glitch > 0) {
      glitch -= dt;
      for (let i = 0; i < 6; i++) {
        const y = Math.random() * H, h = 4 + Math.random() * 26, dx = (Math.random() - 0.5) * 40;
        g.drawImage(canvas, 0, y * dpr, canvas.width, h * dpr, dx, y, W, h);
      }
    }
  }

  window.addEventListener('resize', taille);
  taille();
  return {
    taille, dessiner, effets, noeudSous, ecran,
    /** La palette des joueurs et le style du joueur j (personnalisation). */
    style: (palette, st) => { PALETTE = palette ? [...palette] : [...COULEURS]; STYLE = st || { j: -1, forme: 'hexa', trainee: 'ligne' }; },
    secouer: (v) => { secousse = Math.max(secousse, v); },
    eclairer: (c, a) => { flash = { c, a }; },
  };
}
