/**
 * LÉGENDES — le calendrier : quels portails sont ouverts à une date donnée.
 *
 *   le portail permanent : toujours là (les personnages de base, et les vedettes une fois leur portail fini) ;
 *   le portail en rotation : un nouveau tous les ROTATION jours (deux semaines), avec ses
 *     vedettes ; un sur deux GARANTIT un personnage de la bannière à chaque multi, l'autre est à PALIERS (le
 *     5e palier garantit le nouveau personnage) ; quand toutes les vedettes sont sorties, ils reviennent ;
 *   les célébrations : anniversaire du jeu, Halloween, Noël, Nouvel An, Saint-Valentin, l'été ; chacune a
 *     son portail à paliers (son personnage garanti au 5e), son cadeau de jetons et son habillage.
 *
 * Tout dépend de la date (en jours UTC) : le même jour, tout le monde voit les mêmes portails.
 */

import { PERSOS, TIRABLE } from './persos.js';

/** Le jour de lancement (le premier anniversaire sera en novembre 2027) et la durée d'un portail en rotation. */
export const LANCEMENT = Date.UTC(2026, 10, 5) / 86400000;
export const ROTATION = 14;

/** Le numéro du jour (UTC) d'une date. */
export const jourDe = (date = new Date()) => Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
/** La date (pour l'affichage) d'un numéro de jour. */
export const dateDe = (jour) => new Date(jour * 86400000);

/**
 * Les célébrations : du [mois, jour] au [mois, jour] (inclus), chaque année (depuis : à partir de cette
 * année ; seulement : cette année-là). Les GRANDES (l'anniversaire en novembre, l'été en juillet) durent tout
 * le mois, en trois PARTIES : chacune son portail, son nouveau personnage, son épreuve, son cadeau.
 */
const PARTIES = (m, fin) => [
  { n: 1, nom: 'Partie 1', debut: [m, 1], fin: [m, 10] },
  { n: 2, nom: 'Partie 2', debut: [m, 11], fin: [m, 20] },
  { n: 3, nom: 'Partie 3 · Le final', debut: [m, 21], fin: [m, fin] },
];
export const FETES = [
  { id: 'lancement', nom: 'Lancement de LÉGENDES', glyphe: '🚀', debut: [11, 5], fin: [11, 19], seulement: 2026, cadeau: 500, couleurs: ['#3ae0ff', '#ff4dd8'], texte: 'Bienvenue ! 500 jetons offerts, et le duo du lancement garanti au 5e palier.' },
  { id: 'anniversaire', nom: 'Anniversaire de LÉGENDES', glyphe: '🎂', debut: [11, 1], fin: [11, 30], depuis: 2027, grande: true, parties: PARTIES(11, 30), cadeau: 400, couleurs: ['#ffd23f', '#ff4dd8'], texte: 'Tout le mois de novembre : trois parties, trois nouveaux LR, des cadeaux à chaque partie.' },
  { id: 'halloween', nom: 'Nuit d’Halloween', glyphe: '🎃', debut: [10, 18], fin: [10, 31], cadeau: 200, couleurs: ['#ff7a1a', '#6b2fb3'], texte: 'Les lanternes s’allument : la Reine Citrouille arrive.' },
  { id: 'noel', nom: 'Noël des Légendes', glyphe: '🎄', debut: [12, 15], fin: [12, 29], cadeau: 300, couleurs: ['#c81a2a', '#2e8a3e'], texte: 'Sous le sapin : 300 jetons et l’Esprit de Noël.' },
  { id: 'nouvelan', nom: 'Nouvel An', glyphe: '🎆', debut: [12, 30], fin: [1, 10], cadeau: 250, couleurs: ['#ffd23f', '#3a8dff'], texte: 'Bonne année ! Le grand bouquet final illumine le ciel.' },
  { id: 'valentin', nom: 'Saint-Valentin', glyphe: '💘', debut: [2, 7], fin: [2, 16], cadeau: 150, couleurs: ['#ff4d6d', '#ff8ad8'], texte: 'Les flèches du cœur pleuvent sur le portail.' },
  { id: 'ete', nom: 'Festival de l’Été', glyphe: '🏖️', debut: [7, 1], fin: [7, 31], grande: true, parties: PARTIES(7, 31), cadeau: 300, couleurs: ['#ffd23f', '#3a8dff'], texte: 'Tout le mois de juillet : trois parties, soleil, plage et nouveaux LR.' },
];
export const FETE = Object.fromEntries(FETES.map((f) => [f.id, f]));
/** Les fêtes d'un personnage (un nom, ou une liste). */
export const fetesDe = (x) => (!x.fete ? [] : Array.isArray(x.fete) ? x.fete : [x.fete]);

/** Les vedettes des portails en rotation, dans l'ordre de leur sortie. */
const VEDETTES = PERSOS.filter((x) => x.sortie !== undefined && TIRABLE(x));
export const NB_SORTIES = Math.max(...VEDETTES.map((x) => x.sortie)) + 1;

/** L'indice du portail en rotation ouvert ce jour-là, et ses dates. */
export function rotationDu(jour) {
  const k = Math.max(0, Math.floor((jour - LANCEMENT) / ROTATION));
  return { k, debut: LANCEMENT + k * ROTATION, fin: LANCEMENT + (k + 1) * ROTATION - 1 };
}

const intervalle = (a, de) => {
  const debut = Date.UTC(a, de.debut[0] - 1, de.debut[1]) / 86400000;
  const finAn = de.fin[0] < de.debut[0] ? a + 1 : a;
  return { debut, fin: Date.UTC(finAn, de.fin[0] - 1, de.fin[1]) / 86400000 };
};
/** Est-ce que le jour (UTC) tombe dans la fête f (qui peut chevaucher deux années) ? Rend ses dates, l'année, la partie en cours. */
export function dansFete(f, jour) {
  const an = dateDe(jour).getUTCFullYear();
  for (const a of [an - 1, an]) {
    if ((f.depuis && a < f.depuis) || (f.seulement && a !== f.seulement)) continue;
    const { debut, fin } = intervalle(a, f);
    if (jour < debut || jour > fin) continue;
    const partie = f.parties?.find((p) => { const x = intervalle(a, p); return jour >= x.debut && jour <= x.fin; });
    const dp = partie && intervalle(a, partie);
    return { debut, fin, annee: a, partie: partie?.n || 0, partieNom: partie?.nom || '', partieDebut: dp?.debut, partieFin: dp?.fin };
  }
  return null;
}

/** Les célébrations en cours. */
export const fetesDu = (jour) => FETES.map((f) => { const d = dansFete(f, jour); return d ? { ...f, ...d } : null; }).filter(Boolean);

/**
 * Le portail permanent est mis à jour tous les trois mois (MAJ_PERMANENT jours) : il prend alors tous les
 * personnages qu'il n'avait pas (les vedettes dont le portail est fini, et les personnages des fêtes passées).
 */
export const MAJ_PERMANENT = 91;
export const derniereMaj = (jour) => LANCEMENT + Math.floor(Math.max(0, jour - LANCEMENT) / MAJ_PERMANENT) * MAJ_PERMANENT;
export const prochaineMaj = (jour) => derniereMaj(jour) + MAJ_PERMANENT;
/** Le jour où un personnage de fête a fini sa première fête (sa partie, pour une grande fête). */
const finPremiereFete = (() => {
  const cache = {};
  return (x) => {
    if (cache[x.id] !== undefined) return cache[x.id];
    let best = Infinity;
    for (const id of fetesDe(x)) {
      const f = FETE[id];
      for (let a = 2026; a < 2040; a++) {
        if ((f.depuis && a < f.depuis) || (f.seulement && a !== f.seulement)) continue;
        const de = f.parties ? f.parties[(x.partie || 1) - 1] : f;
        const { debut, fin } = intervalle(a, de);
        if (debut < LANCEMENT) continue;
        best = Math.min(best, fin);
        break;
      }
    }
    return (cache[x.id] = best);
  };
})();
/** Les personnages qui sont dans le portail permanent ce jour-là. */
export function permanents(jour) {
  const maj = derniereMaj(jour);
  return PERSOS.filter((x) => {
    if (!TIRABLE(x)) return false;
    if (x.fete) return finPremiereFete(x) < maj;
    if (x.sortie === undefined) return true;
    return LANCEMENT + (x.sortie + 1) * ROTATION - 1 < maj;
  });
}
/** Ceux qui peuvent revenir sur le portail du retour : les vedettes déjà passées, les SSR du permanent. */
function revenants(k) {
  return PERSOS.filter((x) => TIRABLE(x) && !x.fete && ((x.sortie !== undefined && x.sortie < Math.min(k, NB_SORTIES)) || (x.sortie === undefined && x.rarete === 'SSR')));
}
/** Le nombre d'invocations du portail du retour. */
export const MAX_RETOUR = 50;

/**
 * Les portails ouverts ce jour-là : [{ id, nom, type ('permanent' | 'garanti' | 'paliers'), vedettes: [id],
 *   nouveaux: [id] (garantis au 5e palier), pool: [id], debut, fin, fete?, partie? }].
 */
export function portails(jour) {
  const perm = permanents(jour).map((x) => x.id);
  const out = [{ id: 'permanent', nom: 'Portail des Légendes', type: 'permanent', vedettes: [], nouveaux: [], pool: perm }];
  const r = rotationDu(jour);
  const tour = r.k % NB_SORTIES, reprise = r.k >= NB_SORTIES;
  const vedettes = VEDETTES.filter((x) => x.sortie === tour).map((x) => x.id);
  out.push({
    id: `rotation-${r.k}`, nom: reprise ? 'Le Retour des Légendes' : 'Nouvelles Légendes', type: r.k % 2 === 0 ? 'garanti' : 'paliers',
    vedettes, nouveaux: reprise ? [] : vedettes, pool: [...new Set([...perm, ...vedettes])], debut: r.debut, fin: r.fin, reprise,
  });
  // Le portail du retour : des personnages déjà sortis reviennent, pour un nombre limité d'invocations.
  const rev = revenants(r.k).filter((x) => !vedettes.includes(x.id));
  if (rev.length) {
    const lr = rev.filter((x) => x.versLR), autres = rev.filter((x) => !x.versLR);
    const choix = [];
    if (lr.length) choix.push(lr[(r.k * 3) % lr.length].id);
    for (let i = 0; choix.length < 3 && i < autres.length; i++) { const id = autres[(r.k * 5 + i * 7) % autres.length].id; if (!choix.includes(id)) choix.push(id); }
    out.push({ id: `retour-${r.k}`, nom: 'Le Retour', type: 'garanti', vedettes: choix, nouveaux: [], pool: [...new Set([...perm, ...choix])], debut: r.debut, fin: r.fin, max: MAX_RETOUR, retour: true });
  }
  for (const f of fetesDu(jour)) {
    // Les personnages de la fête : pour une grande, ceux des parties déjà ouvertes (les nouveaux : ceux de la partie en cours).
    const siens = PERSOS.filter((x) => TIRABLE(x) && fetesDe(x).includes(f.id) && (!f.partie || (x.partie || 1) <= f.partie));
    const nouveaux = siens.filter((x) => !f.partie || (x.partie || 1) === f.partie).map((x) => x.id);
    const invites = PERSOS.filter((x) => x.versLR && TIRABLE(x) && !x.fete && (x.sortie ?? 99) < Math.min(r.k, NB_SORTIES)).slice(-2).map((x) => x.id);
    const ids = siens.map((x) => x.id);
    out.push({
      id: `fete-${f.id}-${f.annee}${f.partie ? `-${f.partie}` : ''}`, nom: `${f.glyphe} ${f.nom}${f.partie ? ` · ${f.partieNom}` : ''}`,
      type: f.partie === 3 ? 'garanti' : 'paliers', vedettes: [...nouveaux, ...ids.filter((id) => !nouveaux.includes(id)), ...invites], nouveaux,
      pool: [...new Set([...perm, ...ids, ...invites])], debut: f.partieDebut ?? f.debut, fin: f.partieFin ?? f.fin, fete: f.id, partie: f.partie,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Les sorties et les annonces                                         */
/* ------------------------------------------------------------------ */

import { LIGNEES, ligneeDe, PERSO as _PERSO } from './persos.js';

/** Le jour où une lignée devient tirable : le lancement (les personnages de base), son portail, ou sa première fête. */
const debutPremiereFete = (x) => {
  let best = Infinity;
  for (const id of fetesDe(x)) {
    const f = FETE[id];
    for (let a = 2026; a < 2040; a++) {
      if ((f.depuis && a < f.depuis) || (f.seulement && a !== f.seulement)) continue;
      const de = f.parties ? f.parties[(x.partie || 1) - 1] : f;
      const { debut } = intervalle(a, de);
      if (debut < LANCEMENT) continue;
      best = Math.min(best, debut);
      break;
    }
  }
  return best;
};
export function sortieDe(id) {
  const l = LIGNEES[ligneeDe(_PERSO[id])].map((y) => _PERSO[y]);
  let jour = -Infinity;
  for (const x of l) {
    if (x.fete) jour = Math.max(jour, debutPremiereFete(x));
    else if (x.sortie !== undefined) jour = Math.max(jour, LANCEMENT + x.sortie * ROTATION);
  }
  return jour;
}
/** Le personnage (sa lignée) est-il déjà sorti ce jour-là ? */
export const estSorti = (id, jour) => sortieDe(id) <= jour;

/** Combien de jours avant une sortie on l'annonce (le teasing). */
export const JOURS_ANNONCE = 3;
/**
 * Les annonces : ce qui sort dans les JOURS_ANNONCE prochains jours (le prochain portail, la prochaine fête ou
 * partie de fête) : [{ nom, jour (de la sortie), persos: [ids], fete? }].
 */
export function annonces(jour) {
  const out = [];
  const r = rotationDu(jour), k = r.k + 1, debut = LANCEMENT + k * ROTATION;
  if (debut - jour <= JOURS_ANNONCE && k < NB_SORTIES) {
    const persos = PERSOS.filter((x) => x.sortie === k && x.rarete !== 'UR' && !x.dokkan && (x.rarete === 'LR' || TIRABLE(x))).map((x) => x.id);
    if (persos.length) out.push({ nom: 'Nouvelles Légendes', jour: debut, persos });
  }
  for (let d = 1; d <= JOURS_ANNONCE; d++) {
    for (const f of fetesDu(jour + d)) {
      const deja = fetesDu(jour).some((g) => g.id === f.id && g.partie === f.partie);
      const debutF = f.partieDebut ?? f.debut;
      if (deja || debutF !== jour + d) continue;
      const persos = PERSOS.filter((x) => fetesDe(x).includes(f.id) && (!f.partie || (x.partie || 1) === f.partie) && !x.dokkan && (x.rarete === 'LR' || TIRABLE(x))).map((x) => x.id);
      out.push({ nom: `${f.glyphe} ${f.nom}${f.partie ? ` · ${f.partieNom}` : ''}`, jour: debutF, persos, fete: f.id });
    }
  }
  // Une base SSR dont la forme LR est déjà montrée ne compte pas deux fois.
  for (const a of out) a.persos = a.persos.filter((id) => !a.persos.includes(_PERSO[id].versLR));
  return out;
}
