/**
 * BRASIER — les bots.
 *
 * Un bot remplit une chaise vide, ou reprend celle d'un joueur parti. Il joue
 * par la seule porte qui existe, `agir` : les mêmes actions qu'un humain,
 * validées de la même façon, payées du même or. S'il obtient un triple, c'est
 * qu'il a acheté trois fois la même carte dans la même réserve que vous.
 *
 * Sa stratégie tient en quelques règles, et une personnalité : certains
 * montent la taverne vite, d'autres s'installent et fortifient leur plateau.
 */

import { getServiteur, deTribu } from './serviteurs.js';
import { getHeros } from './heros.js';
import {
  agir, choisirHeros, joueurDe, tribuDominante, PHASE, PLATEAU_MAX, COUT_SERVITEUR,
} from './partie.js';
import { piocher } from '../hasard.js';

export const NOMS_BOTS = [
  'Braise', 'Cendrine', 'Tison', 'Enclume', 'Soufflet', 'Scorie', 'Fonte', 'Étincelle',
  'Charbon', 'Mâchefer', 'Flammèche', 'Suie',
];

/** Une personnalité stable, déduite du nom : même bot, même manière de jouer. */
function tempo(j) {
  let h = 0;
  for (const c of j.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 2 + (h % 100) / 100;    // de 2 (pressé) à 3 (patient)
}

function valeur(j, u, tribu) {
  const d = getServiteur(u.id);
  let s = d.tier * 3 + u.atk + u.pv + u.mots.length * 2;
  if (d.cri || d.fin || d.rale || d.debut || d.allieMeurt) s += 2;
  if (tribu && deTribu(u.id, tribu)) s += 4;
  if (u.dore) s += 12;
  // Un deuxième exemplaire vaut cher : le troisième ferait un triple.
  const pareils = j.plateau.filter((x) => x.id === u.id && !x.dore && x !== u).length;
  if (!d.jeton) s += pareils * 6;
  return s;
}

const argmax = (liste, f) => liste.reduce((m, x, i) => (m < 0 || f(x) > f(liste[m]) ? i : m), -1);
const argmin = (liste, f) => liste.reduce((m, x, i) => (m < 0 || f(x) < f(liste[m]) ? i : m), -1);

export function choisirHerosBot(etat, id) {
  const j = joueurDe(etat, id);
  if (!j || j.heros) return;
  choisirHeros(etat, id, piocher(j.offre, etat.rng));
}

/** Un tour de recrutement complet, jusqu'au « Prêt ». */
export function jouerBot(etat, id) {
  const j = joueurDe(etat, id);
  if (!j || j.mort || etat.phase !== PHASE.RECRUTEMENT) return;
  const act = (a) => agir(etat, id, a).ok;
  const tribu = () => tribuDominante(j.plateau);
  const v = (u) => valeur(j, u, tribu());

  // Les découvertes d'abord : elles occupent une place qu'il faut prévoir.
  for (let garde = 0; j.decouvertes.length && garde < 6; garde++) {
    if (j.plateau.length >= PLATEAU_MAX) act({ type: 'vendre', i: argmin(j.plateau, v) });
    act({ type: 'decouvrir', i: argmax(j.decouvertes[0], v) });
  }

  // Monter la taverne au rythme de sa personnalité.
  const cible = Math.min(6, 1 + Math.floor(etat.tour / tempo(j)));
  if (j.taverne < cible && j.or >= j.coutRang) act({ type: 'ameliorer' });

  let rafraichis = 0;
  for (let garde = 0; garde < 14; garde++) {
    if (j.or < COUT_SERVITEUR && !(j.rafraichiGratuit && rafraichis === 0)) break;
    const k = argmax(j.boutique, v);
    const meilleur = k >= 0 ? j.boutique[k] : null;
    const exigence = 5 + j.taverne * 2.5;

    // Une taverne décevante se rafraîchit, tant qu'il reste de quoi acheter.
    if ((!meilleur || v(meilleur) < exigence) && rafraichis < 2
        && (j.rafraichiGratuit || j.or >= COUT_SERVITEUR + 1)) {
      if (act({ type: 'rafraichir' })) { rafraichis++; continue; }
    }
    if (!meilleur || j.or < COUT_SERVITEUR) break;

    if (j.plateau.length >= PLATEAU_MAX) {
      const pire = argmin(j.plateau, v);
      if (v(meilleur) <= v(j.plateau[pire]) + 3) break;
      act({ type: 'vendre', i: pire });
    }
    if (!act({ type: 'acheter', i: k })) break;
    for (let g = 0; j.decouvertes.length && g < 3; g++) {
      if (j.plateau.length >= PLATEAU_MAX) act({ type: 'vendre', i: argmin(j.plateau, v) });
      act({ type: 'decouvrir', i: argmax(j.decouvertes[0], v) });
    }
  }

  // Le pouvoir héroïque, s'il reste de quoi le payer.
  const p = getHeros(j.heros)?.pouvoir;
  if (p && !p.passif && j.or >= p.cout) act({ type: 'pouvoir' });
  for (let g = 0; j.decouvertes.length && g < 3; g++) {
    if (j.plateau.length >= PLATEAU_MAX) break;
    act({ type: 'decouvrir', i: argmax(j.decouvertes[0], v) });
  }

  // L'or qui reste finance le rang suivant.
  if (j.taverne < 6 && j.or >= j.coutRang) act({ type: 'ameliorer' });

  ranger(j, act);
  act({ type: 'pret', valeur: true });
}

/**
 * Placement : ce qui invoque ou renaît part devant, pour attaquer tôt et
 * repeupler le plateau ; les Provocations ferment la marche, puisque leur
 * rôle est d'encaisser, pas de frapper en premier.
 */
function ranger(j, act) {
  const poids = (u) => {
    const d = getServiteur(u.id);
    let p = 0;
    if (d.rale && d.rale.type === 'invoque') p -= 30;
    if (u.mots.includes('reincarnation')) p -= 20;
    if (u.mots.includes('provocation')) p += 30;
    return p - u.atk;
  };
  const voulu = [...j.plateau].sort((a, b) => poids(a) - poids(b));
  for (let i = 0; i < voulu.length; i++) {
    const de = j.plateau.indexOf(voulu[i]);
    if (de !== i) act({ type: 'deplacer', de, vers: i });
  }
}
