/**
 * RAID — les compétences d'éveil.
 *
 * Un compagnon qui revient de son voyage est « éveillé » : il gagne en
 * statistiques, et surtout un troisième sort, le sien, qu'aucun autre ne
 * possède. Chaque personnage a sa propre compétence, taillée pour sa classe.
 *
 * Une compétence se décrit en deux temps :
 *   degats   un coup porté — sur une cible ou sur tous les ennemis (`zone`),
 *            en une ou plusieurs fois (`coups`), en ignorant une part de
 *            l'armure (`perce`), doublé sur une cible entamée (`execution`) ;
 *   puis     une suite d'effets, appliqués dans l'ordre :
 *              soin      part de sa vie rendue à chaque allié
 *              soinSoi   part de sa propre vie rendue au lanceur
 *              sang      part des dégâts infligés rendue au lanceur
 *              bouclier  { v, tours } sur tout le groupe
 *              elan      { v, tours } sur tout le groupe
 *              provoc    { tours } : tous les ennemis doivent frapper le lanceur
 *              mana      PM rendus à chaque allié
 *              purge     lève les poisons
 *              releve    relève les héros tombés à cette part de leur vie
 *              brasier   { part, tours } : brûle les ennemis touchés
 *              entrave   { v, tours } : affaiblit les ennemis (touchés, ou tous)
 *              etourdi   les ennemis touchés passent leur prochain tour (pas les boss)
 *              serment   { tours } : aucun héros debout ne peut tomber sous 1 PV
 *
 * Le texte affiché est écrit depuis ces mêmes champs : ce qui est annoncé
 * est ce qui est appliqué.
 *
 * Module ISO : ni DOM ni Node.
 */

export const COUT_EVEIL = 14;
/** Sous cette part de vie, une `execution` frappe double. */
export const SEUIL_EXECUTION = 0.4;

export const EVEILS = {
  /* ------------------------------- tanks ------------------------------ */
  brandel: { nom: 'Égide de l’Aube', glyphe: '🌅',
    puis: [{ type: 'bouclier', v: 0.5, tours: 3 }, { type: 'soin', v: 0.2 }] },
  kraven: { nom: 'Moisson écarlate', glyphe: '🩸',
    degats: { mult: 1.4, zone: true }, puis: [{ type: 'sang', v: 1 }] },
  grommur: { nom: 'Colère de la terre', glyphe: '🌋',
    degats: { mult: 1.3, zone: true }, puis: [{ type: 'entrave', v: 0.3, tours: 2 }] },
  borin: { nom: 'Glacier vivant', glyphe: '🧊',
    puis: [{ type: 'provoc', tours: 3 }, { type: 'bouclier', v: 0.35, tours: 3 }, { type: 'soinSoi', v: 0.3 }] },
  korgath: { nom: 'Cri du volcan', glyphe: '📣',
    degats: { mult: 2.2 }, puis: [{ type: 'etourdi' }, { type: 'provoc', tours: 2 }] },
  aldric: { nom: 'Serment d’acier', glyphe: '⚜️',
    puis: [{ type: 'serment', tours: 2 }] },
  ignar: { nom: 'Cœur d’étoile', glyphe: '🌟',
    puis: [{ type: 'soinSoi', v: 0.4 }, { type: 'elan', v: 0.3, tours: 3 }, { type: 'provoc', tours: 2 }] },

  /* -------------------------------- dps ------------------------------- */
  vaelor: { nom: 'Châtiment céleste', glyphe: '⚡',
    degats: { mult: 1.2, coups: 3 } },
  mordrec: { nom: 'Pacte du néant', glyphe: '🕳',
    degats: { mult: 3.4, perce: 1 } },
  kaelis: { nom: 'Flèche du prédateur', glyphe: '🏹',
    degats: { mult: 2.6, execution: true } },
  pix: { nom: 'Zéro absolu', glyphe: '❄',
    degats: { mult: 1.5, zone: true }, puis: [{ type: 'etourdi' }] },
  braz: { nom: 'Soleil noir', glyphe: '🌑',
    degats: { mult: 1.7, zone: true }, puis: [{ type: 'brasier', part: 0.3, tours: 3 }] },
  noctis: { nom: 'Nuit sans fin', glyphe: '🌌',
    degats: { mult: 1.6, zone: true, coups: 2 } },
  lyra: { nom: 'Constellation', glyphe: '✨',
    degats: { mult: 1.5, zone: true, perce: 0.5 }, puis: [{ type: 'entrave', v: 0.3, tours: 2 }] },

  /* ------------------------------ soigneurs ---------------------------- */
  elissende: { nom: 'Miracle', glyphe: '🕊',
    puis: [{ type: 'releve', v: 0.6 }, { type: 'soin', v: 0.5 }] },
  nysha: { nom: 'Éclipse de l’esprit', glyphe: '🌘',
    puis: [{ type: 'mana', v: 20 }, { type: 'elan', v: 0.4, tours: 2 }] },
  faeleth: { nom: 'Printemps éternel', glyphe: '🌸',
    puis: [{ type: 'soin', v: 0.45 }, { type: 'purge' }, { type: 'bouclier', v: 0.25, tours: 2 }] },
  thala: { nom: 'Marée haute', glyphe: '🌊',
    puis: [{ type: 'soin', v: 0.35 }, { type: 'mana', v: 10 }, { type: 'entrave', v: 0.25, tours: 2 }] },
  mei: { nom: 'Poing du phénix', glyphe: '🔥',
    degats: { mult: 2.8 }, puis: [{ type: 'soin', v: 0.3 }] },
  selene: { nom: 'Aube sans fin', glyphe: '☀️',
    puis: [{ type: 'releve', v: 0.7 }, { type: 'soin', v: 0.5 }, { type: 'elan', v: 0.3, tours: 2 }] },
  orion: { nom: 'Heure suspendue', glyphe: '⏳',
    degats: { mult: 0.6, zone: true }, puis: [{ type: 'etourdi' }, { type: 'bouclier', v: 0.3, tours: 2 }] },
};

/** La compétence d'éveil d'un personnage, s'il est éveillé. */
export const eveilDe = (p) => (p && p.eveil && EVEILS[p.id]) || null;

/** Vrai si la compétence se lance sur une cible ennemie à choisir. */
export const eveilCible = (sp) => !!sp.degats && !sp.degats.zone;

const pc = (v) => `${Math.round(v * 100)} %`;
const manches = (n) => `${n} manche${n > 1 ? 's' : ''}`;

/** Ce que fait une compétence d'éveil, en clair. */
export function texteEveil(sp) {
  const out = [];
  const d = sp.degats;
  if (d) {
    const fois = d.coups > 1 ? `${d.coups} fois ` : '';
    out.push(`Frappe ${fois}${d.zone ? 'TOUS les ennemis' : 'la cible'}, dégâts ×${d.mult.toFixed(1)}${d.coups > 1 ? ' par coup' : ''}`
      + (d.perce ? (d.perce >= 1 ? ', en ignorant toute l’armure' : `, en ignorant ${pc(d.perce)} de l’armure`) : '')
      + (d.execution ? ` — doublés sur une cible sous ${pc(SEUIL_EXECUTION)} de vie` : ''));
  }
  for (const o of sp.puis || []) {
    switch (o.type) {
      case 'soin': out.push(`soigne tout le groupe de ${pc(o.v)} de sa vie`); break;
      case 'soinSoi': out.push(`se soigne de ${pc(o.v)} de sa vie`); break;
      case 'sang': out.push(`se soigne de ${pc(o.v)} des dégâts infligés`); break;
      case 'bouclier': out.push(`bouclier de ${pc(o.v)} sur le groupe, ${manches(o.tours)}`); break;
      case 'elan': out.push(`le groupe frappe ${pc(o.v)} plus fort, ${manches(o.tours)}`); break;
      case 'provoc': out.push(`provoque tous les ennemis, ${manches(o.tours)}`); break;
      case 'mana': out.push(`rend ${o.v} PM à chaque allié`); break;
      case 'purge': out.push('lève les poisons'); break;
      case 'serment': out.push(`pendant ${manches(o.tours)}, aucun héros debout ne peut tomber : il lui reste toujours 1 PV`); break;
      case 'releve': out.push(`relève les héros tombés à ${pc(o.v)} de leur vie`); break;
      case 'brasier': out.push(`brûle les ennemis touchés, ${manches(o.tours)}`); break;
      case 'entrave': out.push(`${d ? 'les ennemis touchés' : 'tous les ennemis'} frappent ${pc(o.v)} moins fort, ${manches(o.tours)}`); break;
      case 'etourdi': out.push('les ennemis touchés passent leur prochain tour (sauf les boss)'); break;
      default: break;
    }
  }
  const t = out.join(' ; ');
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
}
