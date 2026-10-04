/**
 * Insert Coin — revenir dans une partie en ligne après une coupure.
 *
 * Le serveur garde la place d'un joueur cinq minutes après une coupure en
 * pleine partie (server/hub.js). Pour la reprendre, il faut lui présenter la
 * même clé de session. Ce module la tient :
 *
 *   • pendant la vie de l'onglet, dans sessionStorage — recharger la page ou
 *     perdre le réseau un instant, on revient avec la même clé ;
 *   • au-delà, dans localStorage, avec l'heure du dernier signe de vie — si
 *     l'application a été fermée, on la rouvre et on retrouve sa table, tant
 *     que les cinq minutes ne sont pas écoulées.
 *
 * Deux onglets ouverts en même temps restent deux joueurs : une clé n'est
 * adoptée par un nouvel onglet que si l'ancien ne donne plus signe de vie.
 *
 * Module de navigateur.
 */

export const DELAI = 5 * 60 * 1000;
/** Un onglet vivant se signale au moins aussi souvent. */
const SIGNE_DE_VIE = 40 * 1000;

const cleSession = (jeu) => `insertcoin.session.${jeu}`;
const cleReprise = (jeu) => `insertcoin.reprise.${jeu}`;

const neuve = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '')
  : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`);

function lire(cle) { try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; } }
function ecrire(cle, v) { try { if (v) localStorage.setItem(cle, JSON.stringify(v)); else localStorage.removeItem(cle); } catch { /* ignore */ } }

let memoire = {};

/** La clé de session de cet onglet, pour ce jeu. */
export function session(jeu) {
  try {
    let s = sessionStorage.getItem(cleSession(jeu));
    if (!s) { s = neuve(); sessionStorage.setItem(cleSession(jeu), s); }
    return s;
  } catch {
    return (memoire[jeu] = memoire[jeu] || neuve());
  }
}

/*
 * Les parties en cours de cet appareil, par clé de session : deux onglets
 * peuvent en tenir chacun une.  { [sid]: { at, vivant, code } }
 */
function parties(jeu) {
  const toutes = lire(cleReprise(jeu));
  const out = {};
  if (!toutes || typeof toutes !== 'object') return out;
  for (const [sid, r] of Object.entries(toutes)) {
    if (r && Date.now() - r.at <= DELAI) out[sid] = r;
  }
  return out;
}
const ranger = (jeu, toutes) => ecrire(cleReprise(jeu), Object.keys(toutes).length ? toutes : null);

/** Une partie interrompue qu'on peut encore rejoindre, ou null. */
export function enAttente(jeu) {
  const toutes = parties(jeu);
  const moi = session(jeu);
  const choix = Object.entries(toutes)
    .map(([sid, r]) => ({ sid, ...r, age: Date.now() - r.at }))
    // Celle de cet onglet, ou celle d'un onglet qui ne donne plus signe de vie.
    .filter((r) => r.sid === moi || !r.vivant || r.age > SIGNE_DE_VIE)
    .sort((a, b) => (a.sid === moi ? -1 : b.sid === moi ? 1 : a.age - b.age));
  const r = choix[0];
  return r ? { ...r, reste: DELAI - r.age } : null;
}

/**
 * Avant de se connecter : si une partie interrompue attend, cet onglet en
 * reprend la clé. Renvoie vrai si c'est le cas.
 */
export function adopter(jeu) {
  const r = enAttente(jeu);
  if (!r || r.sid === session(jeu)) return !!r;
  try { sessionStorage.setItem(cleSession(jeu), r.sid); } catch { memoire[jeu] = r.sid; }
  return true;
}

/** On est en pleine partie : on le note (à rappeler régulièrement). */
export function enPartie(jeu, infos = {}) {
  const toutes = parties(jeu);
  toutes[session(jeu)] = { at: Date.now(), vivant: true, ...infos };
  ranger(jeu, toutes);
}

/** La connexion vient de tomber, ou l'onglet se ferme : la partie attend. */
export function interrompue(jeu) {
  const toutes = parties(jeu);
  const r = toutes[session(jeu)];
  if (!r) return;
  toutes[session(jeu)] = { ...r, at: Date.now(), vivant: false };
  ranger(jeu, toutes);
}

/** La partie est finie, ou on l'a quittée : plus rien à reprendre. */
export function oublier(jeu) {
  const toutes = parties(jeu);
  if (!toutes[session(jeu)]) return;
  delete toutes[session(jeu)];
  ranger(jeu, toutes);
}

/** À brancher une fois : l'onglet qui se ferme laisse sa partie en attente. */
export function surveiller(jeu) {
  addEventListener('pagehide', () => interrompue(jeu));
  // Sur téléphone, une application qu'on quitte passe d'abord en arrière-plan.
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrompue(jeu); });
}

/**
 * Un bandeau « Rejoindre la partie », tant qu'une partie interrompue attend.
 * `visible()` dit si l'écran s'y prête (le menu du jeu) ; `rejoindre()` est
 * appelé quand on le touche.
 */
export function bandeau(jeu, { visible = () => true, rejoindre }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'bandeau-reprise';
  b.style.cssText = 'position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);'
    + 'z-index:45;max-width:calc(100% - 24px);padding:12px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.35);'
    + 'background:linear-gradient(180deg,#2fbf71,#1d8a4f);color:#fff;font:700 15px/1.2 system-ui,sans-serif;'
    + 'box-shadow:0 10px 30px rgba(0,0,0,.45);cursor:pointer;display:flex;align-items:center;gap:10px;white-space:nowrap';
  b.hidden = true;
  document.body.appendChild(b);
  b.addEventListener('click', () => { b.hidden = true; rejoindre(); });
  const maj = () => {
    const r = enAttente(jeu);
    const montrer = !!r && visible();
    // On ne touche à rien qui n'a pas changé : l'observateur se réveillerait pour rien.
    if (b.hidden !== !montrer) b.hidden = !montrer;
    if (montrer) {
      const min = Math.max(1, Math.ceil(r.reste / 60000));
      const html = `<span style="font-size:20px">🔄</span><span>Rejoindre la partie en cours<br><small style="font-weight:500;opacity:.85">encore ${min} min${r.code ? ` · table ${r.code}` : ''}</small></span>`;
      if (b.innerHTML !== html) b.innerHTML = html;
    }
  };
  setInterval(maj, 2000);
  new MutationObserver(maj).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  maj();
  return maj;
}
