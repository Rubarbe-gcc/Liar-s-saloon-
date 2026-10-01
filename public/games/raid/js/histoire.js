/**
 * RAID — l'histoire, en dix chapitres.
 *
 * Les scènes des cinématiques : l'ouverture de l'aventure, l'entrée dans
 * chaque chapitre, l'entrée de chaque boss, et la fin. Une scène, c'est une
 * image (`art`, du HTML déjà prêt), une couleur, parfois un titre, et le
 * texte qui s'écrit à l'écran.
 *
 * Le récit tient en deux moitiés. On monte d'abord vers le Dragon Cendré, en
 * croyant qu'il est le mal. Puis on comprend qu'il était le verrou — et on
 * descend vers ce qu'il enfermait.
 *
 * Aucune règle ici : seulement le récit.
 */

import { spriteSvg } from '../../../shared/raid/sprites.js';
import { portraitSvg, aUnPortrait } from './boss.js';
import { teinte } from './textes.js';

const glyphe = (g) => `<div class="cine-glyphe">${g}</div>`;

/**
 * Chaque chapitre : son image, le résumé qu'on lit sur l'écran des chapitres
 * une fois qu'il est débloqué, et les scènes qui l'ouvrent.
 */
export const CHAPITRES = [
  { glyphe: '🌊',
    resume: 'Les caves de la montagne sont noyées depuis le réveil du Dragon. C’est par là que tous les raids sont entrés. C’est là que le premier s’est arrêté.',
    scenes: ['Les caves de la montagne sont sous l’eau depuis trois hivers. C’est par ici que les raids sont entrés. Leurs bannières flottent encore entre deux eaux.'] },
  { glyphe: '⛪',
    resume: 'Les moines qui gardaient le col ont disparu. Leurs cuisines tournent toujours, et ce qu’on y prépare n’a pas de nom.',
    scenes: ['Au-dessus des galeries, le cloître des moines du col. Les cloches sonnent encore les heures. Plus personne ne les tire.'] },
  { glyphe: '⚒',
    resume: 'Les forges de la guilde, creusées par les nains. Le feu qu’ils y ont laissé a grandi tout seul, et il a appris à marcher.',
    scenes: ['C’est ici que la guilde forgeait ses lames. Les enclumes sont rouges, les soufflets battent — et le feu, dans le grand fourneau, a ouvert les yeux.'] },
  { glyphe: '❄',
    resume: 'Un royaume entier dormait sous la glace bien avant la guilde. Sa reine n’a jamais accepté qu’il soit mort.',
    scenes: ['Le froid, d’un coup. Sous la glace, des rues, des marchés, des gens — tous figés en plein geste, depuis plus longtemps que la guilde n’existe.'] },
  { glyphe: '🐉',
    resume: 'Le sommet. La cendre tombe si dru qu’on ne voit plus le ciel. Le Dragon Cendré vous attend, et il a quelque chose à dire.',
    scenes: ['Le sommet. La cendre tombe si dru qu’on ne voit plus le ciel. Chaque raid de la guilde est mort en essayant d’arriver jusqu’ici. Vous y êtes.'] },
  { glyphe: '🌳',
    resume: 'Le Dragon n’était pas le mal : il était le verrou. Sous son corps, un escalier que personne n’a creusé descend vers la forêt d’avant les hommes.',
    scenes: [
      '« Tu n’as pas compris… Je n’étais pas la porte forcée. J’étais la serrure. » Les derniers mots du Dragon restent dans l’air longtemps après lui.',
      'Sous son corps, la montagne s’ouvre. Un escalier que personne n’a creusé descend dans le noir. La cendre ne tombait pas du ciel : elle montait d’en bas.',
      'Tout en bas de l’escalier, il n’y a pas de pierre. Il y a des racines grosses comme des tours, et une forêt qui n’a jamais vu le soleil.',
    ] },
  { glyphe: '⚰️',
    resume: 'Plus bas, les tombeaux des premiers rois. Sur chaque dalle, le même blason : celui de la guilde. Elle est bien plus vieille qu’on ne vous l’a dit.',
    scenes: [
      'Sous les racines, une nécropole. Des rois couchés par centaines — et sur chaque dalle, gravé dans le marbre, le blason de la guilde.',
      'La guilde n’a pas été fondée pour tuer un dragon. Elle a été fondée pour en poser un sur quelque chose.',
    ] },
  { glyphe: '🏰',
    resume: 'Une forteresse bâtie la tête en bas, tours vers l’abîme. Les anges qui la gardaient regardaient tous dans la même direction : dessous.',
    scenes: ['Une citadelle construite à l’envers, ses tours pointées vers le fond. Les statues d’anges qui la bordent regardent toutes vers le bas, l’épée tirée.'] },
  { glyphe: '👁',
    resume: 'Ici, plus de pierre, plus de haut ni de bas. Seulement une fente dans le monde, et quelque chose qui regarde au travers depuis mille ans.',
    scenes: ['Après la citadelle, il n’y a plus rien. Ni sol, ni plafond. Une fente dans le monde — et, collé contre elle de l’autre côté, un œil.'] },
  { glyphe: '👑',
    resume: 'Azhar-Khûl, premier maître de la guilde. Il a voulu un jour sans fin ; on l’a enfermé sous une montagne, avec un dragon pour verrou. Vous avez tué le verrou.',
    scenes: [
      'Un trône de cendre, au fond de tout. Dessus, un roi couronné que les livres de la guilde ont rayé de toutes leurs pages.',
      'Azhar-Khûl. Le premier maître. Il a voulu un jour qui ne finisse jamais, et ses propres compagnons l’ont enfermé ici, un dragon posé sur la porte.',
      'Trente raids sont morts pour tuer ce dragon. Vous avez réussi. Il ne reste plus qu’à réparer ce que vous avez fait.',
    ] },
];

/** L'ouverture : pourquoi on monte, et pourquoi seul. Elle amène le premier chapitre. */
export function scenesIntro(heros, nomChapitre) {
  return [
    { art: glyphe('🌋'), couleur: '#ff6a3d', titre: 'Il y a trois hivers',
      texte: 'Le Pic de l’Aube s’est mis à fumer. Puis la cendre est tombée sur la vallée, jour et nuit, sans un bruit.' },
    { art: glyphe('🐉'), couleur: '#ff6a3d', titre: 'Sarkhavel',
      texte: 'Les anciens ont reconnu le signe : le Dragon Cendré s’est réveillé dans son donjon, et tout ce qui dormait sous la montagne s’est réveillé avec lui.' },
    { art: glyphe('⚰️'), couleur: '#a855f7',
      texte: 'La guilde a envoyé ses meilleurs raids. Six héros, puis douze, puis trente. Aucun n’est redescendu.' },
    { art: spriteSvg(heros), couleur: teinte(heros.ecole), titre: heros.nom,
      texte: `Il ne reste que vous : ${heros.nom}, ${heros.titre.charAt(0).toLowerCase()}${heros.titre.slice(1)}. Pas de raid, pas de bannière. Une poignée de potions, et une idée fixe.` },
    ...scenesChapitre(1, nomChapitre, 'nature'),
  ];
}

/** L'entrée dans un chapitre. */
export function scenesChapitre(n, nom, ecole) {
  const c = CHAPITRES[n - 1];
  if (!c) return [];
  const couleur = teinte(ecole);
  return c.scenes.map((texte, i) => ({
    art: glyphe(c.glyphe), couleur,
    titre: i === c.scenes.length - 1 ? `Chapitre ${n} — ${nom}` : '',
    texte,
  }));
}

/** Ce que chaque maître du donjon a à dire avant le combat. */
const REPLIQUES = {
  morvase: {
    lieu: 'L’eau du grand bassin est verte, épaisse, et elle respire. Au milieu flottent des casques, des épées — et une couronne d’os.',
    dit: '« Blop. Encore des petits. Les derniers étaient six, ils ont fondu si vite. Venez. Maman a faim. »',
  },
  vorgath: {
    lieu: 'Une odeur de fer et de sel. Des crochets, des chaînes, un établi. Et derrière, quelqu’un qui chantonne en travaillant.',
    dit: '« Ah ! Des clients. Vorgath découpe, Vorgath pèse, Vorgath emballe. Vous voulez être servis ensemble ? »',
  },
  kharn: {
    lieu: 'Le sol tremble, se fend, rougit. Ce que vous preniez pour le grand fourneau se déplie, et ouvre deux yeux de braise.',
    dit: '« PETITES CHOSES FROIDES. KHARN ÉTAIT LÀ AVANT LA MONTAGNE. KHARN SERA LÀ APRÈS VOUS. »',
  },
  ysolde: {
    lieu: 'Tout est gelé en plein geste : les torches, les gardes, une goutte d’eau. Seule une reine marche encore, pieds nus sur la glace.',
    dit: '« Mon royaume ne vieillit plus, ne souffre plus, ne ment plus. Restez. Je vous garderai intacts. »',
  },
  sarkhavel: {
    lieu: 'Le ciel est gris de cendre, et la cendre a une voix. Elle connaît votre nom depuis la première marche.',
    dit: '« Tu es monté seul, et tu arrives à plusieurs. Écoute-moi avant de frapper : je ne suis pas ce que tu crois. » Mais on ne discute pas avec ce qui a tué trente raids.',
  },
  yggmar: {
    lieu: 'Au cœur de la forêt, un arbre plus vieux que les montagnes. Dans son tronc fendu, quelque chose bat, lentement, comme un cœur.',
    dit: '« Je tenais le verrou par les racines. Vous l’avez arraché. Je ne suis pas en colère, petits. Je suis en deuil. »',
  },
  nelizar: {
    lieu: 'Mille bougies noires s’allument sur votre passage. Au fond de la crypte, un roi mort lit un livre qui n’a plus de pages.',
    dit: '« J’étais son scribe. J’ai rayé son nom de tous les livres, moi-même. Et vous descendez le lui rendre ? »',
  },
  seraphiel: {
    lieu: 'Tout en bas de la citadelle, un seul ange est resté à son poste. Ses six ailes sont noires de mille ans de cendre.',
    dit: '« J’ai juré de ne laisser descendre personne. J’ai tenu mille ans, et j’en ai oublié pourquoi. Pardonnez-moi : je ne sais plus faire que cela. »',
  },
  ozrath: {
    lieu: 'L’œil se tourne vers vous. Il n’a pas de paupière. Derrière lui, il n’y a pas de corps — seulement l’envie de regarder.',
    dit: '« … » Il ne parle pas. Il vous montre seulement ce que vous serez dans mille ans, et attend que vous cessiez de vous débattre.',
  },
  azhar: {
    lieu: 'Le roi se lève de son trône. La cendre monte de ses épaules comme une cape. Il vous regarde avec quelque chose qui ressemble à de la gratitude.',
    dit: '« Mille ans que j’attends qu’on tue mon geôlier. Je vous dois tout. Laissez-moi vous offrir ce que j’ai promis au monde : un jour qui ne finit jamais. »',
  },
  // Les élites qui tiennent le rôle de boss dans d'anciennes sauvegardes.
  hurlefer: { lieu: 'Un hurlement fait vibrer les grilles. Quelque chose d’énorme tourne en rond dans le noir.', dit: '« … » La bête ne parle pas. Sa mâchoire de fer s’ouvre lentement.' },
  banshie: { lieu: 'Le froid tombe d’un coup. Une femme en robe de noces pleure sans bruit, dos tourné.', dit: '« Ils m’avaient promis de revenir me chercher. Vous aussi, vous allez promettre ? »' },
  sentinelle: { lieu: 'Une armure haute comme une porte barre le passage. Personne ne la porte.', dit: '« Consigne : nul ne passe. Consigne maintenue. »' },
  minotaure: { lieu: 'Entre les enclumes, une ombre cornue affûte une hache à deux mains.', dit: '« Encore de la viande pour le fourneau. »' },
  tisseuse: { lieu: 'Les murs sont doux comme de la soie. Des cocons pendent du plafond.', dit: '« Chut… ne tirez pas sur le fil. Ils dorment si bien. »' },
};

/** L'entrée d'un boss : le lieu, puis le maître des lieux. */
export function scenesBoss(boss, chapitre, nomChapitre) {
  const r = REPLIQUES[boss.modeleId] || { lieu: 'Le maître du chapitre vous attend.', dit: '« … »' };
  const couleur = teinte(boss.ecole);
  return [
    { art: glyphe('👑'), couleur, titre: `Chapitre ${chapitre} — ${nomChapitre}`, texte: r.lieu },
    { art: artBoss(boss), couleur, titre: boss.nom, texte: r.dit },
  ];
}

/** Le portrait d'un boss, pour une cinématique ou pour l'écran des chapitres. */
export function artBoss(boss) {
  return aUnPortrait({ ...boss, rang: 'boss' })
    ? `<div class="cine-portrait">${portraitSvg(boss)}</div>` : spriteSvg(boss);
}

/** La fin : le jour se lève, et il finit. */
export function scenesFin(groupe) {
  const noms = groupe.map((p) => p.nom);
  const liste = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0];
  return [
    { art: glyphe('👑'), couleur: '#ff6a3d', titre: 'Le Roi Sans Aube',
      texte: '« Un jour sans fin… je voulais seulement qu’il ne fasse plus jamais nuit. » Azhar-Khûl se défait comme un feu qu’on couvre.' },
    { art: glyphe('🕳'), couleur: '#a855f7',
      texte: 'La montagne se referme derrière vous, étage après étage. Cette fois il n’y a plus de verrou : il n’y a plus rien à enfermer.' },
    { art: glyphe('🌅'), couleur: '#ffd45e', titre: 'L’aube',
      texte: `La cendre cesse de tomber. Le soleil se lève sur le Pic — et ce soir, il se couchera. ${liste} ${noms.length > 1 ? 'redescendent' : 'redescend'} vers la vallée.` },
  ];
}
