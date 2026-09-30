/**
 * BRASIER — le combat.
 *
 * Module ISO. Le combat se joue tout seul : deux plateaux entrent, un
 * vainqueur sort, et entre les deux une suite d'événements — attaque, coup,
 * bouclier brisé, mort, invocation — que l'écran rejoue tels quels. Rien ne
 * s'affiche qui ne soit passé par une règle d'ici.
 *
 * Les règles, dans l'ordre où elles s'appliquent :
 *   · le camp qui a le plus de serviteurs attaque en premier (à égalité, au
 *     hasard) ; les effets de début de combat partent avant le premier coup ;
 *   · chaque camp attaque à tour de rôle, de gauche à droite, puis reboucle ;
 *     un serviteur sans attaque passe son tour ;
 *   · la cible est tirée au hasard, parmi les Provocations s'il y en a ;
 *   · les deux serviteurs se blessent en même temps ; le Bouclier sacré
 *     annule un coup, le Venin tue ce qu'il blesse, le Balayage touche aussi
 *     les voisins de la cible ;
 *   · les morts partent ensemble, puis leurs râles et leurs réincarnations
 *     prennent leur place, de gauche à droite.
 */

import { getServiteur, effetDe, aMot, deTribu, creer } from './serviteurs.js';
import { entier, piocher } from '../hasard.js';

export const PLATEAU_MAX = 7;
/** Au-delà, le combat est déclaré nul : deux murs de Provocations sans attaque. */
const LIMITE_ATTAQUES = 300;

const snap = (u) => ({ uid: u.uid, id: u.id, atk: u.atk, pv: u.pv, mots: [...u.mots], dore: !!u.dore });

/**
 * @param {[object[], object[]]} plateaux  les deux plateaux, laissés intacts
 * @param {{rng: Function}} o
 * @returns {{gagnant: 0|1|null, survivants: object[], events: object[]}}
 */
export function simulerCombat(plateaux, { rng }) {
  const camps = plateaux.map((p) => p.map((u) => ({ ...u, mots: [...u.mots] })));
  const ev = [];
  let n = 0;
  const uid = () => `c${++n}`;
  const campDe = (u) => (camps[0].includes(u) ? 0 : 1);
  const vivants = (c) => camps[c].filter((u) => u.pv > 0);

  /* ---------------------------- briques ---------------------------- */

  function buff(u, atk, pv) {
    if (!atk && !pv) return;
    u.atk += atk; u.pv += pv;
    ev.push({ t: 'buff', uid: u.uid, atk: u.atk, pv: u.pv });
  }

  function donneMot(u, mot) {
    if (aMot(u, mot)) return;
    u.mots.push(mot);
    ev.push({ t: 'mot', uid: u.uid, mot });
  }

  /** Blesse ; renvoie vrai si le coup a porté (pas de bouclier). */
  function infliger(u, degats, venin) {
    if (degats <= 0) return false;
    if (aMot(u, 'bouclier')) {
      u.mots = u.mots.filter((m) => m !== 'bouclier');
      ev.push({ t: 'bouclier', uid: u.uid });
      return false;
    }
    u.pv -= degats;
    if (venin) u.pv = Math.min(u.pv, 0);
    ev.push({ t: 'coup', uid: u.uid, n: degats, pv: u.pv, venin: !!venin });
    return true;
  }

  function invoquer(camp, pos, id, combien) {
    let faits = 0;
    for (let k = 0; k < combien; k++) {
      if (camps[camp].length >= PLATEAU_MAX) break;
      const u = creer(id, uid());
      const p = Math.min(pos + k, camps[camp].length);
      camps[camp].splice(p, 0, u);
      ev.push({ t: 'invoque', camp, pos: p, u: snap(u) });
      faits++;
    }
    return faits;
  }

  /** Les alliés visés par un effet de soutien. */
  function viser(camp, source, e) {
    const allies = camps[camp].filter((x) => x !== source && x.pv > 0);
    const deLaTribu = allies.filter((x) => deTribu(x.id, e.tribu));
    switch (e.cible) {
      case 'soi': return source.pv > 0 ? [source] : [];
      case 'gauche': return camps[camp].filter((x) => x.pv > 0).slice(0, 1);
      case 'aleatoire': return allies.length ? [piocher(allies, rng)] : [];
      case 'tribu': return deLaTribu;
      case 'tribu1': return deLaTribu.length ? [piocher(deLaTribu, rng)] : [];
      case 'autres': return allies;
      default: return [];
    }
  }

  function appliquer(camp, source, e, pos = 0) {
    switch (e.type) {
      case 'buff': for (const t of viser(camp, source, e)) buff(t, e.atk, e.pv); break;
      case 'mot': for (const t of viser(camp, source, e)) donneMot(t, e.mot); break;
      case 'invoque': return invoquer(camp, pos, e.id, e.n);
      case 'degats': {
        const cibles = vivants(1 - camp);
        if (cibles.length) infliger(piocher(cibles, rng), e.n, false);
        break;
      }
      default: break;
    }
    return 0;
  }

  /**
   * Les morts partent ensemble ; puis, pour chacune, de gauche à droite :
   * les alliés qui s'en nourrissent, le râle, la réincarnation. Un râle qui
   * blesse peut faire de nouvelles victimes : on recommence jusqu'au calme.
   */
  function morts() {
    for (let garde = 0; garde < 50; garde++) {
      const parCamp = [0, 1].map((c) => {
        const list = camps[c];
        const partis = [];
        let restants = 0;
        for (const u of list) {
          if (u.pv <= 0) partis.push({ u, pos: restants });
          else restants++;
        }
        camps[c] = list.filter((u) => u.pv > 0);
        for (const m of partis) ev.push({ t: 'mort', uid: m.u.uid });
        return partis;
      });
      if (!parCamp[0].length && !parCamp[1].length) return;

      for (const c of [0, 1]) {
        let decalage = 0;
        for (const m of parCamp[c]) {
          const pos = m.pos + decalage;
          for (const x of camps[c]) {
            const e = effetDe(x, 'allieMeurt');
            if (e && (!e.tribu || deTribu(m.u.id, e.tribu))) buff(x, e.atk, e.pv);
          }
          const rale = effetDe(m.u, 'rale');
          if (rale) decalage += appliquer(c, m.u, rale, pos) || 0;
          if (aMot(m.u, 'reincarnation') && camps[c].length < PLATEAU_MAX) {
            const def = getServiteur(m.u.id);
            const k = m.u.dore ? 2 : 1;
            const r = {
              uid: uid(), id: m.u.id, atk: def.atk * k, pv: 1, dore: m.u.dore,
              mots: (def.mots || []).filter((x) => x !== 'reincarnation'),
            };
            const p = Math.min(pos, camps[c].length);
            camps[c].splice(p, 0, r);
            ev.push({ t: 'invoque', camp: c, pos: p, u: snap(r), reincarne: true });
            decalage++;
          }
        }
      }
    }
  }

  function attaque(a, c) {
    ev.push({ t: 'attaque', a: a.uid, c: c.uid });
    const campC = campDe(c);
    const posC = camps[campC].indexOf(c);
    const voisins = aMot(a, 'balayage')
      ? [camps[campC][posC - 1], camps[campC][posC + 1]].filter(Boolean) : [];
    const frappe = a.atk, riposte = c.atk;
    infliger(c, frappe, aMot(a, 'venin'));
    for (const v of voisins) infliger(v, frappe, aMot(a, 'venin'));
    infliger(a, riposte, aMot(c, 'venin'));
  }

  function cible(camp) {
    const l = vivants(camp);
    const provoc = l.filter((u) => aMot(u, 'provocation'));
    return piocher(provoc.length ? provoc : l, rng);
  }

  const prochain = [0, 0];
  function attaquantDe(camp) {
    const l = camps[camp];
    for (let k = 0; k < l.length; k++) {
      const i = (prochain[camp] + k) % l.length;
      if (l[i].atk > 0) { prochain[camp] = i; return l[i]; }
    }
    return null;
  }

  /* ---------------------------- déroulé ---------------------------- */

  ev.push({ t: 'debut', camps: camps.map((l) => l.map(snap)) });

  let tour = camps[0].length > camps[1].length ? 0
    : camps[1].length > camps[0].length ? 1 : entier(rng, 2);
  ev.push({ t: 'premier', camp: tour });

  for (const c of [tour, 1 - tour]) {
    for (const u of [...camps[c]]) {
      const e = effetDe(u, 'debut');
      if (e && u.pv > 0) appliquer(c, u, e);
    }
  }
  morts();

  let coups = 0;
  while (camps[0].length && camps[1].length && coups < LIMITE_ATTAQUES) {
    const a = attaquantDe(tour);
    if (!a) {
      if (!attaquantDe(1 - tour)) break;
      tour = 1 - tour;
      continue;
    }
    const pos = camps[tour].indexOf(a);
    const fois = aMot(a, 'furie') ? 2 : 1;
    for (let k = 0; k < fois; k++) {
      if (a.pv <= 0 || !camps[1 - tour].length) break;
      attaque(a, cible(1 - tour));
      morts();
      coups++;
    }
    const ici = camps[tour].indexOf(a);
    prochain[tour] = ici >= 0 ? ici + 1 : pos;
    tour = 1 - tour;
  }

  const gagnant = camps[0].length && !camps[1].length ? 0
    : camps[1].length && !camps[0].length ? 1 : null;
  ev.push({ t: 'fin', gagnant });
  return {
    gagnant,
    survivants: gagnant === null ? [] : camps[gagnant].map(snap),
    events: ev,
  };
}

/* ------------------------------------------------------------------ */
/* Tempo de la rediffusion                                             */
/* ------------------------------------------------------------------ */

/**
 * Durée d'affichage de chaque événement, en millisecondes. Le serveur s'en
 * sert pour savoir quand relancer le recrutement ; l'écran, pour rejouer au
 * même rythme. Les deux lisent la même table : ils ne peuvent pas diverger.
 */
export const TEMPO = {
  debut: 900, premier: 300, attaque: 620, coup: 0, bouclier: 120, mort: 260,
  invoque: 260, buff: 110, mot: 110, fin: 1400,
};

export const dureeCombat = (events) =>
  events.reduce((ms, e) => ms + (TEMPO[e.t] ?? 0), 0);
