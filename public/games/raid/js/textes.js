/**
 * RAID — les mots de l'écran.
 *
 * Les sorts, les traits des monstres et les pièces se racontent ici, depuis
 * les constantes du moteur : un nombre affiché est un nombre appliqué.
 */

import { ECOLES } from '../../../shared/raid/ecoles.js';
import { ROLES } from '../../../shared/raid/heros.js';
import { RARETES, EMPLACEMENTS, texteBonus } from '../../../shared/raid/equipement.js';

export const txt = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pc = (v) => `${Math.round(v * 100)} %`;
export const teinte = (e) => (ECOLES[e] || ECOLES.feu).teinte;
export const nomEcole = (e) => (ECOLES[e] ? `${ECOLES[e].glyphe} ${ECOLES[e].nom}` : e);
export const nomRole = (r) => (ROLES[r] ? `${ROLES[r].glyphe} ${ROLES[r].nom}` : r);

/** Ce que fait un sort, en une phrase. */
export function texteSort(s) {
  const e = s.effet || {};
  const v = e.valeur || 0;
  const coup = `Dégâts ×${s.mult.toFixed(1)}`;
  switch (e.type) {
    case 'soin': return `Soigne tout le groupe de ${pc(v * 2)} de sa vie.`;
    case 'garde': return `Bouclier sur le groupe : ${pc(Math.min(0.6, v * 1.1))} de dégâts en moins, 2 manches.`;
    case 'elan': return `Le groupe frappe ${pc(v * 1.2)} plus fort, 2 manches.`;
    case 'mana': return `Rend ${v * 2} PM à chaque allié.`;
    case 'perce': return `${coup}, ignore ${pc(v)} de l’armure.`;
    case 'double': return `Frappe deux fois (×${(s.mult * 0.6).toFixed(1)} chacune).`;
    case 'brasier': return `${coup}, puis brûle la cible pendant 3 manches.`;
    case 'entrave': return `${coup}, et la cible frappe ${pc(v)} moins fort pendant 2 manches.`;
    case 'vol': return `${coup}, et soigne l’allié le plus blessé.`;
    case 'provoc': return `Provocation : pendant ${v} manches, tous les ennemis sont forcés de frapper ce héros, qui encaisse 30 % de dégâts en moins. Même les attaques chargées des boss se concentrent sur lui seul.`;
    case 'bastion': return `Bouclier de ${pc(v)} sur tout le groupe et provocation, pendant 3 manches.`;
    case 'zone': return `Frappe TOUS les ennemis, dégâts ×${s.mult.toFixed(1)} chacun.`;
    case 'purge': return `Soigne tout le groupe de ${pc(v * 2)} de sa vie et lève les poisons.`;
    case 'fracas': return `Frappe TOUS les ennemis, dégâts ×${s.mult.toFixed(1)}, et ils frappent ${pc(v)} moins fort pendant 2 manches.`;
    case 'assommer': return `${coup}, et la cible perd son prochain tour (sauf les boss).`;
    case 'fournaise': return `Frappe TOUS les ennemis, dégâts ×${s.mult.toFixed(1)}, et les brûle pendant 3 manches.`;
    case 'execution': return `${coup} — doublés si la cible est sous 40 % de vie.`;
    case 'renouveau': return `Soigne tout le groupe de ${pc(v * 2)} de sa vie et rend 12 PM à chaque allié.`;
    case 'resurrection': return `Relève tous les héros tombés à ${pc(v)} de leur vie, et soigne les autres de ${pc(v * 0.6)}.`;
    case 'radiance': return `${coup}, puis soigne chaque allié de ${pc(v)} des dégâts infligés.`;
    case 'represailles': return `Représailles : pendant 2 manches, chaque coup reçu par le groupe renvoie ${pc(v)} des dégâts à l’attaquant.`;
    case 'regeneration': return `Le groupe récupère ${pc(v)} de sa vie à chaque fin de manche, pendant 3 manches.`;
    case 'fragilise': return `${coup}, et la cible subit ${pc(v)} de dégâts en plus pendant 2 manches.`;
    case 'contre': return `Provoque pendant 2 manches et riposte à chaque coup reçu (dégâts ×${v.toFixed(1)}).`;
    case 'seisme': return `Frappe TOUS les ennemis, dégâts ×${s.mult.toFixed(1)} chacun ; 40 % de chances d’étourdir chacun (sauf les boss).`;
    case 'critique': return `${coup}, coup critique assuré.`;
    case 'chaine': return `${coup}, puis rebondit sur deux autres ennemis (×${(s.mult * 0.6).toFixed(1)}).`;
    case 'rafale': return `Cinq coups rapides (×${(s.mult * 0.24).toFixed(1)} chacun) ; si la cible tombe, la rafale passe au suivant.`;
    case 'transfusion': return `Rend ${pc(v)} de sa vie à l’allié le plus blessé.`;
    case 'souffle': return `Soigne tout le groupe de ${pc(v)} de sa vie, et il frappe 22 % plus fort pendant 2 manches.`;
    case 'sanctuaire': return `Bouclier de ${pc(Math.min(0.6, v))} sur le groupe et régénération de 5 % par manche, pendant 2 manches.`;
    case 'retard': return `Les attaques chargées de tous les ennemis reculent d’un tour, et le groupe récupère ${pc(v)} de sa vie.`;
    default: return `${coup}.`;
  }
}

export const TRAITS_RPG = {
  carapace: { glyphe: '🐢', texte: 'Carapace : les attaques simples font 30 % de dégâts en moins.' },
  frenesie: { glyphe: '💢', texte: 'Frénésie : frappe parfois une seconde fois.' },
  poison: { glyphe: '☠', texte: 'Poison : ses coups empoisonnent pendant 2 manches.' },
  fureur: { glyphe: '🔺', texte: 'Fureur : plus il est blessé, plus il frappe fort.' },
  epines: { glyphe: '🌵', texte: 'Épines : renvoie une part des coups qu’il reçoit.' },
  drain: { glyphe: '🩸', texte: 'Drain : se soigne en frappant.' },
  enrage: { glyphe: '😡', texte: 'Enrage : sous la moitié de sa vie, il entre en rage.' },
  regen: { glyphe: '💚', texte: 'Régénération : reprend 4 % de sa vie à chaque fin de manche.' },
  gel: { glyphe: '🥶', texte: 'Gel : ses coups font perdre 3 PM.' },
};

export const couleurRarete = (r) => (RARETES[r] || RARETES.commun).teinte;

/** Une pièce d'équipement, en carte. `actions` est du HTML déjà prêt. */
export function cartePiece(it, { actions = '', note = '' } = {}) {
  const r = RARETES[it.rarete] || RARETES.commun;
  return `<div class="piece r-${it.rarete}" style="--r:${r.teinte}">
    <b>${it.glyphe} ${txt(it.nom)}</b>
    <i>${texteBonus(it)}</i>
    <small>${EMPLACEMENTS[it.emplacement].nom} · <span class="rarete">${r.nom}</span>${it.trophee ? ' · trophée' : ''}${note ? ` · ${note}` : ''}</small>
    ${actions ? `<div class="piece-actions">${actions}</div>` : ''}
  </div>`;
}

/** Une relique, en carte. */
export function carteRelique(r, { actions = '' } = {}) {
  return `<div class="piece relique" style="--r:#ffd76a">
    <b>${r.glyphe} ${txt(r.nom)}</b>
    <i>${txt(r.texte)}</i>
    <small>Relique · vaut pour tout le groupe</small>
    ${actions ? `<div class="piece-actions">${actions}</div>` : ''}
  </div>`;
}

/** Une compétence d'éveil, en ligne de fiche. */
export function ligneEveil(sp, texte, cout) {
  return `<div class="sort eveil"><b>✦ ${sp.glyphe} ${txt(sp.nom)}</b> · ${cout} PM
    <i>Compétence d’éveil. ${txt(texte)}</i></div>`;
}
