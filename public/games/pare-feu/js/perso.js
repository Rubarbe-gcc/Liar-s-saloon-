/**
 * PARE-FEU — la personnalisation : la couleur de son réseau, la forme de son
 * Noyau et la traînée de ses programmes, débloquées en jouant (parties,
 * victoires, combinaisons parfaites, victoires en difficile).
 *
 * Tout reste dans le navigateur (localStorage `parefeu.profil`) ; en ligne,
 * chacun voit son propre style (les autres gardent leur couleur de place).
 */

import { COULEURS } from '../../../shared/parefeu/donnees.js';

const CLE = 'parefeu.profil';

export const COULEURS_PERSO = [
  { id: 'cyan', nom: 'Cyan', c: '#2ef2ff' },
  { id: 'violet', nom: 'Violet électrique', c: '#9b5cff', cond: { victoires: 1 } },
  { id: 'glace', nom: 'Glacier', c: '#d8f6ff', cond: { parties: 5 } },
  { id: 'rouge', nom: 'Rouge alerte', c: '#ff3b5c', cond: { victoires: 3 } },
  { id: 'matrice', nom: 'Vert matrice', c: '#39ff7a', cond: { parfaits: 30 } },
  { id: 'or', nom: 'Or', c: '#ffd54a', cond: { victoires: 6 } },
  { id: 'lave', nom: 'Orange lave', c: '#ff7a1a', cond: { victoires: 10 } },
  { id: 'bonbon', nom: 'Rose bonbon', c: '#ff8ad8', cond: { difficile: 1 } },
];

export const FORMES = [
  { id: 'hexa', nom: 'Hexagone' },
  { id: 'cercle', nom: 'Anneau', cond: { parties: 3 } },
  { id: 'losange', nom: 'Losange', cond: { victoires: 2 } },
  { id: 'etoile', nom: 'Étoile', cond: { parfaits: 15 } },
  { id: 'octo', nom: 'Octogone', cond: { victoires: 8 } },
  { id: 'triangle', nom: 'Pyramide', cond: { parfaits: 60 } },
  { id: 'oeil', nom: 'Œil', cond: { difficile: 3 } },
];

export const TRAINEES = [
  { id: 'ligne', nom: 'Ligne' },
  { id: 'pointilles', nom: 'Pointillés', cond: { parties: 2 } },
  { id: 'double', nom: 'Double', cond: { victoires: 4 } },
  { id: 'etincelles', nom: 'Étincelles', cond: { parfaits: 25 } },
  { id: 'comete', nom: 'Comète', cond: { victoires: 12 } },
  { id: 'arcenciel', nom: 'Arc-en-ciel', cond: { parfaits: 100 } },
];

const NOMS_COND = { parties: ['partie', 'parties'], victoires: ['victoire', 'victoires'], parfaits: ['combinaison parfaite', 'combinaisons parfaites'], difficile: ['victoire en difficile', 'victoires en difficile'] };

function lire() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(CLE)); } catch { /* illisible */ }
  return {
    stats: { parties: 0, victoires: 0, parfaits: 0, difficile: 0, ...(p?.stats || {}) },
    choix: { couleur: 'cyan', forme: 'hexa', trainee: 'ligne', ...(p?.choix || {}) },
  };
}
function ecrire(p) { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch { /* plein */ } }

export const profil = () => lire();

export function debloque(item, stats = lire().stats) {
  if (!item.cond) return true;
  return Object.entries(item.cond).every(([k, v]) => (stats[k] || 0) >= v);
}

export function condition(item) {
  if (!item.cond) return '';
  return Object.entries(item.cond).map(([k, v]) => `${v} ${NOMS_COND[k][v > 1 ? 1 : 0]}`).join(', ');
}

const TOUT = () => [...COULEURS_PERSO.map((x) => ({ ...x, quoi: 'Couleur' })), ...FORMES.map((x) => ({ ...x, quoi: 'Noyau' })), ...TRAINEES.map((x) => ({ ...x, quoi: 'Traînée' }))];

/**
 * Ajoute aux statistiques ; renvoie ce qui vient d'être débloqué.
 * @param {{parties?:number, victoires?:number, parfaits?:number, difficile?:number}} d
 */
export function compter(d) {
  const p = lire();
  const avant = p.stats;
  const apres = { ...avant };
  for (const [k, v] of Object.entries(d)) apres[k] = (apres[k] || 0) + v;
  p.stats = apres;
  ecrire(p);
  return TOUT().filter((x) => !debloque(x, avant) && debloque(x, apres));
}

export function choisir(type, id) {
  const p = lire();
  p.choix[type] = id;
  ecrire(p);
}

/** Le style choisi, garanti débloqué. */
export function style() {
  const p = lire();
  const pris = (liste, id) => { const x = liste.find((y) => y.id === id); return x && debloque(x, p.stats) ? x : liste[0]; };
  return {
    couleur: pris(COULEURS_PERSO, p.choix.couleur).c,
    forme: pris(FORMES, p.choix.forme).id,
    trainee: pris(TRAINEES, p.choix.trainee).id,
  };
}

function teinte(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.15) return -1;   // presque blanc ou gris
  let h;
  if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/**
 * Les couleurs des joueurs pour cette partie : la mienne est celle que j'ai
 * choisie ; une autre place qui lui ressemble trop prend ma couleur d'origine.
 */
export function palette(moi) {
  const P = [...COULEURS];
  if (moi < 0) return P;
  const c = style().couleur;
  if (c === P[moi]) return P;
  const tc = teinte(c);
  P.forEach((x, k) => {
    if (k === moi) return;
    const tx = teinte(x);
    const ecart = tc < 0 || tx < 0 ? (tc === tx ? 0 : 999) : Math.min(Math.abs(tc - tx), 360 - Math.abs(tc - tx));
    if (ecart < 30) P[k] = COULEURS[moi];
  });
  P[moi] = c;
  return P;
}
