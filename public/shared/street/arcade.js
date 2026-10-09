/**
 * STREET COMBAT — le mode Arcade.
 *
 * Module ISO. Sept combats d'affilée contre l'ordinateur : cinq adversaires
 * au hasard, puis le rival du combattant (avec sa réplique), puis un boss
 * (selon la difficulté). Perdre n'arrête pas tout : on peut « remettre une
 * pièce » et rejouer le combat perdu. Au bout, la petite fin de son
 * combattant.
 */

import { PERSO, ROSTER, BOSS } from './persos.js';

export const COMBATS_ARCADE = 7;

export const NIVEAUX_ARCADE = {
  facile: ['facile', 'facile', 'facile', 'normal', 'normal', 'normal', 'normal'],
  normal: ['facile', 'normal', 'normal', 'normal', 'difficile', 'difficile', 'difficile'],
  difficile: ['normal', 'difficile', 'difficile', 'difficile', 'impossible', 'impossible', 'impossible'],
};
const BOSS_ARCADE = { facile: BOSS.normal, normal: BOSS.difficile, difficile: BOSS.impossible };

/**
 * Chaque combattant : son rival (le sixième combat), ce que le rival lui
 * dit avant de se battre, et sa fin.
 */
export const FINS_ARCADE = {
  ryuken: { rival: 'blazero', avant: 'Tu cours après le titre depuis des années, Ryu-Ken. Ce soir, il est à moi.', fin: ['Ryu-Ken pose la coupe sur l’autel du vieux dojo, à côté de la photo du maître.', 'Puis il remonte sur les toits. Quelqu’un lui doit encore des ramen.'] },
  blazero: { rival: 'frostbyte', avant: 'Le feu contre la glace. Comme toujours. Et comme toujours, tu vas fondre.', fin: ['Pour fêter sa victoire, Blazero a voulu allumer un feu de joie. Il a fallu évacuer tout le quartier.', 'Depuis, à Néon City, on l’appelle « le pompier ». Il n’aime pas trop.'] },
  frostbyte: { rival: 'blazero', avant: 'Allez, glaçon ! Je vais te faire fondre en flaque !', fin: ['Frostbyte rapporte la coupe au sommet de la toundra, là où plus rien ne bouge.', 'Pour la première fois, le silence lui paraît un peu grand. Alors il invite Blazero. À distance raisonnable.'] },
  shadowkira: { rival: 'wraithblade', avant: 'Une ombre contre un fantôme. Voyons qui disparaît le premier.', fin: ['Shadow Kira ne monte pas sur le podium. Personne ne la voit repartir.', 'Mais cette nuit-là, dans une petite chambre de Néon City, une lumière reste allumée jusqu’au matin. Pour sa sœur.'] },
  thunderox: { rival: 'stormwing', avant: 'Le ciel n’a qu’un seul maître, Thunderox. Et il a des ailes.', fin: ['Thunderox lève la coupe vers le ciel. Un éclair la frappe. Il trouve que c’est le plus beau jour de sa vie.', 'Les médecins, eux, sont moins enthousiastes.'] },
  ironclad: { rival: 'stoneback', avant: 'Le métal contre la pierre. Le plus solide restera debout.', fin: ['Ironclad enregistre chaque seconde du dernier combat. Mémoire : 100 %.', 'Puis il ajoute une ligne dans un dossier qu’il a appelé « Ce que ressentent les humains » : fierté.'] },
  serpenta: { rival: 'lunara', avant: 'Ton venin ne traverse pas la lumière de la lune, serpent.', fin: ['Serpenta retourne dans sa jungle, la coupe enroulée au bout de sa queue.', 'Les singes la saluent avec respect. Ou avec terreur. Avec les singes, c’est dur à dire.'] },
  gravox: { rival: 'ironclad', avant: 'Ta gravité ne pèse rien sur mes circuits.', fin: ['Gravox soulève la coupe… puis le ring… puis la ville entière. Puis il repose tout, très doucement.', 'La vraie force, a-t-il compris, c’est de savoir ce qu’on ne fait pas.'] },
  lunara: { rival: 'serpenta', avant: 'La lune ne voit jamais ce qui rampe dans l’herbe. Sssss…', fin: ['Lunara dépose la coupe au temple de la lune, sous le ciel ouvert.', 'Cette nuit-là, elle chante. Pour personne d’autre qu’elle. C’est la plus belle chanson de sa vie.'] },
  pyroclaw: { rival: 'blazero', avant: 'Le seul monstre de feu de cette ville, c’est moi !', fin: ['Pendant la finale, Pyroclaw a brisé ses dernières chaînes. Personne n’a osé les lui remettre.', 'Il vit désormais au volcan, libre. Il accepte les visites. Les courtes.'] },
  wraithblade: { rival: 'shadowkira', avant: 'Ta lame est rapide, samouraï. Pas autant qu’une ombre.', fin: ['Wraithblade range sa lame. Le duel parfait a eu lieu : il l’attendait depuis trois siècles.', 'Entre deux mondes, un samouraï peut enfin se reposer.'] },
  celestia: { rival: 'lunara', avant: 'Les étoiles et la lune… il n’y a qu’un seul ciel, Celestia.', fin: ['Celestia remonte au ciel, la coupe serrée dans ses bras.', 'Ce soir, regardez au-dessus de la lune : une étoile brille un peu plus fort que d’habitude. Elle est très fière d’elle.'] },
  stoneback: { rival: 'ironclad', avant: 'La pierre s’use, golem. L’acier, jamais.', fin: ['Stoneback reprend sa place sous le temple, la coupe posée à ses pieds.', 'Il a vu mille héros descendre ces marches. Pour une fois, c’est lui qui les a montées.'] },
  stormwing: { rival: 'thunderox', avant: 'DESCENDS DE TON NUAGE, L’AIGLE !', fin: ['Stormwing s’envole si haut avec sa coupe qu’il voit la Terre s’arrondir.', 'Il redescend trois jours plus tard. Enrhumé, mais ravi.'] },
  voidreaper: { rival: 'wraithblade', avant: 'Un mort ne fauche pas un mort, Faucheur.', fin: ['Pour la première fois, on donne quelque chose au Faucheur au lieu de le lui céder.', 'Il ne sait pas quoi en faire. Alors il polit la coupe. Tous les jours.'] },
  aquathorn: { rival: 'frostbyte', avant: 'Ton océan, je peux le geler d’un souffle.', fin: ['Aquathorn plonge avec sa coupe jusqu’au fond des abysses.', 'Les poissons-lanternes lui ont organisé une fête. Elle a duré six mois.'] },
  solarius: { rival: 'celestia', avant: 'Même la lumière a besoin des étoiles, gardien.', fin: ['Solarius accroche la coupe au plus haut vitrail de la cathédrale.', 'À midi, le soleil passe à travers, et toute la ville brille d’or pendant une minute.'] },
  malvortex: { rival: 'pyroclaw', avant: 'Tu m’as enchaîné mille ans, Malvortex. Plus jamais.', fin: ['Malvortex rapporte la coupe en enfer et la pose sur son trône.', 'Puis il s’assoit à côté. Le trône est plus beau, avec. Il ne l’avouera jamais.'] },
  lechaos: { rival: 'voidreaper', avant: 'Même la fin a une fin.', fin: ['Le Chaos a gagné. La coupe n’existe plus. Le ring n’existe plus. Le tournoi n’existe plus.', 'Quelque part, un guichetier se demande pourquoi il vend encore des billets.'] },
  kairos: { rival: 'sablia', avant: 'Maître… cette fois, c’est moi qui compte les secondes.', fin: ['Kaïros a gagné du premier coup. Sans remonter le temps une seule fois.', 'C’est, de toutes ses victoires, celle dont il est le plus fier.'] },
  onyx: { rival: 'ryuken', avant: 'Cent combats, cent K.O. ? Je serai le cent unième… à te battre.', fin: ['Cent un combats. Cent un K.O. Onyx accroche une nouvelle ceinture au mur.', 'Il n’y a plus de place. Il pousse le mur.'] },
  nemesis: { rival: 'shadowkira', avant: 'Une ombre de plus. Je les connais toutes, Némésis.', fin: ['Némésis regarde son reflet dans la coupe. Pour la première fois, il y voit son propre visage.', 'Il décide de le garder.'] },
  vorn: { rival: 'sablia', avant: 'Général. Cette fois, pas d’ordres. Juste toi et moi.', fin: ['Le Général Vorn reçoit la coupe au garde-à-vous.', 'Puis il la tend au plus jeune soldat de la ville. « Pour tes hommes. Plus tard. »'] },
  sablia: { rival: 'vorn', avant: 'Le sable ou l’acier, Sablia. Il est temps de choisir.', fin: ['Sablia laisse tomber un seul grain de son sablier dans la coupe.', 'Une seconde rendue au monde. C’est le plus beau des trophées.'] },
  eclipse: { rival: 'shadowkira', avant: 'Petite sœur… montre-moi ce que tu vaux.', fin: ['Éclipse a gagné, mais c’est sa sœur qui pleure le plus fort dans les tribunes.', 'Ce soir, elles dorment avec la lumière allumée. Toutes les deux.'] },
  hemera: { rival: 'kairos', avant: 'Ma chérie… fais attention à chaque seconde.', fin: ['Héméra rapporte la coupe à son père.', 'Il la remplit de thé, et ils regardent les aiguilles tourner. Dans le bon sens.'] },
  premier: { rival: 'nemesis', avant: 'Le premier et le dernier reflet. Fermons la boucle.', fin: ['Le Premier Héros pose la coupe au cœur de l’horloge brisée.', 'Mille essais plus tard, la boucle est fermée. Il peut enfin partir en paix.'] },
};
const FIN_PAR_DEFAUT = { rival: 'ryuken', avant: 'Toi aussi, tu veux la coupe ? Alors viens la prendre.', fin: ['La coupe brille entre ses mains.', 'Demain, d’autres viendront la lui prendre. Qu’ils viennent.'] };
export const finArcade = (id) => FINS_ARCADE[id] || FIN_PAR_DEFAUT;

function melanger(l, alea) {
  const r = [...l];
  for (let i = r.length - 1; i > 0; i--) { const k = Math.floor(alea() * (i + 1)); [r[i], r[k]] = [r[k], r[i]]; }
  return r;
}

/** Le parcours d'une partie d'Arcade. `hero` : l'id du combattant (sa tenue comprise : « ryuken~1 »). */
export function planArcade(hero, difficulte = 'normal', alea = Math.random) {
  const base = String(hero).split('~')[0];
  const d = NIVEAUX_ARCADE[difficulte] ? difficulte : 'normal';
  const { rival } = finArcade(base);
  const autres = melanger(ROSTER.map((p) => p.id).filter((id) => id !== base && id !== rival), alea).slice(0, COMBATS_ARCADE - 2);
  let boss = BOSS_ARCADE[d];
  if (boss === base || boss === rival) boss = Object.values(BOSS).find((b) => b !== base && b !== rival);
  const file = [...autres, PERSO[rival] && rival !== base ? rival : autres[0], boss];
  return { hero, difficulte: d, file, niveaux: NIVEAUX_ARCADE[d], etape: 0, pieces: 0 };
}
