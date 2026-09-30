/**
 * RAID — l'aventure : niveaux, dons, chance et événements.
 *
 * Le raid ne descend plus le donjon avec toute sa force dès la première salle.
 * Il part au niveau 1, plus faible que ses fiches ne le promettent, et gagne
 * de l'expérience à chaque victoire. Entre deux rencontres, le donjon pose des
 * questions — un autel, un prisonnier, un pacte — et chaque réponse laisse une
 * trace : sur la vie du raid, sur sa chance, ou sur les boss qui l'attendent.
 *
 * Les effets sont des DONNÉES, lues à la fois pour s'appliquer et pour
 * s'écrire : l'écran ne peut pas annoncer autre chose que ce qui arrive.
 *
 * Module ISO : ni DOM ni Node.
 */

/* ------------------------------------------------------------------ */
/* Niveaux                                                             */
/* ------------------------------------------------------------------ */

export const NIVEAU_MAX = 10;

/** Expérience cumulée qu'il faut pour atteindre chaque niveau (index = niveau). */
export const SEUILS_XP = [0, 0, 40, 100, 170, 250, 340, 440, 550, 670, 800];

/**
 * Puissance des héros selon le niveau : un facteur sur l'attaque, l'armure et
 * la vie. Au niveau 1, le raid ne vaut que les trois quarts de ses fiches ;
 * vers le boss de fin, il les dépasse.
 */
export const puissance = (niveau = null) =>
  (niveau == null ? 1 : 0.74 + 0.045 * (Math.min(NIVEAU_MAX, Math.max(1, niveau)) - 1));

export function niveauDe(xp) {
  let n = 1;
  while (n < NIVEAU_MAX && xp >= SEUILS_XP[n + 1]) n++;
  return n;
}

/** Progression dans le niveau en cours, de 0 à 1. */
export function progressionNiveau(xp) {
  const n = niveauDe(xp);
  if (n >= NIVEAU_MAX) return 1;
  return (xp - SEUILS_XP[n]) / (SEUILS_XP[n + 1] - SEUILS_XP[n]);
}

/** Expérience d'une victoire : le boss d'aile rapporte plus que la salle d'avant. */
export function xpDeRencontre({ boss, ennemis }) {
  if (boss) return 75;
  const elite = ennemis.some((e) => e.rang === 'elite');
  return elite ? 50 : 30 + 10 * (ennemis.length - 1);
}

/** Niveaux qui ouvrent le choix d'un don. */
export const NIVEAUX_DON = [3, 5, 7, 9];

/* ------------------------------------------------------------------ */
/* Chance                                                              */
/* ------------------------------------------------------------------ */

export const CHANCE_DEPART = 5;
export const CHANCE_MAX = 40;

/** Chance de coup critique en combat. */
export const critiqueDe = (chance = 0) => Math.min(0.45, chance / 100 + (chance > 0 ? 0.03 : 0));
export const MULT_CRITIQUE = 1.5;

/** Chance de réussir un choix risqué. */
export const reussiteDe = (base, chance = 0) => Math.min(0.95, base + chance / 100);

/* ------------------------------------------------------------------ */
/* Dons                                                                */
/* ------------------------------------------------------------------ */

/**
 * Un don se choisit aux niveaux 3, 5, 7 et 9. Chacun s'exprime dans le même
 * vocabulaire que le butin, pour que le moteur de combat n'ait qu'une seule
 * façon de les lire.
 */
export const DONS = [
  { id: 'ferveur', nom: 'Ferveur', glyphe: '🔥', effet: { butin: { atk: 0.1 } } },
  { id: 'robustesse', nom: 'Robustesse', glyphe: '❤️', effet: { butin: { pv: 0.12 }, vie: 0.12 } },
  { id: 'rempart', nom: 'Rempart', glyphe: '🛡', effet: { butin: { def: 0.14 } } },
  { id: 'arcanes', nom: 'Arcanes profondes', glyphe: '🔷', effet: { butin: { mana: 1 } } },
  { id: 'benediction', nom: 'Bénédiction', glyphe: '✨', effet: { butin: { soin: 0.25, potion: 0.1 } } },
  { id: 'etoile', nom: 'Bonne étoile', glyphe: '🍀', effet: { chance: 8 } },
  { id: 'precision', nom: 'Précision mortelle', glyphe: '🎯', effet: { chance: 3, butin: { critique: 0.4 } } },
  { id: 'tueur', nom: 'Tueur de boss', glyphe: '👑', effet: { butin: { boss: 0.15 } } },
  { id: 'souffle', nom: 'Second souffle', glyphe: '🌬', effet: { butin: { recup: 0.08 } } },
  { id: 'herboriste', nom: 'Herboriste', glyphe: '🌿', effet: { objets: 1, butin: { potion: 0.1 } } },
];
export const DONS_PAR_ID = Object.fromEntries(DONS.map((d) => [d.id, d]));

/* ------------------------------------------------------------------ */
/* Événements                                                          */
/* ------------------------------------------------------------------ */

/**
 * Un choix porte soit un `effet` certain, soit un `risque` : une chance de
 * base, augmentée de la chance du raid, un effet en cas de réussite et un en
 * cas d'échec. `exige` écarte un choix qu'on ne peut pas payer.
 *
 * Vocabulaire des effets :
 *   vie      part de la vie maximale rendue (négatif : perdue, jamais mortelle)
 *   xp       expérience
 *   chance   points de chance
 *   objets   potions
 *   butin    parts ajoutées au butin, pour tout le donjon
 *   boss     { cible: 'aile' | 'final', pv, atk, retire } sur un boss à venir
 *   piece    une pièce de butin tirée au sort
 *   sauter   passe la rencontre suivante (pas son boss)
 */
export const EVENEMENTS = [
  {
    id: 'autel', titre: 'L’autel oublié', glyphe: '🕯',
    texte: 'Un autel couvert de cendres. Les offrandes y sont encore fraîches — et elles ne viennent pas de vous.',
    choix: [
      { id: 'prier', label: 'Prier', effet: { vie: 0.2 }, dit: 'Une chaleur calme vous traverse.' },
      { id: 'profaner', label: 'Profaner l’autel', effet: { butin: { degats: 0.1 }, boss: { cible: 'final', pv: 0.1 } },
        dit: 'Le pouvoir de l’autel passe dans vos armes. Tout en haut, quelque chose se réveille en colère.' },
      { id: 'passer', label: 'Passer son chemin', effet: {}, dit: 'Mieux vaut ne pas s’en mêler.' },
    ],
  },
  {
    id: 'prisonnier', titre: 'Le prisonnier enchaîné', glyphe: '⛓',
    texte: 'Un éclaireur d’une autre guilde, enchaîné au mur. Il jure connaître la faiblesse du maître de ces lieux.',
    choix: [
      { id: 'liberer', label: 'Le libérer', effet: { vie: -0.1, chance: 2, boss: { cible: 'aile', retire: true } },
        dit: 'Les gardes tombent, l’éclaireur parle. Le boss de l’aile perd l’un de ses atouts.' },
      { id: 'depouiller', label: 'Le dépouiller', effet: { objets: 1, chance: -3 },
        dit: 'Une potion de plus. Personne ne vous regarde, mais la chance, si.' },
      { id: 'ignorer', label: 'L’ignorer', effet: {}, dit: 'Ses cris vous suivent un moment.' },
    ],
  },
  {
    id: 'fontaine', titre: 'La fontaine trouble', glyphe: '⛲',
    texte: 'L’eau brille d’une lueur qui n’est pas celle des torches. Elle pourrait guérir. Ou pas.',
    choix: [
      { id: 'boire', label: 'Boire', risque: { base: 0.5,
        succes: { vie: 0.3, chance: 3 }, echec: { vie: -0.15 },
        ditSucces: 'L’eau est pure : le raid se relève, plus confiant.',
        ditEchec: 'L’eau est croupie. Le raid la paie en crampes.' } },
      { id: 'fioles', label: 'Remplir les fioles', effet: { objets: 1 }, dit: 'Une potion de plus dans la sacoche.' },
      { id: 'passer', label: 'Passer', effet: {}, dit: 'On ne boit pas ce qu’on ne connaît pas.' },
    ],
  },
  {
    id: 'coffre', titre: 'Le coffre piégé', glyphe: '🧰',
    texte: 'Un coffre ferré, et sur le couvercle, les traces de ceux qui ont essayé avant vous.',
    choix: [
      { id: 'forcer', label: 'Le forcer', risque: { base: 0.45,
        succes: { piece: true }, echec: { vie: -0.2 },
        ditSucces: 'Le mécanisme cède : une pièce d’équipement vous attendait.',
        ditEchec: 'Des lames jaillissent. Le raid saigne.' } },
      { id: 'laisser', label: 'Le laisser', effet: { chance: 1 }, dit: 'La prudence a sa récompense.' },
    ],
  },
  {
    id: 'marchand', titre: 'Le marchand de l’ombre', glyphe: '🧙',
    texte: '« Tout s’échange, ici. Même ce que vous n’êtes pas prêts à perdre. »',
    choix: [
      { id: 'potion', label: 'Une potion contre de la force', exige: { objets: 1 },
        effet: { objets: -1, butin: { atk: 0.08 } }, dit: 'Il empoche la fiole. Vos bras se font plus lourds de puissance.' },
      { id: 'sang', label: 'Du sang contre du mana', effet: { vie: -0.15, butin: { mana: 1 } },
        dit: 'Une entaille, une fiole de sang, et le mana coule plus vite.' },
      { id: 'refuser', label: 'Refuser', effet: {}, dit: 'Il sourit, comme s’il savait qu’on se reverrait.' },
    ],
  },
  {
    id: 'raccourci', titre: 'Le passage dérobé', glyphe: '🚪', seulement: 'debut',
    texte: 'Un couloir étroit file droit vers la salle du boss, en contournant la prochaine meute.',
    choix: [
      { id: 'raccourci', label: 'Prendre le raccourci', effet: { sauter: true, boss: { cible: 'aile', atk: 0.12 } },
        dit: 'Vous arrivez directement au boss… qui vous attendait.' },
      { id: 'long', label: 'Le chemin normal', effet: { xp: 20 }, dit: 'Chaque combat forge le raid.' },
    ],
  },
  {
    id: 'sanctuaire', titre: 'Le sanctuaire des anciens', glyphe: '🏛',
    texte: 'Les noms de raids tombés ici sont gravés sur les murs. L’endroit invite à s’arrêter.',
    choix: [
      { id: 'mediter', label: 'Étudier leurs erreurs', effet: { xp: 50 }, dit: 'Leurs erreurs deviennent vos leçons.' },
      { id: 'reposer', label: 'Se reposer', effet: { vie: 0.3 }, dit: 'Le raid dort d’un sommeil sans rêves.' },
    ],
  },
  {
    id: 'nid', titre: 'L’antre du boss', glyphe: '👁',
    texte: 'Par une fissure, vous apercevez le maître de l’aile. Il ne vous a pas encore vus.',
    choix: [
      { id: 'espionner', label: 'L’espionner', risque: { base: 0.55,
        succes: { boss: { cible: 'aile', pv: -0.15 } }, echec: { boss: { cible: 'aile', atk: 0.1 } },
        ditSucces: 'Vous repérez sa vieille blessure : il commencera le combat affaibli.',
        ditEchec: 'Un caillou roule. Il vous a vus, et il s’y prépare.' } },
      { id: 'pieger', label: 'Piéger son antre', effet: { vie: -0.1, boss: { cible: 'aile', pv: -0.08 } },
        dit: 'Poser les pièges coûte, mais il y laissera des plumes.' },
      { id: 'passer', label: 'Passer', effet: {}, dit: 'Chaque chose en son temps.' },
    ],
  },
  {
    id: 'pacte', titre: 'La voix du Dragon', glyphe: '🐉', ailes: [2, 4],
    texte: 'Une voix résonne dans vos têtes : « Je peux vous rendre forts. Assez pour venir me voir. »',
    choix: [
      { id: 'accepter', label: 'Accepter le pacte', effet: { butin: { atk: 0.2 }, boss: { cible: 'final', atk: 0.2 } },
        dit: 'Une force brûlante vous envahit. Le Dragon aussi s’en nourrit.' },
      { id: 'refuser', label: 'Refuser', effet: { chance: 4 }, dit: 'La voix se tait. Vous vous sentez étrangement protégés.' },
    ],
  },
  {
    id: 'forgeron', titre: 'Le forgeron errant', glyphe: '⚒',
    texte: 'Un nain a posé son enclume au milieu du couloir. « Une retouche ? C’est offert. »',
    choix: [
      { id: 'aiguiser', label: 'Aiguiser les armes', effet: { butin: { degats: 0.06 } }, dit: 'Les lames chantent.' },
      { id: 'renforcer', label: 'Renforcer les armures', effet: { butin: { def: 0.1 } }, dit: 'Les plaques tiennent mieux.' },
    ],
  },
  {
    id: 'puits', titre: 'Le puits aux souhaits', glyphe: '🪙',
    texte: 'Un puits sans fond. On dit que ceux qui y sacrifient quelque chose de précieux sont exaucés.',
    choix: [
      { id: 'jeter', label: 'Y jeter une potion', exige: { objets: 1 }, risque: { base: 0.5,
        succes: { objets: -1, chance: 7, vie: 0.15 }, echec: { objets: -1, chance: 2 },
        ditSucces: 'Un écho lumineux remonte : le souhait est exaucé.',
        ditEchec: 'Rien ne se passe. Presque rien.' } },
      { id: 'passer', label: 'Passer', effet: {}, dit: 'Garder ses potions est aussi un souhait.' },
    ],
  },
  {
    id: 'rescapes', titre: 'Les rescapés', glyphe: '🧍',
    texte: 'Deux survivants d’un raid précédent, blessés, cachés dans une alcôve.',
    choix: [
      { id: 'escorter', label: 'Les escorter', effet: { vie: -0.12, xp: 40, chance: 3 },
        dit: 'Les protéger coûte, mais leurs récits valent de l’or.' },
      { id: 'soigner', label: 'Leur donner une potion', exige: { objets: 1 }, effet: { objets: -1, xp: 25, chance: 5 },
        dit: 'Leur gratitude vous porte chance.' },
      { id: 'laisser', label: 'Les laisser', effet: { chance: -2 }, dit: 'Le silence qui suit pèse un peu.' },
    ],
  },
];
export const EVENEMENTS_PAR_ID = Object.fromEntries(EVENEMENTS.map((e) => [e.id, e]));

/* ------------------------------------------------------------------ */
/* Texte des effets                                                    */
/* ------------------------------------------------------------------ */

const pc = (v) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} %`;
const NOMS_BUTIN = {
  atk: 'd’attaque', def: 'd’armure', pv: 'de vie max', degats: 'de dégâts', soin: 'aux soins',
  boss: 'de dégâts sur les boss', critique: 'de dégâts critiques', potion: 'aux potions', recup: 'de vie après chaque victoire',
};

/** Les effets d'un choix, en clair : c'est ce que le joueur lit avant de décider. */
export function texteEffet(e) {
  const out = [];
  if (e.vie) out.push(`${pc(e.vie)} de vie`);
  if (e.xp) out.push(`+${e.xp} XP`);
  if (e.chance) out.push(`${e.chance > 0 ? '+' : '−'}${Math.abs(e.chance)} chance`);
  if (e.objets) out.push(`${e.objets > 0 ? '+' : '−'}${Math.abs(e.objets)} potion${Math.abs(e.objets) > 1 ? 's' : ''}`);
  for (const [k, v] of Object.entries(e.butin || {})) {
    if (k === 'mana') out.push(`+${v} mana au départ`);
    else out.push(`${pc(v)} ${NOMS_BUTIN[k] || k}`);
  }
  if (e.piece) out.push('une pièce de butin');
  if (e.sauter) out.push('saute la prochaine meute');
  if (e.boss) {
    const qui = e.boss.cible === 'final' ? 'le Dragon' : 'le boss de l’aile';
    if (e.boss.pv) out.push(`${qui} : ${pc(e.boss.pv)} de vie`);
    if (e.boss.atk) out.push(`${qui} : ${pc(e.boss.atk)} d’attaque`);
    if (e.boss.retire) out.push(`${qui} perd une capacité`);
  }
  return out.join(' · ') || 'aucun effet';
}

/** Le texte d'un don, construit de la même façon. */
export const texteDon = (d) => texteEffet(d.effet);
