/**
 * PETIT PONT — des clubs en plus, inventés par le code.
 *
 * La Ligue répartit TOUS les clubs en poules de quatre. Quand leur nombre ne
 * tombe pas juste, on complète avec de nouveaux clubs fictifs : nom, écusson,
 * couleurs, devise, cinq joueurs et un style, comme ceux d'equipes.js.
 *
 * Un club généré ne dépend que de la graine et de son rang : le même tirage
 * donne les mêmes clubs. Pour rester équilibrés (35–65 % de victoires), un club
 * inventé reprend le style et les notes d'un des clubs d'origine (déjà équilibrés
 * à la main, test/foot.test.js), à un ou deux points près, avec la même somme de
 * notes. Nom, écusson, couleurs, devise et joueurs sont, eux, tout neufs.
 *
 * Les clubs générés ne sont PAS ajoutés à EQUIPES (la liste du menu) : ils
 * vivent dans EQUIPE (la table que lit le moteur), le temps d'une Ligue.
 * La Ligue garde leur définition complète dans sa sauvegarde.
 *
 * Module partagé, sans DOM.
 */

import { EQUIPES, EQUIPE } from './equipes.js';

/** Les clubs d'origine (la liste du menu ne change jamais : les clubs inventés n'y entrent pas). */
const EQUIPES_ORIGINE = EQUIPES.slice();

/** Un petit hasard reproductible. */
function rng(graine) {
  let s = (graine >>> 0) || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
}
const entier = (R, n) => Math.floor(R() * n);
const piocher = (R, l) => l[entier(R, l.length)];
function melanger(liste, R) {
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) { const j = entier(R, i + 1); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

const PREFIXES = ['Aube', 'Brume', 'Cendre', 'Dune', 'Écume', 'Falaise', 'Givre', 'Havre', 'Ile', 'Jonc', 'Lande', 'Mire', 'Nacre', 'Orge', 'Pierre', 'Quartz', 'Rive', 'Sable', 'Tourbe', 'Ubac', 'Vigne', 'Zéphyr'];
const SUFFIXES = ['bourg', 'val', 'mont', 'vent', 'claire', 'dor', 'mer', 'forge', 'nuit'];
const TYPES = ['Athletic', 'Sporting', 'Union', 'Étoile', 'Vaillante', 'Stade'];
const DEVISES = [
  'Ici, on ne lâche rien.', 'Un pas de plus, toujours.', 'Le ballon est notre boussole.', 'Petits terrains, grands rêves.',
  'On joue pour la ville entière.', 'La patience gagne les finales.', 'Plus fort ensemble.', 'Jamais sans nos supporters.',
  'Le cœur avant le talent.', 'Chaque match est une fête.', 'Tenir bon, frapper juste.', 'Le vent tourne pour ceux qui courent.',
];
const PRENOMS = ['Adrien', 'Baptiste', 'Camille', 'Dorian', 'Elias', 'Fabien', 'Gaspard', 'Hugo', 'Ismaël', 'Jérémy', 'Kilian', 'Léandre', 'Matéo', 'Noham', 'Octave', 'Pablo', 'Quentin', 'Raphaël', 'Simon', 'Tristan', 'Ulysse', 'Valentin', 'Wilfried', 'Yanis', 'Zacharie', 'Alois', 'Bastien', 'Clément', 'Damien', 'Émeric', 'Florian', 'Gabin'];
const NOMS = ['Vaubrune', 'Tessolan', 'Marcelet', 'Ostrel', 'Brevane', 'Calvaro', 'Dunoyer', 'Escarel', 'Fontelle', 'Garance', 'Hautecour', 'Ilvane', 'Jarouel', 'Kervalet', 'Lombrant', 'Mordelle', 'Nivarel', 'Orlanne', 'Pellevoir', 'Quirelle', 'Rostane', 'Sauvelin', 'Tarmoul', 'Urvalle', 'Vernessac', 'Wallenor', 'Yserand', 'Zolbrac', 'Ardoisel', 'Bellemont', 'Cormorel', 'Dasvigne', 'Eskarpe', 'Fauvalet', 'Grisolle', 'Hirondel', 'Joubarbe', 'Lavandrel', 'Montrevel', 'Noirpierre'];
// [maillot, accent, sombre]
const PALETTES = [
  ['#d94141', '#ffffff', '#3b0d0d'], ['#2e7d5b', '#f2e8c9', '#0e2a1f'], ['#7a3fb5', '#f4d35e', '#25103d'], ['#e8a33d', '#1f2a44', '#1f2a44'],
  ['#3a86c8', '#f5f5f5', '#0d2540'], ['#c2185b', '#ffe0ec', '#3b0720'], ['#00897b', '#fff3b0', '#05302c'], ['#5d6b7a', '#ff7043', '#1b2026'],
  ['#8bc34a', '#263238', '#263238'], ['#ff6f91', '#2c2a4a', '#2c2a4a'], ['#4e342e', '#ffcc80', '#26130f'], ['#1a237e', '#ffd600', '#0a0f3d'],
];
const FORMES = ['bouclier', 'rond', 'hexagone', 'blason', 'losange'];
const MOTIFS_ECU = ['rayures', 'demi', 'chevron', 'croix', 'bande', 'uni'];
const MOTIFS_MAILLOT = ['uni', 'rayures', 'bande', 'cerceaux', 'demi'];
const SYMBOLES = ['eclair', 'soleil', 'enclume', 'etoile', 'montagne', 'vague', 'lune', 'mouette', 'feuille', 'couronne', 'flamme', 'ancre', 'roue', 'tour', 'aile', 'fleche'];
const GARDIENS = ['#f2d43a', '#2bd17e', '#ff7a1a', '#e040fb', '#26c6da'];
const NOTES = ['vitesse', 'tir', 'passe', 'defense', 'gardien'];

const sansAccent = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = (s) => sansAccent(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const luminance = (h) => { const v = parseInt(h.slice(1), 16); return (0.3 * ((v >> 16) & 255) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255)) / 255; };
const contraste = (fond) => (luminance(fond) > 0.55 ? '#14213d' : '#ffffff');
const de = (ville) => (/^[AEIOUYÉÈÊÎÔHÂ]/i.test(ville) ? `d’${ville}` : `de ${ville}`);

/** Les notes d'un modèle, déplacées de quelques points d'un domaine à l'autre (la somme ne change pas ; au plus 2 points d'écart par note). */
function varierNotes(modele, R) {
  const n = { ...modele };
  for (let essai = 0; essai < 6; essai++) {
    const a = NOTES[entier(R, 5)], b = NOTES[entier(R, 5)];
    if (a === b) continue;
    if (Math.abs(n[a] + 1 - modele[a]) <= 2 && Math.abs(n[b] - 1 - modele[b]) <= 2) { n[a] += 1; n[b] -= 1; }
  }
  return n;
}

/** Les trois lettres de l'abréviation, qui ne ressemblent à aucune déjà prise. */
function abreviation(ville, prises) {
  const l = sansAccent(ville).replace(/[^A-Za-z]/g, '').toUpperCase();
  const essais = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [0, 1, 4], [0, 2, 4], [1, 2, 3]];
  for (const [a, b, c] of essais) { const abr = `${l[a]}${l[b]}${l[c]}`; if (l[c] && !prises.has(abr)) return abr; }
  for (let k = 0; k < 900; k++) { const abr = `${l[0]}${l[1]}${String.fromCharCode(65 + (k % 26))}`; if (!prises.has(abr)) return abr; }
  return l.slice(0, 3);
}

/** Un club inventé, de A à Z, à partir d'un hasard. `pris` : { ids, noms, abrs } ce qui existe déjà. */
function inventer(R, ville, pris) {
  const type = piocher(R, TYPES);
  const nom = `${type} ${de(ville)}`;
  const pal = piocher(R, PALETTES);
  const [fond, accent, sombre] = pal;
  const motif = piocher(R, MOTIFS_MAILLOT);
  const clair = luminance(accent) > luminance(sombre) ? accent : sombre;
  const modele = piocher(R, EQUIPES_ORIGINE);
  const style = modele.style;
  const notes = varierNotes(modele.notes, R);
  const symbole = piocher(R, SYMBOLES);
  const noms = new Set();
  const joueur = (numero, vedette = null) => {
    let nomJ;
    do { nomJ = `${piocher(R, PRENOMS)} ${piocher(R, NOMS)}`; } while (noms.has(nomJ));
    noms.add(nomJ);
    return { nom: nomJ, numero, vedette };
  };
  const posVedette = modele.joueurs.findIndex((x) => x.vedette);
  const vedetteDe = modele.joueurs[posVedette]?.vedette ?? null;
  const nums = [1, 3 + entier(R, 3), 6 + entier(R, 3), 10, R() < 0.5 ? 9 : 11];
  const joueurs = nums.map((nb, i) => joueur(nb, i === posVedette ? vedetteDe : null));
  const id = `club-${slug(ville)}`;
  return {
    id, nom, court: ville, abr: abreviation(ville, pris.abrs), ville,
    devise: piocher(R, DEVISES),
    maillot: { fond, motif, motifC: accent, short: accent === '#ffffff' || luminance(accent) > 0.7 ? sombre : accent, bas: fond, num: contraste(fond) },
    exterieur: { fond: sombre, motif: R() < 0.5 ? 'uni' : 'bande', motifC: fond, short: sombre, bas: sombre, num: contraste(sombre) },
    gardien: piocher(R, GARDIENS.filter((c) => c !== fond)),
    ecusson: { forme: piocher(R, FORMES), fond: sombre, fond2: fond, motif: piocher(R, MOTIFS_ECU), symbole, symboleC: clair, bord: accent },
    style,
    notes,
    joueurs,
    genere: true,
    modele: modele.id,
  };
}

/** Le plus petit nombre de clubs ≥ n qui fasse 4 × (une puissance de 2) : 4, 8, 16, 32… */
export function tailleLigue(n) {
  let t = 4;
  while (t < n) t *= 2;
  return t;
}

/**
 * Les clubs à ajouter pour que `existants` (une liste de clubs) remplisse des poules de quatre,
 * avec un nombre de poules en puissance de 2 (pour que le tableau final soit complet).
 * Rend un tableau de nouveaux clubs (vide s'il n'en manque aucun). Rien n'est modifié.
 */
export function completerClubs(existants, graine = 1) {
  const manque = tailleLigue(existants.length) - existants.length;
  if (manque <= 0) return [];
  const R = rng((graine >>> 0) * 2654435761 + 12345);
  const pris = {
    ids: new Set(existants.map((c) => c.id)),
    noms: new Set(existants.map((c) => sansAccent(c.court).toLowerCase())),
    abrs: new Set(existants.map((c) => c.abr)),
  };
  const villes = melanger(PREFIXES.flatMap((p) => SUFFIXES.map((s) => `${p}${s}`)), R);
  const neufs = [];
  for (const ville of villes) {
    if (neufs.length >= manque) break;
    const id = `club-${slug(ville)}`;
    if (pris.ids.has(id) || pris.noms.has(sansAccent(ville).toLowerCase())) continue;
    const club = inventer(R, ville, pris);
    pris.ids.add(club.id); pris.noms.add(sansAccent(ville).toLowerCase()); pris.abrs.add(club.abr);
    neufs.push(club);
  }
  return neufs;
}

/** Rend les clubs générés connus du moteur (sans les mettre dans la liste du menu). */
export function enregistrerClubs(clubs) {
  for (const c of clubs) if (!EQUIPE[c.id]) EQUIPE[c.id] = c;
}

/** Les retire (pour les tests, ou à la fin d'une Ligue). Les clubs d'origine ne sont jamais retirés. */
export function retirerClubs(clubs) {
  const origine = new Set(EQUIPES.map((e) => e.id));
  for (const c of clubs) if (!origine.has(c.id)) delete EQUIPE[c.id];
}
