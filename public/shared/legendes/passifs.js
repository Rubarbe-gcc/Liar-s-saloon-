/**
 * LÉGENDES — les passifs, les compétences de chef et les super attaques, construits à partir du rôle et de la
 * rareté de chaque personnage (persos.js) : un R a une ligne de passif, un LR jusqu'à huit. Chaque ligne est
 * un EFFET que le combat sait appliquer (combat.js) et une phrase pour la fiche.
 *
 * Les effets : stat (ATQ/DÉF au début du tour), ki, sphere (ATQ par sphère ramassée), surSuper (ATQ en
 * lançant une super), cumul (ATQ/DÉF qui montent à chaque attaque ou à chaque coup reçu), reduction,
 * garde, contre, esquive, critique, attAdd (attaque additionnelle), superAdd, soutien (ki et ATQ aux
 * alliés de la rotation), soin, boss (ATQ contre un boss), pvBas (ATQ quand les PV de l'équipe sont bas).
 */

const NIV = { R: 0, SR: 1, SSR: 2, LR: 3 };
const pc = (x) => `${Math.round(x * 100)} %`;

const PHRASES = {
  stat: (e) => `ATQ ${e.atq ? `+${pc(e.atq)}` : ''}${e.atq && e.def ? ' et DÉF ' : e.def ? 'DÉF ' : ''}${e.def ? `+${pc(e.def)}` : ''} au début du tour`,
  ki: (e) => `Ki +${e.n} au début du tour`,
  sphere: (e) => `ATQ +${pc(e.atq)} par sphère de ki ramassée (10 au plus)`,
  surSuper: (e) => `ATQ +${pc(e.atq)} supplémentaires en lançant sa super attaque`,
  cumul: (e) => `${e.atq ? `ATQ +${pc(e.atq)}` : `DÉF +${pc(e.def)}`} à chaque ${e.quand === 'attaque' ? 'attaque lancée' : 'attaque reçue'}, jusqu’à ${pc(e.max)} (pour tout le combat)`,
  reduction: (e) => `Réduit les dégâts reçus de ${pc(e.taux)}`,
  garde: () => 'Garde contre toutes les attaques (dégâts réduits de moitié, sans désavantage d’élément)',
  contre: (e) => `Contre-attaque chaque coup ennemi (${e.mult >= 3 ? 'dégâts colossaux' : 'dégâts énormes'})`,
  esquive: (e) => `${pc(e.chance)} de chances d’esquiver`,
  apresEsquive: (e) => `Après une esquive, ATQ +${pc(e.atq)} pour l’attaque suivante`,
  critique: (e) => `${pc(e.chance)} de chances de coup critique (×1,6, ignore la DÉF)`,
  attAdd: (e) => `${pc(e.chance)} de chances de lancer une attaque additionnelle (qui peut devenir une super attaque)`,
  superAdd: (e) => `${pc(e.chance)} de chances de lancer une super attaque additionnelle`,
  soutien: (e) => `Ki +${e.ki} et ATQ +${pc(e.atq)} aux alliés de la rotation`,
  soin: (e) => `Rend ${pc(e.taux)} des PV de l’équipe au début du tour`,
  boss: (e) => `ATQ +${pc(e.atq)} contre un boss`,
  pvBas: (e) => `ATQ ${e.def ? 'et DÉF ' : ''}+${pc(e.atq)} quand les PV de l’équipe sont à 50 % ou moins`,
};

/** Le passif d'un personnage : { nom, effets, lignes, texte } (et ki, atq, def : le résumé pour l'affichage). */
export function creerPassif(x) {
  const n = NIV[x.rarete];
  const E = [];
  E.push({ t: 'stat', atq: [0.2, 0.4, 0.7, 1.0][n], def: [0.1, 0.3, 0.6, 0.9][n] });
  if (n >= 1) E.push({ t: 'ki', n: [0, 1, 2, 3][n] });
  const r = x.role;
  if (r === 'frappeur') {
    if (n >= 1) E.push({ t: 'sphere', atq: [0, 0.04, 0.06, 0.08][n] });
    if (n >= 2) E.push({ t: 'surSuper', atq: n >= 3 ? 0.4 : 0.25 });
    if (n >= 3) { E.push({ t: 'cumul', atq: 0.1, max: 0.6, quand: 'attaque' }); E.push({ t: 'attAdd', chance: 0.3 }); }
    if (n === 0) E.push({ t: 'surSuper', atq: 0.15 });
  } else if (r === 'mur') {
    E.push({ t: 'reduction', taux: [0.08, 0.15, 0.22, 0.3][n] });
    if (n >= 2) E.push({ t: 'cumul', def: 0.15, max: 0.9, quand: 'coup' });
    if (n >= 3) { E.push({ t: 'garde' }); E.push({ t: 'contre', mult: 3 }); }
  } else if (r === 'esquiveur') {
    E.push({ t: 'esquive', chance: [0.1, 0.18, 0.26, 0.36][n] });
    if (n >= 2) E.push({ t: 'apresEsquive', atq: n >= 3 ? 0.8 : 0.4 });
    if (n >= 3) E.push({ t: 'contre', mult: 2.4 });
  } else if (r === 'critique') {
    E.push({ t: 'critique', chance: [0.1, 0.2, 0.3, 0.45][n] });
    if (n >= 2) E.push({ t: 'sphere', atq: 0.05 });
    if (n >= 3) E.push({ t: 'pvBas', atq: 0.6, def: true });
  } else if (r === 'pivot') {
    E.push({ t: 'attAdd', chance: [0.15, 0.25, 0.35, 0.5][n] });
    if (n >= 2) E.push({ t: 'superAdd', chance: n >= 3 ? 0.35 : 0.2 });
    if (n >= 3) E.push({ t: 'cumul', atq: 0.08, max: 0.4, quand: 'attaque' });
  } else if (r === 'soutien') {
    E.push({ t: 'soutien', ki: [1, 1, 2, 3][n], atq: [0.1, 0.15, 0.25, 0.4][n] });
    if (n >= 2) E.push({ t: 'soin', taux: n >= 3 ? 0.07 : 0.04 });
    if (n >= 3) E.push({ t: 'reduction', taux: 0.15 });
  }
  if (n >= 2) E.push({ t: 'boss', atq: n >= 3 ? 0.5 : 0.3 });
  if (n >= 3 && r !== 'critique') E.push({ t: 'pvBas', atq: 0.4 });
  const NOMS = { frappeur: 'Puissance', mur: 'Rempart', esquiveur: 'Pas de l’ombre', critique: 'Œil du chasseur', pivot: 'Enchaînement', soutien: 'Âme protectrice' };
  const lignes = E.map((e) => PHRASES[e.t](e));
  const s = E.find((e) => e.t === 'stat');
  return {
    nom: `${NOMS[r] || 'Passif'}${n >= 3 ? ' suprême' : n >= 2 ? ' éveillée' : ''}`,
    effets: E, lignes, texte: lignes.join(' ; '),
    atq: s.atq, def: s.def, ki: E.find((e) => e.t === 'ki')?.n || 0,
  };
}

/** La compétence de chef : les catégories renforcées (PV, ATQ, DÉF + taux ; ki en plus pour les plus rares). */
export function creerChef(x, cats) {
  const n = NIV[x.rarete];
  const c = cats && cats.length ? cats : [x.categories[0]];
  const taux = [0.2, 0.4, 0.7, 1.0][n], ki = [0, 1, 2, 3][n];
  return { cats: c, taux, ki, autres: taux * 0.3 };
}
export const texteChef = (chef, CATEGORIES) => `Catégorie${chef.cats.length > 1 ? 's' : ''} « ${chef.cats.map((k) => CATEGORIES[k]).join(' » ou « ')} » : ${chef.ki ? `Ki +${chef.ki}, ` : ''}PV, ATQ et DÉF +${pc(chef.taux)} (les autres +${pc(chef.autres)})`;

/** La super attaque : sa puissance (1 à 5), son effet selon le rôle ; l'ultime pour un LR. */
export function creerSuper(x, nom, style, puissance) {
  const mult = [0, 2.4, 3.0, 3.6, 4.1, 4.6][puissance];
  const degats = puissance >= 5 ? 'extrêmes' : puissance >= 4 ? 'immenses' : puissance >= 3 ? 'colossaux' : 'énormes';
  const EFFETS = {
    frappeur: { atqCumul: 0.3, texte: 'augmente l’ATQ (cumulable)' },
    mur: { defTour: 0.6, texte: 'augmente beaucoup la DÉF pour ce tour' },
    esquiveur: { esquiveTour: 0.25, texte: 'augmente les chances d’esquive pour ce tour' },
    critique: { defBaisse: 0.3, texte: 'baisse la DÉF de l’ennemi' },
    pivot: { atqTour: 0.5, texte: 'augmente l’ATQ pour ce tour' },
    soutien: { kiAllies: 2, texte: 'Ki +2 aux alliés' },
  };
  const ef = EFFETS[x.role] || EFFETS.frappeur;
  const s = { nom, style, mult, puissance, ...ef, texte: `Dégâts ${degats}, ${ef.texte}` };
  if (x.rarete === 'LR') s.ultime = { nom: `${nom} · Ultime`, mult: mult + 0.9, texte: 'Dégâts suprêmes, augmente beaucoup l’ATQ (cumulable)' };
  return s;
}
