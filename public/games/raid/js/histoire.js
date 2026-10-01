/**
 * RAID — l'histoire.
 *
 * Les scènes des cinématiques : l'ouverture de l'aventure, l'entrée de chaque
 * boss, et la fin. Une scène, c'est une image (`art`, du HTML déjà prêt), une
 * couleur, parfois un titre, et le texte qui s'écrit à l'écran.
 *
 * Aucune règle ici : seulement le récit.
 */

import { spriteSvg } from '../../../shared/raid/sprites.js';
import { portraitSvg, aUnPortrait } from './boss.js';
import { teinte } from './textes.js';

const glyphe = (g) => `<div class="cine-glyphe">${g}</div>`;

/** L'ouverture : pourquoi on monte, et pourquoi seul. */
export function scenesIntro(heros) {
  return [
    { art: glyphe('🌋'), couleur: '#ff6a3d', titre: 'Il y a trois hivers',
      texte: 'Le Pic de l’Aube s’est mis à fumer. Puis la cendre est tombée sur la vallée, jour et nuit, sans un bruit.' },
    { art: glyphe('🐉'), couleur: '#ff6a3d', titre: 'Sarkhavel',
      texte: 'Les anciens ont reconnu le signe : le Dragon Cendré s’est réveillé dans son donjon, et tout ce qui dormait sous la montagne s’est réveillé avec lui.' },
    { art: glyphe('⚰️'), couleur: '#a855f7',
      texte: 'La guilde a envoyé ses meilleurs raids. Six héros, puis douze, puis trente. Aucun n’est redescendu.' },
    { art: spriteSvg(heros), couleur: teinte(heros.ecole), titre: heros.nom,
      texte: `Il ne reste que vous : ${heros.nom}, ${heros.titre.charAt(0).toLowerCase()}${heros.titre.slice(1)}. Pas de raid, pas de bannière. Une poignée de potions, et une idée fixe.` },
    { art: glyphe('🚪'), couleur: '#e8c060', titre: 'Cinq actes',
      texte: 'Cinq étages séparent la porte du sommet. On dit que d’autres rescapés errent encore là-haut. Trouvez-les. Montez. Et faites taire la montagne.' },
  ];
}

/** Ce que chaque maître du donjon a à dire avant le combat. */
const REPLIQUES = {
  hurlefer: {
    lieu: 'Un hurlement fait vibrer les grilles. Quelque chose d’énorme tourne en rond dans le noir, et ses chaînes sont cassées.',
    dit: '« … »  La bête ne parle pas. Elle renifle, vous trouve, et sa mâchoire de fer s’ouvre lentement.',
  },
  banshie: {
    lieu: 'Le froid tombe d’un coup. Sur les dalles, une femme en robe de noces pleure sans bruit, dos tourné.',
    dit: '« Ils m’avaient promis de revenir me chercher. Vous aussi, vous allez promettre ? »',
  },
  sentinelle: {
    lieu: 'Une armure haute comme une porte barre le passage. Personne ne la porte. Elle tourne pourtant la tête vers vous.',
    dit: '« Consigne : nul ne passe. Consigne reçue il y a quatre cents ans. Consigne maintenue. »',
  },
  minotaure: {
    lieu: 'Les soufflets de la forge battent tout seuls. Entre les enclumes, une ombre cornue affûte une hache à deux mains.',
    dit: '« Encore de la viande pour le fourneau. Le maître aime ses lames bien trempées. »',
  },
  tisseuse: {
    lieu: 'Les murs sont doux comme de la soie. Des cocons pendent du plafond — certains portent encore le blason de la guilde.',
    dit: '« Chut… ne tirez pas sur le fil. Ils dorment si bien. Vous dormirez aussi. »',
  },
  vorgath: {
    lieu: 'Une odeur de fer et de sel. Des crochets, des chaînes, un établi. Et derrière, quelqu’un qui chantonne en travaillant.',
    dit: '« Ah ! Des clients. Vorgath découpe, Vorgath pèse, Vorgath emballe. Vous voulez être servis ensemble ? »',
  },
  nelizar: {
    lieu: 'Mille bougies noires s’allument sur votre passage. Au fond de la crypte, un roi mort lit un livre qui n’a plus de pages.',
    dit: '« J’ai essayé de mourir, autrefois. Je n’y suis jamais arrivé. Voyons si vous êtes plus doués que moi. »',
  },
  ysolde: {
    lieu: 'Tout est gelé en plein geste : les torches, les gardes, une goutte d’eau. Seule une reine marche encore, pieds nus sur la glace.',
    dit: '« Mon royaume ne vieillit plus, ne souffre plus, ne ment plus. Restez. Je vous garderai intacts. »',
  },
  kharn: {
    lieu: 'Le sol tremble, se fend, rougit. Ce que vous preniez pour une colline se déplie, et ouvre deux yeux de braise.',
    dit: '« PETITES CHOSES FROIDES. KHARN ÉTAIT LÀ AVANT LA MONTAGNE. KHARN SERA LÀ APRÈS VOUS. »',
  },
  sarkhavel: {
    lieu: 'Le sommet. Le ciel est gris de cendre, et la cendre a une voix. Elle connaît votre nom depuis la première marche.',
    dit: '« Tu es monté seul, et tu arrives à plusieurs. Les autres raids ont fait l’inverse. Viens. Montre-moi ce que vaut une promesse tenue. »',
  },
};

/** L'entrée d'un boss : le lieu, puis le maître des lieux. */
export function scenesBoss(boss, acte, nomActe) {
  const r = REPLIQUES[boss.modeleId] || { lieu: 'Le maître de l’acte vous attend.', dit: '« … »' };
  const couleur = teinte(boss.ecole);
  const art = aUnPortrait({ ...boss, rang: 'boss' })
    ? `<div class="cine-portrait">${portraitSvg(boss)}</div>` : spriteSvg(boss);
  return [
    { art: glyphe('👑'), couleur, titre: `Acte ${acte} — ${nomActe}`, texte: r.lieu },
    { art, couleur, titre: boss.nom, texte: r.dit },
  ];
}

/** La fin : la montagne se tait. */
export function scenesFin(groupe) {
  const noms = groupe.map((p) => p.nom);
  const liste = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0];
  return [
    { art: glyphe('🐉'), couleur: '#ff6a3d', titre: 'Le Dragon Cendré tombe',
      texte: '« Une promesse tenue… » Sarkhavel s’affaisse, et son dernier souffle n’est plus que de la fumée tiède.' },
    { art: glyphe('🌅'), couleur: '#ffd45e', titre: 'L’aube',
      texte: `La cendre cesse de tomber. Pour la première fois depuis trois hivers, le soleil se lève sur le Pic. ${liste} ${noms.length > 1 ? 'redescendent' : 'redescend'} vers la vallée.` },
  ];
}
