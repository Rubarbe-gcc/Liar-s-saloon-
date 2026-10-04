/**
 * SKULL KING — le moteur.
 *
 * Un jeu de plis à paris : à la manche n, chacun reçoit n cartes et annonce
 * combien de plis il va remporter. Pile le bon nombre rapporte gros ; à côté,
 * on perd des points.
 *
 * Tout ici est pur et sérialisable : l'état d'une partie (`G`) est un objet
 * JSON, qu'on peut ranger dans le navigateur et reprendre plus tard. Le hasard
 * passe par un `rng` explicite, pour que les tests rejouent les mêmes parties.
 *
 * Module ISO : ni DOM ni Node.
 */

import { melanger } from '../hasard.js';

/* ================================================================== */
/* Les cartes                                                         */
/* ================================================================== */

/** Les quatre couleurs. Le Pavillon noir est l'atout. */
export const COULEURS = {
  Y: { nom: 'Coffre', glyphe: '🪙', teinte: '#e8b730' },
  G: { nom: 'Perroquet', glyphe: '🦜', teinte: '#2fa35a' },
  P: { nom: 'Carte au trésor', glyphe: '🗺', teinte: '#8a4fc2' },
  B: { nom: 'Pavillon noir', glyphe: '🏴‍☠️', teinte: '#26232b', atout: true },
};

export const SPECIALES = {
  pir: { nom: 'Pirate', glyphe: '🏴‍☠️' },
  esc: { nom: 'Fuite', glyphe: '🏳️' },
  sir: { nom: 'Sirène', glyphe: '🧜‍♀️' },
  sk: { nom: 'Skull King', glyphe: '💀' },
  tig: { nom: 'Tigresse', glyphe: '🐯' },
  kra: { nom: 'Kraken', glyphe: '🐙' },
  wha: { nom: 'Baleine blanche', glyphe: '🐋' },
};

/** Les cinq pirates ont chacun leur nom (et leur portrait). */
export const PIRATES = ['Barbe-Grise', 'Rosa la Rouge', 'Jack Tortue', 'Bahia la Borgne', 'Harald le Grand'];
export const SIRENES = ['Ondine', 'Coralie'];

/** Les 72 cartes du jeu. */
export function paquet() {
  const d = [];
  for (const s of Object.keys(COULEURS)) for (let n = 1; n <= 14; n++) d.push({ id: `${s}${n}`, t: 'n', s, n });
  for (let i = 1; i <= 5; i++) {
    d.push({ id: `pir${i}`, t: 'pir', nom: PIRATES[i - 1] });
    d.push({ id: `esc${i}`, t: 'esc' });
  }
  d.push({ id: 'sir1', t: 'sir', nom: SIRENES[0] }, { id: 'sir2', t: 'sir', nom: SIRENES[1] });
  d.push({ id: 'sk', t: 'sk' }, { id: 'tig', t: 'tig' }, { id: 'kra', t: 'kra' }, { id: 'wha', t: 'wha' });
  return d;
}

export const nomCarte = (c, as = null) => {
  if (c.t === 'n') return `${c.n} ${COULEURS[c.s].nom}`;
  if (c.t === 'tig') return as ? `Tigresse (${as === 'pir' ? 'pirate' : 'fuite'})` : 'Tigresse';
  return c.nom || SPECIALES[c.t].nom;
};

/* ================================================================== */
/* Les règles du pli                                                  */
/* ================================================================== */

/** Ce que vaut une carte jouée : la Tigresse est ce que son joueur a choisi. */
export const effet = (j) => (j.c.t === 'tig' ? j.as : j.c.t);

/**
 * La couleur qu'il faut suivre. C'est la première carte numérotée du pli —
 * sauf si un personnage (pirate, sirène, Skull King) a ouvert avant : alors
 * plus personne n'a de couleur à suivre. Les fuites, le Kraken et la Baleine
 * ne fixent rien.
 */
export function couleurDemandee(pli) {
  for (const j of pli) {
    const e = effet(j);
    if (e === 'n') return j.c.s;
    if (e === 'esc' || e === 'kra' || e === 'wha') continue;
    return null;
  }
  return null;
}

/** Les cartes qu'on a le droit de jouer. Les cartes spéciales passent toujours. */
export function legales(main, pli) {
  const cd = couleurDemandee(pli);
  if (!cd || !main.some((c) => c.t === 'n' && c.s === cd)) return main.slice();
  return main.filter((c) => c.t !== 'n' || c.s === cd);
}

/** L'index de la carte qui l'emporte, hors Kraken et Baleine. */
function meilleure(pli) {
  const E = pli.map(effet);
  const premier = (t) => E.indexOf(t);
  // La sirène est la seule à séduire le Skull King.
  if (premier('sk') >= 0 && premier('sir') >= 0) return premier('sir');
  for (const t of ['sk', 'pir', 'sir']) if (premier(t) >= 0) return premier(t);
  const nums = pli.map((j, i) => i).filter((i) => E[i] === 'n');
  if (!nums.length) return pli.length ? 0 : -1; // que des fuites : la première l'emporte
  const atouts = nums.filter((i) => pli[i].c.s === 'B');
  const couleur = pli[nums[0]].c.s;
  const pool = atouts.length ? atouts : nums.filter((i) => pli[i].c.s === couleur);
  return pool.reduce((a, i) => (pli[i].c.n > pli[a].c.n ? i : a));
}

/** Les 14 rapportent à celui qui les ramasse : 10, ou 20 pour le noir. */
function bonusQuatorze(pli) {
  const d = [];
  for (const j of pli) {
    if (j.c.t === 'n' && j.c.n === 14) d.push({ pts: j.c.s === 'B' ? 20 : 10, txt: `14 ${COULEURS[j.c.s].nom}` });
  }
  return d;
}

/**
 * Qui remporte le pli, et ce qu'il gagne en bonus.
 * Renvoie { gagnant (joueur ou null), meneur (qui ouvre le pli suivant),
 *           carte (index de la carte gagnante, ou -1), bonus, details, effet }.
 */
export function resoudre(pli) {
  const ki = pli.findIndex((j) => j.c.t === 'kra');
  const wi = pli.findIndex((j) => j.c.t === 'wha');
  // Le Kraken et la Baleine dans le même pli : le dernier joué l'emporte.
  const monstre = ki >= 0 && wi >= 0 ? (ki > wi ? 'kra' : 'wha') : ki >= 0 ? 'kra' : wi >= 0 ? 'wha' : null;

  if (monstre === 'kra') {
    // Le pli est englouti ; celui qui l'aurait gagné ouvre le suivant.
    const reste = pli.filter((j) => j.c.t !== 'kra' && j.c.t !== 'wha');
    const m = meilleure(reste);
    return { gagnant: null, meneur: m >= 0 ? reste[m].p : pli[ki].p, carte: -1, bonus: 0, details: [], effet: 'kraken' };
  }
  if (monstre === 'wha') {
    // Les personnages perdent leurs pouvoirs : le plus gros chiffre gagne, couleur ou pas.
    let best = -1;
    pli.forEach((j, i) => { if (j.c.t === 'n' && (best < 0 || j.c.n > pli[best].c.n)) best = i; });
    if (best < 0) return { gagnant: null, meneur: pli[wi].p, carte: -1, bonus: 0, details: [], effet: 'baleine' };
    const details = bonusQuatorze(pli);
    return { gagnant: pli[best].p, meneur: pli[best].p, carte: best, bonus: details.reduce((s, d) => s + d.pts, 0), details, effet: 'baleine' };
  }

  const w = meilleure(pli);
  const E = pli.map(effet);
  const compte = (t) => E.filter((x) => x === t).length;
  const details = bonusQuatorze(pli);
  if (E[w] === 'sk' && compte('pir')) details.push({ pts: 30 * compte('pir'), txt: `Skull King prend ${compte('pir')} pirate${compte('pir') > 1 ? 's' : ''}` });
  if (E[w] === 'pir' && compte('sir')) details.push({ pts: 20 * compte('sir'), txt: `Pirate prend ${compte('sir')} sirène${compte('sir') > 1 ? 's' : ''}` });
  if (E[w] === 'sir' && compte('sk')) details.push({ pts: 40, txt: 'Sirène capture le Skull King' });
  return { gagnant: pli[w].p, meneur: pli[w].p, carte: w, bonus: details.reduce((s, d) => s + d.pts, 0), details, effet: null };
}

/* ================================================================== */
/* Les points                                                         */
/* ================================================================== */

/**
 * Les points d'une manche.
 *   pari 0 réussi : +10 × manche ; raté : −10 × manche ;
 *   pari réussi   : +20 par pli annoncé ; raté : −10 par pli d'écart.
 * Les bonus ne comptent que si le pari est réussi (règle officielle), sauf
 * avec `bonusToujours`.
 */
export function points(manche, pari, plis, bonus = 0, { bonusToujours = false } = {}) {
  const reussi = pari === plis;
  const base = pari === 0 ? (reussi ? 10 * manche : -10 * manche) : (reussi ? 20 * pari : -10 * Math.abs(pari - plis));
  return base + (reussi || bonusToujours ? bonus : 0);
}

/* ================================================================== */
/* La partie                                                          */
/* ================================================================== */

export const MANCHES = 10;
export const MAX_JOUEURS = 7; // 7 × 10 cartes = 70 : le paquet en a 72

/** Une nouvelle partie. `bots[i]` dit si le joueur i est tenu par l'ordinateur. */
export function creerPartie({ noms, bots, manches = MANCHES }) {
  const n = noms.length;
  if (n < 2 || n > MAX_JOUEURS) throw new Error('de 2 à 7 joueurs');
  return {
    n, noms: noms.slice(), bots: bots ? bots.slice() : noms.map((_, i) => i > 0),
    manches, manche: 0, donneur: n - 1, meneur: 0, tour: 0,
    mains: [], paris: [], plis: [], bonus: [], pli: [], dernier: null,
    scores: Array(n).fill(0), historique: [], phase: 'pari',
  };
}

/** Distribue la manche suivante (ou termine la partie). */
export function nouvelleManche(G, rng) {
  G.manche++;
  if (G.manche > G.manches) { G.phase = 'fin'; return G; }
  const d = melanger(paquet(), rng);
  G.mains = [];
  for (let p = 0; p < G.n; p++) G.mains.push(d.splice(0, G.manche));
  G.donneur = (G.donneur + 1) % G.n;
  G.meneur = G.tour = (G.donneur + 1) % G.n;
  G.paris = Array(G.n).fill(null);
  G.plis = Array(G.n).fill(0);
  G.bonus = Array(G.n).fill(0);
  G.pli = [];
  G.dernier = null;
  G.phase = 'pari';
  return G;
}

/** Un joueur annonce son pari. Quand tout le monde a parié, on joue. */
export function parier(G, p, v) {
  if (G.phase !== 'pari') return { ok: false, raison: 'ce n’est pas le moment de parier' };
  if (!Number.isInteger(v) || v < 0 || v > G.manche) return { ok: false, raison: 'pari impossible' };
  G.paris[p] = v;
  if (G.paris.every((x) => x !== null)) G.phase = 'jeu';
  return { ok: true };
}

/** Un joueur pose une carte. La Tigresse demande `as` : 'pir' ou 'esc'. */
export function jouer(G, p, id, as = null) {
  if (G.phase !== 'jeu') return { ok: false, raison: 'ce n’est pas le moment de jouer' };
  if (G.tour !== p) return { ok: false, raison: 'pas votre tour' };
  const c = G.mains[p].find((x) => x.id === id);
  if (!c) return { ok: false, raison: 'carte absente' };
  if (!legales(G.mains[p], G.pli).includes(c)) return { ok: false, raison: 'il faut suivre la couleur demandée' };
  if (c.t === 'tig' && as !== 'pir' && as !== 'esc') return { ok: false, raison: 'la Tigresse : pirate ou fuite ?' };
  G.mains[p] = G.mains[p].filter((x) => x !== c);
  G.pli.push({ p, c, as: c.t === 'tig' ? as : null });
  if (G.pli.length === G.n) G.phase = 'pli';
  else G.tour = (G.tour + 1) % G.n;
  return { ok: true, complet: G.phase === 'pli' };
}

/** Ramasse le pli complet. En fin de manche, compte les points. */
export function ramasser(G) {
  if (G.phase !== 'pli') return null;
  const r = resoudre(G.pli);
  if (r.gagnant !== null) { G.plis[r.gagnant]++; G.bonus[r.gagnant] += r.bonus; }
  G.dernier = { pli: G.pli, ...r };
  G.pli = [];
  G.meneur = G.tour = r.meneur;
  if (G.mains.every((m) => m.length === 0)) {
    const bilan = [];
    for (let p = 0; p < G.n; p++) {
      const pts = points(G.manche, G.paris[p], G.plis[p], G.bonus[p]);
      G.scores[p] += pts;
      bilan.push({ pari: G.paris[p], plis: G.plis[p], bonus: G.bonus[p], points: pts, total: G.scores[p] });
    }
    G.historique.push(bilan);
    G.phase = 'bilan';
  } else G.phase = 'jeu';
  return r;
}

/** Le classement : [{ p, nom, score, rang }], ex aequo au même rang. */
export function classement(G) {
  const l = G.noms.map((nom, p) => ({ p, nom, score: G.scores[p] })).sort((a, b) => b.score - a.score);
  l.forEach((x, i) => { x.rang = i > 0 && x.score === l[i - 1].score ? l[i - 1].rang : i + 1; });
  return l;
}

/* ================================================================== */
/* Les pirates de l'ordinateur                                        */
/* ================================================================== */

/** Une force grossière, pour ranger les cartes du plus faible au plus fort. */
export function force(c, as = null) {
  const e = c.t === 'tig' ? as || 'pir' : c.t;
  if (e === 'n') return c.s === 'B' ? 20 + c.n : c.n;
  return { esc: 0, kra: 0.5, wha: 15, sir: 40, pir: 50, sk: 60 }[e];
}

/** Les chances qu'une carte ramène un pli, à vue de nez de vieux loup de mer. */
function chance(c, n, taille) {
  // Les chances de base valent pour quatre joueurs. Moins d'adversaires, moins
  // de cartes pour battre la sienne : la chance de perdre se partage.
  const p = brute(c, taille);
  return 1 - (1 - p) ** ((3 / (n - 1)) ** 1.5);
}

function brute(c, taille) {
  // En petite manche, les cartes adverses sont rares : un 10 peut suffire.
  const peu = taille <= 2 ? 1.25 : taille <= 4 ? 1.1 : 1;
  switch (c.t) {
    case 'sk': return 0.88;
    case 'pir': return 0.75;
    case 'tig': return 0.55;           // souple : on décidera au moment de la jouer
    case 'sir': return 0.42;
    case 'wha': return 0.15;
    case 'kra': case 'esc': return 0;
    default: {
      const v = c.n;
      const base = c.s === 'B'
        ? (v >= 13 ? 0.8 : v >= 11 ? 0.6 : v >= 8 ? 0.35 : v >= 5 ? 0.18 : 0.08)
        : (v === 14 ? 0.5 : v === 13 ? 0.35 : v >= 11 ? 0.18 : v >= 9 ? 0.07 : 0.02);
      return Math.min(0.95, base * peu);
    }
  }
}

/** Le pari d'un joueur de l'ordinateur. */
export function pariBot(main, n, rng = Math.random) {
  const somme = main.reduce((s, c) => s + chance(c, n, main.length), 0);
  const bruit = (rng() - 0.5) * 0.7;
  return Math.max(0, Math.min(main.length, Math.round(somme + bruit)));
}

/** La carte que joue l'ordinateur : { id, as }. */
export function coupBot(G, p) {
  const main = G.mains[p];
  const options = [];
  for (const c of legales(main, G.pli)) {
    if (c.t === 'tig') options.push({ c, as: 'pir' }, { c, as: 'esc' });
    else options.push({ c, as: null });
  }
  const besoin = G.paris[p] - G.plis[p];
  const veut = besoin > 0;
  const restants = G.n - G.pli.length - 1;     // joueurs qui jouent après lui
  const evalue = options.map((o) => {
    const r = resoudre([...G.pli, { p, c: o.c, as: o.as }]);
    return { o, gagne: r.gagnant === p, f: force(o.c, o.as) };
  });
  const faible = (a, b) => (b.f < a.f ? b : a);
  const fort = (a, b) => (b.f > a.f ? b : a);
  let choix;

  if (G.pli.length === 0) {
    // Il ouvre : fort s'il a besoin de plis et une carte qui tient, petit sinon.
    const tient = evalue.filter((x) => x.f >= (G.n > 3 ? 31 : 27));
    if (veut && tient.length) choix = tient.reduce(faible);
    else if (veut) choix = evalue.filter((x) => x.f > 0.5).reduce(fort, evalue[0]);
    else choix = evalue.filter((x) => x.o.c.t !== 'kra').reduce(faible, evalue[0]);
  } else if (veut) {
    const gagnantes = evalue.filter((x) => x.gagne);
    // Dernier à jouer : la plus petite carte qui suffit. Sinon, une qui tiendra.
    const solides = restants === 0 ? gagnantes : gagnantes.filter((x) => x.f >= (restants > 1 ? 33 : 26));
    if (solides.length) choix = solides.reduce(faible);
    else if (gagnantes.length && besoin >= main.length) choix = gagnantes.reduce(fort);
    else choix = evalue.reduce(faible);
  } else {
    // Il ne veut plus rien : il se débarrasse de sa plus grosse carte perdante.
    const perdantes = evalue.filter((x) => !x.gagne);
    choix = perdantes.length ? perdantes.reduce(fort) : evalue.reduce(faible);
  }
  return { id: choix.o.c.id, as: choix.o.as };
}
