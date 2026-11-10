/**
 * MAXI MENU — les règles : boosters, recharge, pack du jour, série,
 * recyclage des doublons, albums, boutique.
 *
 * Sans DOM et déterministe : le hasard (`rng`) et l'heure (`maintenant`, en
 * millisecondes) sont toujours passés en paramètre. L'état est un objet simple,
 * sauvegardé tel quel par l'affichage.
 */

import { CARTES, RARETES, ORDRE_RARETES, ENSEIGNES, ORDRE_ENSEIGNES, cartesDe } from './cartes.js';

export const REGLES = {
  stockMax: 10,                 // boosters gratuits en réserve au plus
  recharge: 10 * 60 * 1000,     // un booster gratuit toutes les 10 minutes
  cartesParBooster: 5,
  pitie: 40,                    // une Légendaire (ou mieux) garantie au plus tard au 40e booster
  depart: { frites: 300 },
  serie: 7,                     // série de jours : récompense au 7e jour
  albumComplet: 1000,           // frites d'or offertes pour un album complet
};

export const BOUTIQUE = {
  classique: { nom: 'Booster classique', prix: 120, desc: '5 cartes de toutes les enseignes, une Rare au moins.' },
  enseigne:  { nom: 'Booster d’enseigne', prix: 220, desc: '5 cartes de l’enseigne de votre choix, une Rare au moins.' },
  prestige:  { nom: 'Booster prestige', prix: 1500, desc: '5 cartes, une Légendaire ou mieux garantie.' },
};

const JOUR = 24 * 3600 * 1000;
/** Le numéro du jour (local) d'un instant. */
export const jourDe = (ms, decalage = new Date(ms).getTimezoneOffset()) => Math.floor((ms - decalage * 60000) / JOUR);

export function creerEtat(maintenant) {
  return {
    version: 1,
    frites: REGLES.depart.frites,
    stock: REGLES.stockMax,
    prochaineRecharge: null,          // instant où le prochain booster gratuit arrive (si stock < max)
    collection: {},                   // id → nombre d'exemplaires
    obtenue: {},                      // id → instant de la première obtention
    sansLegendaire: 0,                // boosters ouverts depuis la dernière Légendaire+
    packDuJour: null,                 // numéro du jour où le pack du jour a été ouvert
    serie: { jour: null, compte: 0 }, // série de connexions
    albums: {},                       // enseigne → true quand la récompense est prise
    gros: [],                         // les plus beaux tirages (Épique et mieux), du plus récent au plus ancien
    stats: { boosters: 0, cartes: 0, recyclees: 0 },
    cree: maintenant,
  };
}

/* ------------------------------------------------------------ recharge */

/** Ajoute les boosters gratuits gagnés depuis la dernière visite. */
export function recharger(etat, maintenant) {
  if (etat.stock >= REGLES.stockMax) { etat.prochaineRecharge = null; return 0; }
  if (etat.prochaineRecharge == null) etat.prochaineRecharge = maintenant + REGLES.recharge;
  let gagnes = 0;
  while (etat.stock < REGLES.stockMax && maintenant >= etat.prochaineRecharge) {
    etat.stock++;
    gagnes++;
    etat.prochaineRecharge += REGLES.recharge;
  }
  if (etat.stock >= REGLES.stockMax) etat.prochaineRecharge = null;
  return gagnes;
}

/** Millisecondes avant le prochain booster gratuit (0 si la réserve est pleine). */
export const attenteRecharge = (etat, maintenant) => (etat.prochaineRecharge == null ? 0 : Math.max(0, etat.prochaineRecharge - maintenant));

/* ------------------------------------------------------------ tirage */

function tirerRarete(rng, minimum = 'commune') {
  const rangMin = RARETES[minimum].rang;
  const possibles = ORDRE_RARETES.filter(r => RARETES[r].rang >= rangMin);
  const total = possibles.reduce((s, r) => s + RARETES[r].poids, 0);
  let x = rng() * total;
  for (const r of possibles) { x -= RARETES[r].poids; if (x < 0) return r; }
  return possibles[possibles.length - 1];
}

function tirerCarte(rng, rarete, enseigne = null) {
  const pool = CARTES.filter(c => c.rarete === rarete && (!enseigne || c.enseigne === enseigne));
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Tire les cartes d'un booster. La dernière carte a une rareté minimale ;
 * la pitié garantit une Légendaire au bout de `REGLES.pitie` boosters.
 */
export function tirerBooster(etat, rng, { enseigne = null, minimum = 'rare' } = {}) {
  const n = REGLES.cartesParBooster;
  const raretes = [];
  for (let i = 0; i < n - 1; i++) raretes.push(tirerRarete(rng));
  const pitie = etat.sansLegendaire + 1 >= REGLES.pitie;
  raretes.push(tirerRarete(rng, pitie && RARETES[minimum].rang < 3 ? 'legendaire' : minimum));
  const cartes = raretes.map(r => tirerCarte(rng, r, enseigne));
  if (cartes.some(c => RARETES[c.rarete].rang >= 3)) etat.sansLegendaire = 0;
  else etat.sansLegendaire++;
  return cartes;
}

/** Range les cartes tirées dans la collection ; rend, pour chacune, si elle est nouvelle. */
function ranger(etat, cartes, maintenant) {
  etat.stats.boosters++;
  return cartes.map(c => {
    const nouvelle = !etat.collection[c.id];
    etat.collection[c.id] = (etat.collection[c.id] || 0) + 1;
    if (nouvelle) etat.obtenue[c.id] = maintenant;
    etat.stats.cartes++;
    if (RARETES[c.rarete].rang >= 2) {
      etat.gros.unshift({ id: c.id, quand: maintenant });
      if (etat.gros.length > 30) etat.gros.length = 30;
    }
    return { carte: c, nouvelle };
  });
}

/** Ouvre un booster gratuit (pris dans la réserve). */
export function ouvrirGratuit(etat, rng, maintenant) {
  recharger(etat, maintenant);
  if (etat.stock <= 0) return { ok: false, raison: 'stock' };
  const plein = etat.stock >= REGLES.stockMax;
  etat.stock--;
  if (plein) etat.prochaineRecharge = maintenant + REGLES.recharge;
  return { ok: true, tirage: ranger(etat, tirerBooster(etat, rng), maintenant) };
}

/* ------------------------------------------------------------ pack du jour et série */

/** L'enseigne à l'honneur un jour donné (tourne chaque jour). */
export const enseigneDuJour = jour => ORDRE_ENSEIGNES[((jour % ORDRE_ENSEIGNES.length) + ORDRE_ENSEIGNES.length) % ORDRE_ENSEIGNES.length];

export const packDuJourDispo = (etat, maintenant) => etat.packDuJour !== jourDe(maintenant);

/** Le pack du jour : 5 cartes de l'enseigne du jour, une Épique ou mieux garantie. */
export function ouvrirPackDuJour(etat, rng, maintenant) {
  if (!packDuJourDispo(etat, maintenant)) return { ok: false, raison: 'deja' };
  const jour = jourDe(maintenant);
  etat.packDuJour = jour;
  const enseigne = enseigneDuJour(jour);
  return { ok: true, enseigne, tirage: ranger(etat, tirerBooster(etat, rng, { enseigne, minimum: 'epique' }), maintenant) };
}

/**
 * Note la visite du jour dans la série. Au 7e jour d'affilée, un booster
 * prestige est offert (rendu par `cadeau`), puis la série repart à zéro.
 */
export function noterVisite(etat, maintenant) {
  const jour = jourDe(maintenant);
  const s = etat.serie;
  if (s.jour === jour) return { cadeau: false };
  s.compte = s.jour === jour - 1 ? s.compte + 1 : 1;
  s.jour = jour;
  if (s.compte >= REGLES.serie) {
    s.compte = 0;
    return { cadeau: true };
  }
  return { cadeau: false };
}

/* ------------------------------------------------------------ boutique */

export function acheter(etat, rng, maintenant, sorte, enseigne = null) {
  const offre = BOUTIQUE[sorte];
  if (!offre) return { ok: false, raison: 'offre' };
  if (sorte === 'enseigne' && !ENSEIGNES[enseigne]) return { ok: false, raison: 'enseigne' };
  if (etat.frites < offre.prix) return { ok: false, raison: 'frites' };
  etat.frites -= offre.prix;
  const opts = sorte === 'prestige' ? { minimum: 'legendaire' } : sorte === 'enseigne' ? { enseigne } : {};
  return { ok: true, tirage: ranger(etat, tirerBooster(etat, rng, opts), maintenant) };
}

/** Ouvre le booster prestige offert par la série. */
export function ouvrirCadeauSerie(etat, rng, maintenant) {
  return { ok: true, tirage: ranger(etat, tirerBooster(etat, rng, { minimum: 'legendaire' }), maintenant) };
}

/* ------------------------------------------------------------ doublons */

/** Recycle les doublons d'une carte (on en garde toujours une), ou de toutes. */
export function recycler(etat, id = null) {
  let gain = 0, n = 0;
  for (const [cid, nb] of Object.entries(etat.collection)) {
    if (id && cid !== id) continue;
    if (nb <= 1) continue;
    const carte = CARTES.find(c => c.id === cid);
    gain += (nb - 1) * RARETES[carte.rarete].recyclage;
    n += nb - 1;
    etat.collection[cid] = 1;
  }
  etat.frites += gain;
  etat.stats.recyclees += n;
  return { gain, n };
}

/** Ce que rapporteraient tous les doublons. */
export function valeurDoublons(etat) {
  let gain = 0, n = 0;
  for (const [cid, nb] of Object.entries(etat.collection)) {
    if (nb <= 1) continue;
    const carte = CARTES.find(c => c.id === cid);
    gain += (nb - 1) * RARETES[carte.rarete].recyclage;
    n += nb - 1;
  }
  return { gain, n };
}

/* ------------------------------------------------------------ albums */

export function album(etat, enseigne) {
  const cartes = cartesDe(enseigne);
  const possedees = cartes.filter(c => etat.collection[c.id]).length;
  return { cartes, possedees, total: cartes.length, complet: possedees === cartes.length, recompensePrise: !!etat.albums[enseigne] };
}

/** Prend la récompense d'un album complet (une seule fois). */
export function recompenseAlbum(etat, enseigne) {
  const a = album(etat, enseigne);
  if (!a.complet || a.recompensePrise) return { ok: false };
  etat.albums[enseigne] = true;
  etat.frites += REGLES.albumComplet;
  return { ok: true, gain: REGLES.albumComplet };
}

export function progression(etat) {
  const possedees = CARTES.filter(c => etat.collection[c.id]).length;
  return { possedees, total: CARTES.length };
}
