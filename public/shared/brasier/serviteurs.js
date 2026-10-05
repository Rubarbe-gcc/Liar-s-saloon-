/**
 * BRASIER — les serviteurs.
 *
 * Module ISO : des données et des fonctions pures, sans navigateur ni Node.
 * Le serveur s'en sert pour arbitrer, le client pour dessiner, les tests pour
 * vérifier que chaque carte fait ce que son texte promet.
 *
 * Un serviteur en jeu n'emporte que ce qui peut changer — attaque, vie,
 * mots-clés gagnés, dorure. Son nom, sa tribu, son rang et ses effets se
 * relisent toujours ici, par son identifiant : il n'y a qu'une vérité.
 *
 * Tout est original — noms, tribus, effets. Seuls les codes du genre sont
 * repris : une taverne, six rangs, des triples dorés.
 */

/** Les tribus. `tous` compte pour chacune d'elles. */
export const TRIBUS = {
  fauve: { key: 'fauve', label: 'Fauve', glyph: '🐾', color: '#e8913a' },
  rouage: { key: 'rouage', label: 'Rouage', glyph: '⚙️', color: '#8fb8d8' },
  ecaille: { key: 'ecaille', label: 'Écaille', glyph: '🐟', color: '#3cc8a4' },
  demon: { key: 'demon', label: 'Démon', glyph: '😈', color: '#e8505a' },
  dragon: { key: 'dragon', label: 'Dragon', glyph: '🐉', color: '#b48cff' },
  spectre: { key: 'spectre', label: 'Spectre', glyph: '💀', color: '#a6d86e' },
  elementaire: { key: 'elementaire', label: 'Élémentaire', glyph: '🌪️', color: '#5fd3f3' },
  neutre: { key: 'neutre', label: 'Neutre', glyph: '⚒️', color: '#c9b79c' },
  tous: { key: 'tous', label: 'Toutes tribus', glyph: '🌈', color: '#ffd76a' },
};

/** Les mots-clés, et ce qu'ils font en combat. */
export const MOTS = {
  provocation: { key: 'provocation', label: 'Provocation', glyph: '🛡️',
    texte: 'Les ennemis doivent l\'attaquer en priorité.' },
  bouclier: { key: 'bouclier', label: 'Bouclier sacré', glyph: '✨',
    texte: 'Annule entièrement le premier coup reçu.' },
  venin: { key: 'venin', label: 'Venin', glyph: '☠️',
    texte: 'Tue tout serviteur qu\'il blesse.' },
  furie: { key: 'furie', label: 'Furie', glyph: '🌀',
    texte: 'Attaque deux fois.' },
  reincarnation: { key: 'reincarnation', label: 'Réincarnation', glyph: '♻️',
    texte: 'La première fois qu\'il meurt, revient avec 1 PV.' },
  balayage: { key: 'balayage', label: 'Balayage', glyph: '🪓',
    texte: 'Frappe aussi les voisins de sa cible.' },
};

/**
 * Les effets, par moment :
 *   cri        à l'achat ;
 *   fin        à la fin de chaque recrutement ;
 *   debut      au début de chaque combat ;
 *   rale       à sa mort, en combat ;
 *   allieMeurt quand un allié (de la tribu donnée, ou n'importe lequel) meurt ;
 *   allieJoue  quand on pose un autre serviteur (de la tribu donnée, ou
 *              n'importe lequel), en recrutement.
 *
 * Un effet `taverne` donne ses statistiques aux serviteurs de la taverne :
 * ils sont plus forts quand on les achète.
 *
 * Cibles d'un buff : 'soi', 'gauche', 'aleatoire' (un autre allié), 'tribu'
 * (tous les autres alliés de la tribu), 'tribu1' (un autre allié de la tribu),
 * 'autres' (tous les autres alliés).
 *
 * Une version dorée double tous les nombres d'un effet, et invoque deux fois.
 */
export const SERVITEURS = [
  /* ---------------------------- Rang 1 ---------------------------- */
  { id: 'chat-braise', nom: 'Chat de braise', tier: 1, tribu: 'fauve', glyph: '🐈', atk: 1, pv: 1,
    cri: { type: 'invoque', id: 'chaton', n: 1 } },
  { id: 'eclaireur-ressort', nom: 'Éclaireur à ressort', tier: 1, tribu: 'rouage', glyph: '🤖', atk: 1, pv: 2,
    mots: ['bouclier'] },
  { id: 'pecheur-ecailles', nom: 'Pêcheur d\'écailles', tier: 1, tribu: 'ecaille', glyph: '🎣', atk: 2, pv: 1,
    cri: { type: 'buff', cible: 'tribu1', tribu: 'ecaille', atk: 1, pv: 1 } },
  { id: 'diablotin-farceur', nom: 'Diablotin farceur', tier: 1, tribu: 'demon', glyph: '👺', atk: 1, pv: 3,
    mots: ['provocation'] },
  { id: 'braisillon', nom: 'Braisillon', tier: 1, tribu: 'dragon', glyph: '🦎', atk: 1, pv: 2,
    fin: { type: 'buff', cible: 'soi', atk: 1, pv: 0 } },
  { id: 'squelette-ricanant', nom: 'Squelette ricanant', tier: 1, tribu: 'spectre', glyph: '💀', atk: 2, pv: 1,
    mots: ['reincarnation'] },
  { id: 'flammeche-errante', nom: 'Flammèche errante', tier: 1, tribu: 'elementaire', glyph: '🕯️', atk: 1, pv: 2,
    allieJoue: { tribu: 'elementaire', atk: 1, pv: 1 } },
  { id: 'apprenti-forgeron', nom: 'Apprenti forgeron', tier: 1, tribu: 'neutre', glyph: '🧑‍🏭', atk: 2, pv: 2,
    cri: { type: 'buff', cible: 'aleatoire', atk: 1, pv: 0 } },

  /* ---------------------------- Rang 2 ---------------------------- */
  { id: 'charognard', nom: 'Charognard des dunes', tier: 2, tribu: 'fauve', glyph: '🦅', atk: 2, pv: 3,
    allieMeurt: { tribu: 'fauve', atk: 2, pv: 1 } },
  { id: 'chien-vapeur', nom: 'Chien à vapeur', tier: 2, tribu: 'rouage', glyph: '🐕', atk: 2, pv: 3,
    rale: { type: 'invoque', id: 'rouage-minuscule', n: 1 } },
  { id: 'chef-maree', nom: 'Chef de marée', tier: 2, tribu: 'ecaille', glyph: '🧜', atk: 2, pv: 3,
    cri: { type: 'buff', cible: 'tribu', tribu: 'ecaille', atk: 1, pv: 1 } },
  { id: 'gardienne-infernale', nom: 'Gardienne infernale', tier: 2, tribu: 'demon', glyph: '👹', atk: 2, pv: 4,
    mots: ['provocation'], fin: { type: 'buff', cible: 'soi', atk: 0, pv: 1 } },
  { id: 'souffle-braise', nom: 'Souffle-braise', tier: 2, tribu: 'dragon', glyph: '🐲', atk: 1, pv: 4,
    debut: { type: 'degats', cible: 'aleatoire', n: 2 } },
  { id: 'goule-affamee', nom: 'Goule affamée', tier: 2, tribu: 'spectre', glyph: '🧟', atk: 2, pv: 2,
    rale: { type: 'buff', cible: 'aleatoire', atk: 2, pv: 2 } },
  { id: 'brise-mutine', nom: 'Brise mutine', tier: 2, tribu: 'elementaire', glyph: '🌬️', atk: 3, pv: 2,
    cri: { type: 'taverne', atk: 1, pv: 1 } },
  { id: 'porte-etendard', nom: 'Porte-étendard', tier: 2, tribu: 'neutre', glyph: '🚩', atk: 2, pv: 3,
    fin: { type: 'buff', cible: 'gauche', atk: 1, pv: 1 } },

  /* ---------------------------- Rang 3 ---------------------------- */
  { id: 'mere-ourse', nom: 'Mère ourse', tier: 3, tribu: 'fauve', glyph: '🐻', atk: 3, pv: 4,
    rale: { type: 'invoque', id: 'ourson', n: 2 } },
  { id: 'sentinelle-cuivre', nom: 'Sentinelle de cuivre', tier: 3, tribu: 'rouage', glyph: '🛡️', atk: 2, pv: 5,
    mots: ['bouclier', 'provocation'] },
  { id: 'mord-venin', nom: 'Mord-venin', tier: 3, tribu: 'ecaille', glyph: '🐍', atk: 2, pv: 2,
    mots: ['venin'] },
  { id: 'seigneur-fosse', nom: 'Seigneur de la fosse', tier: 3, tribu: 'demon', glyph: '😈', atk: 5, pv: 6,
    cri: { type: 'blesseHeros', n: 2 } },
  { id: 'gardien-airain', nom: 'Gardien d\'airain', tier: 3, tribu: 'dragon', glyph: '🐉', atk: 3, pv: 5,
    fin: { type: 'buff', cible: 'tribu', tribu: 'dragon', atk: 1, pv: 1 } },
  { id: 'banshee', nom: 'Banshee hurlante', tier: 3, tribu: 'spectre', glyph: '👻', atk: 2, pv: 5,
    allieMeurt: { tribu: null, atk: 1, pv: 0 } },
  { id: 'rocher-vivant', nom: 'Rocher vivant', tier: 3, tribu: 'elementaire', glyph: '🪨', atk: 2, pv: 5,
    mots: ['provocation'], allieJoue: { tribu: 'elementaire', atk: 1, pv: 2 } },
  { id: 'hydre-gouffres', nom: 'Hydre des gouffres', tier: 3, tribu: 'neutre', glyph: '🐙', atk: 2, pv: 4,
    mots: ['balayage'] },

  /* ---------------------------- Rang 4 ---------------------------- */
  { id: 'fauve-alpha', nom: 'Fauve alpha', tier: 4, tribu: 'fauve', glyph: '🦁', atk: 4, pv: 5,
    cri: { type: 'buff', cible: 'tribu', tribu: 'fauve', atk: 2, pv: 2 } },
  { id: 'titan-engrenages', nom: 'Titan à engrenages', tier: 4, tribu: 'rouage', glyph: '🦾', atk: 4, pv: 5,
    mots: ['bouclier'], rale: { type: 'invoque', id: 'rouage-minuscule', n: 2 } },
  { id: 'roi-abysses', nom: 'Roi des abysses', tier: 4, tribu: 'ecaille', glyph: '🦈', atk: 4, pv: 6,
    fin: { type: 'buff', cible: 'tribu1', tribu: 'ecaille', atk: 2, pv: 2 } },
  { id: 'dragon-ecailles-or', nom: 'Dragon aux écailles d\'or', tier: 4, tribu: 'dragon', glyph: '🐊', atk: 4, pv: 8,
    mots: ['bouclier'] },
  { id: 'ombre-errante', nom: 'Ombre errante', tier: 4, tribu: 'spectre', glyph: '🌫️', atk: 6, pv: 3,
    mots: ['reincarnation'] },
  { id: 'tempete-ambulante', nom: 'Tempête ambulante', tier: 4, tribu: 'elementaire', glyph: '⛈️', atk: 4, pv: 4,
    cri: { type: 'buff', cible: 'tribu', tribu: 'elementaire', atk: 2, pv: 1 } },
  { id: 'dresseur-braises', nom: 'Dompteur de braises', tier: 4, tribu: 'neutre', glyph: '🧙', atk: 3, pv: 5,
    mots: ['furie'] },

  /* ---------------------------- Rang 5 ---------------------------- */
  { id: 'bete-fission', nom: 'Bête de fission', tier: 5, tribu: 'fauve', glyph: '🦏', atk: 5, pv: 8,
    mots: ['reincarnation', 'balayage'] },
  { id: 'champion-marees', nom: 'Champion des marées', tier: 5, tribu: 'ecaille', glyph: '🔱', atk: 5, pv: 6,
    mots: ['venin', 'provocation'] },
  { id: 'seigneur-abime', nom: 'Seigneur de l\'abîme', tier: 5, tribu: 'demon', glyph: '👿', atk: 7, pv: 7,
    fin: { type: 'buff', cible: 'tribu', tribu: 'demon', atk: 1, pv: 1 } },
  { id: 'dragon-ancestral', nom: 'Dragon ancestral', tier: 5, tribu: 'dragon', glyph: '🐦‍🔥', atk: 6, pv: 6,
    debut: { type: 'buff', cible: 'tribu', tribu: 'dragon', atk: 2, pv: 2 } },
  { id: 'liche-cendres', nom: 'Liche des cendres', tier: 5, tribu: 'spectre', glyph: '☠️', atk: 5, pv: 5,
    cri: { type: 'mot', cible: 'tribu', tribu: 'spectre', mot: 'reincarnation' } },
  { id: 'colosse-magma', nom: 'Colosse de magma', tier: 5, tribu: 'elementaire', glyph: '🌋', atk: 6, pv: 6,
    allieJoue: { tribu: 'elementaire', atk: 2, pv: 2 } },
  { id: 'forge-vivante', nom: 'Forge vivante', tier: 5, tribu: 'rouage', glyph: '🏭', atk: 4, pv: 8,
    fin: { type: 'buff', cible: 'tribu', tribu: 'rouage', atk: 2, pv: 0 } },

  /* ---------------------------- Rang 6 ---------------------------- */
  { id: 'chimere-parfaite', nom: 'Chimère parfaite', tier: 6, tribu: 'tous', glyph: '🦄', atk: 6, pv: 6,
    mots: ['provocation', 'bouclier', 'venin', 'furie'] },
  { id: 'faucheuse-3000', nom: 'Faucheuse 3000', tier: 6, tribu: 'rouage', glyph: '🚜', atk: 6, pv: 9,
    mots: ['balayage', 'bouclier'] },
  { id: 'wyrm-eternite', nom: 'Wyrm de l\'éternité', tier: 6, tribu: 'dragon', glyph: '🌌', atk: 4, pv: 12,
    debut: { type: 'buff', cible: 'autres', atk: 2, pv: 2 } },
  { id: 'prince-brasiers', nom: 'Prince des brasiers', tier: 6, tribu: 'demon', glyph: '🔥', atk: 8, pv: 8,
    rale: { type: 'invoque', id: 'diablotin-ardent', n: 2 } },

  { id: 'seigneur-elements', nom: 'Seigneur des éléments', tier: 6, tribu: 'elementaire', glyph: '🌀', atk: 7, pv: 7,
    cri: { type: 'taverne', atk: 3, pv: 3 }, fin: { type: 'buff', cible: 'tribu', tribu: 'elementaire', atk: 2, pv: 2 } },

  /* -------------- Exclusifs : seulement en récompense de quête -------------- */
  { id: 'phenix-azur', nom: 'Phénix d\'azur', tier: 5, tribu: 'dragon', glyph: '🕊️', atk: 6, pv: 6, exclusif: true,
    mots: ['reincarnation', 'bouclier'] },
  { id: 'kraken-abyssal', nom: 'Kraken abyssal', tier: 6, tribu: 'ecaille', glyph: '🦑', atk: 4, pv: 9, exclusif: true,
    mots: ['venin', 'balayage'] },
  { id: 'golem-runique', nom: 'Golem runique', tier: 5, tribu: 'rouage', glyph: '🗿', atk: 5, pv: 9, exclusif: true,
    mots: ['provocation', 'bouclier'], fin: { type: 'buff', cible: 'soi', atk: 2, pv: 2 } },
  { id: 'coeur-tempete', nom: 'Cœur de la tempête', tier: 6, tribu: 'elementaire', glyph: '⚡', atk: 8, pv: 8, exclusif: true,
    allieJoue: { tribu: null, atk: 2, pv: 2 } },
  { id: 'reine-meute', nom: 'Reine de la meute', tier: 5, tribu: 'fauve', glyph: '🐺', atk: 6, pv: 7, exclusif: true,
    rale: { type: 'invoque', id: 'ourson', n: 3 } },

  /* --------------------- Jetons : jamais en taverne --------------------- */
  { id: 'chaton', nom: 'Chaton', tier: 1, tribu: 'fauve', glyph: '🐱', atk: 1, pv: 1, jeton: true },
  { id: 'ourson', nom: 'Ourson', tier: 1, tribu: 'fauve', glyph: '🧸', atk: 2, pv: 2, jeton: true },
  { id: 'rouage-minuscule', nom: 'Rouage minuscule', tier: 1, tribu: 'rouage', glyph: '🔩', atk: 2, pv: 1, jeton: true },
  { id: 'diablotin-ardent', nom: 'Diablotin ardent', tier: 1, tribu: 'demon', glyph: '👾', atk: 3, pv: 3, jeton: true },
];

const PAR_ID = new Map(SERVITEURS.map((s) => [s.id, s]));
export const getServiteur = (id) => PAR_ID.get(id) || null;

/** Les serviteurs qu'on peut trouver en taverne, jetons et exclusifs de quête exclus. */
export const RECRUTABLES = SERVITEURS.filter((s) => !s.jeton && !s.exclusif);

/** Hors réserve : un jeton ou un exclusif ne se rend pas, ne compte pas pour un triple. */
export const horsReserve = (id) => { const s = getServiteur(id); return !s || !!s.jeton || !!s.exclusif; };

/** Nombre d'exemplaires de chaque serviteur dans la réserve commune. */
export const COPIES = { 1: 16, 2: 15, 3: 13, 4: 11, 5: 9, 6: 7 };

/** Un serviteur appartient-il à une tribu ? `tous` répond oui à chacune. */
export const deTribu = (id, tribu) => {
  const s = getServiteur(id);
  return !!s && !!tribu && (s.tribu === tribu || s.tribu === 'tous');
};

/**
 * Nouvelle instance d'un serviteur. `uid` est unique dans la partie : c'est
 * par lui que l'écran suit un serviteur d'une animation à l'autre.
 */
export function creer(id, uid, dore = false) {
  const s = getServiteur(id);
  if (!s) throw new Error(`serviteur inconnu : ${id}`);
  const k = dore ? 2 : 1;
  return { uid, id, atk: s.atk * k, pv: s.pv * k, mots: [...(s.mots || [])], dore };
}

export const aMot = (u, mot) => u.mots.includes(mot);

/** Un effet, nombres doublés si le serviteur est doré. */
export function effetDe(u, moment) {
  const e = getServiteur(u.id)?.[moment];
  if (!e) return null;
  if (!u.dore) return e;
  const x = { ...e };
  for (const k of ['atk', 'pv', 'n']) if (typeof x[k] === 'number') x[k] *= 2;
  return x;
}

/* ------------------------------------------------------------------ */
/* Texte des cartes                                                    */
/* ------------------------------------------------------------------ */

const plur = (n, s, p) => (n > 1 ? p : s);
const stats = (atk, pv) => `+${atk}/+${pv}`;

function cibleTexte(e) {
  const t = e.tribu ? TRIBUS[e.tribu].label : '';
  switch (e.cible) {
    case 'soi': return 'lui-même';
    case 'gauche': return 'votre serviteur le plus à gauche';
    case 'aleatoire': return 'un autre allié au hasard';
    case 'tribu': return `vos autres ${t}s`;
    case 'tribu1': return `un autre ${t} au hasard`;
    case 'autres': return 'vos autres serviteurs';
    default: return '';
  }
}

function effetTexte(e) {
  switch (e.type) {
    case 'buff':
      if (e.cible === 'soi') {
        return `gagne ${e.pv ? stats(e.atk, e.pv) : `+${e.atk} ATQ`}`;
      }
      return `donne ${e.pv ? stats(e.atk, e.pv) : `+${e.atk} ATQ`} à ${cibleTexte(e)}`;
    case 'invoque': {
      const j = getServiteur(e.id);
      return `invoque ${e.n > 1 ? `${e.n} ` : 'un '}${j.nom}${e.n > 1 ? 's' : ''} ${j.atk}/${j.pv}`;
    }
    case 'degats':
      return `inflige ${e.n} ${plur(e.n, 'dégât', 'dégâts')} à un ennemi au hasard`;
    case 'mot':
      return `donne ${MOTS[e.mot].label} à ${cibleTexte(e)}`;
    case 'blesseHeros':
      return `votre héros perd ${e.n} PV`;
    case 'taverne':
      return `donne ${stats(e.atk, e.pv)} aux serviteurs de votre taverne`;
    default: return '';
  }
}

/** Texte d'une carte, tel qu'il s'affiche — calculé, jamais écrit à la main. */
export function texte(id, dore = false) {
  const s = getServiteur(id);
  if (!s) return '';
  const u = { id, dore };
  const out = [];
  const cri = effetDe(u, 'cri');
  const fin = effetDe(u, 'fin');
  const debut = effetDe(u, 'debut');
  const rale = effetDe(u, 'rale');
  const allie = effetDe(u, 'allieMeurt');
  const joue = effetDe(u, 'allieJoue');
  if (cri) out.push(`<b>Cri :</b> ${effetTexte(cri)}.`);
  if (debut) out.push(`<b>Début de combat :</b> ${effetTexte(debut)}.`);
  if (fin) out.push(`<b>Fin du tour :</b> ${effetTexte(fin)}.`);
  if (rale) out.push(`<b>Râle :</b> ${effetTexte(rale)}.`);
  if (allie) {
    const qui = allie.tribu ? `un ${TRIBUS[allie.tribu].label} allié` : 'un allié';
    out.push(`Quand ${qui} meurt, gagne ${allie.pv ? stats(allie.atk, allie.pv) : `+${allie.atk} ATQ`}.`);
  }
  if (joue) {
    const quoi = joue.tribu ? `un autre ${TRIBUS[joue.tribu].label}` : 'un autre serviteur';
    out.push(`Quand vous posez ${quoi}, gagne ${stats(joue.atk, joue.pv)}.`);
  }
  return out.join(' ');
}
