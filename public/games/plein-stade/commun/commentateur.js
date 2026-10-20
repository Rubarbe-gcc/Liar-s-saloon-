/**
 * PLEIN STADE — les commentateurs, communs à tous les sports.
 *
 * Deux voix qui se répondent : le commentateur (il suit l'action) et le
 * consultant (il analyse). La voix est celle du navigateur (synthèse vocale) :
 * on prend la voix française la plus naturelle qu'il propose (les voix
 * « Natural » d'Edge et de Windows, Google, Amélie ou Thomas sur iPhone).
 * Le texte s'affiche aussi, en bas de l'écran.
 *
 * Règles : jamais deux phrases l'une sur l'autre (une phrase banale attend son
 * tour, ou saute si on est en retard) ; un temps fort (un but) coupe la phrase
 * en cours ; la même phrase ne revient pas deux fois de suite. Chaque sport
 * fournit ses phrases (foot/js/commentaires.js…).
 */

import { estMuet } from './son.js';

const CLE = 'pleinstade.commentaires';
/** 'voix' (voix et texte), 'texte' ou 'aucun'. */
export let reglage = 'voix';
try { reglage = localStorage.getItem(CLE) || 'voix'; } catch { /* ignore */ }
export function regler(v) {
  reglage = v;
  try { localStorage.setItem(CLE, v); } catch { /* ignore */ }
  if (v !== 'voix') window.speechSynthesis?.cancel();
}
export const REGLAGES = [['voix', 'Commentaires : voix'], ['texte', 'Commentaires : texte'], ['aucun', 'Sans commentaires']];

/* ---------------- Les voix ---------------- */

function score(v) {
  const n = v.name;
  let s = 0;
  if (/natural/i.test(n)) s += 6;
  if (/neural|premium|enhanced|amélioré/i.test(n)) s += 4;
  if (/online/i.test(n)) s += 2;
  if (/google/i.test(n)) s += 2;
  if (/^fr[-_]FR/i.test(v.lang)) s += 1;
  return s;
}
/** Les voix françaises, de la plus naturelle à la moins naturelle. */
export function voixFrancaises() {
  const s = window.speechSynthesis;
  if (!s) return [];
  return s.getVoices().filter((v) => /^fr([-_]|$)/i.test(v.lang)).sort((a, b) => score(b) - score(a));
}
/** Y a-t-il une voix française ? (sinon, on reste au texte) */
export const voixDisponible = () => voixFrancaises().length > 0;
// Les voix arrivent parfois après le chargement de la page.
try { window.speechSynthesis?.addEventListener?.('voiceschanged', () => {}); window.speechSynthesis?.getVoices(); } catch { /* ignore */ }

/* ---------------- La vraie voix (répliques enregistrées) ---------------- */

/**
 * Les répliques enregistrées avec la voix du commentateur (ElevenLabs, voir
 * scripts/generer-voix.mjs) : par famille (« but » → but_1, but_2…). Quand il y
 * en a, c'est elles qu'on entend sur les temps forts, et le reste ne passe qu'en
 * texte (on ne mélange pas cette voix avec la synthèse du navigateur).
 */
const familles = new Map();
let voixChargee = false;
/** Ce que dit chaque réplique enregistrée (pour l'afficher mot pour mot). */
const textes = new Map();
for (const fichier of ['lignes.json', 'consultant.json', 'direct.json', 'analyse.json']) fetch(new URL('./voix/' + fichier, import.meta.url)).then((r) => (r.ok ? r.json() : { lignes: [] })).then((j) => {
  for (const l of j.lignes) textes.set(new URL('./voix/' + l.id + '.mp3', import.meta.url).href, l.texte);
}).catch(() => {});
fetch(new URL('./voix/liste.json', import.meta.url)).then((r) => (r.ok ? r.json() : [])).then((ids) => {
  for (const id of ids) {
    const fam = id.replace(/_\d+$/, '');
    if (!familles.has(fam)) familles.set(fam, []);
    familles.get(fam).push(new URL(`./voix/${id}.mp3`, import.meta.url).href);
  }
  voixChargee = familles.size > 0;
}).catch(() => {});
/** Y a-t-il des répliques enregistrées ? */
export const vraieVoix = () => voixChargee;

/* ---------------- Le commentateur ---------------- */

/**
 * @param {{ el: HTMLElement, noms?: { comm: string, cons: string }, texteSeul?: boolean }} o
 *   texteSeul : jamais de voix (ni enregistrée ni synthèse), pour un sport qui n'a pas encore les siennes.
 * @returns {{ dire(texte, { role, important, emotion, apres }), choisir(cle, liste), arreter() }}
 */
export function creerCommentateur({ el, noms = { comm: 'Commentateur', cons: 'Consultant' }, texteSeul = false }) {
  let minuteur = 0, parle = false, file = [], derniereFin = 0, son = null, enCours = null, lecture = 0;
  const derniersClips = new Map();
  /** Une réplique enregistrée de cette famille (pas la même que la dernière fois). */
  function clipPour(fam) {
    const l = familles.get(fam);
    if (!l || !l.length) return null;
    let k = Math.floor(Math.random() * l.length);
    if (l.length > 1 && k === derniersClips.get(fam)) k = (k + 1) % l.length;
    derniersClips.set(fam, k);
    return l[k];
  }
  const dernieres = new Map();

  function voixPour(role) {
    const vs = voixFrancaises();
    if (!vs.length) return null;
    if (role === 'cons') return vs.find((v) => v !== vs[0] && v.name.split(' ')[0] !== vs[0].name.split(' ')[0]) || vs[1] || vs[0];
    return vs[0];
  }

  function afficher(texte, role, important) {
    el.innerHTML = `<span class="micro" aria-hidden="true">${role === 'cons' ? '🎧' : '🎙️'}</span><i>${role === 'cons' ? noms.cons : noms.comm}</i> ${texte}`;
    el.classList.toggle('cons', role === 'cons');
    el.classList.remove('montre');
    void el.offsetWidth;
    el.classList.add('montre');
    clearTimeout(minuteur);
    minuteur = setTimeout(() => el.classList.remove('montre'), important ? 4500 : 3200);
  }

  /** Coupe ce qui se dit (voix, synthèse ou texte qu'on laisse lire). */
  function couper() {
    window.speechSynthesis?.cancel();
    if (son) { son.onended = son.onerror = null; son.pause(); son = null; }
    clearTimeout(lecture);
    parle = false; enCours = null;
  }

  function lire(item) {
    enCours = item;
    const clipChoisi = reglage === 'voix' && !texteSeul && !estMuet() && item.clip ? clipPour(item.clip) : null;
    // Avec la vraie voix, on affiche exactement ce qu'elle dit.
    afficher(clipChoisi && textes.get(clipChoisi) ? textes.get(clipChoisi) : item.texte, item.role, item.important);
    const fini = () => { parle = false; son = null; enCours = null; derniereFin = performance.now(); setTimeout(suite, 180); };
    // La vraie voix : la réplique enregistrée de ce moment.
    const clip = clipChoisi;
    if (clip) {
      son = new Audio(clip);
      son.volume = 1;
      parle = true;
      son.onended = son.onerror = fini;
      son.play().catch(fini);
      return;
    }
    // Le texte seulement (pas de réplique enregistrée pour ce moment-là, ou pas de voix) :
    // on laisse le temps de le lire avant la phrase suivante.
    const s = window.speechSynthesis;
    const v = voixPour(item.role);
    if (texteSeul || voixChargee || reglage !== 'voix' || estMuet() || !s || !v) {
      parle = true;
      lecture = setTimeout(fini, Math.min(2600, 800 + item.texte.replace(/<[^>]+>/g, '').length * 30));
      return;
    }
    const u = new SpeechSynthesisUtterance(item.texte.replace(/<[^>]+>/g, ''));
    u.voice = v; u.lang = v.lang;
    const e = item.emotion ?? (item.important ? 0.8 : 0.3);
    // Le consultant parle plus posément ; l'émotion fait monter le ton et le débit.
    u.rate = item.role === 'cons' ? 1.0 + e * 0.08 : 1.04 + e * 0.2;
    u.pitch = (item.role === 'cons' ? 0.9 : 1.0) + e * 0.18;
    u.volume = 1;
    parle = true;
    u.onend = u.onerror = () => { parle = false; derniereFin = performance.now(); setTimeout(suite, 180); };
    s.speak(u);
  }

  function suite() {
    // Une phrase d'action qui a trop attendu ne veut plus rien dire : on passe.
    while (file.length && file[0].frais && performance.now() - file[0].t > 1500) file.shift();
    if (parle || !file.length) return;
    lire(file.shift());
  }

  return {
    /**
     * Dit une phrase. role : 'comm' ou 'cons' ; important : coupe la phrase en cours ;
     * emotion : de 0 à 1 ; apres : une réplique du consultant à enchaîner ;
     * frais : une phrase du direct (passe, récupération…), elle ne vaut que sur le
     * moment, la plus récente remplace celle qui attend ; coupe : elle coupe une
     * phrase du direct en cours (un tir coupe « il avance avec le ballon »).
     */
    dire(texte, { role = 'comm', important = false, emotion, apres = null, apresClip = null, clip = null, frais = false, coupe = false } = {}) {
      if (reglage === 'aucun' || !texte) return;
      const item = { texte, role, important, emotion, clip, frais, t: performance.now() };
      // La réplique du consultant : sa vraie voix aussi, s'il a une phrase enregistrée pour ce moment.
      const suites = apres ? [{ texte: apres, role: 'cons', important: false, emotion: 0.3, clip: apresClip }] : [];
      if (important || (coupe && enCours?.frais && enCours.clip !== clip)) {
        couper();
        file = suites;
        lire(item);
        return;
      }
      // En retard (quelqu'un parle et il y a déjà une phrase qui attend) : on laisse tomber celle-ci.
      if (parle || file.length || performance.now() - derniereFin < 300) {
        if (file.length < 1 || (frais && file.every((x) => x.frais))) file = [item, ...suites];
        return;
      }
      file.push(...suites);
      lire(item);
    },
    /** Une phrase de la liste, jamais la même que la dernière fois pour cette clé. */
    choisir(cle, liste) {
      if (liste.length === 1) return liste[0];
      let k;
      do k = Math.floor(Math.random() * liste.length); while (k === dernieres.get(cle));
      dernieres.set(cle, k);
      return liste[k];
    },
    /** Personne ne parle, rien n'attend, et le silence dure depuis ms millisecondes. */
    libre: (ms = 0) => !parle && !file.length && performance.now() - derniereFin >= ms,
    arreter() {
      clearTimeout(minuteur);
      file = [];
      couper();
      el.classList.remove('montre');
    },
  };
}
