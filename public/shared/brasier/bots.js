/**
 * BRASIER — les bots.
 *
 * Un bot remplit une chaise vide, ou reprend celle d'un joueur parti. Il joue
 * par la seule porte qui existe, `agir` : les mêmes actions qu'un humain,
 * validées de la même façon, payées du même or. S'il obtient un triple, c'est
 * qu'il a acheté trois fois la même carte dans la même réserve que vous.
 *
 * Il joue comme une personne, pas comme une machine :
 *   • chacun a son caractère, tiré de son nom : pressé ou patient pour monter
 *     la taverne, plus ou moins habile ;
 *   • il se trompe : il juge les cartes à l'œil, avec une part d'erreur, et
 *     prend parfois la deuxième meilleure ; il rafraîchit peu, oublie parfois
 *     son pouvoir, range plus ou moins bien son plateau ;
 *   • il ne s'envole pas : quand son plateau dépasse nettement celui du
 *     meilleur humain de la table, il lève le pied — il achète moins, ne
 *     rafraîchit plus, ne monte pas la taverne loin devant les humains. Une
 *     table de bots seuls, elle, joue à pleine force.
 */

import { getServiteur, deTribu } from './serviteurs.js';
import { getHeros } from './heros.js';
import {
  agir, choisirHeros, joueurDe, tribuDominante, vivants, coutAmelioration, coutPouvoir,
  PHASE, PLATEAU_MAX, MAIN_MAX, COUT_SERVITEUR,
} from './partie.js';
import { getSort } from './modes.js';
import { piocher, entier } from '../hasard.js';

export const NOMS_BOTS = [
  'Braise', 'Cendrine', 'Tison', 'Enclume', 'Soufflet', 'Scorie', 'Fonte', 'Étincelle',
  'Charbon', 'Mâchefer', 'Flammèche', 'Suie',
];

/** Un caractère stable, déduit du nom : même bot, même manière de jouer. */
export function caractere(j) {
  let h = 0;
  for (const c of j.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return {
    tempo: 2 + (h % 100) / 100,                // de 2 (pressé) à 3 (patient)
    habilete: 0.55 + ((h >>> 8) % 38) / 100,   // de 0,55 (brouillon) à 0,92 (fin)
  };
}

/** La force brute d'un plateau : ce qui se voit au combat. */
export const force = (j) => j.plateau.reduce((s, u) => s + u.atk + u.pv + (u.dore ? 4 : 0), 0);

/**
 * Le bot est-il loin devant les humains ? Alors il lève le pied ce tour-ci.
 * Sans humain vivant à la table, il n'a personne à ménager.
 */
export function enAvance(etat, j) {
  const humains = vivants(etat).filter((x) => !x.isBot);
  if (!humains.length || etat.tour < 4) return false;
  const meilleur = Math.max(...humains.map(force));
  return force(j) > meilleur * 1.3 + 8;
}

function valeur(j, u, tribu) {
  const d = getServiteur(u.id);
  let s = d.tier * 3 + u.atk + u.pv + u.mots.length * 2;
  // Sa quête le guide un peu : le héraut aime les Cris, le chef de clan sa tribu.
  const q = j.quete && !j.quete.faite ? j.quete.id : null;
  if (q === 'herault' && d.cri) s += 5;
  if (q === 'chef-clan' && tribu && deTribu(u.id, tribu)) s += 3;
  if (d.cri || d.fin || d.rale || d.debut || d.allieMeurt || d.allieJoue) s += 2;
  if (tribu && deTribu(u.id, tribu)) s += 4;
  if (u.dore) s += 12;
  // Un deuxième exemplaire vaut cher : le troisième ferait un triple.
  const pareils = [...j.plateau, ...j.main].filter((x) => x.id === u.id && !x.dore && x !== u).length;
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
  const hasard = () => etat.rng();
  const c = caractere(j);
  const leve = enAvance(etat, j);

  // L'œil du bot : la vraie valeur, plus une erreur d'appréciation propre à
  // chaque carte, d'autant plus grande qu'il est brouillon — ou qu'il lève le pied.
  const erreur = (1 - c.habilete) * 12 + (leve ? 10 : 0);
  const coup = new Map();
  const v = (u) => {
    if (!coup.has(u.uid)) coup.set(u.uid, (hasard() - 0.5) * 2 * erreur);
    return valeur(j, u, tribuDominante(j.plateau)) + coup.get(u.uid);
  };
  /** Le meilleur… ou, de temps en temps, le deuxième. */
  const choisir = (liste) => {
    if (!liste.length) return -1;
    const tri = liste.map((u, i) => i).sort((a, b) => v(liste[b]) - v(liste[a]));
    return tri.length > 1 && hasard() < (1 - c.habilete) * 0.6 ? tri[1] : tri[0];
  };

  // Thadéus garde une carte en main, une fois le plateau bien garni : elle nourrit son serviteur de gauche.
  const garde = getHeros(j.heros)?.pouvoir.type === 'collection' ? 1 : 0;

  /** Sa main sur le plateau : le meilleur d'abord ; plateau plein, il remplace le plus faible s'il gagne au change. */
  const poserMain = () => {
    for (let g = 0; j.main.length && g < 12; g++) {
      if (garde && j.plateau.length >= 5 && j.main.length <= garde) break;
      const k = argmax(j.main, v);
      if (j.plateau.length >= PLATEAU_MAX) {
        const pire = argmin(j.plateau, v);
        if (v(j.main[k]) <= v(j.plateau[pire]) + 3) break;
        act({ type: 'vendre', i: pire });
      }
      if (!act({ type: 'jouer', i: k })) break;
    }
  };
  const decouvrir = () => {
    for (let g = 0; j.decouvertes.length && g < 4; g++) {
      if (j.main.length >= MAIN_MAX) break;
      act({ type: 'decouvrir', i: choisir(j.decouvertes[0]) });
    }
  };

  /** Ses cartes spéciales : il les lance dès qu'elles servent. */
  const lancerSorts = () => {
    for (let k = j.sorts.length - 1; k >= 0; k--) {
      const def = getSort(j.sorts[k].id);
      if (def.plateau && j.plateau.length < 3) continue;
      act({ type: 'lancer', i: k });
    }
  };

  // Partie QUÊTE : une quête au hasard parmi les trois.
  if (j.offreQuete) act({ type: 'quete', i: entier(etat.rng, j.offreQuete.length) });

  decouvrir();
  poserMain();
  lancerSorts();
  decouvrir();

  // Monter la taverne au rythme de son caractère — sans s'envoler loin
  // devant les humains, et pas du tout quand il lève le pied.
  const humains = vivants(etat).filter((x) => !x.isBot);
  let cible = Math.min(6, 1 + Math.floor(etat.tour / c.tempo));
  if (humains.length) cible = Math.min(cible, Math.max(...humains.map((x) => x.taverne)) + 1);
  if (leve) cible = Math.min(cible, j.taverne);
  if (j.taverne < cible && j.or >= coutAmelioration(etat, j)) act({ type: 'ameliorer' });

  // Aëlis souffle sur la taverne avant d'y faire ses courses.
  const pv = getHeros(j.heros)?.pouvoir;
  if (pv && pv.type === 'souffleTaverne' && j.or >= coutPouvoir(etat, j) + COUT_SERVITEUR) act({ type: 'pouvoir' });

  let rafraichis = 0;
  const fouille = j.quete && !j.quete.faite && j.quete.id === 'fouineur';
  const maxRafraichis = leve ? 0 : (c.habilete > 0.8 ? 2 : 1) + (fouille ? 2 : 0);
  let achats = 0;
  const maxAchats = leve ? 1 : 9;
  for (let garde = 0; garde < 14 && achats < maxAchats; garde++) {
    if (j.or < COUT_SERVITEUR && !(j.rafraichiGratuit && rafraichis === 0)) break;
    const k = choisir(j.boutique);
    const meilleur = k >= 0 ? j.boutique[k] : null;
    const exigence = 5 + j.taverne * 2.5;

    // Une taverne décevante se rafraîchit, tant qu'il reste de quoi acheter.
    if ((!meilleur || v(meilleur) < exigence) && rafraichis < maxRafraichis
        && (j.rafraichiGratuit || j.or >= COUT_SERVITEUR + 1)) {
      if (act({ type: 'rafraichir' })) { rafraichis++; continue; }
    }
    if (!meilleur || j.or < COUT_SERVITEUR) break;
    // Plateau plein et main déjà chargée : on n'achète que ce qui vaut mieux que son plus faible.
    if (j.plateau.length >= PLATEAU_MAX && j.main.length >= 2
        && v(meilleur) <= v(j.plateau[argmin(j.plateau, v)]) + 3) break;
    if (!act({ type: 'acheter', i: k })) break;
    achats++;
    decouvrir();
    poserMain();
  }

  // Le pouvoir héroïque, s'il reste de quoi le payer… et s'il y pense.
  const p = getHeros(j.heros)?.pouvoir;
  if (p && !p.passif && j.or >= coutPouvoir(etat, j) && hasard() < 0.55 + c.habilete * 0.45) act({ type: 'pouvoir' });
  decouvrir();
  poserMain();
  lancerSorts();

  // L'or qui reste finance le rang suivant.
  if (j.taverne < cible && j.or >= coutAmelioration(etat, j)) act({ type: 'ameliorer' });
  // Le fouineur dépense ses dernières pièces à fouiller la taverne.
  for (let k = 0; fouille && k < 2 && j.or >= 1 && !j.quete.faite; k++) act({ type: 'rafraichir' });

  // Un joueur fin range son plateau ; un brouillon le laisse parfois tel quel.
  if (hasard() < c.habilete) ranger(j, act);
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
