/**
 * STREET COMBAT — les effets : impacts, étincelles, textes, projectiles,
 * zones, faisceaux, et les cinématiques des ultimes (une par combattant).
 *
 * Le moteur raconte ce qui se passe (c.ev) ; `traiter` en tire des effets
 * qui vivent quelques images. Tout se dessine dans l'arène (1000 × 600).
 */

import { PERSO } from '../../../shared/street/persos.js';
import { ARENE } from '../../../shared/street/combat.js';
import { rgba, dessinerPortrait } from './dessin.js';
import * as K from './anime.js';
import { ULTIMES, ULTIMES_HEROS, FONDS } from './ultimes.js';

const L = ARENE.L;
const H = ARENE.H;
const SOL = ARENE.SOL;
const TAU = Math.PI * 2;
/** Les couleurs d'un combattant, teintes par l'élément d'une technique du héros (feu, glace…). */
const teinteK = (k, c) => (c ? { ...k, c1: c, faisceau: c, aura: c, teinte: c } : k);
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
      // L'étoile d'impact, comme dans un anime : elle jaillit et s'efface en quelques images.
      fx.anneaux.push({ x: ev.x, y: ev.y, r: 0, max: ev.force >= 3 ? 120 : ev.force >= 2 ? 80 : 52, vie: 9, c: ev.couleur, etoile: true, rot: fx.t * 0.7 });
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
      // Le héros : son sceau s'allume sous ses pieds.
      if (PERSO[j.id].heros && ev.type !== 'saisie') fx.anneaux.push({ x: j.x, y: j.y, r: 30, max: ev.type === 'special' ? 100 : 70, vie: 26, c: PERSO[j.id].c.c1, sceau: true, rot: fx.t / 10 });
      break;
    }
    case 'assistance': {
      // L'allié surgit : son nom, un éclair de sa couleur, une gerbe d'étincelles.
      const p = PERSO[ev.allie];
      if (!p) break;
      fx.noms[ev.joueur] = { texte: `${p.nom} À LA RESCOUSSE !`, vie: 80, max: 80, c: p.c.c1, sorte: 'special' };
      fx.flash = { c: p.c.c1, vie: 14, max: 14, a: 0.45 };
      etincelles(fx, ev.x, ev.y, 40, p.c.c1, 10);
      fx.secousse = Math.max(fx.secousse, 10);
      break;
    }
    case 'faisceau':
      fx.faisceaux.push({ joueur: ev.joueur, def: ev.def, t: 0, duree: ev.duree });
      break;
    case 'teleport':
      // Le héros passe par une faille : une fente de lumière verticale.
      if (PERSO[c.joueurs[ev.joueur].id]?.heros) {
        const k = PERSO[c.joueurs[ev.joueur].id].c;
        for (let i = 0; i < 26; i++) fx.parts.push({ x: ev.x + (Math.random() - 0.5) * 6, y: ev.y - Math.random() * 180, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 6, vie: 22, max: 22, r: 2.5, c: i % 3 ? k.c1 : '#ffffff', grav: 0, type: 'etincelle' });
        fx.anneaux.push({ x: ev.x, y: ev.y, r: 20, max: 70, vie: 20, c: k.c1, sceau: true, rot: fx.t / 10 });
      }
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * TAU;
        fx.parts.push({ x: ev.x, y: ev.y - 80 + (Math.random() - 0.5) * 120, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, vie: 26, max: 26, r: 4 + Math.random() * 6, c: PERSO[c.joueurs[ev.joueur].id].c.c2, grav: 0, type: 'fumee' });
      }
      break;
    case 'soin':
      for (let i = 0; i < 18; i++) fx.parts.push({ x: ev.x + (Math.random() - 0.5) * 60, y: ev.y - Math.random() * 140, vx: 0, vy: -1 - Math.random() * 2, vie: 40, max: 40, r: 3, c: '#7dffb0', grav: 0, type: 'rond' });
      break;
    case 'mur': {
      // Le mur encaisse : des éclats de pierre, la poussière.
      const s = ev.cote === 0 ? 1 : -1;
      for (let i = 0; i < 16; i++) fx.parts.push({ x: ev.x, y: ev.y + (Math.random() - 0.5) * 140, vx: s * (1 + Math.random() * 5), vy: -Math.random() * 5, vie: 40, max: 40, r: 2 + Math.random() * 4, c: '#c8b090', grav: 0.35, type: 'rond' });
      for (let i = 0; i < 8; i++) fx.parts.push({ x: ev.x, y: ev.y + (Math.random() - 0.5) * 160, vx: s * Math.random() * 2, vy: -Math.random(), vie: 40, max: 40, r: 10 + Math.random() * 12, c: '#a09080', grav: 0, type: 'fumee' });
      fx.secousse = Math.max(fx.secousse, 9);
      break;
    }
    case 'mur-brise': {
      // Le mur cède : il vole en morceaux.
      const s = ev.cote === 0 ? 1 : -1;
      for (let i = 0; i < 60; i++) fx.parts.push({ x: ev.x, y: ev.y + (Math.random() - 0.5) * 260, vx: -s * (2 + Math.random() * 9), vy: -2 - Math.random() * 8, vie: 60, max: 60, r: 3 + Math.random() * 7, c: i % 3 ? '#b8a080' : '#7a6a58', grav: 0.4, type: 'rond' });
      etincelles(fx, ev.x, ev.y, 40, '#ffd23f', 10);
      fx.flash = { c: '#ffffff', vie: 14, max: 14, a: 0.7 };
      fx.secousse = 22;
      break;
    }
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
    const P = K.palette(k.faisceau);
    g.save();
    g.translate(p.x, p.y);
    switch (d.forme) {
      case 'heros-eclat': case 'heros-phenix': case 'heros-flocon': case 'heros-corbeau': case 'heros-meteore': case 'heros-anneau': case 'heros-oiseau':
        dessinerProjHeros(g, d.forme, r, teinteK(k, d.teinte), dir, t, p);
        break;
      case 'onde':
        // Une onde d'ombre : trois croissants dressés, le premier net, les autres qui s'effacent.
        g.scale(dir, 1);
        for (let i = 2; i >= 0; i--) K.croissant(g, -i * 18, 0, r * 1.6 - i * 5, K.palette(k.c1), 1 - i * 0.3, 0.32);
        break;
      case 'aiguille':
        // Une flèche du temps : une aiguille d'or, des éclats derrière.
        for (let i = 1; i < 4; i++) K.losange(g, -dir * i * 16, 0, -dir * 6, 0, 2.2, K.OR, 1 - i * 0.25);
        K.lance(g, dir * 24, 0, dir > 0 ? 0 : Math.PI, 56, K.OR, 1, '#fff0a0');
        break;
      case 'sablier':
        g.rotate(t / 8);
        K.lueur(g, 0, 0, 30, K.SABLE.base, 0.5);
        K.couches(g, (s) => { g.moveTo(-11 * s, -14 * s); g.lineTo(11 * s, -14 * s); g.lineTo(2 * s, 0); g.lineTo(11 * s, 14 * s); g.lineTo(-11 * s, 14 * s); g.lineTo(-2 * s, 0); g.closePath(); }, K.SABLE, [1.2, 1, 0.6, 0.25]);
        K.couches(g, (s) => { g.rect(-14 * s, -18, 28 * s, 4); g.rect(-14 * s, 14, 28 * s, 4); }, K.OR, [1.1, 1, 0.5, 0]);
        break;
      case 'poing': {
        // Un poing supersonique : des anneaux de vitesse, le gant rouge.
        g.scale(dir, 1);
        for (let i = 0; i < 3; i++) { g.save(); g.translate(-12 - i * 14, 0); g.scale(0.4, 1); K.onde(g, 0, 0, r + i * 6, 3, K.OR, 0.8 - i * 0.25); g.restore(); }
        const GANT = K.palette('#d8102a');
        K.couches(g, (s) => { g.ellipse(2, 0, r * 0.8 * s, r * 0.68 * s, 0, 0, TAU); }, GANT, [1.12, 1, 0.6, 0.25]);
        g.strokeStyle = GANT.encre; g.lineWidth = 2;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(r * 0.3, (-0.35 + i * 0.35) * r); g.lineTo(r * 0.75, (-0.35 + i * 0.35) * r); g.stroke(); }
        break;
      }
      case 'eclat':
        // Un éclat de miroir qui tourne.
        g.rotate(t / 4);
        K.cristal(g, 0, r * 0.9, r * 1.8, r * 1.1, 0, K.MIROIR);
        K.etoileImpact(g, 0, -r * 0.6, 8, t / 3, K.MIROIR, 0.9, 4);
        break;
      case 'lame': case 'lance': {
        const l = d.forme === 'lance' ? 76 : 40;
        for (let i = 1; i < 4; i++) K.losange(g, -dir * (l * 0.4 + i * 14), 0, -dir * 5, 0, 2, P, 1 - i * 0.25);
        K.lance(g, dir * l * 0.5, 0, dir > 0 ? 0 : Math.PI, l, P, 1, P.clair);
        break;
      }
      case 'croissant': case 'lame-geante': case 'vent': {
        g.scale(dir, 1);
        const R = d.forme === 'lame-geante' ? r * 1.6 : r;
        const PP = d.forme === 'vent' ? K.VENT : P;
        for (let i = 2; i >= 1; i--) K.croissant(g, -i * 14, 0, R * (1 - i * 0.12), PP, 0.35 - i * 0.1);
        K.croissant(g, 0, 0, R, PP);
        break;
      }
      case 'missile': {
        g.rotate(Math.atan2(p.vy, p.vx));
        g.save(); g.rotate(-Math.PI / 2); K.flamme(g, 0, 14, 30, 11, t, K.FEU, 3); g.restore();
        g.fillStyle = '#1a1c28'; g.beginPath(); g.roundRect(-17, -7, 32, 14, 6); g.fill();
        g.fillStyle = '#d8dce8'; g.beginPath(); g.roundRect(-15, -5, 28, 10, 5); g.fill();
        g.fillStyle = '#ff3a3a'; g.beginPath(); g.moveTo(13, -5); g.lineTo(23, 0); g.lineTo(13, 5); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(-11, -3, 18, 2);
        g.fillStyle = '#8a8aa0'; g.beginPath(); g.moveTo(-15, -5); g.lineTo(-22, -11); g.lineTo(-10, -5); g.moveTo(-15, 5); g.lineTo(-22, 11); g.lineTo(-10, 5); g.fill();
        break;
      }
      default:
        if (!dessinerProjNouveau(g, d.forme, r, k, dir, t, p)) dessinerBoule(g, d.forme, r, k, dir, t, p);
        break;
    }
    g.restore();
  }
}

/* Les projectiles de la nouvelle vague : peinture, notes, grues de papier, cartes… Rend vrai si dessiné. */
const PEINTURES = ['#ff3ad0', '#2ae8a0', '#ffd23f', '#3ab8ff'];
function dessinerProjNouveau(g, forme, r, k, dir, t, p) {
  switch (forme) {
    case 'peinture': {
      // Une bombe de peinture : une goutte qui tremble, ses éclaboussures derrière.
      const P = K.palette(PEINTURES[Math.floor(p.t / 6 + p.x / 97) % PEINTURES.length]);
      for (let i = 1; i < 4; i++) K.couches(g, (s) => g.arc(-dir * i * r * 0.8, Math.sin(t / 2 + i) * 4, r * (0.4 - i * 0.07) * s, 0, TAU), P, [1.2, 1, 0.6, 0.25], 1 - i * 0.22);
      K.couches(g, (s) => {
        for (let a = 0; a <= TAU + 0.01; a += TAU / 10) {
          const rr = r * s * (0.85 + 0.15 * Math.sin(a * 3 + t / 2));
          if (a === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
      }, P, [1.12, 1, 0.55, 0.22]);
      return true;
    }
    case 'feuille': {
      g.rotate(t / 5 * dir);
      const P = K.palette('#5ad84a');
      K.couches(g, (s) => { g.moveTo(-r * 1.3 * s, 0); g.quadraticCurveTo(0, -r * 0.9 * s, r * 1.3 * s, 0); g.quadraticCurveTo(0, r * 0.9 * s, -r * 1.3 * s, 0); }, P, [1.15, 1, 0.5, 0]);
      g.strokeStyle = P.encre; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-r * 1.2, 0); g.lineTo(r * 1.2, 0); g.stroke();
      return true;
    }
    case 'note': {
      // Une note de musique qui luit.
      const P = K.palette(k.c1);
      K.lueur(g, 0, 0, r * 2.4, k.c1, 0.55);
      g.save(); g.rotate(Math.sin(t / 4) * 0.25);
      K.couches(g, (s) => { g.ellipse(-r * 0.3, r * 0.5, r * 0.62 * s, r * 0.46 * s, -0.4, 0, TAU); }, P, [1.2, 1, 0.55, 0.2]);
      g.fillStyle = P.encre; g.fillRect(r * 0.2, -r * 1.2, r * 0.3, r * 1.75);
      g.fillStyle = P.base; g.fillRect(r * 0.26, -r * 1.15, r * 0.18, r * 1.65);
      K.couches(g, (s) => { g.moveTo(r * 0.3, -r * 1.2); g.quadraticCurveTo(r * 1.1 * s, -r * 0.9, r * 0.9 * s, -r * 0.2); g.quadraticCurveTo(r * 0.8, -r * 0.7, r * 0.3, -r * 0.7); }, P, [1.1, 1, 0.5, 0]);
      g.restore();
      return true;
    }
    case 'onde-son': {
      // Le Larsen : des arcs sonores qui grossissent en avançant.
      g.scale(dir, 1);
      const P = K.palette(k.c1);
      for (let i = 0; i < 4; i++) {
        const rr = r * (0.6 + i * 0.35) + ((t * 2) % 8);
        g.strokeStyle = P.encre; g.lineWidth = 7 - i; g.beginPath(); g.arc(-i * 10, 0, rr, -0.9, 0.9); g.stroke();
        g.strokeStyle = i % 2 ? P.clair : P.base; g.lineWidth = 4 - i * 0.6; g.beginPath(); g.arc(-i * 10, 0, rr, -0.9, 0.9); g.stroke();
      }
      K.lueur(g, 0, 0, r * 2, k.c1, 0.4);
      return true;
    }
    case 'grue': {
      // Une grue de papier : deux ailes qui battent, le cou et la queue pointus.
      g.rotate(Math.atan2(p.vy, p.vx));
      if (p.vx < 0) g.scale(1, -1);
      const bat = Math.sin(t / 2.2 + p.x / 40);
      const papier = { encre: '#5a1a28', base: '#fff6e8', clair: '#ffffff', coeur: '#ffffff' };
      K.couches(g, (s) => { g.moveTo(-r * 0.9 * s, 0); g.lineTo(-r * 0.2, -r * 1.3 * bat * s); g.lineTo(r * 0.4 * s, 0); g.closePath(); }, papier, [1.1, 1, 0, 0]);
      K.couches(g, (s) => { g.moveTo(-r * 1.4 * s, -r * 0.5); g.lineTo(-r * 0.2, r * 0.3 * s); g.lineTo(r * 1.5 * s, -r * 0.7); g.lineTo(r * 0.4, r * 0.25 * s); g.closePath(); }, { ...papier, base: k.c1 }, [1.1, 1, 0.5, 0]);
      return true;
    }
    case 'etoile-papier': {
      g.rotate(t / 2.5);
      for (let i = 0; i < 4; i++) {
        g.rotate(TAU / 4);
        K.couches(g, (s) => { g.moveTo(0, 0); g.lineTo(r * 1.4 * s, -r * 0.35 * s); g.lineTo(r * 0.4 * s, r * 0.3 * s); g.closePath(); }, i % 2 ? K.palette(k.c1) : { encre: '#5a1a28', base: '#fff6e8', clair: '#ffffff', coeur: '#ffffff' }, [1.15, 1, 0.4, 0]);
      }
      return true;
    }
    case 'limaille':
      for (let i = 0; i < 3; i++) K.eclat(g, (i - 1) * 6, Math.sin(t / 2 + i * 2) * 5, r * 0.55, t / 3 + i, { encre: '#1a1a24', fonce: '#5a5a6a', base: '#9a9aaa', clair: '#e0e0ea', coeur: '#ffffff' });
      K.lueur(g, 0, 0, r * 2, '#c8a0ff', 0.4);
      return true;
    case 'aimant': {
      // Un petit aimant qui attire : son fer rouge, ses pôles d'argent, des lignes de champ.
      g.rotate(Math.sin(t / 5) * 0.3 + (dir > 0 ? -Math.PI / 2 : Math.PI / 2));
      for (let i = 1; i <= 3; i++) K.onde(g, 0, -r * 0.4, r * 0.8 + i * 9 + ((t * 1.5) % 9), 2, K.palette(i % 2 ? k.c1 : k.c2), 0.6 - i * 0.15);
      g.strokeStyle = '#2a0008'; g.lineWidth = r * 0.75; g.beginPath(); g.arc(0, 0, r * 0.7, 0, Math.PI); g.stroke();
      g.strokeStyle = k.c1; g.lineWidth = r * 0.55; g.beginPath(); g.arc(0, 0, r * 0.7, 0, Math.PI); g.stroke();
      g.fillStyle = '#e0e4ee'; g.fillRect(-r * 1.0, -r * 0.5, r * 0.6, r * 0.55); g.fillRect(r * 0.4, -r * 0.5, r * 0.6, r * 0.55);
      return true;
    }
    case 'carte': {
      // Une carte qui tourne sur elle-même : le dos rouge, la face blanche et son cœur.
      g.rotate(t / 3 * dir);
      const face = Math.cos(t / 2) > 0;
      g.scale(Math.max(0.15, Math.abs(Math.cos(t / 2))), 1);
      g.fillStyle = '#1a0a10'; g.beginPath(); g.roundRect(-r * 0.75 - 1.5, -r - 1.5, r * 1.5 + 3, r * 2 + 3, 3); g.fill();
      g.fillStyle = face ? '#fffaf0' : '#b0102a'; g.beginPath(); g.roundRect(-r * 0.75, -r, r * 1.5, r * 2, 3); g.fill();
      if (face) { g.fillStyle = '#d8102a'; g.beginPath(); g.arc(-r * 0.2, -r * 0.1, r * 0.25, Math.PI, 0); g.arc(r * 0.2, -r * 0.1, r * 0.25, Math.PI, 0); g.lineTo(0, r * 0.5); g.closePath(); g.fill(); }
      else { g.strokeStyle = '#ffd23f'; g.lineWidth = 1.2; g.strokeRect(-r * 0.55, -r * 0.8, r * 1.1, r * 1.6); }
      return true;
    }
    case 'jeton': {
      // Un jeton de casino qui roule au sol.
      g.rotate((p.t * 0.25) * dir);
      g.fillStyle = '#1a0a10'; g.beginPath(); g.arc(0, 0, r + 2, 0, TAU); g.fill();
      g.fillStyle = k.c2; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) { g.save(); g.rotate((i / 6) * TAU); g.fillRect(r * 0.7, -r * 0.14, r * 0.3, r * 0.28); g.restore(); }
      g.fillStyle = k.c1; g.beginPath(); g.arc(0, 0, r * 0.5, 0, TAU); g.fill();
      return true;
    }
    case 'feu-follet': {
      // Un feu follet bleu : une flamme qui suit sa route, un petit cœur blanc.
      const P = K.palette(k.faisceau);
      g.save(); g.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2 + Math.PI);
      K.flamme(g, 0, r * 0.4, r * 2.8, r * 1.5, t, P, p.x / 50);
      g.restore();
      K.orbe(g, 0, 0, r * 0.6, t, P);
      return true;
    }
    case 'dynamite': {
      g.rotate(p.t * 0.2 * dir);
      g.fillStyle = '#3a0608'; g.beginPath(); g.roundRect(-r * 1.1 - 1.5, -r * 0.4 - 1.5, r * 2.2 + 3, r * 0.8 + 3, 4); g.fill();
      g.fillStyle = '#d8203a'; g.beginPath(); g.roundRect(-r * 1.1, -r * 0.4, r * 2.2, r * 0.8, 3); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(-r * 0.2, -r * 0.4, r * 0.4, r * 0.8);
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(r * 1.1, 0); g.quadraticCurveTo(r * 1.5, -r * 0.6, r * 1.8, -r * 0.3); g.stroke();
      K.etoileImpact(g, r * 1.8, -r * 0.3, 6 + Math.sin(t) * 2, t, K.FEU, 1, 6);
      return true;
    }
    default: return false;
  }
}

/**
 * Les rayons de la nouvelle vague, dessinés le long de +x (déjà tourné vers l'adversaire) :
 * les basses d'Écho (des arcs sonores et un égaliseur), le lasso de Desperado, le champ d'Aimanta.
 */
function faisceauNouveau(g, d, f, long, ep, p, k) {
  if (d.son) {
    const P = K.palette(k.c1), P2 = K.palette(k.c2);
    for (let i = 0; i < 7; i++) {
      const x = ((f.t * 9 + i * (long / 7)) % Math.max(1, long));
      const h = ep * (0.4 + 0.6 * x / long);
      for (const [c, w] of [[P.encre, 8], [i % 2 ? P2.base : P.base, 5], [P.coeur, 1.5]]) {
        g.strokeStyle = c; g.lineWidth = w * p; g.beginPath(); g.ellipse(x, 0, h * 0.35, h, 0, -1.2, 1.2); g.stroke();
      }
    }
    // L'égaliseur, au pied du son.
    for (let i = 0; i < 9; i++) {
      const bh = (10 + 26 * Math.abs(Math.sin(f.t / 2 + i * 1.3))) * p;
      g.fillStyle = rgba(i % 2 ? k.c1 : k.c2, 0.8); g.fillRect(20 + i * 12, ep * 0.6 - bh, 8, bh);
    }
    return;
  }
  if (d.lasso) {
    // Le lasso : une corde qui file, la boucle au bout qui tourne.
    const bout = long * Math.min(1, f.t / 8);
    const corde = (c, w) => {
      g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= bout; x += 10) g.lineTo(x, Math.sin(x / 40 - f.t / 2) * 8 * (1 - x / Math.max(1, bout)));
      g.stroke();
      g.beginPath(); g.ellipse(bout + 14, 0, 16, 22 + Math.sin(f.t / 2) * 4, Math.sin(f.t / 3) * 0.5, 0, TAU); g.stroke();
    };
    g.globalAlpha *= p;
    corde('#2a1406', 6); corde('#c89a5a', 3.4); corde('#ecd2a0', 1);
    return;
  }
  // L'aimant : des lignes de champ en fuseau, rouges et bleues, qui ramènent l'adversaire.
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1, rang = (i % 3) + 1;
    g.strokeStyle = rgba(i % 2 ? k.c1 : k.c2, 0.85 * p); g.lineWidth = 3;
    g.setLineDash([14, 10]); g.lineDashOffset = f.t * 3;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(long / 2, s * ep * 0.45 * rang, long, 0); g.stroke();
  }
  g.setLineDash([]);
  K.orbe(g, 0, 0, ep * 0.35, f.t, K.palette(k.c1), p);
  K.orbe(g, long, 0, ep * 0.3, f.t, K.palette(k.c2), p);
}

/** Les dés de Jackpot : ils tombent du ciel, rebondissent ; le premier montre le tirage. */
function dessinerDes(g, x, z, d, actif) {
  // Deux gros dés tombent du ciel, rebondissent : le premier montre le tirage.
  const chute = Math.min(1, (z.t - d.delai + 14) / 14);
  const rebond = actif > 0 ? Math.abs(Math.sin(actif / 4)) * 30 * Math.max(0, 1 - actif / 20) : 0;
  for (const [dx, face, rot] of [[-26, z.des || 6, 0.3], [30, ((z.des || 6) % 6) + 1, -0.4]]) {
    const y = -60 + (SOL - 36 + 60) * chute - rebond;
    g.save(); g.translate(x + dx, y); g.rotate(rot + (1 - chute) * 4);
    g.fillStyle = '#1a0a10'; g.beginPath(); g.roundRect(-26, -26, 52, 52, 10); g.fill();
    g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(-23, -23, 46, 46, 8); g.fill();
    g.fillStyle = face === 1 ? '#d8102a' : '#1a0a10';
    const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
    for (const [px, py] of PIPS[face]) { g.beginPath(); g.arc(px * 12, py * 12, face === 1 ? 7 : 4.6, 0, TAU); g.fill(); }
    g.restore();
  }
  if (actif >= 0 && actif < 10) K.etoileImpact(g, x, SOL - 10, 70, actif, K.OR, 1 - actif / 10, 8);
}

function dessinerBoule(g, forme, r, k, dir, t, p) {
  if (forme === 'boule' || forme === 'orbe') {
    // Une boule de ki : son sillage en boules de plus en plus petites, puis la boule.
    const P = K.palette(k.faisceau);
    for (let i = 3; i >= 1; i--) K.orbe(g, -dir * i * r * 0.8, Math.sin(t / 2 + i) * 2, r * (1 - i * 0.2), t + i * 3, P, 0.5 - i * 0.12);
    K.orbe(g, 0, 0, r, t, P);
    return;
  }
  if (forme === 'flamme') {
    // Une boule de feu : une flamme couchée qui traîne derrière, un cœur rond.
    g.save(); g.rotate(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    K.flamme(g, 0, r * 0.5, r * 3.2, r * 1.9, t, K.FEU, 3);
    K.flamme(g, r * 0.3, r * 0.4, r * 2.2, r * 1.1, t + 5, K.FEU, 7, 0.9);
    g.restore();
    K.orbe(g, 0, 0, r * 0.75, t, K.FEU);
    return;
  }
  if (forme === 'rocher') {
    // Un rocher qui tourne, sa poussière ; en feu s'il brûle.
    const feu = p.def.effet === 'brulure';
    for (let i = 1; i < 4; i++) K.fumee(g, -dir * i * r * 0.7, i * 3, r * (0.5 - i * 0.08), feu ? K.FEU : { ...K.SABLE, base: '#b8a080' }, 0.5 - i * 0.12, i);
    K.eclat(g, 0, 0, r, (t / 6) * dir, K.ROCHE);
    return;
  }
  if (forme === 'trou-noir') {
    for (let i = 0; i < 3; i++) {
      g.save(); g.rotate(t / 10 + i); g.scale(1, 0.32);
      for (const [c, w] of [[K.VIDE.encre, 7], [i % 2 ? K.VIDE.base : K.VIDE.clair, 4], [K.VIDE.coeur, 1.2]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r * 1.5 + i * 7, 0.2, 4.6); g.stroke(); }
      g.restore();
    }
    K.lueur(g, 0, 0, r * 2.4, K.VIDE.base, 0.5);
    g.fillStyle = K.VIDE.clair; g.beginPath(); g.arc(0, 0, r * 0.8 + 3, 0, TAU); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, r * 0.8, 0, TAU); g.fill();
    return;
  }
  if (forme === 'etoile') {
    for (let i = 1; i < 4; i++) K.losange(g, -dir * i * r * 0.8, 0, -dir * 5, 0, 2.5, K.palette(k.c1), 1 - i * 0.25);
    K.etoileImpact(g, 0, 0, r * 1.2, t / 5, K.palette(k.c1), 1, 5);
    return;
  }
  if (forme === 'plume') {
    g.rotate(Math.atan2(p.vy, p.vx));
    K.couches(g, (s) => g.ellipse(0, 0, r * 1.4 * s, r * 0.45 * s, 0, 0, TAU), K.palette('#fff6c8'), [1.15, 1, 0.55, 0.2]);
    return;
  }
  if (forme === 'bulle') {
    const P = K.EAU;
    g.fillStyle = 'rgba(30,168,232,0.25)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = P.encre; g.lineWidth = 3.5; g.stroke();
    g.strokeStyle = P.clair; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r - 2, 0, TAU); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.14, -0.6, 0, TAU); g.fill();
    return;
  }
  if (forme === 'ame') {
    // Une âme : un fantôme pâle, sa traîne qui ondule, ses yeux sombres.
    const P = K.palette('#e8d4ff');
    K.lueur(g, 0, 0, r * 2.2, k.c1, 0.5);
    K.couches(g, (s) => { g.arc(0, 0, r * 0.7 * s, Math.PI, 0); g.quadraticCurveTo(r * 0.7 * s, r * 0.5, -dir * r * 2.4 * s, Math.sin(t / 3) * 8); g.quadraticCurveTo(-r * 0.7 * s, r * 0.5, -r * 0.7 * s, 0); }, P, [1.15, 1, 0.6, 0.25]);
    g.fillStyle = '#1a0030'; g.beginPath(); g.arc(-3, -3, 2.5, 0, TAU); g.arc(5, -3, 2.5, 0, TAU); g.fill();
    return;
  }
  // Une goutte (de venin), une balle, le reste : une boule d'énergie aux couleurs de l'effet.
  const P = forme === 'goutte' ? K.POISON : forme === 'balle' ? K.palette('#ffe680') : K.palette(k.faisceau);
  if (forme === 'goutte') {
    for (let i = 1; i < 4; i++) K.couches(g, (s) => g.arc(-dir * i * r * 0.7, i * 2, r * (0.35 - i * 0.06) * s, 0, TAU), P, [1.2, 1, 0.6, 0.3], 1 - i * 0.25);
    g.save(); g.rotate(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    K.couches(g, (s) => { g.moveTo(0, -r * 1.3 * s); g.quadraticCurveTo(r * 0.9 * s, 0, 0, r * 0.8 * s); g.quadraticCurveTo(-r * 0.9 * s, 0, 0, -r * 1.3 * s); }, P, [1.15, 1, 0.6, 0.3]);
    g.restore();
    return;
  }
  K.orbe(g, 0, 0, r * (forme === 'balle' ? 0.6 : 0.9), t, P);
}

export function dessinerZones(g, c, t) {
  for (const z of c.zones) {
    const d = z.def;
    const k = PERSO[c.joueurs[z.j].id].c;
    const P = K.palette(k.c1);
    const avant = z.t < d.delai;
    const actif = z.t - d.delai;
    const fin = Math.max(0, 1 - Math.max(0, actif - d.duree) / 20);
    const x = z.x;
    if (avant) {
      // Le présage : un cercle au sol qui se resserre (une colonne pâle si la zone tombe du ciel).
      const p = z.t / d.delai;
      K.onde(g, x, SOL, d.rayon * (1.4 - p * 0.4), 2 + p * 3, P, 0.4 + p * 0.5, 0.14);
      if (d.hauteur >= 500) { g.fillStyle = rgba(k.c1, 0.06 + p * 0.1); g.fillRect(x - d.rayon * 0.5, 0, d.rayon, SOL); }
      if (d.forme?.startsWith('heros-')) lumiere(g, () => sceau(g, x, SOL, d.rayon * (0.4 + p * 0.6), d.teinte || k.c1, 0.4 + p * 0.6, z.t / 10));
      if (d.forme === 'lune') K.lune(g, x, -80 + p * (SOL - 120), 40);
      if (d.forme === 'des' && z.t > d.delai - 14) dessinerDes(g, x, z, d, z.t - d.delai);
      continue;
    }
    g.save();
    g.globalAlpha = fin;
    switch (d.forme) {
      case 'eclair':
        K.foudre(g, x + 30, 0, x, SOL, 9, K.FOUDRE, Math.floor(z.t / 2) * 7, 2);
        if (actif < 8) K.etoileImpact(g, x, SOL - 8, 60, z.t, K.FOUDRE, 1 - actif / 8, 8);
        break;
      case 'rayon-ciel':
        g.save(); g.translate(x, -20); g.rotate(Math.PI / 2);
        K.rayon(g, SOL + 24, d.rayon * 0.42, z.t, K.palette('#fff0b0'));
        g.restore();
        if (actif < 8) K.etoileImpact(g, x, SOL - 8, 70, z.t, K.OR, 1 - actif / 8, 8);
        break;
      case 'feu': case 'pilier': {
        // Un brasier qui jaillit du sol : des langues de feu, des braises qui montent.
        const PF = d.forme === 'feu' ? K.FEU : K.palette(k.faisceau);
        const monte = K.lisse(actif / 6);
        K.brasier(g, x, SOL + 4, d.rayon * 1.5, d.hauteur * monte, z.t, PF, 2, 1, 8);
        for (let i = 0; i < 10; i++) {
          const v = ((z.t * 5 + i * 37) % d.hauteur) / d.hauteur;
          K.losange(g, x + (K.hasard(i) - 0.5) * d.rayon * 1.6 + Math.sin(z.t / 5 + i) * 10, SOL - v * d.hauteur * 1.1, 0, -3, 2.5, PF, 1 - v);
        }
        K.onde(g, x, SOL, d.rayon * (0.8 + monte * 0.6), 4 * (1 - monte) + 1, PF, 1 - monte, 0.16);
        break;
      }
      case 'blizzard': {
        // Un tourbillon de neige : des volutes cernées, des éclats de glace qui tournent, des cristaux au sol.
        const PG = K.GLACE;
        K.lueur(g, x, SOL - 100, d.rayon * 1.3, PG.base, 0.35);
        g.save();
        for (let i = 0; i < 4; i++) {
          const ry = 110 - i * 18;
          g.strokeStyle = i % 2 ? PG.clair : PG.coeur; g.lineWidth = 10 - i * 1.6;
          g.beginPath(); g.ellipse(x, SOL - 100 + i * 6, d.rayon * (1 - i * 0.16), ry, 0, z.t / 6 + i * 1.3, z.t / 6 + i * 1.3 + 2.4); g.stroke();
          g.strokeStyle = PG.encre; g.lineWidth = 1.5;
          g.beginPath(); g.ellipse(x, SOL - 100 + i * 6, d.rayon * (1 - i * 0.16) + 5, ry + 5, 0, z.t / 6 + i * 1.3, z.t / 6 + i * 1.3 + 2.4); g.stroke();
        }
        g.restore();
        for (let i = 0; i < 6; i++) {
          const a = z.t / 9 + i * 1.05;
          K.fumee(g, x + Math.cos(a) * d.rayon * 0.75, SOL - 100 + Math.sin(a) * 70, 20 + K.hasard(i) * 14, PG, 0.55, i);
        }
        for (let i = 0; i < 16; i++) {
          const a = z.t / 7 + i * 0.9;
          const rr = d.rayon * (0.3 + 0.7 * K.hasard(i));
          K.eclat(g, x + Math.cos(a) * rr, SOL - 100 + Math.sin(a * 1.3) * rr * 0.7, 3 + K.hasard(i * 3) * 4, a * 2, PG, 0.95);
        }
        for (let i = 0; i < 5; i++) K.cristal(g, x + (i - 2) * d.rayon * 0.32, SOL + 2, (28 + K.hasard(i) * 26) * K.lisse(actif / 10), 14, (i - 2) * 0.18, PG);
        break;
      }
      case 'seisme': {
        // Le sol se fend, des pics de roche jaillissent, la poussière monte.
        const m = K.lisse(actif / 5);
        g.save();
        for (const [cl, w] of [[K.FEU.encre, 7], [K.FEU.base, 3.5]]) {
          g.strokeStyle = cl; g.lineWidth = w;
          for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x, SOL); g.lineTo(x + i * d.rayon * 0.3 * m + (K.hasard(i + 9) - 0.5) * 20, SOL + 4 + Math.abs(i) * 3); g.stroke(); }
        }
        g.restore();
        for (let i = 0; i < 5; i++) K.cristal(g, x + (i - 2) * d.rayon * 0.4, SOL + 6, (40 + K.hasard(i) * 50) * m, 22, (i - 2) * 0.2, K.ROCHE);
        for (let i = 0; i < 4; i++) K.fumee(g, x + (i - 1.5) * d.rayon * 0.5, SOL - 14 - actif * 0.8, 16 + actif * 0.5, { ...K.SABLE, base: '#b8a080' }, 0.6 * (1 - actif / 30), i);
        break;
      }
      case 'flaque': {
        // Une flaque de venin (ou de sable mouvant) qui bouillonne.
        const PF = d.effet === 'poison' ? K.POISON : K.palette(k.c1);
        K.couches(g, (s) => g.ellipse(x, SOL + 4, d.rayon * s, 13 * s, 0, 0, TAU), PF, [1.06, 1, 0.65, 0.2], 0.9);
        for (let i = 0; i < 7; i++) {
          const v = ((z.t + i * 10) % 40) / 40;
          K.couches(g, (s) => g.arc(x + (K.hasard(i) - 0.5) * d.rayon * 1.6, SOL - v * 50, (3 + v * 4) * s, 0, TAU), PF, [1.3, 1, 0.5, 0.25], 1 - v);
        }
        break;
      }
      case 'champ':
        // Un champ de gravité : des anneaux qui écrasent, des pierres qui flottent.
        for (let i = 0; i < 4; i++) {
          g.save(); g.translate(x, SOL - 60); g.scale(1, 0.4);
          K.onde(g, 0, 0, d.rayon * (1 - i * 0.2) + Math.sin(z.t / 4 + i) * 4, 5 - i, P, 0.85);
          g.restore();
        }
        K.lueur(g, x, SOL - 80, d.rayon * 1.2, k.c1, 0.3);
        if (d.souleve) for (let i = 0; i < 10; i++) K.eclat(g, x + (K.hasard(i) - 0.5) * d.rayon * 2, SOL - ((z.t * 3 + i * 20) % 200), 4 + K.hasard(i) * 4, z.t / 6 + i, K.ROCHE);
        break;
      case 'lune':
        K.explosion(g, x, SOL - 40, 150, Math.min(1, actif / 30), K.LUNE, 7);
        break;
      case 'nova': case 'onde': case 'vague': {
        const p = Math.min(1, actif / d.duree);
        if (d.forme === 'vague') {
          const PE = K.EAU;
          K.couches(g, (s) => { g.moveTo(x - d.rayon * 0.3, SOL); g.quadraticCurveTo(x, SOL - d.hauteur * s, x + d.rayon * 0.5 * s, SOL - d.hauteur * 0.6 * s); g.quadraticCurveTo(x + d.rayon * 0.2, SOL - 30, x + d.rayon * 0.6, SOL); g.closePath(); }, PE, [1, 0.92, 0.6, 0.25]);
          K.fumee(g, x + d.rayon * 0.4, SOL - d.hauteur * 0.6, 18, { ...PE, base: '#ffffff' }, 0.9, 3);
        } else {
          K.onde(g, x, SOL - 90, d.rayon * (0.3 + p), 10 * (1 - p) + 2, P, 1 - p);
          if (d.forme === 'nova') for (let i = 0; i < 6; i++) K.etoileImpact(g, x + Math.cos(i + p * 3) * d.rayon * p, SOL - 90 + Math.sin(i + p * 3) * d.rayon * p * 0.7, 10 * (1 - p) + 4, p * 5, P, 1 - p, 5);
        }
        break;
      }
      case 'pic': {
        const h = d.hauteur * Math.min(1, actif / 6);
        for (const [dx, f] of [[-20, 0.6], [0, 1], [18, 0.7]]) K.cristal(g, x + dx, SOL + 4, h * f, 24, dx * 0.008, P);
        break;
      }
      case 'etoiles':
        for (let i = 0; i < 6; i++) {
          const v = ((actif * 14 + i * 90) % (SOL + 40));
          const sx = x + (K.hasard(i) - 0.5) * d.rayon * 2;
          for (let j = 1; j < 4; j++) K.losange(g, sx - j * 6, v - 40 - j * 14, 2, 6, 2, P, 1 - j * 0.25);
          K.etoileImpact(g, sx, v - 40, 12, v / 20, P, 1, 5);
        }
        break;
      case 'horloge': {
        const p = Math.min(1, actif / 8);
        g.fillStyle = rgba('#b8f4ec', 0.12 * fin); g.fillRect(0, 0, L, H);
        g.save(); g.translate(x, SOL - 110);
        K.couches(g, (s) => g.arc(0, 0, d.rayon * p * s, 0, TAU), { ...K.OR, clair: '#0e3a40', coeur: '#0a2a30' }, [1.06, 1, 0.94, 0.9], 0.85);
        const fige = Math.max(0, 1 - actif / 14);
        for (const [an, l, w] of [[-1.4 + fige * 6, 0.5, 7], [0.3 + fige * 20, 0.75, 4]]) {
          g.strokeStyle = '#1a1206'; g.lineWidth = w + 3; g.lineCap = 'round';
          g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * d.rayon * l * p, Math.sin(an) * d.rayon * l * p); g.stroke();
          g.strokeStyle = '#ffd23f'; g.lineWidth = w;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * d.rayon * l * p, Math.sin(an) * d.rayon * l * p); g.stroke();
        }
        g.restore();
        break;
      }
      case 'heros-geyser': case 'heros-lances': case 'heros-cristaux': case 'heros-onde': case 'heros-sceau':
        dessinerZoneHeros(g, d, x, actif, teinteK(k, d.teinte), z);
        break;
      case 'fissure':
        K.faille(g, x, SOL - 100, 200, 40 * Math.min(1, actif / 6), z.t, K.VIDE, 5);
        K.foudre(g, x - d.rayon, SOL - 20, x + d.rayon, SOL - 160, 4, K.VIDE, z.t, 1);
        break;
      case 'ronces': {
        // Des ronces jaillissent du sol, s'enroulent, hérissées d'épines.
        const m = K.lisse(actif / 8);
        const P = K.palette('#2e9a3a');
        for (let i = 0; i < 6; i++) {
          const x0 = x + (i - 2.5) * d.rayon * 0.34;
          const h = d.hauteur * (0.55 + 0.45 * K.hasard(i + 3)) * m;
          const s = i % 2 ? 1 : -1;
          for (const [c, w] of [[P.encre, 9], [P.base, 5.5], [P.clair, 1.8]]) {
            g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
            g.beginPath(); g.moveTo(x0, SOL + 4); g.bezierCurveTo(x0 + s * 28, SOL - h * 0.35, x0 - s * 26, SOL - h * 0.7, x0 + s * 8 + Math.sin(z.t / 6 + i) * 6, SOL - h); g.stroke();
          }
          for (let e = 1; e < 5; e++) {
            const v = e / 5;
            const ex = x0 + s * Math.sin(v * Math.PI * 1.6) * 22, ey = SOL - h * v;
            g.fillStyle = '#d8f0a0'; g.beginPath(); g.moveTo(ex - 3, ey); g.lineTo(ex + s * 9, ey - 4); g.lineTo(ex - 3, ey - 5); g.fill();
          }
          if (m >= 1 && i % 2) { g.fillStyle = '#ff8ad8'; g.beginPath(); g.arc(x0 + s * 8, SOL - h, 5, 0, TAU); g.fill(); g.fillStyle = '#ffe066'; g.beginPath(); g.arc(x0 + s * 8, SOL - h, 2, 0, TAU); g.fill(); }
        }
        break;
      }
      case 'peinture': {
        // Un nuage de peinture : des taches de toutes les couleurs qui éclatent, et coulent.
        const m = K.lisse(actif / 6);
        for (let i = 0; i < 9; i++) {
          const P = K.palette(PEINTURES[i % PEINTURES.length]);
          const a = K.hasard(i) * TAU;
          const rr = d.rayon * 0.8 * m * (0.4 + 0.6 * K.hasard(i + 7));
          const bx = x + Math.cos(a) * rr, by = SOL - 70 + Math.sin(a) * rr * 0.8;
          K.couches(g, (s) => g.arc(bx, by + actif * 0.4 * K.hasard(i + 2), (14 + K.hasard(i + 4) * 16) * s * m, 0, TAU), P, [1.12, 1, 0.55, 0.2], 0.95);
        }
        break;
      }
      case 'champ-aimant': {
        // La répulsion : des lignes de champ rouges et bleues, un anneau qui repousse.
        const p = Math.min(1, actif / d.duree);
        for (let i = 0; i < 5; i++) {
          g.save(); g.translate(x, SOL - 90); g.scale(1, 0.55);
          g.strokeStyle = rgba(i % 2 ? k.c1 : k.c2, 0.85 * (1 - p)); g.lineWidth = 4;
          g.beginPath(); g.ellipse(0, 0, d.rayon * (0.4 + p * 0.9) + i * 12, 40 + i * 14, 0, 0, TAU); g.stroke();
          g.restore();
        }
        K.onde(g, x, SOL - 90, d.rayon * (0.3 + p * 1.1), 10 * (1 - p) + 2, K.palette(k.c1), 1 - p);
        break;
      }
      case 'des':
        dessinerDes(g, x, z, d, actif);
        break;
      case 'hurlement': {
        // Le hurlement du loup : des ondes pâles qui partent de lui, une lune derrière.
        const p = Math.min(1, actif / d.duree);
        K.lune(g, x, SOL - 230, 26, K.LUNE, 0.5 * (1 - p));
        for (let i = 0; i < 3; i++) K.onde(g, x, SOL - 120, d.rayon * (0.3 + p + i * 0.25), 8 * (1 - p) + 2, K.palette(k.c1), (1 - p) * (1 - i * 0.25), 0.1);
        break;
      }
      default:
        K.lueur(g, x, SOL - 60, d.rayon, k.c1, 0.5);
        K.onde(g, x, SOL - 4, d.rayon, 4, P, 0.8, 0.18);
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
        // Un souffle : un cône en couches qui s'élargit, ses bords qui ondulent, des boules qui filent dedans.
        g.restore(); g.save();
        const P = d.effet === 'brulure' || !d.couleur ? K.FEU : K.palette(couleur);
        K.couches(g, (s) => {
          g.moveTo(0, -8 * s);
          for (let x = 0; x <= long; x += 14) g.lineTo(x, -(8 + (ep - 8) * x / long) * s * (1 + 0.1 * Math.sin(x / 16 - f.t / 1.4)));
          for (let x = long; x >= 0; x -= 14) g.lineTo(x, (8 + (ep - 8) * x / long) * s * (1 + 0.1 * Math.sin(x / 16 - f.t / 1.4 + 2)));
          g.closePath();
        }, P, [1.15, 1, 0.66, 0.32], p);
        for (let i = 0; i < 5; i++) { const xx = (f.t * 14 + i * 60) % Math.max(1, long); K.orbe(g, xx, Math.sin(f.t + i) * ep * 0.3, 8 + (xx / Math.max(1, long)) * ep * 0.4, f.t + i, P, p); }
        g.restore(); g.save(); g.globalCompositeOperation = 'lighter';
      } else if (d.son || d.lasso || d.aimant) {
        g.restore(); g.save();
        faisceauNouveau(g, d, f, long, ep, p, k);
        g.restore(); g.save(); g.globalCompositeOperation = 'lighter';
      } else {
        // (on sort de la lumière additive : le rayon est opaque, en couches)
        g.restore(); g.save();
        const P = d.effet === 'gel' ? K.GLACE : d.effet === 'brulure' ? K.FEU : K.palette(couleur);
        K.rayon(g, long, ep * 0.62, f.t, P, p);
        K.orbe(g, 0, 0, ep * 0.55, f.t, P, p);
        // Le rayon de glace : des cristaux poussent le long du rayon, et au bout.
        if (d.effet === 'gel') {
          for (let i = 0; i < Math.floor(long / 48); i++) {
            const xx = 30 + i * 48;
            const cr = K.lisse((f.t - i * 0.8) / 5) * p;
            K.cristal(g, xx, -ep * 0.5, 16 * cr, 9, -0.3 + K.hasard(i) * 0.6, P);
            K.cristal(g, xx + 20, ep * 0.5, 14 * cr, 8, Math.PI + 0.3 - K.hasard(i + 9) * 0.6, P);
          }
          for (let i = 0; i < 6; i++) K.cristal(g, long, 0, (26 + K.hasard(i) * 18) * p, 12, (i / 6) * TAU, P);
        }
        g.restore(); g.save(); g.globalCompositeOperation = 'lighter';
        // Le rayon tressé du héros : deux fils de lumière enlacés.
        if (d.tresse) {
          for (const s of [-1, 1]) {
            g.strokeStyle = rgba(s > 0 ? '#ffffff' : d.couleur || k.c1, 0.9 * p); g.lineWidth = 5;
            g.beginPath();
            for (let xx = 0; xx <= long; xx += 8) { const yy = Math.sin(xx / 30 - f.t / 2) * ep * 0.75 * s; if (xx) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
            g.stroke();
          }
        }
        if (d.attire || d.drain) for (let i = 0; i < 6; i++) { const xx = long - ((f.t * 12 + i * 60) % long); K.losange(g, xx, Math.sin(f.t / 3 + i) * ep * 0.4, -9, 0, 3, K.palette('#ffffff'), p); }
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
  // Les étincelles : des losanges nets, étirés dans le sens de leur course.
  for (const p of fx.parts) if (p.type === 'etincelle') K.losange(g, p.x, p.y, p.vx, p.vy, p.r, K.palette(p.c), p.vie / p.max);
  lumiere(g, () => {
    for (const p of fx.parts) {
      const a = p.vie / p.max;
      if (p.type === 'fumee') continue;
      if (p.type === 'etincelle') continue;
      {
        g.fillStyle = rgba(p.c, a); g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      }
    }
    for (const a of fx.anneaux) {
      if (a.etoile) continue;
      if (a.sceau) { sceau(g, a.x, a.y, a.r, a.c, a.vie / 16, a.rot + (26 - a.vie) / 12); continue; }
      g.strokeStyle = rgba(a.c, a.vie / 16); g.lineWidth = a.garde ? 4 : 3 + a.vie / 4;
      g.beginPath(); g.arc(a.x, a.y, a.r, 0, TAU); g.stroke();
      if (!a.garde && a.vie > 10) halo(g, a.x, a.y, a.r * 0.8, '#ffffff', (a.vie - 10) / 6);
    }
  });
  // La fumée : des boules cernées (comme les combattants), qui s'effacent.
  for (const p of fx.parts) {
    if (p.type !== 'fumee') continue;
    K.fumee(g, p.x, p.y, p.r, K.palette(p.c), (p.vie / p.max) * 0.6, Math.floor(p.r * 7));
  }
  for (const a of fx.anneaux) {
    if (!a.etoile) continue;
    const u = 1 - a.vie / 9;
    K.etoileImpact(g, a.x, a.y, a.max * (u < 0.3 ? u / 0.3 : 1 - (u - 0.3) * 0.5), a.rot, K.palette(a.c), 1 - Math.max(0, u - 0.55) / 0.45);
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

/** Moins de mouvement si le joueur l'a demandé (pas de zoom, pas d'image négative). */
const reduit = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const lisse = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** L'image du coup (le moteur frappe à 70) ; quelques images figées juste après : l'arrêt sur image. */
const IMPACT = 68;
const FIGE = 6;
const tCine = (t) => (t < IMPACT ? t : t < IMPACT + FIGE ? IMPACT : t - FIGE);


/* ------------------------------------------------------------------ */
/* Les traînées des coups : le poing ou le pied laisse un sillage       */
/* ------------------------------------------------------------------ */

/** Note où est le poing (ou le pied) qui frappe ; `actif` : le coup est en cours. */
export function noterTrace(fx, n, x, y, couleur, actif) {
  fx.traces ??= [[], []];
  const tr = fx.traces[n];
  if (actif) tr.push({ x, y, c: couleur, v: 1 });
  for (const p of tr) p.v -= actif ? 0.14 : 0.3;
  while (tr.length && (tr[0].v <= 0 || tr.length > 8)) tr.shift();
}

/** Le sillage : un ruban qui s'affine vers l'arrière, blanc au bout, de la couleur du combattant. */
export function dessinerTraces(g, fx) {
  if (!fx.traces) return;
  for (const tr of fx.traces) {
    if (tr.length < 3) continue;
    const P = K.palette(tr[tr.length - 1].c);
    // Trois passes : le liseré, la couleur, le cœur blanc ; le ruban s'affine vers l'arrière.
    for (const [c, k] of [[P.encre, 1.5], [P.base, 1], [P.coeur, 0.4]]) {
      g.strokeStyle = c; g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], b = tr[i];
        const f = i / (tr.length - 1);
        g.globalAlpha = Math.max(0, b.v);
        g.lineWidth = (3 + f * 13) * k;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* La charge d'un ultime (pour ceux qui n'ont pas la leur)               */
/* ------------------------------------------------------------------ */

/** L'aura qui monte, l'énergie aspirée vers lui, aux couleurs du combattant. */
function chargeUlti(g, t, A, k) {
  if (t >= 54) return;
  const p = Math.min(1, t / 40) * (1 - lisse((t - 44) / 10));
  const P = K.palette(k.aura || k.c1);
  for (let i = 0; i < 22; i++) {
    const ph = ((t * 1.8 + i * 11) % 36) / 36;
    const an = hasardFixe(i + 50) * TAU;
    const r = 200 * (1 - ph * ph);
    const x = A.x + Math.cos(an) * r, y = A.y + Math.sin(an) * r * 0.8;
    K.losange(g, x, y, (A.x - x) * 0.08, (A.y - y) * 0.08, 2.4, i % 3 ? P : K.palette('#ffffff'), ph * p);
  }
}

/**
 * La caméra d'un ultime : elle serre sur le combattant qui charge, suit le coup jusqu'à
 * l'adversaire, encaisse l'impact, puis relâche. Rend { z, x, y } (le zoom et le point visé), ou null.
 */
const LARGES = new Set(['dragon', 'eclipse', 'divine', 'armageddon', 'chrono', 'aube-eternelle', 'eclipse-totale', 'singularite', 'supernova', 'omega-collapse', 'ouragan', 'legion', 'meteores', 'foudre', 'ring', 'miroirs',
  'luchador', 'fresque', 'foret', 'enceintes', 'mille-grues', 'polarite', 'jackpot', 'midi', 'neuf-queues', 'lune-sang',
  'heros-promesses', 'heros-phenix', 'heros-sceau', 'heros-eveil', 'heros-horizon', 'heros-fracture']);
export function cameraUlti(fx, c) {
  const C = fx.cine;
  if (!C || reduit()) return null;
  const j = c.joueurs[C.joueur];
  const o = c.joueurs[1 - C.joueur];
  const t = C.t;
  const serre = lisse(t / 36) * (1 - lisse((t - 96) / 30));
  const suit = lisse((t - 46) / 20);
  // Les ultimes qui remplissent le ciel (un dragon, la lune, un œil géant…) gardent un cadre large.
  const ample = LARGES.has(C.visuel) ? 0.12 : 0.42;
  const z = 1 + ample * serre - 0.1 * suit * serre * (ample / 0.42) + (t >= IMPACT && t < IMPACT + FIGE ? 0.08 : 0);
  const vx = j.x + (o.x - j.x) * suit * 0.8;
  const vy = j.y - 110 + (o.y - j.y) * suit * 0.8;
  const x = L / 2 + (vx - L / 2) * serre;
  const y = H / 2 + (vy - H / 2) * serre;
  // On ne sort jamais de l'arène.
  const mx = L / (2 * z), my = H / (2 * z);
  return { z, x: Math.min(L - mx, Math.max(mx, x)), y: Math.min(H - my, Math.max(my, y)) };
}

/** Les images d'impact (en négatif, façon manga) : deux images au coup, une troisième juste après. */
export function imageImpact(fx) {
  const t = fx.cine?.t;
  return t !== undefined && !reduit() && (t === IMPACT || t === IMPACT + 1 || t === IMPACT + 3);
}

/** Les lignes de concentration d'un manga : des traits qui filent du bord de l'écran vers le centre. */
function lignesConcentration(g, cx, cy, a, t, c = '#ffffff') {
  if (a <= 0) return;
  g.save();
  g.fillStyle = rgba(c, a);
  const R = Math.hypot(L, H);
  for (let i = 0; i < 70; i++) {
    const h = hasardFixe(i * 7 + Math.floor(t / 2) * 131);
    const ang = (i / 70) * TAU + h * 0.08;
    const r1 = R * (0.34 + hasardFixe(i + Math.floor(t / 2) * 17) * 0.24);
    const ep = 0.006 + h * 0.014;
    g.beginPath();
    g.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    g.lineTo(cx + Math.cos(ang - ep) * R, cy + Math.sin(ang - ep) * R);
    g.lineTo(cx + Math.cos(ang + ep) * R, cy + Math.sin(ang + ep) * R);
    g.closePath(); g.fill();
  }
  g.restore();
}

/** L'aura d'un ultime : des langues de flammes qui montent tout autour de lui, dessinées derrière lui. */
const AURA = {
  meteores: K.FEU, zero: K.GLACE, foudre: K.FOUDRE, serpent: K.POISON, singularite: K.VIDE, eclipse: K.LUNE, dragon: K.DRAGON,
  tectonique: K.SABLE, ouragan: K.VENT, oubli: K.VIDE, maelstrom: K.EAU, divine: K.OR, armageddon: K.ENFER, chrono: K.OR, ring: K.OR,
  miroirs: K.MIROIR, 'sablier-infini': K.SABLE, 'eclipse-totale': K.OMBRE, 'aube-eternelle': K.OR, 'mille-boucles': K.OR, 'omega-collapse': K.VIDE, vide: K.OMBRE,
  luchador: K.FEU, fresque: K.palette('#ff3ad0'), foret: K.POISON, enceintes: K.palette('#00e5ff'), 'mille-grues': K.palette('#fff0e8'), polarite: K.palette('#c8a0ff'),
  jackpot: K.OR, midi: K.SABLE, 'neuf-queues': K.palette('#7ad8ff'), 'lune-sang': K.ENFER,
};
export function dessinerCineDerriere(g, fx, c, pos) {
  const C = fx.cine;
  if (!C) return;
  const j = c.joueurs[C.joueur];
  const k = teinteK(PERSO[j.id].c, PERSO[j.id].ulti?.teinte);
  const t = tCine(C.t);
  const P = AURA[C.visuel] || K.palette(k.aura || k.c1);
  // Le fond de l'ultime (la nuit, l'orage…), derrière les combattants pour qu'ils restent bien visibles.
  const fond = FONDS[C.visuel]?.(t);
  if (fond) {
    const rgb = (c) => `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;
    if (Array.isArray(fond)) g.fillStyle = rgb(fond);
    else { const gr = g.createLinearGradient(0, 0, 0, SOL); gr.addColorStop(0, rgb(fond.haut)); gr.addColorStop(1, rgb(fond.bas)); g.fillStyle = gr; }
    g.fillRect(0, 0, L, H);
  }
  // Ce qui passe derrière les combattants (le cou du dragon, une faille, la légion, le géant de lumière…).
  const u = ULTIMES[C.visuel] || ULTIMES_HEROS[C.visuel];
  if (u?.derriere) {
    const o = c.joueurs[1 - C.joueur];
    u.derriere(g, t, { id: j.id, x: j.x, y: j.y - 90, dir: j.dir }, { x: o.x, y: o.y - 90 }, k);
  }
  const p = Math.min(1, t / 24) * (1 - K.entre(t, 60, 80));
  if (p <= 0 || pos?.alpha === 0) return;
  const x = pos?.x ?? j.x, y = pos?.y ?? j.y;
  K.lueur(g, x, y - 90, 150, P.base, 0.4 * p);
  for (let i = 0; i < 11; i++) {
    const f = i / 10;
    const h = (110 + 110 * Math.sin(Math.PI * f)) * (0.82 + 0.22 * Math.sin(t / 2.6 + i * 1.7));
    K.flamme(g, x + (f - 0.5) * 96, y + 6, h * p, 22, t * 1.4, P, i * 2.3, 0.7 * p);
  }
}

/** La cinématique de l'ultime, propre à chaque combattant. */
export function dessinerCineUlti(g, fx, c) {
  const C = fx.cine;
  if (!C) return;
  const j = c.joueurs[C.joueur];
  const o = c.joueurs[1 - C.joueur];
  const k = teinteK(PERSO[j.id].c, PERSO[j.id].ulti?.teinte);
  const t = tCine(C.t);
  const A = { id: j.id, x: j.x, y: j.y - 90, dir: j.dir };
  const D = { x: o.x, y: o.y - 90 };
  g.save();
  // L'ambiance : un voile de la couleur du combattant, les bords qui s'assombrissent.
  g.fillStyle = rgba(k.c2, 0.16 + Math.sin(t / 8) * 0.04);
  g.fillRect(0, 0, L, H);
  const v = g.createRadialGradient(L / 2, H / 2, H * 0.3, L / 2, H / 2, L * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${0.55 * Math.min(1, C.t / 12)})`);
  g.fillStyle = v; g.fillRect(0, 0, L, H);
  const u = ULTIMES[C.visuel] || ULTIMES_HEROS[C.visuel];
  const f = typeof u === 'function' ? u : u?.devant;
  // Le héros : son sceau sous ses pieds, à chaque ultime.
  if (PERSO[j.id]?.heros) lumiere(g, () => sceau(g, j.x, j.y, 120, k.c1, Math.min(1, t / 20), t / 20));
  if (!['hadoken', 'meteores', 'zero'].includes(C.visuel)) chargeUlti(g, t, A, k);
  if (f) f(g, t, A, D, k);
  // L'impact, pour tous : l'onde de choc, la gerbe, un éclair blanc bref.
  if (C.t >= IMPACT) {
    const p = (C.t - IMPACT - FIGE) / 26;
    const P = K.palette(k.faisceau);
    if (p > 0 && p < 1) {
      K.onde(g, D.x, SOL - 4, 40 + p * 380, 14 * (1 - p) + 2, P, 1 - p, 0.18);
      K.onde(g, D.x, D.y, 30 + p * 240, 10 * (1 - p) + 2, P, 1 - p);
    }
    if (C.t < IMPACT + FIGE + 6) K.etoileImpact(g, D.x, D.y, 150 + (C.t - IMPACT) * 12, C.t * 0.05, P, 1, 12);
    if (C.t >= IMPACT + FIGE && C.t < IMPACT + FIGE + 10) { g.fillStyle = `rgba(255,255,255,${(IMPACT + FIGE + 10 - C.t) / 16})`; g.fillRect(0, 0, L, H); }
  }
  g.restore();
}

/** Ce qui se dessine par-dessus, à l'écran (pas dans l'arène zoomée) : les lignes de vitesse, les bandes de cinéma. */
export function dessinerCineEcran(g, fx, c) {
  const C = fx.cine;
  if (!C) return;
  const j = c.joueurs[C.joueur];
  const o = c.joueurs[1 - C.joueur];
  const k = teinteK(PERSO[j.id].c, PERSO[j.id].ulti?.teinte);
  const t = C.t;
  if (!reduit()) {
    const charge = t < 50 ? lisse(t / 12) * 0.55 : 0;
    const coup = t >= IMPACT && t < IMPACT + 22 ? 0.7 * (1 - (t - IMPACT) / 22) : 0;
    if (charge) lignesConcentration(g, L / 2 + (j.x - L / 2) * 0.3, H * 0.45, charge, t);
    if (coup) lignesConcentration(g, L / 2 + (o.x - L / 2) * 0.3, H * 0.45, coup, t, '#ffffff');
  }
  const b = Math.min(1, t / 10) * 64;
  g.fillStyle = '#000';
  g.fillRect(0, 0, L, b); g.fillRect(0, H - b, L, b);
  g.fillStyle = k.c1; g.fillRect(0, b - 2, L, 2); g.fillRect(0, H - b, L, 2);
}

/* ------------------------------------------------------------------ */
/* Le héros : ses techniques à lui (formes et cinématiques `heros-…`)  */
/* ------------------------------------------------------------------ */

/** Le sceau du héros : un cercle de runes et une étoile à six branches, à plat au sol ou dressé. */
export function sceau(g, x, y, r, c, a, rot, plat = true) {
  if (r < 2 || a <= 0) return;
  g.save();
  g.translate(x, y);
  if (plat) g.scale(1, 0.28);
  g.rotate(rot);
  g.globalAlpha *= Math.min(1, a);
  g.strokeStyle = c; g.fillStyle = c;
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r * 0.82, 0, TAU); g.stroke();
  g.beginPath();
  for (let i = 0; i < 2; i++) {
    for (let q = 0; q <= 3; q++) {
      const an = (q / 3) * TAU + (i * Math.PI) / 3;
      if (q) g.lineTo(Math.cos(an) * r * 0.8, Math.sin(an) * r * 0.8); else g.moveTo(Math.cos(an) * r * 0.8, Math.sin(an) * r * 0.8);
    }
  }
  g.stroke();
  // Les runes, sur l'anneau.
  for (let i = 0; i < 12; i++) {
    g.save(); g.rotate((i / 12) * TAU);
    g.fillRect(r * 0.85, -2, r * 0.1, 4);
    if (i % 3 === 0) g.fillRect(r * 0.88, -6, 3, 12);
    g.restore();
  }
  g.restore();
}

function dessinerProjHeros(g, forme, r, k, dir, t, p) {
  const P = K.palette(k.faisceau);
  switch (forme) {
    case 'heros-eclat':
      // Un cristal d'énergie à facettes, et sa traînée de paillettes.
      for (let i = 1; i < 5; i++) K.losange(g, -dir * i * 13, Math.sin(t / 2 + i * 1.7) * 5, -dir * 5, 0, 2.4, P, 1 - i * 0.2);
      K.lueur(g, 0, 0, r * 2.2, k.c1, 0.6);
      g.rotate((t / 6) * dir);
      K.cristal(g, 0, r * 0.8, r * 1.7, r * 1.1, 0, P);
      break;
    case 'heros-phenix': {
      // Un petit phénix : des ailes de flammes qui battent, une queue, un cœur ardent.
      const PF = k.teinte ? K.palette(k.c1) : K.FEU;
      g.scale(dir, 1);
      const bat = Math.sin(t / 2.5);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.save(); g.rotate(Math.PI + s * (0.9 + i * 0.35 + bat * 0.3)); K.flamme(g, 0, 0, r * (1.8 - i * 0.3), r * 0.6, t + i, PF, i + s); g.restore(); }
      g.save(); g.rotate(-Math.PI / 2); K.flamme(g, 0, r * 0.4, r * 2.4, r * 0.8, t, PF, 5); g.restore();
      K.orbe(g, 0, 0, r * 0.55, t, PF);
      break;
    }
    case 'heros-flocon':
      // Un flocon à six branches, cerné.
      g.rotate(t / 5);
      K.lueur(g, 0, 0, r * 2, P.base, 0.5);
      for (const [c, w] of [[P.encre, 7], [P.clair, 4], [P.coeur, 1.5]]) {
        g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          g.save(); g.rotate((i / 6) * TAU);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(r, 0);
          g.moveTo(r * 0.55, 0); g.lineTo(r * 0.8, -r * 0.26); g.moveTo(r * 0.55, 0); g.lineTo(r * 0.8, r * 0.26); g.stroke();
          g.restore();
        }
      }
      break;
    case 'heros-corbeau': {
      // Trois corbeaux d'ombre, en vol serré, les yeux de la couleur du héros.
      g.scale(dir, 1);
      K.lueur(g, -10, 0, r * 2, k.c1, 0.4);
      for (const [dx, dy, s] of [[0, 0, 1], [-r * 1.2, -r * 0.7, 0.7], [-r * 1.3, r * 0.6, 0.65]]) {
        const bat = Math.sin(t / 2 + dx);
        g.save(); g.translate(dx * 1.4, dy * 1.4); g.scale(s * 1.5, s * 1.5);
        g.fillStyle = '#0c0614'; g.strokeStyle = rgba(k.c1, 0.8); g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-4, 0); g.lineTo(-14, -18 * bat); g.lineTo(4, -2); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-4, 0); g.lineTo(-10, 16 * bat); g.lineTo(4, 2); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(12, -2); g.lineTo(20, 0); g.lineTo(12, 3); g.fill();
        g.beginPath(); g.moveTo(-12, 0); g.lineTo(-22, -5); g.lineTo(-22, 5); g.fill();
        g.fillStyle = k.c1; g.beginPath(); g.arc(8, -2, 2, 0, TAU); g.fill();
        g.restore();
      }
      break;
    }
    case 'heros-meteore': {
      // Un roc d'énergie en feu, sa traînée de flammes.
      const vx = p.vx || dir, vy = p.vy || 0;
      g.save(); g.rotate(Math.atan2(-vx, vy)); K.flamme(g, 0, r * 0.4, r * 3.4, r * 1.6, t, K.palette(k.c1), 4); g.restore();
      K.orbe(g, 0, 0, r * 0.95, t, K.palette(k.c1));
      K.eclat(g, -r * 0.1, -r * 0.1, r * 0.72, (t / 7) * dir, { ...K.ROCHE, base: k.c2 || '#5a2a18', clair: k.c1 });
      break;
    }
    case 'heros-anneau': {
      // Un anneau tranchant qui tourne sur lui-même.
      const AC = K.palette('#d8e0ec');
      g.save(); g.scale(1, 0.45); g.rotate(t / 2);
      for (const [c, w] of [[AC.encre, 9], [AC.base, 6], [P.base, 2]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        K.couches(g, (s) => { g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a + 0.3) * (r + 13 * s), Math.sin(a + 0.3) * (r + 13 * s)); g.lineTo(Math.cos(a + 0.45) * r, Math.sin(a + 0.45) * r); g.closePath(); }, AC, [1.2, 1, 0.5, 0]);
      }
      g.restore();
      break;
    }
    case 'heros-oiseau': {
      // Un oiseau de lumière, une étoile pour cœur.
      g.rotate(Math.atan2(p.vy || 0, p.vx || dir));
      const bat = Math.sin(t / 2);
      for (let i = 1; i < 4; i++) K.losange(g, -i * 11, 0, -5, 0, 2, P, 1 - i * 0.25);
      for (const s of [-1, 1]) K.couches(g, (q) => { g.moveTo(2, 0); g.quadraticCurveTo(-r * 0.2, s * r * 1.6 * (0.5 + Math.abs(bat) * 0.5) * q, -r * q, s * r * (0.4 + bat * 0.5)); g.lineTo(-r * 0.3, 0); g.closePath(); }, P, [1.15, 1, 0.6, 0.2]);
      K.etoileImpact(g, 0, 0, r * 0.6, t / 6, P, 1, 5);
      break;
    }
    default: break;
  }
}

function dessinerZoneHeros(g, d, x, actif, k, z) {
  const P = K.palette(k.c1);
  switch (d.forme) {
    case 'heros-geyser':
      // Trois jets de flammes qui sortent du sol, l'un après l'autre.
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * d.rayon * 0.55;
        const p = Math.min(1, Math.max(0, (actif - i * 3) / 8));
        if (p <= 0) continue;
        K.brasier(g, x + dx, SOL + 4, 50, d.hauteur * p * (0.85 + 0.15 * Math.sin(z.t / 3 + i)), z.t, k.teinte ? P : K.FEU, i * 4, 1, 3);
      }
      break;
    case 'heros-lances':
      // Des lances de lumière qui se plantent autour de l'adversaire.
      for (let i = 0; i < 5; i++) {
        const q = Math.min(1, Math.max(0, (actif - i * 2) / 6));
        const lx = x + (K.hasard(i + 3) - 0.5) * d.rayon * 1.6;
        K.lance(g, lx, -60 + q * (SOL + 60), Math.PI / 2, 120, K.palette(k.faisceau), 1, '#ffffff');
        if (q >= 1) K.etoileImpact(g, lx, SOL - 6, 30, z.t, P, Math.max(0, 1 - (actif - i * 2 - 6) / 8), 8);
      }
      break;
    case 'heros-cristaux': {
      // Des cristaux qui jaillissent du sol, penchés au hasard.
      const p = Math.min(1, actif / 6);
      const n = Math.max(3, Math.round(d.rayon / 22));
      for (let i = 0; i < n; i++) {
        const dx = (i / (n - 1) - 0.5) * d.rayon * 1.8;
        K.cristal(g, x + dx, SOL + 4, d.hauteur * p * (0.45 + K.hasard(i) * 0.55), 20, (K.hasard(i + 7) - 0.5) * 0.5, K.palette(k.faisceau));
      }
      break;
    }
    case 'heros-onde': {
      // Le poing frappe le sol : des anneaux de choc, le sceau, des éclats qui sautent.
      const p = Math.min(1, actif / d.duree);
      for (let i = 0; i < 3; i++) { const q = Math.max(0, p - i * 0.15); K.onde(g, x, SOL, d.rayon * (0.2 + q), 8 * (1 - q) + 2, P, 1 - q, 0.16); }
      lumiere(g, () => sceau(g, x, SOL, d.rayon * 0.7, k.c1, 1 - p, z.t / 20));
      for (let i = 0; i < 10; i++) {
        const a = K.hasard(i) * Math.PI;
        const q = p * (0.6 + K.hasard(i + 4) * 0.4);
        K.eclat(g, x + Math.cos(a) * d.rayon * q, SOL - Math.sin(a) * 50 * q - 4, 4, q * 6 + i, K.ROCHE, 1 - p);
      }
      break;
    }
    case 'heros-sceau':
      // Le sceau sous l'adversaire, et la colonne de lumière qui en monte.
      lumiere(g, () => sceau(g, x, SOL, d.rayon, k.c1, 1, z.t / 12));
      g.save(); g.translate(x, SOL + 6); g.rotate(-Math.PI / 2);
      K.rayon(g, d.hauteur, d.rayon * 0.4, z.t, K.palette(k.faisceau), 0.9);
      g.restore();
      break;
    default:
      K.lueur(g, x, SOL - 60, d.rayon, k.c1, 0.5);
  }
}
