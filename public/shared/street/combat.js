/**
 * STREET COMBAT — le moteur du combat.
 *
 * Module ISO, sans écran : `pas(c, entrees)` fait avancer le combat d'une
 * image (1/60 s). L'écran lit l'état pour dessiner, et vide `c.ev` (les
 * coups, les sons, les textes à afficher). Le hasard (l'ordinateur) est
 * rangé dans `c.alea` : un combat se rejoue à l'identique.
 *
 * Les entrées d'un joueur, à chaque image : { g, d, h, b, P, K, G, A, B, U }
 * (gauche, droite, haut, bas ; poing, pied, saisie, spécial A, spécial B,
 * ultime) — tenues ou non. Le moteur repère lui-même les appuis.
 *
 * Ce qu'on peut faire :
 *   • marcher, sauter, s'accroupir ; garder en reculant (accroupi contre
 *     les coups bas, debout contre les coups sautés) ;
 *   • 👊 et 🦶, debout, accroupi ou en l'air ; ⬇️🦶 balaye ;
 *   • les enchaînements : un coup qui touche s'annule dans le suivant
 *     (👊 👊 🦶 finit sur la signature du combattant), ou dans un spécial ;
 *   • les techniques à manipulation (↓ → 👊…), sans jauge ;
 *   • la saisie (imparable, mais pas contre un adversaire en l'air) ;
 *   • les spéciaux B et A (un et deux segments de jauge), l'ultime (jauge
 *     pleine), avec sa cinématique.
 */

import { PERSO, JAUGE, ULTI_DEGATS, STATUTS } from './persos.js';

export const ARENE = { L: 1000, H: 600, SOL: 470, BORD: 46 };
const GRAVITE = 0.65;
const ROUND_S = 99;
/** Les rounds à gagner, par défaut (un combat peut en demander moins : la Tour des défis). */
const VICTOIRES = 2;
const PUSH = 58;
/** Un appui reste valable quelques images : on peut l'enfoncer un peu en avance (pendant l'impact). */
const TAMPON = 8;
const BOUTONS = ['P', 'K', 'G', 'A', 'B', 'U'];
const JUGGLE_MAX = 4;
/** La vie de base (multipliée par celle du combattant). */
export const VIE = 150;

/** Les coups normaux : démarrage, coups actifs, récupération, portée, dégâts. */
const NORMAUX = {
  P: { dem: 4, act: 3, rec: 9, portee: 88, haut: [-140, -78], degats: 6, stun: 15, recul: 5, jauge: 7 },
  K: { dem: 7, act: 4, rec: 12, portee: 108, haut: [-115, -40], degats: 9, stun: 19, recul: 8, jauge: 8 },
  bP: { dem: 4, act: 3, rec: 8, portee: 82, haut: [-95, -40], degats: 5, stun: 13, recul: 4, jauge: 6, bas: false },
  bK: { dem: 8, act: 4, rec: 16, portee: 118, haut: [-40, 0], degats: 8, stun: 26, recul: 4, jauge: 8, bas: true, balaye: true },
  aP: { dem: 4, act: 8, rec: 4, portee: 80, haut: [-120, -30], degats: 7, stun: 16, recul: 5, jauge: 7, saute: true },
  aK: { dem: 5, act: 10, rec: 4, portee: 100, haut: [-90, 0], degats: 9, stun: 18, recul: 6, jauge: 8, saute: true },
};

/** L'ordinateur, selon son niveau : vitesse de réaction, garde, agressivité, combos. */
export const NIVEAUX_IA = {
  facile: { reaction: 24, garde: 0.2, agressif: 0.3, combo: 0.1, special: 0.25, precision: 0.5, repos: 50 },
  normal: { reaction: 16, garde: 0.45, agressif: 0.5, combo: 0.35, special: 0.5, precision: 0.75, repos: 28 },
  difficile: { reaction: 9, garde: 0.7, agressif: 0.68, combo: 0.65, special: 0.75, precision: 0.9, repos: 14 },
  impossible: { reaction: 4, garde: 0.9, agressif: 0.85, combo: 0.95, special: 0.95, precision: 1, repos: 4 },
};

/* ------------------------------------------------------------------ */
/* Le hasard, rangé dans le combat                                     */
/* ------------------------------------------------------------------ */

export function graineDe(texte) {
  let h = 2166136261;
  for (const ch of String(texte)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function hasard(c) {
  c.alea = (c.alea + 0x6d2b79f5) >>> 0;
  let t = c.alea;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

const VIDE = { g: false, d: false, h: false, b: false, P: false, K: false, G: false, A: false, B: false, U: false };

function nouveauJoueur(id, n) {
  const perso = PERSO[id];
  if (!perso) throw new Error(`combattant inconnu : ${id}`);
  const hpMax = Math.round(VIE * perso.hpMult);
  return {
    n, id, hpMax, hp: hpMax, sp: 0, victoires: 0,
    x: n === 0 ? 300 : 700, y: ARENE.SOL, vx: 0, vy: 0, dir: n === 0 ? 1 : -1, sol: true,
    etat: 'libre', t: 0, anim: 0, action: null, stun: 0, invincible: 0, armure: 0, garde: null,
    accroupi: false, enGarde: false, statuts: {}, juggle: 0, cache: false,
    combo: { n: 0, degats: 0 }, chaine: '', tampon: [], prec: { ...VIDE }, tenu: { ...VIDE }, appuis: {},
    dernier: null, ia: null,
  };
}

/**
 * @param {{ p1: string, p2: string, ia?: { 0?: string, 1?: string }, entrainement?: boolean, graine?: any,
 *           victoires?: number, vie?: [number|null, number|null] }} o
 *   victoires : les rounds à gagner ; vie : la vie de départ de chacun (la Tour des défis la garde d'un combat à l'autre).
 */
export function creerCombat({ p1, p2, ia = {}, entrainement = false, graine = Date.now(), victoires = VICTOIRES, vie = [] } = {}) {
  const c = {
    v: 1, f: 0, alea: graineDe(graine), entrainement,
    joueurs: [nouveauJoueur(p1, 0), nouveauJoueur(p2, 1)],
    projectiles: [], zones: [], ev: [],
    round: 1, temps: ROUND_S, image: 0,
    phase: 'intro', phaseT: 0, gel: 0, ralenti: 0, cine: null, vainqueur: null, gagnantRound: null,
  };
  c.joueurs.forEach((j, k) => { if (ia[k]) j.ia = { niveau: NIVEAUX_IA[ia[k]] ? ia[k] : 'normal', t: 0, plan: null, combo: null }; });
  c.joueurs.forEach((j, k) => { if (vie[k]) j.hp = Math.max(1, Math.min(j.hpMax, Math.round(vie[k]))); });
  c.victoiresRequises = Math.max(1, victoires);
  if (entrainement) { c.phase = 'combat'; c.temps = Infinity; }
  return c;
}

const adv = (c, j) => c.joueurs[1 - j.n];
const evt = (c, e) => { c.ev.push(e); if (c.ev.length > 200) c.ev.shift(); };
const perso = (j) => PERSO[j.id];

/* ------------------------------------------------------------------ */
/* La boucle                                                           */
/* ------------------------------------------------------------------ */

/** Une image de combat. `entrees` : [entrées du joueur 1, entrées du joueur 2]. */
export function pas(c, entrees = []) {
  c.f += 1;
  const fige = !!c.cine || c.gel > 0 || (c.ralenti > 0 && c.f % 3 !== 0);
  // Les appuis comptent même pendant un arrêt sur image : ils attendent leur tour.
  c.joueurs.forEach((j, k) => lireEntrees(c, j, j.ia
    ? (!fige && c.phase === 'combat' ? penser(c, j) : { ...VIDE })
    : { ...VIDE, ...(entrees[k] || {}) }));
  // Les cinématiques (saisie, ultime) arrêtent le reste.
  if (c.cine) { avancerCine(c); return; }
  if (c.gel > 0) { c.gel -= 1; return; }
  if (c.ralenti > 0 && c.f % 3) { c.ralenti -= 1; return; }

  if (c.phase === 'intro') {
    c.phaseT += 1;
    if (c.phaseT === 1) evt(c, { type: 'annonce', texte: `ROUND ${c.round}`, duree: 70 });
    if (c.phaseT === 75) evt(c, { type: 'annonce', texte: 'FIGHT !', duree: 45, gros: true });
    if (c.phaseT >= 85) { c.phase = 'combat'; c.phaseT = 0; }
    for (const j of c.joueurs) { physique(c, j); j.anim += 1; }
    return;
  }

  if (c.phase === 'combat') {
    for (const j of c.joueurs) {
      const avant = j.action;
      commander(c, j, j.tenu);
      // Un coup vient de partir : les appuis en attente sont consommés.
      if (j.action !== avant) j.appuis = {};
    }
  }
  for (const j of c.joueurs) {
    if (j.action) avancerAction(c, j);
    physique(c, j);
    statuts(c, j);
    minuteurs(c, j);
  }
  pousser(c);
  orienter(c);
  avancerProjectiles(c);
  avancerZones(c);

  if (c.entrainement) entrainer(c);
  if (c.phase === 'combat') verifierFin(c);
  else if (c.phase === 'ko' || c.phase === 'temps') finDeRound(c);
}

/* ------------------------------------------------------------------ */
/* Les commandes                                                       */
/* ------------------------------------------------------------------ */

/** Les directions, vues du combattant : F vers l'adversaire, B en reculant. */
function relatif(j, e) {
  return { F: j.dir > 0 ? e.d : e.g, B: j.dir > 0 ? e.g : e.d, U: e.h, D: e.b };
}

/** Les entrées de l'image : ce qui est tenu, ce qui vient d'être enfoncé (et le tampon des manipulations). */
function lireEntrees(c, j, e) {
  const r = relatif(j, e);
  const rp = relatif(j, j.prec);
  for (const k of ['F', 'B', 'D', 'U']) if (r[k] && !rp[k]) j.tampon.push({ k, f: c.f });
  for (const k of BOUTONS) {
    if (e[k] && !j.prec[k]) {
      j.appuis[k] = c.f;
      if (k === 'P' || k === 'K') j.tampon.push({ k, f: c.f });
    }
  }
  for (const k of BOUTONS) if (j.appuis[k] !== undefined && c.f - j.appuis[k] > TAMPON) delete j.appuis[k];
  j.tampon = j.tampon.filter((x) => c.f - x.f < 40).slice(-10);
  j.prec = { ...e };
  j.tenu = e;
}

function commander(c, j, e) {
  const appui = {};
  for (const k of BOUTONS) appui[k] = j.appuis[k] !== undefined;
  const r = relatif(j, e);
  j.enGarde = false;

  if (['touche', 'vol', 'sol', 'saisi', 'ko', 'victoire'].includes(j.etat)) return;
  if (j.etat === 'garde') { j.enGarde = true; return; }

  // En pleine action : seuls les annulations (un coup qui a touché) passent.
  if (j.action) {
    const a = j.action;
    const annulable = a.touche && a.normal && a.t >= a.dem && !a.annule;
    if (!annulable) return;
    if (appui.U && j.sp >= JAUGE.ulti) return lancerUlti(c, j);
    if (appui.A && j.sp >= JAUGE.specA) return lancerSpecial(c, j, 'specA');
    if (appui.B && j.sp >= JAUGE.specB) return lancerSpecial(c, j, 'specB');
    const combo = trouverCombo(c, j, appui);
    if (combo) return lancerCombo(c, j, combo);
    if ((appui.P || appui.K) && j.chaine.length < 3) {
      const b = appui.K ? 'K' : 'P';
      // 👊 👊 🦶 : le troisième coup est la signature.
      if (j.chaine === 'PP' && b === 'K') {
        const sig = perso(j).combos.find((x) => x.entree === 'PPK');
        if (sig) return lancerCombo(c, j, sig);
      }
      return lancerNormal(c, j, b, j.accroupi);
    }
    return;
  }

  // Libre.
  const p = perso(j);
  const lent = j.statuts.gel ? STATUTS.gel.lenteur : j.statuts.lenteur ? STATUTS.lenteur.lenteur : 1;
  j.accroupi = j.sol && r.D;
  if (j.sol) {
    if (r.D) j.vx = 0;
    else if (r.F) j.vx = p.vitesse * j.dir * lent;
    else if (r.B) j.vx = -p.vitesse * 0.82 * j.dir * lent;
    else j.vx = 0;
    // On garde en reculant (et rien d'autre).
    j.enGarde = r.B;
    if (r.U) {
      j.vy = -p.saut * (lent < 1 ? 0.85 : 1);
      j.vx = (r.F ? 1 : r.B ? -1 : 0) * p.vitesse * 1.1 * j.dir * lent;
      j.sol = false;
      j.accroupi = false;
      evt(c, { type: 'son', nom: 'saut' });
    }
  }

  if (appui.U && j.sp >= JAUGE.ulti) return lancerUlti(c, j);
  if (appui.A && j.sp >= JAUGE.specA) return lancerSpecial(c, j, 'specA');
  if (appui.B && j.sp >= JAUGE.specB) return lancerSpecial(c, j, 'specB');
  if (appui.G && j.sol) return lancerSaisie(c, j);
  const combo = trouverCombo(c, j, appui);
  if (combo) return lancerCombo(c, j, combo);
  if (appui.P || appui.K) lancerNormal(c, j, appui.K ? 'K' : 'P', j.accroupi);
}

/** Une manipulation (↓ → 👊…) vient-elle d'être faite ? */
function trouverCombo(c, j, appui) {
  if (!appui.P && !appui.K) return null;
  const t = j.tampon;
  for (const bouton of ['P', 'K']) {
    if (!appui[bouton]) continue;
    // Le dernier appui de ce bouton, et les directions juste avant lui, dans l'ordre.
    let ib = t.length - 1;
    while (ib >= 0 && t[ib].k !== bouton) ib -= 1;
    if (ib < 0) continue;
    const fb = t[ib].f;
    for (const cb of perso(j).combos) {
      const e = cb.entree;
      if (e === 'PPK' || e[e.length - 1] !== bouton) continue;
      const dirs = e.slice(0, -1);
      let k = ib - 1;
      let ok = true;
      let derniere = null;
      let premiere = null;
      for (let d = dirs.length - 1; d >= 0; d--) {
        while (k >= 0 && t[k].k !== dirs[d]) k -= 1;
        if (k < 0) { ok = false; break; }
        if (derniere === null) derniere = t[k].f;
        premiere = t[k].f;
        k -= 1;
      }
      if (ok && fb - derniere <= 16 && fb - premiere <= 26) { j.tampon = []; return cb; }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Les coups                                                           */
/* ------------------------------------------------------------------ */

function lancerNormal(c, j, b, bas) {
  const nom = !j.sol ? `a${b}` : bas ? `b${b}` : b;
  const d = NORMAUX[nom];
  j.chaine = j.action?.touche && j.action.normal ? j.chaine + b : b;
  j.action = { type: 'normal', nom, normal: true, def: d, t: 0, dem: d.dem, fin: d.dem + d.act + d.rec, touche: false, frappe: false };
  j.etat = 'action';
  if (j.sol) j.vx = 0;
  evt(c, { type: 'son', nom: b === 'P' ? 'fouet' : 'fouet-lourd' });
}

function lancerSaisie(c, j) {
  j.action = { type: 'saisie', t: 0, dem: 3, fin: 26, touche: false };
  j.etat = 'action';
  j.vx = 0;
}

function lancerSpecial(c, j, quel) {
  const def = perso(j)[quel];
  j.sp -= JAUGE[quel];
  demarrerCoup(c, j, def, quel);
  evt(c, { type: 'special', joueur: j.n, nom: def.nom, quel });
  evt(c, { type: 'son', nom: quel });
}

function lancerCombo(c, j, cb) {
  j.chaine = '';
  demarrerCoup(c, j, cb.coup, 'combo', cb.nom);
  evt(c, { type: 'combo-nom', joueur: j.n, nom: cb.nom });
  evt(c, { type: 'son', nom: 'combo' });
}

/** Combien de temps le lanceur reste occupé (le projectile, lui, continue sa route). */
function occupation(def) {
  switch (def.type) {
    case 'projectile': return 18 + ((def.nb || 1) - 1) * (def.intervalle || 0);
    case 'zone': return 18;
    case 'teleport': return def.degats ? 20 : 14;
    default: return def.duree || 20;
  }
}

/** Démarre un coup bâti de briques (spécial ou technique). */
function demarrerCoup(c, j, def, quel, nom = def.nom) {
  const dem = def.type === 'ruee' ? 6 : def.type === 'teleport' ? 4 : 10;
  j.action = {
    type: 'coup', quel, nom, def, t: 0, dem, fin: dem + occupation(def) + 8, touche: false,
    coupsFaits: 0, lance: false, cibleX: adv(c, j).x,
  };
  j.etat = 'action';
  if (def.invincible) j.invincible = Math.max(j.invincible, dem + def.invincible);
  if (def.armure) j.armure = dem + def.duree;
  if (def.type === 'garde') j.garde = { ...def, t: def.duree };
}

function avancerAction(c, j) {
  const a = j.action;
  a.t += 1;
  if (a.type === 'normal') {
    const d = a.def;
    if (a.t > a.dem && a.t <= a.dem + d.act && !a.frappe) {
      if (frapper(c, j, adv(c, j), { ...d, x0: 18, x1: d.portee, h0: d.haut[0], h1: d.haut[1] }, 'normal')) a.frappe = true;
    }
    // Les coups sautés durent jusqu'à l'atterrissage.
    if (d.saute && j.sol) a.t = a.fin;
  } else if (a.type === 'saisie') {
    if (a.t === a.dem) tenterSaisie(c, j);
  } else if (a.type === 'coup') {
    jouerBrique(c, j, a);
  }
  if (a.t >= a.fin && j.action === a) finAction(j);
}

function finAction(j) {
  j.action = null;
  if (j.etat === 'action') j.etat = 'libre';
  if (!j.sol) j.etat = 'libre';
  j.garde = null;
}

/** Les briques des compétences, image par image. */
function jouerBrique(c, j, a) {
  const d = a.def;
  const o = adv(c, j);
  const t = a.t - a.dem;
  if (t < 0) return;

  switch (d.type) {
    case 'projectile': {
      const nb = d.nb || 1;
      const tirer = (vy) => c.projectiles.push({
        j: j.n, def: d, nom: a.nom, x: j.x + j.dir * 52, y: d.rase ? ARENE.SOL - 30 : j.y - 96,
        y0: j.y - 96, vx: (d.vitesse || 10) * j.dir, vy, t: 0, touche: [], vivant: true, dir: j.dir,
      });
      // En éventail : tout part d'un coup ; sinon, un projectile après l'autre.
      if (d.eventail) { if (t === 0) for (let k = 0; k < nb; k++) tirer((k - (nb - 1) / 2) * 2.4); }
      else for (let k = 0; k < nb; k++) if (t === k * (d.intervalle || 0)) tirer(d.vy || 0);
      break;
    }
    case 'faisceau': {
      if (t === 0) evt(c, { type: 'faisceau', joueur: j.n, def: d, x: j.x, y: j.y - 96, dir: j.dir, duree: d.duree });
      const coups = d.coups || 1;
      const espace = Math.max(1, Math.floor(d.duree / coups));
      if (t % espace === 0 && a.coupsFaits < coups && t < d.duree) {
        const ep = d.epaisseur;
        const box = { x0: 30, x1: d.portee, h0: -96 - ep / 2 - (d.cone ? 30 : 0), h1: -96 + ep / 2 + (d.cone ? 30 : 0) };
        if (frapper(c, j, o, { ...d, ...box }, 'special')) {
          a.coupsFaits += 1;
          if (d.drain) soigner(c, j, Math.round(d.degats * d.drain));
        }
      }
      // L'attraction : l'adversaire est tiré vers le lanceur.
      if (d.attire && t < d.duree && dansFaisceau(j, o, d)) o.x += -j.dir * 4 * d.attire;
      break;
    }
    case 'ruee': {
      if (t === 0) {
        j.vx = (d.vx || 0) * j.dir;
        if (d.vy) { j.vy = d.vy; j.sol = false; }
        if (d.traverse) j.cache = true;
      }
      if (d.plonge && t === Math.floor(d.duree / 2)) { j.vy = Math.abs(d.vy || 8) * 0.9; }
      if (!d.vy) j.vx = (d.vx || 0) * j.dir * (t < d.duree ? 1 : 0.3);
      const coups = d.coups || 1;
      const espace = Math.max(1, Math.floor(d.duree / coups));
      if (t < d.duree && a.coupsFaits < coups && t % espace === 0) a.prete = true;
      if (a.prete && t < d.duree) {
        const portee = d.portee || 95;
        const touche = frapper(c, j, o, { ...d, x0: -20, x1: portee, h0: -150, h1: d.balaye ? 0 : -10 }, 'special');
        if (touche) {
          a.prete = false;
          a.coupsFaits += 1;
          if (d.emporte) o.x = j.x + j.dir * 60;
          if (d.attire) o.x = j.x + j.dir * 70;
        }
      }
      if (t >= d.duree) j.cache = false;
      break;
    }
    case 'zone': {
      if (t === 0) {
        const x = d.ou === 'cible' ? o.x : d.ou === 'soi' ? j.x : j.x + j.dir * (d.distance || 120);
        c.zones.push({ j: j.n, def: d, nom: a.nom, x: Math.max(ARENE.BORD, Math.min(ARENE.L - ARENE.BORD, x)), t: 0, dir: j.dir, coupsFaits: 0 });
      }
      break;
    }
    case 'teleport': {
      if (t === 0) { j.cache = true; j.invincible = Math.max(j.invincible, 14); evt(c, { type: 'teleport', joueur: j.n, x: j.x, y: j.y }); }
      if (t === 8) {
        if (d.recule) j.x = Math.max(ARENE.BORD, Math.min(ARENE.L - ARENE.BORD, j.x - j.dir * 230));
        else j.x = Math.max(ARENE.BORD, Math.min(ARENE.L - ARENE.BORD, o.x + (d.derriere ? 1 : -1) * j.dir * 70));
        j.cache = false;
        orienterUn(j, o);
        evt(c, { type: 'teleport', joueur: j.n, x: j.x, y: j.y });
      }
      if (d.degats && t === 11) frapper(c, j, o, { ...d, x0: -20, x1: 100, h0: -150, h1: -10 }, 'special');
      break;
    }
    case 'garde': {
      // Le bouclier, le miroir, la contre-attaque : voir recevoirCoup.
      break;
    }
    case 'soin': {
      if (t === 10) { soigner(c, j, d.soin); evt(c, { type: 'soin', joueur: j.n, x: j.x, y: j.y }); }
      break;
    }
    default: break;
  }
}

function dansFaisceau(j, o, d) {
  const dx = (o.x - j.x) * j.dir;
  return dx > 0 && dx < d.portee && Math.abs((o.y - 96) - (j.y - 96)) < d.epaisseur + 60;
}

function soigner(c, j, n) {
  const avant = j.hp;
  j.hp = Math.min(j.hpMax, j.hp + n);
  if (j.hp > avant) evt(c, { type: 'texte', x: j.x, y: j.y - 170, texte: `+${j.hp - avant}`, couleur: '#7dffb0' });
}

/* ------------------------------------------------------------------ */
/* Toucher                                                             */
/* ------------------------------------------------------------------ */

/** La zone qu'occupe un combattant. */
function corps(j) {
  const h = j.accroupi ? 100 : j.etat === 'sol' ? 40 : 150;
  return { x0: j.x - 30, x1: j.x + 30, y0: j.y - h, y1: j.y };
}

/** Un coup porté de près : une boîte devant l'attaquant. */
function frapper(c, att, def, coup, sorte) {
  const x0 = att.x + att.dir * coup.x0;
  const x1 = att.x + att.dir * coup.x1;
  const box = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: att.y + coup.h0, y1: att.y + coup.h1 };
  const b = corps(def);
  if (box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1) return false;
  return recevoirCoup(c, att, def, coup, sorte, att.dir, (Math.max(box.x0, b.x0) + Math.min(box.x1, b.x1)) / 2, (Math.max(box.y0, b.y0) + Math.min(box.y1, b.y1)) / 2);
}

/** La garde est-elle bonne ? On recule, et on est accroupi contre un coup bas, debout contre un coup sauté. */
function bonneGarde(def, coup, dirCoup) {
  if (!def.sol || def.action || !['libre', 'garde'].includes(def.etat)) return false;
  if (!(def.enGarde || def.etat === 'garde')) return false;
  // Il faut faire face au coup.
  if (def.dir === dirCoup) return false;
  if (coup.bas && !def.accroupi) return false;
  if (coup.saute && def.accroupi) return false;
  return true;
}

/**
 * Le cœur : un coup arrive. Rend vrai si le coup a porté (touché ou gardé).
 * `sorte` : normal | special | projectile | zone.
 */
function recevoirCoup(c, att, def, coup, sorte, dirCoup, hx, hy) {
  if (def.hp <= 0 || def.invincible > 0 || def.cache || ['saisi', 'ko'].includes(def.etat)) return false;
  if (def.etat === 'sol') return false;
  const p = perso(att);

  // Le bouclier, le miroir, la contre-lame.
  if (def.garde) {
    const g = def.garde;
    if (g.contre && sorte !== 'projectile') {
      def.garde = null;
      evt(c, { type: 'texte', x: def.x, y: def.y - 170, texte: 'CONTRE !', couleur: perso(def).c.c1, gros: true });
      evt(c, { type: 'son', nom: 'contre' });
      appliquerDegats(c, def, att, { degats: g.degats || 14, stun: 30, recul: 12, lance: true }, 'special', -dirCoup, att.x, att.y - 90);
      return true;
    }
    if (g.renvoi && sorte === 'projectile') return 'renvoi';
  }

  // La garde.
  if (bonneGarde(def, coup, dirCoup)) {
    def.etat = 'garde';
    def.stun = Math.round((coup.stun || 15) * 0.65);
    def.vx = dirCoup * (coup.recul || 6) * 0.6;
    def.sp = Math.min(100, def.sp + 5);
    att.sp = Math.min(100, att.sp + 2);
    // Les spéciaux grignotent un peu, même gardés.
    if (sorte !== 'normal') {
      const chip = Math.max(1, Math.round((coup.degats || 10) * 0.15));
      def.hp = Math.max(1, def.hp - chip);
    }
    c.gel = Math.max(c.gel, 3);
    evt(c, { type: 'garde', x: hx, y: hy, couleur: '#8fe6ff' });
    evt(c, { type: 'son', nom: 'garde' });
    return true;
  }

  appliquerDegats(c, att, def, coup, sorte, dirCoup, hx, hy, p);
  return true;
}

function appliquerDegats(c, att, def, coup, sorte, dirCoup, hx, hy, p = perso(att)) {
  // L'enchaînement : tant que l'adversaire n'a pas repris la main, les coups s'ajoutent.
  const enCombo = ['touche', 'vol'].includes(def.etat);
  if (enCombo) att.combo.n += 1; else att.combo = { n: 1, degats: 0 };
  // Plus le combo est long, moins chaque coup fait mal.
  const echelle = Math.max(0.45, 1 - (att.combo.n - 1) * 0.1);
  const brut = (coup.degats || 6) * p.dmg / perso(def).defMult * echelle;
  const degats = Math.max(1, Math.round(def.armure > 0 ? brut * 0.5 : brut));
  def.hp = Math.max(0, def.hp - degats);
  att.combo.degats += degats;
  att.combo.t = c.f;
  att.sp = Math.min(100, att.sp + (coup.jauge || (sorte === 'normal' ? 7 : 4)));
  def.sp = Math.min(100, def.sp + 4);
  if (att.action) att.action.touche = true;

  // Super-armure : on encaisse sans broncher.
  if (def.armure > 0 && def.hp > 0) {
    evt(c, { type: 'impact', x: hx, y: hy, couleur: '#ffffff', force: 1, armure: true });
    evt(c, { type: 'texte', x: def.x, y: def.y - 165, texte: `-${degats}`, couleur: '#ffd84a' });
    return;
  }

  def.action = null;
  def.garde = null;
  def.accroupi = false;
  const enLAir = !def.sol || coup.lance || coup.souleve;
  if (enLAir) {
    def.juggle += 1;
    def.etat = 'vol';
    def.sol = false;
    def.vy = coup.ecrase ? 12 : coup.lance || coup.souleve ? -11 : Math.min(def.vy, -5);
    def.vx = dirCoup * Math.max(3, (coup.recul || 6) * 0.6);
    // Trop de jongles : on ne peut plus le toucher avant qu'il retombe.
    if (def.juggle > JUGGLE_MAX) def.invincible = 40;
  } else if (coup.balaye) {
    def.etat = 'vol';
    def.sol = false;
    def.vy = -4;
    def.vx = dirCoup * 2;
  } else {
    def.etat = 'touche';
    def.stun = coup.stun || 15;
    def.vx = dirCoup * (coup.recul || 6);
  }
  if (coup.effet && STATUTS[coup.effet]) {
    def.statuts[coup.effet] = { t: STATUTS[coup.effet].duree };
  }
  const force = sorte === 'normal' ? 1 : 2;
  c.gel = Math.max(c.gel, sorte === 'normal' ? 5 : 8);
  evt(c, { type: 'impact', x: hx, y: hy, couleur: p.c.faisceau, force, effet: coup.effet || null });
  evt(c, { type: 'texte', x: def.x, y: def.y - 165, texte: `-${degats}`, couleur: '#ff4d6d' });
  evt(c, { type: 'son', nom: force > 1 ? 'impact-lourd' : 'impact' });
  if (att.combo.n >= 2) evt(c, { type: 'combo', joueur: att.n, n: att.combo.n, degats: att.combo.degats });
  if (def.hp <= 0 && !c.entrainement) {
    c.ralenti = 70;
    evt(c, { type: 'ko-coup', joueur: def.n });
  }
}

/* ------------------------------------------------------------------ */
/* Projectiles et zones                                                */
/* ------------------------------------------------------------------ */

function avancerProjectiles(c) {
  for (const pr of c.projectiles) {
    const d = pr.def;
    pr.t += 1;
    const cible = c.joueurs[1 - pr.j];
    if (d.tete) {
      // Tête chercheuse : le projectile corrige sa route vers la cible.
      const dy = (cible.y - 90) - pr.y;
      pr.vy += Math.sign(dy) * d.tete;
      pr.vy = Math.max(-6, Math.min(6, pr.vy));
    }
    if (d.gravite) pr.vy += d.gravite;
    pr.x += pr.vx;
    pr.y += pr.vy;
    if (d.ondule) pr.y = pr.y0 + Math.sin(pr.t / 8) * 22 + (d.gravite ? pr.vy * pr.t : 0);
    if (d.attire && Math.abs(cible.x - pr.x) < 260 && cible.etat !== 'saisi') cible.x += Math.sign(pr.x - cible.x) * d.attire;
    if (pr.y >= ARENE.SOL - 8 && (d.gravite || d.vy > 0)) {
      pr.vivant = false;
      evt(c, { type: 'impact', x: pr.x, y: ARENE.SOL - 10, couleur: PERSO[c.joueurs[pr.j].id].c.faisceau, force: 1, sol: true });
    }
    if (pr.t > (d.duree || 90) || pr.x < -60 || pr.x > ARENE.L + 60) pr.vivant = false;
    if (!pr.vivant) continue;
    // Contre la cible.
    const b = corps(cible);
    const r = d.rayon || 18;
    if (!pr.touche.includes(cible.n) && pr.x + r > b.x0 && pr.x - r < b.x1 && pr.y + r > b.y0 && pr.y - r < b.y1) {
      const res = recevoirCoup(c, c.joueurs[pr.j], cible, { ...d, saute: false }, 'projectile', Math.sign(pr.vx) || pr.dir, pr.x, pr.y);
      if (res === 'renvoi') {
        // Renvoyé : il repart vers son lanceur.
        pr.j = cible.n;
        pr.vx = -pr.vx;
        pr.dir = -pr.dir;
        pr.t = 0;
        evt(c, { type: 'texte', x: cible.x, y: cible.y - 170, texte: 'RENVOI !', couleur: '#8fe6ff', gros: true });
        evt(c, { type: 'son', nom: 'contre' });
      } else if (res) {
        pr.touche.push(cible.n);
        if (!d.traverse) pr.vivant = false;
      }
    }
  }
  // Deux projectiles adverses qui se croisent s'annulent.
  for (const a of c.projectiles) {
    if (!a.vivant) continue;
    for (const b of c.projectiles) {
      if (!b.vivant || a.j === b.j || a === b) continue;
      if (Math.abs(a.x - b.x) < (a.def.rayon + b.def.rayon) && Math.abs(a.y - b.y) < (a.def.rayon + b.def.rayon)) {
        a.vivant = false;
        b.vivant = false;
        evt(c, { type: 'impact', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, couleur: '#ffffff', force: 2 });
        evt(c, { type: 'son', nom: 'annule' });
      }
    }
  }
  c.projectiles = c.projectiles.filter((p) => p.vivant);
}

function avancerZones(c) {
  for (const z of c.zones) {
    const d = z.def;
    z.t += 1;
    if (d.avance) z.x += d.avance * z.dir;
    const actif = z.t - d.delai;
    if (actif < 0 || actif >= d.duree) continue;
    const coups = d.coups || 1;
    const espace = Math.max(1, Math.floor(d.duree / coups));
    if (actif % espace !== 0 || z.coupsFaits >= coups) continue;
    const cible = c.joueurs[1 - z.j];
    const att = c.joueurs[z.j];
    if (d.solSeulement && !cible.sol) continue;
    const b = corps(cible);
    const haut = ARENE.SOL - d.hauteur;
    if (Math.abs(cible.x - z.x) <= d.rayon + 28 && b.y1 >= haut) {
      const dirCoup = d.ou === 'soi' ? Math.sign(cible.x - z.x) || att.dir : att.dir;
      // Une zone qui sort du sol se garde accroupi ; une qui tombe du ciel, debout.
      const res = recevoirCoup(c, att, cible, { ...d, bas: d.solSeulement || d.forme === 'pic', saute: false }, 'zone', dirCoup, cible.x, cible.y - 70);
      if (res) z.coupsFaits += 1;
    }
  }
  c.zones = c.zones.filter((z) => z.t < z.def.delai + z.def.duree + 20);
}

/* ------------------------------------------------------------------ */
/* La saisie et l'ultime : des cinématiques                            */
/* ------------------------------------------------------------------ */

function tenterSaisie(c, j) {
  const o = adv(c, j);
  const dx = (o.x - j.x) * j.dir;
  const possible = dx > 0 && dx < 82 && o.sol && !o.invincible && !o.cache && ['libre', 'garde', 'action'].includes(o.etat) && o.hp > 0;
  if (!possible) { evt(c, { type: 'son', nom: 'rate' }); return; }
  // Deux saisies en même temps : on se dégage.
  if (o.action?.type === 'saisie' && o.action.t <= o.action.dem + 2) {
    evt(c, { type: 'texte', x: (j.x + o.x) / 2, y: j.y - 170, texte: 'DÉGAGEMENT !', couleur: '#ffffff' });
    j.vx = -j.dir * 8; o.vx = -o.dir * 8;
    finAction(j); finAction(o);
    return;
  }
  const seq = perso(j).saisie.seq;
  c.cine = { type: 'saisie', att: j.n, def: o.n, t: 0, pas: 0, pasT: 0, seq };
  j.etat = 'saisi-att'; o.etat = 'saisi';
  j.action = null; o.action = null;
  o.x = j.x + j.dir * 62;
  j.vx = o.vx = 0;
  evt(c, { type: 'saisie', joueur: j.n, nom: perso(j).saisie.nom });
  evt(c, { type: 'son', nom: 'saisie' });
}

function lancerUlti(c, j) {
  j.sp = 0;
  j.action = null;
  c.cine = { type: 'ulti', att: j.n, def: 1 - j.n, t: 0, phase: 'portrait' };
  j.etat = 'ulti';
  evt(c, { type: 'ulti', joueur: j.n, nom: perso(j).ulti.nom, visuel: perso(j).ulti.visuel });
  evt(c, { type: 'son', nom: 'ulti' });
}

const ULTI_PORTRAIT = 50;
const ULTI_CINE = 130;

function avancerCine(c) {
  const k = c.cine;
  const j = c.joueurs[k.att];
  const o = c.joueurs[k.def];
  k.t += 1;
  if (k.type === 'saisie') {
    o.x = j.x + j.dir * 62;
    o.y = j.y = ARENE.SOL;
    const [label, dur, dmg] = k.seq[k.pas];
    k.pasT += 1;
    if (k.pasT === Math.floor(dur / 2)) {
      const degats = Math.max(1, Math.round(dmg * perso(j).dmg / perso(o).defMult));
      o.hp = Math.max(0, o.hp - degats);
      j.sp = Math.min(100, j.sp + 4);
      evt(c, { type: 'impact', x: o.x, y: o.y - 80, couleur: perso(j).c.faisceau, force: 2 });
      evt(c, { type: 'texte', x: o.x, y: o.y - 165, texte: `-${degats}`, couleur: '#ff4d6d' });
      evt(c, { type: 'texte', x: j.x, y: j.y - 200, texte: label, couleur: perso(j).c.c1, gros: true });
      evt(c, { type: 'son', nom: 'impact-lourd' });
      evt(c, { type: 'secousse', force: 6 });
    }
    if (k.pasT >= dur) {
      k.pas += 1;
      k.pasT = 0;
      if (k.pas >= k.seq.length || o.hp <= 0) {
        // Le jet final.
        c.cine = null;
        j.etat = 'libre';
        o.etat = 'vol'; o.sol = false; o.vy = -10; o.vx = j.dir * 8; o.juggle = JUGGLE_MAX;
        if (o.hp <= 0) c.ralenti = 70;
      }
    }
    return;
  }

  // L'ultime : le portrait, puis l'élan ; s'il est à portée, la cinématique.
  if (k.phase === 'portrait') {
    if (k.t >= ULTI_PORTRAIT) {
      const dx = Math.abs(o.x - j.x);
      const ok = dx <= perso(j).ulti.portee && !o.invincible && !o.cache && o.hp > 0;
      if (!ok) {
        c.cine = null;
        j.etat = 'libre';
        evt(c, { type: 'texte', x: j.x, y: j.y - 190, texte: 'ULTIME RATÉ !', couleur: '#ffffff', gros: true });
        evt(c, { type: 'son', nom: 'rate' });
        return;
      }
      k.phase = 'cine';
      k.t = 0;
      o.etat = 'saisi';
      o.action = null;
      evt(c, { type: 'ulti-cine', joueur: j.n, visuel: perso(j).ulti.visuel, duree: ULTI_CINE });
    }
    return;
  }
  if (k.t === 70) {
    const degats = Math.max(1, Math.round(ULTI_DEGATS * perso(j).dmg / perso(o).defMult));
    o.hp = Math.max(0, o.hp - degats);
    j.combo = { n: 1, degats };
    evt(c, { type: 'texte', x: o.x, y: o.y - 200, texte: 'CRITICAL HIT !!', couleur: '#ffd84a', gros: true });
    evt(c, { type: 'texte', x: o.x, y: o.y - 160, texte: `-${degats}`, couleur: '#ff4d6d', gros: true });
    evt(c, { type: 'impact', x: o.x, y: o.y - 80, couleur: perso(j).c.faisceau, force: 3 });
    evt(c, { type: 'secousse', force: 14 });
    evt(c, { type: 'son', nom: 'boum' });
  }
  if (k.t >= ULTI_CINE) {
    c.cine = null;
    j.etat = 'libre';
    o.etat = 'vol'; o.sol = false; o.vy = -12; o.vx = j.dir * 10; o.juggle = JUGGLE_MAX;
    if (o.hp <= 0) c.ralenti = 80;
  }
}

/* ------------------------------------------------------------------ */
/* Physique, statuts, minuteurs                                        */
/* ------------------------------------------------------------------ */

function physique(c, j) {
  if (!j.sol) {
    j.vy += GRAVITE;
    j.y += j.vy;
    if (j.y >= ARENE.SOL) {
      j.y = ARENE.SOL;
      j.vy = 0;
      j.sol = true;
      if (j.etat === 'vol') {
        // Retombé : à terre, puis il se relève (intouchable un instant).
        j.etat = j.hp > 0 ? 'sol' : 'ko';
        j.stun = 38;
        j.vx *= 0.3;
        evt(c, { type: 'chute', x: j.x, y: j.y });
        evt(c, { type: 'son', nom: 'chute' });
      } else {
        evt(c, { type: 'son', nom: 'atterrit' });
        if (j.action?.def?.saute) finAction(j);
        if (j.action?.type === 'coup' && j.action.def.type === 'ruee' && j.action.def.vy) j.vx *= 0.3;
      }
      j.juggle = 0;
    }
  } else if (j.etat !== 'libre' || (!j.action && !j.vx)) {
    j.vx *= 0.82;
    if (Math.abs(j.vx) < 0.1) j.vx = 0;
  }
  j.x += j.vx;
  j.x = Math.max(ARENE.BORD, Math.min(ARENE.L - ARENE.BORD, j.x));
}

function statuts(c, j) {
  for (const [nom, s] of Object.entries(j.statuts)) {
    const def = STATUTS[nom];
    s.t -= 1;
    if (def.degats && s.t % def.tous === 0 && j.hp > 1 && c.phase === 'combat') {
      j.hp = Math.max(1, j.hp - def.degats);
      evt(c, { type: 'statut', joueur: j.n, nom });
    }
    if (s.t <= 0) delete j.statuts[nom];
  }
}

function minuteurs(c, j) {
  j.anim += 1;
  if (j.invincible > 0) j.invincible -= 1;
  if (j.armure > 0) j.armure -= 1;
  if (j.garde) { j.garde.t -= 1; if (j.garde.t <= 0) j.garde = null; }
  if (['touche', 'garde', 'sol'].includes(j.etat)) {
    j.stun -= 1;
    if (j.stun <= 0) {
      if (j.etat === 'sol') { j.invincible = 24; evt(c, { type: 'releve', joueur: j.n }); }
      j.etat = 'libre';
      j.juggle = 0;
    }
  }
  // Le combo retombe quand l'adversaire reprend la main.
  const o = adv(c, j);
  if (j.combo.n && !['touche', 'vol', 'sol', 'saisi'].includes(o.etat)) {
    if (j.combo.n >= 3) evt(c, { type: 'combo-fin', joueur: j.n, n: j.combo.n, degats: j.combo.degats });
    j.combo = { n: 0, degats: 0 };
  }
  if (!j.action && j.etat === 'libre') j.chaine = '';
}

/** Deux combattants au sol ne se chevauchent pas. */
function pousser(c) {
  const [a, b] = c.joueurs;
  if (a.cache || b.cache || c.cine) return;
  const d = Math.abs(a.x - b.x);
  const hauteur = Math.abs(a.y - b.y);
  if (d < PUSH && hauteur < 90) {
    const p = (PUSH - d) / 2;
    const s = a.x < b.x || (a.x === b.x && a.n === 0) ? -1 : 1;
    a.x += s * p; b.x -= s * p;
    for (const j of [a, b]) j.x = Math.max(ARENE.BORD, Math.min(ARENE.L - ARENE.BORD, j.x));
  }
}

function orienterUn(j, o) { j.dir = o.x >= j.x ? 1 : -1; }
function orienter(c) {
  for (const j of c.joueurs) {
    if (j.sol && !j.action && ['libre', 'garde'].includes(j.etat)) orienterUn(j, adv(c, j));
  }
}

/* ------------------------------------------------------------------ */
/* Rounds                                                              */
/* ------------------------------------------------------------------ */

function verifierFin(c) {
  if (c.temps !== Infinity && !c.cine) {
    c.image += 1;
    if (c.image >= 60) { c.image = 0; c.temps -= 1; }
  }
  const morts = c.joueurs.filter((j) => j.hp <= 0);
  if (morts.length) {
    c.phase = 'ko';
    c.phaseT = 0;
    for (const j of morts) if (j.sol) j.etat = 'ko';
    const vivant = c.joueurs.find((j) => j.hp > 0);
    c.gagnantRound = vivant ? vivant.n : null;
    evt(c, { type: 'annonce', texte: 'K.O. !', duree: 110, gros: true, ko: true });
    evt(c, { type: 'son', nom: 'ko' });
    if (vivant && vivant.hp === vivant.hpMax) evt(c, { type: 'annonce', texte: 'PERFECT !', duree: 90, retard: 50 });
  } else if (c.temps <= 0) {
    c.phase = 'temps';
    c.phaseT = 0;
    const [a, b] = c.joueurs;
    const pa = a.hp / a.hpMax;
    const pb = b.hp / b.hpMax;
    c.gagnantRound = pa > pb ? 0 : pb > pa ? 1 : null;
    evt(c, { type: 'annonce', texte: 'TEMPS !', duree: 100, gros: true });
  }
}

function finDeRound(c) {
  c.phaseT += 1;
  if (c.phaseT === 120 && c.gagnantRound !== null) {
    const g = c.joueurs[c.gagnantRound];
    g.victoires += 1;
    g.etat = 'victoire';
    evt(c, { type: 'victoire-round', joueur: g.n });
  }
  if (c.phaseT < 200) return;
  const champion = c.joueurs.find((j) => j.victoires >= (c.victoiresRequises || VICTOIRES));
  if (champion) {
    c.phase = 'fin';
    c.vainqueur = champion.n;
    evt(c, { type: 'fin', joueur: champion.n });
    return;
  }
  nouveauRound(c);
}

function nouveauRound(c) {
  c.round += 1;
  c.temps = ROUND_S;
  c.image = 0;
  c.phase = 'intro';
  c.phaseT = 0;
  c.projectiles = [];
  c.zones = [];
  c.gagnantRound = null;
  for (const j of c.joueurs) {
    Object.assign(j, {
      hp: j.hpMax, x: j.n === 0 ? 300 : 700, y: ARENE.SOL, vx: 0, vy: 0, dir: j.n === 0 ? 1 : -1, sol: true,
      etat: 'libre', action: null, stun: 0, invincible: 0, armure: 0, garde: null, statuts: {}, juggle: 0, cache: false,
      combo: { n: 0, degats: 0 }, chaine: '', tampon: [],
    });
  }
}

/** L'entraînement : le mannequin se refait une santé, la jauge se recharge. */
function entrainer(c) {
  const [moi, mannequin] = c.joueurs;
  if (!['touche', 'vol', 'sol'].includes(mannequin.etat) && !c.cine) {
    mannequin.hp = Math.min(mannequin.hpMax, mannequin.hp + 2);
  }
  if (mannequin.hp <= 0) mannequin.hp = 1;
  if (moi.hp <= 0) moi.hp = 1;
  moi.sp = Math.min(100, moi.sp + 0.5);
}

/* ------------------------------------------------------------------ */
/* L'ordinateur                                                        */
/* ------------------------------------------------------------------ */

/** Les entrées qui font une manipulation, image par image. */
function sequence(j, entree) {
  const avant = j.dir > 0 ? 'd' : 'g';
  const arriere = j.dir > 0 ? 'g' : 'd';
  const dir = { F: avant, B: arriere, D: 'b', U: 'h' };
  const etapes = [];
  for (const x of entree) {
    if (dir[x]) { etapes.push({ [dir[x]]: true }); etapes.push({}); } else etapes.push({ [x]: true });
  }
  return etapes;
}

/**
 * L'ordinateur joue comme un joueur : il produit des entrées. Il réagit
 * avec un temps de retard (selon son niveau), garde, s'approche ou reste à
 * distance selon ses armes, enchaîne et lance ses spéciaux.
 */
function penser(c, j) {
  const ia = j.ia;
  const N = NIVEAUX_IA[ia.niveau];
  const o = adv(c, j);
  const p = perso(j);
  const e = { ...VIDE };
  const avant = j.dir > 0 ? 'd' : 'g';
  const arriere = j.dir > 0 ? 'g' : 'd';
  const dist = Math.abs(o.x - j.x);
  const R = () => hasard(c);

  // Une manipulation en cours : on la déroule.
  if (ia.combo && ia.combo.length) return { ...e, ...ia.combo.shift() };

  // Garder : l'adversaire frappe, ou un projectile arrive.
  const menace = (o.action && o.action.t < o.action.fin - 4 && dist < 240)
    || c.projectiles.some((pr) => pr.j !== j.n && Math.abs(pr.x - j.x) < 220 && Math.sign(j.x - pr.x) === Math.sign(pr.vx));
  if (menace && ia.gardeDecidee === undefined) ia.gardeDecidee = R() < N.garde;
  if (!menace) ia.gardeDecidee = undefined;
  if (menace && ia.gardeDecidee && j.sol && !j.action) {
    e[arriere] = true;
    // Contre un balayage, on garde accroupi.
    if (o.action?.nom === 'bK' || o.action?.def?.solSeulement || o.action?.def?.balaye) e.b = true;
    return e;
  }

  ia.t -= 1;
  if (ia.t > 0) return { ...e, ...(ia.tenir || {}) };
  ia.t = N.reaction + Math.floor(R() * N.reaction);
  ia.tenir = {};
  const souffle = () => { ia.t += N.repos + Math.floor(R() * N.repos); };

  // L'ultime, si l'adversaire est à portée.
  if (j.sp >= JAUGE.ulti && dist < p.ulti.portee * 0.85 && R() < N.special) { souffle(); return { ...e, U: true }; }

  // Contre un saut : l'anti-aérien.
  if (!o.sol && o.vy < 0 && dist < 200 && R() < N.precision * 0.6) {
    if (p.specB.lance && j.sp >= JAUGE.specB) return { ...e, B: true };
    const anti = p.combos.find((x) => x.coup.lance);
    if (anti) { ia.combo = sequence(j, anti.entree); return { ...e, ...ia.combo.shift() }; }
    return { ...e, K: true };
  }

  // De près : enchaîner, saisir.
  if (dist < 105) {
    const r = R();
    if (r < 0.86) souffle();
    if (r < N.combo * 0.55) { ia.combo = [{ P: true }, {}, {}, {}, {}, {}, { P: true }, {}, {}, {}, {}, {}, { K: true }]; return { ...e, ...ia.combo.shift() }; }
    if (r < N.combo * 0.75 && j.sp >= JAUGE.specB) return { ...e, B: true };
    if (r < 0.62) return { ...e, [R() < 0.5 ? 'P' : 'K']: true, b: R() < 0.25 };
    if (r < 0.78 && o.sol) return { ...e, G: true };
    if (r < 0.86) { ia.tenir = { [arriere]: true }; return { ...e, [arriere]: true }; }
    const cb = p.combos.filter((x) => x.entree !== 'PPK' && x.coup.type !== 'garde' && x.coup.type !== 'soin');
    if (cb.length) { ia.combo = sequence(j, cb[Math.floor(R() * cb.length)].entree); return { ...e, ...ia.combo.shift() }; }
    return e;
  }

  // À distance : les spéciaux, ou s'approcher (en sautant parfois).
  const r = R();
  if (r < 0.5) souffle();
  if (r < N.special * 0.45 && j.sp >= JAUGE.specA) return { ...e, A: true };
  if (r < N.special * 0.55 && j.sp >= JAUGE.specB && p.specB.type !== 'ruee') return { ...e, B: true };
  const tir = p.combos.find((x) => x.coup.type === 'projectile' || x.coup.type === 'zone');
  if (tir && dist > 260 && r < 0.3 + N.special * 0.2) { ia.combo = sequence(j, tir.entree); return { ...e, ...ia.combo.shift() }; }
  if (R() < N.agressif) {
    ia.tenir = { [avant]: true };
    if (dist < 320 && R() < 0.18) return { ...e, [avant]: true, h: true };
    return { ...e, [avant]: true };
  }
  if (R() < 0.3) { ia.tenir = { [arriere]: true }; return { ...e, [arriere]: true }; }
  return e;
}

/* ------------------------------------------------------------------ */
/* Petits outils pour l'écran                                          */
/* ------------------------------------------------------------------ */

/** Vide les événements de l'image (sons, impacts, textes) pour l'écran. */
export function evenements(c) {
  const ev = c.ev;
  c.ev = [];
  return ev;
}

/** La pose à dessiner. */
export function pose(j) {
  if (j.etat === 'ko') return 'ko';
  if (j.etat === 'victoire') return 'victoire';
  if (j.etat === 'sol') return 'sol';
  if (j.etat === 'vol') return 'vol';
  if (j.etat === 'touche') return 'touche';
  if (j.etat === 'garde') return j.accroupi ? 'garde-bas' : 'garde';
  if (j.etat === 'saisi') return 'touche';
  if (j.etat === 'saisi-att') return 'saisie';
  if (j.etat === 'ulti') return 'ulti';
  if (j.action) {
    const a = j.action;
    if (a.type === 'normal') return { P: 'poing', K: 'pied', bP: 'poing-bas', bK: 'balayage', aP: 'poing-air', aK: 'pied-air' }[a.nom];
    if (a.type === 'saisie') return 'saisie';
    if (a.def.type === 'ruee') return a.def.tourne ? 'tourne' : a.def.vy && a.def.vy < -8 ? 'uppercut' : 'ruee';
    if (a.def.type === 'garde') return 'garde';
    return 'lance';
  }
  if (!j.sol) return 'saut';
  if (j.accroupi) return j.enGarde ? 'garde-bas' : 'accroupi';
  if (j.enGarde) return 'garde';
  if (Math.abs(j.vx) > 0.5) return 'marche';
  return 'repos';
}
