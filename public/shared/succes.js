/**
 * Insert Coin — le profil du joueur et ses succès, communs à toute l'arcade.
 *
 * Un pseudo et un avatar, repris par chaque jeu qui demande un nom ; et des
 * succès à débloquer dans tous les jeux. Tout reste sur l'appareil
 * (localStorage). Débloquer un succès affiche un petit bandeau doré, quel que
 * soit le jeu où l'on se trouve.
 *
 * Le profil se sauvegarde aussi EN LIGNE, sous un « code de profil » tiré au
 * hasard : un navigateur qui efface ses données, un autre téléphone, l'appli
 * installée à côté du navigateur — on y retrouve tout avec ce code. Rien ne se
 * perd : deux profils se FUSIONNENT (tous les succès des deux, chacun à sa
 * date la plus ancienne). Voir server/sauvegarde.js (`espace=profil`).
 *
 * Module de navigateur, mais sans danger hors navigateur : sans `document`
 * ni `localStorage`, il ne fait rien.
 */

const CLE = 'insertcoin.profil';

export const JEUX = {
  arcade: { nom: 'Insert Coin', glyphe: '🕹️' },
  saloon: { nom: 'Liar’s Saloon', glyphe: '🎴', url: '/games/liars-saloon/' },
  zenith: { nom: 'ZÉNITH', glyphe: '⚡', url: '/games/zenith/' },
  raid: { nom: 'RAID', glyphe: '⚔', url: '/games/raid/' },
  brasier: { nom: 'BRASIER', glyphe: '🔥', url: '/games/brasier/' },
  skullking: { nom: 'Skull King', glyphe: '💀', url: '/games/skull-king/' },
  echo: { nom: 'ÉCHO', glyphe: '🎤', url: '/games/echo/' },
};
/** Les jeux qu'il faut avoir ouverts pour le succès « Touche-à-tout ». */
const A_VISITER = Object.keys(JEUX).filter((j) => j !== 'arcade');

const s = (id, jeu, glyphe, titre, texte) => ({ id, jeu, glyphe, titre, texte });

export const SUCCES = [
  s('arcade-profil', 'arcade', '🪪', 'Une identité', 'Choisir son pseudo dans le profil.'),
  s('arcade-explorateur', 'arcade', '🧭', 'Touche-à-tout', 'Ouvrir chacun des six jeux de l’arcade.'),

  s('saloon-premiere', 'saloon', '🤠', 'Dernier assis', 'Gagner une partie de Liar’s Saloon.'),
  s('saloon-impitoyable', 'saloon', '🎩', 'Plus menteur que les menteurs', 'Gagner contre des adversaires Impitoyables.'),
  s('saloon-diable', 'saloon', '😈', 'Pacte avec le Diable', 'Gagner une partie avec la Carte du Diable.'),
  s('saloon-demasque', 'saloon', '🔍', 'L’œil du shérif', 'Démasquer un menteur.'),
  s('saloon-nerfs', 'saloon', '🔫', 'Nerfs d’acier', 'Survivre au revolver quand il ne reste qu’une chambre.'),
  s('saloon-enligne', 'saloon', '🌐', 'Roi du saloon', 'Gagner une partie en ligne.'),

  s('zenith-victoire', 'zenith', '🥊', 'Premier sang', 'Gagner un combat contre l’ordinateur.'),
  s('zenith-legende', 'zenith', '🌟', 'Plus fort que la légende', 'Battre l’ordinateur au niveau Légende.'),
  s('zenith-mi-tour', 'zenith', '🗼', 'À mi-hauteur', 'Franchir le quatrième étage de l’Ascension.'),
  s('zenith-sommet', 'zenith', '👑', 'Au Zénith', 'Vaincre le Souverain au sommet de l’Ascension.'),
  s('zenith-enligne', 'zenith', '🌐', 'Champion de l’arène', 'Gagner un combat en ligne.'),

  s('raid-chapitre', 'raid', '🗡', 'Premiers pas', 'Vaincre le boss du premier chapitre.'),
  s('raid-roi', 'raid', '👑', 'Le Roi Sans Aube', 'Terminer l’aventure.'),
  s('raid-difficile', 'raid', '🔥', 'Sans pitié', 'Terminer l’aventure en Difficile ou en Hardcore.'),
  s('raid-hardcore', 'raid', '💀', 'Une seule vie', 'Terminer l’aventure en Hardcore.'),
  s('raid-legende', 'raid', '🌟', 'Une rencontre légendaire', 'Recruter un héros légendaire.'),
  s('raid-plus', 'raid', '⭐', 'Encore une fois', 'Terminer une Partie +.'),

  s('brasier-premier', 'brasier', '🏆', 'Dernier debout', 'Finir premier d’une partie de BRASIER.'),
  s('brasier-top4', 'brasier', '🥉', 'Dans les flammes', 'Finir dans les quatre premiers.'),
  s('brasier-triple', 'brasier', '✨', 'Trois fois rien', 'Fusionner un triple doré.'),
  s('brasier-rang6', 'brasier', '⭐', 'Taverne légendaire', 'Monter sa taverne au rang 6.'),
  s('brasier-quete', 'brasier', '📜', 'Quête accomplie', 'Accomplir une quête dans une partie Quête.'),
  s('brasier-anomalie', 'brasier', '🌀', 'Maître du chaos', 'Finir dans les quatre premiers d’une partie Anomalie.'),

  s('sk-victoire', 'skullking', '💀', 'Skull King', 'Gagner une partie de Skull King.'),
  s('sk-parfait', 'skullking', '🎯', 'Parole de pirate', 'Tenir tous ses paris sur une partie entière.'),
  s('sk-zero', 'skullking', '🫥', 'Rien vu, rien pris', 'Réussir un pari de zéro à la manche 8 ou plus.'),
  s('sk-sirene', 'skullking', '🧜‍♀️', 'Le chant des sirènes', 'Capturer le Skull King avec une sirène.'),
  s('sk-custom', 'skullking', '✦', 'Cartes maison', 'Gagner une partie en mode custom.'),

  s('echo-partie', 'echo', '🎤', 'Première scène', 'Finir une partie d’ÉCHO.'),
  s('echo-victoire', 'echo', '🏅', 'La plus belle voix', 'Gagner une partie d’ÉCHO.'),
  s('echo-90', 'echo', '🎶', 'Imitation parfaite', 'Obtenir 90 / 100 ou plus à une imitation.'),
];
export const PAR_ID = Object.fromEntries(SUCCES.map((x) => [x.id, x]));

export const AVATARS = ['🙂', '😎', '🤠', '🧙', '🦊', '🐼', '🐉', '👾', '🤖', '🦄', '🐙', '🦁', '🐸', '👻', '🎃', '🌵'];

/* ------------------------------------------------------------------ */

/** Un profil propre, quoi qu'on lui donne. */
function propre(p) {
  p = p && typeof p === 'object' ? p : {};
  const succes = {};
  for (const [id, d] of Object.entries(p.succes && typeof p.succes === 'object' ? p.succes : {})) {
    if (PAR_ID[id] && Number.isFinite(Number(d))) succes[id] = Number(d);
  }
  return {
    pseudo: typeof p.pseudo === 'string' ? p.pseudo : '',
    avatar: AVATARS.includes(p.avatar) ? p.avatar : '🙂',
    succes,
    vus: Array.isArray(p.vus) ? p.vus.filter((j) => JEUX[j]) : [],
    maj: Number(p.maj) || 0,
  };
}

function lire() {
  try { return propre(JSON.parse(localStorage.getItem(CLE))); } catch { return propre(null); }
}
function ecrireLocal(p) { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch { /* ignore */ } }
function ecrire(p) { ecrireLocal(p); planifierEnvoi(); }

/** Le profil : { pseudo, avatar, succes: { id: date }, vus: [jeux ouverts] }. */
export const profil = () => lire();
export const pseudo = () => lire().pseudo;

export function definirProfil({ pseudo: nom, avatar } = {}) {
  const p = lire();
  if (typeof nom === 'string') p.pseudo = nom.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
  if (avatar && AVATARS.includes(avatar)) p.avatar = avatar;
  p.maj = Date.now();
  ecrire(p);
  if (p.pseudo) debloquer('arcade-profil');
  return p;
}

export const estDebloque = (id) => !!lire().succes[id];

/** Débloque un succès. Vrai s'il vient de l'être (et le bandeau s'affiche). */
export function debloquer(id) {
  const def = PAR_ID[id];
  if (!def) return false;
  const p = lire();
  if (p.succes[id]) return false;
  p.succes[id] = Date.now();
  ecrire(p);
  annoncer(def);
  return true;
}

/** Un jeu vient d'être ouvert : au sixième jeu différent, « Touche-à-tout ». */
export function visiter(jeu) {
  const p = lire();
  if (!JEUX[jeu] || p.vus.includes(jeu)) return;
  p.vus.push(jeu);
  ecrire(p);
  if (A_VISITER.every((j) => p.vus.includes(j))) debloquer('arcade-explorateur');
}

/** Les succès d'un jeu, débloqués ou non. */
export function succesDe(jeu) {
  const p = lire();
  return SUCCES.filter((x) => x.jeu === jeu).map((x) => ({ ...x, quand: p.succes[x.id] || null }));
}
export const total = () => ({ faits: Object.keys(lire().succes).filter((id) => PAR_ID[id]).length, tous: SUCCES.length });

/* ------------------------------------------------------------------ */
/* La sauvegarde en ligne                                              */
/* ------------------------------------------------------------------ */

const CLE_CODE = 'insertcoin.profil.code';
const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 10;
const enNavigateur = () => typeof localStorage !== 'undefined' && typeof fetch === 'function'
  && typeof location !== 'undefined' && /^https?:$/.test(location.protocol);

export const normaliserCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LONGUEUR_CODE);
export const joliCode = (c) => (c ? `${c.slice(0, 5)}-${c.slice(5)}` : '');
const codeValide = (c) => new RegExp(`^[${ALPHABET_CODE}]{${LONGUEUR_CODE}}$`).test(c);

/** Le code de profil de cet appareil : tiré au hasard la première fois, puis gardé. */
export function codeProfil() {
  let c = null;
  try { c = localStorage.getItem(CLE_CODE); } catch { /* ignore */ }
  if (c && codeValide(c)) return c;
  const o = new Uint32Array(LONGUEUR_CODE);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(o);
  else for (let i = 0; i < o.length; i++) o[i] = Math.floor(Math.random() * 2 ** 32);
  c = [...o].map((n) => ALPHABET_CODE[n % ALPHABET_CODE.length]).join('');
  try { localStorage.setItem(CLE_CODE, c); } catch { /* ignore */ }
  return c;
}

/**
 * Deux profils n'en font qu'un, sans rien perdre : tous les succès des deux
 * (à la date la plus ancienne), tous les jeux ouverts ; le pseudo et l'avatar
 * du plus récemment modifié.
 */
export function fusionner(a, b) {
  a = propre(a); b = propre(b);
  const succes = { ...a.succes };
  for (const [id, d] of Object.entries(b.succes)) if (!succes[id] || d < succes[id]) succes[id] = d;
  const recent = b.maj > a.maj ? b : a;
  const autre = recent === a ? b : a;
  return {
    pseudo: recent.pseudo || autre.pseudo,
    avatar: recent.maj || !autre.maj ? recent.avatar : autre.avatar,
    succes,
    vus: [...new Set([...a.vus, ...b.vus])],
    maj: Math.max(a.maj, b.maj),
  };
}

const memeProfil = (a, b) => JSON.stringify(propre(a)) === JSON.stringify(propre(b));

async function appeler(url, options) {
  try {
    const r = await fetch(url, { cache: 'no-store', ...options });
    let json = null;
    try { json = await r.json(); } catch { /* vide */ }
    return { ok: r.ok, statut: r.status, json };
  } catch {
    return { ok: false, statut: 0, json: null };
  }
}

let envoi = 0;
let enCours = null;
function planifierEnvoi() {
  if (!enNavigateur()) return;
  clearTimeout(envoi);
  envoi = setTimeout(() => { synchroniser(); }, 1500);
}

/**
 * Synchronise le profil avec sa sauvegarde en ligne : on lit ce qui est en
 * ligne, on fusionne avec ce qui est ici, et on range le résultat des deux
 * côtés. Renvoie `{ ok, change, vide, indisponible, hors }`.
 */
export function synchroniser() {
  if (!enNavigateur()) return Promise.resolve({ ok: false, hors: true });
  if (enCours) return enCours;
  enCours = (async () => {
    const code = codeProfil();
    const r = await appeler(`/api/sauvegarde?espace=profil&cle=${code}`);
    if (r.statut === 503) return { ok: false, indisponible: true };
    if (!r.ok && r.statut !== 404) return { ok: false, hors: r.statut === 0 };
    let distant = null;
    if (r.ok && r.json && typeof r.json.charge === 'string') { try { distant = JSON.parse(r.json.charge); } catch { /* illisible */ } }
    const ici = lire();
    const tout = distant ? fusionner(ici, distant) : ici;
    const change = !memeProfil(tout, ici);
    if (change) {
      ecrireLocal(tout);
      if (typeof dispatchEvent === 'function') dispatchEvent(new Event('insertcoin:profil'));
    }
    if (!distant || !memeProfil(tout, distant)) {
      const date = Math.max(Date.now(), (r.json && Number(r.json.date) + 1) || 0);
      await appeler('/api/sauvegarde', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ espace: 'profil', cle: code, charge: JSON.stringify(tout), date }),
      });
    }
    return { ok: true, change, vide: !distant };
  })().finally(() => { enCours = null; });
  return enCours;
}

/**
 * Récupère un profil avec son code (venu d'un autre appareil, ou d'avant un
 * effacement). Ce qui a été gagné ici ne se perd pas : il s'y ajoute, et cet
 * appareil prend ce code. Renvoie `{ ok, msg }`.
 */
export async function recuperer(saisi) {
  const code = normaliserCode(saisi);
  if (!codeValide(code)) return { ok: false, msg: `Le code fait ${LONGUEUR_CODE} caractères (lettres et chiffres).` };
  if (!enNavigateur()) return { ok: false, msg: 'Pas de connexion.' };
  const r = await appeler(`/api/sauvegarde?espace=profil&cle=${code}`);
  if (r.statut === 404) return { ok: false, msg: 'Aucun profil sous ce code.' };
  if (r.statut === 503) return { ok: false, msg: 'La sauvegarde en ligne n’est pas activée sur ce site.' };
  if (!r.ok) return { ok: false, msg: 'Pas de connexion. Réessayez dans un instant.' };
  try { localStorage.setItem(CLE_CODE, code); } catch { /* ignore */ }
  await synchroniser();
  return { ok: true, msg: 'Profil récupéré !' };
}

// À l'ouverture de chaque page : on se met à jour avec la sauvegarde en ligne.
if (enNavigateur()) {
  setTimeout(() => { synchroniser(); }, 600);
  // Et, sur les appareils qui le permettent, on demande à garder les données pour de bon.
  try { navigator.storage?.persist?.(); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Le bandeau « Succès débloqué »                                      */
/* ------------------------------------------------------------------ */

const file = [];
let affiche = false;

function annoncer(def) {
  if (typeof document === 'undefined') return;
  file.push(def);
  if (!affiche) suivant();
}

function suivant() {
  const def = file.shift();
  if (!def) { affiche = false; return; }
  affiche = true;
  const b = document.createElement('div');
  b.setAttribute('role', 'status');
  b.style.cssText = 'position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));z-index:9999;'
    + 'transform:translate(-50%,-140%);transition:transform .45s cubic-bezier(.2,.9,.3,1.2);display:flex;align-items:center;gap:12px;'
    + 'max-width:calc(100% - 24px);padding:10px 16px 10px 12px;border-radius:16px;color:#2a1a02;'
    + 'background:linear-gradient(180deg,#fff2c0,#f3c95a 55%,#d99a22);border:1px solid #fff6d6;'
    + 'box-shadow:0 12px 30px rgba(0,0,0,.5),0 0 24px rgba(243,201,90,.45);font:600 14px/1.25 system-ui,-apple-system,sans-serif;pointer-events:none';
  b.innerHTML = `<span style="font-size:28px;line-height:1">${def.glyphe}</span>`
    + `<span><span style="display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.75">🏆 Succès débloqué</span>`
    + `<b style="font-size:15px">${def.titre}</b></span>`;
  document.body.appendChild(b);
  requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transform = 'translate(-50%,0)'; }));
  setTimeout(() => {
    b.style.transform = 'translate(-50%,-140%)';
    setTimeout(() => { b.remove(); suivant(); }, 500);
  }, 3600);
}
