/**
 * LE VELOURS NOIR — les croupiers.
 *
 * Un personnage en SVG, dessiné par le code, derrière chaque table : il
 * respire, cligne des yeux, distribue, ramasse, paie, lance la bille, sourit
 * et parle (une bulle, et sa voix si le navigateur en a une).
 */

import * as sfx from './sfx.js';
import { fini } from './effets.js';

export const CROUPIERS = {
  margot: { nom: 'Margot', peau: '#f1c7a5', ombre: '#d9a283', cheveux: '#2a1712', coiffure: 'chignon', gilet: '#5a1422', voix: 1.15, femme: true },
  henri: { nom: 'Henri', peau: '#e8b896', ombre: '#c99272', cheveux: '#8d8a86', coiffure: 'gomina', gilet: '#16151a', moustache: true, voix: 0.85 },
  victor: { nom: 'Victor', peau: '#b9825e', ombre: '#966343', cheveux: '#1b1210', coiffure: 'court', gilet: '#1d3a2c', visiere: true, voix: 0.98 },
};

const NS = 'http://www.w3.org/2000/svg';
const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function cheveux(p) {
  const c = p.cheveux;
  if (p.coiffure === 'chignon') {
    return `<circle cx="120" cy="44" r="17" fill="${c}"/>
      <path d="M84 96 C80 58 100 48 120 48 C142 48 160 58 156 96 C152 76 140 66 120 64 C100 66 88 76 84 96 Z" fill="${c}"/>
      <path d="M96 60 C108 52 132 52 144 60" stroke="#ffffff22" stroke-width="3" fill="none"/>
      <path d="M86 92 C84 100 85 110 88 116" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  }
  if (p.coiffure === 'gomina') {
    return `<path d="M85 92 C82 56 104 46 122 48 C144 48 160 60 155 92 C150 74 138 64 118 64 C100 64 90 74 85 92 Z" fill="${c}"/>
      <path d="M96 58 C110 50 132 50 146 60 M94 66 C110 58 130 58 150 68" stroke="#ffffff30" stroke-width="2" fill="none"/>`;
  }
  return `<path d="M86 88 C84 58 102 50 120 50 C140 50 158 58 154 88 C150 72 140 66 120 66 C102 66 92 72 86 88 Z" fill="${c}"/>`;
}

function svgCroupier(p) {
  const peau = p.peau, ombre = p.ombre;
  return `<svg viewBox="0 0 240 236" xmlns="${NS}" aria-hidden="true">
  <defs>
    <radialGradient id="pe-${p.nom}" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="${peau}"/><stop offset="1" stop-color="${ombre}"/></radialGradient>
    <linearGradient id="gi-${p.nom}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.gilet}"/><stop offset="1" stop-color="#000" stop-opacity=".9"/></linearGradient>
    <linearGradient id="ch-${p.nom}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf6ee"/><stop offset="1" stop-color="#cfc4b4"/></linearGradient>
    <linearGradient id="fond-${p.nom}" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></linearGradient>
  </defs>
  <g class="cr-corps">
    <path d="M30 236 C30 186 64 160 120 156 C176 160 210 186 210 236 Z" fill="url(#ch-${p.nom})"/>
    <path d="M42 236 C44 192 70 168 104 160 L120 214 L136 160 C170 168 196 192 198 236 Z" fill="url(#gi-${p.nom})"/>
    <path d="M104 160 L120 214 M136 160 L120 214" stroke="#d9b45a" stroke-width="1.6" opacity=".8"/>
    <circle cx="120" cy="196" r="2" fill="#d9b45a"/><circle cx="120" cy="208" r="2" fill="#d9b45a"/>
    <g transform="translate(120 162)">
      <path d="M0 0 L-17 -8 L-17 8 Z M0 0 L17 -8 L17 8 Z" fill="${p.femme ? '#d9b45a' : '#0b0709'}"/>
      <rect x="-4" y="-5" width="8" height="10" rx="2" fill="${p.femme ? '#b8913c' : '#26202a'}"/>
    </g>
    <rect x="62" y="184" width="30" height="11" rx="2" fill="#d9b45a"/>
    <text x="77" y="192.5" text-anchor="middle" font-size="7.5" font-family="Georgia,serif" font-weight="700" fill="#2a1a08">${p.nom.toUpperCase()}</text>
    <path d="M30 236 L210 236 L210 190 L30 190 Z" fill="url(#fond-${p.nom})"/>
  </g>
  <g class="cr-tete">
    <path d="M108 122 L132 122 L134 160 L106 160 Z" fill="${ombre}"/>
    <ellipse cx="85" cy="96" rx="6" ry="9" fill="${ombre}"/><ellipse cx="155" cy="96" rx="6" ry="9" fill="${ombre}"/>
    <ellipse cx="120" cy="92" rx="35" ry="41" fill="url(#pe-${p.nom})"/>
    ${cheveux(p)}
    ${p.visiere ? `<path d="M82 74 C100 62 140 62 158 74 L164 84 C140 74 100 74 76 84 Z" fill="#1f8a5a" opacity=".78"/><path d="M80 76 C100 66 140 66 160 76" stroke="#0b3a26" stroke-width="3" fill="none"/>` : ''}
    <path class="cr-sourcil" d="M100 80 Q107 75 114 79 M126 79 Q133 75 140 80" stroke="${p.coiffure === 'gomina' ? '#6d6a66' : p.cheveux}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g class="cr-yeux">
      <ellipse cx="107" cy="93" rx="3.6" ry="4.6" fill="#1a1012"/><ellipse cx="133" cy="93" rx="3.6" ry="4.6" fill="#1a1012"/>
      <circle cx="108.3" cy="91.4" r="1.2" fill="#fff"/><circle cx="134.3" cy="91.4" r="1.2" fill="#fff"/>
    </g>
    <path d="M120 96 Q116 106 120 108 Q123 108 124 106" stroke="${ombre}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <circle cx="99" cy="106" r="6" fill="#e0606a" opacity=".16"/><circle cx="141" cy="106" r="6" fill="#e0606a" opacity=".16"/>
    ${p.moustache ? `<path d="M104 116 Q112 108 120 113 Q128 108 136 116 Q128 114 120 117 Q112 114 104 116 Z" fill="#6d6a66"/>` : ''}
    <path class="cr-bouche" d="M110 119 Q120 123 130 119" stroke="#7a2a2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path class="cr-sourire" d="M108 117 Q120 130 132 117 Q120 123 108 117 Z" fill="#7a2a2e"/>
    <ellipse class="cr-parle" cx="120" cy="120" rx="5" ry="3.4" fill="#5a1a1e"/>
    ${p.femme ? '<circle cx="85" cy="108" r="2.6" fill="#d9b45a"/><circle cx="155" cy="108" r="2.6" fill="#d9b45a"/>' : ''}
  </g>
  <g class="cr-bras cr-bras-g">
    <path d="M58 182 Q40 204 60 226" stroke="url(#ch-${p.nom})" stroke-width="24" fill="none" stroke-linecap="round"/>
    <path d="M52 216 L70 222" stroke="#d9b45a" stroke-width="3"/>
    <ellipse cx="64" cy="231" rx="11" ry="8" fill="${peau}"/>
  </g>
  <g class="cr-bras cr-bras-d">
    <path d="M182 182 Q200 204 180 226" stroke="url(#ch-${p.nom})" stroke-width="24" fill="none" stroke-linecap="round"/>
    <path d="M188 216 L170 222" stroke="#d9b45a" stroke-width="3"/>
    <ellipse cx="176" cy="231" rx="11" ry="8" fill="${peau}"/>
  </g>
</svg>`;
}

/**
 * Installe un croupier dans `hote`.
 * @returns l'objet qui le fait bouger et parler.
 */
export function creerCroupier(hote, id) {
  const p = CROUPIERS[id];
  hote.classList.add('croupier', `croupier-${id}`);
  hote.innerHTML = `${svgCroupier(p)}<div class="bulle" role="status" aria-live="polite"></div>`;
  const svg = hote.querySelector('svg');
  const q = (s) => svg.querySelector(s);
  const brasG = q('.cr-bras-g'), brasD = q('.cr-bras-d'), tete = q('.cr-tete'), yeux = q('.cr-yeux'), parle = q('.cr-parle');
  const bulle = hote.querySelector('.bulle');
  for (const [el, o] of [[brasG, '58px 182px'], [brasD, '182px 182px'], [tete, '120px 150px'], [yeux, '120px 93px'], [parle, '120px 120px']]) {
    el.style.transformBox = 'view-box';
    el.style.transformOrigin = o;
  }
  const anim = (el, kf, duree, easing = 'cubic-bezier(.3,.7,.3,1)') => (reduit() ? Promise.resolve() : fini(el.animate(kf, { duration: duree, easing })));

  // la vie : cligner des yeux de temps en temps
  let clin = null;
  const cligner = () => {
    clin = setTimeout(() => {
      if (!document.hidden && hote.isConnected) anim(yeux, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.1)' }, { transform: 'scaleY(1)' }], 150, 'ease-in-out');
      cligner();
    }, 1800 + Math.random() * 3800);
  };
  cligner();

  let bulleT = null, parleA = null;
  const c = {
    p, el: hote,
    /** Distribuer une carte (vers la gauche ou la droite de l'écran). */
    donne(vers = 0) {
      const bras = vers < 0 ? brasG : brasD;
      const a = vers < 0 ? -1 : 1;
      return anim(bras, [{ transform: 'none' }, { transform: `rotate(${a * (18 + Math.abs(vers) * 12)}deg) scale(1.22)` }, { transform: 'none' }], 330);
    },
    /** Ramasser les mises : les deux bras balaient vers soi. */
    ramasse() {
      anim(brasG, [{ transform: 'none' }, { transform: 'rotate(-30deg) scale(1.35)' }, { transform: 'rotate(8deg) scale(.95)' }, { transform: 'none' }], 650);
      return anim(brasD, [{ transform: 'none' }, { transform: 'rotate(30deg) scale(1.35)' }, { transform: 'rotate(-8deg) scale(.95)' }, { transform: 'none' }], 650);
    },
    /** Pousser les gains vers le joueur. */
    paie() {
      return anim(brasG, [{ transform: 'none' }, { transform: 'rotate(-12deg) scale(1.42)' }, { transform: 'none' }], 520);
    },
    /** Lancer la roue puis la bille. */
    lance() {
      anim(tete, [{ transform: 'none' }, { transform: 'rotate(-6deg) translateY(2px)' }, { transform: 'none' }], 700);
      return anim(brasD, [{ transform: 'none' }, { transform: 'rotate(-20deg) scale(1.1)' }, { transform: 'rotate(40deg) scale(1.3)' }, { transform: 'none' }], 700);
    },
    /** Un petit hochement de tête. */
    salue() { return anim(tete, [{ transform: 'none' }, { transform: 'rotate(4deg) translateY(4px)' }, { transform: 'none' }], 500); },
    /** Un sourire pendant un moment. */
    sourit(ms = 1600) {
      hote.classList.add('sourit');
      clearTimeout(c._s);
      c._s = setTimeout(() => hote.classList.remove('sourit'), ms);
    },
    /** Un air désolé (le joueur perd gros). */
    desole(ms = 1400) {
      hote.classList.add('desole');
      clearTimeout(c._d);
      c._d = setTimeout(() => hote.classList.remove('desole'), ms);
    },
    /** Parler : la bulle, la bouche, et la voix. */
    dire(texte, { duree = 0, voix = true } = {}) {
      bulle.textContent = texte;
      bulle.classList.remove('vue');
      void bulle.offsetWidth;
      bulle.classList.add('vue');
      hote.classList.add('parle');
      parleA?.cancel();
      if (!reduit()) parleA = parle.animate([{ transform: 'scaleY(.3)' }, { transform: 'scaleY(1)' }, { transform: 'scaleY(.4)' }], { duration: 170, iterations: Math.max(2, Math.round(texte.length / 4)), direction: 'alternate' });
      parleA?.finished.then(() => hote.classList.remove('parle'), () => {});
      clearTimeout(bulleT);
      bulleT = setTimeout(() => bulle.classList.remove('vue'), duree || 1600 + texte.length * 45);
      if (voix) sfx.dire(texte, { hauteur: p.voix });
    },
    taire() { clearTimeout(bulleT); bulle.classList.remove('vue'); },
    detruire() { clearTimeout(clin); clearTimeout(bulleT); },
  };
  return c;
}
