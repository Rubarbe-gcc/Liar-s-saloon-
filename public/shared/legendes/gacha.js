/**
 * LÉGENDES — le gacha : les invocations, la garantie, la « pitié », les paliers, les doublons (éveils),
 * les jetons (gagnés en jouant, jamais achetés).
 *
 * L'état du joueur tient dans un objet simple (gardé sur l'appareil) : ses jetons, sa collection, ses
 * compteurs par portail, son hasard (une graine qui avance à chaque tirage : rien ne se « relance » en
 * rechargeant la page).
 *
 * Les taux : SSR 5 %, SR 25 %, R le reste (on ne tire jamais un UR ni un LR : on tire la forme la plus basse
 * d'une lignée, puis on l'éveille). Sur un portail à vedettes, 30 % des SSR tirés sont des vedettes. Un multi (10) garantit au moins un SSR. Au bout de PITIE tirages sans vedette, la
 * suivante est garantie.
 */

import { PERSO, RARETES } from './persos.js';

/** Les taux (un LR ne se tire jamais : on tire sa forme SSR, et on l'éveille). */
export const TAUX = { LR: 0, SSR: 0.05, SR: 0.25 };
/** La part des vedettes parmi les SSR tirés sur leur portail. */
export const PART_VEDETTE = 0.3;
/** Le portail « garanti » : la vedette garantie à la multi-invocation n° GARANTIE_TOUS, puis toutes les GARANTIE_TOUS. */
export const GARANTIE_TOUS = 3;
export const PRIX = { simple: 5, multi: 50 };
/** Les paliers : le prix de chaque multi, et ce qu'il garantit. */
export const PALIERS = [
  { prix: 25, texte: 'Prix réduit' },
  { prix: 40, texte: 'Un SSR garanti' },
  { prix: 50, texte: 'Deux SSR garantis', ssr: 2 },
  { prix: 50, texte: 'Un SSR garanti' },
  { prix: 50, texte: 'Le nouveau personnage garanti !', nouveau: true },
];
export const PITIE = 150;
/** Ce que rend un doublon quand le personnage est déjà éveillé au maximum. */
const RENDU = { R: 1, SR: 2, SSR: 5, LR: 10 };

export function nouvelEtat(graine = 1) {
  return { jetons: 300, collection: {}, pitie: {}, paliers: {}, alea: (graine >>> 0) || 1, dernierJour: -1, serie: 0, cadeaux: {}, tirages: 0, medailles: {}, boite: [] };
}

function hasard(etat) {
  let t = (etat.alea = (etat.alea + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const choisir = (etat, liste) => liste[Math.floor(hasard(etat) * liste.length)];

function rarete(etat, min = 'R') {
  const r = hasard(etat);
  let x = r < TAUX.LR ? 'LR' : r < TAUX.LR + TAUX.SSR ? 'SSR' : r < TAUX.LR + TAUX.SSR + TAUX.SR ? 'SR' : 'R';
  const ordre = ['R', 'SR', 'SSR', 'LR'];
  // Un minimum (la garantie) : on retire la rareté au-dessus du minimum, dans les mêmes proportions.
  if (ordre.indexOf(x) < ordre.indexOf(min)) x = min === 'SSR' ? (hasard(etat) < TAUX.LR / (TAUX.LR + TAUX.SSR) ? 'LR' : 'SSR') : min;
  return x;
}

/** Un personnage d'une rareté dans le portail (ou, faute de mieux, d'une rareté voisine). */
function piocher(etat, portail, rar) {
  const ordre = ['R', 'SR', 'SSR', 'LR'];
  for (let k = ordre.indexOf(rar); k >= 0; k--) {
    const l = portail.pool.filter((id) => PERSO[id].rarete === ordre[k] && !portail.vedettes.includes(id));
    if (l.length) return choisir(etat, l);
  }
  return choisir(etat, portail.pool);
}

/** Un tirage (sans le payer). force : 'vedette' | 'nouveau' | 'SSR' */
function unTirage(etat, portail, force = null) {
  let id;
  const cle = portail.id;
  const pitie = (etat.pitie[cle] || 0) + 1;
  if (force === 'nouveau' && portail.nouveaux.length) id = choisir(etat, portail.nouveaux);
  else if ((force === 'vedette' || (portail.vedettes.length && pitie >= PITIE)) && portail.vedettes.length) id = choisir(etat, portail.vedettes);
  else {
    const rar = rarete(etat, force === 'SSR' ? 'SSR' : 'R');
    if ((rar === 'SSR' || rar === 'LR') && portail.vedettes.length && hasard(etat) < PART_VEDETTE) id = choisir(etat, portail.vedettes);
    else id = piocher(etat, portail, rar);
  }
  const vedette = portail.vedettes.includes(id);
  etat.pitie[cle] = vedette ? 0 : pitie;
  return id;
}

/** Ajoute un personnage à la collection : nouveau, ou un éveil de plus, ou des jetons rendus. */
function recevoir(etat, id) {
  const x = PERSO[id], c = etat.collection[id];
  if (!c) { etat.collection[id] = { eveil: 0, n: 1 }; return { id, nouveau: true, eveil: 0 }; }
  c.n += 1;
  if (c.eveil < RARETES[x.rarete].eveilMax) { c.eveil += 1; return { id, nouveau: false, eveil: c.eveil }; }
  etat.jetons += RENDU[x.rarete];
  return { id, nouveau: false, eveil: c.eveil, rendu: RENDU[x.rarete] };
}

/** Le prochain palier d'un portail à paliers (0 à 4 ; après le dernier, on reste au dernier, sans sa garantie). */
export const palierDe = (etat, portail) => Math.min(etat.paliers[portail.id] || 0, PALIERS.length);
/** Le prix du prochain multi sur ce portail. */
export function prixMulti(etat, portail) {
  if (portail.type !== 'paliers') return PRIX.multi;
  const k = palierDe(etat, portail);
  return k < PALIERS.length ? PALIERS[k].prix : PRIX.multi;
}

/**
 * Invoque sur un portail : n = 1 (simple) ou 10 (multi). Rend { ok, resultats: [{ id, rarete, nouveau,
 * vedette, eveil, rendu }], garanties: [texte], prix } ; ok = false si pas assez de jetons.
 */
export function invoquer(etat, portail, n = 10) {
  const multi = n >= 10;
  const prix = multi ? prixMulti(etat, portail) : PRIX.simple;
  if (etat.jetons < prix) return { ok: false, prix, resultats: [], garanties: [] };
  // Un portail limité : pas plus de portail.max invocations.
  etat.invocs ||= {};
  if (portail.max && (etat.invocs[portail.id] || 0) + (multi ? 10 : 1) > portail.max) return { ok: false, limite: true, prix, resultats: [], garanties: [] };
  etat.invocs[portail.id] = (etat.invocs[portail.id] || 0) + (multi ? 10 : 1);
  etat.jetons -= prix;
  const garanties = [];
  const ids = [];
  for (let k = 0; k < (multi ? 10 : 1); k++) ids.push(unTirage(etat, portail));
  if (multi) {
    const haut = (id) => ['SSR', 'LR'].includes(PERSO[id].rarete);
    // Au moins un SSR (ou plus, selon le palier).
    const palier = portail.type === 'paliers' ? PALIERS[palierDe(etat, portail)] : null;
    const voulus = palier?.ssr || 1;
    let k = 9;
    while (ids.filter(haut).length < voulus && k >= 0) { if (!haut(ids[k])) ids[k] = unTirage(etat, portail, 'SSR'); k -= 1; }
    garanties.push(voulus > 1 ? `${voulus} SSR garantis` : 'Un SSR garanti');
    // Le portail « garanti » : après deux multi-invocations, la troisième garantit une vedette (et ainsi de suite).
    if (portail.type === 'garanti' && portail.vedettes.length) {
      etat.multis ||= {};
      etat.multis[portail.id] = (etat.multis[portail.id] || 0) + 1;
      if (etat.multis[portail.id] % GARANTIE_TOUS === 0) {
        if (!ids.some((id) => portail.vedettes.includes(id))) ids[9] = unTirage(etat, portail, 'vedette');
        garanties.push('Une vedette garantie (3e multi-invocation)');
      }
    }
    // Le 5e palier : le nouveau personnage.
    if (palier?.nouveau && portail.nouveaux.length) {
      if (!ids.some((id) => portail.nouveaux.includes(id))) ids[9] = unTirage(etat, portail, 'nouveau');
      garanties.push('Le nouveau personnage garanti');
    }
    if (portail.type === 'paliers') etat.paliers[portail.id] = palierDe(etat, portail) + 1;
  }
  etat.tirages += ids.length;
  const resultats = ids.map((id) => ({ ...recevoir(etat, id), rarete: PERSO[id].rarete, vedette: portail.vedettes.includes(id) }));
  return { ok: true, prix, resultats, garanties };
}

/** La connexion du jour : 20 jetons, plus 5 par jour d'affilée (jusqu'à 50). Rend les jetons gagnés (0 si déjà fait). boite : dans la boîte à cadeaux (à récupérer) plutôt que tout de suite. */
export function connexion(etat, jour, { boite = false } = {}) {
  if (etat.dernierJour === jour) return 0;
  etat.serie = etat.dernierJour === jour - 1 ? etat.serie + 1 : 1;
  etat.dernierJour = jour;
  const gain = Math.min(50, 15 + 5 * etat.serie);
  if (boite) (etat.boite ||= []).push({ texte: `Connexion du jour (${etat.serie} jour${etat.serie > 1 ? 's' : ''} d’affilée)`, jetons: gain });
  else etat.jetons += gain;
  return gain;
}

/** Le cadeau d'une fête (une fois par année de fête). */
export function cadeauFete(etat, fete, { boite = false } = {}) {
  const cle = `${fete.id}-${fete.annee}${fete.partie ? `-${fete.partie}` : ''}`;
  if (etat.cadeaux[cle]) return 0;
  etat.cadeaux[cle] = true;
  if (boite) (etat.boite ||= []).push({ texte: `${fete.glyphe} ${fete.nom}${fete.partie ? ` · ${fete.partieNom}` : ''}`, jetons: fete.cadeau, medailles: { legende: 3 } });
  else etat.jetons += fete.cadeau;
  return fete.cadeau;
}

/** Récupère tout ce qu'il y a dans la boîte à cadeaux. Rend { jetons, medailles }. */
export function recupererCadeaux(etat) {
  const tot = { jetons: 0, medailles: {} };
  for (const c of etat.boite || []) {
    tot.jetons += c.jetons || 0;
    for (const [k, n] of Object.entries(c.medailles || {})) tot.medailles[k] = (tot.medailles[k] || 0) + n;
  }
  etat.jetons += tot.jetons;
  etat.medailles ||= {};
  for (const [k, n] of Object.entries(tot.medailles)) etat.medailles[k] = (etat.medailles[k] || 0) + n;
  etat.boite = [];
  return tot;
}
