/**
 * BALTROU — le dessin des cartes, des Jokers et des objets.
 *
 * Tout est en HTML et CSS : une carte est un petit bloc avec ses coins, son
 * centre, son amélioration et son sceau. Le Poisson et le Troll ont leur
 * propre dessin, en SVG.
 */

import { COULEURS, afficheRang, AMELIORATIONS, SCEAUX, NOM_RANG } from '../../../shared/baltrou/cartes.js';
import { JOKERS, RARETES, OBJETS, EDITIONS } from '../../../shared/baltrou/jokers.js';
import { infoConso } from '../../../shared/baltrou/arcanes.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Les nombres à la française : 12 345, et 2,5. */
export function nb(v) {
  if (!Number.isFinite(v)) return '∞';
  if (Math.abs(v) >= 1e15) return v.toExponential(2).replace('.', ',').replace('e+', 'e');
  if (Number.isInteger(v) || Math.abs(v) >= 1000) return Math.round(v).toLocaleString('fr-FR');
  return String(+v.toFixed(2)).replace('.', ',');
}

/* ------------------------------------------------------------------ */
/* Les cartes à jouer                                                   */
/* ------------------------------------------------------------------ */

const POISSON_SVG = `<svg viewBox="0 0 100 80" width="100%" height="100%" aria-hidden="true">
  <path d="M8 22c3-6 8-6 10 0M14 12c2-4 6-4 8 0M78 10c2-4 6-4 8 0" stroke="#2f5a2a" stroke-width="2" fill="none"/>
  <circle cx="13" cy="25" r="1.6" fill="#1b1720"/><circle cx="20" cy="15" r="1.6" fill="#1b1720"/><circle cx="84" cy="13" r="1.6" fill="#1b1720"/>
  <path d="M76 42l20-16v32z" fill="#4c7a34"/>
  <ellipse cx="44" cy="42" rx="34" ry="22" fill="#5f9142"/>
  <ellipse cx="44" cy="50" rx="25" ry="11" fill="#d8d49a"/>
  <g stroke="#3d5f28" stroke-width="2.4" stroke-linecap="round"><path d="M28 23l-3-7M42 20l-1-8M56 21l2-7M66 27l5-5M14 40l-7-2M16 54l-7 3"/></g>
  <circle cx="30" cy="37" r="8" fill="#f4f1d8"/><circle cx="31" cy="38" r="3.4" fill="#4a5a2a"/>
  <path d="M25 33l12 8M37 33l-12 8" stroke="#3a2a1a" stroke-width="1.3" opacity=".55"/>
  <path d="M12 50c4 4 8 4 10 0" stroke="#5a3a20" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M16 54c0 7 4 9 6 4" fill="#9ad06a"/>
</svg>`;

const TROLL_SVG = `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
  <circle cx="50" cy="50" r="40" fill="#78b85a"/>
  <path d="M18 34c10-6 20-6 26 0M56 34c6-6 16-6 26 0" stroke="#1b1720" stroke-width="4" fill="none" stroke-linecap="round"/>
  <ellipse cx="34" cy="44" rx="9" ry="8" fill="#fff"/><ellipse cx="66" cy="44" rx="9" ry="8" fill="#fff"/>
  <circle cx="37" cy="45" r="4" fill="#111"/><circle cx="69" cy="45" r="4" fill="#111"/>
  <path d="M20 60c12 22 48 22 60 0z" fill="#fff" stroke="#1b1720" stroke-width="3"/>
  <path d="M32 61v8M44 62v10M56 62v10M68 61v8" stroke="#1b1720" stroke-width="2"/>
  <ellipse cx="50" cy="54" rx="6" ry="4" fill="#5a8a3a"/>
</svg>`;

/**
 * @param {object} c  la carte
 * @param {{ cls?: string, attrs?: string }} [o]
 */
export function carteHtml(c, o = {}) {
  const cls = ['carte', o.cls || ''];
  let corps;
  if (c.special === 'poisson') {
    cls.push('poisson');
    corps = `<div class="centre">${POISSON_SVG}</div><span class="etiquette">FORCÉ</span>`;
  } else if (c.special === 'wild') {
    cls.push('wild');
    corps = '<span class="coin">★</span><div class="centre">★</div><span class="etiquette">WILD</span>';
  } else if (c.special === 'troll') {
    cls.push('troll');
    corps = `<div class="centre">${TROLL_SVG}</div><span class="etiquette">XD</span>`;
  } else {
    const coul = COULEURS[c.s];
    if (coul.rouge) cls.push('rouge');
    const r = afficheRang(c.r);
    let centre;
    if (c.r === 14) centre = `<span class="as">${coul.sym}</span>`;
    else if (c.r >= 11) centre = `<span class="figure">${r}<small>${coul.sym}</small></span>`;
    else centre = `<span>${coul.sym}</span>`;
    corps = `<span class="coin">${r}<i>${coul.sym}</i></span><div class="centre">${centre}</div><span class="coin bas">${r}<i>${coul.sym}</i></span>`;
  }
  if (c.enh) {
    cls.push(`e-${c.enh}`);
    corps += `<span class="badge ${c.enh}">${{ bonus: '+30', mult: '+4', verre: '×1,5', acier: 'ACIER', pierre: '+50' }[c.enh]}</span>`;
  }
  if (c.sceau) corps += `<span class="sceau ${c.sceau}"></span>`;
  return `<div class="${cls.join(' ').trim()}" data-uid="${esc(c.uid || '')}" ${o.attrs || ''}>${corps}</div>`;
}

/** Ce que dit une carte, en toutes lettres. */
export function texteCarte(c) {
  if (c.special === 'poisson') {
    return { titre: 'Poisson Dégueulasse', texte: 'Toujours dans le paquet, et joué de force : impossible de le défausser. 85 % : ×4 sur la main. 15 % : il vous maudit, et toutes vos défausses disparaissent.' };
  }
  if (c.special === 'wild') return { titre: 'WILDCARD', texte: 'Devient la carte qui fait la meilleure main, et multiplie chips ET Mult par 6,7. Ne se défausse pas. 3 % de chances, à chaque pioche, de muter en TROLL…' };
  if (c.special === 'troll') return { titre: 'TROLL', texte: 'Une WILDCARD qui a mal tourné. 50 % : ×3 Mult. 50 % : −50 à −900 chips. Ne se défausse pas. XD' };
  const nom = `${NOM_RANG[c.r] || c.r} de ${COULEURS[c.s].nom}`;
  const lignes = [`Rapporte ${c.r === 14 ? 11 : c.r >= 11 ? 10 : c.r} chips.`];
  if (c.enh) lignes.push(`<b>${AMELIORATIONS[c.enh].nom}</b> : ${AMELIORATIONS[c.enh].texte}.`);
  if (c.sceau) lignes.push(`<b>${SCEAUX[c.sceau].nom}</b> : ${SCEAUX[c.sceau].texte}.`);
  return { titre: c.enh === 'pierre' ? 'Carte de Pierre' : nom, texte: lignes.join('<br>') };
}

/* ------------------------------------------------------------------ */
/* Les Jokers                                                           */
/* ------------------------------------------------------------------ */

export const ART_JOKER = {
  classique: '🃏', glouton: '🍔', matheux: '🧮', chance: '🍀', maudit: '💀', defauts: '🧷', rentier: '💵', corrompu: '🦠',
  parrain: '🎩', tricheur: '🕵️', collectionneur: '🗃️', sage: '🦉', cameleon: '🦎', banquier: '🏦', escroc: '🎭',
  'miroir-brise': '🪞', anarchiste: '🏴', magicien: '🪄', 'demon-comptable': '😈', pyromane: '🔥', de20: '🎲', slots: '🎰',
  chaos: '🌀', pirate: '🏴‍☠️', investisseur: '📈', berserker: '🪓', archiviste: '📚', stratege: '♟️',
  doubleur: '👯', voyageur: '⏳', vampire: '🧛', pacte: '📜', executeur: '⚔️', 'trou-noir': '⚫', infini: '♾️', chef: '🎼',
  'roi-chaos': '🌪️', temps: '⌛', destin: '🔮', 'dieu-poker': '🤴',
  'dieu-hasard': '🌌', couronne: '👑', 'pacte-interdit': '🩸', miracle: '✨', 'trou-noir-m': '🕳️', surcharge: '⚡',
  jackpot: '💎', oeil: '👁️', bug: '🐛', 'main-divine': '🖐️', 'roulette-multivers': '🌐',
  spectre: '👻', ombre: '🌑', possede: '👹',
};

/** @param {{id:string, uid?:string, edition?:string|null}} j */
export function jokerHtml(j, o = {}) {
  const d = JOKERS[j.id];
  const cls = ['joker', `r-${d.rarete}`, j.edition ? `ed-${j.edition}` : '', o.cls || ''].join(' ').trim();
  const ed = j.edition ? `<span class="ed">${j.edition === 'holo' ? 'HOLO' : 'POLY'}</span>` : '';
  return `<div class="${cls}" data-uid="${esc(j.uid || '')}" ${o.attrs || ''} title="${esc(d.nom)} — ${esc(d.texte)}">
    <span class="art">${ART_JOKER[j.id] || '🃏'}</span><span class="nom">${esc(d.nom)}</span>${ed}</div>`;
}

/** Ce qu'un Joker a déjà accumulé, s'il accumule. */
export function compteurJoker(j) {
  const e = j.e || {};
  switch (j.id) {
    case 'investisseur': return `Niveau ${e.niveau || 1} : +${2 * (e.niveau || 1)} Mult`;
    case 'archiviste': case 'infini': return `Déjà +${e.n || 0} Mult`;
    case 'vampire': return `Déjà +${8 * (e.n || 0)} chips`;
    case 'stratege': return `${(e.vues || []).length} sorte(s) de main jouée(s)`;
    case 'temps': return `Meilleurs chips vus : ${e.best || 0}`;
    default: return '';
  }
}

export const rarete = (id) => RARETES[id];

/* ------------------------------------------------------------------ */
/* Les consommables : planètes, tarots, Élixir                          */
/* ------------------------------------------------------------------ */

/** Une carte de planète ou de tarot. `id` : 'planete:paire', 'tarot:pape', 'elixir'. */
export function consoHtml(id, o = {}) {
  const info = infoConso(id);
  const cls = ['arcane', info.sorte, o.cls || ''].join(' ').trim();
  const haut = info.sorte === 'tarot' ? info.num : info.sorte === 'planete' ? 'PLANÈTE' : '';
  const style = info.couleur ? ` style="--pc:${info.couleur}"` : '';
  return `<div class="${cls}"${style} ${o.attrs || ''} title="${esc(info.nom)} — ${esc(info.texte)}">
    <span class="num">${haut}</span><span class="g">${info.glyphe}</span><span class="n">${esc(info.nom)}</span></div>`;
}

/* ------------------------------------------------------------------ */
/* Les objets de la boutique                                            */
/* ------------------------------------------------------------------ */

export function offreHtml(item, { prix, possible, bouton = 'Acheter', attrs = '' } = {}) {
  const etiquette = prix === 0 ? 'Prendre · gratuit' : `${bouton} · $${prix}`;
  const tag = item.tag ? '<span class="tag-offert">🏷️ Tag</span>' : '';
  if (item.type === 'planete' || item.type === 'tarot') {
    const info = infoConso(`${item.type}:${item.id}`);
    const rc = item.type === 'planete' ? info.couleur : '#b44dff';
    return `<div class="offre r-conso" style="--rc:${rc}" ${attrs}>${tag}
      <span class="rar">${item.type === 'planete' ? 'Planète' : 'Tarot'}</span>
      ${item.cote != null ? `<span class="cote-chance">~${String(item.cote).replace('.', ',')} % ce tirage</span>` : ''}
      ${consoHtml(`${item.type}:${item.id}`)}
      <b>${esc(info.nom)}</b><p>${esc(info.texte)}</p>
      ${prix != null ? `<button class="btn ${possible ? 'or' : ''}" ${possible ? '' : 'disabled'} data-acheter>${etiquette}</button>` : ''}
    </div>`;
  }
  if (item.type === 'joker') {
    const d = JOKERS[item.id];
    const r = RARETES[d.rarete];
    const ed = item.edition ? ` <small>· ${EDITIONS[item.edition].nom} (${EDITIONS[item.edition].texte})</small>` : '';
    return `<div class="offre r-${d.rarete}" style="--rc:${r.couleur}" ${attrs}>${tag}
      <span class="rar">${r.nom}${d.rarete === 'negatif' ? ' · hors place' : ''}</span>
      ${item.cote != null ? `<span class="cote-chance">~${String(item.cote).replace('.', ',')} % ce tirage</span>` : ''}
      ${jokerHtml(item)}
      <b>${esc(d.nom)}</b><p>${esc(d.texte)}${ed}</p>
      ${prix != null ? `<button class="btn ${possible ? 'or' : ''}" ${possible ? '' : 'disabled'} data-acheter>${etiquette}</button>` : ''}
    </div>`;
  }
  const o = OBJETS[item.id];
  const r = RARETES[o.rarete];
  return `<div class="offre r-${o.rarete}" style="--rc:${r.couleur}" ${attrs}>${tag}
    <span class="rar">${r.nom}</span>
    ${item.cote != null ? `<span class="cote-chance">~${String(item.cote).replace('.', ',')} % ce tirage</span>` : ''}
    <div class="objet-art">${o.glyphe}</div>
    <b>${esc(o.nom)}</b><p>${esc(o.texte)}</p>
    ${prix != null ? `<button class="btn ${possible ? 'or' : ''}" ${possible ? '' : 'disabled'} data-acheter>${etiquette}</button>` : ''}
  </div>`;
}
