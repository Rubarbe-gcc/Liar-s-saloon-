/**
 * RAID — les reliques et les quêtes.
 *
 * Une relique est un objet rare qui vaut pour tout le groupe, jusqu'au bout
 * de l'aventure. Elle tombe sur les boss, récompense certaines quêtes, et se
 * vend — cher — chez les marchands.
 *
 * Les bonus parlent le vocabulaire du groupe (`aventure.bonusDe`) :
 *   degats, pv, def, pm, recup   comme les dons ;
 *   xpPlus, orPlus               part d'expérience et d'or en plus ;
 *   rabais                       part en moins sur les prix des marchands ;
 *   egide                        bouclier du groupe pendant les deux premières manches ;
 *   sablier                      vitesse en plus pour le groupe, la première manche ;
 *   phenix                       le premier héros qui tombe se relève, une fois par combat.
 *
 * Module ISO : ni DOM ni Node.
 */

export const RELIQUES = [
  { id: 'griffe', nom: 'Griffe du Dragon', glyphe: '🐲', bonus: { degats: 0.12 }, texte: '+12 % de dégâts pour tout le groupe.' },
  { id: 'calice', nom: 'Calice de sang', glyphe: '🍷', bonus: { recup: 0.08 }, texte: '+8 % de vie rendue après chaque victoire.' },
  { id: 'trefle', nom: 'Trèfle d’or', glyphe: '🍀', bonus: { orPlus: 0.3 }, chance: 8, texte: '+30 % d’or trouvé, et +8 de chance.' },
  { id: 'grimoire', nom: 'Grimoire annoté', glyphe: '📖', bonus: { xpPlus: 0.2 }, texte: '+20 % d’expérience gagnée.' },
  { id: 'egide', nom: 'Égide ancienne', glyphe: '🔰', bonus: { egide: 0.25 }, texte: 'Chaque combat commence sous un bouclier : −25 % de dégâts pendant 2 manches.' },
  { id: 'sablier', nom: 'Sablier fêlé', glyphe: '⏳', bonus: { sablier: 10 }, texte: 'Le groupe agit toujours en premier, la première manche.' },
  { id: 'coeur', nom: 'Cœur de phénix', glyphe: '🔥', bonus: { phenix: 1 }, texte: 'Une fois par combat, le premier héros qui tombe se relève avec 30 % de sa vie.' },
  { id: 'pierre', nom: 'Pierre de mana', glyphe: '💎', bonus: { pm: 6 }, texte: '+6 PM max pour chacun.' },
  { id: 'bourse', nom: 'Bourse sans fond', glyphe: '👛', bonus: { rabais: 0.2 }, texte: 'Les marchands vendent 20 % moins cher.' },
  { id: 'heaume', nom: 'Heaume du colosse', glyphe: '⛑', bonus: { pv: 0.1, def: 0.08 }, texte: '+10 % de vie et +8 % d’armure pour tout le groupe.' },
];
export const RELIQUES_PAR_ID = Object.fromEntries(RELIQUES.map((r) => [r.id, r]));

/** La somme des bonus d'une liste de reliques. */
export function bonusReliques(ids = []) {
  const out = {};
  for (const id of ids) {
    const r = RELIQUES_PAR_ID[id];
    if (!r) continue;
    for (const [k, v] of Object.entries(r.bonus)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Quêtes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Une quête compte quelque chose (`compte`) jusqu'à un but, pendant l'acte où
 * elle a été acceptée. La récompense suit le vocabulaire des effets de
 * l'aventure, plus `relique` et `pieceEpique`.
 */
export const QUETES = [
  { id: 'battue', nom: 'La battue', glyphe: '🐗', compte: 'monstres',
    but: (acte) => 5 + acte, texte: (n) => `Vaincre ${n} monstres.`,
    recompense: (acte) => ({ or: 50 + 30 * acte, objets: 1 }) },
  { id: 'prime', nom: 'Tête mise à prix', glyphe: '💀', compte: 'elites',
    but: () => 1, texte: () => 'Vaincre une élite (derrière une porte, ou en embuscade).',
    recompense: () => ({ relique: true }) },
  { id: 'intact', nom: 'Sans une égratignure', glyphe: '🩹', compte: 'intacts',
    but: () => 3, texte: (n) => `Gagner ${n} combats sans qu’un héros tombe.`,
    recompense: (acte) => ({ xp: 35 + 20 * acte, chance: 2 }) },
  { id: 'client', nom: 'Bon client', glyphe: '🛒', compte: 'depense',
    but: (acte) => 60 + 40 * acte, texte: (n) => `Dépenser ${n} pièces d’or chez les marchands.`,
    recompense: () => ({ pieceEpique: true }) },
  { id: 'eclaireur', nom: 'L’éclaireur', glyphe: '🧭', compte: 'chasses',
    but: () => 3, texte: (n) => `Chasser ${n} fois en rôdant.`,
    recompense: (acte) => ({ or: 30 + 20 * acte, objets: 1, elixirs: 1 }) },
];
export const QUETES_PAR_ID = Object.fromEntries(QUETES.map((q) => [q.id, q]));

/** Une quête prête à être proposée pour un acte. */
export function instancierQuete(id, acte) {
  const q = QUETES_PAR_ID[id];
  const but = q.but(acte);
  return { id, acte, but, progres: 0, recompense: q.recompense(acte) };
}

export const texteQuete = (quete) => QUETES_PAR_ID[quete.id].texte(quete.but);
