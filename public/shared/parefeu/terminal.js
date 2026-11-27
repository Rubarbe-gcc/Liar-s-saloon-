/**
 * PARE-FEU — le mode Terminal : on joue en tapant de vraies commandes.
 *
 * Le but est d'apprendre des commandes réelles et inoffensives, celles de
 * tous les jours pour qui administre des machines (ping, curl, scp, ssh,
 * rsync, traceroute, telnet, ufw, clamscan, mkdir, gpg, apt, arp, ip…).
 * Dans le jeu, chacune déclenche une action imaginaire ; à chaque fois, le
 * terminal rappelle ce qu'elle fait VRAIMENT. Aucune technique d'attaque :
 * ce sont des outils d'usage courant, employés ici de façon symbolique.
 *
 * Chaque nœud a une adresse : 10.0.<joueur+1>.1 pour un Noyau, .2 à .4 pour
 * ses serveurs, 10.0.0.1 pour le Nexus, 10.0.9.x pour les relais.
 * Les attaques visent une adresse ; les défenses s'appliquent à la machine
 * « courante » (celle de l'invite, choisie d'un clic ou avec `ssh <ip>`).
 * La forme « experte » (avec la bonne option) rend l'action parfaite.
 *
 * Module sans navigateur (testé dans test/parefeu.test.js).
 */

import { AMELIORATIONS, PROGRAMMES, DEFENSES, BRECHE, NOEUDS } from './donnees.js';
import { ami, source, frontiere } from './regles.js';
import { verifier } from './partie.js';

const IP = String.raw`(\d{1,3}(?:\.\d{1,3}){3})`;

/** Les adresses des nœuds (par identifiant). */
export function adresses(E) {
  const ips = new Array(E.noeuds.length);
  let relais = 1;
  const parBase = new Map();
  for (const nd of E.noeuds) {
    if (nd.base >= 0) {
      const k = parBase.get(nd.base) || 0;
      parBase.set(nd.base, k + 1);
      ips[nd.id] = `10.0.${nd.base + 1}.${k + 1}`;
    } else if (nd.type === 'nexus') ips[nd.id] = '10.0.0.1';
    else ips[nd.id] = `10.0.9.${relais++}`;
  }
  return ips;
}

/**
 * Les commandes qui jouent. `base` : la forme qui marche ; `expert` : celle
 * qui rend l'action parfaite. `vrai` : ce que fait la commande en vrai.
 */
export const COMMANDES = {
  sonde: {
    cmd: 'ping', exemple: 'ping 10.0.2.1', expertEx: 'ping -c 4 10.0.2.1',
    base: new RegExp(`^ping\\s+(?:-c\\s*\\d+\\s+)?${IP}$`), expert: new RegExp(`^ping\\s+-c\\s*\\d+\\s+${IP}$`),
    vrai: 'ping envoie de petits messages à une machine pour savoir si elle répond, et en combien de temps.',
    option: '-c 4 : n’envoie que 4 messages puis s’arrête (sinon ping continue jusqu’à Ctrl+C).',
  },
  ver: {
    cmd: 'curl', exemple: 'curl 10.0.9.1', expertEx: 'curl -s 10.0.9.1',
    base: new RegExp(`^curl\\s+(?:-s\\s+)?(?:https?://)?${IP}/?$`), expert: new RegExp(`^curl\\s+-s\\s+(?:https?://)?${IP}/?$`),
    vrai: 'curl récupère le contenu d’une adresse web (une page, un fichier) et l’affiche.',
    option: '-s : mode silencieux, sans la barre de progression.',
  },
  cheval: {
    cmd: 'scp', exemple: 'scp colis.zip 10.0.2.2:/tmp', expertEx: 'scp -C colis.zip 10.0.2.2:/tmp',
    base: new RegExp(`^scp\\s+(?:-C\\s+)?\\S+\\s+(?:\\w+@)?${IP}:\\S*$`), expert: new RegExp(`^scp\\s+-C\\s+\\S+\\s+(?:\\w+@)?${IP}:\\S*$`),
    vrai: 'scp copie un fichier vers une autre machine, de façon chiffrée (par SSH).',
    option: '-C : compresse les données pendant la copie.',
  },
  saturation: {
    cmd: 'traceroute', exemple: 'traceroute 10.0.2.2', expertEx: 'traceroute -n 10.0.2.2',
    base: new RegExp(`^traceroute\\s+(?:-n\\s+)?${IP}$`), expert: new RegExp(`^traceroute\\s+-n\\s+${IP}$`),
    vrai: 'traceroute montre le chemin, routeur par routeur, que suivent les messages jusqu’à une machine.',
    option: '-n : affiche les adresses sans chercher leurs noms (plus rapide).',
  },
  rancon: {
    cmd: 'rsync', exemple: 'rsync 10.0.2.2:/cycles .', expertEx: 'rsync -a 10.0.2.2:/cycles .',
    base: new RegExp(`^rsync\\s+(?:-a\\s+)?(?:\\w+@)?${IP}:\\S+\\s+\\S+$`), expert: new RegExp(`^rsync\\s+-a\\s+(?:\\w+@)?${IP}:\\S+\\s+\\S+$`),
    vrai: 'rsync synchronise des dossiers : il ne recopie que ce qui a changé (idéal pour les sauvegardes).',
    option: '-a : mode archive, garde les droits, les dates et les sous-dossiers.',
  },
  breche: {
    cmd: 'telnet', exemple: 'telnet 10.0.2.2', expertEx: 'telnet 10.0.2.2 23',
    base: new RegExp(`^telnet\\s+${IP}(?:\\s+\\d+)?$`), expert: new RegExp(`^telnet\\s+${IP}\\s+23$`),
    vrai: 'telnet ouvre une session à distance… sans aucun chiffrement : tout passe en clair. C’est pour ça qu’on lui préfère ssh.',
    option: '23 : le port de telnet (un port, c’est une « porte » numérotée d’une machine).',
  },
  parefeu: {
    cmd: 'ufw', exemple: 'sudo ufw enable', expertEx: 'sudo ufw default deny incoming',
    base: /^(?:sudo\s+)?ufw\s+(?:enable|default\s+deny(?:\s+incoming)?)$/, expert: /^sudo\s+ufw\s+default\s+deny\s+incoming$/,
    vrai: 'ufw (Uncomplicated Firewall) règle le pare-feu d’une machine Linux. sudo lance la commande en administrateur.',
    option: 'default deny incoming : refuse par défaut tout ce qui arrive de l’extérieur.',
  },
  antivirus: {
    cmd: 'clamscan', exemple: 'clamscan -r /', expertEx: 'clamscan -r --remove /',
    base: /^(?:sudo\s+)?clamscan\s+(?:-r\s+)?(?:--remove\s+)?\/\S*$/, expert: /^(?:sudo\s+)?clamscan\s+-r\s+--remove\s+\/\S*$/,
    vrai: 'clamscan est l’antivirus ClamAV : il analyse des fichiers à la recherche de virus connus.',
    option: '--remove : supprime les fichiers infectés trouvés (-r : regarde aussi dans les sous-dossiers).',
  },
  leurre: {
    cmd: 'mkdir', exemple: 'mkdir /leurre', expertEx: 'mkdir -p /srv/leurre',
    base: /^(?:sudo\s+)?mkdir\s+(?:-p\s+)?\/\S+$/, expert: /^(?:sudo\s+)?mkdir\s+-p\s+\/\S+\/\S+$/,
    vrai: 'mkdir crée un dossier. (Un vrai leurre, un « pot de miel », est une fausse machine qui attire les intrus pour les étudier.)',
    option: '-p : crée aussi les dossiers parents qui manquent (/srv puis /srv/leurre).',
  },
  chiffrement: {
    cmd: 'gpg', exemple: 'gpg -c donnees', expertEx: 'gpg -c --cipher-algo AES256 donnees',
    base: /^gpg\s+-c\s+(?:--cipher-algo\s+\S+\s+)?\S+$/, expert: /^gpg\s+-c\s+--cipher-algo\s+AES256\s+\S+$/i,
    vrai: 'gpg chiffre des fichiers : -c protège un fichier par un mot de passe.',
    option: '--cipher-algo AES256 : choisit l’algorithme de chiffrement AES avec une clé de 256 bits.',
  },
  correctif: {
    cmd: 'apt', exemple: 'sudo apt upgrade', expertEx: 'sudo apt update && sudo apt upgrade -y',
    base: /^(?:sudo\s+)?apt(?:-get)?\s+(?:update\s*&&\s*(?:sudo\s+)?apt(?:-get)?\s+)?upgrade(?:\s+-y)?$/, expert: /^sudo\s+apt\s+update\s*&&\s*sudo\s+apt\s+upgrade\s+-y$/,
    vrai: 'apt installe et met à jour les logiciels (Debian, Ubuntu). Mettre à jour, c’est appliquer les correctifs de sécurité.',
    option: 'update d’abord (la liste des mises à jour), puis upgrade -y (tout installer sans demander).',
  },
};

/** Les autres commandes, pour s'y retrouver. */
const AIDE_AUTRES = [
  ['ssh <ip>', 'passer sur une de tes machines (en vrai : se connecter à distance, chiffré)'],
  ['arp -a', 'les machines voisines que tu peux viser (en vrai : la table des voisins du réseau)'],
  ['ip a', 'tes machines et leurs adresses (en vrai : les adresses de ta machine)'],
  ['sudo apt install <amélioration>', 'améliorer la machine courante : ' + Object.keys(AMELIORATIONS).join(', ')],
  ['man <commande>', 'ce que fait vraiment une commande'],
  ['clear', 'vider le terminal'],
];

export const LISTE_COMMANDES = ['help', 'aide', 'man', 'clear', 'ssh', 'arp', 'ip', 'ifconfig', 'whoami', 'hostname', 'sudo', ...Object.values(COMMANDES).map((c) => c.cmd)];

const NOM_TYPE = (nd) => (nd.eteint ? 'noyau éteint' : NOEUDS[nd.type].nom.toLowerCase());

/**
 * Interprète une ligne tapée par le joueur j, sur la machine `courant`.
 * Renvoie { sortie: [{ t, c? }], action?, courant?, effacer? } :
 *   sortie : les lignes à afficher (c : 'ok' | 'ko' | 'info' | 'vrai') ;
 *   action : l'ordre à envoyer au moteur ;
 *   courant : la nouvelle machine courante.
 */
export function interpreter(E, j, ligne, courant) {
  const L = String(ligne || '').trim().replace(/\s+/g, ' ');
  const out = [];
  const dire = (t, c = '') => out.push({ t, c });
  if (!L) return { sortie: out };
  const ips = adresses(E);
  const parIp = new Map(ips.map((ip, id) => [ip, id]));
  const mot = L.split(' ')[0];
  const nom = (n) => `${ips[n]} (${NOM_TYPE(E.noeuds[n])}${E.noeuds[n].proprio < 0 ? ', neutre' : E.noeuds[n].proprio === j ? ', à toi' : `, ${E.joueurs[E.noeuds[n].proprio].nom}`})`;

  if (mot === 'help' || mot === 'aide') {
    dire('Attaques (sur une adresse) :', 'info');
    for (const k of ['sonde', 'ver', 'cheval', 'saturation', 'rancon', 'breche']) dire(`  ${COMMANDES[k].exemple.padEnd(30)} ${(PROGRAMMES[k] || BRECHE).nom}`);
    dire('Défenses (sur ta machine courante) :', 'info');
    for (const k of ['parefeu', 'antivirus', 'leurre', 'chiffrement', 'correctif']) dire(`  ${COMMANDES[k].exemple.padEnd(30)} ${DEFENSES[k].nom}`);
    dire('Autres :', 'info');
    for (const [c, d] of AIDE_AUTRES) dire(`  ${c.padEnd(30)} ${d}`);
    dire('Astuce : la bonne option rend l’action parfaite (essaie man ping). Tab complète, ↑ rappelle.', 'vrai');
    return { sortie: out };
  }
  if (mot === 'clear') return { sortie: [], effacer: true };
  if (mot === 'whoami') { dire(E.joueurs[j].nom.toLowerCase()); dire('En vrai : whoami affiche le nom de l’utilisateur connecté.', 'vrai'); return { sortie: out }; }
  if (mot === 'hostname') { dire(courant >= 0 ? ips[courant] : '?'); dire('En vrai : hostname affiche le nom de la machine.', 'vrai'); return { sortie: out }; }

  if (mot === 'man') {
    const c = L.split(' ')[1];
    const k = Object.keys(COMMANDES).find((x) => COMMANDES[x].cmd === c);
    if (!k) { dire(`Pas de page de manuel pour ${c || '?'} (essaie : ${Object.values(COMMANDES).map((x) => x.cmd).join(', ')})`, 'ko'); return { sortie: out }; }
    const C = COMMANDES[k];
    dire(`${C.cmd} — ${C.vrai}`, 'vrai');
    dire(`Exemple : ${C.exemple}`);
    dire(`Option : ${C.option}`, 'info');
    dire(`Forme parfaite : ${C.expertEx}`, 'ok');
    return { sortie: out };
  }

  if (mot === 'arp') {
    const f = frontiere(E, j);
    if (!f.length) dire('(aucune machine à portée)', 'ko');
    for (const n of f) dire(`  ${nom(n)}  PV ${Math.ceil(E.noeuds[n].pv)}/${E.noeuds[n].max}`);
    dire('En vrai : arp -a liste les machines voisines déjà vues sur le réseau local.', 'vrai');
    return { sortie: out };
  }
  if (mot === 'ip' || mot === 'ifconfig') {
    for (const nd of E.noeuds) if (ami(E, j, nd.id)) dire(`  ${nom(nd.id)}  PV ${Math.ceil(nd.pv)}/${nd.max}${nd.id === courant ? '  ← ici' : ''}`);
    dire('En vrai : ip a (ou ifconfig) affiche les adresses réseau de ta machine.', 'vrai');
    return { sortie: out };
  }

  if (mot === 'ssh') {
    const m = L.match(new RegExp(`^ssh\\s+(?:\\w+@)?${IP}$`));
    if (!m) { dire('usage : ssh <ip>   (ex. ssh 10.0.1.2)', 'ko'); return { sortie: out }; }
    const n = parIp.get(m[1]);
    if (n === undefined) { dire(`ssh: connect to host ${m[1]} port 22: No route to host`, 'ko'); return { sortie: out }; }
    if (!ami(E, j, n)) { dire(`${m[1]}: Permission denied (publickey).`, 'ko'); dire('Ce n’est pas ta machine : il te faudrait sa clé. Attaque-la plutôt.', 'info'); return { sortie: out }; }
    dire(`Connecté à ${nom(n)}.`, 'ok');
    dire('En vrai : ssh ouvre une session chiffrée sur une machine à distance.', 'vrai');
    return { sortie: out, courant: n };
  }

  // sudo apt install <amélioration>
  const inst = L.match(/^(?:sudo\s+)?apt(?:-get)?\s+install\s+(?:-y\s+)?(\S+)$/);
  if (inst) {
    const k = inst[1].toLowerCase().replace(/[éè]/g, 'e');
    if (!AMELIORATIONS[k]) { dire(`E: Impossible de trouver le paquet ${inst[1]} (paquets : ${Object.keys(AMELIORATIONS).join(', ')})`, 'ko'); return { sortie: out }; }
    if (!L.startsWith('sudo')) { dire('E: Permission non accordée. Êtes-vous root ? (il faut sudo devant)', 'ko'); dire('En vrai : installer un logiciel demande les droits d’administrateur, d’où sudo.', 'vrai'); return { sortie: out }; }
    if (courant < 0) { dire('Choisis d’abord ta machine (clic ou ssh <ip>).', 'ko'); return { sortie: out }; }
    const action = { t: 'up', k, cible: courant };
    const v = verifier(E, j, action);
    if (!v.ok) { dire(`apt: ${v.raison}`, 'ko'); return { sortie: out }; }
    dire(`Installation de ${k} sur ${ips[courant]}… ${AMELIORATIONS[k].aide}`, 'ok');
    dire('En vrai : apt install installe un logiciel et ce dont il a besoin.', 'vrai');
    return { sortie: out, action };
  }

  // Les commandes qui jouent.
  for (const [k, C] of Object.entries(COMMANDES)) {
    const premier = mot === 'sudo' ? L.split(' ')[1] : mot;
    const cmd = premier === 'apt-get' ? 'apt' : premier;
    if (cmd !== C.cmd) continue;
    const m = L.match(C.base);
    if (!m) {
      dire(`${C.cmd} : syntaxe incorrecte. Exemple : ${C.exemple}`, 'ko');
      return { sortie: out };
    }
    const parfait = C.expert.test(L);
    let cible;
    if (DEFENSES[k]) {
      if (courant < 0 || !ami(E, j, courant)) { dire('Sur quelle machine ? Clique une des tiennes, ou ssh <ip>.', 'ko'); return { sortie: out }; }
      cible = courant;
    } else {
      const ip = m[1];
      cible = parIp.get(ip);
      if (cible === undefined) { dire(`${C.cmd}: ${ip}: Name or service not known (adresse inconnue — essaie arp -a)`, 'ko'); return { sortie: out }; }
      if (ami(E, j, cible)) { dire(`${ip} est une de tes machines : vise un voisin (arp -a).`, 'ko'); return { sortie: out }; }
      if (source(E, j, cible) < 0) { dire(`${C.cmd}: ${ip}: Network is unreachable (hors de portée : il faut tenir une machine voisine)`, 'ko'); return { sortie: out }; }
    }
    const action = k === 'breche' ? { t: 'breche', cible, score: parfait ? BRECHE.longueur : 3 } : { t: k, cible, parfait };
    const v = verifier(E, j, action);
    if (!v.ok) { dire(`${C.cmd}: ${v.raison}`, 'ko'); return { sortie: out }; }
    dire(`${parfait ? '★ ' : ''}${C.cmd} → ${(PROGRAMMES[k] || DEFENSES[k] || BRECHE).nom} sur ${nom(cible)}`, 'ok');
    dire(`En vrai : ${C.vrai}`, 'vrai');
    if (parfait) dire(`★ Parfait grâce à l’option — ${C.option}`, 'info');
    else dire(`Pour une action parfaite : ${C.expertEx.replace(/10\.0\.\d+\.\d+/, ips[cible])}`, 'info');
    return { sortie: out, action, parfait };
  }

  // Une faute de frappe ? On propose la commande la plus proche.
  const proche = LISTE_COMMANDES.map((c) => ({ c, d: distance(mot, c) })).sort((a, b) => a.d - b.d)[0];
  dire(`bash: ${mot}: command not found${proche && proche.d <= 2 ? ` — tu voulais dire ${proche.c} ?` : ''}`, 'ko');
  if (!proche || proche.d > 2) dire('Tape help pour la liste des commandes.', 'info');
  return { sortie: out };
}

/** Distance d'édition (pour « tu voulais dire… »). */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let k = 1; k <= b.length; k++) d[0][k] = k;
  for (let i = 1; i <= a.length; i++) {
    for (let k = 1; k <= b.length; k++) d[i][k] = Math.min(d[i - 1][k] + 1, d[i][k - 1] + 1, d[i - 1][k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/** La complétion (Tab) : le nom de la commande, ou l'adresse. */
export function completer(E, ligne) {
  const morceaux = ligne.split(' ');
  const dernier = morceaux[morceaux.length - 1];
  let choix;
  if (morceaux.length === 1) choix = [...new Set(LISTE_COMMANDES)].filter((c) => c.startsWith(dernier));
  else {
    const ips = adresses(E);
    const pre = dernier.replace(/^\w+@/, '');
    choix = ips.filter((ip) => ip.startsWith(pre) && pre.length > 0);
    if (!choix.length && morceaux[morceaux.length - 2] === 'install') choix = Object.keys(AMELIORATIONS).filter((k) => k.startsWith(dernier));
  }
  if (choix.length !== 1) return { ligne, choix };
  morceaux[morceaux.length - 1] = dernier.replace(/[^@]*$/, '') + choix[0];
  return { ligne: `${morceaux.join(' ')} `, choix };
}
