/**
 * ÉCHO — les têtes et les bonhommes.
 *
 * Chaque joueur peut se prendre en photo : sa tête coiffe alors un petit
 * bonhomme qui chante quand c'est son tour, saute quand il gagne, et fait
 * grise mine quand on le sabote.
 *
 * La photo ne quitte l'appareil que pour une partie en ligne, le temps du
 * salon : elle est réduite à 128 × 128 pixels en JPEG — quelques kilo-octets,
 * de quoi reconnaître un visage et rien de plus.
 */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Taille de la photo conservée, en pixels de côté. */
export const COTE = 128;

/** Une couleur de maillot par place à la table. */
export const COULEURS = ['#f472b6', '#38bdf8', '#ffd84d', '#4ade80', '#a78bfa', '#ff8a3d', '#2dd4bf', '#fb7185'];

/** Une photo est-elle recevable ? Même contrôle que le serveur. */
export const photoValide = (p) =>
  typeof p === 'string' && p.startsWith('data:image/jpeg;base64,') && p.length <= 24000;

/* ------------------------------------------------------------------ */
/* Le bonhomme                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param {{name:string, photo?:string|null, tete?:string}} j
 * @param {{couleur?:string, cls?:string, badge?:string}} [o]
 */
export function bonhomme(j, o = {}) {
  const tete = j.photo && photoValide(j.photo)
    ? `<img src="${j.photo}" alt="" draggable="false">`
    : `<i>${esc(j.tete || (j.name || '?').trim().charAt(0).toUpperCase() || '?')}</i>`;
  return `<span class="bh ${o.cls || ''}" style="--bc:${o.couleur || COULEURS[0]}" aria-hidden="true">
    ${o.badge ? `<span class="bh-badge">${o.badge}</span>` : ''}
    <span class="bh-tete">${tete}</span>
    <svg class="bh-corps" viewBox="0 0 40 34">
      <path class="bh-bras bh-g" d="M11 9 Q5 14 3 21"/>
      <path class="bh-bras bh-d" d="M29 9 Q35 14 37 21"/>
      <rect class="bh-torse" x="10" y="3" width="20" height="19" rx="8"/>
      <path class="bh-jambe" d="M15 21 L14 32"/>
      <path class="bh-jambe" d="M25 21 L26 32"/>
    </svg>
    <span class="bh-micro">🎤</span>
  </span>`;
}

/* ------------------------------------------------------------------ */
/* La photo                                                            */
/* ------------------------------------------------------------------ */

let flux = null;
let resoudre = null;

/** Recadre une image ou une vidéo au carré central, en miroir si demandé. */
function recadrer(source, largeur, hauteur, miroir) {
  const c = document.createElement('canvas');
  c.width = COTE; c.height = COTE;
  const g = c.getContext('2d');
  const cote = Math.min(largeur, hauteur);
  const sx = (largeur - cote) / 2;
  const sy = (hauteur - cote) / 2;
  if (miroir) { g.translate(COTE, 0); g.scale(-1, 1); }
  g.drawImage(source, sx, sy, cote, cote, 0, 0, COTE, COTE);
  return c.toDataURL('image/jpeg', 0.72);
}

function couperCamera() {
  if (flux) { for (const t of flux.getTracks()) t.stop(); flux = null; }
  const v = $('photo-video');
  if (v) v.srcObject = null;
}

function finir(valeur) {
  couperCamera();
  $('ov-photo').hidden = true;
  const r = resoudre;
  resoudre = null;
  if (r) r(valeur);
}

/**
 * Ouvre la prise de vue.
 *
 * @param {{titre?:string, dejaUne?:boolean}} [o]
 * @returns {Promise<string|null|undefined>} la photo, `null` pour « sans
 *   photo », `undefined` si l'on a annulé.
 */
export async function prendrePhoto(o = {}) {
  if (resoudre) finir(undefined);
  $('photo-titre').textContent = o.titre || 'Votre tête';
  $('photo-retirer').hidden = !o.dejaUne;
  $('photo-dit').textContent = 'Placez le visage dans le rond.';
  $('photo-prendre').disabled = true;
  $('ov-photo').hidden = false;

  const promesse = new Promise((r) => { resoudre = r; });

  // La caméra n'est demandée qu'ici, sur un geste explicite.
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      if (!resoudre) { couperCamera(); return promesse; }   // annulé entre-temps
      const v = $('photo-video');
      v.srcObject = flux;
      await v.play().catch(() => {});
      $('photo-prendre').disabled = false;
    } catch (e) {
      $('photo-dit').textContent = e && e.name === 'NotAllowedError'
        ? 'Caméra refusée. Vous pouvez choisir une image à la place.'
        : 'Pas de caméra disponible. Choisissez une image à la place.';
    }
  } else {
    $('photo-dit').textContent = 'Ce navigateur ne donne pas accès à la caméra. Choisissez une image.';
  }
  return promesse;
}

function brancher() {
  $('photo-prendre').addEventListener('click', () => {
    const v = $('photo-video');
    if (!v.videoWidth) return;
    finir(recadrer(v, v.videoWidth, v.videoHeight, true));
  });
  $('photo-annuler').addEventListener('click', () => finir(undefined));
  $('photo-retirer').addEventListener('click', () => finir(null));
  $('photo-fichier').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const photo = recadrer(img, img.naturalWidth, img.naturalHeight, false);
      URL.revokeObjectURL(url);
      finir(photo);
    };
    img.onerror = () => { URL.revokeObjectURL(url); $('photo-dit').textContent = 'Image illisible.'; };
    img.src = url;
  });
}

brancher();
