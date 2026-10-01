/**
 * RAID — les portraits des boss et des élites.
 *
 * Le menu fretin garde ses sprites en pixels ; les maîtres du donjon ont
 * droit à une vraie illustration, dessinée en SVG et animée par la feuille
 * de style (souffle, flammes, yeux qui luisent). `currentColor` — la couleur de
 * l'école, posée sur la carte de l'unité — teinte tout ce qui brille.
 *
 * Aucune règle ici : seulement du dessin.
 */

const A = 'currentColor';

/** Dessine un motif et son reflet : les monstres sont vus de face. */
const miroir = (g) => `<g>${g}</g><g transform="matrix(-1 0 0 1 200 0)">${g}</g>`;

const defs = (id, sombre, clair) => `<defs>
  <linearGradient id="${id}-corps" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${clair}"/><stop offset="1" stop-color="${sombre}"/></linearGradient>
  <radialGradient id="${id}-halo"><stop offset="0" stop-color="${A}" stop-opacity=".85"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></radialGradient>
  <filter id="${id}-flou" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
</defs>`;

const braises = (id) => [[30, 120, 2.2, 0], [168, 104, 1.8, 1.1], [52, 60, 1.5, 2], [150, 44, 2, .6], [100, 14, 1.6, 1.6], [16, 70, 1.4, 2.4]]
  .map(([x, y, r, d]) => `<circle class="b-braise" style="animation-delay:-${d}s" cx="${x}" cy="${y}" r="${r}" fill="${A}"/>`).join('');

const ART = {
  /* ---------------------------------------------------------------- */
  /* Sarkhavel, le Dragon Cendré                                      */
  /* ---------------------------------------------------------------- */
  sarkhavel: () => `${defs('sk', '#120b0a', '#4a3a36')}
    <ellipse cx="100" cy="92" rx="96" ry="70" fill="url(#sk-halo)" opacity=".5" class="b-pouls"/>
    <g class="b-aile">${miroir(`
      <path d="M96 78 L22 6 L6 58 L26 50 L18 96 L42 80 L44 120 L78 100 Z" fill="#241615" stroke="#0a0606" stroke-width="2"/>
      <path d="M96 78 L22 6 M96 78 L26 50 M96 78 L42 80 M96 78 L62 106" stroke="#5a3a34" stroke-width="2.5" fill="none"/>
      <path d="M22 6 l-6 -5 l2 9 Z" fill="#d9cdb8"/>`)}</g>
    <g class="b-souffle">
      <path d="M62 160 C52 124 70 96 100 92 C130 96 148 124 138 160 Z" fill="url(#sk-corps)" stroke="#0a0606" stroke-width="2"/>
      ${[112, 124, 136, 148].map((y, i) => `<path d="M${84 - i * 2} ${y} Q100 ${y + 7} ${116 + i * 2} ${y}" stroke="#8a6a52" stroke-width="3" fill="none" opacity=".7"/>`).join('')}
      ${miroir(`
        <path d="M76 52 C58 40 46 22 52 2 C60 22 72 34 88 44 Z" fill="#d9cdb8" stroke="#0a0606" stroke-width="1.5"/>
        <path d="M70 66 C56 62 46 52 44 40 C54 48 64 52 76 56 Z" fill="#b8ab94" stroke="#0a0606" stroke-width="1.5"/>`)}
      <path d="M100 34 L130 50 L140 80 L120 106 L100 116 L80 106 L60 80 L70 50 Z" fill="url(#sk-corps)" stroke="#0a0606" stroke-width="2"/>
      <path d="M100 34 L108 52 L100 62 L92 52 Z" fill="#5d4a44"/>
      <path d="M100 20 l5 16 l-10 0 Z M86 30 l6 12 l-10 2 Z M114 30 l-6 12 l10 2 Z" fill="#d9cdb8"/>
      ${miroir(`<path class="b-oeil" d="M72 66 L94 74 L78 82 Z" fill="${A}"/><path d="M82 72 l5 3 l-5 3 Z" fill="#120606"/>
        <ellipse cx="92" cy="90" rx="2.5" ry="1.5" fill="#0a0606"/>`)}
      <path d="M78 94 L100 102 L122 94 L116 110 L100 116 L84 110 Z" fill="#1a0806"/>
      <path class="b-flamme" d="M84 98 L100 104 L116 98 L112 108 L100 113 L88 108 Z" fill="${A}"/>
      <path d="M80 94 l4 8 l4 -6 Z M92 99 l3 7 l3 -6 Z M102 100 l3 7 l3 -7 Z M112 96 l4 6 l4 -8 Z" fill="#f4ecd8"/>
    </g>
    <ellipse class="b-flamme" cx="100" cy="124" rx="20" ry="26" fill="url(#sk-halo)" filter="url(#sk-flou)"/>
    ${braises('sk')}`,

  /* ---------------------------------------------------------------- */
  /* Nélizar, l'Archiliche                                             */
  /* ---------------------------------------------------------------- */
  nelizar: () => `${defs('nz', '#0b0614', '#3b2358')}
    <circle cx="100" cy="74" r="74" fill="url(#nz-halo)" opacity=".35" class="b-pouls"/>
    <g class="b-flotte">
      <path d="M100 22 C68 22 54 50 54 82 C48 112 38 140 26 158 L50 144 L62 160 L78 144 L90 160 L100 146 L110 160 L122 144 L138 160 L150 144 L174 158 C162 140 152 112 146 82 C146 50 132 22 100 22 Z" fill="url(#nz-corps)" stroke="#05030a" stroke-width="2"/>
      <path d="M100 92 L92 150 M100 92 L108 150 M78 96 L64 146 M122 96 L136 146" stroke="#1a0e2c" stroke-width="3" fill="none"/>
      <ellipse cx="100" cy="64" rx="28" ry="32" fill="#06030c"/>
      ${[96, 104, 112].map((y) => `<path d="M84 ${y} Q100 ${y + 6} 116 ${y}" stroke="#cfc7ae" stroke-width="2.5" fill="none" opacity=".8"/>`).join('')}
      <path d="M100 96 v24" stroke="#cfc7ae" stroke-width="3"/>
      <path d="M100 38 C84 38 77 50 77 61 C77 71 83 76 88 78 L88 87 L112 87 L112 78 C117 76 123 71 123 61 C123 50 116 38 100 38 Z" fill="#ece5d0" stroke="#05030a" stroke-width="1.5"/>
      ${miroir(`<ellipse cx="90" cy="61" rx="6" ry="7" fill="#05030a"/><circle class="b-oeil" cx="90" cy="61" r="3" fill="${A}"/>`)}
      <path d="M100 68 l-3 7 l6 0 Z" fill="#05030a"/>
      <path d="M90 80 v7 M95 80 v7 M100 80 v7 M105 80 v7 M110 80 v7" stroke="#05030a" stroke-width="1.2"/>
      <path d="M78 42 L82 22 L91 36 L100 14 L109 36 L118 22 L122 42 Z" fill="#e2b33c" stroke="#05030a" stroke-width="1.5"/>
      <circle cx="100" cy="32" r="3.5" fill="${A}" class="b-oeil"/>
      ${miroir(`
        <path d="M58 92 L36 84" stroke="#cfc7ae" stroke-width="4" stroke-linecap="round"/>
        <path d="M36 84 l-8 -10 M36 84 l-11 -3 M36 84 l-9 5 M36 84 l-3 -12" stroke="#ece5d0" stroke-width="2.2" stroke-linecap="round"/>
        <circle class="b-flamme" cx="26" cy="64" r="13" fill="url(#nz-halo)"/>
        <path class="b-flamme" d="M26 50 C32 58 34 64 30 70 C28 73 24 73 22 70 C18 64 22 58 26 50 Z" fill="${A}"/>`)}
    </g>
    ${[[60, 16, 0], [146, 22, 1.3], [12, 118, .7], [186, 126, 2]].map(([x, y, d]) =>
    `<g class="b-braise" style="animation-delay:-${d}s"><circle cx="${x}" cy="${y}" r="5" fill="#ece5d0"/><circle cx="${x - 2}" cy="${y - 1}" r="1.3" fill="#05030a"/><circle cx="${x + 2}" cy="${y - 1}" r="1.3" fill="#05030a"/></g>`).join('')}`,

  /* ---------------------------------------------------------------- */
  /* Vorgath le Boucher                                                */
  /* ---------------------------------------------------------------- */
  vorgath: () => `${defs('vg', '#2b2a1c', '#7c7a55')}
    <ellipse cx="100" cy="100" rx="92" ry="62" fill="url(#vg-halo)" opacity=".3" class="b-pouls"/>
    <g class="b-souffle">
      <g class="b-bras">
        <path d="M150 84 L172 40" stroke="#5d5b40" stroke-width="16" stroke-linecap="round"/>
        <path d="M166 50 L176 10" stroke="#4a3018" stroke-width="6" stroke-linecap="round"/>
        <path d="M172 4 L198 10 L196 52 L170 46 Z" fill="#b9bcc2" stroke="#15151a" stroke-width="2"/>
        <path d="M196 12 L196 52 L190 50 L190 12 Z" fill="#f3f4f6"/>
        <circle cx="180" cy="14" r="3" fill="#15151a"/>
        <path d="M192 30 q-6 10 -2 20 l6 2 Z" fill="#a3191b"/>
      </g>
      <path d="M50 84 L22 112" stroke="#5d5b40" stroke-width="16" stroke-linecap="round"/>
      <path d="M22 112 L14 150" stroke="#8a8d94" stroke-width="3" stroke-dasharray="5 3"/>
      <path d="M14 148 q-10 6 -4 12 q6 2 8 -4" stroke="#b9bcc2" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="100" cy="112" rx="60" ry="48" fill="url(#vg-corps)" stroke="#15150d" stroke-width="2"/>
      ${miroir(`<path d="M46 78 L30 56 L52 66 L48 46 L66 64 L72 80 Z" fill="#6b6d73" stroke="#15151a" stroke-width="2"/>`)}
      <path d="M68 84 L132 84 L142 160 L58 160 Z" fill="#d8d2bd" stroke="#15150d" stroke-width="2"/>
      <path d="M68 84 L80 62 M132 84 L120 62" stroke="#d8d2bd" stroke-width="5"/>
      <path d="M78 100 q10 14 4 30 q-10 -6 -4 -30 Z M112 120 q14 4 12 24 q-12 -4 -12 -24 Z M96 142 q8 4 6 14 q-8 -2 -6 -14 Z" fill="#a3191b"/>
      <path d="M84 92 h32 M84 98 h32" stroke="#8a8468" stroke-width="1.5"/>
      <circle cx="100" cy="50" r="25" fill="#7c7a55" stroke="#15150d" stroke-width="2"/>
      <path d="M76 42 C80 24 120 24 124 42 L122 68 C112 78 88 78 78 68 Z" fill="#8a8d94" stroke="#15151a" stroke-width="2"/>
      <path d="M100 26 v50" stroke="#15151a" stroke-width="2"/>
      <path d="M82 46 L96 50 L84 54 Z" fill="#15151a"/>
      <path class="b-oeil" d="M118 46 L104 50 L116 54 Z" fill="${A}"/>
      <path d="M86 64 h28 M90 61 v6 M96 61 v6 M104 61 v6 M110 61 v6" stroke="#15151a" stroke-width="1.8"/>
      <circle cx="80" cy="36" r="1.8" fill="#15151a"/><circle cx="120" cy="36" r="1.8" fill="#15151a"/><circle cx="80" cy="66" r="1.8" fill="#15151a"/><circle cx="120" cy="66" r="1.8" fill="#15151a"/>
    </g>`,

  /* ---------------------------------------------------------------- */
  /* Hurlefer                                                          */
  /* ---------------------------------------------------------------- */
  hurlefer: () => `${defs('hf', '#16161b', '#55565f')}
    <circle cx="100" cy="86" r="76" fill="url(#hf-halo)" opacity=".3" class="b-pouls"/>
    ${[40, 54, 68].map((r, i) => `<path class="b-onde" style="animation-delay:-${i * 0.5}s" d="M${100 - r} 130 A${r} ${r} 0 0 0 ${100 + r} 130" fill="none" stroke="${A}" stroke-width="2.5" opacity=".5"/>`).join('')}
    <g class="b-souffle">
      ${miroir(`
        <path d="M70 46 L46 2 L92 30 Z" fill="url(#hf-corps)" stroke="#08080b" stroke-width="2"/>
        <path d="M68 38 L54 14 L82 30 Z" fill="#8c2f3a"/>
        <path d="M58 60 L20 48 L44 72 L14 80 L46 92 L24 112 L60 108 Z" fill="url(#hf-corps)" stroke="#08080b" stroke-width="2"/>`)}
      <path d="M100 24 L140 46 L148 86 L128 118 L100 150 L72 118 L52 86 L60 46 Z" fill="url(#hf-corps)" stroke="#08080b" stroke-width="2"/>
      <path d="M100 24 L112 58 L100 72 L88 58 Z" fill="#6f7079"/>
      ${miroir(`<path class="b-oeil" d="M66 62 L92 70 L72 80 Z" fill="${A}"/><path d="M78 68 l6 3 l-6 4 Z" fill="#08080b"/>
        <path d="M60 58 L94 64" stroke="#08080b" stroke-width="4" stroke-linecap="round"/>`)}
      <path d="M78 90 L122 90 L130 112 L100 150 L70 112 Z" fill="#9a9da6" stroke="#08080b" stroke-width="2"/>
      <path d="M92 90 L100 100 L108 90 Z" fill="#08080b"/>
      <path d="M78 108 L100 116 L122 108 L112 134 L100 146 L88 134 Z" fill="#2a0709"/>
      <path d="M92 124 L100 130 L108 124 L104 140 L100 144 L96 140 Z" fill="#b8323c"/>
      <path d="M79 108 l5 14 l5 -11 Z M91 113 l4 10 l4 -9 Z M101 114 l4 10 l4 -10 Z M111 111 l5 11 l5 -14 Z" fill="#f4f4f6"/>
      ${[[74, 96], [126, 96], [84, 102], [116, 102], [100, 94]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#08080b"/>`).join('')}
    </g>`,

  /* ---------------------------------------------------------------- */
  /* Banshie pâle                                                      */
  /* ---------------------------------------------------------------- */
  banshie: () => `${defs('bs', '#22303a', '#dfeef2')}
    <circle cx="100" cy="76" r="74" fill="url(#bs-halo)" opacity=".3" class="b-pouls"/>
    ${[26, 40, 54].map((r, i) => `<circle class="b-onde" style="animation-delay:-${i * 0.5}s" cx="100" cy="84" r="${r}" fill="none" stroke="${A}" stroke-width="2" opacity=".45"/>`).join('')}
    <g class="b-flotte">
      ${miroir(`
        <path d="M78 34 C40 30 22 60 10 44 C16 78 30 84 22 112 C40 100 44 120 40 146 C58 126 62 100 72 86 Z" fill="#b9c9d0" stroke="#17232b" stroke-width="2" opacity=".85"/>
        <path d="M70 92 C52 96 40 84 28 92" stroke="#dfeef2" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M28 92 l-10 -6 M28 92 l-12 2 M28 92 l-8 9" stroke="#dfeef2" stroke-width="2.4" stroke-linecap="round"/>`)}
      <path d="M100 20 C72 20 62 46 64 74 C62 104 56 132 46 158 L64 146 L76 160 L88 146 L100 160 L112 146 L124 160 L136 146 L154 158 C144 132 138 104 136 74 C138 46 128 20 100 20 Z" fill="url(#bs-corps)" stroke="#17232b" stroke-width="2" opacity=".92"/>
      <path d="M100 30 C84 30 76 44 76 60 C76 80 86 100 100 108 C114 100 124 80 124 60 C124 44 116 30 100 30 Z" fill="#f4fbfc" stroke="#17232b" stroke-width="1.5"/>
      ${miroir(`<path d="M80 50 L96 58 L94 68 L82 64 Z" fill="#0b1217"/><circle class="b-oeil" cx="89" cy="60" r="2.6" fill="${A}"/>
        <path d="M88 68 q-2 12 -1 22" stroke="#0b1217" stroke-width="1.6" fill="none"/>`)}
      <ellipse class="b-cri" cx="100" cy="88" rx="9" ry="14" fill="#0b1217"/>
      <path d="M94 78 l2 5 l2 -5 Z M102 78 l2 5 l2 -5 Z" fill="#f4fbfc"/>
    </g>`,

  /* ---------------------------------------------------------------- */
  /* Sentinelle de fer                                                 */
  /* ---------------------------------------------------------------- */
  sentinelle: () => `${defs('st', '#1b1e24', '#7d848f')}
    <ellipse cx="100" cy="96" rx="90" ry="64" fill="url(#st-halo)" opacity=".25" class="b-pouls"/>
    <g class="b-souffle">
      ${miroir(`
        <path d="M60 70 L18 58 L30 44 L14 30 L40 36 L44 18 L58 42 L70 56 Z" fill="url(#st-corps)" stroke="#07080a" stroke-width="2"/>
        <path d="M40 66 L30 126 L52 132 L60 78 Z" fill="url(#st-corps)" stroke="#07080a" stroke-width="2"/>
        <circle cx="42" cy="134" r="12" fill="#5d636d" stroke="#07080a" stroke-width="2"/>`)}
      <path d="M62 62 L138 62 L146 160 L54 160 Z" fill="url(#st-corps)" stroke="#07080a" stroke-width="2"/>
      <path d="M76 84 L124 84 L128 160 L72 160 Z" fill="#2a2e36" stroke="#07080a" stroke-width="2"/>
      ${[84, 94, 106, 116].map((x) => `<path d="M${x} 86 V160" stroke="#8d95a1" stroke-width="3"/>`).join('')}
      <path d="M74 108 H126 M73 132 H127" stroke="#8d95a1" stroke-width="3"/>
      ${[84, 94, 106, 116].map((x) => `<path d="M${x - 3} 160 l3 -8 l3 8 Z" fill="#c9ced6"/>`).join('')}
      <path d="M100 10 L132 26 L134 62 L100 74 L66 62 L68 26 Z" fill="url(#st-corps)" stroke="#07080a" stroke-width="2"/>
      <path d="M100 10 V74" stroke="#07080a" stroke-width="2"/>
      <path d="M100 2 L106 14 L94 14 Z" fill="#c9ced6" stroke="#07080a" stroke-width="1.2"/>
      <path d="M72 38 H128 V46 H72 Z" fill="#07080a"/>
      <path class="b-oeil" d="M76 40 H124 V44 H76 Z" fill="${A}"/>
      <path d="M88 54 v10 M94 54 v12 M100 54 v13 M106 54 v12 M112 54 v10" stroke="#07080a" stroke-width="2"/>
      ${[[70, 30], [130, 30], [70, 58], [130, 58], [60, 70], [140, 70], [58, 150], [142, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#c9ced6" stroke="#07080a" stroke-width=".8"/>`).join('')}
    </g>`,

  /* ---------------------------------------------------------------- */
  /* Minotaure des forges                                              */
  /* ---------------------------------------------------------------- */
  minotaure: () => `${defs('mn', '#24100a', '#8f4d2e')}
    <ellipse cx="100" cy="96" rx="92" ry="64" fill="url(#mn-halo)" opacity=".28" class="b-pouls"/>
    <g class="b-bras">
      <path d="M150 156 L178 22" stroke="#4a3018" stroke-width="7" stroke-linecap="round"/>
      <path d="M178 22 C202 14 204 44 192 56 C184 46 178 42 172 42 Z" fill="#b9bcc2" stroke="#15151a" stroke-width="2"/>
      <path d="M178 22 C154 16 146 42 154 58 C162 48 168 44 174 42 Z" fill="#9a9da6" stroke="#15151a" stroke-width="2"/>
    </g>
    <g class="b-souffle">
      <path d="M26 160 C26 112 58 94 100 94 C142 94 174 112 174 160 Z" fill="url(#mn-corps)" stroke="#120805" stroke-width="2"/>
      <path d="M74 110 Q100 124 126 110 M70 128 Q100 142 130 128" stroke="#5a2a18" stroke-width="3" fill="none"/>
      ${miroir(`
        <path d="M74 50 C42 50 20 32 24 4 C36 28 56 34 84 36 Z" fill="#e2d6bd" stroke="#120805" stroke-width="2"/>
        <path d="M64 56 L38 60 L62 72 Z" fill="#8f4d2e" stroke="#120805" stroke-width="1.5"/>`)}
      <path d="M100 30 L136 44 L142 78 L122 104 L114 130 L86 130 L78 104 L58 78 L64 44 Z" fill="url(#mn-corps)" stroke="#120805" stroke-width="2"/>
      <path d="M100 30 L108 50 L100 60 L92 50 Z" fill="#5a2a18"/>
      <ellipse cx="100" cy="114" rx="21" ry="16" fill="#c9906c" stroke="#120805" stroke-width="1.5"/>
      ${miroir(`<ellipse cx="91" cy="114" rx="3.5" ry="4.5" fill="#120805"/>
        <path class="b-oeil" d="M72 66 L95 73 L77 81 Z" fill="${A}"/>
        <path d="M66 60 L97 68" stroke="#120805" stroke-width="4" stroke-linecap="round"/>`)}
      <path d="M89 124 a11 11 0 0 0 22 0" fill="none" stroke="#e2b33c" stroke-width="3.5"/>
    </g>
    ${[[84, 104, 0], [116, 104, .8], [78, 96, 1.6], [122, 96, 2.3]].map(([x, y, d]) => `<circle class="b-braise" style="animation-delay:-${d}s" cx="${x}" cy="${y}" r="4" fill="#f4ecd8" opacity=".5"/>`).join('')}`,

  /* ---------------------------------------------------------------- */
  /* La Tisseuse                                                       */
  /* ---------------------------------------------------------------- */
  tisseuse: () => `${defs('ts', '#0d0712', '#4a2b58')}
    <circle cx="100" cy="80" r="76" fill="url(#ts-halo)" opacity=".28" class="b-pouls"/>
    <path d="M100 0 V50 M40 0 L84 60 M160 0 L116 60 M0 30 L70 70 M200 30 L130 70" stroke="#e8e2f0" stroke-width="1" opacity=".35"/>
    <g class="b-souffle">
      ${miroir(`
        <path d="M84 92 Q52 34 12 62" stroke="#1a0f1f" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M82 100 Q38 64 6 104" stroke="#1a0f1f" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M84 108 Q42 106 12 148" stroke="#1a0f1f" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M88 116 Q62 130 46 160" stroke="#1a0f1f" stroke-width="7" fill="none" stroke-linecap="round"/>
        <circle cx="50" cy="48" r="4" fill="#4a2b58"/><circle cx="40" cy="78" r="4" fill="#4a2b58"/><circle cx="44" cy="112" r="4" fill="#4a2b58"/>`)}
      <ellipse cx="100" cy="58" rx="46" ry="40" fill="url(#ts-corps)" stroke="#07030a" stroke-width="2"/>
      <path class="b-oeil" d="M90 36 L110 36 L102 56 L110 78 L90 78 L98 56 Z" fill="${A}"/>
      <ellipse cx="100" cy="108" rx="31" ry="25" fill="url(#ts-corps)" stroke="#07030a" stroke-width="2"/>
      ${miroir(`
        <circle class="b-oeil" cx="89" cy="104" r="6" fill="${A}"/><circle cx="90" cy="104" r="2.2" fill="#07030a"/>
        <circle class="b-oeil" cx="77" cy="98" r="3.5" fill="${A}"/>
        <circle class="b-oeil" cx="84" cy="92" r="2.8" fill="${A}"/>
        <circle class="b-oeil" cx="94" cy="92" r="2.2" fill="${A}"/>
        <path d="M90 124 Q84 142 94 150 Q97 136 97 126 Z" fill="#ece5d0" stroke="#07030a" stroke-width="1.5"/>`)}
    </g>
    <circle class="b-braise" cx="94" cy="150" r="2.5" fill="#8be06a"/><circle class="b-braise" style="animation-delay:-1.4s" cx="106" cy="150" r="2.5" fill="#8be06a"/>`,

  /* ---------------------------------------------------------------- */
  /* Ysolde, la Reine de Givre                                         */
  /* ---------------------------------------------------------------- */
  ysolde: () => `${defs('ys', '#0c1a2e', '#3f74a8')}
    <circle cx="100" cy="74" r="76" fill="url(#ys-halo)" opacity=".35" class="b-pouls"/>
    <g class="b-flotte">
      <path d="M100 38 C58 42 42 92 26 160 L174 160 C158 92 142 42 100 38 Z" fill="url(#ys-corps)" stroke="#050b14" stroke-width="2"/>
      ${miroir(`
        <path d="M80 42 C58 60 62 102 48 124 C66 112 74 90 80 64 Z" fill="#d4ecfa" stroke="#050b14" stroke-width="1.5"/>
        <path d="M70 94 L38 80 L52 100 L34 110 L66 112 Z" fill="#9fd0ee" stroke="#050b14" stroke-width="1.5"/>
        <path d="M82 40 L64 8 L92 32 Z" fill="#e8f7ff" stroke="#050b14" stroke-width="1.5"/>
        <path d="M72 50 L46 30 L78 42 Z" fill="#bfe2f6" stroke="#050b14" stroke-width="1.5"/>`)}
      <path d="M92 36 L100 0 L108 36 Z" fill="#e8f7ff" stroke="#050b14" stroke-width="1.5"/>
      <path d="M80 92 L120 92 L136 160 L64 160 Z" fill="#dff3ff" stroke="#050b14" stroke-width="1.5" opacity=".92"/>
      <path d="M100 96 V160 M90 100 L80 160 M110 100 L120 160" stroke="#9fd0ee" stroke-width="1.5"/>
      <path d="M100 34 C84 34 77 48 77 61 C77 80 90 92 100 96 C110 92 123 80 123 61 C123 48 116 34 100 34 Z" fill="#f1faff" stroke="#050b14" stroke-width="1.5"/>
      ${miroir(`<path class="b-oeil" d="M81 59 L96 62 L84 68 Z" fill="${A}"/><path d="M80 54 L96 57" stroke="#050b14" stroke-width="2" stroke-linecap="round"/>`)}
      <path d="M94 80 Q100 84 106 80" stroke="#3f74a8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle class="b-flamme" cx="100" cy="126" r="15" fill="url(#ys-halo)"/>
      <path class="b-oeil" d="M100 112 V140 M88 119 L112 133 M112 119 L88 133" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    ${[[24, 40, 0], [176, 30, 1], [14, 110, 2], [186, 100, .5], [60, 14, 1.5], [140, 10, 2.6]].map(([x, y, d]) => `<circle class="b-braise" style="animation-delay:-${d}s" cx="${x}" cy="${y}" r="2.2" fill="#ffffff"/>`).join('')}`,

  /* ---------------------------------------------------------------- */
  /* Kharn, le Titan de Lave                                           */
  /* ---------------------------------------------------------------- */
  kharn: () => `${defs('kh', '#0e0a09', '#463632')}
    <ellipse cx="100" cy="150" rx="96" ry="26" fill="url(#kh-halo)" opacity=".8" class="b-pouls"/>
    <g class="b-souffle">
      ${miroir(`
        <path d="M34 98 L10 70 L40 50 L64 70 Z" fill="url(#kh-corps)" stroke="#050303" stroke-width="2"/>
        <path d="M22 120 L6 136 L16 158 L42 152 L44 128 Z" fill="url(#kh-corps)" stroke="#050303" stroke-width="2"/>
        <path d="M72 32 L54 4 L86 22 Z" fill="#2a1f1c" stroke="#050303" stroke-width="2"/>`)}
      <path d="M24 160 L34 96 L62 70 L138 70 L166 96 L176 160 Z" fill="url(#kh-corps)" stroke="#050303" stroke-width="2"/>
      <path d="M100 16 L132 32 L138 66 L116 86 L84 86 L62 66 L68 32 Z" fill="url(#kh-corps)" stroke="#050303" stroke-width="2"/>
      <g class="b-oeil" stroke="${A}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M100 88 L92 108 L104 124 L96 150"/>
        <path d="M58 100 L74 118 L66 142"/>
        <path d="M142 100 L128 120 L136 144"/>
        <path d="M92 108 L74 118 M104 124 L128 120 M100 18 L96 34 L104 44"/>
        <path d="M20 132 L32 142 M180 132 L168 142"/>
      </g>
      ${miroir(`<path class="b-oeil" d="M74 48 L95 53 L79 60 Z" fill="${A}"/>`)}
      <path d="M80 66 L120 66 L114 80 L86 80 Z" fill="#120403"/>
      <path class="b-flamme" d="M84 69 L116 69 L111 78 L89 78 Z" fill="${A}"/>
      <path d="M86 66 l4 7 l4 -7 Z M98 66 l4 7 l4 -7 Z M108 66 l3 6 l4 -6 Z" fill="#2a1f1c"/>
    </g>
    ${braises('kh')}`,

  /* ---------------------------------------------------------------- */
  /* Morvase, la Mère des Vases                                        */
  /* ---------------------------------------------------------------- */
  morvase: () => `${defs('mv', '#0f2a14', '#5fae4a')}
    <ellipse cx="100" cy="100" rx="92" ry="64" fill="url(#mv-halo)" opacity=".3" class="b-pouls"/>
    <g class="b-souffle">
      <path d="M28 150 C16 98 40 44 100 42 C160 44 184 98 172 150 C154 164 132 150 118 158 C106 166 94 150 82 158 C68 166 46 162 28 150 Z" fill="url(#mv-corps)" stroke="#06140a" stroke-width="2" opacity=".94"/>
      <ellipse cx="66" cy="78" rx="10" ry="17" fill="#ffffff" opacity=".22"/>
      <path d="M48 150 q-2 10 3 10 q4 0 3 -10 M150 152 q-2 8 2 8 q4 0 2 -8" fill="#5fae4a" stroke="#06140a" stroke-width="1.2"/>
      <g opacity=".4"><circle cx="134" cy="126" r="9" fill="#ece5d0"/><circle cx="131" cy="125" r="2" fill="#06140a"/><circle cx="137" cy="125" r="2" fill="#06140a"/></g>
      <path d="M70 50 L77 20 L88 44 L100 12 L112 44 L123 20 L130 50 Z" fill="#ece5d0" stroke="#06140a" stroke-width="1.5"/>
      ${miroir(`<ellipse cx="79" cy="88" rx="12" ry="14" fill="#06140a"/><circle class="b-oeil" cx="80" cy="89" r="6" fill="${A}"/><circle cx="82" cy="86" r="2" fill="#fff"/>`)}
      <path d="M62 114 Q100 150 138 114 Q100 126 62 114 Z" fill="#06140a"/>
      <path d="M70 118 l5 9 l5 -8 Z M86 122 l5 9 l5 -9 Z M104 122 l5 9 l5 -9 Z M120 119 l5 8 l5 -9 Z" fill="#f4f4e6"/>
    </g>
    ${[[20, 120, 3, 0], [182, 110, 2.5, 1.2], [40, 60, 2, 2], [164, 50, 3, .6], [100, 26, 2, 1.7]].map(([x, y, r, d]) => `<circle class="b-braise" style="animation-delay:-${d}s" cx="${x}" cy="${y}" r="${r}" fill="#8be06a" opacity=".8"/>`).join('')}`,

  /* ---------------------------------------------------------------- */
  /* Yggmar, le Cœur-Racine                                            */
  /* ---------------------------------------------------------------- */
  yggmar: () => `${defs('yg', '#1c120a', '#6b4a2c')}
    <circle cx="100" cy="90" r="76" fill="url(#yg-halo)" opacity=".3" class="b-pouls"/>
    <g class="b-souffle">
      ${miroir(`
        <path d="M70 152 Q40 138 10 158 M76 140 Q46 116 14 122" stroke="#3a2614" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M74 58 L48 28 L40 2 M48 28 L20 22 M62 46 L28 52 M40 14 L26 6" stroke="#4a3018" stroke-width="7" fill="none" stroke-linecap="round"/>
        <circle cx="40" cy="4" r="8" fill="${A}" opacity=".75"/><circle cx="20" cy="22" r="7" fill="${A}" opacity=".6"/><circle cx="28" cy="52" r="6" fill="${A}" opacity=".7"/><circle cx="26" cy="6" r="5" fill="${A}" opacity=".5"/>`)}
      <path d="M60 160 L66 70 C66 38 134 38 134 70 L140 160 Z" fill="url(#yg-corps)" stroke="#0a0603" stroke-width="2"/>
      <path d="M76 60 V150 M124 62 V150 M90 96 V118 M110 96 V116" stroke="#2a1a0c" stroke-width="2.5" fill="none"/>
      ${miroir(`<path class="b-oeil" d="M74 72 L95 79 L79 89 Z" fill="${A}"/><path d="M70 66 L96 74" stroke="#0a0603" stroke-width="4" stroke-linecap="round"/>`)}
      <path d="M76 104 L85 113 L93 104 L100 115 L107 104 L115 113 L124 104 L118 122 L82 122 Z" fill="#0a0603"/>
      <ellipse cx="100" cy="140" rx="17" ry="15" fill="#0a0603"/>
      <circle class="b-flamme" cx="100" cy="140" r="15" fill="url(#yg-halo)"/>
      <path class="b-pouls" d="M100 150 C88 142 88 132 94 131 C98 130 100 134 100 136 C100 134 102 130 106 131 C112 132 112 142 100 150 Z" fill="${A}"/>
    </g>`,

  /* ---------------------------------------------------------------- */
  /* Séraphiel, l'Ange Déchu                                           */
  /* ---------------------------------------------------------------- */
  seraphiel: () => `${defs('sr', '#15131f', '#8d86a8')}
    <circle cx="100" cy="76" r="76" fill="url(#sr-halo)" opacity=".3" class="b-pouls"/>
    <g class="b-aile">${miroir(`
      <path d="M92 68 C60 38 30 28 6 4 C18 44 44 68 86 84 Z" fill="#1c1a26" stroke="#05040a" stroke-width="2"/>
      <path d="M90 84 C56 76 26 82 2 70 C22 98 52 106 86 98 Z" fill="#262334" stroke="#05040a" stroke-width="2"/>
      <path d="M90 100 C62 106 40 124 24 152 C52 140 72 128 90 112 Z" fill="#1c1a26" stroke="#05040a" stroke-width="2"/>
      <path d="M86 78 L30 34 M86 92 L26 80 M88 106 L44 132" stroke="#5a5470" stroke-width="1.6" fill="none"/>`)}</g>
    <g class="b-flotte">
      <path class="b-oeil" d="M68 20 A32 9 0 0 1 126 15" fill="none" stroke="${A}" stroke-width="4" stroke-linecap="round"/>
      <path class="b-oeil" d="M130 20 l6 3" stroke="${A}" stroke-width="4" stroke-linecap="round"/>
      <path d="M100 46 C88 46 84 56 84 64 L78 112 L68 160 L132 160 L122 112 L116 64 C116 56 112 46 100 46 Z" fill="url(#sr-corps)" stroke="#05040a" stroke-width="2"/>
      <path d="M84 72 L116 72 L112 100 L100 108 L88 100 Z" fill="#3a3650" stroke="#05040a" stroke-width="1.5"/>
      <ellipse cx="100" cy="40" rx="13" ry="15" fill="#ece5d0" stroke="#05040a" stroke-width="1.5"/>
      <path d="M86 34 C88 22 112 22 114 34 C108 28 92 28 86 34 Z" fill="#cfc9dd"/>
      ${miroir(`<path class="b-oeil" d="M89 38 l9 2 l-7 4 Z" fill="${A}"/><path d="M92 44 v10" stroke="#05040a" stroke-width="1.4"/>`)}
      <path d="M97 70 L103 70 L102 152 L100 160 L98 152 Z" fill="#c9ced6" stroke="#05040a" stroke-width="1.2"/>
      <path d="M84 72 H116" stroke="#e2b33c" stroke-width="4" stroke-linecap="round"/>
      <circle cx="100" cy="66" r="3.5" fill="${A}" class="b-oeil"/>
    </g>
    ${[[30, 130, 0], [170, 120, 1.2], [56, 150, 2.1], [148, 148, .5]].map(([x, y, d]) => `<path class="b-braise" style="animation-delay:-${d}s" d="M${x} ${y} q4 -8 0 -14 q-4 6 0 14 Z" fill="#1c1a26" stroke="#5a5470" stroke-width=".8"/>`).join('')}`,

  /* ---------------------------------------------------------------- */
  /* Ozrath, l'Œil du Néant                                            */
  /* ---------------------------------------------------------------- */
  ozrath: () => `${defs('oz', '#0a0616', '#3a2460')}
    <circle cx="100" cy="80" r="78" fill="url(#oz-halo)" opacity=".35" class="b-pouls"/>
    <circle class="b-onde" cx="100" cy="80" r="62" fill="none" stroke="${A}" stroke-width="1.5" opacity=".5"/>
    <g class="b-flotte">
      ${miroir(`
        <path d="M70 112 Q32 122 22 156" stroke="#1a1030" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M60 82 Q22 70 8 102" stroke="#1a1030" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M70 52 Q42 20 14 24" stroke="#1a1030" stroke-width="10" fill="none" stroke-linecap="round"/>
        <circle cx="8" cy="102" r="7" fill="#f1eaf7" stroke="#05030a" stroke-width="1.2"/><circle class="b-oeil" cx="8" cy="102" r="3" fill="${A}"/>
        <circle cx="14" cy="24" r="6" fill="#f1eaf7" stroke="#05030a" stroke-width="1.2"/><circle class="b-oeil" cx="14" cy="24" r="2.6" fill="${A}"/>
        <circle cx="22" cy="156" r="5" fill="#f1eaf7" stroke="#05030a" stroke-width="1.2"/><circle class="b-oeil" cx="22" cy="156" r="2.2" fill="${A}"/>`)}
      <circle cx="100" cy="80" r="48" fill="url(#oz-corps)" stroke="#05030a" stroke-width="2"/>
      <ellipse cx="100" cy="80" rx="38" ry="27" fill="#f1eaf7" stroke="#05030a" stroke-width="1.5"/>
      <path d="M64 80 q8 -6 14 -2 M136 80 q-8 6 -14 2 M70 70 q6 0 10 4 M130 90 q-6 0 -10 -4" stroke="#c0344a" stroke-width="1.2" fill="none"/>
      <circle class="b-oeil" cx="100" cy="80" r="19" fill="${A}"/>
      <path class="b-cri" d="M100 60 Q108 80 100 100 Q92 80 100 60 Z" fill="#05030a"/>
      <circle cx="107" cy="72" r="4" fill="#fff" opacity=".8"/>
      <path d="M62 80 C70 46 130 46 138 80 C126 60 74 60 62 80 Z" fill="#1a1030" stroke="#05030a" stroke-width="1.5"/>
      <path d="M62 80 C70 114 130 114 138 80 C126 100 74 100 62 80 Z" fill="#1a1030" stroke="#05030a" stroke-width="1.5"/>
      <path d="M74 62 l4 8 l4 -9 Z M90 55 l4 9 l4 -9 Z M106 55 l4 9 l4 -9 Z M120 62 l4 9 l2 -10 Z M76 99 l4 -8 l4 9 Z M96 104 l4 -8 l4 8 Z M116 99 l4 -8 l2 9 Z" fill="#ece5d0"/>
    </g>`,

  /* ---------------------------------------------------------------- */
  /* Azhar-Khûl, le Roi Sans Aube                                      */
  /* ---------------------------------------------------------------- */
  azhar: () => `${defs('az', '#0a0709', '#3a2a34')}
    <circle cx="100" cy="46" r="60" fill="url(#az-halo)" opacity=".55" class="b-pouls"/>
    <g class="b-aile">${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return `<path d="M${(100 + Math.cos(a) * 46).toFixed(1)} ${(46 + Math.sin(a) * 46).toFixed(1)} L${(100 + Math.cos(a) * 62).toFixed(1)} ${(46 + Math.sin(a) * 62).toFixed(1)}" stroke="${A}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`; }).join('')}</g>
    <circle cx="100" cy="46" r="42" fill="#050305" stroke="${A}" stroke-width="3"/>
    <g class="b-souffle">
      ${miroir(`<path d="M40 160 L50 44 L70 62 L72 160 Z" fill="#15101a" stroke="#050305" stroke-width="2"/>
        <path d="M50 44 l-4 -14 l10 8 Z" fill="#2a2030" stroke="#050305" stroke-width="1.2"/>`)}
      <path d="M100 52 C70 56 56 92 44 160 L156 160 C144 92 130 56 100 52 Z" fill="url(#az-corps)" stroke="#050305" stroke-width="2"/>
      ${miroir(`<path d="M78 72 L48 60 L58 82 L42 92 L74 94 Z" fill="#3a3242" stroke="#050305" stroke-width="2"/>`)}
      <path d="M82 78 L118 78 L124 122 L100 136 L76 122 Z" fill="#2a2430" stroke="#050305" stroke-width="2"/>
      <path class="b-oeil" d="M100 82 L95 98 L105 110 L98 128" fill="none" stroke="${A}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M100 22 C88 22 83 32 83 41 C83 51 90 57 100 59 C110 57 117 51 117 41 C117 32 112 22 100 22 Z" fill="#d9d2c2" stroke="#050305" stroke-width="1.5"/>
      ${miroir(`<path d="M86 36 L97 40 L88 46 Z" fill="#050305"/><path class="b-oeil" d="M88 38 l8 2 l-6 4 Z" fill="${A}"/>`)}
      <path d="M100 44 l-2.5 6 l5 0 Z" fill="#050305"/>
      <path d="M92 53 v5 M96 54 v5 M100 54 v5 M104 54 v5 M108 53 v5" stroke="#050305" stroke-width="1.2"/>
      <path d="M81 28 L76 2 L90 18 L100 -4 L110 18 L124 2 L119 28 Z" fill="#1a1206" stroke="${A}" stroke-width="2"/>
      <circle cx="100" cy="16" r="3.5" fill="${A}" class="b-oeil"/>
      <path d="M97 98 L103 98 L102 156 L100 160 L98 156 Z" fill="#c9ced6" stroke="#050305" stroke-width="1.2"/>
      <path d="M84 100 H116" stroke="#8a8d94" stroke-width="5" stroke-linecap="round"/>
      ${miroir(`<path d="M74 94 L90 100" stroke="#3a3242" stroke-width="9" stroke-linecap="round"/>`)}
    </g>
    ${braises('az')}`,
};

/** Vrai si ce monstre a son portrait (les boss et les élites). */
export const aUnPortrait = (u) => !!ART[u.modeleId] && (u.rang === 'boss' || u.rang === 'elite');

/** Le portrait d'un boss ou d'une élite. */
export function portraitSvg(u) {
  const dessin = ART[u.modeleId];
  if (!dessin) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" class="portrait" aria-hidden="true">${dessin()}</svg>`;
}
