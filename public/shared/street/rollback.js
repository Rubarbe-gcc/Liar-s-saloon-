/**
 * STREET COMBAT — le « rollback » : jouer en ligne sans jamais attendre.
 *
 * Le moteur est déterministe : même état et mêmes touches donnent la même
 * image. Au lieu d'attendre les touches de l'adversaire (ce qui figeait le
 * combat au moindre retard), on les prédit — il garde les dernières — et on
 * avance tout de suite. Quand ses vraies touches arrivent et diffèrent de la
 * prédiction, on revient à l'image concernée (un instantané de l'état est
 * gardé pour chaque image récente) et on rejoue jusqu'à maintenant, dans la
 * même image affichée.
 *
 * - Nos touches partent avec un petit délai (1 à 3 images) : moins de
 *   corrections visibles.
 * - Chaque message renvoie aussi les touches que l'autre n'a pas encore
 *   confirmées : un message perdu ou en retard ne bloque rien.
 * - Si l'un prend de l'avance sur l'autre, il retient une image de temps en
 *   temps, jusqu'à ce qu'ils soient au même rythme.
 * - On n'attend que si l'on a FENETRE images d'avance sur ce qu'on sait de
 *   l'adversaire (sa connexion a vraiment lâché).
 * - Les événements (sons, impacts, textes) d'une image rejouée ne repassent
 *   pas deux fois : seuls ceux que la correction a fait apparaître sortent.
 * - De temps en temps, on compare une empreinte d'un état confirmé ; si les
 *   deux écrans ne sont plus d'accord, l'hôte envoie son état et l'autre s'y
 *   recale.
 *
 * Ce module ne connaît ni l'écran ni le réseau : main.js et enligne.js s'en
 * chargent, et test/street-rollback.test.js le fait jouer sur un faux réseau.
 */

/** Combien d'images on peut jouer d'avance sur les dernières touches reçues. */
export const FENETRE = 12;
/** Combien d'instantanés on garde (pour rejouer, et pour se recaler sur l'hôte). */
const GARDE = 48;
/** Au plus, combien de touches non confirmées repartent dans chaque message. */
const REDONDANCE = 20;
/** L'avance (en images) à partir de laquelle on retient une image, et pas plus d'une fois tous les… */
const SEUIL_AVANCE = 2;
const ESPACE_RETENUE = 8;

/** La clé d'un événement : pour reconnaître le même à la même image, d'une simulation à l'autre. */
const cleEvenement = (ev) => [ev.type, ev.joueur ?? '', ev.nom ?? '', ev.texte ?? '', ev.n ?? '', ev.visuel ?? '', Math.round((ev.x ?? 0) / 24), Math.round((ev.y ?? 0) / 24)].join('|');

/** Remet un objet dans l'état d'un instantané, sans changer son identité (l'écran le garde). */
function restaurer(c, snap, cloner) {
  for (const k of Object.keys(c)) delete c[k];
  Object.assign(c, cloner(snap));
}

/**
 * @param {object} o
 * @param {0|1} o.n          notre place (0 : l'hôte)
 * @param {number} [o.delai] le délai de nos touches, en images
 * @param {object} o.etat    l'état du combat (modifié sur place)
 * @param {(c, entrees:[number, number]) => object[]} o.pas  joue une image, rend ses événements
 * @param {(c) => string} [o.empreinte]   l'empreinte d'un état (pour voir une désynchronisation)
 * @param {(f:number, entrees:[number, number]) => void} [o.confirme]  appelé pour chaque image confirmée, dans l'ordre
 * @param {(x) => any} [o.cloner]
 */
export function creerSession({ n, delai = 2, etat, pas, empreinte = null, confirme = null, cloner = structuredClone, intervalleEmpreinte = 120 }) {
  const S = {
    n, delai, c: etat, f: 0,
    locales: new Map(), distantes: new Map(), predites: new Map(), snaps: new Map(), vus: new Map(),
    dernierLocal: delai - 1,
    dernierDistant: -1, valeurDistante: 0,
    fcDistant: 0, avanceDistante: 0, vuDistant: -1,
    reprise: Infinity, confirmees: 0, retenue: -99, ecart: 0,
    empreintes: new Map(), distantesEmpreintes: new Map(), desynchro: false,
    stats: { rejouees: 0, retours: 0, attentes: 0, retenues: 0, recalages: 0 },
  };
  // Nos premières images : sans touche (elles partent avec le délai).
  for (let f = 0; f < delai; f++) S.locales.set(f, 0);

  /** Les événements d'une image, sans ceux qu'on a déjà montrés pour cette image. */
  function nouveaux(f, evs) {
    const deja = S.vus.get(f) || new Map();
    const ici = new Map();
    const sortie = [];
    for (const ev of evs) {
      const k = cleEvenement(ev);
      const n2 = (ici.get(k) || 0) + 1;
      ici.set(k, n2);
      if (n2 > (deja.get(k) || 0)) sortie.push(ev);
    }
    // On garde le plus grand nombre vu, pour ne pas rejouer un son qui a déjà sonné.
    for (const [k, v] of deja) if ((ici.get(k) || 0) < v) ici.set(k, v);
    S.vus.set(f, ici);
    return sortie;
  }

  /** Joue l'image f (l'état est celui d'avant f). */
  function jouer(f) {
    S.snaps.set(f, cloner(S.c));
    const moi = S.locales.get(f) ?? 0;
    let lui = S.distantes.get(f);
    if (lui === undefined) { lui = S.valeurDistante; S.predites.set(f, lui); }
    const evs = pas(S.c, S.n === 0 ? [moi, lui] : [lui, moi]) || [];
    S.f = f + 1;
    return nouveaux(f, evs);
  }

  /** Les touches reçues ont démenti une prédiction : on revient en arrière et on rejoue. */
  function corriger(sortie) {
    if (S.reprise >= S.f) { S.reprise = Infinity; return; }
    const de = S.reprise;
    S.reprise = Infinity;
    const snap = S.snaps.get(de);
    if (!snap) return;
    restaurer(S.c, snap, cloner);
    const jusqua = S.f;
    S.f = de;
    for (let f = de; f < jusqua; f++) sortie.push(...jouer(f));
    S.stats.rejouees += jusqua - de;
    S.stats.retours += 1;
  }

  /** Les images dont on connaît maintenant les deux touches : sûres. */
  function confirmer(sortie) {
    const limite = Math.min(S.f, S.dernierDistant + 1);
    while (S.confirmees < limite) {
      const f = S.confirmees;
      const moi = S.locales.get(f) ?? 0;
      const lui = S.distantes.get(f) ?? 0;
      confirme?.(f, S.n === 0 ? [moi, lui] : [lui, moi]);
      S.confirmees += 1;
      // L'empreinte de l'état juste après cette image, toutes les deux secondes.
      if (empreinte && S.confirmees % intervalleEmpreinte === 0) {
        const etat = S.confirmees === S.f ? S.c : S.snaps.get(S.confirmees);
        if (etat) {
          const h = empreinte(etat);
          S.empreintes.set(S.confirmees, h);
          sortie.empreinte = { f: S.confirmees, h };
          comparer(S.confirmees);
        }
      }
    }
    // On oublie ce qui est trop vieux.
    const vieux = S.confirmees - GARDE;
    for (const m of [S.snaps, S.vus, S.distantes, S.predites, S.empreintes, S.distantesEmpreintes]) for (const f of m.keys()) if (f < vieux) m.delete(f);
    // Nos touches : on les garde tant que l'autre ne les a pas reçues.
    for (const f of S.locales.keys()) if (f < Math.min(vieux, S.vuDistant + 1)) S.locales.delete(f);
  }

  function comparer(f) {
    const a = S.empreintes.get(f), b = S.distantesEmpreintes.get(f);
    if (a !== undefined && b !== undefined && a !== b) S.desynchro = true;
  }

  /** Le message à envoyer : nos touches que l'autre n'a pas encore, et où l'on en est. */
  function message() {
    // À partir de la première qu'il n'a pas : s'il en manque beaucoup, les plus anciennes d'abord.
    const debut = Math.min(Math.max(S.vuDistant + 1, 0), S.dernierLocal);
    const fin = Math.min(S.dernierLocal, debut + REDONDANCE - 1);
    const e = [];
    for (let f = debut; f <= fin; f++) e.push(S.locales.get(f) ?? 0);
    return { f: fin, e, fc: S.f, vu: S.dernierDistant, av: S.f - S.fcDistant };
  }

  return {
    get f() { return S.f; },
    get confirmees() { return S.confirmees; },
    get desynchro() { return S.desynchro; },
    get delai() { return S.delai; },
    stats: S.stats,
    /** L'avance qu'on a sur ce qu'on sait de l'adversaire (en images). */
    avance: () => S.f - (S.dernierDistant + 1),

    /**
     * Une image d'horloge (60 par seconde). `local` : nos touches, maintenant (un nombre).
     * Rend { evs, attente, envoi, empreinte? } : les événements à montrer, et le message à envoyer.
     */
    avancer(local) {
      const sortie = { evs: [], attente: false, envoi: null };
      corriger(sortie.evs);
      // Trop d'avance sur l'adversaire : sa connexion a lâché, on l'attend.
      if (S.f - S.dernierDistant > FENETRE) {
        S.stats.attentes += 1;
        sortie.attente = true;
        sortie.envoi = message();
        return sortie;
      }
      // Au même rythme : si l'on est nettement en avance sur lui, on retient une image de temps en temps.
      // (l'écart est lissé : le réseau qui varie ne doit pas faire hoqueter le jeu)
      if (S.fcDistant > 0) S.ecart = S.ecart * 0.94 + ((S.f - S.fcDistant) - S.avanceDistante) * 0.06;
      if (S.fcDistant > 0 && S.ecart >= SEUIL_AVANCE && S.f - S.retenue >= ESPACE_RETENUE) {
        S.retenue = S.f;
        S.ecart -= 2;
        S.stats.retenues += 1;
        sortie.attente = true;
        sortie.retenue = true;
        sortie.envoi = message();
        return sortie;
      }
      // Nos touches, pour dans `delai` images.
      const cible = S.f + S.delai;
      if (!S.locales.has(cible)) { S.locales.set(cible, local | 0); S.dernierLocal = Math.max(S.dernierLocal, cible); }
      sortie.evs.push(...jouer(S.f));
      confirmer(sortie);
      sortie.envoi = message();
      return sortie;
    },

    /** Un message de l'adversaire : ses touches (avec celles qu'il renvoie), où il en est. */
    recevoir({ f, e, fc = 0, vu = -1, av = 0 }) {
      const liste = Array.isArray(e) ? e : [e];
      const debut = f - liste.length + 1;
      liste.forEach((v, i) => {
        const fr = debut + i;
        if (fr < 0 || S.distantes.has(fr) || fr < S.confirmees) return;
        S.distantes.set(fr, v | 0);
        if (S.predites.has(fr)) {
          if (S.predites.get(fr) !== (v | 0)) S.reprise = Math.min(S.reprise, fr);
          S.predites.delete(fr);
        }
      });
      while (S.distantes.has(S.dernierDistant + 1)) S.dernierDistant += 1;
      if (S.distantes.has(S.dernierDistant)) S.valeurDistante = S.distantes.get(S.dernierDistant);
      if (fc > S.fcDistant) { S.fcDistant = fc; S.avanceDistante = av; }
      if (vu > S.vuDistant) S.vuDistant = vu;
    },

    /** Son empreinte d'un état confirmé. */
    recevoirEmpreinte({ f, h }) {
      S.distantesEmpreintes.set(f, String(h));
      comparer(f);
    },

    /** La divergence est traitée (l'hôte a envoyé son état) : on n'en parle plus. */
    acquitter() { S.desynchro = false; },

    /** L'état d'une image confirmée (pour que l'autre s'y recale) : à envoyer par l'hôte. */
    etatConfirme() {
      const f = S.confirmees;
      const etat = f === S.f ? S.c : S.snaps.get(f);
      return etat ? { f, etat: cloner(etat) } : null;
    },

    /** L'état de l'hôte à l'image f : on le prend, et on rejoue jusqu'à maintenant. */
    recaler({ f, etat }) {
      if (f > S.f) return false;
      if (f === S.f) restaurer(S.c, etat, cloner);
      else if (S.snaps.has(f)) { S.snaps.set(f, cloner(etat)); S.reprise = Math.min(S.reprise, f); } else return false;
      S.desynchro = false;
      S.stats.recalages += 1;
      return true;
    },
  };
}
