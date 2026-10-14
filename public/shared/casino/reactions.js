/**
 * LE VELOURS NOIR — les réactions (la roue d'emojis).
 *
 * Les joueurs choisissent un emoji dans la roue ; le serveur ne relaie que
 * ceux de la liste, une fois toutes les 3 secondes au plus par joueur.
 *
 * Les habitués (bots du poker) réagissent seuls, selon ce qui vient de se
 * passer et selon leur style. Le choix ne dépend que des événements de la
 * table : tous les écrans d'une table en ligne montrent donc les mêmes
 * réactions, sans rien échanger. Un habitué ne réagit jamais pendant une
 * main qu'il joue encore (ça trahirait son jeu), et une fois par main au plus.
 */

export const EMOJIS = ['😎', '🤑', '😱', '😭', '😡', '🤞', '👏', '🔥'];
export const ESPACEMENT_MS = 3000;
export const valide = (e) => EMOJIS.includes(e);

/** Un nombre de 0 à 1, toujours le même pour les mêmes morceaux. */
export function hasard(...morceaux) {
  let h = 2166136261;
  for (const c of morceaux.join('|')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const ORDRE = [['Quinte flush', 8], ['Carré', 7], ['Full', 6], ['Couleur', 5], ['Quinte', 4], ['Brelan', 3], ['Deux paires', 2], ['Paire', 1]];
/** La catégorie (0 hauteur … 8 quinte flush) d'une main d'après son nom. */
export const categorie = (nom) => (ORDRE.find(([p]) => String(nom || '').startsWith(p)) || [0, 0])[1];

/** Ce que chaque style montre, et à quel point il est démonstratif. */
const CARACTERE = {
  prudent: { gros: '😎', perd: '😭', bravo: '👏', envie: 0.5 },
  requin: { gros: '😎', perd: '😡', bravo: '👏', envie: 0.6 },
  flambeur: { gros: '🤑', perd: '😡', bravo: '🔥', envie: 0.9 },
  bluffeur: { gros: '😎', perd: '😭', bravo: '🔥', envie: 0.75 },
  touriste: { gros: '🤑', perd: '😭', bravo: '👏', envie: 0.85 },
};
const caractere = (style) => CARACTERE[style] || CARACTERE.touriste;
const delai = (cle, i) => 500 + Math.round(hasard(cle, i, 'delai') * 1500);

/**
 * Les réactions des habitués à la fin d'une main.
 * @param {object} o
 * @param {Record<number,string>} o.bots   place → style, pour les habitués
 * @param {Array} o.pots    les événements « gain » de la main
 * @param {Array} [o.mains] les mains montrées à l'abattage ({ i, nom })
 * @param {number[]} o.jetons  les tapis après la main
 * @param {number[]} o.engages les places qui ont joué la main
 * @param {number} o.grosse    la grosse blinde
 * @param {Set<number>} [o.deja] les places qui ont déjà réagi pendant la main
 * @returns {{ i:number, e:string, delai:number }[]}
 */
export function reactionsMain({ bots, pots, mains = [], jetons, engages, grosse, deja = new Set() }) {
  const cle = pots.map((p) => `${p.gagnants.join(',')}:${p.montant}:${p.nom || ''}`).join('/') + `#${jetons.join(',')}`;
  const gains = {};
  for (const p of pots) for (const [i, v] of Object.entries(p.parts || {})) gains[i] = (gains[i] || 0) + v;
  const montrees = Object.fromEntries(mains.map((m) => [m.i, categorie(m.nom)]));
  const meilleureGagnante = Math.max(-1, ...pots.filter((p) => !p.sansAbattage).map((p) => categorie(p.nom)));
  const out = [];
  for (const [k, style] of Object.entries(bots)) {
    const i = Number(k);
    if (deja.has(i) || !engages.includes(i)) continue;
    const c = caractere(style);
    const de = (tag, p) => hasard(cle, i, tag) < p * c.envie;
    let e = null;
    const g = gains[i] || 0;
    if (g >= grosse * 20 && de('gros', 0.9)) e = pots.every((p) => p.sansAbattage) && style === 'bluffeur' ? '😎' : c.gros;
    else if (g >= grosse * 6 && de('moyen', 0.3)) e = hasard(cle, i, 'quoi') < 0.5 ? '😎' : '🔥';
    else if (!g && jetons[i] <= 0 && de('ruine', 0.95)) e = c.perd;
    else if (!g && (montrees[i] ?? -1) >= 4 && de('badbeat', 0.85)) e = '😱';
    else if (!g && meilleureGagnante >= 6 && de('bravo', 0.55)) e = c.bravo;
    if (e) out.push({ i, e, delai: delai(cle, i) });
  }
  return out;
}

/**
 * Quelqu'un fait tapis : un habitué qui s'est déjà couché peut s'en émouvoir
 * (lui n'a plus rien à cacher). Une réaction au plus.
 * @param {object} o
 * @param {number} o.i       la place qui fait tapis
 * @param {number} o.mise    sa mise totale
 * @param {Record<number,string>} o.bots
 * @param {number[]} o.couches les places couchées
 * @param {Set<number>} [o.deja]
 */
export function reactionTapis({ i, mise, bots, couches, deja = new Set() }) {
  const cle = `tapis:${i}:${mise}`;
  const qui = couches.filter((k) => k !== i && bots[k] && !deja.has(k));
  if (!qui.length || hasard(cle, 'oui') >= 0.4) return null;
  const k = qui[Math.floor(hasard(cle, 'qui') * qui.length)];
  return { i: k, e: hasard(cle, 'quoi') < 0.5 ? '😱' : '🤞', delai: delai(cle, k) };
}
