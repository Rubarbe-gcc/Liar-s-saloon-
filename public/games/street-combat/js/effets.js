/**
 * STREET COMBAT — les effets : impacts, étincelles, textes, projectiles,
 * zones, faisceaux, et les cinématiques des ultimes (une par combattant).
 *
 * Le moteur raconte ce qui se passe (c.ev) ; `traiter` en tire des effets
 * qui vivent quelques images. Tout se dessine dans l'arène (1000 × 600).
 */

import { PERSO } from '../../../shared/street/persos.js';
import { ARENE } from '../../../shared/street/combat.js';
import { rgba, teinte, etoile, dessinerPortrait } from './dessin.js';

const L = ARENE.L;
const H = ARENE.H;
const SOL = ARENE.SOL;
const TAU = Math.PI * 2;
const hasardFixe = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

export function creerEffets() {
  return { parts: [], anneaux: [], textes: [], faisceaux: [], annonces: [], combos: [null, null], noms: [null, null], secousse: 0, flash: null, portrait: null, cine: null, t: 0 };
}

/* ------------------------------------------------------------------ */
/* Les événements du moteur                                            */
/* ------------------------------------------------------------------ */

function etincelles(fx, x, y, n, c, vitesse = 7, grav = 0.25) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const v = vitesse * (0.4 + Math.random());
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, vie: 18 + Math.random() * 20, max: 38, r: 1.5 + Math.random() * 2.5, c, grav, type: 'etincelle' });
  }
}

export function traiter(fx, ev, c) {
  switch (ev.type) {
    case 'impact': {
      const n = ev.force >= 3 ? 50 : ev.force >= 2 ? 26 : 14;
      etincelles(fx, ev.x, ev.y, n, ev.couleur, ev.force >= 2 ? 9 : 6);
      etincelles(fx, ev.x, ev.y, Math.ceil(n / 3), '#ffffff', 5);
      fx.anneaux.push({ x: ev.x, y: ev.y, r: 8, max: ev.force >= 2 ? 90 : 50, vie: 16, c: ev.couleur });
      if (ev.force >= 2) fx.secousse = Math.max(fx.secousse, ev.force * 3);
      if (ev.effet === 'gel') for (let i = 0; i < 8; i++) fx.parts.push({ x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5, vie: 30, max: 30, r: 3, c: '#e6faff', grav: 0.2, type: 'eclat' });
      break;
    }
    case 'garde':
      fx.anneaux.push({ x: ev.x, y: ev.y, r: 20, max: 46, vie: 12, c: ev.couleur, garde: true });
      etincelles(fx, ev.x, ev.y, 6, '#bdf3ff', 4);
      break;
    case 'texte':
      fx.textes.push({ x: ev.x, y: ev.y, texte: ev.texte, c: ev.couleur, vie: ev.gros ? 70 : 45, max: ev.gros ? 70 : 45, gros: !!ev.gros });
      break;
    case 'annonce':
      fx.annonces.push({ texte: ev.texte, vie: ev.duree, max: ev.duree, gros: !!ev.gros, ko: !!ev.ko, retard: ev.retard || 0 });
      break;
    case 'combo':
      fx.combos[ev.joueur] = { n: ev.n, degats: ev.degats, vie: 90 };
      break;
    case 'combo-fin':
      if (fx.combos[ev.joueur]) fx.combos[ev.joueur].vie = Math.min(fx.combos[ev.joueur].vie, 60);
      break;
    case 'special': case 'combo-nom': case 'saisie': {
      const j = c.joueurs[ev.joueur];
      fx.noms[ev.joueur] = { texte: ev.nom, vie: 70, max: 70, c: PERSO[j.id].c.c1, sorte: ev.type };
      if (ev.type !== 'combo-nom') fx.flash = { c: PERSO[j.id].c.c1, vie: 8, max: 8, a: 0.25 };
      break;
    }
    case 'faisceau':
      fx.faisceaux.push({ joueur: ev.joueur, def: ev.def, t: 0, duree: ev.duree });
      break;
    case 'teleport':
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * TAU;
        fx.parts.push({ x: ev.x, y: ev.y - 80 + (Math.random() - 0.5) * 120, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, vie: 26, max: 26, r: 4 + Math.random() * 6, c: PERSO[c.joueurs[ev.joueur].id].c.c2, grav: 0, type: 'fumee' });
      }
      break;
    case 'soin':
      for (let i = 0; i < 18; i++) fx.parts.push({ x: ev.x + (Math.random() - 0.5) * 60, y: ev.y - Math.random() * 140, vx: 0, vy: -1 - Math.random() * 2, vie: 40, max: 40, r: 3, c: '#7dffb0', grav: 0, type: 'rond' });
      break;
    case 'chute':
      for (let i = 0; i < 12; i++) fx.parts.push({ x: ev.x + (Math.random() - 0.5) * 80, y: ev.y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 2, vie: 30, max: 30, r: 6 + Math.random() * 8, c: '#d8c8b0', grav: 0, type: 'fumee' });
      fx.secousse = Math.max(fx.secousse, 4);
      break;
    case 'secousse':
      fx.secousse = Math.max(fx.secousse, ev.force);
      break;
    case 'statut': {
      const j = c.joueurs[ev.joueur];
      const col = ev.nom === 'poison' ? '#5cff6a' : '#ff8a1a';
      fx.textes.push({ x: j.x + (Math.random() - 0.5) * 30, y: j.y - 150, texte: '-1', c: col, vie: 30, max: 30 });
      break;
    }
    case 'ulti': {
      const j = c.joueurs[ev.joueur];
      fx.portrait = { joueur: ev.joueur, id: j.id, nom: ev.nom, t: 0, image: null };
      fx.flash = { c: '#ffffff', vie: 10, max: 10, a: 0.7 };
      break;
    }
    case 'ulti-cine':
      fx.portrait = null;
      fx.cine = { joueur: ev.joueur, visuel: ev.visuel, t: 0, duree: ev.duree };
      break;
    case 'ko-coup':
      fx.flash = { c: '#ffffff', vie: 16, max: 16, a: 0.8 };
      fx.secousse = 14;
      break;
    default: break;
  }
}

export function avancerEffets(fx) {
  fx.t += 1;
  for (const p of fx.parts) {
    p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.96; p.vie -= 1;
    if (p.type === 'fumee') { p.r *= 1.03; p.vy -= 0.02; }
  }
  fx.parts = fx.parts.filter((p) => p.vie > 0).slice(-600);
  for (const a of fx.anneaux) { a.vie -= 1; a.r += (a.max - a.r) * 0.25; }
  fx.anneaux = fx.anneaux.filter((a) => a.vie > 0);
  for (const t of fx.textes) { t.vie -= 1; t.y -= t.gros ? 0.7 : 1.1; }
  fx.textes = fx.textes.filter((t) => t.vie > 0);
  for (const a of fx.annonces) { if (a.retard > 0) a.retard -= 1; else a.vie -= 1; }
  fx.annonces = fx.annonces.filter((a) => a.vie > 0);
  for (const f of fx.faisceaux) f.t += 1;
  fx.faisceaux = fx.faisceaux.filter((f) => f.t < f.duree + 8);
  for (let k = 0; k < 2; k++) {
    if (fx.combos[k]) { fx.combos[k].vie -= 1; if (fx.combos[k].vie <= 0) fx.combos[k] = null; }
    if (fx.noms[k]) { fx.noms[k].vie -= 1; if (fx.noms[k].vie <= 0) fx.noms[k] = null; }
  }
  if (fx.flash) { fx.flash.vie -= 1; if (fx.flash.vie <= 0) fx.flash = null; }
  if (fx.portrait) fx.portrait.t += 1;
  if (fx.cine) { fx.cine.t += 1; if (fx.cine.t > fx.cine.duree) fx.cine = null; }
  fx.secousse *= 0.86;
  if (fx.secousse < 0.3) fx.secousse = 0;
}

/* ------------------------------------------------------------------ */
/* Petits outils de dessin                                             */
/* ------------------------------------------------------------------ */

function halo(g, x, y, r, c, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(c, a));
  gr.addColorStop(0.4, rgba(c, a * 0.4));
  gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function eclair(g, x0, y0, x1, y1, c, ep = 3, seg = 9, graine = 0) {
  g.strokeStyle = c; g.lineWidth = ep; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x0, y0);
  for (let i = 1; i < seg; i++) {
    const f = i / seg;
    g.lineTo(x0 + (x1 - x0) * f + (hasardFixe(graine + i) - 0.5) * 40, y0 + (y1 - y0) * f + (hasardFixe(graine + i * 3) - 0.5) * 20);
  }
  g.lineTo(x1, y1); g.stroke();
}
const lumiere = (g, f) => { g.save(); g.globalCompositeOperation = 'lighter'; f(); g.restore(); };

/* ------------------------------------------------------------------ */
/* Projectiles, zones, faisceaux                                       */
/* ------------------------------------------------------------------ */

export function dessinerProjectiles(g, c, t) {
  for (const p of c.projectiles) {
    const k = PERSO[c.joueurs[p.j].id].c;
    const d = p.def;
    const r = d.rayon || 18;
    const dir = Math.sign(p.vx) || p.dir;
    g.save();
    g.translate(p.x, p.y);
    switch (d.forme) {
      case 'flamme': case 'rocher': case 'goutte': case 'boule': case 'orbe': case 'bulle': case 'ame': case 'balle': case 'trou-noir': case 'etoile': case 'plume':
      default:
        dessinerBoule(g, d.forme, r, k, dir, t, p);
        break;
      case 'onde':
        lumiere(g, () => {
          for (let i = 0; i < 3; i++) { g.fillStyle = rgba(k.c1, 0.35 - i * 0.1); g.beginPath(); g.ellipse(-dir * i * 18, 0, r * 0.8, r * 1.4 - i * 6, 0, 0, TAU); g.fill(); }
          halo(g, 0, 0, r * 1.8, k.faisceau, 0.6);
        });
        break;
      case 'aiguille':
        lumiere(g, () => {
          g.scale(dir, 1);
          halo(g, 0, 0, 34, k.c1, 0.6);
          g.fillStyle = '#ffd23f';
          g.beginPath(); g.moveTo(-40, -3); g.lineTo(18, -6); g.lineTo(34, 0); g.lineTo(18, 6); g.lineTo(-40, 3); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-40, 0, 5, 0, TAU); g.fill();
        });
        break;
      case 'sablier':
        g.rotate(t / 8);
        lumiere(g, () => halo(g, 0, 0, 30, k.c1, 0.5));
        g.fillStyle = '#ffd23f'; g.fillRect(-12, -16, 24, 4); g.fillRect(-12, 12, 24, 4);
        g.fillStyle = rgba('#e8f8ff', 0.8);
        g.beginPath(); g.moveTo(-10, -12); g.lineTo(10, -12); g.lineTo(2, 0); g.lineTo(10, 12); g.lineTo(-10, 12); g.lineTo(-2, 0); g.closePath(); g.fill();
        g.fillStyle = '#e8c070'; g.beginPath(); g.moveTo(-6, 12); g.lineTo(6, 12); g.lineTo(0, 5); g.fill();
        break;
      case 'poing':
        lumiere(g, () => {
          g.scale(dir, 1);
          for (let i = 1; i < 5; i++) halo(g, -i * 16, 0, r * (1.4 - i * 0.2), '#ffe680', 0.5 - i * 0.1);
          halo(g, 0, 0, r * 2.2, '#ffd23f', 0.8);
          g.strokeStyle = rgba('#ffffff', 0.8); g.lineWidth = 3;
          for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-10 - i * 12, 0, r + i * 6, -1, 1); g.stroke(); }
        });
        g.scale(dir, 1);
        g.fillStyle = '#d8102a'; g.beginPath(); g.ellipse(2, 0, r * 0.75, r * 0.65, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-2, -5, r * 0.3, r * 0.2, 0, 0, TAU); g.fill();
        break;
      case 'eclat':
        g.rotate(t / 4);
        lumiere(g, () => halo(g, 0, 0, r * 2.2, '#c0d8ff', 0.6));
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.5, 0); g.lineTo(0, r); g.lineTo(-r * 0.5, 0); g.closePath(); g.fill();
        g.strokeStyle = '#7a8ac8'; g.lineWidth = 1; g.stroke();
        break;
      case 'lame': case 'lance':
        lumiere(g, () => {
          g.scale(dir, 1);
          const l = d.forme === 'lance' ? 70 : 34;
          const gr = g.createLinearGradient(-l, 0, l * 0.4, 0);
          gr.addColorStop(0, rgba(k.faisceau, 0)); gr.addColorStop(1, '#ffffff');
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(-l, -3); g.lineTo(l * 0.4, -5); g.lineTo(l * 0.4 + 18, 0); g.lineTo(l * 0.4, 5); g.lineTo(-l, 3); g.fill();
          halo(g, l * 0.3, 0, 26, k.faisceau, 0.6);
        });
        break;
      case 'croissant': case 'lame-geante': case 'vent':
        lumiere(g, () => {
          g.scale(dir, 1);
          const R = d.forme === 'lame-geante' ? r * 1.6 : r;
          g.fillStyle = d.forme === 'vent' ? rgba('#e6f8ff', 0.7) : rgba(k.faisceau, 0.85);
          g.beginPath(); g.arc(0, 0, R, -1.3, 1.3); g.arc(-R * 0.45, 0, R * 0.85, 1.2, -1.2, true); g.closePath(); g.fill();
          halo(g, 0, 0, R * 1.5, k.c1, 0.4);
          if (d.forme === 'vent') { g.strokeStyle = rgba('#ffffff', 0.5); g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-R - 10 - i * 14, -8 + i * 8); g.lineTo(-R * 2.4 - i * 14, -8 + i * 8); g.stroke(); } }
        });
        break;
      case 'missile':
        g.rotate(Math.atan2(p.vy, p.vx));
        lumiere(g, () => { for (let i = 0; i < 5; i++) halo(g, -18 - i * 10, (Math.random() - 0.5) * 4, 10 - i, '#ff9a2a', 0.7 - i * 0.12); });
        g.fillStyle = '#d0d0e0'; g.beginPath(); g.roundRect(-16, -5, 28, 10, 4); g.fill();
        g.fillStyle = '#ff3a3a'; g.beginPath(); g.moveTo(12, -5); g.lineTo(22, 0); g.lineTo(12, 5); g.fill();
        g.fillStyle = '#8a8aa0'; g.beginPath(); g.moveTo(-16, -5); g.lineTo(-22, -10); g.lineTo(-12, -5); g.moveTo(-16, 5); g.lineTo(-22, 10); g.lineTo(-12, 5); g.fill();
        break;
    }
    g.restore();
  }
}

function dessinerBoule(g, forme, r, k, dir, t, p) {
  if (forme === 'rocher') {
    g.rotate(t / 6 * dir);
    g.fillStyle = '#6a5038';
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const rr = r * (0.8 + hasardFixe(i) * 0.3); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, TAU); g.fill();
    if (p.def.effet === 'brulure') lumiere(g, () => halo(g, 0, 0, r * 1.6, '#ff6a00', 0.6));
    return;
  }
  if (forme === 'trou-noir') {
    lumiere(g, () => {
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = rgba(i % 2 ? '#ff50ff' : '#c814ff', 0.6); g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, 0, r * 1.6 + i * 6, r * 0.5 + i * 2, t / 10 + i, 0, TAU); g.stroke();
      }
      halo(g, 0, 0, r * 2.2, '#c814ff', 0.6);
    });
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, r * 0.75, 0, TAU); g.fill();
    return;
  }
  if (forme === 'etoile' || forme === 'plume') {
    lumiere(g, () => halo(g, 0, 0, r * 2, k.c1, 0.6));
    if (forme === 'etoile') etoile(g, 0, 0, r, '#ffffff', t / 5);
    else { g.rotate(Math.atan2(p.vy, p.vx)); g.fillStyle = '#fff6c8'; g.beginPath(); g.ellipse(0, 0, r * 1.4, r * 0.45, 0, 0, TAU); g.fill(); }
    return;
  }
  if (forme === 'bulle') {
    g.strokeStyle = rgba('#c8f4ff', 0.9); g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    g.fillStyle = rgba('#5ad8ff', 0.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-r * 0.35, -r * 0.35, r * 0.18, 0, TAU); g.fill();
    return;
  }
  if (forme === 'ame') {
    lumiere(g, () => { halo(g, 0, 0, r * 2, k.c1, 0.7); g.fillStyle = rgba('#e8d4ff', 0.8); g.beginPath(); g.arc(0, 0, r * 0.6, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-r * 0.6, 0); g.quadraticCurveTo(-r * 2 * dir, Math.sin(t / 3) * 8, -r * 2.6 * dir, 0); g.lineTo(-r * 0.4, r * 0.4); g.fill(); });
    g.fillStyle = '#1a0030'; g.beginPath(); g.arc(-3, -2, 2.5, 0, TAU); g.arc(4, -2, 2.5, 0, TAU); g.fill();
    return;
  }
  const couleur = forme === 'flamme' ? '#ff7a1a' : forme === 'goutte' ? '#5cff6a' : forme === 'balle' ? '#ffe680' : k.faisceau;
  lumiere(g, () => {
    // La traînée.
    for (let i = 1; i < 6; i++) halo(g, -dir * i * r * 0.55, Math.sin(t / 2 + i) * 2, r * (1.2 - i * 0.14), couleur, 0.45 - i * 0.06);
    halo(g, 0, 0, r * 2.1, couleur, 0.85);
    if (forme === 'boule' || forme === 'orbe') {
      g.strokeStyle = rgba('#ffffff', 0.7); g.lineWidth = 2;
      for (let i = 0; i < 2; i++) { g.beginPath(); g.ellipse(0, 0, r * 0.9, r * 0.35, t / 4 + i * 1.6, 0, TAU); g.stroke(); }
    }
  });
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(0, 0, r * (forme === 'balle' ? 0.5 : 0.45), 0, TAU); g.fill();
}

export function dessinerZones(g, c, t) {
  for (const z of c.zones) {
    const d = z.def;
    const k = PERSO[c.joueurs[z.j].id].c;
    const avant = z.t < d.delai;
    const actif = z.t - d.delai;
    const fin = Math.max(0, 1 - Math.max(0, actif - d.duree) / 20);
    const x = z.x;
    if (avant) {
      // Le présage : un cercle au sol qui se resserre.
      const p = z.t / d.delai;
      g.save();
      g.strokeStyle = rgba(k.c1, 0.4 + p * 0.5); g.lineWidth = 2 + p * 2;
      g.beginPath(); g.ellipse(x, SOL, d.rayon * (1.4 - p * 0.4), 10, 0, 0, TAU); g.stroke();
      if (d.hauteur >= 500) { g.fillStyle = rgba(k.c1, 0.08 + p * 0.1); g.fillRect(x - d.rayon * 0.5, 0, d.rayon, SOL); }
      g.restore();
      if (d.forme === 'lune') { const y = -80 + p * (SOL - 120); lumiere(g, () => halo(g, x, y, 70, '#dcebff', 0.9)); g.fillStyle = '#eef6ff'; g.beginPath(); g.arc(x, y, 38, 0, TAU); g.fill(); g.fillStyle = '#c8d8f0'; g.beginPath(); g.arc(x - 10, y - 8, 7, 0, TAU); g.arc(x + 12, y + 10, 5, 0, TAU); g.fill(); }
      continue;
    }
    g.save();
    g.globalAlpha = fin;
    switch (d.forme) {
      case 'eclair': case 'rayon-ciel':
        lumiere(g, () => {
          const c1 = d.forme === 'eclair' ? '#fff3a0' : '#fff8d2';
          if (d.forme === 'eclair') { eclair(g, x + 20, 0, x, SOL, rgba(c1, 0.9), 6, 10, z.t); eclair(g, x - 10, 0, x, SOL, '#ffffff', 2.5, 10, z.t + 50); }
          else { const gr = g.createLinearGradient(x - d.rayon, 0, x + d.rayon, 0); gr.addColorStop(0, rgba(c1, 0)); gr.addColorStop(0.5, rgba(c1, 0.9)); gr.addColorStop(1, rgba(c1, 0)); g.fillStyle = gr; g.fillRect(x - d.rayon, 0, d.rayon * 2, SOL); }
          halo(g, x, SOL - 10, 90, c1, 0.8);
        });
        break;
      case 'feu': case 'pilier':
        lumiere(g, () => {
          for (let i = 0; i < 18; i++) {
            const v = (z.t * 4 + i * 23) % d.hauteur;
            halo(g, x + Math.sin(z.t / 4 + i) * d.rayon * 0.4, SOL - v, 34 - v / d.hauteur * 22, i % 2 ? '#ff9a1a' : '#ff3a00', 0.6);
          }
        });
        break;
      case 'blizzard':
        g.fillStyle = rgba('#c8f0ff', 0.18); g.beginPath(); g.ellipse(x, SOL - 100, d.rayon, 110, 0, 0, TAU); g.fill();
        for (let i = 0; i < 40; i++) { const a = z.t / 8 + i; const rr = (i * 7) % d.rayon; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + Math.cos(a) * rr, SOL - 100 + Math.sin(a * 1.3) * rr * 0.8, 2, 0, TAU); g.fill(); }
        break;
      case 'seisme':
        g.strokeStyle = rgba(k.c1, 0.9); g.lineWidth = 4;
        for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x, SOL); g.lineTo(x + i * d.rayon * 0.3 + (hasardFixe(i) - 0.5) * 20, SOL + 10 + Math.abs(i) * 6); g.stroke(); }
        for (let i = 0; i < 8; i++) { const sx = x + (hasardFixe(i + z.t) - 0.5) * d.rayon * 2; g.fillStyle = '#8a6a48'; g.fillRect(sx, SOL - 8 - (actif % 12) * 2, 8, 8); }
        lumiere(g, () => halo(g, x, SOL, d.rayon, k.c1, 0.4));
        break;
      case 'flaque':
        g.fillStyle = rgba('#3cdc64', 0.55); g.beginPath(); g.ellipse(x, SOL + 4, d.rayon, 12, 0, 0, TAU); g.fill();
        for (let i = 0; i < 6; i++) { const v = (z.t + i * 10) % 40; g.fillStyle = rgba('#8aff8a', 0.6 * (1 - v / 40)); g.beginPath(); g.arc(x + (hasardFixe(i) - 0.5) * d.rayon * 1.6, SOL - v, 4, 0, TAU); g.fill(); }
        break;
      case 'champ':
        lumiere(g, () => {
          g.strokeStyle = rgba(k.c1, 0.7); g.lineWidth = 3;
          for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x, SOL - 60, d.rayon * (1 - i * 0.2), 60 - i * 12 + Math.sin(z.t / 4 + i) * 4, 0, 0, TAU); g.stroke(); }
          halo(g, x, SOL - 80, d.rayon * 1.2, k.c1, 0.35);
          if (d.souleve) for (let i = 0; i < 10; i++) { g.fillStyle = rgba('#e8d4ff', 0.6); g.fillRect(x + (hasardFixe(i) - 0.5) * d.rayon * 2, SOL - ((z.t * 3 + i * 20) % 200), 3, 10); }
        });
        break;
      case 'lune':
        lumiere(g, () => { halo(g, x, SOL - 40, 160, '#dcebff', Math.max(0, 0.9 - actif / 30)); });
        break;
      case 'nova': case 'onde': case 'vague': {
        const p = Math.min(1, actif / d.duree);
        lumiere(g, () => {
          if (d.forme === 'vague') {
            g.fillStyle = rgba('#4fd8ff', 0.6);
            g.beginPath(); g.moveTo(x - d.rayon * 0.3, SOL); g.quadraticCurveTo(x, SOL - d.hauteur, x + d.rayon * 0.5, SOL - d.hauteur * 0.6); g.quadraticCurveTo(x + d.rayon * 0.2, SOL - 30, x + d.rayon * 0.6, SOL); g.fill();
          } else {
            g.strokeStyle = rgba(k.c1, 0.9 * (1 - p)); g.lineWidth = 10 * (1 - p) + 2;
            g.beginPath(); g.ellipse(x, SOL - 90, d.rayon * (0.3 + p), d.rayon * (0.3 + p) * 0.8, 0, 0, TAU); g.stroke();
            halo(g, x, SOL - 90, d.rayon * (0.4 + p * 0.8), k.c1, 0.5 * (1 - p));
            if (d.forme === 'nova') for (let i = 0; i < 6; i++) etoile(g, x + Math.cos(i + p * 3) * d.rayon * p, SOL - 90 + Math.sin(i + p * 3) * d.rayon * p * 0.7, 6, '#ffffff', p * 5);
          }
        });
        break;
      }
      case 'pic': {
        const p = Math.min(1, actif / 6);
        const h = d.hauteur * p;
        const gr = g.createLinearGradient(0, SOL - h, 0, SOL);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, k.c1);
        g.fillStyle = gr;
        for (const [dx, f] of [[-18, 0.6], [0, 1], [16, 0.7]]) { g.beginPath(); g.moveTo(x + dx - 12, SOL); g.lineTo(x + dx, SOL - h * f); g.lineTo(x + dx + 12, SOL); g.fill(); }
        break;
      }
      case 'etoiles':
        for (let i = 0; i < 6; i++) {
          const v = ((actif * 14 + i * 90) % (SOL + 40));
          lumiere(g, () => { halo(g, x + (hasardFixe(i) - 0.5) * d.rayon * 2, v - 40, 24, k.c1, 0.7); });
          etoile(g, x + (hasardFixe(i) - 0.5) * d.rayon * 2, v - 40, 8, '#ffffff', v / 20);
        }
        break;
      case 'horloge': {
        const p = Math.min(1, actif / 8);
        g.fillStyle = rgba('#b8f4ec', 0.12 * fin); g.fillRect(0, 0, L, H);
        g.save(); g.translate(x, SOL - 110);
        lumiere(g, () => halo(g, 0, 0, d.rayon * 1.3, k.c1, 0.4));
        g.strokeStyle = rgba('#ffd23f', 0.9); g.lineWidth = 4;
        g.beginPath(); g.arc(0, 0, d.rayon * p, 0, TAU); g.stroke();
        g.strokeStyle = rgba(k.c1, 0.8); g.lineWidth = 2;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * d.rayon * 0.82 * p, Math.sin(a) * d.rayon * 0.82 * p); g.lineTo(Math.cos(a) * d.rayon * 0.95 * p, Math.sin(a) * d.rayon * 0.95 * p); g.stroke(); }
        // Les aiguilles se figent.
        const fige = Math.max(0, 1 - actif / 14);
        g.strokeStyle = '#ffd23f'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(-1.4 + fige * 6) * d.rayon * 0.5, Math.sin(-1.4 + fige * 6) * d.rayon * 0.5); g.stroke();
        g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(0.3 + fige * 20) * d.rayon * 0.75, Math.sin(0.3 + fige * 20) * d.rayon * 0.75); g.stroke();
        g.restore();
        break;
      }
      case 'fissure':
        lumiere(g, () => { eclair(g, x - d.rayon, SOL - 20, x + d.rayon, SOL - 160, rgba('#ff50ff', 0.9), 5, 8, z.t); halo(g, x, SOL - 90, d.rayon * 1.3, '#c814ff', 0.5); });
        break;
      default:
        lumiere(g, () => halo(g, x, SOL - 60, d.rayon, k.c1, 0.6));
    }
    g.restore();
  }
}

export function dessinerFaisceaux(g, fx, c) {
  for (const f of fx.faisceaux) {
    const j = c.joueurs[f.joueur];
    const k = PERSO[j.id].c;
    const d = f.def;
    const couleur = d.couleur || k.faisceau;
    const p = f.t < 6 ? f.t / 6 : f.t > f.duree ? Math.max(0, 1 - (f.t - f.duree) / 8) : 1;
    const ep = d.epaisseur * (0.6 + 0.4 * p) + Math.sin(f.t / 2) * 3;
    const x0 = j.x + j.dir * 40;
    const y = j.y - (d.depuisOeil ? 128 : 96);
    const long = d.portee * Math.min(1, f.t / 5);
    g.save();
    g.translate(x0, y);
    g.scale(j.dir, 1);
    lumiere(g, () => {
      if (d.cone) {
        const gr = g.createLinearGradient(0, 0, long, 0);
        gr.addColorStop(0, rgba('#ffffff', 0.9 * p)); gr.addColorStop(0.3, rgba(couleur, 0.8 * p)); gr.addColorStop(1, rgba(couleur, 0));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, -8); g.lineTo(long, -ep); g.lineTo(long, ep); g.lineTo(0, 8); g.fill();
        for (let i = 0; i < 6; i++) halo(g, ((f.t * 14 + i * 50) % long), Math.sin(f.t + i) * ep * 0.5, 24, '#ffb000', 0.5 * p);
      } else {
        const gr = g.createLinearGradient(0, -ep, 0, ep);
        gr.addColorStop(0, rgba(couleur, 0)); gr.addColorStop(0.35, rgba(couleur, 0.8 * p)); gr.addColorStop(0.5, rgba('#ffffff', p)); gr.addColorStop(0.65, rgba(couleur, 0.8 * p)); gr.addColorStop(1, rgba(couleur, 0));
        g.fillStyle = gr;
        g.fillRect(0, -ep, long, ep * 2);
        halo(g, 0, 0, ep * 1.6, couleur, p);
        halo(g, long, 0, ep * 1.4, couleur, 0.8 * p);
        if (d.attire || d.drain) for (let i = 0; i < 5; i++) { const xx = long - ((f.t * 12 + i * 60) % long); halo(g, xx, Math.sin(f.t / 3 + i) * ep * 0.4, 10, '#ffffff', 0.7 * p); }
        if (d.prisme) {
          const arc = ['#ff4a4a', '#ffb02a', '#ffe84a', '#4aff7a', '#4ac8ff', '#a05aff'];
          arc.forEach((c, i) => { g.fillStyle = rgba(c, 0.55 * p); g.fillRect(long * 0.15, -ep + (i * ep * 2) / arc.length, long * 0.85, (ep * 2) / arc.length); });
        }
      }
    });
    g.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Particules, textes, annonces                                        */
/* ------------------------------------------------------------------ */

export function dessinerParticules(g, fx) {
  lumiere(g, () => {
    for (const p of fx.parts) {
      const a = p.vie / p.max;
      if (p.type === 'fumee') continue;
      if (p.type === 'etincelle') {
        g.strokeStyle = rgba(p.c, a); g.lineWidth = p.r;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); g.stroke();
      } else {
        g.fillStyle = rgba(p.c, a); g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      }
    }
    for (const a of fx.anneaux) {
      g.strokeStyle = rgba(a.c, a.vie / 16); g.lineWidth = a.garde ? 4 : 3 + a.vie / 4;
      g.beginPath(); g.arc(a.x, a.y, a.r, 0, TAU); g.stroke();
      if (!a.garde && a.vie > 10) halo(g, a.x, a.y, a.r * 0.8, '#ffffff', (a.vie - 10) / 6);
    }
  });
  for (const p of fx.parts) {
    if (p.type !== 'fumee') continue;
    g.fillStyle = rgba(p.c, (p.vie / p.max) * 0.35);
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
  }
}

export function texteContour(g, texte, x, y, taille, c, contour = '#000', align = 'center', italique = false) {
  g.font = `${italique ? 'italic ' : ''}900 ${taille}px "Arial Black", Impact, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, taille / 6);
  g.strokeStyle = contour;
  g.strokeText(texte, x, y);
  g.fillStyle = c;
  g.fillText(texte, x, y);
}

export function dessinerTextes(g, fx) {
  for (const t of fx.textes) {
    const a = Math.min(1, t.vie / 15);
    const s = t.gros ? 1 + Math.max(0, (t.vie - t.max + 8) / 8) * 0.5 : 1;
    g.save();
    g.globalAlpha = a;
    texteContour(g, t.texte, t.x, t.y, (t.gros ? 26 : 22) * s, t.c);
    g.restore();
  }
}

/** Les annonces au centre : ROUND, FIGHT, K.O., PERFECT. */
export function dessinerAnnonces(g, fx) {
  for (const a of fx.annonces) {
    if (a.retard > 0) continue;
    const age = a.max - a.vie;
    const entree = Math.min(1, age / 10);
    const sortie = Math.min(1, a.vie / 12);
    const s = (a.gros ? 1.6 : 1.1) * (1 + (1 - entree) * 1.4);
    g.save();
    g.globalAlpha = sortie;
    g.translate(L / 2, H / 2 - 40);
    g.scale(s, s);
    if (a.ko) { g.rotate(-0.05); }
    const c = a.ko ? '#ff2a2a' : a.texte.startsWith('FIGHT') ? '#ffd23f' : a.texte.startsWith('PERFECT') ? '#7dffb0' : '#ffffff';
    g.shadowColor = c; g.shadowBlur = 30;
    texteContour(g, a.texte, 0, 0, 56, c, '#1a0a00', 'center', true);
    g.restore();
  }
}

/* ------------------------------------------------------------------ */
/* L'ultime : le portrait, puis la cinématique                         */
/* ------------------------------------------------------------------ */

/** Le portrait qui traverse l'écran au déclenchement de l'ultime. */
export function dessinerPortraitUlti(g, fx) {
  const P = fx.portrait;
  if (!P) return;
  const perso = PERSO[P.id];
  if (!P.image) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 300;
    dessinerPortrait(cv.getContext('2d'), perso, 300, { pose: 'repos', aura: 1, t: 10 });
    P.image = cv;
  }
  const t = P.t;
  const entree = Math.min(1, t / 10);
  const sortie = t > 40 ? Math.max(0, 1 - (t - 40) / 10) : 1;
  g.save();
  g.fillStyle = `rgba(0,0,0,${0.55 * sortie})`;
  g.fillRect(0, 0, L, H);
  // La bande diagonale.
  g.translate(L / 2, H / 2);
  g.rotate(-0.12);
  const largeur = L * 1.4 * entree;
  const gr = g.createLinearGradient(-largeur / 2, 0, largeur / 2, 0);
  gr.addColorStop(0, rgba(perso.c.c2, 0.95)); gr.addColorStop(0.5, rgba(perso.c.c1, 0.95)); gr.addColorStop(1, rgba(perso.c.c2, 0.95));
  g.globalAlpha = sortie;
  g.fillStyle = gr;
  g.fillRect(-largeur / 2, -95, largeur, 190);
  // Les lignes de vitesse.
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) { const y = -90 + i * 13; const x = ((t * 40 + i * 137) % (L * 1.4)) - L * 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 120, y); g.stroke(); }
  // Le portrait, qui glisse.
  const px = (P.joueur === 0 ? -1 : 1) * (L * 0.28) + (P.joueur === 0 ? -1 : 1) * (1 - entree) * 300 - 150;
  g.save();
  g.beginPath(); g.rect(-largeur / 2, -95, largeur, 190); g.clip();
  g.drawImage(P.image, px, -150, 300, 300);
  g.restore();
  // Le nom de l'ultime.
  texteContour(g, P.nom, P.joueur === 0 ? 120 : -120, 0, Math.min(54, 1300 / P.nom.length), '#ffffff', perso.c.c2, 'center', true);
  g.restore();
}

/** La cinématique de l'ultime, propre à chaque combattant. */
export function dessinerCineUlti(g, fx, c) {
  const C = fx.cine;
  if (!C) return;
  const j = c.joueurs[C.joueur];
  const o = c.joueurs[1 - C.joueur];
  const k = PERSO[j.id].c;
  const t = C.t;
  const A = { x: j.x, y: j.y - 90, dir: j.dir };
  const D = { x: o.x, y: o.y - 90 };
  g.save();
  // L'ambiance : un voile de la couleur du combattant.
  g.fillStyle = rgba(k.c2, 0.25 + Math.sin(t / 8) * 0.05);
  g.fillRect(0, 0, L, H);
  const f = ULTIS[C.visuel];
  if (f) f(g, t, A, D, k);
  // Le grand coup (image 70 du moteur) : un éclair blanc.
  if (t >= 68 && t < 80) { g.fillStyle = `rgba(255,255,255,${(80 - t) / 12})`; g.fillRect(0, 0, L, H); }
  g.restore();
  // Les bandes de cinéma.
  const b = Math.min(1, t / 10) * 64;
  g.fillStyle = '#000';
  g.fillRect(0, 0, L, b); g.fillRect(0, H - b, L, b);
  g.fillStyle = k.c1; g.fillRect(0, b - 2, L, 2); g.fillRect(0, H - b, L, 2);
}

const ULTIS = {
  /* RYU-KEN : une rafale de boules de ki, puis la grande. */
  hadoken(g, t, A, D, k) {
    lumiere(g, () => {
      for (let w = 0; w < 6; w++) {
        const p = Math.max(0, Math.min(1, (t - w * 9) / 30));
        if (p <= 0 || p >= 1) continue;
        const x = A.x + (D.x - A.x) * p;
        halo(g, x, A.y + Math.sin(w * 2) * 20, 50, k.faisceau, 0.9);
        halo(g, x, A.y + Math.sin(w * 2) * 20, 18, '#ffffff', 1);
      }
      if (t > 55 && t < 95) {
        const p = (t - 55) / 40;
        halo(g, A.x + (D.x - A.x) * Math.min(1, p * 1.4), A.y, 140 * (1 - p * 0.5), k.faisceau, 0.95);
        halo(g, A.x + (D.x - A.x) * Math.min(1, p * 1.4), A.y, 50, '#ffffff', 1);
      }
    });
  },
  /* BLAZERO : des météores de feu. */
  meteores(g, t, A, D) {
    lumiere(g, () => {
      for (let i = 0; i < 10; i++) {
        const p = (t - i * 7) / 30;
        if (p < 0) continue;
        const x = D.x + (hasardFixe(i) - 0.5) * 300 + (1 - Math.min(1, p)) * 300;
        const y = -60 + Math.min(1, p) * (SOL + 60);
        if (p < 1) { for (let q = 0; q < 6; q++) halo(g, x + q * 22, y - q * 22, 34 - q * 4, q ? '#ff6a00' : '#ffd23a', 0.7); }
        else if (p < 1.6) halo(g, x, SOL - 10, 120 * (p - 0.8), '#ff7a00', 1.6 - p);
      }
    });
  },
  /* FROSTBYTE : le zéro absolu, des colonnes de glace. */
  zero(g, t, A, D) {
    const p = Math.min(1, t / 60);
    g.fillStyle = `rgba(200,240,255,${p * 0.25})`; g.fillRect(0, 0, L, H);
    for (let i = -5; i <= 5; i++) {
      const x = D.x + i * 34;
      const h = Math.max(0, (p - Math.abs(i) * 0.05)) * 300;
      const gr = g.createLinearGradient(0, SOL - h, 0, SOL);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#4fc8ff');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - 18, SOL); g.lineTo(x - 4, SOL - h); g.lineTo(x + 6, SOL - h * 0.9); g.lineTo(x + 18, SOL); g.fill();
    }
    if (t > 70) lumiere(g, () => halo(g, D.x, D.y, (t - 70) * 8, '#bdf3ff', Math.max(0, 1 - (t - 70) / 40)));
  },
  /* SHADOW KIRA : des portails, des ombres qui frappent de partout. */
  vide(g, t, A, D, k) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t / 30;
      const x = D.x + Math.cos(a) * 150;
      const y = D.y + Math.sin(a) * 90;
      const r = Math.min(40, Math.max(0, t - i * 6) * 3);
      g.fillStyle = '#0a0014'; g.beginPath(); g.ellipse(x, y, r * 0.6, r, a, 0, TAU); g.fill();
      lumiere(g, () => { g.strokeStyle = rgba(k.c1, 0.9); g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, r * 0.6, r, a, 0, TAU); g.stroke(); });
      if ((t + i * 5) % 20 < 4 && t > 20) lumiere(g, () => { g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(D.x, D.y); g.stroke(); });
    }
  },
  /* THUNDEROX : la colère de la foudre. */
  foudre(g, t, A, D) {
    if (t % 6 < 3) { g.fillStyle = 'rgba(255,240,150,0.15)'; g.fillRect(0, 0, L, H); }
    lumiere(g, () => {
      for (let i = 0; i < 7; i++) {
        if (t < i * 9 || (t - i * 9) > 16) continue;
        const x = D.x + (hasardFixe(i) - 0.5) * 200;
        eclair(g, x + 40, 0, x, SOL, rgba('#ffe066', 0.95), 8, 12, i * 7 + t);
        eclair(g, x + 40, 0, x, SOL, '#ffffff', 2.5, 12, i * 7 + t);
        halo(g, x, SOL - 10, 80, '#ffe066', 0.8);
      }
    });
  },
  /* IRONCLAD : une salve de missiles, puis le laser. */
  omega(g, t, A, D) {
    for (let i = 0; i < 8; i++) {
      const p = (t - i * 5) / 26;
      if (p < 0 || p > 1.3) continue;
      const x = A.x + (D.x - A.x) * Math.min(1, p);
      const y = A.y - 60 - Math.sin(Math.min(1, p) * Math.PI) * (80 + i * 10);
      if (p < 1) { g.fillStyle = '#d0d0e0'; g.fillRect(x - 10, y - 3, 20, 6); lumiere(g, () => halo(g, x - 14 * A.dir, y, 12, '#ff9a2a', 0.8)); }
      else lumiere(g, () => halo(g, D.x + (hasardFixe(i) - 0.5) * 80, D.y + (hasardFixe(i + 9) - 0.5) * 80, 60, '#ffb04a', 1.3 - p));
    }
    if (t > 55 && t < 100) {
      const ep = 50 * (1 - (t - 55) / 45) + 6;
      lumiere(g, () => { g.fillStyle = rgba('#ff4040', 0.85); g.fillRect(Math.min(A.x, D.x - 300), A.y - ep / 2, Math.abs(D.x - A.x) + 600, ep); g.fillStyle = '#ffffff'; g.fillRect(Math.min(A.x, D.x - 300), A.y - ep / 6, Math.abs(D.x - A.x) + 600, ep / 3); });
    }
  },
  /* SERPENTA : le serpent géant qui enserre. */
  serpent(g, t, A, D) {
    const p = Math.min(1, t / 60);
    for (let i = 0; i < 46; i++) {
      const a = i * 0.32 + t / 9;
      const rr = (60 + i * 5) * (1 - p * 0.55);
      const x = D.x + Math.cos(a) * rr;
      const y = D.y + Math.sin(a) * rr * 0.55;
      g.fillStyle = i % 4 ? '#1e8a3a' : '#3cdc64';
      g.beginPath(); g.arc(x, y, Math.max(4, 22 - i * 0.4), 0, TAU); g.fill();
    }
    const a = t / 9;
    const hx = D.x + Math.cos(a) * 60 * (1 - p * 0.55);
    const hy = D.y + Math.sin(a) * 33 * (1 - p * 0.55);
    g.fillStyle = '#2aa04a'; g.beginPath(); g.ellipse(hx, hy, 30, 20, a, 0, TAU); g.fill();
    g.fillStyle = '#ffde3a'; g.beginPath(); g.arc(hx + 8, hy - 6, 4, 0, TAU); g.fill();
    if (t > 60) for (let i = 0; i < 10; i++) { g.fillStyle = rgba('#8aff8a', 0.6); g.beginPath(); g.arc(D.x + (hasardFixe(i + t) - 0.5) * 140, SOL - hasardFixe(i * 3 + t) * 120, 5, 0, TAU); g.fill(); }
  },
  /* CELESTIA : les étoiles convergent, la supernova. */
  supernova(g, t, A, D, k) {
    const p = Math.min(1, t / 70);
    lumiere(g, () => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + t / 14;
        const rr = 380 * (1 - p);
        etoile(g, D.x + Math.cos(a) * rr, D.y + Math.sin(a) * rr * 0.6, 9, i % 2 ? '#ffffff' : k.c1, t / 6);
      }
      if (t > 60) { const q = (t - 60) / 60; halo(g, D.x, D.y, 40 + q * 460, k.c1, Math.max(0, 1 - q)); halo(g, D.x, D.y, 40 + q * 200, '#ffffff', Math.max(0, 1 - q)); }
    });
  },
  /* GRAVOX : le trou noir qui aspire tout. */
  singularite(g, t, A, D, k) {
    const p = Math.min(1, t / 80);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU + t / 10;
      const rr = 320 * (1 - ((t * 3 + i * 17) % 100) / 100);
      lumiere(g, () => { g.strokeStyle = rgba(k.c1, 0.6); g.lineWidth = 2; g.beginPath(); g.moveTo(D.x + Math.cos(a) * rr, D.y + Math.sin(a) * rr * 0.6); g.lineTo(D.x + Math.cos(a) * rr * 0.8, D.y + Math.sin(a) * rr * 0.48); g.stroke(); });
    }
    lumiere(g, () => { for (let i = 0; i < 3; i++) { g.strokeStyle = rgba(i ? '#ff7aff' : '#b464ff', 0.8); g.lineWidth = 4; g.beginPath(); g.ellipse(D.x, D.y, 90 + i * 20 + p * 30, 20 + i * 6, t / 16, 0, TAU); g.stroke(); } });
    g.fillStyle = '#000'; g.beginPath(); g.arc(D.x, D.y, 30 + p * 40, 0, TAU); g.fill();
  },
  /* LUNARA : la pleine lune, l'éclipse. */
  eclipse(g, t, A, D, k) {
    g.fillStyle = `rgba(0,0,20,${Math.min(0.6, t / 60)})`; g.fillRect(0, 0, L, H);
    const lx = L / 2; const ly = 150;
    lumiere(g, () => halo(g, lx, ly, 200, '#dcebff', 0.8));
    g.fillStyle = '#f0f6ff'; g.beginPath(); g.arc(lx, ly, 90, 0, TAU); g.fill();
    const p = Math.min(1, t / 70);
    g.fillStyle = '#05051a'; g.beginPath(); g.arc(lx + 180 * (1 - p), ly, 92, 0, TAU); g.fill();
    if (t > 60) lumiere(g, () => { for (let i = 0; i < 8; i++) { g.strokeStyle = rgba(k.faisceau, 0.8); g.lineWidth = 6; g.beginPath(); g.moveTo(lx, ly); g.lineTo(D.x + (i - 4) * 14, SOL); g.stroke(); } halo(g, D.x, D.y, 120, k.c1, 0.9); });
  },
  /* PYROCLAW : le Roi Dragon. */
  dragon(g, t, A, D) {
    const p = Math.min(1, t / 50);
    const x = A.x - A.dir * 120 + A.dir * p * 120;
    g.save(); g.translate(x, 210); g.scale(A.dir, 1);
    g.fillStyle = '#5a0a00';
    // La tête du dragon.
    g.beginPath(); g.moveTo(-160, -40); g.quadraticCurveTo(-60, -140, 60, -60); g.lineTo(150, -30); g.lineTo(60, 10); g.quadraticCurveTo(-40, 60, -160, 40); g.fill();
    g.fillStyle = '#ffd23a'; g.beginPath(); g.ellipse(30, -60, 12, 6, -0.3, 0, TAU); g.fill();
    g.fillStyle = '#e8d6b0'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(40 + i * 20, -20); g.lineTo(48 + i * 20, -2); g.lineTo(56 + i * 20, -20); g.fill(); }
    g.restore();
    if (t > 40) lumiere(g, () => {
      for (let i = 0; i < 14; i++) { const q = ((t - 40) * 10 + i * 30) % 500; halo(g, x + A.dir * (140 + q), 200 + q * 0.5 + Math.sin(i) * 20, 50 + q / 10, i % 2 ? '#ff9a1a' : '#ff3a00', 0.7); }
    });
  },
  /* WRAITHBLADE : mille lames fantômes. */
  'mille-lames'(g, t, A, D, k) {
    g.fillStyle = 'rgba(0,10,10,0.4)'; g.fillRect(0, 0, L, H);
    lumiere(g, () => {
      for (let i = 0; i < 26; i++) {
        if (t < i * 2.5) continue;
        const a = hasardFixe(i) * Math.PI;
        const l = 260;
        const dx = Math.cos(a) * l; const dy = Math.sin(a) * l * 0.7;
        const vie = Math.max(0, 1 - (t - i * 2.5) / 14);
        g.strokeStyle = rgba(k.faisceau, vie); g.lineWidth = 3 + vie * 4;
        g.beginPath(); g.moveTo(D.x - dx / 2, D.y - dy / 2); g.lineTo(D.x + dx / 2, D.y + dy / 2); g.stroke();
      }
      if (t > 66) { g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, D.y + 30); g.lineTo(L, D.y - 30); g.stroke(); }
    });
  },
  /* STONEBACK : l'annihilation tectonique. */
  tectonique(g, t, A, D) {
    const p = Math.min(1, t / 60);
    g.fillStyle = '#3a2614';
    for (let i = -6; i <= 6; i++) {
      const x = D.x + i * 50;
      const h = Math.max(0, p * 220 - Math.abs(i) * 20) * (0.7 + hasardFixe(i) * 0.5);
      g.beginPath(); g.moveTo(x - 26, SOL); g.lineTo(x - 10, SOL - h); g.lineTo(x + 14, SOL - h * 0.85); g.lineTo(x + 26, SOL); g.fill();
    }
    g.strokeStyle = '#ff7a1a'; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(D.x, SOL); g.lineTo(D.x + (hasardFixe(i) - 0.5) * 600 * p, SOL + 20 + hasardFixe(i + 3) * 60); g.stroke(); }
    if (t > 66) for (let i = 0; i < 16; i++) { g.fillStyle = '#6a5038'; const q = t - 66; g.fillRect(D.x + (hasardFixe(i) - 0.5) * 300, SOL - q * (4 + hasardFixe(i + 2) * 6) + q * q * 0.08, 12, 12); }
  },
  /* STORMWING : l'ouragan. */
  ouragan(g, t, A, D, k) {
    lumiere(g, () => {
      for (let i = 0; i < 40; i++) {
        const h = (i / 40) * 420;
        const r = 30 + (i / 40) * 160;
        const a = t / 4 + i * 0.5;
        g.strokeStyle = rgba(i % 3 ? '#e6f8ff' : k.c1, 0.35); g.lineWidth = 3;
        g.beginPath(); g.ellipse(D.x + Math.sin(t / 10 + i * 0.2) * 20, SOL - h, r, r * 0.22, 0, a, a + 2.2); g.stroke();
      }
      if (t % 10 < 3) eclair(g, D.x - 60, 60, D.x + 40, SOL - 140, '#ffffff', 3, 8, t);
    });
  },
  /* VOIDREAPER : la moisson dimensionnelle. */
  oubli(g, t, A, D, k) {
    g.fillStyle = `rgba(10,0,20,${Math.min(0.7, t / 50)})`; g.fillRect(0, 0, L, H);
    const a = Math.min(1, t / 60) * Math.PI * 1.6 - 0.4;
    g.save(); g.translate(D.x - 80, D.y - 140); g.rotate(a);
    g.strokeStyle = '#2a1b10'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 260); g.stroke();
    lumiere(g, () => { g.fillStyle = rgba(k.c1, 0.9); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(180, -40, 230, 60); g.quadraticCurveTo(140, 0, 0, 30); g.fill(); });
    g.restore();
    for (let i = 0; i < 8; i++) { const q = ((t * 2 + i * 25) % 160); lumiere(g, () => halo(g, D.x + Math.sin(i * 2) * 60, D.y - q, 16, '#e8d4ff', 0.6 * (1 - q / 160))); }
  },
  /* AQUATHORN : le maelström. */
  maelstrom(g, t, A, D) {
    g.fillStyle = `rgba(0,40,80,${Math.min(0.5, t / 60)})`; g.fillRect(0, 0, L, H);
    lumiere(g, () => {
      for (let i = 0; i < 50; i++) {
        const a = i * 0.4 + t / 8;
        const rr = 20 + ((i * 9 + t * 2) % 240);
        g.fillStyle = rgba(i % 2 ? '#4fd8ff' : '#c8f4ff', 0.5);
        g.beginPath(); g.arc(D.x + Math.cos(a) * rr, D.y + Math.sin(a) * rr * 0.5, 5, 0, TAU); g.fill();
      }
    });
    if (t > 60) { g.fillStyle = rgba('#00a0dc', 0.6); g.beginPath(); g.moveTo(0, SOL); g.quadraticCurveTo(L / 2, SOL - (t - 60) * 6, L, SOL); g.fill(); }
  },
  /* SOLARIUS : l'apocalypse divine. */
  divine(g, t, A, D) {
    g.fillStyle = `rgba(255,240,180,${Math.min(0.4, t / 80)})`; g.fillRect(0, 0, L, H);
    lumiere(g, () => {
      for (let i = 0; i < 9; i++) {
        if (t < i * 6) continue;
        const x = D.x + (i - 4) * 50;
        const gr = g.createLinearGradient(x - 30, 0, x + 30, 0);
        gr.addColorStop(0, 'rgba(255,248,200,0)'); gr.addColorStop(0.5, 'rgba(255,248,200,0.8)'); gr.addColorStop(1, 'rgba(255,248,200,0)');
        g.fillStyle = gr; g.fillRect(x - 30, 0, 60, SOL);
      }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t / 20; etoile(g, D.x + Math.cos(a) * 120, D.y + Math.sin(a) * 80, 6, '#ffffff', t / 8); }
    });
  },
  /* MALVORTEX : l'armageddon abyssal. */
  armageddon(g, t, A, D) {
    g.fillStyle = `rgba(40,0,0,${Math.min(0.6, t / 50)})`; g.fillRect(0, 0, L, H);
    lumiere(g, () => {
      for (let i = 0; i < 10; i++) {
        const x = (i / 10) * L + 50;
        const h = Math.max(0, (t - i * 4) * 8);
        for (let q = 0; q < 8; q++) halo(g, x + Math.sin(t / 4 + q) * 10, SOL - (q / 8) * Math.min(h, 500), 30, q % 2 ? '#ff2a00' : '#ff8a1a', 0.5);
      }
      halo(g, L / 2, 120, 90, '#ff1a1a', 0.9);
    });
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(L / 2, 120, 50, 22, 0, 0, TAU); g.fill();
    g.fillStyle = '#c80014'; g.beginPath(); g.ellipse(L / 2, 120, 14, 20, 0, 0, TAU); g.fill();
  },
  /* KAÏROS : le temps s'arrête, l'horloge géante sonne l'heure. */
  chrono(g, t, A, D, k) {
    g.fillStyle = `rgba(20,40,50,${Math.min(0.55, t / 40)})`; g.fillRect(0, 0, L, H);
    const cx = L / 2; const cy = 250; const R = 200 * Math.min(1, t / 30);
    lumiere(g, () => halo(g, cx, cy, R * 1.3, k.c1, 0.35));
    g.strokeStyle = '#ffd23f'; g.lineWidth = 6;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(10,40,50,0.5)'; g.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU - Math.PI / 2;
      texteContour(g, ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][i], cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, 20, '#ffd23f', '#0a2a30');
    }
    // Les aiguilles s'emballent, puis s'arrêtent net sur minuit.
    const v = t < 60 ? t * t / 40 : 0;
    const ah = t < 60 ? v / 12 : -Math.PI / 2;
    const am = t < 60 ? v : -Math.PI / 2;
    g.strokeStyle = '#ffffff'; g.lineCap = 'round';
    g.lineWidth = 10; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ah) * R * 0.5, cy + Math.sin(ah) * R * 0.5); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(am) * R * 0.78, cy + Math.sin(am) * R * 0.78); g.stroke();
    if (t > 60) lumiere(g, () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t / 20; g.strokeStyle = rgba(k.faisceau, 0.8); g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(D.x + Math.cos(a) * 40, D.y + Math.sin(a) * 40); g.stroke(); } halo(g, D.x, D.y, 90, k.c1, 0.9); });
  },
  /* ONYX : les projecteurs, la foule, le coup du K.O. */
  ring(g, t, A, D, k) {
    g.fillStyle = `rgba(0,0,0,${Math.min(0.7, t / 30)})`; g.fillRect(0, 0, L, H);
    lumiere(g, () => {
      for (const [x, s] of [[150, 1], [850, -1]]) {
        const gr = g.createLinearGradient(x, 0, D.x, SOL);
        gr.addColorStop(0, 'rgba(255,248,200,0.5)'); gr.addColorStop(1, 'rgba(255,248,200,0.05)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 20 * s, 0); g.lineTo(x + 20 * s, 0); g.lineTo(D.x + 90, SOL); g.lineTo(D.x - 90, SOL); g.fill();
      }
      // Les flashs des photographes.
      for (let i = 0; i < 6; i++) if ((t + i * 7) % 23 < 2) halo(g, 60 + i * 170, 120 + (i % 2) * 60, 30, '#ffffff', 0.9);
    });
    // La rafale de poings dorés.
    for (let i = 0; i < 12; i++) {
      const q = t - 20 - i * 3;
      if (q < 0 || q > 12) continue;
      const y = D.y - 60 + (hasardFixe(i) - 0.5) * 120;
      lumiere(g, () => halo(g, D.x - A.dir * (60 - q * 5), y, 26, '#ffd23f', 0.8));
      g.fillStyle = '#d8102a'; g.beginPath(); g.arc(D.x - A.dir * (60 - q * 5), y, 12, 0, TAU); g.fill();
    }
    if (t > 62) { texteContour(g, 'K.O. !', L / 2, 170, 100 + Math.max(0, 80 - t), '#ffd23f', '#5a0010', 'center', true); }
  },
  /* NÉMÉSIS : mille miroirs, mille reflets qui frappent. */
  miroirs(g, t, A, D, k) {
    g.fillStyle = `rgba(10,15,40,${Math.min(0.6, t / 40)})`; g.fillRect(0, 0, L, H);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + t / 40;
      const rr = 260 - Math.min(1, t / 60) * 120;
      const x = D.x + Math.cos(a) * rr;
      const y = D.y + Math.sin(a) * rr * 0.55;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      const m = g.createLinearGradient(-20, -40, 20, 40);
      m.addColorStop(0, '#ffffff'); m.addColorStop(0.5, '#a8c4e8'); m.addColorStop(1, '#5a6aa8');
      g.fillStyle = m; g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(0, -42); g.lineTo(18, -10); g.lineTo(10, 40); g.lineTo(-12, 34); g.lineTo(-18, -12); g.closePath(); g.fill();
      g.restore();
      // Chaque miroir lance son reflet.
      if (t > 40 && (t + i * 3) % 18 < 3) lumiere(g, () => { g.strokeStyle = rgba('#ffffff', 0.9); g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(D.x, D.y); g.stroke(); });
    }
    if (t > 66) lumiere(g, () => halo(g, D.x, D.y, (t - 66) * 10, k.c1, Math.max(0, 1 - (t - 66) / 40)));
  },
  /* LE CHAOS : tout finit ici. */
  'omega-collapse'(g, t, A, D, k) {
    g.fillStyle = `rgba(0,0,0,${Math.min(0.85, t / 40)})`; g.fillRect(0, 0, L, H);
    lumiere(g, () => {
      for (let i = 0; i < 12; i++) eclair(g, D.x, D.y, D.x + Math.cos(i) * 500, D.y + Math.sin(i * 1.7) * 300, rgba(i % 2 ? '#ff50ff' : '#c814ff', 0.7), 3, 8, i + Math.floor(t / 4));
      halo(g, D.x, D.y, 60 + Math.sin(t / 3) * 10 + Math.max(0, t - 60) * 8, k.c1, 0.9);
    });
    g.fillStyle = '#000'; g.beginPath(); g.arc(D.x, D.y, 40 + Math.min(40, t / 2), 0, TAU); g.fill();
    if (t > 66) { lumiere(g, () => halo(g, D.x, D.y, (t - 66) * 14, '#ffffff', Math.max(0, 1 - (t - 66) / 50))); }
  },
};
