/**
 * STREET COMBAT — le combat en ligne, à deux, chacun sur son appareil.
 *
 * Le moteur est déterministe : avec la même graine et les mêmes entrées,
 * deux appareils jouent exactement le même combat. Chacun envoie donc ses
 * entrées (dix touches, un nombre) avec DELAI images d'avance, et ne fait
 * avancer le combat d'une image que lorsqu'il a les entrées des deux
 * joueurs pour cette image (le « lockstep »). Le serveur ne fait que
 * relayer (server/street.js). De temps en temps, chacun envoie une
 * empreinte de l'état : si elles diffèrent, on le signale.
 */

import { creerConnexion } from '../../../shared/connexion.js';

/** Les entrées partent avec autant d'images d'avance (≈ 80 ms) : de quoi absorber le trajet. */
export const DELAI = 5;
const TOUCHES = ['g', 'd', 'h', 'b', 'P', 'K', 'G', 'A', 'B', 'U'];
/** Dix touches → un nombre, et retour. */
export const coder = (e) => TOUCHES.reduce((m, k, i) => (e[k] ? m | (1 << i) : m), 0);
export const decoder = (m) => Object.fromEntries(TOUCHES.map((k, i) => [k, !!(m & (1 << i))]));

/** L'empreinte d'un combat : de quoi voir si deux appareils jouent toujours la même chose. */
export function empreinte(c) {
  let h = c.f | 0;
  for (const j of c.joueurs) for (const v of [j.hp, Math.round(j.x), Math.round(j.y), j.sp, j.victoires]) h = (Math.imul(h, 31) + (v | 0)) | 0;
  return String(h >>> 0);
}

/* ------------------------------------------------------------------ */
/* Le lockstep                                                         */
/* ------------------------------------------------------------------ */

export const LS = { actif: false, n: 0, f: 0, locales: new Map(), distantes: new Map(), attente: 0, empreintes: new Map(), desynchro: false };

/** Un nouveau combat : les DELAI premières images se jouent sans rien toucher. */
export function preparer(n) {
  Object.assign(LS, { actif: true, n, f: 0, attente: 0, desynchro: false });
  LS.locales.clear(); LS.distantes.clear(); LS.empreintes.clear();
  for (let f = 0; f < DELAI; f++) { LS.locales.set(f, 0); LS.distantes.set(f, 0); }
}

/**
 * Les entrées de la prochaine image, [joueur 1, joueur 2] — ou null s'il
 * faut encore attendre celles de l'adversaire. `lireLocal` donne les touches
 * de ce joueur-ci, maintenant.
 */
export function entreesDuPas(lireLocal) {
  const cible = LS.f + DELAI;
  if (!LS.locales.has(cible)) {
    const m = coder(lireLocal());
    LS.locales.set(cible, m);
    envoyer({ t: 'entrees', f: cible, e: m });
  }
  if (!LS.distantes.has(LS.f) || !LS.locales.has(LS.f)) { LS.attente += 1; return null; }
  LS.attente = 0;
  const moi = LS.locales.get(LS.f);
  const lui = LS.distantes.get(LS.f);
  LS.locales.delete(LS.f);
  LS.distantes.delete(LS.f);
  LS.f += 1;
  return (LS.n === 0 ? [moi, lui] : [lui, moi]).map(decoder);
}

/** Après chaque image : de temps en temps, on compare les empreintes. */
export function apresPas(c) {
  if (LS.f % 120 !== 0) return;
  const h = empreinte(c);
  const autre = LS.empreintes.get(LS.f);
  if (autre !== undefined && autre !== h) LS.desynchro = true;
  LS.empreintes.set(LS.f, h);
  envoyer({ t: 'hash', f: LS.f, h });
}

/* ------------------------------------------------------------------ */
/* La connexion, la salle                                              */
/* ------------------------------------------------------------------ */

let rappels = {};
let net = null;
export const salle = { code: null, n: -1, enCombat: false };

function traiter(m) {
  if (!m || m.g !== 'street') return;
  switch (m.t) {
    case 'salle': salle.code = m.code; salle.n = m.n; rappels.salle?.(m); break;
    case 'debut': salle.n = m.n; salle.enCombat = true; preparer(m.n); rappels.debut?.(m); break;
    case 'entrees': LS.distantes.set(m.f, m.e); break;
    case 'hash': {
      const ici = LS.empreintes.get(m.f);
      if (ici !== undefined && ici !== m.h) LS.desynchro = true;
      LS.empreintes.set(m.f, m.h);
      break;
    }
    case 'revanche': rappels.revanche?.(m); break;
    case 'parti': salle.code = null; salle.enCombat = false; LS.actif = false; rappels.parti?.(); break;
    case 'erreur': rappels.erreur?.(m.msg); break;
    default:
  }
}

export function envoyer(m) { net?.envoyer({ g: 'street', ...m }); }

/** Se connecter, avec ce qu'il faut faire de chaque nouvelle. */
export function connecter(r) {
  rappels = r;
  if (!net) {
    net = creerConnexion({
      jeu: 'street', g: 'street', session: false,
      message: traiter,
      statut: (s) => rappels.statut?.(s),
    });
  }
  net.ouvrir();
}

export const creer = (perso, nom) => envoyer({ t: 'creer', perso, nom, arene: 'hasard' });
export const rejoindre = (code, perso, nom) => envoyer({ t: 'rejoindre', code, perso, nom });
export const revanche = () => envoyer({ t: 'revanche' });
export function quitter() {
  envoyer({ t: 'quitter' });
  salle.code = null;
  salle.enCombat = false;
  LS.actif = false;
}
