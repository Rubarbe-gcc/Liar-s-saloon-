/**
 * STREET COMBAT — le tutoriel et les défis de combos.
 *
 * Le tutoriel : dix étapes guidées contre un mannequin (bouger, sauter,
 * s'accroupir, frapper, enchaîner, garder, le spécial, la saisie,
 * l'ultime). Chaque étape attend que le joueur l'ait vraiment faite, en
 * regardant l'état du combat ou ses événements.
 *
 * Les défis de combos : cinq par combattant, à réussir à l'entraînement ;
 * une étoile par défi.
 */

import { PERSO, lireEntree } from '../../../shared/street/persos.js';

/** Les touches, au clavier ou au doigt. */
const CLAVIER = { g: 'Q ou ←', d: 'D ou →', h: 'Z ou ↑', b: 'S ou ↓', P: 'F', K: 'G', G: 'R', A: 'V', B: 'B', U: 'T' };
const DOIGT = { g: 'le joystick vers la gauche', d: 'le joystick vers la droite', h: 'le joystick vers le haut', b: 'le joystick vers le bas', P: '👊', K: '🦶', G: '✊', A: 'A', B: 'B', U: 'ULTI' };
export const touche = (k, tactile) => (tactile ? DOIGT : CLAVIER)[k];

/**
 * Les étapes : `ok(c)` regarde l'état du combat, `evt(e, c)` un événement ;
 * `debut(c)` prépare l'étape (la jauge pleine, le mannequin qui attaque…),
 * `fin(c)` la range.
 */
/** Mon coup (poing ou pied) vient de toucher. */
const aTouche = (c, quel) => { const a = c.joueurs[0].action; return !!(a && a.touche && quel.test(a.nom || '')); };

export const ETAPES = [
  { titre: 'Bouger', texte: (t) => `Avance vers le mannequin : ${t('d')}.`, ok: (c) => c.joueurs[0].x > 470 },
  { titre: 'Sauter', texte: (t) => `Saute : ${t('h')}.`, ok: (c) => !c.joueurs[0].sol },
  { titre: 'S’accroupir', texte: (t) => `Accroupis-toi : ${t('b')}. Accroupi, on esquive les coups hauts.`, ok: (c) => c.joueurs[0].accroupi },
  { titre: 'Le poing', texte: (t) => `Frappe le mannequin avec le poing : ${t('P')}.`, ok: (c) => aTouche(c, /P$/) },
  { titre: 'Le pied', texte: (t) => `Et maintenant le pied : ${t('K')}. Plus lent, mais il porte plus loin.`, ok: (c) => aTouche(c, /K$/) },
  {
    titre: 'Enchaîner', texte: (t) => `Un coup qui touche s’enchaîne dans le suivant. Fais 👊 👊 🦶 : ${t('P')}, ${t('P')}, ${t('K')}, vite !`,
    evt: (e, c) => e.type === 'combo-nom' && e.joueur === 0 && e.nom === PERSO[c.joueurs[0].id].combos[0].nom,
  },
  {
    titre: 'Garder', texte: (t) => `Le mannequin attaque ! Recule pour garder : ${t('g')}. (Accroupi en reculant contre les balayages.)`,
    // Le mannequin vient au contact, et attaque souvent : on n'attend pas.
    debut: (c) => {
      const [moi, lui] = c.joueurs;
      lui.x = Math.max(80, Math.min(920, moi.x + moi.dir * 120));
      lui.ia = { niveau: 'difficile', t: 0, plan: null, combo: null };
    },
    fin: (c) => { c.joueurs[1].ia = null; },
    evt: (e) => e.type === 'garde' && e.joueur === 0,
  },
  {
    titre: 'Le spécial', texte: (t) => `Ta jauge se remplit en frappant. Un segment : le spécial B. Lance-le : ${t('B')}.`,
    debut: (c) => { c.joueurs[0].sp = 100; }, evt: (e) => e.type === 'special' && e.joueur === 0,
  },
  { titre: 'La saisie', texte: (t) => `Colle-toi au mannequin et saisis-le : ${t('G')}. Une saisie passe la garde !`, evt: (e) => e.type === 'saisie' && e.joueur === 0 },
  {
    titre: 'L’ultime', texte: (t) => `Jauge pleine : l’ULTIME ! Approche-toi, puis ${t('U')}.`,
    debut: (c) => { c.joueurs[0].sp = 100; }, evt: (e) => e.type === 'ulti' && e.joueur === 0,
  },
];

/** Le déroulé du tutoriel. */
export function creerTuto() {
  return { i: 0, reussi: 0, fini: false };
}

/** Une image de tutoriel : l'étape est-elle faite ? Rend 'suivante', 'fini' ou rien. */
export function avancerTuto(T, c, evs) {
  if (T.fini) return null;
  const e = ETAPES[T.i];
  if (T.reussi > 0) {
    // Un petit temps pour savourer, puis l'étape suivante.
    T.reussi -= 1;
    if (T.reussi > 0) return null;
    e.fin?.(c);
    T.i += 1;
    if (T.i >= ETAPES.length) { T.fini = true; return 'fini'; }
    ETAPES[T.i].debut?.(c);
    return 'suivante';
  }
  if (T.i === 0 && !T.commence) { T.commence = true; e.debut?.(c); }
  const fait = (e.ok && e.ok(c)) || (e.evt && evs.some((x) => e.evt(x, c)));
  if (fait) { T.reussi = 45; return 'reussi'; }
  return null;
}

/* ------------------------------------------------------------------ */
/* Les défis de combos                                                 */
/* ------------------------------------------------------------------ */

/** Les cinq défis d'un combattant. */
export function defisDe(p) {
  const combo = (k) => (e) => e.type === 'combo-nom' && e.joueur === 0 && e.nom === p.combos[k].nom;
  return [
    { texte: `L’enchaînement : 👊 👊 🦶 (${p.combos[0].nom})`, evt: combo(0) },
    { texte: `${p.combos[1].nom} : ${lireEntree(p.combos[1].entree)}`, evt: combo(1) },
    { texte: `${p.combos[2].nom} : ${lireEntree(p.combos[2].entree)}`, evt: combo(2) },
    { texte: 'Un combo de 4 coups', evt: (e) => e.type === 'combo' && e.joueur === 0 && e.n >= 4 },
    { texte: 'Un combo de 6 coups', evt: (e) => e.type === 'combo' && e.joueur === 0 && e.n >= 6 },
  ];
}

/** Les défis réussis par ces événements (indices), parmi ceux qui ne l'étaient pas encore. */
export function defisReussis(p, faits, evs) {
  const nouveaux = [];
  defisDe(p).forEach((d, i) => { if (!faits.includes(i) && evs.some(d.evt)) nouveaux.push(i); });
  return nouveaux;
}
