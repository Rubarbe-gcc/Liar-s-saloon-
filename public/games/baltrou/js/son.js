/**
 * BALTROU — la musique et les bruitages (ceux du jeu d'origine).
 *
 * Une musique d'ambiance, et un thème par boss. Elle démarre au premier geste
 * (les navigateurs l'exigent), se tait quand l'onglet est caché, et le choix
 * « muet » est retenu.
 */

const DOSSIER = '/games/baltrou/sons/';
const PISTES = ['ambient', 'boss', 'boss_limace', 'boss_mur', 'boss_avare', 'boss_crane', 'boss_acharne', 'boss_silence', 'boss_miroir', 'boss_voleur', 'boss_roi'];
const BRUITS = { jouer: 'sfx_play', defausse: 'sfx_discard', caisse: 'sfx_cash', gagne: 'sfx_win', perdu: 'sfx_lose' };
const CLE = 'baltrou.muet';

let muet = false;
try { muet = localStorage.getItem(CLE) === '1'; } catch { /* ignore */ }
let voulue = 'ambient';
let piste = null;
let audio = null;
let debloque = false;

export const estMuet = () => muet;

function lancer() {
  if (muet || !debloque || document.hidden) { if (audio) audio.pause(); return; }
  if (piste !== voulue || !audio) {
    if (audio) audio.pause();
    piste = voulue;
    audio = new Audio(`${DOSSIER}${PISTES.includes(voulue) ? voulue : 'ambient'}.wav`);
    audio.loop = true;
    audio.volume = 0.35;
  }
  audio.play().catch(() => { /* pas encore permis */ });
}

/** La musique du moment : 'ambient', ou le thème d'un boss. */
export function musique(nom) {
  voulue = nom && PISTES.includes(nom) ? nom : nom && nom.startsWith('boss') ? 'boss' : 'ambient';
  lancer();
}

const reserve = {};
export function bruit(nom, volume = 0.6) {
  if (muet || !BRUITS[nom]) return;
  try {
    reserve[nom] = reserve[nom] || new Audio(`${DOSSIER}${BRUITS[nom]}.wav`);
    const a = reserve[nom].cloneNode();
    a.volume = volume;
    a.play().catch(() => {});
  } catch { /* pas de son */ }
}

/** Coupe ou remet le son. Renvoie vrai si c'est muet. */
export function basculer() {
  muet = !muet;
  try { localStorage.setItem(CLE, muet ? '1' : '0'); } catch { /* ignore */ }
  lancer();
  return muet;
}

const premier = () => { debloque = true; lancer(); };
addEventListener('pointerdown', premier, { once: true });
addEventListener('keydown', premier, { once: true });
document.addEventListener('visibilitychange', lancer);
