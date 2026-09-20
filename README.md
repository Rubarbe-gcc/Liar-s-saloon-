# Insert Coin

Une petite salle d'arcade en ligne. Chaque jeu vit dans son dossier sous
`public/games/`, le site d'accueil les présente.

**Jeu actuel : Liar's Saloon** — bluff, accusations et roulette russe.
Jouable seul contre des bots, ou entre amis avec un code de table.

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
npm test                   # règles, bots, et une partie en ligne complète
```

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
  shared/                 moteur de règles, partagé client ⇄ serveur
    engine.js             règles pures, alea injecté (parties rejouables)
    ai.js                 bots : profils de jeu et niveaux
  games/liars-saloon/
    index.html
    manifest.webmanifest  identité « Liar's Saloon »
    icons/
    css/{base,menu,table}.css
    js/{main,ui,offline,online,sfx}.js
server/
  index.js                serveur autonome : statique + WebSocket
  wsproto.js              RFC 6455 minimal, sans dépendance
  saloon.js               salons et arbitrage, indépendants du transport
api/
  ws.js                   même logique, exposée comme Function Vercel
test/
  engine.test.js
```

Deux principes structurent le tout :

- **Un seul moteur de règles.** `shared/engine.js` ne connaît ni le DOM ni
  Node. Le mode hors-ligne le fait tourner dans l'onglet ; le mode en ligne
  le fait tourner sur le serveur. Les deux produisent les mêmes évènements,
  donc l'interface est identique dans les deux cas.
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

Deux identités sont installables séparément : le hub **Insert Coin** depuis
l'accueil, et **Liar's Saloon** depuis la page du jeu, chacun avec sa propre
icône et son point d'entrée.

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
