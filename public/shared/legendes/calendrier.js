/**
 * LÉGENDES — le calendrier : quels portails sont ouverts à une date donnée.
 *
 *   le portail permanent : toujours là (les personnages de base, et les vedettes une fois leur portail fini) ;
 *   le portail en rotation : un nouveau tous les ROTATION jours (entre deux et trois semaines), avec ses
 *     vedettes ; un sur deux GARANTIT un personnage de la bannière à chaque multi, l'autre est à PALIERS (le
 *     5e palier garantit le nouveau personnage) ; quand toutes les vedettes sont sorties, ils reviennent ;
 *   les célébrations : anniversaire du jeu, Halloween, Noël, Nouvel An, Saint-Valentin, l'été ; chacune a
 *     son portail à paliers (son personnage garanti au 5e), son cadeau de jetons et son habillage.
 *
 * Tout dépend de la date (en jours UTC) : le même jour, tout le monde voit les mêmes portails.
 */

import { PERSOS, TIRABLE } from './persos.js';

/** Le jour de lancement (l'anniversaire du jeu) et la durée d'un portail en rotation. */
export const LANCEMENT = Date.UTC(2026, 10, 5) / 86400000;
export const ROTATION = 17;

/** Le numéro du jour (UTC) d'une date. */
export const jourDe = (date = new Date()) => Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
/** La date (pour l'affichage) d'un numéro de jour. */
export const dateDe = (jour) => new Date(jour * 86400000);

/** Les célébrations : du [mois, jour] au [mois, jour] (inclus), chaque année. */
export const FETES = [
  { id: 'anniversaire', nom: 'Anniversaire de LÉGENDES', glyphe: '🎂', debut: [11, 5], fin: [11, 19], cadeau: 500, couleurs: ['#ffd23f', '#ff4dd8'], texte: 'Un an de légendes : 500 jetons offerts, et le duo de l’anniversaire garanti au 5e palier !' },
  { id: 'halloween', nom: 'Nuit d’Halloween', glyphe: '🎃', debut: [10, 20], fin: [11, 3], cadeau: 200, couleurs: ['#ff7a1a', '#6b2fb3'], texte: 'Les lanternes s’allument : la Reine Citrouille arrive.' },
  { id: 'noel', nom: 'Noël des Légendes', glyphe: '🎄', debut: [12, 15], fin: [12, 29], cadeau: 300, couleurs: ['#c81a2a', '#2e8a3e'], texte: 'Sous le sapin : 300 jetons et l’Esprit de Noël.' },
  { id: 'nouvelan', nom: 'Nouvel An', glyphe: '🎆', debut: [12, 30], fin: [1, 10], cadeau: 250, couleurs: ['#ffd23f', '#3a8dff'], texte: 'Bonne année ! Le grand bouquet final illumine le ciel.' },
  { id: 'valentin', nom: 'Saint-Valentin', glyphe: '💘', debut: [2, 7], fin: [2, 16], cadeau: 150, couleurs: ['#ff4d6d', '#ff8ad8'], texte: 'Les flèches du cœur pleuvent sur le portail.' },
  { id: 'ete', nom: 'Festival de l’Été', glyphe: '🏖️', debut: [7, 1], fin: [7, 21], cadeau: 200, couleurs: ['#ffd23f', '#3a8dff'], texte: 'Soleil, plage et tirs de volée.' },
];
export const FETE = Object.fromEntries(FETES.map((f) => [f.id, f]));

/** Les vedettes des portails en rotation, dans l'ordre de leur sortie. */
const VEDETTES = PERSOS.filter((x) => x.sortie !== undefined && TIRABLE(x));
export const NB_SORTIES = Math.max(...VEDETTES.map((x) => x.sortie)) + 1;

/** L'indice du portail en rotation ouvert ce jour-là, et ses dates. */
export function rotationDu(jour) {
  const k = Math.max(0, Math.floor((jour - LANCEMENT) / ROTATION));
  return { k, debut: LANCEMENT + k * ROTATION, fin: LANCEMENT + (k + 1) * ROTATION - 1 };
}

/** Est-ce que le jour (UTC) tombe dans la fête f (qui peut chevaucher deux années) ? Rend son début et sa fin. */
export function dansFete(f, jour) {
  const d = dateDe(jour), an = d.getUTCFullYear();
  for (const a of [an - 1, an]) {
    const debut = Date.UTC(a, f.debut[0] - 1, f.debut[1]) / 86400000;
    const finAn = f.fin[0] < f.debut[0] ? a + 1 : a;
    const fin = Date.UTC(finAn, f.fin[0] - 1, f.fin[1]) / 86400000;
    if (jour >= debut && jour <= fin) return { debut, fin, annee: a };
  }
  return null;
}

/** Les célébrations en cours. */
export const fetesDu = (jour) => FETES.map((f) => ({ ...f, ...dansFete(f, jour) })).filter((f) => f.debut !== undefined && typeof f.debut === 'number');

/** Les personnages qui sont dans le portail permanent ce jour-là. */
export function permanents(jour) {
  const { k } = rotationDu(jour);
  return PERSOS.filter((x) => TIRABLE(x) && !x.fete && (x.sortie === undefined || x.sortie < Math.min(k, NB_SORTIES)));
}

/**
 * Les portails ouverts ce jour-là : [{ id, nom, type ('permanent' | 'garanti' | 'paliers'), vedettes: [id],
 *   nouveaux: [id] (garantis au 5e palier), pool: [id], debut, fin, fete? }].
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
  for (const f of fetesDu(jour)) {
    const siens = PERSOS.filter((x) => x.fete === f.id).map((x) => x.id);
    // Une fête met aussi en avant quelques vedettes déjà sorties (les plus fortes).
    const invites = PERSOS.filter((x) => x.rarete === 'LR' && !x.fete && (x.sortie ?? 99) < Math.min(r.k, NB_SORTIES)).slice(-2).map((x) => x.id);
    out.push({ id: `fete-${f.id}-${f.annee}`, nom: `${f.glyphe} ${f.nom}`, type: 'paliers', vedettes: [...siens, ...invites], nouveaux: siens, pool: [...new Set([...perm, ...siens, ...invites])], debut: f.debut, fin: f.fin, fete: f.id });
  }
  return out;
}
