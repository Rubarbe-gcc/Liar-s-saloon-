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

/**
 * LE MODE CUSTOM : des cartes en plus, inventées pour la maison. On choisit
 * celles qu'on met dans le paquet ; chacune a une règle courte et nette.
 */
export const CUSTOM = {
  rhum: { nom: 'Bouteille de rhum', glyphe: '🍾', nb: 2,
    regle: 'Une fuite : elle ne prend jamais rien. Mais son joueur gagne +10 de bonus s’il réussit son pari.' },
  maudit: { nom: 'Trésor maudit', glyphe: '💀', nb: 1,
    regle: 'Une fuite empoisonnée : celui qui remporte le pli où elle tombe prend −20, pari réussi ou pas.' },
  cors: { nom: 'Corsaire', glyphe: '🦎', nb: 2,
    regle: 'Vaut un 15 de la couleur demandée : il bat toute cette couleur, mais perd contre l’atout noir et les personnages. Il se joue toujours, et ne fixe pas la couleur.' },
  canon: { nom: 'Canon', glyphe: '💣', nb: 1,
    regle: 'Joué en tout dernier dans le pli, il bat tout — Skull King compris. Joué avant, c’est une fuite.' },
  holl: { nom: 'Hollandais volant', glyphe: '👻', nb: 1,
    regle: 'Si aucun personnage n’est joué dans le pli, c’est la plus PETITE carte numérotée qui gagne, toutes couleurs confondues. Sinon, c’est une fuite.' },
  ancre: { nom: 'Ancre', glyphe: '⚓', nb: 1,
    regle: 'Une fuite qui retient le navire : son joueur ouvre le pli suivant, quel que soit le gagnant.' },
};
export const TOUTES_CUSTOM = Object.keys(CUSTOM);
/** Les cartes qui ne prennent jamais rien d'elles-mêmes (elles ne fixent pas la couleur non plus). */
const DISCRETES = ['esc', 'kra', 'wha', 'rhum', 'maudit', 'cors', 'canon', 'holl', 'ancre'];
const PERSONNAGES = ['sk', 'pir', 'sir'];

/** Les cinq pirates ont chacun leur nom (et leur portrait). */
export const PIRATES = ['Barbe-Grise', 'Rosa la Rouge', 'Jack Tortue', 'Bahia la Borgne', 'Harald le Grand'];
export const SIRENES = ['Ondine', 'Coralie'];

/** Les 72 cartes du jeu, plus les cartes custom demandées. */
export function paquet(extras = []) {
  const d = [];
  for (const s of Object.keys(COULEURS)) for (let n = 1; n <= 14; n++) d.push({ id: `${s}${n}`, t: 'n', s, n });
  for (let i = 1; i <= 5; i++) {
    d.push({ id: `pir${i}`, t: 'pir', nom: PIRATES[i - 1] });
    d.push({ id: `esc${i}`, t: 'esc' });
  }
  d.push({ id: 'sir1', t: 'sir', nom: SIRENES[0] }, { id: 'sir2', t: 'sir', nom: SIRENES[1] });
  d.push({ id: 'sk', t: 'sk' }, { id: 'tig', t: 'tig' }, { id: 'kra', t: 'kra' }, { id: 'wha', t: 'wha' });
  for (const t of extras) {
    const c = CUSTOM[t];
    if (!c) continue;
    for (let i = 1; i <= c.nb; i++) d.push({ id: c.nb > 1 ? `${t}${i}` : t, t, nom: c.nom });
  }
  return d;
}

/** Ne garde qu'une liste propre de cartes custom connues. */
export const nettoyerExtras = (l) => (Array.isArray(l) ? TOUTES_CUSTOM.filter((t) => l.includes(t)) : []);

export const nomCarte = (c, as = null) => {
  if (c.t === 'n') return `${c.n} ${COULEURS[c.s].nom}`;
  if (c.t === 'tig') return as ? `Tigresse (${as === 'pir' ? 'pirate' : 'fuite'})` : 'Tigresse';
  return c.nom || (SPECIALES[c.t] || CUSTOM[c.t]).nom;
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
    if (DISCRETES.includes(e)) continue;
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

/** La valeur et la couleur d'une carte numérotée — le Corsaire vaut 15 dans la couleur demandée. */
function chiffre(pli, j) {
  if (j.c.t === 'n') return { s: j.c.s, n: j.c.n };
  if (j.c.t === 'cors') return { s: couleurDemandee(pli), n: 15 };
  return null;
}

/** L'index de la carte qui l'emporte, hors monstres (Kraken, Baleine, Hollandais). */
function meilleure(pli, n = pli.length) {
  const E = pli.map(effet);
  const premier = (t) => E.indexOf(t);
  // Le Canon, posé en tout dernier, emporte tout.
  if (pli.length && pli.length === n && E[n - 1] === 'canon') return n - 1;
  // La sirène est la seule à séduire le Skull King.
  if (premier('sk') >= 0 && premier('sir') >= 0) return premier('sir');
  for (const t of PERSONNAGES) if (premier(t) >= 0) return premier(t);
  const nums = pli.map((j, i) => i).filter((i) => chiffre(pli, pli[i]));
  if (!nums.length) return pli.length ? 0 : -1; // que des fuites : la première l'emporte
  const v = (i) => chiffre(pli, pli[i]);
  const atouts = nums.filter((i) => v(i).s === 'B');
  const couleur = couleurDemandee(pli) || v(nums[0]).s;
  const pool = atouts.length ? atouts : nums.filter((i) => v(i).s === couleur);
  return (pool.length ? pool : nums).reduce((a, i) => (v(i).n > v(a).n ? i : a));
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
 * Qui remporte le pli, et ce qu'il gagne en bonus. `n` : le nombre de cartes
 * d'un pli complet (le Canon a besoin de savoir s'il est le dernier).
 * Renvoie { gagnant (joueur ou null), meneur (qui ouvre le pli suivant),
 *           carte (index de la carte gagnante, ou -1), bonus, details, effet,
 *           extras: [{ p, pts, txt }] — ce que gagnent ou perdent d'autres
 *           joueurs que le gagnant (rhum, trésor maudit) }.
 */
export function resoudre(pli, n = pli.length) {
  const E = pli.map(effet);
  const personnage = E.some((e) => PERSONNAGES.includes(e));
  // Les monstres : Kraken, Baleine, et le Hollandais s'il n'y a pas de personnage.
  // S'il y en a plusieurs, le dernier joué décide.
  let mi = -1;
  pli.forEach((j, i) => {
    if (j.c.t === 'kra' || j.c.t === 'wha' || (j.c.t === 'holl' && !personnage)) mi = i;
  });
  const monstre = mi >= 0 ? pli[mi].c.t : null;
  const r = monstre ? resoudreMonstre(pli, mi, monstre, n) : resoudreNormal(pli, n);

  // Les cartes custom qui touchent d'autres joueurs que le gagnant.
  r.extras = [];
  for (const j of pli) {
    if (j.c.t === 'rhum') r.extras.push({ p: j.p, pts: 10, txt: 'Bouteille de rhum' });
    if (j.c.t === 'maudit' && r.gagnant !== null) r.extras.push({ p: r.gagnant, pts: -20, txt: 'Trésor maudit' });
    if (j.c.t === 'ancre') r.meneur = j.p;
  }
  return r;
}

function resoudreMonstre(pli, mi, monstre, n) {
  if (monstre === 'kra') {
    // Le pli est englouti ; celui qui l'aurait gagné ouvre le suivant.
    const reste = pli.filter((j) => !['kra', 'wha', 'holl'].includes(j.c.t));
    const m = meilleure(reste, reste.length + 1);
    return { gagnant: null, meneur: m >= 0 ? reste[m].p : pli[mi].p, carte: -1, bonus: 0, details: [], effet: 'kraken' };
  }
  // La Baleine : le plus gros chiffre gagne ; le Hollandais : le plus petit.
  // Les personnages perdent leurs pouvoirs, la couleur ne compte plus.
  const plusGrand = monstre === 'wha';
  let best = -1;
  pli.forEach((j, i) => {
    const v = chiffre(pli, j);
    if (!v) return;
    const b = best >= 0 ? chiffre(pli, pli[best]).n : null;
    if (best < 0 || (plusGrand ? v.n > b : v.n < b)) best = i;
  });
  const effet = plusGrand ? 'baleine' : 'hollandais';
  if (best < 0) return { gagnant: null, meneur: pli[mi].p, carte: -1, bonus: 0, details: [], effet };
  const details = bonusQuatorze(pli);
  return { gagnant: pli[best].p, meneur: pli[best].p, carte: best, bonus: details.reduce((s, d) => s + d.pts, 0), details, effet };
}

function resoudreNormal(pli, n) {
  const w = meilleure(pli, n);
  const E = pli.map(effet);
  const compte = (t) => E.filter((x) => x === t).length;
  const details = bonusQuatorze(pli);
  if (E[w] === 'sk' && compte('pir')) details.push({ pts: 30 * compte('pir'), txt: `Skull King prend ${compte('pir')} pirate${compte('pir') > 1 ? 's' : ''}` });
  if (E[w] === 'pir' && compte('sir')) details.push({ pts: 20 * compte('sir'), txt: `Pirate prend ${compte('sir')} sirène${compte('sir') > 1 ? 's' : ''}` });
  if (E[w] === 'sir' && compte('sk')) details.push({ pts: 40, txt: 'Sirène capture le Skull King' });
  if (E[w] === 'canon') details.push({ pts: 0, txt: 'Coup de canon' });
  return { gagnant: pli[w].p, meneur: pli[w].p, carte: w, bonus: details.reduce((s, d) => s + d.pts, 0), details, effet: E[w] === 'canon' ? 'canon' : null };
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
export function creerPartie({ noms, bots, manches = MANCHES, extras = [] }) {
  const n = noms.length;
  if (n < 2 || n > MAX_JOUEURS) throw new Error('de 2 à 7 joueurs');
  return {
    n, noms: noms.slice(), bots: bots ? bots.slice() : noms.map((_, i) => i > 0),
    manches, manche: 0, donneur: n - 1, meneur: 0, tour: 0,
    mains: [], paris: [], plis: [], bonus: [], pli: [], dernier: null,
    scores: Array(n).fill(0), historique: [], phase: 'pari',
    extras: nettoyerExtras(extras), malus: [],
  };
}

/** Distribue la manche suivante (ou termine la partie). */
export function nouvelleManche(G, rng) {
  G.manche++;
  if (G.manche > G.manches) { G.phase = 'fin'; return G; }
  const d = melanger(paquet(G.extras || []), rng);
  G.mains = [];
  for (let p = 0; p < G.n; p++) G.mains.push(d.splice(0, G.manche));
  G.donneur = (G.donneur + 1) % G.n;
  G.meneur = G.tour = (G.donneur + 1) % G.n;
  G.paris = Array(G.n).fill(null);
  G.plis = Array(G.n).fill(0);
  G.bonus = Array(G.n).fill(0);
  G.malus = Array(G.n).fill(0);
  G.pli = [];
  G.dernier = null;
  G.phase = 'pari';
  return G;
}

/*
 * LE DERNIER PARI. Le total des paris ne doit jamais tomber pile sur le
 * nombre de cartes de la manche : il faut qu'au moins un joueur se trompe.
 * Le donneur parie en dernier, une fois les autres paris posés ; il connaît
 * leur total, et le chiffre qui ferait tomber juste lui est interdit.
 */
export const dernierAParier = (G) => G.donneur;
/** Ce que les autres joueurs ont annoncé, au total (les paris manquants comptent zéro). */
export const totalAutres = (G, p) => G.paris.reduce((t, b, i) => (i === p ? t : t + (b ?? 0)), 0);
/** Les autres ont-ils tous parié ? */
export const autresOntParie = (G, p) => G.paris.every((b, i) => i === p || b !== null);
/** Le pari interdit au dernier joueur, ou null (pour les autres, ou si aucun chiffre ne tombe juste). */
export function pariInterdit(G, p) {
  if (p !== dernierAParier(G)) return null;
  const v = G.manche - totalAutres(G, p);
  return v >= 0 && v <= G.manche ? v : null;
}

/** Un joueur annonce son pari. Quand tout le monde a parié, on joue. */
export function parier(G, p, v) {
  if (G.phase !== 'pari') return { ok: false, raison: 'ce n’est pas le moment de parier' };
  if (!Number.isInteger(v) || v < 0 || v > G.manche) return { ok: false, raison: 'pari impossible' };
  if (p === dernierAParier(G)) {
    if (!autresOntParie(G, p)) return { ok: false, raison: 'le donneur parie en dernier : on attend les autres' };
    if (v === pariInterdit(G, p)) return { ok: false, raison: `le total des paris ne peut pas faire ${G.manche} : changez votre pari` };
  }
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
  const r = resoudre(G.pli, G.n);
  if (r.gagnant !== null) { G.plis[r.gagnant]++; G.bonus[r.gagnant] += r.bonus; }
  if (!G.malus) G.malus = Array(G.n).fill(0);
  // Un bonus ne compte que si le pari est réussi ; un malus compte toujours.
  for (const x of r.extras) {
    if (x.pts > 0) G.bonus[x.p] += x.pts; else G.malus[x.p] += -x.pts;
  }
  G.dernier = { pli: G.pli, ...r };
  G.pli = [];
  G.meneur = G.tour = r.meneur;
  if (G.mains.every((m) => m.length === 0)) {
    const bilan = [];
    for (let p = 0; p < G.n; p++) {
      const malus = G.malus[p] || 0;
      const pts = points(G.manche, G.paris[p], G.plis[p], G.bonus[p]) - malus;
      G.scores[p] += pts;
      bilan.push({ pari: G.paris[p], plis: G.plis[p], bonus: G.bonus[p], malus, points: pts, total: G.scores[p] });
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
  return { esc: 0, kra: 0.5, wha: 15, sir: 40, pir: 50, sk: 60, rhum: 0.2, maudit: 0.1, ancre: 0.3, cors: 16, holl: 12, canon: 30 }[e] ?? 0;
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
    case 'kra': case 'esc': case 'rhum': case 'maudit': case 'ancre': return 0;
    case 'cors': return 0.45;
    case 'canon': return 0.3;
    case 'holl': return 0.12;
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

/**
 * Le pari d'un joueur de l'ordinateur à la table : s'il parie en dernier et
 * que son chiffre est interdit, il se décale d'un cran (vers le bas d'abord,
 * s'il le peut — on rate plus volontiers un pli en trop).
 */
export function pariPour(G, p, rng = Math.random) {
  const v = pariBot(G.mains[p], G.n, rng);
  const interdit = pariInterdit(G, p);
  if (v !== interdit) return v;
  return v > 0 ? v - 1 : v + 1;
}

/** Fait parier les joueurs de l'ordinateur qui le peuvent (le donneur en dernier). */
export function parierBots(G, rng = Math.random) {
  for (let p = 0; p < G.n; p++) {
    if (G.bots[p] && G.paris[p] === null && p !== dernierAParier(G)) parier(G, p, pariPour(G, p, rng));
  }
  const d = dernierAParier(G);
  if (G.bots[d] && G.paris[d] === null && autresOntParie(G, d)) parier(G, d, pariPour(G, d, rng));
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
    const r = resoudre([...G.pli, { p, c: o.c, as: o.as }], G.n);
    // Un pli qui porte le Trésor maudit ne vaut rien : on évite de le gagner.
    const maudit = r.extras.some((x) => x.p === p && x.pts < 0);
    return { o, gagne: r.gagnant === p, maudit, f: force(o.c, o.as) };
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
    const gagnantes = evalue.filter((x) => x.gagne && !x.maudit);
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
