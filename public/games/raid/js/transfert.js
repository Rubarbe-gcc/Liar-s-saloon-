/**
 * RAID — passer sa partie d'un appareil à l'autre.
 *
 * La partie vit dans le navigateur de l'appareil : il n'y a ni compte ni
 * serveur qui la garde. Pour la reprendre ailleurs, on la transforme en un
 * « code de partie » — du texte, compressé — qu'on s'envoie à soi-même
 * (message, mail, note) et qu'on colle sur l'autre appareil.
 *
 * Format : `RAID1.` suivi de la partie en JSON, compressée (gzip) puis écrite
 * en base64 sans caractères gênants. `RAID0.` : la même chose sans
 * compression, pour un navigateur qui ne sait pas compresser.
 */

const b64 = (octets) => {
  let s = '';
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deB64 = (texte) => {
  const s = atob(texte.replace(/-/g, '+').replace(/_/g, '/'));
  const o = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
  return o;
};

async function passer(octets, flux) {
  const sortie = new Blob([octets]).stream().pipeThrough(flux);
  return new Uint8Array(await new Response(sortie).arrayBuffer());
}

/** Transforme une partie (et la progression des chapitres) en code. */
export async function versCode(partie, progression = null) {
  const octets = new TextEncoder().encode(JSON.stringify({ partie, progression }));
  if (typeof CompressionStream === 'function') {
    try { return `RAID1.${b64(await passer(octets, new CompressionStream('gzip')))}`; } catch { /* on retombe sur le brut */ }
  }
  return `RAID0.${b64(octets)}`;
}

/**
 * Relit un code. Renvoie `{ ok, partie, progression }`, ou `{ ok: false,
 * raison }` avec une raison lisible : un code tronqué par un copier-coller
 * est le cas le plus courant.
 */
export async function depuisCode(code) {
  const net = String(code || '').replace(/\s+/g, '');
  const m = /^RAID([01])\.([A-Za-z0-9_-]+)$/.exec(net);
  if (!m) return { ok: false, raison: 'Ce n’est pas un code de partie RAID.' };
  try {
    let octets = deB64(m[2]);
    if (m[1] === '1') {
      if (typeof DecompressionStream !== 'function') return { ok: false, raison: 'Ce navigateur est trop ancien pour lire ce code.' };
      octets = await passer(octets, new DecompressionStream('gzip'));
    }
    const { partie, progression } = JSON.parse(new TextDecoder().decode(octets));
    if (!partie || partie.version !== 2 || !Array.isArray(partie.groupe) || !partie.groupe.length) {
      return { ok: false, raison: 'Ce code ne contient pas de partie valide.' };
    }
    return { ok: true, partie, progression: progression || null };
  } catch {
    return { ok: false, raison: 'Code incomplet ou abîmé : recopiez-le en entier.' };
  }
}
