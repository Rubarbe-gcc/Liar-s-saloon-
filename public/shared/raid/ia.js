/**
 * RAID — un joueur automatique.
 *
 * Il sert deux fois : au bouton « combat auto » de l'écran, et aux
 * simulations qui règlent la difficulté (un joueur honnête, sans génie :
 * si lui passe, un humain attentif passe aussi).
 *
 * Module ISO : ni DOM ni Node.
 */

import { actionsDe, actif, vivants, estimer } from './bataille.js';
import { multiplicateur } from './ecoles.js';
import {
  sallesAccessibles, entrer, bataillePour, conclureCombat, prendreRecompense, choisirDon,
  evenementCourant, choisirEvenement, terminerEtape, acheter, vendre, faireRepos, prendreTresor,
  recruter, reprendre, equiper, conseilEquipement, utiliser, PRIX_OBJETS, bonusDe,
} from './aventure.js';
import { avancer, agir } from './bataille.js';
import { statsDe } from './personnages.js';
import { valeurPiece } from './equipement.js';

const part = (u) => u.pv / u.pvMax;

/** La meilleure cible : l'école la plus exposée, puis la plus entamée. */
function meilleureCible(etat, h) {
  const l = vivants(etat.ennemis);
  l.sort((a, b) => (multiplicateur(h.ecole, b.ecole) - multiplicateur(h.ecole, a.ecole))
    || (a.pv - b.pv));
  return l[0];
}

/** Choisit l'action du personnage actif. */
export function choisirAction(etat) {
  const h = actif(etat);
  if (!h) return null;
  const a = Object.fromEntries(actionsDe(etat).map((x) => [x.type, x]));
  const allies = vivants(etat.heros);
  const tombes = etat.heros.filter((x) => x.pv <= 0);
  const blesse = [...allies].sort((x, y) => part(x) - part(y))[0];
  const menace = vivants(etat.ennemis).some((e) => e.charge.reste <= 1 && e.charge.zone);
  const sortDe = (cle) => a[cle].possible && h.sorts[cle];

  if (tombes.length && a.phenix.possible) return { type: 'phenix', cible: tombes[0].idx };

  // Les sorts de soutien, quand ils servent.
  for (const cle of ['ultime', 'special']) {
    const s = sortDe(cle);
    if (!s || !s.soutien) continue;
    const t = s.effet.type;
    if (t === 'soin' && allies.filter((x) => part(x) < 0.6).length >= Math.min(2, allies.length)) return { type: cle };
    if (t === 'soin' && part(blesse) < 0.4) return { type: cle };
    if (t === 'garde' && menace && !etat.bouclier) return { type: cle };
    if (t === 'elan' && !etat.elan && allies.length >= 2) return { type: cle };
    if (t === 'mana' && allies.some((x) => x !== h && x.pm < x.pmMax * 0.3)) return { type: cle };
  }

  if (part(blesse) < 0.3 && a.potion.possible) return { type: 'potion', cible: blesse.idx };
  if (menace && part(h) < 0.5) return { type: 'defendre' };

  const e = meilleureCible(etat, h);
  for (const cle of ['ultime', 'special']) {
    const s = sortDe(cle);
    if (s && !s.soutien) {
      // On garde de quoi lancer l'ultime quand il est proche.
      if (cle === 'special' && h.sorts.ultime && a.ultime.verrou === null && !h.sorts.ultime.soutien
        && h.pm - s.cout < h.sorts.ultime.cout && h.pm + 6 >= h.sorts.ultime.cout) break;
      return { type: cle, cible: e.idx };
    }
  }
  if (h.pm < h.pmMax * 0.2 && a.elixir.possible && h.role === 'soigneur') return { type: 'elixir', cible: h.idx };
  return { type: 'attaque', cible: e.idx };
}

/** Joue un combat entier. Renvoie la bataille terminée. */
export function jouerCombat(etat, max = 400) {
  avancer(etat);
  for (let i = 0; i < max && !etat.fini; i++) {
    const r = agir(etat, choisirAction(etat));
    if (!r.ok) agir(etat, { type: 'attaque' });
  }
  return etat;
}

/* ------------------------------------------------------------------ */
/* L'aventure                                                          */
/* ------------------------------------------------------------------ */

const vieMoyenne = (av) => {
  const b = bonusDe(av);
  return av.groupe.reduce((s, p) => s + Math.max(0, p.pv) / statsDe(p, b).pvMax, 0) / av.groupe.length;
};

function choisirSalle(av) {
  const l = sallesAccessibles(av);
  const vie = vieMoyenne(av);
  const note = (n) => {
    switch (n.type) {
      case 'repos': return vie < 0.6 ? 10 : 3;
      case 'compagnon': return av.groupe.length < 4 ? 9 : 1;
      case 'elite': return vie > 0.75 && av.groupe.length >= 3 ? 6 : 0;
      case 'tresor': return 7;
      case 'marchand': return av.or >= 60 ? 6 : 1;
      case 'evenement': return 5;
      case 'combat': return vie > 0.45 ? 5 : 2;
      default: return 4;
    }
  };
  return [...l].sort((a, b) => note(b) - note(a))[0];
}

function equiperSac(av) {
  for (const it of [...av.sac]) {
    const idx = conseilEquipement(av, it);
    if (idx !== null) equiper(av, idx, it.uid);
  }
}

function soignerSurCarte(av) {
  av.groupe.forEach((p, i) => {
    if (p.pv <= 0 && av.inventaire.phenix > 0) utiliser(av, 'phenix', i);
  });
}

/** Joue une étape de l'aventure. Renvoie faux quand il n'y a plus rien à faire. */
export function jouerEtape(av) {
  if (av.termine) return false;
  const e = av.etape;
  if (!e) {
    equiperSac(av);
    soignerSurCarte(av);
    const n = choisirSalle(av);
    if (!n) return false;
    entrer(av, n.id);
    return true;
  }
  switch (e.type) {
    case 'combat': {
      const b = jouerCombat(bataillePour(av));
      conclureCombat(av, b.victoire);
      break;
    }
    case 'defaite': reprendre(av); break;
    case 'recompense': {
      const best = [...e.pieces].sort((a, b) => valeurPiece(b) - valeurPiece(a))[0];
      prendreRecompense(av, best ? best.uid : null);
      break;
    }
    case 'don': choisirDon(av, e.choix[0].id); break;
    case 'evenement': {
      const ev = evenementCourant(av);
      const c = ev.choix.find((x) => x.possible && (!x.chance || x.chance >= 0.5)) || ev.choix.find((x) => x.possible);
      choisirEvenement(av, c.id);
      break;
    }
    case 'marchand': {
      for (const it of [...av.sac]) vendre(av, it.uid);
      const prix = PRIX_OBJETS(av.acte);
      while (av.inventaire.potion < 3 && av.or >= prix.potion) acheter(av, 'potion');
      if (av.inventaire.phenix < 1 && av.or >= prix.phenix) acheter(av, 'phenix');
      for (const it of [...e.stock].sort((a, b) => valeurPiece(b) - valeurPiece(a))) {
        if (conseilEquipement(av, it) !== null && av.or >= it.prix) acheter(av, it.uid);
      }
      terminerEtape(av);
      break;
    }
    case 'repos': faireRepos(av, vieMoyenne(av) < 0.8 ? 'repos' : 'entrainement'); break;
    case 'tresor': prendreTresor(av); break;
    case 'compagnon': recruter(av, e.offres[0]); break;
    case 'resultat':
    case 'balade': terminerEtape(av); break;
    default: return false;
  }
  return true;
}

/** Joue une aventure jusqu'au bout (ou jusqu'à `maxMorts` défaites). */
export function jouerAventure(av, { maxMorts = 25, maxEtapes = 5000 } = {}) {
  for (let i = 0; i < maxEtapes && !av.termine && av.stats.morts <= maxMorts; i++) {
    if (!jouerEtape(av)) break;
  }
  return av;
}

export { estimer };
