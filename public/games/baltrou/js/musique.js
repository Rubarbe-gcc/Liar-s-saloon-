/**
 * BALTROU — la musique, composée note à note et jouée par le navigateur.
 *
 * Aucun fichier : un petit orchestre Web Audio (piano électrique, vibraphone,
 * cuivres, orgue, boîte à musique, basse, batterie) joue des thèmes écrits
 * ici même. Un thème pour la table, un pour la boutique, et un par boss,
 * qui raconte son effet. Quand on change de thème, l'ancien s'efface en
 * douceur pendant que le nouveau entre.
 *
 * Écriture d'un thème : chaque mesure a un accord (des demi-tons au-dessus de
 * la tonique `ton`), et des pas (des croches) :
 *   basse    par pas : un numéro de note de l'accord, ou 'r7' (la fondamentale
 *            + 7 demi-tons), ou rien ;
 *   comp     par pas : 'x' plaque l'accord, '.' se tait ;
 *   melodie  par mesure, une note par pas (demi-tons, une octave au-dessus) ;
 *   batterie par pas : k grosse caisse, s caisse claire, h charleston,
 *            o charleston ouvert, r bord de caisse, c claquement, t timbale.
 */

const _ = null;

export const THEMES = {
  /* La table : un lounge jazzy, le piano électrique qui balance. */
  tapis: {
    bpm: 96, pas: 8, ton: 220, swing: 0.22, volume: 0.5,
    lead: 'vibra', comp: 'rhodes', basse: 'contrebasse', nappe: 'pad', nappeVol: 0.35,
    accords: [[0, 3, 7, 10], [5, 9, 12, 15], [0, 3, 7, 10], [5, 9, 12, 15], [-4, 0, 3, 7], [-5, -1, 2, 5], [0, 3, 7, 10], [-5, -1, 2, 5]],
    basseMotif: [0, _, _, 'r7', 0, _, 'r10', 'r12'],
    compMotif: '...x..x.',
    batterie: 'k.h.s.hk',
    melodie: [
      [_, _, 7, 10, 12, _, 10, 7], [9, _, _, _, 5, 7, _, _], [_, _, 7, 10, 12, _, 15, 14], [12, _, 9, _, 7, _, _, _],
      [_, 15, _, 14, 12, _, 10, 12], [11, _, _, 8, _, 7, 5, _], [7, _, 3, 5, 7, _, 12, _], [11, _, 14, _, 11, _, 8, _],
    ],
  },

  /* La boutique : une bossa-nova, guitare et flûte, qui donne envie d'acheter. */
  boutique: {
    bpm: 112, pas: 8, ton: 174.61, swing: 0.1, volume: 0.5,
    lead: 'flute', comp: 'nylon', basse: 'contrebasse', nappe: 'pad', nappeVol: 0.25,
    accords: [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-5, -1, 2, 5], [0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [-5, -1, 2, 5]],
    basseMotif: [0, _, _, 'r7', 0, _, _, 'r7'],
    compMotif: '.x.x..x.',
    batterie: 'k.r.hrk.',
    melodie: [
      [12, _, _, 9, _, 7, 9, _], [12, _, _, _, _, _, 14, 12], [10, _, _, 9, _, 7, 5, _], [7, _, _, _, 4, _, _, _],
      [16, _, _, 14, _, 12, 14, _], [17, _, _, _, 16, 14, 12, _], [14, _, 12, _, 10, _, 9, _], [7, _, _, _, _, _, _, _],
    ],
  },

  /* La Limace : lente, gluante, chaque note glisse vers la suivante. */
  limace: {
    bpm: 66, pas: 8, ton: 130.81, volume: 0.4, glisse: true,
    lead: 'gluant', comp: null, basse: 'synth', nappe: 'pad', nappeVol: 0.55,
    accords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-1, 2, 5], [0, 3, 7], [-4, 0, 3], [-5, -1, 2], [0, 3, 7]],
    basseMotif: [0, _, _, _, _, _, 'r-1', _],
    compMotif: '........',
    batterie: 'k.....o.',
    melodie: [
      [7, _, _, _, 6, _, _, _], [5, _, _, _, 8, _, _, _], [7, _, 6, _, 5, _, 3, _], [2, _, _, _, _, _, _, _],
      [3, _, _, 4, _, _, 3, _], [0, _, _, _, -1, _, 0, _], [2, _, _, _, -1, _, _, _], [0, _, _, _, _, _, _, _],
    ],
  },

  /* Le Mur : lourd, des accords de puissance, ça tape du pied. */
  mur: {
    bpm: 92, pas: 8, ton: 146.83, volume: 0.44,
    lead: 'cuivre', comp: 'distor', basse: 'synth', nappe: null,
    accords: [[0, 7, 12], [0, 7, 12], [-2, 5, 10], [-2, 5, 10], [-4, 3, 8], [-4, 3, 8], [-5, 2, 7], [-5, 2, 7]],
    basseMotif: [0, _, 0, _, 0, _, 0, 0],
    compMotif: 'x...x.x.',
    batterie: 'k.s.kks.',
    melodie: [
      [12, _, _, _, _, _, _, _], [12, _, 10, _, 12, _, _, _], [10, _, _, _, _, _, _, _], [10, _, 8, _, 10, _, _, _],
      [8, _, _, _, _, _, _, _], [8, _, 7, _, 8, _, 10, _], [7, _, _, _, 6, _, _, _], [7, _, _, _, _, _, _, _],
    ],
  },

  /* L'Avare : sur la pointe des pieds, en pizzicato, la main dans la caisse. */
  avare: {
    bpm: 104, pas: 8, ton: 164.81, swing: 0.15, volume: 0.55,
    lead: 'pizz', comp: null, basse: 'contrebasse', nappe: 'pad', nappeVol: 0.2,
    accords: [[0, 3, 7], [0, 3, 7], [5, 8, 12], [0, 3, 7], [-4, 0, 3], [-5, -1, 2, 5], [0, 3, 7], [-5, -1, 2, 5]],
    basseMotif: [0, _, 'r7', _, 0, _, 'r7', _],
    compMotif: '........',
    batterie: '..r...r.',
    melodie: [
      [7, _, 8, _, 7, _, _, 3], [4, _, 3, _, _, _, _, _], [8, _, 9, _, 8, _, _, 5], [7, _, 3, _, _, _, _, _],
      [12, _, 11, _, 10, _, 9, _], [8, _, 5, _, 6, _, _, _], [7, _, 3, _, 0, _, 3, 4], [_, 2, _, 6, _, 5, _, -1],
    ],
  },

  /* La Sorcière : une valse lugubre, un orgue et un thérémine qui frissonne. */
  crane: {
    bpm: 150, pas: 6, ton: 146.83, volume: 0.5, glisse: true,
    lead: 'theremine', comp: 'orgue', basse: 'synth', nappe: null,
    accords: [[0, 3, 7], [-5, -1, 2, 5], [5, 8, 12], [0, 3, 7], [-4, 0, 3], [2, 5, 8], [-5, -1, 2, 5], [0, 3, 7]],
    basseMotif: [0, _, _, _, _, _],
    compMotif: '..x.x.',
    batterie: 'k...h.',
    melodie: [
      [7, _, _, 8, _, 7], [5, _, _, 2, _, 1], [3, _, _, 5, _, 7], [8, _, 7, _, _, _],
      [10, _, _, 8, _, 7], [8, _, _, 5, _, 2], [-1, _, 2, _, 5, _], [2, _, _, 0, _, _],
    ],
  },

  /* L'Acharné : rapide, une basse qui martèle, des arpèges qui ne lâchent rien. */
  acharne: {
    bpm: 152, pas: 8, ton: 220, volume: 0.42,
    lead: 'lead', comp: null, basse: 'synth', nappe: 'pad', nappeVol: 0.25,
    accords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
    basseMotif: [0, 0, 'r12', 0, 0, 0, 'r12', 0],
    compMotif: '........',
    batterie: 'k.hsk.hs',
    melodie: [
      [12, 15, 12, 7, 12, 15, 19, 15], [12, 15, 12, 8, 12, 15, 20, 15], [14, 17, 14, 10, 14, 17, 22, 17], [11, 14, 11, 7, 11, 14, 19, 14],
      [19, _, 17, _, 15, _, 12, _], [20, _, 19, _, 15, _, 12, _], [22, _, 19, _, 17, _, 14, _], [19, _, _, _, 23, _, _, _],
    ],
  },

  /* Le Silencieux : une boîte à musique, presque muette. Chaque note compte. */
  silence: {
    bpm: 72, pas: 8, ton: 261.63, volume: 1.4,
    lead: 'boite', comp: null, basse: 'contrebasse', basseVol: 0.4, nappe: 'pad', nappeVol: 0.18,
    accords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14], [0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14]],
    basseMotif: [0, _, _, _, _, _, _, _],
    compMotif: '........',
    batterie: '........',
    melodie: [
      [12, _, _, _, _, _, _, _], [_, _, _, _, 11, _, _, _], [_, _, 9, _, _, _, _, _], [_, _, _, _, _, _, 7, _],
      [16, _, _, _, _, _, _, _], [_, _, 14, _, _, _, _, _], [_, _, _, _, 12, _, 11, _], [_, _, _, _, _, _, _, _],
    ],
  },

  /* Le Miroir : des arpèges de verre qui montent… puis redescendent, à l'envers. */
  miroir: {
    bpm: 88, pas: 8, ton: 146.83, volume: 0.5,
    lead: 'verre', comp: null, basse: 'contrebasse', nappe: 'pad', nappeVol: 0.5,
    accords: [[0, 4, 7, 11], [2, 6, 9], [0, 4, 7, 11], [2, 6, 9], [2, 6, 9], [0, 4, 7, 11], [2, 6, 9], [0, 4, 7, 11]],
    basseMotif: [0, _, _, _, 'r7', _, _, _],
    compMotif: '........',
    batterie: '....h...',
    melodie: [
      [0, 4, 7, 11, 14, _, _, _], [2, 6, 9, 14, 18, _, _, _], [0, 4, 7, 11, 16, _, 14, _], [18, _, 16, _, 14, _, _, _],
      [_, _, _, 14, _, 16, _, 18], [_, 14, _, 16, 11, 7, 4, 0], [_, _, _, 18, 14, 9, 6, 2], [_, _, _, 14, 11, 7, 4, 0],
    ],
  },

  /* Le Voleur : un thème d'espion, guitare surf et charleston qui chuchote. */
  voleur: {
    bpm: 136, pas: 8, ton: 164.81, volume: 0.7,
    lead: 'surf', comp: null, basse: 'basse-guitare', nappe: 'pad', nappeVol: 0.2,
    accords: [[0, 3, 7], [0, 3, 7], [0, 3, 7], [0, 3, 7], [-4, 0, 3], [-4, 0, 3], [-5, -1, 2, 5], [-5, -1, 2, 5]],
    basseMotif: [0, 'r7', 'r8', 'r7', 0, 'r7', 'r8', 'r7'],
    compMotif: '........',
    batterie: 'k.hos.ho',
    melodie: [
      [12, _, _, 15, _, _, 14, _], [12, _, _, _, _, _, _, _], [12, _, _, 15, _, _, 17, _], [18, _, 17, _, 15, _, _, _],
      [16, _, _, 15, _, _, 12, _], [15, _, _, _, _, _, _, _], [11, _, _, 14, _, _, 17, _], [15, _, 14, _, 11, _, _, _],
    ],
  },

  /* LE ROI : une marche épique, cuivres, cordes et timbales. */
  roi: {
    bpm: 108, pas: 8, ton: 130.81, volume: 0.48,
    lead: 'cuivre', comp: 'cuivre-grave', basse: 'synth', nappe: 'cordes', nappeVol: 0.5,
    accords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2], [0, 3, 7], [-4, 0, 3], [5, 8, 12], [-5, -1, 2]],
    basseMotif: [0, _, 0, _, 0, _, 0, 0],
    compMotif: 'x...x...',
    batterie: 'k.s.kts.',
    melodie: [
      [12, _, _, 12, 15, _, 19, _], [20, _, _, _, 19, _, 15, _], [17, _, _, 17, 19, _, 22, _], [23, _, _, _, 19, _, _, _],
      [24, _, _, 22, _, _, 19, _], [20, _, 19, _, 15, _, 12, _], [17, _, _, 15, _, _, 14, _], [11, _, _, _, 14, _, _, _],
    ],
  },
};

/** Les noms que l'écran demande, et le thème qui leur répond. */
export const piste = (nom) => {
  if (!nom || nom === 'ambient' || nom === 'menu') return 'tapis';
  const cle = nom.replace(/^boss_?/, '');
  if (THEMES[cle]) return cle;
  return nom.startsWith('boss') ? 'roi' : 'tapis';
};

const hz = (ton, demiTons) => ton * 2 ** (demiTons / 12);

/**
 * L'orchestre. `creerOrchestre()` renvoie { jouer(nom), couper(oui) }.
 * Rien ne sonne avant le premier geste du joueur (les navigateurs l'exigent).
 */
export function creerOrchestre() {
  if (typeof window === 'undefined') return { jouer() {}, couper() {} };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return { jouer() {}, couper() {} };

  let ctx = null, maitre = null, bruit = null, reverb = null;
  let voulu = 'tapis', muet = false, geste = false;
  let courant = null;     // { nom, th, bus, pas, prochain, derniereNote }

  function monter() {
    ctx = new AC();
    maitre = ctx.createGain();
    maitre.gain.value = 0;
    // Une petite compression pour que rien ne sature quand tout joue.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    maitre.connect(comp).connect(ctx.destination);
    // Une réverbération légère : un écho bref, filtré.
    reverb = ctx.createDelay(0.5);
    reverb.delayTime.value = 0.21;
    const retour = ctx.createGain(); retour.gain.value = 0.22;
    const filtre = ctx.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = 2200;
    reverb.connect(filtre).connect(retour).connect(reverb);
    retour.connect(maitre);
    const n = Math.floor(ctx.sampleRate * 0.5);
    bruit = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = bruit.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  /* --------------------------- les instruments --------------------------- */

  function enveloppe(g, t, vol, attaque, duree, maintien = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attaque);
    if (maintien) g.gain.setValueAtTime(vol, t + attaque + maintien);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attaque + maintien + duree);
  }

  function osc(type, freq, t, fin, sortie, { detune = 0, vibrato = 0, glisseDe = null } = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    if (glisseDe) { o.frequency.setValueAtTime(glisseDe, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.12); }
    else o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (vibrato) {
      const l = ctx.createOscillator(); const lg = ctx.createGain();
      l.frequency.value = 5.2; lg.gain.value = freq * vibrato;
      l.connect(lg).connect(o.frequency);
      l.start(t); l.stop(fin);
    }
    o.connect(sortie);
    o.start(t);
    o.stop(fin);
    return o;
  }

  /** Une note d'un instrument, envoyée sur `bus`. */
  function voix(instr, freq, t, d, vol, bus, glisseDe = null) {
    const g = ctx.createGain();
    g.connect(bus);
    const envoi = ctx.createGain(); envoi.gain.value = 0.35; g.connect(envoi).connect(reverb);
    const passeBas = (f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; b.connect(g); return b; };
    switch (instr) {
      case 'rhodes': { // piano électrique : deux sinus, un peu de cloche
        enveloppe(g, t, vol * 0.5, 0.006, d * 1.6);
        osc('sine', freq, t, t + d * 1.8, g);
        const cl = ctx.createGain(); cl.gain.value = 0.25; cl.connect(g);
        osc('sine', freq * 2.01, t, t + 0.4, cl);
        break;
      }
      case 'vibra': { // vibraphone : cloche douce qui tremble
        enveloppe(g, t, vol * 0.55, 0.004, d * 2.2);
        const trem = ctx.createGain(); trem.connect(g);
        const l = ctx.createOscillator(); const lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = 0.35;
        l.connect(lg).connect(trem.gain); l.start(t); l.stop(t + d * 2.4);
        osc('sine', freq, t, t + d * 2.4, trem);
        const h = ctx.createGain(); h.gain.value = 0.12; h.connect(trem);
        osc('sine', freq * 4, t, t + 0.25, h);
        break;
      }
      case 'flute': enveloppe(g, t, vol * 0.42, 0.05, d * 0.6, d * 0.5); osc('sine', freq, t, t + d * 1.3, g, { vibrato: 0.006 }); break;
      case 'nylon': enveloppe(g, t, vol * 0.3, 0.004, 0.55); osc('triangle', freq, t, t + 0.65, passeBas(1800)); break;
      case 'pizz': enveloppe(g, t, vol * 0.55, 0.003, 0.2); osc('triangle', freq, t, t + 0.25, passeBas(2400)); break;
      case 'gluant': enveloppe(g, t, vol * 0.45, 0.08, d * 0.9, d * 0.6); osc('sine', freq, t, t + d * 1.7, g, { vibrato: 0.012, glisseDe }); osc('triangle', freq / 2, t, t + d * 1.7, passeBas(500), {}); break;
      case 'theremine': enveloppe(g, t, vol * 0.38, 0.1, d * 0.8, d * 0.4); osc('sine', freq, t, t + d * 1.5, g, { vibrato: 0.018, glisseDe }); break;
      case 'boite': { // boîte à musique : aigu, cristallin, qui s'éteint lentement
        enveloppe(g, t, vol * 0.5, 0.002, 1.6);
        osc('sine', freq * 2, t, t + 1.7, g);
        const h = ctx.createGain(); h.gain.value = 0.2; h.connect(g);
        osc('sine', freq * 8, t, t + 0.3, h);
        break;
      }
      case 'verre': {
        enveloppe(g, t, vol * 0.4, 0.003, 1.2);
        osc('sine', freq * 2, t, t + 1.3, g);
        const h = ctx.createGain(); h.gain.value = 0.3; h.connect(g);
        osc('sine', freq * 6.02, t, t + 0.5, h);
        break;
      }
      case 'cuivre': { // cuivre : dent de scie, le filtre qui s'ouvre
        const f = passeBas(600, 2);
        f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.06); f.frequency.exponentialRampToValueAtTime(1100, t + d);
        enveloppe(g, t, vol * 0.22, 0.03, d * 0.5, d * 0.6);
        osc('sawtooth', freq, t, t + d * 1.3, f); osc('sawtooth', freq, t, t + d * 1.3, f, { detune: 9 });
        break;
      }
      case 'cuivre-grave': {
        const f = passeBas(900, 1.5);
        enveloppe(g, t, vol * 0.16, 0.02, d * 1.2, d * 0.3);
        osc('sawtooth', freq / 2, t, t + d * 1.6, f);
        break;
      }
      case 'distor': {
        const f = passeBas(1400, 1);
        enveloppe(g, t, vol * 0.14, 0.005, d * 1.4);
        osc('sawtooth', freq / 2, t, t + d * 1.5, f); osc('square', freq / 2, t, t + d * 1.5, f, { detune: -12 });
        break;
      }
      case 'orgue': enveloppe(g, t, vol * 0.12, 0.02, d * 0.5, d * 0.5); osc('square', freq, t, t + d * 1.1, passeBas(1600)); osc('sine', freq * 2, t, t + d * 1.1, g); break;
      case 'lead': enveloppe(g, t, vol * 0.16, 0.005, d * 0.9); osc('square', freq, t, t + d, passeBas(2600)); break;
      case 'surf': {
        enveloppe(g, t, vol * 0.2, 0.004, d * 1.4);
        const trem = ctx.createGain(); trem.connect(g);
        const l = ctx.createOscillator(); const lg = ctx.createGain(); l.frequency.value = 7; lg.gain.value = 0.4;
        l.connect(lg).connect(trem.gain); l.start(t); l.stop(t + d * 1.6);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; f.connect(trem);
        osc('sawtooth', freq, t, t + d * 1.6, f);
        break;
      }
      case 'pad': enveloppe(g, t, vol * 0.12, 0.35, d * 0.5, d * 0.6); osc('sine', freq, t, t + d * 1.5, g); osc('triangle', freq, t, t + d * 1.5, passeBas(1200), { detune: 6 }); break;
      case 'cordes': enveloppe(g, t, vol * 0.08, 0.4, d * 0.4, d * 0.7); osc('sawtooth', freq, t, t + d * 1.6, passeBas(1300)); osc('sawtooth', freq, t, t + d * 1.6, passeBas(1300), { detune: -8 }); break;
      case 'contrebasse': enveloppe(g, t, vol * 0.7, 0.006, 0.45); osc('triangle', freq, t, t + 0.5, passeBas(700)); break;
      case 'basse-guitare': enveloppe(g, t, vol * 0.45, 0.004, 0.3); osc('sawtooth', freq, t, t + 0.35, passeBas(650, 3)); break;
      case 'synth': enveloppe(g, t, vol * 0.4, 0.01, d * 1.1); osc('sawtooth', freq, t, t + d * 1.3, passeBas(420, 4)); osc('sine', freq, t, t + d * 1.3, g); break;
      default: enveloppe(g, t, vol * 0.3, 0.01, d); osc('triangle', freq, t, t + d, g);
    }
  }

  function souffle(t, dur, type, freq, vol, bus) {
    const s = ctx.createBufferSource();
    s.buffer = bruit;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.2);
    s.stop(t + dur + 0.02);
  }

  function frappe(c, t, bus) {
    if (c === 'k' || c === 't') {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      const [haut, bas, dur, vol] = c === 'k' ? [130, 45, 0.18, 0.9] : [180, 70, 0.45, 0.7];
      o.frequency.setValueAtTime(haut, t); o.frequency.exponentialRampToValueAtTime(bas, t + dur * 0.8);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
      if (c === 't') souffle(t, 0.3, 'lowpass', 300, 0.25, bus);
    } else if (c === 's') { souffle(t, 0.14, 'bandpass', 1800, 0.5, bus); souffle(t, 0.05, 'highpass', 5000, 0.2, bus); }
    else if (c === 'h') souffle(t, 0.04, 'highpass', 7500, 0.22, bus);
    else if (c === 'o') souffle(t, 0.22, 'highpass', 7000, 0.2, bus);
    else if (c === 'r') souffle(t, 0.03, 'bandpass', 3200, 0.45, bus);
    else if (c === 'c') { souffle(t, 0.08, 'bandpass', 1300, 0.45, bus); souffle(t + 0.012, 0.1, 'bandpass', 1100, 0.35, bus); }
  }

  /* ---------------------------- le chef d'orchestre ---------------------------- */

  function programmer(e, i, t) {
    const th = e.th;
    const duree = 60 / th.bpm / 2;
    const mesure = Math.floor(i / th.pas) % th.accords.length;
    const p = i % th.pas;
    const accord = th.accords[mesure];
    if (p % 2 === 1 && th.swing) t += duree * th.swing;

    if (p === 0 && th.nappe) for (const n of accord) voix(th.nappe, hz(th.ton, n), t, duree * th.pas, th.nappeVol ?? 0.3, e.bus);
    if (th.comp && th.compMotif[p] === 'x') for (const n of accord) voix(th.comp, hz(th.ton, n + 12), t, duree * 1.5, 0.6, e.bus);
    const b = th.basseMotif[p];
    if (b !== null && b !== undefined) {
      const n = typeof b === 'string' ? accord[0] + Number(b.slice(1)) : accord[b] ?? accord[0];
      voix(th.basse, hz(th.ton, n - 12), t, duree * 1.8, th.basseVol ?? 0.8, e.bus);
    }
    const m = th.melodie[mesure][p];
    if (m !== null && m !== undefined) {
      const f = hz(th.ton, m + 12);
      // La longueur d'une note : jusqu'à la suivante, sans dépasser la mesure.
      let lon = 1;
      while (p + lon < th.pas && th.melodie[mesure][p + lon] == null) lon++;
      voix(th.lead, f, t, duree * Math.min(lon, 4), 0.9, e.bus, th.glisse ? e.derniere : null);
      e.derniere = f;
    }
    const c = th.batterie[p];
    if (c && c !== '.') frappe(c, t, e.bus);
  }

  function nouveau(nom, quand) {
    const th = THEMES[nom];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, quand);
    bus.gain.exponentialRampToValueAtTime(th.volume, quand + 0.8);
    bus.connect(maitre);
    return { nom, th, bus, pas: 0, prochain: quand, derniere: null };
  }

  function battre() {
    const veut = geste && !muet && !document.hidden;
    if (!veut) {
      if (ctx && maitre) maitre.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      return;
    }
    if (!ctx) monter();
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return; }
    maitre.gain.setTargetAtTime(0.9, ctx.currentTime, 0.3);
    const maintenant = ctx.currentTime;
    // Changement de thème : l'ancien s'efface, le nouveau entre.
    if (!courant || courant.nom !== voulu) {
      if (courant) {
        const vieux = courant.bus;
        vieux.gain.cancelScheduledValues(maintenant);
        vieux.gain.setTargetAtTime(0.0001, maintenant, 0.35);
        setTimeout(() => { try { vieux.disconnect(); } catch { /* déjà fait */ } }, 2500);
      }
      courant = nouveau(voulu, maintenant + 0.08);
    }
    const e = courant;
    // Un onglet qui a pris du retard reprend au présent, sans rafale de notes.
    if (e.prochain < maintenant) e.prochain = maintenant + 0.05;
    const duree = 60 / e.th.bpm / 2;
    while (e.prochain < maintenant + 0.35) {
      programmer(e, e.pas, e.prochain);
      e.prochain += duree;
      e.pas = (e.pas + 1) % (e.th.pas * e.th.accords.length);
    }
  }

  const premierGeste = () => { geste = true; battre(); };
  window.addEventListener('pointerdown', premierGeste, { capture: true });
  window.addEventListener('keydown', premierGeste, { capture: true });
  document.addEventListener('visibilitychange', battre);
  setInterval(battre, 100);

  return {
    jouer(nom) { voulu = piste(nom); },
    couper(oui) { muet = !!oui; battre(); },
  };
}
