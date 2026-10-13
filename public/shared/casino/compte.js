/**
 * LE VELOURS NOIR — le compte en banque (fictif) du joueur.
 *
 * Module ISO. Des euros pour de faux, à part des jetons : un salaire le 1er
 * du mois, le loyer le 5, les factures et abonnements à leur date, et chaque
 * jour de 1 à 4 événements de la vie (courses, sorties, ventes, cadeaux,
 * imprévus…), chacun à son rythme : pas deux amendes la même semaine. La carte de la Boutique
 * puise dans ce compte pour acheter des jetons ; on peut aussi encaisser
 * des jetons contre des euros.
 *
 * Les événements d'un jour sont tirés d'un générateur nourri par le RIB et
 * la date : deux appareils qui jouent le même jour du même compte tirent
 * exactement les mêmes. Les montants sont en centimes.
 */

import { makeRng } from '../hasard.js';

export const DEPART = 150000;           // 1 500 €
export const DECOUVERT = -30000;        // -300 €
export const FRAIS_DECOUVERT = 500;     // 5 € par jour dans le rouge
export const RATTRAPAGE = 7;            // jours manqués rattrapés au plus
export const SALAIRE = 140000;
export const LOYER = 65000;
const MAX_OPS = 250;
const JOURS_GRAPHE = 30;

/** Le jour, en heure locale : « 2026-10-13 ». */
export const jour = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const versDate = (j) => { const [a, m, d] = j.split('-').map(Number); return new Date(a, m - 1, d, 12); };
export const lendemain = (j) => { const d = versDate(j); d.setDate(d.getDate() + 1); return jour(d.getTime()); };

/** Les euros, à la française : « 1 234,56 € ». */
export const euros = (c, signe = false) => {
  const s = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(c) / 100);
  return `${c < 0 ? '-' : signe && c > 0 ? '+' : ''}${s} €`;
};

function hacher(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/* Les événements                                                      */
/* ------------------------------------------------------------------ */

const OBJETS_VENTE = ['un vieux vélo', 'une console rétro', 'une collection de BD', 'un grille-pain jamais servi', 'des baskets trop petites', 'une guitare désaccordée', 'un canapé qui gratte'];
const PANNES = ['la machine à laver', 'l’écran du téléphone', 'le pot d’échappement', 'le frigo', 'la box internet'];

const ev = (id, poids, min, max, textes, o = {}) => ({ id, poids, min, max, textes, pause: 0, ...o });
/** Un texte réservé à certains jours de la semaine (0 dimanche … 6 samedi). */
const t = (texte, jsem) => ({ texte, jsem });
const WEEKEND = [0, 6];
const HIVER = [11, 12, 1, 2, 3];

/**
 * Le tirage du jour : poids relatifs, montants en centimes (négatifs =
 * dépense). `pause` : jours minimum avant que le même événement revienne
 * (Infinity : une seule fois) ; `mois` : les mois où il peut arriver ; un
 * texte peut être réservé à certains jours de la semaine. Les factures et
 * les abonnements ne sont pas ici : ils tombent une fois par mois (FIXES).
 */
export const EVENEMENTS = [
  // la vie courante
  ev('courses', 14, -9000, -1500, ['Courses au supermarché', t('Le plein de courses de la semaine', [6]), 'Courses : tu as encore craqué sur les gâteaux'], { pause: 2 }),
  ev('boulangerie', 10, -850, -180, ['Croissants et baguette', 'Pain au chocolat (ou chocolatine)', 'Boulangerie du coin']),
  ev('essence', 6, -7500, -3000, ['Plein d’essence', 'Station-service : le prix a encore augmenté'], { pause: 6 }),
  ev('resto', 6, -6000, -1500, ['Resto avec les potes', t('Pizza du vendredi soir', [5]), 'Sushis livrés à domicile', t('Brunch du dimanche', [0])], { pause: 3 }),
  ev('kebab', 5, -1200, -700, [t('Kebab de minuit', [5, 6]), t('Tacos XXL après la soirée', [0, 6])], { pause: 4 }),
  ev('transport', 5, -4500, -200, ['Ticket de métro', t('Taxi : tu as raté le dernier bus', [5, 6])], { pause: 2 }),
  ev('pharmacie', 4, -3000, -500, ['Pharmacie : sirop et mouchoirs', 'Pharmacie : crème solaire et pansements'], { pause: 10 }),
  ev('vetements', 4, -9000, -2000, ['Nouveaux vêtements', 'Une paire de chaussures'], { pause: 12 }),
  ev('cinema', 4, -2500, -1000, ['Place de cinéma et pop-corn', t('Soirée bowling', [5, 6])], { pause: 6 }),
  ev('cadeau-ami', 3, -6000, -2000, ['Cadeau d’anniversaire pour un ami', 'Cagnotte pour le pot de départ d’un collègue'], { pause: 10 }),
  ev('amende', 2, -13500, -3500, ['Amende de stationnement', 'Flashé à 54 km/h en ville', 'Amende : ticket de métro oublié'], { pause: 25 }),
  ev('chat', 1.5, -1990, -1990, ['Ton chat a mangé le câble du chargeur'], { pause: 90 }),
  ev('reparation', 2, -30000, -6000, [], { pause: 40, texte: (r) => `Réparation imprévue : ${PANNES[Math.floor(r() * PANNES.length)]}` }),
  // les rentrées
  ev('remboursement', 5, 1500, 6000, ['Remboursement de la Sécu', 'Remboursement de la mutuelle'], { pause: 12 }),
  ev('vente', 6, 1000, 12000, [], { pause: 5, texte: (r) => `Vente d’occasion : ${OBJETS_VENTE[Math.floor(r() * OBJETS_VENTE.length)]}` }),
  ev('pourboire', 4, 1000, 4000, [t('Pourboires de la semaine', [5, 6]), 'Un client généreux'], { pause: 6 }),
  ev('cashback', 3, 200, 800, ['Cashback de la carte', 'Remise fidélité du supermarché'], { pause: 28 }),
  ev('mamie', 3, 2000, 5000, ['Mamie t’a glissé un petit billet', 'Tonton te rembourse enfin les 20 € de l’an dernier'], { pause: 30 }),
  ev('freelance', 6, 4000, 15000, [t('Petit boulot du week-end', WEEKEND), t('Mission de baby-sitting', [5, 6]), 'Tu as aidé un voisin à déménager'], { pause: 4 }),
  ev('trouve', 2, 500, 2000, ['Billet trouvé dans une vieille veste', 'Pièces retrouvées sous le canapé'], { pause: 45 }),
  ev('prime', 2, 5000, 25000, ['Prime exceptionnelle du patron', 'Prime de fin de projet'], { pause: 60 }),
  ev('jeu', 1, 2000, 10000, ['Ticket à gratter gagnant !', 'Pari gagné avec ton cousin'], { pause: 20 }),
  // les grands moments (rares)
  ev('loto', 0.15, 10000, 80000, ['Gain au loto du quartier !'], { rare: true, pause: 180 }),
  ev('heritage', 0.08, 100000, 300000, ['Héritage d’un grand-oncle dont tu ignorais l’existence'], { rare: true, pause: Infinity }),
  ev('impots', 2, 10000, 50000, ['Remboursement des impôts : l’État te doit de l’argent !'], { rare: true, pause: 300, mois: [8, 9] }),
  ev('augmentation', 0.3, 0, 0, ['Augmentation ! Ton salaire passe à {s} par mois'], { rare: true, augmentation: true, pause: 180 }),
  ev('velo', 0.4, -40000, -15000, ['Vol de vélo : il faut en racheter un'], { rare: true, pause: 240 }),
  ev('chaudiere', 0.5, -80000, -30000, ['Panne de chaudière en plein hiver'], { rare: true, pause: 365, mois: HIVER }),
  ev('dentiste', 0.6, -25000, -8000, ['Dentiste : une carie mal placée'], { rare: true, pause: 120 }),
];

/**
 * Les prélèvements du mois : un jour fixe, un montant propre à chaque compte
 * (tiré une fois pour toutes d'après le RIB). Tout le monde n'a pas tous les
 * abonnements.
 */
const FIXES = [
  { k: 'assurance', jour: 8, l: 'Assurance habitation', min: 1490, max: 2990 },
  { k: 'electricite', jour: 10, l: 'Facture d’électricité et de gaz', min: 4500, max: 7500, hiver: 1.6 },
  { k: 'internet', jour: 12, l: 'Box internet', min: 2499, max: 3999 },
  { k: 'streaming', jour: 15, l: 'Abonnement streaming', min: 1349, max: 1349, chance: 0.75 },
  { k: 'musique', jour: 18, l: 'Abonnement musique', min: 1099, max: 1099, chance: 0.6 },
  { k: 'sport', jour: 20, l: 'Salle de sport (tu y es allé deux fois)', min: 2499, max: 3499, chance: 0.45 },
  { k: 'mobile', jour: 22, l: 'Forfait téléphone', min: 999, max: 1999 },
];

/** Les prélèvements de ce compte : lesquels, et combien. */
export function prelevements(c) {
  const r = makeRng(hacher(`${c.rib}|fixes`));
  return FIXES.map((f) => {
    const a = r(), b = r();
    return { ...f, actif: !f.chance || a < f.chance, montant: Math.round((f.min + b * (f.max - f.min)) / 10) * 10 };
  }).filter((f) => f.actif);
}

const ecart = (a, b) => Math.round((versDate(b) - versDate(a)) / 86400000);

/* ------------------------------------------------------------------ */
/* Le compte                                                           */
/* ------------------------------------------------------------------ */

function nouveauRib(rng = Math.random) {
  let n = '';
  for (let k = 0; k < 19; k++) n += Math.floor(rng() * 10);
  return `FR76 1926 0${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7, 11)} ${n.slice(11, 15)} ${n.slice(15, 18)}`;
}

const ent = (v, def = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : def);

/** Un compte bien formé, quoi qu'on lui donne. */
export function propre(d) {
  const x = d && typeof d === 'object' ? d : {};
  const ops = Array.isArray(x.ops) ? x.ops.filter((o) => o && typeof o.l === 'string' && typeof o.d === 'string').map((o) => ({ d: o.d, l: o.l.slice(0, 120), m: ent(o.m), k: typeof o.k === 'string' ? o.k : '', r: !!o.r })) : [];
  return {
    solde: x.solde === undefined ? DEPART : ent(x.solde, DEPART),
    rib: typeof x.rib === 'string' && x.rib ? x.rib : nouveauRib(),
    salaire: ent(x.salaire, SALAIRE) || SALAIRE,
    loyer: ent(x.loyer, LOYER) || LOYER,
    anniv: typeof x.anniv === 'string' && /^\d\d-\d\d$/.test(x.anniv) ? x.anniv : '',
    dernier: typeof x.dernier === 'string' ? x.dernier : '',
    derniers: Object.fromEntries(Object.entries(x.derniers && typeof x.derniers === 'object' ? x.derniers : {}).filter(([, v]) => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v))),
    ops: ops.slice(-MAX_OPS),
    courbe: Array.isArray(x.courbe) ? x.courbe.filter((p) => p && typeof p.d === 'string').map((p) => ({ d: p.d, s: ent(p.s) })).slice(-JOURS_GRAPHE) : [],
    maj: ent(x.maj),
  };
}

function operation(c, d, l, m, k = '', rare = false) {
  c.solde += m;
  const o = { d, l, m, k, r: rare };
  c.ops.push(o);
  if (c.ops.length > MAX_OPS) c.ops.splice(0, c.ops.length - MAX_OPS);
  return o;
}

/** Les événements d'un jour (ajoutés au compte), dans l'ordre. */
export function jouerJour(c, j) {
  const rng = makeRng(hacher(`${c.rib}|${j}`));
  const out = [];
  const [, mois, jj] = j.split('-');
  const m = Number(mois), d = Number(jj), jsem = versDate(j).getDay();
  const noter = (o) => { out.push(o); c.derniers[o.k] = j; };
  if (c.solde < 0) out.push(operation(c, j, 'Frais de découvert', -FRAIS_DECOUVERT, 'frais'));
  if (d === 1) out.push(operation(c, j, 'Salaire du mois', c.salaire, 'salaire'));
  if (d === 5) out.push(operation(c, j, 'Loyer', -c.loyer, 'loyer'));
  for (const f of prelevements(c)) {
    if (f.jour !== d) continue;
    const montant = f.hiver && HIVER.includes(m) ? Math.round(f.montant * f.hiver / 10) * 10 : f.montant;
    out.push(operation(c, j, f.l, -montant, f.k));
  }
  if (c.anniv && c.anniv === `${mois}-${jj}`) noter(operation(c, j, 'Joyeux anniversaire ! Les cadeaux de la famille', 5000 + Math.round(rng() * 150) * 100, 'anniv', true));

  // de 1 à 4 événements de la vie, jamais deux fois le même le même jour, chacun à son rythme
  const n = 1 + Math.floor(rng() * 4);
  const pris = new Set();
  for (let k = 0; k < n; k++) {
    const possibles = EVENEMENTS.map((e) => ({ e, textes: e.texte ? null : e.textes.filter((x) => typeof x === 'string' || x.jsem.includes(jsem)) }))
      .filter(({ e, textes }) => !pris.has(e.id)
        && (!e.mois || e.mois.includes(m))
        && (!c.derniers[e.id] || ecart(c.derniers[e.id], j) >= e.pause)
        && (!textes || textes.length));
    if (!possibles.length) break;
    const total = possibles.reduce((s, p) => s + p.e.poids, 0);
    let x = rng() * total;
    let choix = possibles[0];
    for (const p of possibles) { x -= p.e.poids; if (x <= 0) { choix = p; break; } }
    const { e, textes } = choix;
    pris.add(e.id);
    let montant = Math.round(e.min + rng() * (e.max - e.min));
    if (Math.abs(montant) >= 1000) montant = Math.round(montant / 10) * 10;
    const brut = e.texte ? e.texte(rng) : textes[Math.floor(rng() * textes.length)];
    let texte = typeof brut === 'string' ? brut : brut.texte;
    if (e.augmentation) {
      c.salaire += 5000 + Math.round(rng() * 15) * 1000;
      texte = texte.replace('{s}', euros(c.salaire));
      montant = 0;
    }
    noter(operation(c, j, texte, montant, e.id, !!e.rare));
  }
  c.courbe.push({ d: j, s: c.solde });
  if (c.courbe.length > JOURS_GRAPHE) c.courbe.splice(0, c.courbe.length - JOURS_GRAPHE);
  c.dernier = j;
  return out;
}

/**
 * Joue les jours qui n'ont pas encore été joués, jusqu'à aujourd'hui
 * (au plus RATTRAPAGE jours en arrière). Un compte neuf commence aujourd'hui.
 * @returns {{ jour: string, ops: object[] }[]}
 */
export function rattraper(c, aujourdhui = jour()) {
  const jours = [];
  if (c.dernier >= aujourdhui) return jours;
  let j;
  if (!c.dernier) j = aujourdhui;
  else {
    j = lendemain(c.dernier);
    const limite = versDate(aujourdhui);
    limite.setDate(limite.getDate() - (RATTRAPAGE - 1));
    const min = jour(limite.getTime());
    if (j < min) j = min;
  }
  for (; j <= aujourdhui; j = lendemain(j)) jours.push({ jour: j, ops: jouerJour(c, j) });
  return jours;
}

/** Peut-on payer ce montant sans passer sous le découvert autorisé ? */
export const peutPayer = (c, cents) => c.solde - cents >= DECOUVERT;

/** Un paiement par carte ; faux si le découvert serait dépassé. */
export function payer(c, cents, libelle, j = jour()) {
  if (!(cents > 0) || !peutPayer(c, cents)) return false;
  operation(c, j, libelle, -cents, 'carte');
  majCourbe(c, j);
  return true;
}

/** Des euros qui arrivent (jetons encaissés). */
export function encaisser(c, cents, libelle, j = jour()) {
  if (!(cents > 0)) return false;
  operation(c, j, libelle, cents, 'casino');
  majCourbe(c, j);
  return true;
}

function majCourbe(c, j) {
  const p = c.courbe.at(-1);
  if (p?.d === j) p.s = c.solde; else { c.courbe.push({ d: j, s: c.solde }); if (c.courbe.length > JOURS_GRAPHE) c.courbe.shift(); }
}

/**
 * Deux appareils se mettent d'accord : le plus récent l'emporte. Mais si ce
 * sont deux comptes différents (un appareil neuf a ouvert le sien avant de
 * retrouver la sauvegarde), on garde le plus ancien : le vrai.
 */
export function fusionner(a, b) {
  a = propre(a); b = propre(b);
  const debut = (x) => x.ops[0]?.d || x.dernier || '9999';
  const recent = a.rib !== b.rib ? (debut(a) <= debut(b) ? a : b) : a.maj >= b.maj ? a : b;
  return { ...recent, anniv: recent.anniv || (recent === a ? b : a).anniv };
}
