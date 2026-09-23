/**
 * ÉCHO — analyse d'une imitation vocale.
 *
 * Module ISO : il ne travaille que sur des tableaux de nombres, sans Web
 * Audio ni document. C'est délibéré — le barème est la pièce la plus délicate
 * du jeu, et le rendre testable hors navigateur est le seul moyen de vérifier
 * qu'il note ce qu'il prétend noter.
 *
 * La note sur cent combine trois dimensions, chacune mesurée séparément :
 *
 *   · la MÉLODIE, en hauteur *relative*. On ramène chaque contour à sa propre
 *     médiane avant de comparer, si bien qu'une voix grave et une voix aiguë
 *     qui chantent le même air obtiennent la même note. Sans cela le jeu
 *     récompenserait le timbre plutôt que l'imitation.
 *
 *   · le RYTHME, par corrélation des enveloppes d'énergie. C'est ce qui
 *     distingue « taa-ta-ta » de « ta-ta-taa » à hauteur identique.
 *
 *   · les ATTAQUES, c'est-à-dire le nombre de débuts de son : un aboiement ne
 *     vaut pas trois aboiements, même bien imités.
 */

/** Poids des trois dimensions. Leur somme fait cent. */
export const POIDS = { melodie: 45, rythme: 35, attaques: 20 };

/**
 * Deux grilles d'analyse, et non une seule.
 *
 * La hauteur réclame une fenêtre longue : détecter un la grave demande de
 * voir plusieurs périodes. L'énergie, elle, n'a pas cette contrainte — et une
 * fenêtre de 46 ms lisse les silences de 30 ms qui séparent deux notes
 * rapides, si bien qu'une valse de six notes n'en comptait plus que deux.
 * L'enveloppe se mesure donc sur une fenêtre quatre fois plus courte.
 */
const FENETRE = 0.046;       // hauteur : ~2048 échantillons à 44,1 kHz
const PAS = 0.011;
const FENETRE_ENV = 0.012;   // énergie : assez fin pour séparer deux syllabes
const PAS_ENV = 0.005;

/** Bornes de hauteur explorées, en hertz : voix humaine, large. */
const HZ_MIN = 65;
const HZ_MAX = 1100;

/** En dessous, on considère la fenêtre muette plutôt que de deviner. */
const SEUIL_VOISEMENT = 0.012;
/** Qualité minimale de l'autocorrélation pour accepter une hauteur. */
const SEUIL_CLARTE = 0.35;

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

/** Énergie efficace d'une fenêtre. */
function rms(x, deb, n) {
  let s = 0;
  for (let i = deb; i < deb + n; i++) s += x[i] * x[i];
  return Math.sqrt(s / n);
}

/**
 * Hauteur d'une fenêtre, par autocorrélation normalisée.
 *
 * On écarte les fenêtres trop faibles et celles dont le pic est mou : mieux
 * vaut un trou dans le contour qu'une hauteur inventée, qui se paierait
 * ensuite en note fausse.
 *
 * @returns {number|null} la fréquence en hertz, ou null si non voisée
 */
export function hauteurFenetre(x, deb, n, sampleRate) {
  const energie = rms(x, deb, n);
  if (energie < SEUIL_VOISEMENT) return null;

  // Retrait de la composante continue : un micro qui dérive fausserait tout.
  let moy = 0;
  for (let i = deb; i < deb + n; i++) moy += x[i];
  moy /= n;

  const lagMin = Math.floor(sampleRate / HZ_MAX);
  const lagMax = Math.min(Math.floor(sampleRate / HZ_MIN), n - 1);
  if (lagMax <= lagMin) return null;

  let r0 = 0;
  for (let i = deb; i < deb + n; i++) { const v = x[i] - moy; r0 += v * v; }
  if (r0 <= 0) return null;

  let meilleurLag = -1;
  let meilleur = 0;
  let precedent = 0;
  let montait = false;

  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    const fin = deb + n - lag;
    for (let i = deb; i < fin; i++) s += (x[i] - moy) * (x[i + lag] - moy);
    const r = s / r0;

    // On ne retient qu'un maximum local, pour éviter le lag minimal qui
    // remporterait toujours la mise sur un signal lisse.
    if (r > precedent) montait = true;
    else if (montait && r > meilleur && precedent > SEUIL_CLARTE) {
      meilleur = precedent;
      meilleurLag = lag - 1;
      montait = false;
    } else montait = false;
    precedent = r;
  }

  if (meilleurLag < 0 || meilleur < SEUIL_CLARTE) return null;

  // Interpolation parabolique : sans elle la résolution en hauteur serait
  // grossière dans les aigus, où un échantillon de lag vaut plusieurs demi-tons.
  const autour = (lag) => {
    let s = 0;
    const fin = deb + n - lag;
    for (let i = deb; i < fin; i++) s += (x[i] - moy) * (x[i + lag] - moy);
    return s / r0;
  };
  const a = autour(meilleurLag - 1), b = meilleur, c = autour(meilleurLag + 1);
  const denom = a - 2 * b + c;
  const ajust = denom !== 0 ? 0.5 * (a - c) / denom : 0;
  const lag = meilleurLag + Math.max(-1, Math.min(1, ajust));

  const hz = sampleRate / lag;
  return hz >= HZ_MIN && hz <= HZ_MAX ? hz : null;
}

/**
 * Analyse complète d'un signal : contour de hauteur, enveloppe, attaques.
 *
 * @param {Float32Array|number[]} x
 * @param {number} sampleRate
 */
export function analyser(x, sampleRate) {
  const n = Math.max(64, Math.round(FENETRE * sampleRate));
  const pas = Math.max(16, Math.round(PAS * sampleRate));
  const nEnv = Math.max(16, Math.round(FENETRE_ENV * sampleRate));
  const pasEnv = Math.max(8, Math.round(PAS_ENV * sampleRate));

  const hauteurs = [];
  for (let deb = 0; deb + n <= x.length; deb += pas) {
    hauteurs.push(hauteurFenetre(x, deb, n, sampleRate));
  }

  const enveloppe = [];
  for (let deb = 0; deb + nEnv <= x.length; deb += pasEnv) {
    enveloppe.push(rms(x, deb, nEnv));
  }

  return {
    sampleRate,
    duree: x.length / sampleRate,
    pas: pas / sampleRate,
    pasEnv: pasEnv / sampleRate,
    hauteurs,
    enveloppe,
    attaques: detecterAttaques(enveloppe, pasEnv / sampleRate),
  };
}

/**
 * Débuts de son, repérés sur la montée d'énergie.
 *
 * Le seuil est relatif à l'enveloppe elle-même : un chuchotement et un cri
 * doivent donner le même nombre d'attaques.
 */
export function detecterAttaques(env, pasSec) {
  if (env.length < 2) return [];
  const max = Math.max(...env);
  if (max <= 0) return [];

  /*
   * Seuil à hystérésis plutôt que détection de pic sur la dérivée.
   *
   * La dérivée se trompait des deux côtés : elle ratait la toute première
   * attaque, puisqu'il n'y a rien avant elle à quoi comparer, et elle en
   * fabriquait plusieurs sur une montée lente — un hululement qui enfle
   * produisait quatre attaques au lieu d'une. Un début de son est un
   * franchissement vers le haut après un retour au calme : c'est cela qu'on
   * mesure, et la première attaque devient un cas comme les autres.
   */
  const haut = max * 0.22;
  const bas = max * 0.11;
  const refract = Math.max(1, Math.round(0.07 / pasSec));

  const out = [];
  let arme = true;
  let dernier = -Infinity;
  for (let i = 0; i < env.length; i++) {
    if (arme && env[i] >= haut && i - dernier >= refract) {
      out.push(i);
      dernier = i;
      arme = false;
    } else if (!arme && env[i] < bas) {
      arme = true;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Comparaison                                                         */
/* ------------------------------------------------------------------ */

/** Rééchantillonne une suite vers `m` points, par interpolation linéaire. */
function reechantillonner(a, m) {
  if (a.length === 0) return new Array(m).fill(null);
  if (a.length === 1) return new Array(m).fill(a[0]);
  const out = new Array(m);
  for (let i = 0; i < m; i++) {
    const t = (i * (a.length - 1)) / (m - 1);
    const j = Math.floor(t);
    const f = t - j;
    const v0 = a[j], v1 = a[Math.min(a.length - 1, j + 1)];
    out[i] = (v0 === null || v1 === null) ? (f < 0.5 ? v0 : v1) : v0 * (1 - f) + v1 * f;
  }
  return out;
}

const HZ_EN_DEMITONS = (hz) => 12 * Math.log2(hz / 440);

/** Médiane des valeurs non nulles. */
function mediane(a) {
  const v = a.filter((x) => x !== null && Number.isFinite(x)).sort((p, q) => p - q);
  if (!v.length) return null;
  return v[Math.floor(v.length / 2)];
}

/**
 * Note de mélodie, en hauteur relative.
 *
 * Chaque contour est ramené à sa propre médiane avant comparaison : ce qui
 * compte est la forme de la ligne, pas le registre. Une voix d'enfant et une
 * voix de basse qui suivent le même dessin obtiennent la même note.
 */
export function noterMelodie(ref, prise) {
  const m = 64;
  const a = reechantillonner(ref.hauteurs, m).map((h) => (h ? HZ_EN_DEMITONS(h) : null));
  const b = reechantillonner(prise.hauteurs, m).map((h) => (h ? HZ_EN_DEMITONS(h) : null));

  const ma = mediane(a), mb = mediane(b);
  // Une référence sans hauteur (bruit, percussion) : la mélodie ne veut rien
  // dire, on la neutralise plutôt que de sanctionner au hasard.
  if (ma === null) return { note: null, couverture: 0 };
  if (mb === null) return { note: 0, couverture: 0 };

  let somme = 0, n = 0;
  for (let i = 0; i < m; i++) {
    if (a[i] === null || b[i] === null) continue;
    somme += Math.abs((a[i] - ma) - (b[i] - mb));
    n++;
  }
  const couverture = n / m;
  if (n === 0) return { note: 0, couverture: 0 };

  // Un demi-ton d'écart moyen reste excellent ; au-delà de six, c'est une
  // autre mélodie. La décroissance exponentielle évite un seuil brutal.
  const ecart = somme / n;
  const justesse = Math.exp(-ecart / 3.2);

  // Ne chanter que le quart du temps ne doit pas valoir une note pleine.
  //
  // La part attendue se mesure sur le contour RÉÉCHANTILLONNÉ, pas sur la
  // grille d'origine : comparer une couverture calculée sur 64 points à une
  // attente calculée sur cent-et-quelques donnait un rapport faussé, et un
  // signal comparé à lui-même n'obtenait pas tout à fait cent — 98 pour le
  // laser, dont peu de fenêtres sont voisées.
  const attendu = a.filter((v) => v !== null).length / m;
  const part = attendu > 0 ? Math.min(1, couverture / attendu) : 1;

  return { note: Math.round(100 * justesse * (0.45 + 0.55 * part)), couverture };
}

/** Corrélation de Pearson, bornée à [-1, 1]. */
function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  if (da <= 0 || db <= 0) return 0;
  return num / Math.sqrt(da * db);
}

/** Note de rythme : ressemblance des enveloppes d'énergie, normalisées. */
export function noterRythme(ref, prise) {
  const m = 96;
  const norm = (e) => {
    const max = Math.max(...e, 1e-9);
    return e.map((v) => v / max);
  };
  const a = reechantillonner(norm(ref.enveloppe), m);
  const b = reechantillonner(norm(prise.enveloppe), m);
  const r = correlation(a, b);
  // Une corrélation nulle vaut zéro, pas cinquante : imiter au hasard ne doit
  // pas rapporter la moitié des points.
  return { note: Math.round(100 * Math.max(0, r)), correlation: r };
}

/** Note d'attaques : un aboiement ne vaut pas trois aboiements. */
export function noterAttaques(ref, prise) {
  const na = ref.attaques.length;
  const nb = prise.attaques.length;
  if (na === 0 && nb === 0) return { note: 100, ref: 0, prise: 0 };
  if (na === 0) return { note: Math.max(0, 100 - nb * 25), ref: 0, prise: nb };

  const ecart = Math.abs(na - nb);
  // Chaque attaque manquante ou en trop coûte une fraction du total.
  const note = Math.max(0, 100 * (1 - ecart / Math.max(na, 2)));
  return { note: Math.round(note), ref: na, prise: nb };
}

/**
 * Note globale d'une imitation.
 *
 * @returns {{total:number, melodie:number|null, rythme:number, attaques:number}}
 */
export function noter(ref, prise) {
  const mel = noterMelodie(ref, prise);
  const ryt = noterRythme(ref, prise);
  const att = noterAttaques(ref, prise);

  // Référence non mélodique : on répartit son poids sur les deux autres
  // dimensions plutôt que d'attribuer des points gratuits.
  let total;
  if (mel.note === null) {
    const p = POIDS.rythme + POIDS.attaques;
    total = (ryt.note * POIDS.rythme + att.note * POIDS.attaques) / p;
  } else {
    total = (mel.note * POIDS.melodie + ryt.note * POIDS.rythme
      + att.note * POIDS.attaques) / 100;
  }

  return {
    total: Math.max(0, Math.min(100, Math.round(total))),
    melodie: mel.note,
    rythme: ryt.note,
    attaques: att.note,
    detail: { couverture: mel.couverture, correlation: ryt.correlation, nRef: att.ref, nPrise: att.prise },
  };
}
