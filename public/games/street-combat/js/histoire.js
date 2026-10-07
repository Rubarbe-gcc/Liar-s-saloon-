/**
 * STREET COMBAT — le mode Histoire : « La Fracture ».
 *
 * Une nuit, le ciel se fend au-dessus de la ville. Les combattants du monde,
 * touchés par la Fracture, se retournent les uns contre les autres. Le héros
 * (le combattant du joueur) les libère un à un, affronte le gardien de la
 * lumière, le seigneur des enfers, Le Chaos… et découvre qui tire les
 * ficelles : Kaïros, le Seigneur du Temps.
 *
 * Chaque chapitre : une cinématique avant, le combat, une cinématique
 * après. Les boss vaincus rejoignent le roster ; Kaïros, à la fin.
 * Si le héros est l'adversaire prévu, c'est le `remplacant` qui se bat.
 */

export const PROLOGUE = [
  { decor: 'neon' },
  { effet: 'nuit', attendre: false },
  { titre: 'LA FRACTURE', sur: 'STREET COMBAT', sous: 'Mode Histoire' },
  { narre: 'Depuis toujours, les plus grands combattants du monde se mesurent dans les rues de Néon City. Pour l’honneur. Pour le plaisir.' },
  { entre: 'hero', cote: 'g', comment: 'marche' },
  { narre: 'Puis, une nuit, le ciel s’est fendu.' },
  { effet: 'fracture', attendre: false },
  { effet: 'secousse', duree: 50 },
  { dit: 'hero', texte: 'Qu’est-ce que c’est que ça ?! Le ciel… il se déchire !', p: 'garde' },
  { entre: 'solarius', cote: 'd', comment: 'apparait' },
  { dit: 'solarius', texte: 'N’aie pas peur, combattant. Je suis Solarius, gardien de la lumière.' },
  { dit: 'solarius', texte: 'Cette déchirure, c’est la Fracture. Une force très ancienne la tient ouverte… et Le Chaos s’éveille de l’autre côté.' },
  { dit: 'solarius', texte: 'Ceux qui ont l’âme fragile sont déjà touchés. Les combattants de ce monde vont se retourner les uns contre les autres.' },
  { dit: 'hero', texte: 'Alors je les arrêterai. Un par un, s’il le faut.', p: 'repos' },
  { dit: 'solarius', texte: 'Prouve d’abord ta force. Quand tu seras prêt, rejoins-moi à la Cathédrale Solaire.' },
  { sort: 'solarius', comment: 'teleport' },
  { dit: 'hero', texte: 'Bon. Il paraît que ça brûle, du côté du vieux dojo…' },
];

export const CHAPITRES = [
  {
    titre: 'CHAPITRE 1', sous: 'Le dojo en flammes', arene: 'dojo',
    combat: { adv: 'blazero', remplacant: 'thunderox', niveau: { normal: 'facile', difficile: 'normal' } },
    avant: [
      { entre: 'hero', cote: 'g', comment: 'marche' },
      { entre: 'blazero', cote: 'd', comment: 'saut' },
      { dit: 'blazero', texte: 'Hé ! Tu tombes bien ! Depuis que le ciel s’est fendu, mes flammes ont une de ces faims !' },
      { dit: 'hero', texte: 'Tes yeux… La Fracture t’a touché, toi aussi.', p: 'garde' },
      { dit: 'blazero', texte: 'Touché ? Je ne me suis jamais senti aussi FORT ! Viens, que je te fasse fondre !', p: 'lance' },
    ],
    apres: [
      { dit: 'blazero', texte: 'Argh… ma tête… Qu’est-ce que je faisais ?', p: 'touche' },
      { dit: 'hero', texte: 'Tu n’étais plus toi-même. C’est fini, maintenant.' },
      { dit: 'blazero', texte: 'Fais gaffe… Pendant que je délirais, j’entendais une voix. Elle parlait de la jungle…', p: 'repos' },
    ],
  },
  {
    titre: 'CHAPITRE 2', sous: 'Le venin de la jungle', arene: 'jungle',
    combat: { adv: 'serpenta', remplacant: 'celestia', niveau: { normal: 'facile', difficile: 'normal' } },
    avant: [
      { entre: 'hero', cote: 'g', comment: 'marche' },
      { entre: 'serpenta', cote: 'd', comment: 'apparait' },
      { dit: 'serpenta', texte: 'Sssss… Encore un héros qui s’égare dans ma jungle.' },
      { dit: 'hero', texte: 'La Fracture te contrôle. Laisse-moi t’aider.' },
      { dit: 'serpenta', texte: 'M’aider ? Elle m’a offert un venin qui ne pardonne pas. Goûte-le donc !', p: 'garde' },
    ],
    apres: [
      { dit: 'serpenta', texte: 'Je… je voyais un homme. Avec une horloge dans le dos.', p: 'touche' },
      { dit: 'hero', texte: 'Une horloge ?' },
      { dit: 'serpenta', texte: 'Il riait. Il disait que tout était déjà écrit. Il parlait d’une station, là-haut, au-dessus des nuages…', p: 'repos' },
    ],
  },
  {
    titre: 'CHAPITRE 3', sous: 'Station Zéro-G', arene: 'station',
    combat: { adv: 'ironclad', remplacant: 'stoneback', niveau: { normal: 'normal', difficile: 'difficile' } },
    avant: [
      { entre: 'hero', cote: 'g', comment: 'marche' },
      { entre: 'ironclad', cote: 'd', comment: 'chute' },
      { dit: 'ironclad', texte: 'INTRUS DÉTECTÉ. PROTOCOLE : ÉLIMINATION.' },
      { dit: 'hero', texte: 'C’est moi ! On s’est déjà battus côte à côte !' },
      { dit: 'ironclad', texte: 'DONNÉES… CORROMPUES. OBÉIR… À… LA FRACTURE.', p: 'garde' },
    ],
    apres: [
      { effet: 'flash', duree: 20 },
      { dit: 'ironclad', texte: 'Redémarrage terminé. Merci.', p: 'repos' },
      { dit: 'ironclad', texte: 'Mes capteurs ont enregistré une anomalie temporelle. Le temps lui-même se tord autour de la Fracture.' },
      { dit: 'ironclad', texte: 'La forêt maudite. Un samouraï y garde une porte. Elle mène à la lumière.' },
    ],
  },
  {
    titre: 'CHAPITRE 4', sous: 'La porte de la forêt', arene: 'foret',
    combat: { adv: 'wraithblade', remplacant: 'shadowkira', niveau: { normal: 'normal', difficile: 'difficile' } },
    avant: [
      { entre: 'hero', cote: 'g', comment: 'marche' },
      { entre: 'wraithblade', cote: 'd', comment: 'teleport' },
      { dit: 'wraithblade', texte: 'Personne ne franchit cette porte. Pas même toi.' },
      { dit: 'hero', texte: 'Où mène-t-elle ?' },
      { dit: 'wraithblade', texte: 'Vers la lumière. Et vers ce qui la dévore. Si tu veux passer… il faudra me trancher.', p: 'garde' },
    ],
    apres: [
      { dit: 'wraithblade', texte: 'Ta lame est juste. Passe.', p: 'repos' },
      { dit: 'wraithblade', texte: 'Le gardien de la lumière t’attend. Mais méfie-toi : même la lumière peut avoir peur.' },
    ],
  },
  {
    titre: 'CHAPITRE 5', sous: 'Le jugement de la lumière', arene: 'cathedrale',
    combat: { adv: 'solarius', niveau: { normal: 'normal', difficile: 'difficile' } },
    avant: [
      { entre: 'hero', cote: 'g', comment: 'marche' },
      { entre: 'solarius', cote: 'd', comment: 'apparait' },
      { dit: 'solarius', texte: 'Tu es venu. Les autres sont tombés. Toi, tu t’es relevé.' },
      { dit: 'hero', texte: 'Tu m’as demandé de prouver ma force. Me voilà.' },
      { dit: 'solarius', texte: 'Au-delà de cette cathédrale, c’est l’enfer qui t’attend. Montre-moi que tu peux le regarder en face. En garde !', p: 'garde' },
    ],
    apres: [
      { dit: 'solarius', texte: 'Tu portes la lumière en toi. Prends aussi la mienne.', p: 'repos' },
      { debloque: 'solarius' },
      { dit: 'solarius', texte: 'Malvortex a ouvert les portes de l’enfer à Le Chaos. Va. Je retiendrai la Fracture aussi longtemps que je le pourrai.' },
    ],
  },
  {
    titre: 'CHAPITRE 6', sous: 'Les portes de l’enfer', arene: 'trone',
    combat: { adv: 'malvortex', niveau: { normal: 'difficile', difficile: 'impossible' } },
    avant: [
      { entre: 'hero', cote: 'g', comment: 'marche' },
      { effet: 'eclair', x: 700, duree: 30 },
      { entre: 'malvortex', cote: 'd', comment: 'apparait' },
      { dit: 'malvortex', texte: 'Un mortel, sur mon trône ? Comme c’est… appétissant.' },
      { dit: 'hero', texte: 'Ferme la Fracture, Malvortex.' },
      { dit: 'malvortex', texte: 'La fermer ? Elle n’est pas à moi, petit insecte. Elle est à LUI. Et il a faim.', p: 'lance' },
    ],
    apres: [
      { dit: 'malvortex', texte: 'Impossible… battu par un… Pfff.', p: 'touche' },
      { debloque: 'malvortex' },
      { dit: 'malvortex', texte: 'Va donc voir Le Chaos, dans sa dimension. Tu verras que même lui obéit à quelqu’un…', p: 'repos' },
    ],
  },
  {
    titre: 'CHAPITRE 7', sous: 'Dimension Zéro', arene: 'zero',
    combat: { adv: 'lechaos', niveau: { normal: 'difficile', difficile: 'impossible' } },
    avant: [
      { effet: 'fracture', attendre: false },
      { entre: 'hero', cote: 'g', comment: 'chute' },
      { entre: 'lechaos', cote: 'd', comment: 'apparait' },
      { effet: 'secousse', duree: 40 },
      { dit: 'lechaos', texte: 'TOUT… FINIT… ICI.' },
      { dit: 'hero', texte: 'Pas tant que je tiens debout !', p: 'garde' },
    ],
    apres: [
      { dit: 'lechaos', texte: 'IMPOSSIBLE… MAÎTRE… AIDEZ-MOI…', p: 'touche' },
      { debloque: 'lechaos' },
      { effet: 'gel', attendre: false },
      { narre: 'Soudain, plus rien ne bouge. Le vent, la poussière, le temps lui-même… s’arrête.' },
      { entre: 'kairos', cote: 'c', x: 500, comment: 'apparait', dir: -1 },
      { dit: 'kairos', texte: 'Merci, combattant. Le Chaos n’était qu’une aiguille de mon horloge.' },
      { dit: 'kairos', texte: 'C’est moi qui ai ouvert la Fracture. Je voulais voir naître le plus fort des guerriers.' },
      { dit: 'kairos', texte: 'Et maintenant que tu es là… je vais remonter le temps, et te prendre ta force.' },
      { dit: 'hero', texte: 'Viens la chercher.', p: 'garde' },
    ],
  },
  {
    titre: 'CHAPITRE FINAL', sous: 'Hors du temps', arene: 'horloge',
    combat: { adv: 'kairos', niveau: { normal: 'difficile', difficile: 'impossible' } },
    avant: [
      { entre: 'hero', cote: 'g', comment: 'apparait' },
      { entre: 'kairos', cote: 'd', comment: 'teleport' },
      { dit: 'kairos', texte: 'Chaque seconde de ta vie, je l’ai déjà vécue. Je connais tes coups avant même que tu y penses.' },
      { dit: 'hero', texte: 'Alors tu sais déjà comment ça finit.', p: 'garde' },
      { dit: 'kairos', texte: 'Oui. Toi, à genoux.', p: 'lance' },
    ],
    apres: [
      { dit: 'kairos', texte: 'Tu… as changé… l’avenir…', p: 'touche' },
      { effet: 'flash', duree: 40 },
      { narre: 'Le temps se remet en marche. Là-haut, la Fracture se referme, lentement.' },
      { dit: 'kairos', texte: 'Je n’avais jamais perdu. Ni dans le passé, ni dans le futur.', p: 'repos' },
      { dit: 'kairos', texte: 'Laisse-moi combattre à tes côtés. Ce sera… nouveau.' },
      { debloque: 'kairos' },
    ],
  },
];

export const EPILOGUE = [
  { decor: 'neon' },
  { effet: 'aube', attendre: false },
  { entre: 'hero', cote: 'g', comment: 'marche' },
  { entre: 'solarius', cote: 'd', comment: 'apparait' },
  { dit: 'solarius', texte: 'La Fracture est refermée. Le monde te doit tout, {hero}.' },
  { dit: 'hero', texte: 'Le monde me doit surtout un bon combat. Qui veut le prochain ?', p: 'victoire' },
  { titre: 'FIN', sous: 'Merci d’avoir joué ! — De nouveaux défis t’attendent : le Tournoi, et la Tour des défis.' },
];

/** La cinématique de la Tour des défis, avant le dernier combat. */
export const TOUR_BOSS = [
  { decor: 'sommet' },
  { entre: 'hero', cote: 'g', comment: 'chute' },
  { narre: 'Dix combattants à terre. Au sommet de la tour, le vent hurle… et quelque chose t’attend.' },
  { entre: 'nemesis', cote: 'd', comment: 'apparait' },
  { dit: 'nemesis', texte: 'Tu as battu dix guerriers. Je les ai tous regardés tomber… et j’ai appris chacun de leurs coups.' },
  { dit: 'hero', texte: 'Qui es-tu ?', p: 'garde' },
  { dit: 'nemesis', texte: 'Je suis ton reflet. Tout ce que tu as combattu. Et ce soir… je suis toi, en mieux.', p: 'lance' },
];

/** La cinématique du Tournoi en difficile, avant la finale contre le champion. */
export const TOURNOI_FINALE = [
  { decor: 'ring' },
  { narre: 'La finale. La foule se lève. Sous les projecteurs entre le champion invaincu…' },
  { entre: 'hero', cote: 'g', comment: 'marche' },
  { entre: 'onyx', cote: 'd', comment: 'saut' },
  { effet: 'secousse', duree: 30 },
  { dit: 'onyx', texte: 'Cent combats. Cent K.O. Tu seras le cent-unième.' },
  { dit: 'hero', texte: 'On dit ça jusqu’au jour où on tombe.', p: 'garde' },
  { dit: 'onyx', texte: 'Alors viens me faire tomber, petit. Ding ding !', p: 'garde' },
];
