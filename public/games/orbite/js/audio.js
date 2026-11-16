// ORBITE NOIRE — sons et musique, entièrement synthétisés (WebAudio, aucun fichier).
// Sons d'armes et d'explosions par faction, placés dans l'espace (volume selon la distance, gauche/droite) ;
// musique générée en direct : nappes graves, arpège en mineur, pulsation qui monte avec la tension des combats.
export function creerAudio() {
  let ac = null, maitre = null, bus = null, busMus = null, bruit = null, muet = false, musique = null, tension = 0, dernier = {};
  function init() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(ac.destination);
    maitre = ac.createGain(); maitre.gain.value = muet ? 0 : .8; maitre.connect(comp);
    bus = ac.createGain(); bus.gain.value = .9; bus.connect(maitre);
    busMus = ac.createGain(); busMus.gain.value = .32; busMus.connect(maitre);
    bruit = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = bruit.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const t0 = () => ac.currentTime;
  function sortie(vol, pan) { const g = ac.createGain(); g.gain.value = vol; let n = g; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(bus); } else g.connect(bus); return n; }
  function osc(type, f0, f1, dur, vol, out, debut = 0) { const o = ac.createOscillator(), g = ac.createGain(), t = t0() + debut; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .02); }
  function souffle(dur, filtre, f0, f1, vol, out, debut = 0, q = 1) { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t = t0() + debut; s.buffer = bruit; fl.type = filtre; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * .5); s.stop(t + dur + .02); }
  /** Pas plus de n sons d'une même sorte toutes les ms millisecondes (une armée qui tire ne sature pas). */
  function limite(cle, ms) { const n = performance.now(); if (dernier[cle] && n - dernier[cle] < ms) return false; dernier[cle] = n; return true; }

  const SONS = {
    tir_fer: (o, lourd) => { if (lourd) { osc('square', 160, 40, .35, .5, o); souffle(.4, 'lowpass', 1800, 120, .7, o); } else { souffle(.07, 'highpass', 3000, 1500, .5, o); osc('square', 900, 300, .05, .15, o); } },
    tir_bosquet: (o, lourd) => { souffle(lourd ? .3 : .15, 'bandpass', lourd ? 600 : 1500, lourd ? 200 : 600, .5, o, 0, 4); osc('sine', lourd ? 220 : 440, lourd ? 90 : 200, lourd ? .25 : .12, .2, o); },
    tir_echos: (o, lourd) => { osc('sawtooth', lourd ? 900 : 1800, lourd ? 300 : 900, lourd ? .3 : .14, .18, o); osc('sine', lourd ? 1800 : 3600, lourd ? 600 : 1800, lourd ? .3 : .14, .12, o); },
    tir_cendres: (o, lourd) => { souffle(lourd ? .5 : .25, 'lowpass', 900, 200, .6, o); osc('triangle', 120, 60, lourd ? .4 : .2, .2, o); },
    tir_neutre: o => { souffle(.1, 'bandpass', 800, 400, .4, o, 0, 2); },
    explosion: (o, gros) => { souffle(gros ? 1.6 : .7, 'lowpass', gros ? 1400 : 2200, 60, gros ? 1.1 : .6, o); osc('sine', gros ? 90 : 140, 30, gros ? 1.2 : .5, gros ? .9 : .5, o); if (gros) souffle(1.2, 'bandpass', 400, 100, .4, o, .15, 1); },
    cristal: o => { for (let i = 0; i < 4; i++) osc('sine', 1600 + Math.random() * 2000, 800, .5, .12, o, i * .03); },
    pouvoir: o => { osc('sawtooth', 120, 600, .6, .25, o); souffle(.8, 'bandpass', 300, 3000, .4, o, 0, 3); },
    capacite: o => { osc('triangle', 500, 1200, .2, .2, o); osc('sine', 1000, 2000, .25, .1, o, .05); },
  };
  /** Un son dans le monde : d = distance à la caméra (cases), pan = -1 (gauche) à 1 (droite). */
  function monde(nom, d, pan, arg) {
    if (!ac || muet || d > 40) return;
    if (!limite(nom + (arg ? 1 : 0), nom === 'explosion' ? 60 : nom.startsWith('tir') ? 45 : 100)) return;
    const vol = Math.max(0, 1 - d / 40) ** 1.5; if (vol < .02) return;
    if (nom.startsWith('tir') || nom === 'explosion') tension = Math.min(1, tension + (nom === 'explosion' ? .08 : .015));
    try { SONS[nom](sortie(vol, pan), arg); } catch { /* son raté : tant pis */ }
  }
  /** Les sons d'interface (non placés). */
  const UI = {
    clic: () => osc('sine', 700, 500, .05, .12, bus), ordre: () => { osc('triangle', 420, 380, .07, .15, bus); osc('triangle', 630, 600, .06, .1, bus, .05); },
    pret: () => { osc('sine', 660, 660, .12, .18, bus); osc('sine', 990, 990, .18, .15, bus, .1); }, alerte: () => { osc('square', 330, 330, .14, .12, bus); osc('square', 247, 247, .2, .12, bus, .16); },
    mort: () => osc('sawtooth', 160, 60, .25, .12, bus), fin: () => [523, 659, 784, 1046].forEach((f, i) => osc('triangle', f, f, .5, .18, bus, i * .15)),
  };
  function ui(nom) { if (!init() || muet || !UI[nom] || !limite('ui' + nom, 110)) return; try { UI[nom](); } catch { /* rien */ } }

  // ---------- musique générée ----------
  const GAMME = [0, 2, 3, 5, 7, 8, 10], RACINE = 98; // mineur naturel sur sol (98 Hz)
  const note = deg => RACINE * 2 ** ((GAMME[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7)) / 12);
  function demarrerMusique() {
    if (!init() || musique) return;
    const nappes = [0, 7, 9].map((deg, i) => { // nappes graves qui respirent
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = note(deg) / 2; o2.frequency.value = note(deg) / 2 * 1.006;
      fl.type = 'lowpass'; fl.frequency.value = 500; fl.Q.value = 2; lfo.frequency.value = .05 + i * .03; lg.gain.value = 250; lfo.connect(lg); lg.connect(fl.frequency);
      g.gain.value = .06; o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(busMus); o1.start(); o2.start(); lfo.start();
      return { o1, o2, fl, g };
    });
    let pas = 0, accord = 0;
    const ACCORDS = [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]];
    const tic = setInterval(() => {
      if (!ac || muet) return;
      tension = Math.max(0, tension - .02);
      const t = t0(), a = ACCORDS[accord];
      if (pas % 16 === 0) { accord = (accord + 1) % ACCORDS.length; nappes.forEach((n, i) => { const f = note(ACCORDS[accord][i]) / 2; n.o1.frequency.setTargetAtTime(f, t, .8); n.o2.frequency.setTargetAtTime(f * 1.006, t, .8); }); }
      // arpège : plus dense quand ça chauffe
      if (pas % (tension > .4 ? 1 : 2) === 0 && Math.random() < .55 + tension * .4) {
        const deg = a[(pas >> 1) % 3] + 7 * (1 + (Math.random() < .3 ? 1 : 0)), o = ac.createOscillator(), g = ac.createGain(), d = ac.createDelay(), fb = ac.createGain();
        o.type = 'triangle'; o.frequency.value = note(deg); g.gain.setValueAtTime(.07, t); g.gain.exponentialRampToValueAtTime(.0001, t + .6);
        d.delayTime.value = .375; fb.gain.value = .35; o.connect(g); g.connect(busMus); g.connect(d); d.connect(fb); fb.connect(d); d.connect(busMus); o.start(t); o.stop(t + .7);
      }
      // pulsation grave en combat
      if (tension > .25 && pas % 4 === 0) osc('sine', note(a[0]) / 2, note(a[0]) / 4, .35, .25 * tension, busMus);
      if (tension > .55 && pas % 2 === 1) souffle(.08, 'highpass', 6000, 4000, .08 * tension, busMus);
      pas++;
    }, 250);
    musique = { nappes, tic };
  }
  return {
    init, ui, monde, demarrerMusique,
    muet(v) { muet = v; if (maitre) maitre.gain.value = v ? 0 : .8; },
    debloquer() { if (init() && ac.state === 'suspended') ac.resume(); },
  };
}
