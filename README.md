# Insert Coin

Une petite salle d'arcade en ligne. Chaque jeu vit dans son dossier sous
`public/games/`, le site d'accueil les présente.

**Les jeux**

- **RAID** — donjon solo au tour par tour. Un champ d'essence à parcourir
  pour récolter le mana, un raid de six qui partage une seule barre de vie,
  cinq ailes jusqu'au Dragon Cendré.
- **ÉCHO** — jeu de fête à la voix. On entend un son, tout le monde l'imite
  au micro, la roue distribue points et sabotages.
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

## RAID — comment ça marche

Un donjon solo au tour par tour, dans les codes des jeux de raid : la trinité
tank / soigneur / DPS, des écoles de magie qui se percent, de l'aggro, des
incantations de boss à interrompre par un bouclier bien posé, et du butin
entre deux ailes.

La descente tient en quinze pulls répartis sur cinq ailes, et les six
personnages partagent **une seule barre de vie** — celle du raid — qui ne se
remplit pas entre deux combats.

Chaque tour suit toujours le même fil :

1. Un **groupe de trois** monte au front ; les deux groupes alternent d'un
   tour à l'autre.
2. Le boss annonce **qui a l'aggro** et **après combien de personnages** il
   frappera.
3. Chacun, dans l'ordre choisi par le joueur, trace un chemin sur le **champ
   d'essence** — huit directions, jamais deux fois le même globe, neuf globes
   au plus — et récolte son mana : les globes de sa propre école et les globes
   d'essence pure comptent double.
4. À douze de mana le **sort** est disponible, à dix-huit le **sort ultime** ;
   la barre se vide en fin de tour, garder son mana n'existe pas.

L'ordre de passage est donc la vraie décision : qui joue avant le coup du boss
peut poser un bouclier, qui joue après frappe une cible déjà affaiblie.

Cinq **écoles de magie** forment un cycle fermé (vulnérable ×1.5, résistant
×0.7), et trois **rôles** lisibles au glyphe sur chaque jeton. Le **chef de
raid** applique son buff à tout le monde, et deux personnages d'un même groupe
qui partagent une étiquette sont en **synergie**. Chaque boss d'aile lâche une
pièce de **butin** à choisir parmi trois.

L'équilibrage est mesuré, pas deviné : un conseiller joue des donjons entiers
en tête de série fixe, et les réglages sont choisis pour que le mode
*Héroïque* se boucle environ deux fois sur trois en jouant bien, le mode
*Normal* presque toujours, et le *Mythique* rarement.

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

On entend un son de trois secondes ; tout le monde l'imite en même temps au
micro. Le moteur compare ensuite chaque prise au modèle sur trois axes —
mélodie (45 %), rythme (35 %) et attaques (20 %) — par autocorrélation de
hauteur et corrélation d'enveloppes. À partir de la deuxième manche, une roue
distribue bonus et sabotages : la prise du saboté est saturée, hachée ou
renvoyée en écho avant d'être notée.

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
    raid/                 RAID : écoles, globes, héros, bestiaire, combat,
                          donjon, sprites, conseiller
  games/liars-saloon/
    index.html
    manifest.webmanifest  identité « Liar's Saloon »
    icons/
    css/{base,menu,table}.css
    js/{main,ui,offline,online,sfx}.js
  games/zenith/           même forme : index, manifest, icônes, css, js
  games/echo/
  games/raid/
    js/{main,scene,regles,sfx}.js   navigation, combat animé, règles, sons
server/
  index.js                serveur autonome : statique + WebSocket
  wsproto.js              RFC 6455 minimal, sans dépendance
  hub.js                  routeur : dirige chaque connexion vers son jeu
  saloon.js               salons de Liar's Saloon
  zenith.js               arènes de ZÉNITH
  mimic.js                salons d'ÉCHO
api/
  ws.js                   même logique, exposée comme Function Vercel
test/
  engine.test.js          Liar's Saloon
  zenith.test.js          ZÉNITH
  echo.test.js            ÉCHO
  raid.test.js            RAID
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
