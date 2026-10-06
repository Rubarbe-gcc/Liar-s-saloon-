/**
 * FIESTA — Le Fantôme : un cache-cache dans un manoir hanté (1 contre tous).
 *
 * Module ISO. Le joueur seul est le fantôme, les autres se cachent. Chaque
 * manche :
 *   cache   → chaque joueur encore libre choisit une pièce, en secret ;
 *   cherche → le fantôme voit des ombres courir de pièce en pièce (avant
 *             la coupure de courant), puis ouvre une porte : ceux qui
 *             s'y cachaient sont attrapés. La pièce fouillée est condamnée :
 *             plus personne n'a le droit d'y aller.
 * Autant de pièces que de joueurs cachés plus une, et une manche de moins
 * que de pièces : à la dernière, il en reste deux.
 *
 * Le hasard vient de l'appelant (`R`), pour que la partie reste rejouable.
 */

export const PIECES = [['🛏️', 'Chambre'], ['🍳', 'Cuisine'], ['📚', 'Bibliothèque'], ['🛁', 'Salle de bain'], ['🕯️', 'Grenier'], ['🍷', 'Cave']];
export const piecesPour = (cacheurs) => cacheurs + 1;
export const manchesPour = (cacheurs) => piecesPour(cacheurs) - 1;
/** Le fantôme gagne s'il attrape tout le monde avant la fin des manches. */
export const seuilFantome = (cacheurs) => cacheurs;
/** Les ombres que voit le fantôme : trois passages, et le dernier est souvent la vraie cachette. */
const PASSAGES = 3;
const INDICE_VRAI = 0.4;
/** L'ordinateur fantôme suit les ombres plus ou moins bien. */
const FLAIR = { facile: 0.35, normal: 0.55, expert: 0.75 };

const refus = (raison) => ({ ok: false, raison });

export function nouveau(cacheurs) {
  const n = piecesPour(cacheurs.length);
  return {
    pieces: n,
    ouvertes: Array.from({ length: n }, (_, k) => k),
    cacheurs: [...cacheurs],
    libres: [...cacheurs],
    choix: {},
    chemins: null,
    manche: 1,
    manches: manchesPour(cacheurs.length),
    etape: 'cache',
    revelations: [],
  };
}

/** Les joueurs libres qui ne se sont pas encore cachés cette manche. */
export const reste = (st) => st.libres.filter((i) => st.choix[i] === undefined);

export function cacher(st, i, piece) {
  if (st.etape !== 'cache') return refus('etape');
  if (!st.libres.includes(i) || st.choix[i] !== undefined) return refus('joueur');
  if (!st.ouvertes.includes(piece)) return refus('piece');
  st.choix[i] = piece;
  return { ok: true };
}

/** Tout le monde est caché : place aux ombres, puis au fantôme. */
export function versRecherche(st, R) {
  if (st.etape !== 'cache' || reste(st).length) return refus('etape');
  const au = () => st.ouvertes[Math.floor(R() * st.ouvertes.length)];
  st.chemins = Object.fromEntries(st.libres.map((i) => {
    const c = Array.from({ length: PASSAGES - 1 }, au);
    c.push(R() < INDICE_VRAI ? st.choix[i] : au());
    return [i, c];
  }));
  st.etape = 'cherche';
  return { ok: true };
}

/** Le fantôme ouvre une porte. */
export function chercher(st, piece) {
  if (st.etape !== 'cherche') return refus('etape');
  if (!st.ouvertes.includes(piece)) return refus('piece');
  const trouves = st.libres.filter((i) => st.choix[i] === piece);
  st.revelations.push({ manche: st.manche, piece, trouves, caches: { ...st.choix } });
  st.libres = st.libres.filter((i) => !trouves.includes(i));
  st.ouvertes = st.ouvertes.filter((x) => x !== piece);
  st.choix = {};
  st.chemins = null;
  st.manche += 1;
  st.etape = st.manche > st.manches || !st.libres.length ? 'fini' : 'cache';
  return { ok: true, trouves };
}

/** Une cachette au hasard, pour l'ordinateur (ou un joueur trop lent). */
export const cachetteAuHasard = (st, R) => st.ouvertes[Math.floor(R() * st.ouvertes.length)];

/** L'ordinateur fantôme : il suit les ombres (plus ou moins), sinon il ouvre au hasard. */
export function porteOrdi(st, niveau, R) {
  const vus = {};
  for (const c of Object.values(st.chemins || {})) vus[c[c.length - 1]] = (vus[c[c.length - 1]] || 0) + 1;
  const meilleure = st.ouvertes.reduce((m, x) => ((vus[x] || 0) > (vus[m] || 0) ? x : m), st.ouvertes[0]);
  return R() < (FLAIR[niveau] ?? FLAIR.normal) ? meilleure : cachetteAuHasard(st, R);
}

export const attrapes = (st) => st.cacheurs.length - st.libres.length;

/** Combien de manches un joueur caché a tenu. */
export function manchesTenues(st, i) {
  const r = st.revelations.find((x) => x.trouves.includes(i));
  return r ? r.manche - 1 : st.revelations.length;
}
