/**
 * STREET COMBAT — les voix.
 *
 * Chaque combattant parle avec sa voix : homme ou femme, plus ou moins
 * grave, plus ou moins rapide. La voix suit l'intonation du texte : un « ! »
 * monte et accélère, une phrase EN MAJUSCULES est criée, « … » ralentit et
 * descend, une phrase (entre parenthèses) se chuchote, et un combattant
 * corrompu par la Fracture parle d'une voix déformée, plus grave.
 *
 * On se sert de la synthèse vocale du navigateur (Web Speech), en prenant
 * d'abord ses voix les plus naturelles (« Google », « Natural », « Online »,
 * « Premium »…), et en restant près de leur hauteur naturelle : chacun a sa
 * couleur sans qu'aucune voix ne sonne déformée ou robotique. Sans voix
 * française, les combattants se taisent. Les voix se coupent avec le son, ou à part.
 */

import { estMuet } from './son.js';

// Les voix des navigateurs restent robotiques : elles sont coupées tant qu'on ne les active pas.
const CLE = 'street.voix.v2';
let actives = (() => { try { return localStorage.getItem(CLE) === 'oui'; } catch { return false; } })();
export const voixActives = () => actives;
export function basculerVoix() {
  actives = !actives;
  try { localStorage.setItem(CLE, actives ? 'oui' : 'non'); } catch { /* ignore */ }
  if (!actives) taire();
  return actives;
}

/*
 * Les voix de chacun : genre ('h' ou 'f'), hauteur (1 : normale), vitesse
 * (1 : normale). On reste près du naturel : voir `dire`.
 */
export const VOIX = {
  narrateur: { genre: 'h', hauteur: 0.8, vitesse: 0.92 },
  annonceur: { genre: 'h', hauteur: 0.6, vitesse: 0.95 },
  ryuken: { genre: 'h', hauteur: 1.0, vitesse: 1.05 },
  blazero: { genre: 'h', hauteur: 1.15, vitesse: 1.2 },
  frostbyte: { genre: 'h', hauteur: 0.85, vitesse: 0.9 },
  shadowkira: { genre: 'f', hauteur: 0.9, vitesse: 0.95 },
  thunderox: { genre: 'h', hauteur: 0.75, vitesse: 1.15 },
  ironclad: { genre: 'h', hauteur: 0.55, vitesse: 0.9 },
  serpenta: { genre: 'f', hauteur: 1.1, vitesse: 0.88 },
  gravox: { genre: 'h', hauteur: 0.6, vitesse: 0.85 },
  lunara: { genre: 'f', hauteur: 1.05, vitesse: 0.85 },
  pyroclaw: { genre: 'h', hauteur: 0.4, vitesse: 1.1 },
  wraithblade: { genre: 'h', hauteur: 0.7, vitesse: 0.85 },
  celestia: { genre: 'f', hauteur: 1.3, vitesse: 1.05 },
  stoneback: { genre: 'h', hauteur: 0.35, vitesse: 0.8 },
  stormwing: { genre: 'h', hauteur: 0.95, vitesse: 1.05 },
  voidreaper: { genre: 'h', hauteur: 0.3, vitesse: 0.8 },
  aquathorn: { genre: 'h', hauteur: 0.7, vitesse: 0.92 },
  solarius: { genre: 'h', hauteur: 0.9, vitesse: 0.88 },
  malvortex: { genre: 'h', hauteur: 0.3, vitesse: 0.82 },
  lechaos: { genre: 'h', hauteur: 0.2, vitesse: 0.7 },
  kairos: { genre: 'h', hauteur: 0.75, vitesse: 0.82 },
  onyx: { genre: 'h', hauteur: 0.65, vitesse: 1.05 },
  nemesis: { genre: 'h', hauteur: 0.95, vitesse: 0.9 },
  vorn: { genre: 'h', hauteur: 0.5, vitesse: 0.9 },
  sablia: { genre: 'f', hauteur: 1.0, vitesse: 0.92 },
  eclipse: { genre: 'f', hauteur: 1.35, vitesse: 1.08 },
  soldat: { genre: 'h', hauteur: 0.6, vitesse: 1.1 },
  sentinelle: { genre: 'h', hauteur: 0.35, vitesse: 0.9 },
  chasseur: { genre: 'h', hauteur: 0.85, vitesse: 1.15 },
};
/** La voix d'un combattant (le héros créé porte la sienne). */
export const voixDe = (p) => (p?.voix || VOIX[p?.id] || { genre: 'h', hauteur: 1, vitesse: 1 });
/** Le genre d'un combattant, pour accorder les phrases (« tu es fort », « tu es forte »). */
export const genreDe = (p) => p?.genre || voixDe(p).genre;

/* ------------------------------------------------------------------ */
/* Les voix du navigateur                                              */
/* ------------------------------------------------------------------ */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const HOMMES = /paul|henri|thomas|claude|r[eé]my|nicolas|antoine|jean|louis|mathieu|daniel|guillaume|fabrice|g[eé]rard|j[eé]r[oô]me|alain|fr[eé]d[eé]ric|s[eé]bastien|olivier|yves|bernard|christophe|vincent|f[eé]lix|jules|hugo|male|homme/i;
const FEMMES = /hortense|julie|denise|[eé]lo[iï]se|vivienne|am[eé]lie|audrey|aur[eé]lie|marie|c[eé]line|chantal|sylvie|brigitte|sophie|l[eé]a|virginie|jos[eé]phine|charline|coralie|ariane|caroline|google|female|femme/i;
let voixFr = [];
function chargerVoix() {
  if (!synth) return;
  voixFr = synth.getVoices().filter((v) => /^fr/i.test(v.lang));
}
if (synth) { chargerVoix(); synth.addEventListener?.('voiceschanged', chargerVoix); }

/** Les voix les plus naturelles (les autres sonnent vite robotiques). */
const NATURELLE = /natural|naturel|online|neural|premium|enhanced|am[eé]lior|google|siri/i;
const genreVoix = (v) => (HOMMES.test(v.name) ? 'h' : FEMMES.test(v.name) ? 'f' : null);

/**
 * La meilleure voix française pour ce genre : une voix naturelle d'abord,
 * du bon genre si possible. Si la seule voix naturelle est de l'autre genre,
 * on la prend quand même, un peu plus grave ou plus aiguë.
 */
export function choisirVoix(genre, voix = voixFr) {
  const notes = voix.map((v) => ({
    v,
    g: genreVoix(v),
    note: (NATURELLE.test(v.name) ? 10 : 0) + (genreVoix(v) === genre ? 4 : 0) + (/fr-FR/i.test(v.lang) ? 1 : 0) + (v.localService === false ? 1 : 0),
  })).sort((a, b) => b.note - a.note);
  const meilleure = notes[0];
  if (!meilleure) return { voix: null, correction: 1 };
  const naturelle = NATURELLE.test(meilleure.v.name);
  const correction = meilleure.g && meilleure.g !== genre ? (genre === 'f' ? 1.18 : 0.84) : 1;
  return { voix: meilleure.v, correction, naturelle };
}

/** La hauteur et la vitesse envoyées à la voix : près du naturel, jamais déformées. */
export const hauteurNaturelle = (h) => Math.max(0.72, Math.min(1.32, 1 + (h - 1) * 0.45));
export const vitesseNaturelle = (v) => Math.max(0.82, Math.min(1.25, 1 + (v - 1) * 0.7));

/* ------------------------------------------------------------------ */
/* L'intonation                                                        */
/* ------------------------------------------------------------------ */

/** Découpe une réplique en morceaux, chacun avec son ton. */
export function intonations(texte) {
  const morceaux = [];
  // Le chuchotement : ce qui est entre parenthèses.
  const parties = String(texte).split(/(\([^)]*\))/);
  for (const partie of parties) {
    if (!partie.trim()) continue;
    const chuchote = /^\(.*\)$/.test(partie.trim());
    const phrases = partie.replace(/[()]/g, '').match(/[^.!?…]+(?:[.!?…]+|$)/g) || [];
    for (const brut of phrases) {
      const sans = brut.replace(/[«»"“”]/g, '').replace(/\p{Extended_Pictographic}/gu, '').trim();
      if (!sans) continue;
      const lettres = sans.replace(/[^A-Za-zÀ-ÿ]/g, '');
      const cri = lettres.length >= 4 && lettres === lettres.toUpperCase();
      const fin = (sans.match(/[.!?…]+$/) || [''])[0];
      // Un mot en majuscules au milieu d'une phrase : on appuie dessus (sans l'épeler).
      const motsCries = /(?<!\p{L})\p{Lu}{3,}(?!\p{L})/gu;
      const emphase = !cri && /(?<!\p{L})\p{Lu}{3,}(?!\p{L})/u.test(sans);
      morceaux.push({
        texte: cri ? sans.toLowerCase() : sans.replace(motsCries, (w) => w.toLowerCase()),
        emphase,
        cri,
        chuchote,
        exclamation: fin.includes('!'),
        question: fin.includes('?'),
        suspens: fin.includes('…') || fin.includes('...'),
      });
    }
  }
  return morceaux;
}

/** La hauteur, la vitesse et le volume d'un morceau, selon la voix et le ton. */
export function reglage(m, voix, { corrompu = false } = {}) {
  let hauteur = voix.hauteur;
  let vitesse = voix.vitesse;
  let volume = voix.volume ?? 1;
  if (m.cri) { hauteur += 0.25; vitesse += 0.12; }
  if (m.emphase) { hauteur += 0.08; vitesse += 0.05; }
  if (m.exclamation) { hauteur += 0.12; vitesse += 0.06; }
  if (m.question) hauteur += 0.08;
  if (m.suspens) { hauteur -= 0.06; vitesse -= 0.15; }
  if (m.chuchote) { volume *= 0.55; vitesse -= 0.1; }
  if (corrompu) { hauteur -= 0.3; vitesse -= 0.06; }
  return {
    hauteur: Math.max(0.1, Math.min(2, hauteur)),
    vitesse: Math.max(0.5, Math.min(1.7, vitesse)),
    volume: Math.max(0.1, Math.min(1, volume)),
  };
}

/* ------------------------------------------------------------------ */
/* Parler                                                              */
/* ------------------------------------------------------------------ */

/** Dit une réplique avec la voix et l'état (corrompu…) donnés. Coupe ce qui se disait. */
export function dire(texte, voix, etat = {}, { force = false } = {}) {
  taire();
  if ((!actives && !force) || estMuet() || !texte) return;
  const morceaux = intonations(texte);
  if (!morceaux.length) return;
  if (!synth || !voixFr.length) return;
  const { voix: v, correction, naturelle } = choisirVoix(voix.genre);
  for (const m of morceaux) {
    const r = reglage(m, voix, etat);
    const u = new SpeechSynthesisUtterance(m.texte);
    u.lang = v?.lang || 'fr-FR';
    if (v) u.voice = v;
    // Une vieille voix (pas « naturelle ») se déforme dès qu'on la pousse : on n'y touche presque pas.
    const doux = naturelle ? 1 : 0.25;
    u.pitch = 1 + (hauteurNaturelle(r.hauteur * correction) - 1) * doux;
    u.rate = 1 + (vitesseNaturelle(r.vitesse) - 1) * (naturelle ? 1 : 0.5);
    u.volume = r.volume;
    synth.speak(u);
  }
}

/** Un cri de combat (le nom d'une technique) : court, fort. */
export function crier(texte, voix) {
  dire(`${String(texte).replace(/!+$/, '')} !`, { ...voix, vitesse: (voix.vitesse || 1) + 0.1 });
}

export function taire() {
  if (synth && (synth.speaking || synth.pending)) synth.cancel();
}

/** Parle-t-on encore ? (une cinématique attend la fin de la phrase avant de passer toute seule) */
export const parleEncore = () => !!(synth && (synth.speaking || synth.pending));
