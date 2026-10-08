/**
 * STREET COMBAT — la sauvegarde en ligne.
 *
 * Module ISO : ce qui se range (les combattants débloqués, les rencontres,
 * le Codex, les records, les trois sauvegardes de l'histoire, les défis de
 * combos, le tournoi et la tour en cours) et comment deux appareils se
 * mettent d'accord sans rien perdre :
 *   • ce qui se gagne s'additionne (débloqués, rencontres, Codex, défis) ;
 *   • les records gardent le meilleur ;
 *   • chaque emplacement d'histoire garde la partie jouée le plus récemment ;
 *   • une remise à zéro (« Réinitialiser ») efface aussi ce que l'autre
 *     appareil avait gagné AVANT elle — sinon tout reviendrait.
 *
 * Le transport (le code de profil de l'arcade, /api/sauvegarde, espace
 * « street ») est dans games/street-combat/js/main.js.
 */

/** Les clés de localStorage qui voyagent, et leur nom dans la sauvegarde. */
export const CLES = {
  debloques: 'street.debloques',
  croises: 'street.croises',
  codex: 'street.codex',
  codexScenes: 'street.codex.scenes',
  records: 'street.records',
  sauvegardes: 'street.sauvegardes',
  defis: 'street.defis',
  tournoi: 'street.tournoi',
  tour: 'street.tour',
};
export const CLE_MAJ = 'street.nuage.maj';
export const CLE_REMISE = 'street.nuage.remise';
const ENSEMBLES = ['debloques', 'croises', 'codex', 'codexScenes'];
const EMPLACEMENTS = 3;

/** Une sauvegarde bien formée, quoi qu'on lui donne. */
export function propre(d) {
  const x = d && typeof d === 'object' ? d : {};
  const liste = (v) => (Array.isArray(v) ? v.filter((e) => typeof e === 'string') : []);
  const out = {
    records: x.records && typeof x.records === 'object' ? x.records : {},
    sauvegardes: Array.from({ length: EMPLACEMENTS }, (_, k) => (Array.isArray(x.sauvegardes) && x.sauvegardes[k] && typeof x.sauvegardes[k] === 'object' ? x.sauvegardes[k] : null)),
    defis: x.defis && typeof x.defis === 'object' ? x.defis : {},
    tournoi: x.tournoi ?? null,
    tour: x.tour ?? null,
    maj: Number(x.maj) || 0,
    remise: Number(x.remise) || 0,
  };
  for (const k of ENSEMBLES) out[k] = liste(x[k]);
  return out;
}

const vide = (remise, maj) => ({ ...propre({}), remise, maj });

/** Deux sauvegardes n'en font qu'une, sans rien perdre (sauf ce qu'une remise à zéro a effacé). */
export function fusionner(a, b) {
  a = propre(a);
  b = propre(b);
  // Une remise à zéro plus récente que tout ce qu'un côté a gagné : ce côté repart de rien.
  const remise = Math.max(a.remise, b.remise);
  if (a.maj < remise) a = vide(remise, a.maj);
  if (b.maj < remise) b = vide(remise, b.maj);
  // Triées : la même fusion, quel que soit l'appareil qui la fait.
  const union = (x, y) => [...new Set([...x, ...y])].sort((p, q) => (typeof p === 'number' ? p - q : String(p).localeCompare(String(q))));
  const out = { remise, maj: Math.max(a.maj, b.maj) };
  for (const k of ENSEMBLES) out[k] = union(a[k], b[k]);
  out.records = {};
  for (const k of [...new Set([...Object.keys(a.records), ...Object.keys(b.records)])].sort()) {
    out.records[k] = Math.max(Number(a.records[k]) || 0, Number(b.records[k]) || 0);
  }
  out.sauvegardes = a.sauvegardes.map((x, k) => {
    const y = b.sauvegardes[k];
    if (!x) return y;
    if (!y) return x;
    return (Number(y.maj) || 0) > (Number(x.maj) || 0) ? y : x;
  });
  out.defis = {};
  for (const id of [...new Set([...Object.keys(a.defis), ...Object.keys(b.defis)])].sort()) {
    out.defis[id] = union(a.defis[id] || [], b.defis[id] || []);
  }
  // Un tournoi, une tour en cours : ceux de l'appareil le plus récent.
  const recent = b.maj > a.maj ? b : a;
  const autre = recent === a ? b : a;
  out.tournoi = recent.tournoi ?? autre.tournoi ?? null;
  out.tour = recent.tour ?? autre.tour ?? null;
  return out;
}

/** Lit tout ce qui voyage, depuis un stockage (localStorage). */
export function lireTout(st) {
  const lire = (cle) => { try { return JSON.parse(st.getItem(cle)); } catch { return null; } };
  const d = {};
  for (const [nom, cle] of Object.entries(CLES)) d[nom] = lire(cle);
  d.maj = Number(lire(CLE_MAJ)) || 0;
  d.remise = Number(lire(CLE_REMISE)) || 0;
  return propre(d);
}

/** Écrit tout ce qui voyage dans un stockage. */
export function ecrireTout(st, d) {
  d = propre(d);
  for (const [nom, cle] of Object.entries(CLES)) {
    const v = d[nom];
    const videV = v == null || (Array.isArray(v) && !v.length) || (nom === 'sauvegardes' && v.every((x) => !x)) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    try { if (videV) st.removeItem(cle); else st.setItem(cle, JSON.stringify(v)); } catch { /* plein */ }
  }
  try { st.setItem(CLE_MAJ, JSON.stringify(d.maj)); st.setItem(CLE_REMISE, JSON.stringify(d.remise)); } catch { /* plein */ }
}

/** Deux sauvegardes identiques ? (pour ne rien écrire pour rien) */
export const memes = (a, b) => JSON.stringify(propre(a)) === JSON.stringify(propre(b));
