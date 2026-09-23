/**
 * ÉCHO — capture, lecture et déformations.
 *
 * Seul module du jeu à dépendre du navigateur. Tout ce qui décide de quelque
 * chose — le barème, les manches, la roue — vit dans `shared/mimic/` et se
 * teste sans lui.
 *
 * Le microphone n'est demandé qu'au moment où l'on en a besoin, jamais au
 * chargement : une page qui réclame le micro avant qu'on ait cliqué sur quoi
 * que ce soit est une page qu'on ferme.
 */

/** Fréquence de travail. Suffisante pour la voix, légère à transmettre. */
export const SR = 16000;

let ctx = null;
let flux = null;          // MediaStream, gardé entre les manches
let permission = 'inconnue';

/** Contexte audio, créé au premier geste de l'utilisateur. */
export function contexte() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const etatPermission = () => permission;

/**
 * Demande l'accès au micro. À n'appeler que sur un geste explicite.
 * @returns {Promise<{ok:boolean, raison?:string}>}
 */
export async function demanderMicro() {
  if (flux && flux.active) { permission = 'accordee'; return { ok: true }; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    permission = 'indisponible';
    return { ok: false, raison: 'Ce navigateur ne sait pas enregistrer.' };
  }

  /*
   * Les traitements automatiques du navigateur — réduction de bruit, gain
   * automatique, annulation d'écho — écrasent précisément ce que le jeu
   * mesure. On demande donc à les couper, mais en `ideal` et non en dur : posée
   * en contrainte ferme, la moindre option non gérée fait échouer TOUTE la
   * demande, et l'appareil refuse le micro alors qu'il en a un. Si la demande
   * détaillée échoue malgré tout, on se rabat sur la plus simple qui soit.
   */
  const essais = [
    {
      audio: {
        echoCancellation: { ideal: false },
        noiseSuppression: { ideal: false },
        autoGainControl: { ideal: false },
        channelCount: { ideal: 1 },
      },
    },
    { audio: true },
  ];

  let derniere = null;
  for (const contraintes of essais) {
    try {
      flux = await navigator.mediaDevices.getUserMedia(contraintes);
      permission = 'accordee';
      contexte();
      return { ok: true };
    } catch (e) {
      derniere = e;
      // Un refus de l'utilisateur ne se rattrape pas en réessayant.
      if (e && e.name === 'NotAllowedError') break;
    }
  }

  const nom = derniere && derniere.name;
  permission = nom === 'NotAllowedError' ? 'refusee' : 'erreur';
  const raisons = {
    NotAllowedError: 'Micro refusé. Le jeu ne peut pas se jouer sans.',
    NotFoundError: 'Aucun micro détecté sur cet appareil.',
    NotReadableError: 'Le micro est déjà utilisé par une autre application.',
    OverconstrainedError: 'Ce micro ne convient pas au jeu.',
  };
  return { ok: false, raison: raisons[nom] || `Micro indisponible (${nom || 'raison inconnue'}).` };
}

/** Coupe le micro. À faire en quittant : une pastille rouge inquiète. */
export function relacherMicro() {
  if (flux) { for (const t of flux.getTracks()) t.stop(); flux = null; }
  permission = 'inconnue';
}

/* ------------------------------------------------------------------ */
/* Enregistrement                                                      */
/* ------------------------------------------------------------------ */

/**
 * Enregistre pendant `secondes`, et rend les échantillons en 16 kHz mono.
 *
 * `onNiveau` reçoit le niveau courant, pour dessiner un vumètre : sans retour
 * visible, on ne sait pas si le micro capte quoi que ce soit.
 */
export async function enregistrer(secondes, onNiveau) {
  if (!flux || !flux.active) {
    const r = await demanderMicro();
    if (!r.ok) throw new Error(r.raison);
  }
  const c = contexte();
  const source = c.createMediaStreamSource(flux);
  const taille = 2048;
  const noeud = c.createScriptProcessor
    ? c.createScriptProcessor(taille, 1, 1)
    : null;
  if (!noeud) throw new Error('Enregistrement non supporté.');

  const morceaux = [];
  let total = 0;
  const cible = Math.round(secondes * c.sampleRate);

  const fini = new Promise((resolve) => {
    noeud.onaudioprocess = (e) => {
      const bloc = e.inputBuffer.getChannelData(0);
      const copie = new Float32Array(bloc.length);
      copie.set(bloc);
      morceaux.push(copie);
      total += copie.length;

      if (onNiveau) {
        let s = 0;
        for (let i = 0; i < copie.length; i++) s += copie[i] * copie[i];
        onNiveau(Math.sqrt(s / copie.length));
      }
      if (total >= cible) resolve();
    };
  });

  // Le processeur n'avance que s'il est branché ; une destination muette
  // suffit, et évite de se réentendre dans les enceintes.
  const muet = c.createGain();
  muet.gain.value = 0;
  source.connect(noeud);
  noeud.connect(muet);
  muet.connect(c.destination);

  await fini;
  noeud.onaudioprocess = null;
  try { source.disconnect(); noeud.disconnect(); muet.disconnect(); } catch { /* déjà défait */ }

  const brut = new Float32Array(total);
  let o = 0;
  for (const m of morceaux) { brut.set(m, o); o += m.length; }
  return reechantillonner(brut, c.sampleRate, SR);
}

/** Rééchantillonnage linéaire. Suffisant pour de la voix à 16 kHz. */
export function reechantillonner(x, de, vers) {
  if (de === vers) return x;
  const ratio = de / vers;
  const n = Math.floor(x.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i * ratio;
    const j = Math.floor(t);
    const f = t - j;
    out[i] = x[j] * (1 - f) + (x[j + 1] ?? x[j]) * f;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

/** Joue des échantillons, et rend une promesse qui tient jusqu'à la fin. */
export function jouer(samples, sampleRate = SR, { gain = 1 } = {}) {
  const c = contexte();
  const buf = c.createBuffer(1, samples.length, sampleRate);
  buf.copyToChannel ? buf.copyToChannel(samples, 0) : buf.getChannelData(0).set(samples);

  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(c.destination);
  src.start();
  return new Promise((r) => { src.onended = r; });
}

/* ------------------------------------------------------------------ */
/* Sabotages                                                           */
/* ------------------------------------------------------------------ */

/**
 * Déforme des échantillons pour la restitution.
 *
 * Ces transformations ne touchent JAMAIS la note : le barème a déjà jugé le
 * signal propre. C'est ce qui permet de saboter son voisin sans lui voler ses
 * points — on se moque de lui, on ne le vole pas.
 */
export function saboter(samples, sabotage) {
  if (!sabotage) return samples;
  const x = Float32Array.from(samples);

  if (sabotage === 'sature') {
    // Écrêtage franc : le son passe dans le rouge.
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * 14) * 0.8;
    return x;
  }

  if (sabotage === 'echo') {
    const retard = Math.round(0.13 * SR);
    for (let i = retard; i < x.length; i++) x[i] += x[i - retard] * 0.55;
    for (let i = 0; i < x.length; i++) x[i] = Math.max(-1, Math.min(1, x[i]));
    return x;
  }

  if (sabotage === 'hache') {
    // Un créneau ouvre et ferme le son quinze fois par seconde.
    const periode = Math.round(SR / 15);
    for (let i = 0; i < x.length; i++) {
      if ((i % periode) > periode * 0.45) x[i] = 0;
    }
    return x;
  }

  if (sabotage === 'canard') {
    // La voix disparaît, remplacée par un canard de synthèse de même durée.
    const n = x.length;
    const out = new Float32Array(n);
    let phase = 0;
    const coins = Math.max(1, Math.round(n / (SR * 0.22)));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const dansCoin = ((i / (n / coins)) % 1) < 0.55;
      const hz = 210 + 60 * Math.sin(t * 30);
      phase += (2 * Math.PI * hz) / SR;
      const dent = ((phase / (2 * Math.PI)) % 1) * 2 - 1;
      out[i] = dansCoin ? dent * 0.35 : 0;
    }
    return out;
  }

  return x;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/**
 * Comprime une prise pour le réseau : 16 kHz mono en 8 bits façon µ-law.
 *
 * Une prise de quatre secondes tombe ainsi à 64 ko, soit 85 ko une fois en
 * base64 — ce qui passe dans le WebSocket existant sans rien changer au
 * serveur. C'est du lo-fi assumé : dans un jeu où l'on imite un canard, la
 * fidélité n'est pas ce qui compte.
 */
export function comprimer(samples) {
  const n = samples.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    const signe = v < 0 ? 128 : 0;
    // Compression logarithmique : on garde de la finesse dans les faibles
    // niveaux, là où l'oreille en demande.
    const mag = Math.log1p(255 * Math.abs(v)) / Math.log(256);
    out[i] = signe | Math.min(127, Math.round(mag * 127));
  }
  return out;
}

export function decomprimer(octets) {
  const n = octets.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const signe = (octets[i] & 128) ? -1 : 1;
    const mag = (octets[i] & 127) / 127;
    out[i] = signe * (Math.pow(256, mag) - 1) / 255;
  }
  return out;
}

/** Base64 d'un Uint8Array, par morceaux pour ne pas saturer la pile. */
export function enBase64(octets) {
  let s = '';
  const pas = 0x8000;
  for (let i = 0; i < octets.length; i += pas) {
    s += String.fromCharCode.apply(null, octets.subarray(i, i + pas));
  }
  return btoa(s);
}

export function depuisBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
