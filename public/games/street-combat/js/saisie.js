/**
 * STREET COMBAT — l'animation d'une saisie.
 *
 * Le moteur (shared/street/combat.js) déroule la saisie étape par étape
 * (c.cine : seq, pas, pasT ; les dégâts tombent à la moitié de chaque étape).
 * Ici, on en tire ce qu'il faut dessiner, sans rien changer au combat :
 *   - celui qui saisit attrape l'autre au col (sa main y reste : voir
 *     `saisir` dans dessin.js) et frappe à chaque étape, selon son mot
 *     (POING, PIED, UPPERCUT, SLAM, GRIFFE, FLAMME…), l'élan avant, l'impact
 *     pile à l'image des dégâts ;
 *   - l'autre encaisse : il recule, se plie, décolle sur un uppercut ;
 *   - la dernière étape est la projection : on le soulève et on le jette en
 *     avant ; il finit dans la pose du vol, celle que le moteur prend ensuite.
 * Tout se déduit de l'état du moteur : en ligne et dans les replays, chacun
 * voit la même chose.
 */

import { squelette } from './dessin.js';

const doux = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

/** Le genre d'une étape, d'après son mot (ce qui ne correspond à rien : un coup d'énergie, paume ouverte). */
const GENRES = [
  [/UPPERCUT|ENVOL|SOULEV|DEBOUT|DÉCOLL|ORBITE/, 'uppercut'],
  [/PIED|GENOU|TALON/, 'genou'],
  [/SLAM|ÉCRAS|ECRAS|SUPLEX|RETOURN|CRASH|COLLAPSE|TREMBLEMENT|ENSEVELI|IMPLOSION|ROCHER/, 'ecrase'],
  [/ENTAILLE|TAILLE|REVERS|ESTOC|GRIFFE|LAME|COUPES|FAUCH|CROC|MORSURE|CROISSANT|RÉCOLTE/, 'griffe'],
  [/POING|JAB|CROCHET|K\.O|^UN !|^DEUX|^TROIS|TIENS|^HÉ|\bTOI\b|FRAPPE|^PRIS|SERRE|LEÇON|ATTRAP|^PRISE/, 'poing'],
];
export function genreEtape(mot) {
  const m = String(mot).toUpperCase();
  for (const [re, g] of GENRES) if (re.test(m)) return g;
  return 'souffle';
}

/** Ce qu'encaisse celui qui est tenu, selon le coup. */
const REACTION = { poing: 'tenu', griffe: 'tenu', souffle: 'tenu', genou: 'tenu-plie', ecrase: 'tenu-plie', uppercut: 'tenu-leve', jet: 'projete' };

/** Le recul à l'impact (0 avant, 1 juste après, puis il se reprend un peu). */
const recul = (u) => (u < 0.5 ? 0 : u < 0.62 ? doux((u - 0.5) / 0.12) : 1 - 0.6 * doux((u - 0.62) / 0.38));

/**
 * Ce qu'il faut dessiner pour les deux combattants pendant une saisie.
 * @returns {null | { att: object, def: object }} pour chacun : { pose, p, x, y, enLAir, saisir? }
 */
export function animerSaisie(c, PERSO) {
  const k = c.cine;
  if (!k || k.type !== 'saisie') return null;
  const att = c.joueurs[k.att];
  const def = c.joueurs[k.def];
  const n = k.seq.length;
  const pas = Math.min(k.pas, n - 1);
  const [mot, duree] = k.seq[pas];
  const u = Math.min(1, k.pasT / duree);
  const dernier = pas === n - 1;
  const genre = dernier ? 'jet' : genreEtape(mot);
  const dir = att.dir || 1;

  // On se rapproche pour l'attraper (le moteur les garde à 62 l'un de l'autre), et on se sépare au jet.
  const rapproche = 16 * doux(k.t / 6) * (dernier ? 1 - doux((u - 0.72) / 0.28) : 1);
  const r = genre === 'jet' ? doux(u / 0.9) : recul(u);
  const leve = genre === 'uppercut' ? 44 * r : genre === 'jet' ? (u < 0.75 ? 40 * doux((u - 0.3) / 0.45) : 40 - 34 * doux((u - 0.75) / 0.25)) : 0;
  const repousse = genre === 'jet' ? 16 * doux((u - 0.45) / 0.55) : genre === 'uppercut' ? 16 * r : 9 * r;

  const poseDef = REACTION[genre];
  const D = {
    pose: poseDef, p: r, t: def.anim,
    x: def.x - dir * rapproche * 0.5 + dir * repousse,
    y: def.y - leve,
    enLAir: leve > 1,
  };
  const poseAtt = genre === 'poing' ? (pas % 2 ? 'saisie-crochet' : 'saisie-poing') : `saisie-${genre}`;
  const A = { pose: poseAtt, p: u, t: att.anim, x: att.x + dir * rapproche * 0.5, y: att.y, enLAir: false };

  // La main qui tient : sur le col de l'autre (entre son cou et son épaule, du côté qui nous fait face).
  const pa = PERSO[att.id], pd = PERSO[def.id];
  const sqD = squelette(pd, { pose: D.pose, t: D.t, p: D.p, enLAir: D.enLAir });
  const ed = sqD.car.h, ea = squelette(pa, { pose: 'repos' }).car.h;
  const colX = D.x + (def.dir || -dir) * ed * sqD.epaule.x - dir * 7 * ed;
  const colY = D.y + ed * (sqD.epaule.y + 5);
  A.saisir = { x: ((colX - A.x) * dir) / ea, y: (colY - A.y) / ea };
  return { att: A, def: D, joueurs: [k.att, k.def] };
}
