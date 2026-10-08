# Insert Coin

Une petite salle d'arcade en ligne. Chaque jeu vit dans son dossier sous
`public/games/`, le site d'accueil les présente.

**Les jeux**

- **STREET COMBAT** — le jeu de combat : 16 combattants, 3 boss et 6
  personnages secrets (cachés jusqu'à ce qu'on les gagne), chacun avec deux
  compétences à lui (projectiles, rayons, ruées, téléportations, frappes du ciel,
  brûlure, poison, gel…), sa saisie, trois combos (👊 👊 🦶 et deux
  manipulations) et son ultime en cinématique. Un **mode Histoire** (« La
  Fracture » : dix actes, 66 scènes, trois fins et une vraie fin cachée, un
  super-boss secret, des QTE, des choix chronométrés, une infiltration, des
  alliés à appeler en combat et une affinité avec chacun, des boss en deux
  phases, un combat de survie, des flashbacks jouables, une note S/A/B/C par
  combat, un mode Légende et un Codex ; on crée son propre héros — nom, homme ou femme, allure,
  couleurs, voix, école de combat, et ses techniques à lui seul : deux spéciaux
  et un ultime, trois au choix pour chacun dans son école (feu, glace,
  foudre, ombre…), que nul autre combattant n’a —, des voix pour chaque personnage (synthèse
  vocale du navigateur, coupées par défaut), une musique par ambiance, dix actes, une cinquantaine de scènes, cinématiques, dialogues et
  choix qui changent la suite, des combattants corrompus par la Fracture à
  libérer, des scènes où l’on incarne d’autres combattants, des vagues de soldats de l'Armée de l'Horloge,
  des combattants qu'on croise avant de les débloquer ; trois sauvegardes et un
  journal pour revoir les scènes), un **Tournoi** à huit (Onyx en finale en difficile), une
  **Tour des défis** (dix combats d'affilée, la vie qui se garde, puis
  Némésis), contre l'ordinateur (4 niveaux), à deux au clavier ou à la
  manette (boutons à choisir, vibrations), **en ligne** à deux appareils (un code
  de salle, combat synchronisé image par image : `server/street.js`),
  l'entraînement avec cinq **défis de combos** par combattant, un **tutoriel**
  jouable, une difficulté **Récit** pour l'histoire, et la progression
  **sauvegardée en ligne** avec le profil de l'arcade ; commandes tactiles sur
  téléphone. Moteur dans `public/shared/street/` (testé sans écran), dessin,
  arènes, effets et cinématiques dans `public/games/street-combat/js/`.
- **FIESTA** — le jeu de plateau à mini-jeux, dans l'esprit de Wii Party : 2 à
  4 joueurs sur le même téléphone, ou **en ligne** chacun sur le sien (les
  mini-jeux s'y jouent tous en même temps), avec ou sans l'ordinateur. Un
  mini-jeu à chaque tour dont le classement donne les dés, des dés qu'on
  **arrête soi-même**, des cases piégées, et 13 mini-jeux à rejouer aussi en
  salle d'entraînement : 9 chacun pour soi (tapotage, duel, chrono, mémo,
  fruits, moutons, taupes, tour, calcul), 2 **en équipe** à 2 contre 2 (tir à
  la corde, relais) et 2 **à un contre tous** où le joueur seul a son propre
  rôle (le gardien des tirs au but, qui affronte chaque tir en direct, et le
  fantôme du manoir). Avant chaque mini-jeu, une roue annonce le style du tour
  et tombe sur le mini-jeu, comme dans Mario Party. Moteur dans
  `public/shared/fiesta/`, tables en ligne dans `server/fiesta.js`.
- **BALTROU** — le poker roguelite : des mains de poker, des Jokers déments
  (53, du Glouton au Jackpot Cosmique), des boss jusqu'au Roi, et le Poisson
  Dégueulasse qu'on joue de force. Comme à Balatro : le choix de la blind
  (qu'on peut passer pour un tag), 10 planètes, 22 tarots, des packs, et cinq
  mises à débloquer. Solo, modes Classique et Infini, trois
  decks, une graine pour rejouer la même run. Sa musique est composée note
  à note (`public/games/baltrou/js/musique.js`) : un thème pour la table, un
  pour la boutique, et un par boss. Le moteur
  (`public/shared/baltrou/`) tient toute la run dans un objet JSON, hasard
  compris : elle se range dans le navigateur et se reprend.
- **SKULL KING** — le jeu de plis des pirates : on annonce ses plis, on tient
  parole. Solo contre un équipage de bots, en ligne entre amis (bots en
  renfort), et une feuille de score pour compter les points d'une vraie partie.
  Un mode custom ajoute sept cartes maison (rhum, trésor maudit, corsaire,
  canon, Hollandais volant, ancre, poisson dégueulasse), et un aide-mémoire 📖
  se consulte à table.

Dans tous les jeux en ligne, une connexion qui tombe en pleine partie n'est
pas un départ : la place attend son joueur cinq minutes (un bot joue pour lui
quand c'est son tour), et il la reprend en revenant — même après avoir fermé
l'application. Le retour est automatique : la connexion se vérifie dès que
l'appli revient au premier plan, et rouvrir le jeu ramène droit dans la partie
(l'accueil de l'arcade propose aussi de la rejoindre). Voir `server/hub.js`,
`public/shared/connexion.js` et `public/shared/reprise.js`.
- **BRASIER** — huit champions dans une taverne-forge. On recrute des
  serviteurs, on les fusionne en dorés, les combats se jouent seuls ; le dernier
  debout l'emporte. En ligne uniquement : les chaises vides sont prises par des bots.
- **RAID** — jeu de rôle solo au tour par tour. On part avec un seul héros,
  on choisit son chemin sur la carte de chaque acte, on trouve des compagnons,
  de l'équipement et des niveaux, jusqu'au Dragon Cendré.
- **ÉCHO** — jeu de fête à la voix. On entend un son, on l'imite au micro en
  suivant sa ligne en direct, la roue distribue points et sabotages. Contre
  des bots, en soirée sur un seul téléphone, ou en ligne — jusqu'à huit, chacun
  avec sa tête en photo sur son bonhomme.
- **ZÉNITH** — jeu de combat au tour par tour. Trente combattants, équipes de
  trois, rôles et éléments qui se dominent. Solo ou en ligne.
- **Liar's Saloon** — bluff, accusations et roulette russe. Seul contre des
  bots, ou entre amis avec un code de table.

---

## Démarrer

```bash
node server/index.js       # ou : npm start
```

→ <http://localhost:3000>

Aucune installation n'est nécessaire pour jouer en local : le serveur
n'utilise que les modules fournis par Node (≥ 18), y compris son
implémentation WebSocket, écrite à la main dans `server/wsproto.js`.

```bash
npm test                   # règles, équilibrage, bots, parties en ligne
```

---

## BRASIER — comment ça marche

Huit champions, 30 PV chacun. Chaque tour alterne un **recrutement** — de l'or,
une taverne à rangs, un plateau de sept places — et un **combat** automatique
contre un autre survivant. Le perdant perd le rang de taverne du vainqueur plus
les étoiles de ses survivants, sous un plafond qui monte avec les tours.

- **La réserve est commune** à la table : chaque serviteur existe en un nombre
  fixe d'exemplaires. Trois exemplaires fusionnent en un **doré** (stats et
  effets doublés) qui rapporte une découverte d'un rang au-dessus.
- **Le combat est déterministe** à graine égale et produit une suite
  d'événements — attaque, coup, bouclier brisé, mort, invocation — que l'écran
  rejoue au rythme d'une table `TEMPO` partagée avec le serveur, qui sait ainsi
  quand relancer le recrutement.
- **Six mots-clés** (Provocation, Bouclier sacré, Venin, Furie, Réincarnation,
  Balayage) et six moments d'effet (cri, fin de tour, début de combat, râle,
  mort d'un allié, pose d'un allié), sur sept tribus — dont les Élémentaires,
  qui grandissent quand on pose leurs semblables — et une cinquantaine de
  serviteurs originaux.
- **Trois genres de partie**, tirés au sort au lancement, jamais cumulés
  (`modes.js`) : classique ; **Quête** (au tour 3, une quête parmi trois, qui
  rapporte un serviteur exclusif, des cartes spéciales ou de l'or) ;
  **Anomalie** (une ou deux règles spéciales pour toute la table). En local,
  `BRASIER_MODE=quete` ou `anomalie` impose le genre.
- **Les bots** passent par la même fonction `agir` que les joueurs : mêmes
  règles, même or, même réserve. Ils prennent les chaises vides au lancement,
  et la chaise de quiconque quitte la partie en cours.
- **La vue** d'un joueur ne contient jamais la taverne ni le plateau des
  autres : leur plateau ne se découvre qu'au combat.

## RAID — comment ça marche

Un jeu de rôle solo. On choisit **un seul héros** parmi cinq ; il part niveau 1
au pied du donjon. L'histoire tient en **dix chapitres** : cinq pour monter
jusqu'au Dragon Cendré, cinq pour descendre vers ce qu'il gardait. Chaque
chapitre a son boss, sa cinématique, et se débloque quand on l'atteint ;
l'écran « Chapitres » les fait défiler et permet d'y recommencer une aventure.

- **La carte** (`shared/raid/carte.js`) : chaque acte est une carte à chemins,
  sept paliers et le boss au sommet. On choisit sa prochaine salle parmi
  celles que son chemin relie : combat, élite, événement, marchand, feu de
  camp, trésor, rencontre.
- **Le groupe** (`personnages.js`) : des compagnons se présentent en route —
  toujours après le boss des trois premiers actes — jusqu'à quatre
  personnages. Chacun a ses points de vie et de mana, son niveau (jusqu'à 12),
  ses deux sorts (l'ultime s'apprend au niveau 3) et trois pièces
  d'**équipement** (`equipement.js`) : arme, armure, bijou.
- **Le combat** (`bataille.js`) : chaque manche, tout le monde agit une fois,
  du plus rapide au plus lent. À son tour, un personnage attaque, lance un
  sort, se défend ou utilise un objet. Les ennemis annoncent leur attaque
  chargée à l'avance ; cinq **écoles de magie** se percent en cycle
  (×1.5 / ×0.7). Les rencontres se règlent sur la taille du groupe.
- **L'aventure** (`aventure.js`) : expérience et or à chaque victoire, un
  **don** à choisir aux niveaux 3, 5, 7 et 9, la **chance** qui pèse sur les
  critiques, le butin et les choix risqués, et des **événements** dont les
  réponses rendent plus fort, coûtent de la vie ou pèsent sur les **boss à
  venir**.
- **Talents, reliques, quêtes** (`talents.js`, `reliques.js`) : un point de
  talent par niveau à placer dans deux branches par rôle ; des reliques de
  groupe lâchées par les boss, vendues en boutique ou gagnées en quête ; deux
  quêtes proposées par acte. En combat, chaque effet en cours se lit en
  pastille verte ou rouge, et se détaille en touchant le combattant.
- **Légendaires, départs, récit** : à partir de l'acte 3, une rencontre peut
  amener un héros légendaire (un tank qui provoque, une lame qui balaie tous
  les ennemis, une oracle qui relève les morts) ; à partir de l'acte 2, un
  compagnon peut partir en voyage et revenir « éveillé » — ou ne pas revenir.
  Une cinématique ouvre l'aventure, une autre précède chaque boss
  (`games/raid/js/histoire.js`, `cinematique.js`).
- **Éveil** (`eveils.js`) : un compagnon revenu de voyage gagne une
  compétence d'éveil, propre à chaque personnage.
- **La défaite** ramène au dernier feu de camp ; la moitié de l'expérience
  gagnée depuis reste acquise, et un boss qui a gagné garde ses blessures —
  on ne bute jamais sans fin sur le même mur. La partie est sauvegardée à
  chaque étape.

L'équilibrage est mesuré, pas deviné : un joueur automatique (`ia.js`, le
même que le bouton « Auto » du combat) joue des aventures entières en tête de
série fixe. Il sort du premier combat avec les deux tiers de sa vie, perd de
temps en temps contre un boss, et arrive au Dragon avec un groupe de quatre.

Les personnages et les créatures sont dessinés en **pixel art paramétrique** :
des grilles de 16×16 décrites en données, colorées par l'école, teintées par
le peuple — un orc n'a pas la peau d'un nain — et décalées pour chaque
personnage. Le reste de l'animation — l'élan, le cut-in, l'encaissement, la
chute — est affaire de transformations CSS déclenchées par les événements que
renvoie le moteur : rien n'apparaît à l'écran qui ne soit passé par une règle.

Tout est original : noms, personnages, sorts, bestiaire et dessins. Seuls les
codes du genre sont repris.

---

## ÉCHO — comment ça marche

On entend un son de une à deux secondes et demie, puis on l'imite au micro.
Le moteur compare chaque prise au modèle sur trois axes — mélodie (45 %),
rythme (35 %) et attaques (20 %) — par autocorrélation de hauteur et
corrélation d'enveloppes. Le silence qui entoure la prise est retiré avant de
noter, pour la référence comme pour le joueur : sans cela, une imitation
parfaite enregistrée dans une fenêtre de quatre secondes ne valait qu'une
quarantaine de points.

- **La courbe en direct.** Pendant la prise, la ligne du son s'affiche et la
  voix se dessine par-dessus, verte quand elle suit, orange quand elle décroche
  — mesurée par le même détecteur que le barème, recalée sur la médiane pour
  que chanter une octave plus bas ne sorte pas du cadre.
- **Trois façons de jouer.** Contre des bots qui chantent pour de vrai (leur
  prise passe par le même barème) ; en soirée sur un seul téléphone, chacun
  son tour ; en ligne, tous ensemble ou chacun son tour quand on est dans la
  même pièce et que les micros se captent l'un l'autre.
- **Réglages.** 3, 4, 6 ou 8 manches ; 3, 4, 6 ou 8 secondes pour imiter
  (toujours au moins une seconde de plus que le son) ; jusqu'à huit joueurs.
- **Les têtes.** Chacun peut se prendre en photo : réduite à 128 × 128 en JPEG,
  elle coiffe un bonhomme qui chante à son tour, saute quand il gagne et fait
  grise mine sous un sabotage. Elle ne quitte l'appareil que le temps d'un
  salon en ligne ; le serveur ne relaie que ce qui est bien un JPEG.
- **Les sons.** 39, en six familles, tous calculés — dont une famille
  *Brainrot* (Tung tung tung sahur, UwU, Tralalero tralala…) réduite à la
  prosodie : syllabes, ligne mélodique, et des voyelles de synthèse par
  filtres de formants.

À partir de la deuxième manche, une roue distribue bonus et sabotages. Un
sabotage déforme la **restitution** — saturée, hachée, en écho ou remplacée par
un canard — mais jamais la note, calculée sur le signal propre.

---

## ZÉNITH — comment ça marche

Deux équipes de trois. Les cartes arrivent toutes seules en main ; chacune
coûte du ki, qui remonte d'autant plus vite que le combattant est rapide.

- **Frappe** rend plus de ki qu'elle n'en coûte, **Souffle** frappe à
  distance, **Spéciale** fait mal, **Ultime** ne part qu'une fois par
  combattant.
- L'**esquive** (30 ki) annule entièrement le prochain coup reçu. C'est la
  seule parade contre une Ultime.
- Cycle élémentaire : 🔥 bat ⚡ bat 🌑 bat 🍃 bat ❄️ bat 🔥. En avantage on
  frappe 30 % plus fort.
- **Changer** de combattant reprend l'avantage élémentaire, mais vide la main
  et impose six secondes de recharge.

Les combattants sont dessinés en **pixel art**, générés à partir de grilles
de 16×16 décrites en données plutôt qu'en images : cinq poses — repos, garde,
frappe, encaisse, vaincu — déclinées en trois carrures selon les statistiques,
et colorées par une palette propre à chacun. Aucun fichier à charger, donc
rien qui manque hors connexion.

Le combat avance par ticks de 100 ms. Les joueurs n'attendent pas leur tour :
ils envoient des intentions que le moteur applique au tick suivant. C'est ce
qui donne la nervosité d'un jeu d'action tout en restant synchronisable sur
le réseau, les actions étant discrètes.

L'équilibrage est tenu par les tests : chaque combattant dispose du même
budget de points, et une simulation vérifie qu'aucun n'écrase ni ne subit le
roster, et que les trois niveaux de difficulté sont bien ordonnés.

---

## Règles de Liar's Saloon

Vingt cartes : **6 Rois, 6 Dames, 6 As, 2 Jokers**. À chaque manche la table
réclame une figure, et chacun reçoit cinq cartes.

1. À votre tour, posez **1 à 3 cartes face cachée** en les annonçant comme
   étant la carte demandée. Rien ne vous oblige à dire vrai. Le Joker compte
   toujours comme la bonne carte.
2. Vous pouvez à la place crier **« Menteur ! »**. On retourne la dernière
   pose : si elle contenait une carte illégitime, le poseur avait menti —
   sinon c'est l'accusateur qui s'est trompé.
3. Celui qui a tort **appuie sur la détente**. Six chambres, une balle, et le
   barillet ne se recharge jamais : survivre rend le tir suivant plus sûr…
   jusqu'à la sixième fois.
4. Après chaque coup, on redistribue. Le **dernier assis** gagne.

---

## Architecture

```
public/
  index.html              accueil du hub
  css/hub.css
  sw.js                   service worker : installation et jeu hors connexion
  manifest.webmanifest    identité « Insert Coin »
  icons/
  shared/                 moteurs de règles, partagés client ⇄ serveur
    engine.js             Liar's Saloon : règles pures, aléa injecté
    ai.js                 Liar's Saloon : bots
    hasard.js             aléa déterministe, partagé par les jeux
    zenith/               ZÉNITH : roster, moteur, adversaires, sprites
    mimic/                ÉCHO : analyse du son, sons de référence, manches
    brasier/              BRASIER : serviteurs, héros, combat, partie, bots
    raid/                 RAID : écoles, héros, bestiaire, personnages,
                          équipement, carte, bataille, aventure, sprites, ia
    skullking/moteur.js   SKULL KING : cartes, plis, points, partie, bots
  games/liars-saloon/
    index.html
    manifest.webmanifest  identité « Liar's Saloon »
    icons/
    css/{base,menu,table}.css
    js/{main,ui,offline,online,sfx}.js
  games/zenith/           même forme : index, manifest, icônes, css, js
  games/brasier/
    js/{main,net,ui,arene,regles,sfx}.js   navigation, réseau, recrutement, combat rejoué
  games/echo/
    js/{main,offline,online}.js      navigation, partie sur un appareil, en ligne
    js/{karaoke,avatars}.js          courbe en direct, photos et bonhommes
    js/{ui,audio,regles}.js          rendu, micro et sabotages, règles
  games/raid/
    js/{main,combat,textes,regles,sfx}.js   écrans de l'aventure, combat, textes, règles, sons
  games/skull-king/
    js/{main,table,enligne}.js              solo, dessin de la table, partie en ligne
    js/{cartes,score,regles,sfx}.js         dessin des cartes, feuille de score, règles, sons
server/
  index.js                serveur autonome : statique + WebSocket
  wsproto.js              RFC 6455 minimal, sans dépendance
  hub.js                  routeur : dirige chaque connexion vers son jeu
  saloon.js               salons de Liar's Saloon
  zenith.js               arènes de ZÉNITH
  mimic.js                salons d'ÉCHO
  brasier.js              tables de BRASIER, bots compris
  skullking.js            tables de SKULL KING, bots compris
  fiesta.js               tables de FIESTA, ordis compris
api/
  ws.js                   même logique, exposée comme Function Vercel
test/
  engine.test.js          Liar's Saloon
  zenith.test.js          ZÉNITH
  echo.test.js            ÉCHO
  raid.test.js            RAID
  skullking.test.js       SKULL KING
  enligne.test.js         sessions et reprises en ligne, tables de SKULL KING
```

RAID n'a pas de module serveur : c'est un jeu solo, tout tient dans
l'onglet.

Deux principes structurent le tout :

- **Un seul moteur de règles par jeu.** Les modules de `public/shared/` ne
  connaissent ni le DOM ni Node. Le mode hors-ligne les fait tourner dans
  l'onglet ; le mode en ligne les fait tourner sur le serveur. Les deux
  produisent les mêmes états, donc l'interface est identique dans les deux
  cas — et les règles ne peuvent pas diverger entre les modes.
- **Le client ne décide rien en ligne.** Il envoie des intentions, le serveur
  valide et renvoie à chaque joueur une vue filtrée : votre main vous est
  visible, celle des autres se résume à un nombre de cartes. La position de
  la balle ne quitte jamais le serveur.

### Ajouter un jeu

1. Déposez-le dans `public/games/<slug>/`.
2. Ajoutez une entrée au tableau `GAMES` dans `public/index.html`.

---

## Déploiement

Le dépôt se déploie tel quel sur Vercel : `public/` est servi en statique et
`api/ws.js` devient une Function WebSocket.

> **Limite du mode en ligne sur Vercel.** Les salons vivent en mémoire. Les
> Functions pouvant être servies par plusieurs instances, deux joueurs
> arrivant sur des instances différentes ne se verraient pas. À faible trafic
> (des amis qui se rejoignent en même temps) cela fonctionne. Pour un usage
> plus large, faites tourner `server/index.js` sur une machine unique
> (Railway, Fly, Render, un VPS…), qui n'a aucune dépendance.

---

## Sur téléphone

Le site est une **application installable** (PWA) : depuis le navigateur du
téléphone, « Ajouter à l'écran d'accueil » (Safari : bouton Partager ;
Chrome : menu ⋮) pose une icône qui ouvre le jeu en plein écran, sans barre
d'adresse.

Chaque jeu est installable séparément, avec sa propre icône et son propre
point d'entrée : le hub **Insert Coin** depuis l'accueil, puis **RAID**,
**ÉCHO**, **ZÉNITH** et **Liar's Saloon** depuis leurs pages.

Une fois la page visitée une première fois, `public/sw.js` met la coquille en
cache : **le mode hors-ligne devient jouable sans aucune connexion**, en
avion comme dans le métro. Le mode en ligne, lui, a évidemment besoin du
réseau. La stratégie de cache est « réseau d'abord, cache en secours » : une
mise à jour du site arrive dès que la connexion revient, sans risque de
servir une version périmée.

La mise en page s'adapte aux deux orientations. En paysage — où la hauteur
est la ressource rare — le tapis se dimensionne sur la hauteur disponible et
la barre du bas passe en ligne, pour rendre au jeu la place des boutons.

---

## Accessibilité

`prefers-reduced-motion` est respecté : la distribution, la rotation du
barillet et les secousses d'écran sont réduites ou supprimées. Tout est
jouable au clavier — `Entrée` pour poser, `L` pour accuser, `Échap` pour
fermer les règles. Le son se coupe depuis le menu et le choix est mémorisé.
