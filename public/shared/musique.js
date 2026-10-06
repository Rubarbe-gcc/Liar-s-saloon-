/**
 * Insert Coin — la petite musique de chaque jeu.
 *
 * Aucun fichier audio : chaque thème est une boucle de huit mesures écrite en
 * notes, jouée par un petit séquenceur Web Audio (basse, nappe, mélodie, un
 * peu de percussion). Rien à télécharger, rien qui manque hors connexion.
 *
 * Le jeu ne pilote rien : il dit seulement, par deux fonctions, si le son est
 * allumé (`actif`) et si le moment s'y prête (`permis`). La musique démarre au
 * premier geste du joueur — les navigateurs l'exigent — et se tait toute seule
 * quand l'onglet est caché.
 *
 * Module de navigateur (Web Audio) : il ne sert qu'aux écrans.
 */

const _ = null;

/**
 * Les notes sont en demi-tons au-dessus de la tonique (`ton`, en hertz).
 *   accords   une liste de trois notes par mesure ;
 *   basse     par pas : 0, 1 ou 2 (note de l'accord), 'c' (l'accord plaqué), ou rien ;
 *   melodie   une liste de notes par mesure, une par pas ;
 *   batterie  par pas : k (grosse caisse), s (caisse claire), h (charleston).
 */
export const THEMES = {
  /* Un donjon : lent, mineur, des notes qui tombent une à une. */
  raid: {
    bpm: 76, pas: 8, ton: 146.83, volume: 0.075,
    onde: 'triangle', tenue: 2.6, filtre: 1500, nappe: 0.5,
    accords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [-7, -4, 0], [-4, 0, 3], [-5, -1, 2]],
    basse: [0, _, _, _, 2, _, _, _],
    batterie: 'k.......',
    melodie: [
      [7, _, _, _, 5, _, 3, _], [0, _, _, _, _, _, 3, 5], [8, _, _, 7, _, _, 5, _], [5, _, 2, _, _, _, _, _],
      [7, _, _, _, 10, _, 12, _], [10, _, _, 7, _, _, 3, _], [5, _, 3, _, 2, _, 3, _], [2, _, _, _, -1, _, _, _],
    ],
  },
  /* Une arène : rapide, mineur, une basse qui pousse. */
  zenith: {
    bpm: 126, pas: 8, ton: 164.81, volume: 0.06,
    onde: 'sawtooth', tenue: 1.5, filtre: 1900, nappe: 0.3,
    accords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
    basse: [0, 0, 0, 0, 0, 0, 2, 0],
    batterie: 'k.h.s.hk',
    melodie: [
      [12, _, 7, _, 10, _, 7, _], [8, _, 7, _, 3, _, _, _], [5, _, 2, _, 5, _, 10, _], [7, _, _, _, _, _, 3, 5],
      [7, _, 10, _, 12, _, 15, _], [12, _, 8, _, 12, _, _, _], [14, _, 10, _, 5, _, 10, _], [11, _, _, _, 7, _, 11, _],
    ],
  },
  /* Un saloon : un piano bastringue, la basse qui fait « poum-tchak ». */
  saloon: {
    bpm: 100, pas: 8, ton: 130.81, volume: 0.07, swing: 0.3,
    onde: 'square', tenue: 1.1, filtre: 2200, nappe: 0,
    accords: [[0, 4, 7], [0, 4, 7], [-7, -3, 0], [0, 4, 7], [-5, -1, 2], [-7, -3, 0], [0, 4, 7], [-5, -1, 2]],
    basse: [0, _, 'c', _, 2, _, 'c', _],
    batterie: '..h...h.',
    melodie: [
      [4, _, 7, 9, _, 7, 4, _], [0, _, 2, 4, _, _, _, _], [5, _, 9, 12, _, 9, 5, _], [4, _, 7, 4, _, 0, _, _],
      [2, _, 7, 11, _, 7, 2, _], [0, _, 5, 9, _, 5, _, _], [4, 7, _, 12, _, 9, 7, _], [2, _, _, -1, _, 2, _, _],
    ],
  },
  /* Une taverne : une gigue à six temps, comme un violon près du feu. */
  brasier: {
    bpm: 144, pas: 6, ton: 220, volume: 0.06,
    onde: 'triangle', tenue: 1.2, filtre: 2600, nappe: 0.35,
    accords: [[0, 3, 7], [-2, 2, 5], [0, 3, 7], [-5, -2, 2], [0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]],
    basse: [0, _, _, 2, _, _],
    batterie: 'k..h..',
    melodie: [
      [0, 3, 7, 12, 7, 3], [2, 5, 10, 5, 2, _], [0, 3, 7, 12, _, 10], [7, _, 10, 7, _, _],
      [12, _, 12, 15, 12, 10], [10, _, 5, 2, 5, 10], [8, _, 5, 3, 0, 3], [2, _, -2, 2, _, _],
    ],
  },
  /* Une fête : majeur, sautillant, tout en contretemps. */
  echo: {
    bpm: 112, pas: 8, ton: 174.61, volume: 0.06,
    onde: 'square', tenue: 0.9, filtre: 2000, nappe: 0.35,
    accords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    basse: [0, _, 0, 1, _, 0, 2, _],
    batterie: 'k.h.s.hh',
    melodie: [
      [_, 7, _, 9, 7, _, 4, _], [_, 4, _, 7, 4, _, 0, _], [_, 5, _, 9, 12, _, 9, _], [7, _, 4, _, 2, _, _, _],
      [_, 12, _, 9, 7, _, 9, _], [_, 12, _, 9, 7, _, 4, _], [5, _, 9, _, 12, _, 14, _], [12, _, _, _, _, _, _, _],
    ],
  },
  /* Une fête : un calypso majeur, sautillant, des percussions qui claquent. */
  fiesta: {
    bpm: 124, pas: 8, ton: 196, volume: 0.06, swing: 0.15,
    onde: 'triangle', tenue: 0.9, filtre: 2600, nappe: 0.3,
    accords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
    basse: [0, _, 2, _, 0, 1, 2, _],
    batterie: 'k.hck.hc',
    melodie: [
      [12, _, 14, 16, _, 14, 12, _], [17, _, 16, 14, _, 12, 9, _], [11, _, 14, 19, _, 17, 14, _], [16, _, 12, _, 7, _, _, _],
      [12, 12, 14, 16, _, 19, _, 16], [17, _, 21, _, 19, 17, 16, _], [14, _, 19, 17, 16, 14, 11, _], [12, _, _, _, 24, _, _, _],
    ],
  },
  /* Un chant de marins : six temps qui tanguent, en ré mineur, la cale qui tape du pied. */
  skullking: {
    bpm: 132, pas: 6, ton: 146.83, volume: 0.065,
    onde: 'square', tenue: 1.0, filtre: 1500, nappe: 0.3,
    accords: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2], [0, 3, 7], [-5, -1, 2]],
    basse: [0, _, _, 2, _, _],
    batterie: 'k..s.h',
    melodie: [
      [0, _, 2, 3, _, 5], [7, _, 5, 3, _, 2], [-2, _, 0, 2, _, 3], [5, _, 3, 2, _, _],
      [3, _, 5, 7, _, 8], [7, _, 11, 14, _, 11], [12, _, 10, 7, _, 3], [2, _, -1, -5, _, _],
    ],
  },
};

const hz = (ton, demiTons) => ton * 2 ** (demiTons / 12);

/**
 * Installe la musique d'un jeu. À appeler une fois, au chargement.
 * @param {string} nom            clé de `THEMES`
 * @param {object} [o]
 * @param {() => boolean} [o.actif]   le son est-il allumé ?
 * @param {() => boolean} [o.permis]  le moment s'y prête-t-il ? (pas pendant une prise de son)
 */
export function installerMusique(nom, { actif = () => true, permis = () => true } = {}) {
  const th = THEMES[nom];
  if (!th || typeof window === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  let ctx = null, sortie = null, bruit = null;
  let geste = false, joue = false, pas = 0, prochain = 0;
  const duree = 60 / th.bpm / 2;               // un pas = une croche
  const total = th.accords.length * th.pas;

  function monter() {
    ctx = new AC();
    sortie = ctx.createGain();
    sortie.gain.value = 0;
    sortie.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 0.25);
    bruit = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = bruit.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  function note(freq, t, dur, onde, vol, filtre = 0, attaque = 0.012) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = onde;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attaque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filtre) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filtre;
      o.connect(f).connect(g);
    } else o.connect(g);
    g.connect(sortie);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function souffle(t, dur, type, freq, vol) {
    const s = ctx.createBufferSource();
    s.buffer = bruit;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sortie);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  function tambour(c, t) {
    if (c === 'k') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(sortie);
      o.start(t);
      o.stop(t + 0.2);
    } else if (c === 's') souffle(t, 0.11, 'bandpass', 1900, 0.4);
    else if (c === 'h') souffle(t, 0.04, 'highpass', 7000, 0.22);
  }

  /** Programme tout ce qui sonne sur un pas. */
  function programmer(i, t) {
    const mesure = Math.floor(i / th.pas);
    const p = i % th.pas;
    const accord = th.accords[mesure];
    if (p % 2 === 1 && th.swing) t += duree * th.swing;

    if (p === 0 && th.nappe) {
      for (const n of accord) note(hz(th.ton, n), t, duree * th.pas * 1.05, 'sine', 0.16 * th.nappe, 0, 0.25);
    }
    const b = th.basse[p];
    if (b === 'c') {
      for (const n of accord) note(hz(th.ton, n + 12), t, duree * 0.9, 'triangle', 0.16, 2400);
    } else if (b !== null && b !== undefined) {
      note(hz(th.ton, accord[b] - 12), t, duree * 1.7, 'triangle', 0.6, 900);
    }
    const m = th.melodie[mesure][p];
    if (m !== null && m !== undefined) {
      note(hz(th.ton, m + 12), t, duree * th.tenue, th.onde, th.onde === 'triangle' ? 0.42 : 0.2, th.filtre);
    }
    tambour(th.batterie[p], t);
  }

  function battre() {
    const veut = geste && !document.hidden && actif() && permis();
    if (!veut) {
      if (joue) {
        joue = false;
        sortie.gain.cancelScheduledValues(ctx.currentTime);
        sortie.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      }
      return;
    }
    if (!ctx) monter();
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return; }
    if (!joue) {
      joue = true;
      prochain = ctx.currentTime + 0.1;
      sortie.gain.cancelScheduledValues(ctx.currentTime);
      sortie.gain.setTargetAtTime(th.volume, ctx.currentTime, 0.4);
    }
    // Un onglet qui a pris du retard reprend au présent, sans rafale de notes.
    if (prochain < ctx.currentTime) prochain = ctx.currentTime + 0.05;
    while (prochain < ctx.currentTime + 0.4) {
      programmer(pas, prochain);
      prochain += duree;
      pas = (pas + 1) % total;
    }
  }

  const premierGeste = () => { geste = true; battre(); };
  window.addEventListener('pointerdown', premierGeste, { capture: true });
  window.addEventListener('keydown', premierGeste, { capture: true });
  document.addEventListener('visibilitychange', battre);
  setInterval(battre, 120);
}
