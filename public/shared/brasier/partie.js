/**
 * BRASIER — le moteur de partie.
 *
 * Module ISO : il fait tourner une table de huit, qu'elle soit peuplée de
 * joueurs ou de bots — les deux passent par les mêmes actions, validées de la
 * même manière. Un bot ne triche pas : il n'a pas d'autre porte d'entrée.
 *
 * Une partie :
 *   1. chacun choisit son héros parmi trois ;
 *   2. RECRUTEMENT — de l'or, une taverne, une MAIN de dix cartes et un
 *      plateau de sept places : on achète dans sa main, puis on pose sur le
 *      plateau quand on veut ;
 *   3. COMBAT — les survivants s'affrontent deux à deux, le perdant saigne ;
 *   4. on recommence, jusqu'à ce qu'il n'en reste qu'un.
 *
 * La réserve de serviteurs est COMMUNE à la table : ce qu'un joueur achète,
 * les autres ne le trouveront plus. C'est ce qui rend un triple disputé.
 */

import {
  RECRUTABLES, COPIES, getServiteur, creer, effetDe, aMot, deTribu, horsReserve,
} from './serviteurs.js';
import { HEROS, getHeros, PV_HEROS } from './heros.js';
import { simulerCombat, PLATEAU_MAX } from './combat.js';
import {
  tirerMode, tirerAnomalies, offreQuetes, getQuete, getSort, TOUR_QUETE, TRIBUS_HONNEUR,
} from './modes.js';
import { makeRng, entier, melanger, piocher } from '../hasard.js';

export { PLATEAU_MAX };
export const JOUEURS = 8;
/** La main : ce qu'on a acheté mais pas encore posé. */
export const MAIN_MAX = 10;

export const PHASE = {
  HEROS: 'heros',
  RECRUTEMENT: 'recrutement',
  COMBAT: 'combat',
  FIN: 'fin',
};

export const COUT_SERVITEUR = 3;
export const PRIX_VENTE = 1;
export const COUT_RAFRAICHIR = 1;
export const OR_MAX = 10;
/** Coût de passage au rang donné, avant les rabais d'un tour sur l'autre. */
export const COUT_RANG = { 2: 5, 3: 7, 4: 8, 5: 9, 6: 10 };
/** Nombre de serviteurs proposés par la taverne, selon son rang. */
export const TAILLE_TAVERNE = { 1: 3, 2: 4, 3: 4, 4: 5, 5: 5, 6: 6 };
export const CHOIX_HEROS = 3;

/** Temps de recrutement en secondes : il grandit avec les décisions à prendre. */
export const dureeRecrutement = (tour) => Math.min(65, 30 + 4 * tour);
export const DUREE_CHOIX_HEROS = 25;

/**
 * Plafond des dégâts d'un combat. Sans lui, un mauvais tirage au troisième
 * tour pourrait éliminer un joueur avant qu'il ait vraiment joué.
 */
export const plafondDegats = (tour) => (tour <= 3 ? 5 : tour <= 7 ? 10 : 15);

/** Au-delà, la partie s'arrête aux points de vie : aucune table ne dure toujours. */
export const TOUR_MAX = 40;

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

/**
 * @param {Array<{id:string, name:string, isBot?:boolean}>} joueurs
 * @param {{seed?:number, mode?:'classique'|'quete'|'anomalie'|'hasard', anomalies?:string[]}} [o]
 *   `mode` : classique par défaut ; « hasard » le tire au sort (le serveur).
 *   Une partie n'a qu'un genre : jamais quête ET anomalie.
 */
export function creerPartie(joueurs, o = {}) {
  if (joueurs.length < 2 || joueurs.length > JOUEURS) {
    throw new Error(`il faut de 2 à ${JOUEURS} joueurs`);
  }
  const seed = o.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);
  const mode = o.mode === 'hasard' ? tirerMode(rng)
    : ['quete', 'anomalie'].includes(o.mode) ? o.mode : 'classique';
  const anomalies = mode === 'anomalie' ? (o.anomalies?.length ? [...o.anomalies] : tirerAnomalies(rng)) : [];
  const tribuHonneur = anomalies.includes('tribu-honneur') ? piocher(TRIBUS_HONNEUR, rng) : null;
  const pvDepart = anomalies.includes('sang-royal') ? 40 : PV_HEROS;

  const reserve = {};
  for (const s of RECRUTABLES) reserve[s.id] = COPIES[s.tier];

  // Les offres de héros se tirent d'un paquet mélangé, rebattu quand il est
  // vide : deux joueurs peuvent se voir proposer le même, jamais trois fois
  // le même au même joueur.
  let paquet = [];
  const offre = () => {
    const out = [];
    while (out.length < CHOIX_HEROS) {
      if (!paquet.length) paquet = melanger(HEROS.map((h) => h.id), rng);
      const id = paquet.pop();
      if (!out.includes(id)) out.push(id);
    }
    return out;
  };

  return {
    seed,
    rng,
    mode,
    anomalies,
    tribuHonneur,
    uid: 0,
    tour: 0,
    phase: PHASE.HEROS,
    reserve,
    joueurs: joueurs.map((j) => ({
      id: j.id,
      name: j.name,
      isBot: !!j.isBot,
      heros: null,
      offre: offre(),
      pv: pvDepart,
      or: 0,
      orQuete: 0,
      quete: null,
      offreQuete: null,
      sorts: [],
      orMax: 0,
      orBonus: 0,
      taverne: 1,
      coutRang: COUT_RANG[2],
      boutique: [],
      gel: false,
      plateau: [],
      main: [],
      decouvertes: [],
      pouvoirUtilise: false,
      rafraichiGratuit: false,
      pret: false,
      mort: false,
      place: null,
      dernierAdversaire: null,
      triples: 0,
      resultat: null,
    })),
    combats: [],
    fantome: null,
    vainqueur: null,
  };
}

export const joueurDe = (etat, id) => etat.joueurs.find((j) => j.id === id) || null;
export const vivants = (etat) => etat.joueurs.filter((j) => !j.mort);
const nouvelUid = (etat) => `u${++etat.uid}`;
/** Cette anomalie est-elle en jeu ? */
export const anomalie = (etat, id) => !!etat.anomalies && etat.anomalies.includes(id);

/** Ce que coûte, pour ce joueur, de monter la taverne. */
export const coutAmelioration = (etat, j) =>
  Math.max(0, j.coutRang - (anomalie(etat, 'rangs-soldes') ? 1 : 0));

/** Ce que coûte le pouvoir héroïque (null pour un passif). */
export function coutPouvoir(etat, j) {
  const p = getHeros(j.heros)?.pouvoir;
  if (!p || p.passif) return null;
  return Math.max(0, p.cout - (anomalie(etat, 'heros-inspires') ? 1 : 0));
}

/* ------------------------------------------------------------------ */
/* La réserve                                                          */
/* ------------------------------------------------------------------ */

/** Tire un serviteur de rang ≤ `rang`, pondéré par les exemplaires restants. */
function tirer(etat, rang, exact = false) {
  let total = 0;
  for (const s of RECRUTABLES) {
    if ((exact ? s.tier === rang : s.tier <= rang)) total += etat.reserve[s.id];
  }
  if (total <= 0) return null;
  let x = entier(etat.rng, total);
  for (const s of RECRUTABLES) {
    if (!(exact ? s.tier === rang : s.tier <= rang)) continue;
    x -= etat.reserve[s.id];
    if (x < 0) {
      etat.reserve[s.id]--;
      const u = creer(s.id, nouvelUid(etat));
      // Anomalie : la tribu à l'honneur arrive plus forte.
      if (etat.tribuHonneur && deTribu(s.id, etat.tribuHonneur)) { u.atk += 1; u.pv += 1; }
      return u;
    }
  }
  return null;
}

/** Remet un serviteur dans la réserve. Un doré y rend ses trois exemplaires. */
function rendre(etat, u) {
  if (horsReserve(u.id)) return;
  etat.reserve[u.id] += u.dore ? 3 : 1;
}

function renouveler(etat, j) {
  for (const u of j.boutique) rendre(etat, u);
  j.boutique = [];
  const taille = TAILLE_TAVERNE[j.taverne] + (anomalie(etat, 'taverne-bondee') ? 1 : 0);
  for (let k = 0; k < taille; k++) {
    const u = tirer(etat, j.taverne);
    if (u) j.boutique.push(u);
  }
}

/** Trois serviteurs différents du rang voulu, pour une découverte. */
function offreDecouverte(etat, rang) {
  const out = [];
  for (let r = rang; r >= 1 && out.length < 3; r--) {
    for (let essai = 0; essai < 20 && out.length < 3; essai++) {
      const u = tirer(etat, r, true);
      if (!u) break;
      if (out.some((x) => x.id === u.id)) { rendre(etat, u); continue; }
      out.push(u);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Déroulement                                                         */
/* ------------------------------------------------------------------ */

export function choisirHeros(etat, id, herosId) {
  if (etat.phase !== PHASE.HEROS) return { ok: false, error: 'phase' };
  const j = joueurDe(etat, id);
  if (!j) return { ok: false, error: 'joueur inconnu' };
  if (!j.offre.includes(herosId)) return { ok: false, error: 'héros non proposé' };
  j.heros = herosId;
  return { ok: true };
}

export const herosTousChoisis = (etat) => etat.joueurs.every((j) => j.heros);

/** Fin du choix des héros : les indécis prennent le premier proposé. */
export function commencer(etat) {
  if (etat.phase !== PHASE.HEROS) return { ok: false, error: 'phase' };
  for (const j of etat.joueurs) if (!j.heros) j.heros = j.offre[0];
  debutTour(etat);
  return { ok: true };
}

function debutTour(etat) {
  etat.tour += 1;
  etat.phase = PHASE.RECRUTEMENT;
  for (const j of vivants(etat)) {
    j.orMax = Math.min(OR_MAX, 2 + etat.tour);
    j.or = j.orMax + j.orBonus + j.orQuete + (anomalie(etat, 'ruee-or') ? 1 : 0);
    j.orBonus = 0;
    if (etat.tour > 1 && j.taverne < 6) j.coutRang = Math.max(0, j.coutRang - 1);
    j.pouvoirUtilise = false;
    j.rafraichiGratuit = getHeros(j.heros)?.pouvoir.type === 'rafraichiGratuit';
    j.pret = false;
    if (j.gel) j.gel = false;
    else renouveler(etat, j);
    // Partie QUÊTE : au tour 3, trois quêtes au choix.
    if (etat.mode === 'quete' && etat.tour === TOUR_QUETE && !j.quete) j.offreQuete = offreQuetes(etat.rng);
    // Anomalie : les coffres oubliés s'ouvrent au tour 5.
    if (anomalie(etat, 'coffres') && etat.tour === 5) {
      const offre = offreDecouverte(etat, Math.min(j.taverne + 1, 6));
      if (offre.length) j.decouvertes.push(offre);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Les quêtes                                                          */
/* ------------------------------------------------------------------ */

/** Une quête avance : achat, vente, combat gagné… La récompense tombe dès qu'elle est faite. */
function progresser(etat, j, cle, n = 1) {
  const q = j.quete;
  if (!q || q.faite) return;
  const def = getQuete(q.id);
  if (def.cle !== cle) return;
  q.progres = Math.min(def.n, q.progres + n);
  if (q.progres >= def.n) recompenser(etat, j);
}

/** Les quêtes « d'état » se mesurent : le plus de serviteurs d'une même tribu sur le plateau. */
function mesurerQuete(etat, j) {
  const q = j.quete;
  if (!q || q.faite || getQuete(q.id).cle !== 'tribu') return;
  let mieux = 0;
  for (const t of TRIBUS_HONNEUR) mieux = Math.max(mieux, j.plateau.filter((u) => deTribu(u.id, t)).length);
  if (mieux > q.progres) progresser(etat, j, 'tribu', mieux - q.progres);
}

function recompenser(etat, j) {
  const q = j.quete;
  q.faite = true;
  const r = q.recompense;
  if (r.type === 'serviteur') {
    // Un exclusif arrive dans la main — même pleine : on l'a mérité.
    j.main.push(creer(r.id, nouvelUid(etat)));
  } else if (r.type === 'cartes') {
    for (const id of r.sorts) j.sorts.push({ uid: nouvelUid(etat), id });
  } else if (r.type === 'or') {
    if (r.parTour) j.orQuete += r.parTour;
    if (r.tout) {
      if (etat.phase === PHASE.RECRUTEMENT) j.or += r.tout;
      else j.orBonus += r.tout;
    }
  }
}

/** Lance une carte spéciale. Gratuite ; certaines demandent un plateau. */
function lancer(etat, j, i) {
  const c = j.sorts[i];
  if (!c) return refus('introuvable');
  const def = getSort(c.id);
  if (def.plateau && !j.plateau.length) return refus('aucune cible');
  switch (c.id) {
    case 'benediction':
      for (const u of j.plateau) { u.atk += 2; u.pv += 2; }
      break;
    case 'pluie-or':
      j.or += 4;
      break;
    case 'dorure': {
      const u = j.plateau[0];
      u.atk *= 2; u.pv *= 2;
      break;
    }
    case 'egide':
      for (const u of melanger(j.plateau.filter((x) => !aMot(x, 'bouclier')), etat.rng).slice(0, 3)) u.mots.push('bouclier');
      break;
    case 'souffle-vie':
      for (const u of melanger(j.plateau.filter((x) => !aMot(x, 'reincarnation')), etat.rng).slice(0, 2)) u.mots.push('reincarnation');
      break;
    case 'grimoire': {
      const offre = offreDecouverte(etat, Math.min(j.taverne + 1, 6));
      if (!offre.length) return refus('réserve vide');
      j.decouvertes.push(offre);
      break;
    }
    default:
      return refus('sort');
  }
  j.sorts.splice(i, 1);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Effets en recrutement                                               */
/* ------------------------------------------------------------------ */

function viser(etat, j, source, e) {
  const allies = j.plateau.filter((x) => x !== source);
  const deLaTribu = allies.filter((x) => deTribu(x.id, e.tribu));
  switch (e.cible) {
    case 'soi': return [source];
    case 'gauche': return j.plateau.slice(0, 1);
    case 'aleatoire': return allies.length ? [piocher(allies, etat.rng)] : [];
    case 'tribu': return deLaTribu;
    case 'tribu1': return deLaTribu.length ? [piocher(deLaTribu, etat.rng)] : [];
    case 'autres': return allies;
    default: return [];
  }
}

function appliquer(etat, j, source, e) {
  switch (e.type) {
    case 'buff':
      for (const t of viser(etat, j, source, e)) { t.atk += e.atk; t.pv += e.pv; }
      break;
    case 'mot':
      for (const t of viser(etat, j, source, e)) if (!aMot(t, e.mot)) t.mots.push(e.mot);
      break;
    case 'invoque': {
      const pos = j.plateau.indexOf(source) + 1;
      for (let k = 0; k < e.n && j.plateau.length < PLATEAU_MAX; k++) {
        j.plateau.splice(pos + k, 0, creer(e.id, nouvelUid(etat)));
      }
      break;
    }
    case 'blesseHeros':
      // Un cri ne tue jamais son propre héros : il le laisse à un souffle.
      j.pv = Math.max(1, j.pv - e.n);
      break;
    case 'taverne':
      for (const t of j.boutique) { t.atk += e.atk; t.pv += e.pv; }
      break;
    default: break;
  }
}

/**
 * Trois exemplaires identiques — dans la main ou sur le plateau, peu importe —
 * fusionnent en un doré, qui garde tout ce que les trois avaient gagné en
 * route. Le doré arrive dans la main ; quand on le pose, il rapporte une
 * découverte d'un rang au-dessus de la taverne.
 */
function verifierTriples(etat, j) {
  for (;;) {
    const compte = {};
    for (const u of [...j.main, ...j.plateau]) {
      if (!u.dore && !horsReserve(u.id)) compte[u.id] = (compte[u.id] || 0) + 1;
    }
    const id = Object.keys(compte).find((k) => compte[k] >= 3);
    if (!id) return;
    const def = getServiteur(id);
    // Ceux de la main d'abord : ce sont eux qui n'ont encore rien fait.
    const trois = [...j.main, ...j.plateau].filter((u) => u.id === id && !u.dore).slice(0, 3);
    const dore = {
      uid: nouvelUid(etat),
      id,
      atk: trois.reduce((s, u) => s + u.atk, 0) - def.atk,
      pv: trois.reduce((s, u) => s + u.pv, 0) - def.pv,
      mots: [...new Set(trois.flatMap((u) => u.mots))],
      dore: true,
      recompense: true,
    };
    j.main = j.main.filter((u) => !trois.includes(u));
    j.plateau = j.plateau.filter((u) => !trois.includes(u));
    j.main.push(dore);
    j.triples += 1;
    progresser(etat, j, 'triple');
  }
}

/** Une carte arrive dans la main (achat, découverte) : triple éventuel. */
function prendre(etat, j, u) {
  j.main.push(u);
  verifierTriples(etat, j);
}

/** Pose un serviteur sur le plateau : cri, récompense de triple, puis triple éventuel. */
function poser(etat, j, u, pos = j.plateau.length) {
  j.plateau.splice(Math.max(0, Math.min(pos, j.plateau.length)), 0, u);
  if (u.recompense) {
    delete u.recompense;
    const offre = offreDecouverte(etat, Math.min(j.taverne + 1, 6));
    if (offre.length) j.decouvertes.push(offre);
  }
  // Ceux qui grandissent quand on pose un autre serviteur (les Élémentaires).
  for (const x of j.plateau) {
    if (x === u) continue;
    const e = effetDe(x, 'allieJoue');
    if (e && (!e.tribu || deTribu(u.id, e.tribu))) { x.atk += e.atk; x.pv += e.pv; }
  }
  const cri = effetDe(u, 'cri');
  if (cri) { appliquer(etat, j, u, cri); progresser(etat, j, 'cri'); }
  verifierTriples(etat, j);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const refus = (error) => ({ ok: false, error });

/**
 * Point d'entrée unique des intentions, humaines comme robotiques.
 *
 * @param {{type:string, i?:number, de?:number, vers?:number, valeur?:boolean}} a
 */
export function agir(etat, id, a) {
  if (etat.phase !== PHASE.RECRUTEMENT) return refus('phase');
  const j = joueurDe(etat, id);
  if (!j || j.mort) return refus('joueur');
  const r = action(etat, j, a);
  if (r.ok) mesurerQuete(etat, j);
  return r;
}

function action(etat, j, a) {
  const i = Number.isInteger(a?.i) ? a.i : -1;

  switch (a?.type) {
    case 'acheter': {
      const u = j.boutique[i];
      if (!u) return refus('introuvable');
      if (j.or < COUT_SERVITEUR) return refus('or');
      if (j.main.length >= MAIN_MAX) return refus('main');
      j.boutique.splice(i, 1);
      j.or -= COUT_SERVITEUR;
      progresser(etat, j, 'achat');
      progresser(etat, j, 'or', COUT_SERVITEUR);
      prendre(etat, j, u);
      return { ok: true };
    }

    case 'jouer': {
      const u = j.main[i];
      if (!u) return refus('introuvable');
      if (j.plateau.length >= PLATEAU_MAX) return refus('plein');
      j.main.splice(i, 1);
      poser(etat, j, u, Number.isInteger(a.vers) ? a.vers : j.plateau.length);
      return { ok: true };
    }

    case 'vendreMain': {
      const u = j.main[i];
      if (!u) return refus('introuvable');
      j.main.splice(i, 1);
      j.or += PRIX_VENTE;
      rendre(etat, u);
      progresser(etat, j, 'vente');
      return { ok: true };
    }

    case 'vendre': {
      const u = j.plateau[i];
      if (!u) return refus('introuvable');
      j.plateau.splice(i, 1);
      j.or += PRIX_VENTE;
      rendre(etat, u);
      progresser(etat, j, 'vente');
      return { ok: true };
    }

    case 'deplacer': {
      const de = a.de, vers = a.vers;
      if (!Number.isInteger(de) || !Number.isInteger(vers)) return refus('position');
      if (de < 0 || de >= j.plateau.length || vers < 0 || vers >= j.plateau.length) return refus('position');
      const [u] = j.plateau.splice(de, 1);
      j.plateau.splice(vers, 0, u);
      return { ok: true };
    }

    case 'rafraichir': {
      const cout = j.rafraichiGratuit ? 0 : COUT_RAFRAICHIR;
      if (j.or < cout) return refus('or');
      j.or -= cout;
      j.rafraichiGratuit = false;
      j.gel = false;
      renouveler(etat, j);
      progresser(etat, j, 'rafraichir');
      progresser(etat, j, 'or', cout);
      return { ok: true };
    }

    case 'geler':
      j.gel = !j.gel;
      return { ok: true };

    case 'ameliorer': {
      if (j.taverne >= 6) return refus('max');
      const cout = coutAmelioration(etat, j);
      if (j.or < cout) return refus('or');
      j.or -= cout;
      j.taverne += 1;
      j.coutRang = COUT_RANG[j.taverne + 1] ?? 0;
      progresser(etat, j, 'ameliorer');
      progresser(etat, j, 'or', cout);
      return { ok: true };
    }

    case 'pouvoir':
      return pouvoir(etat, j);

    case 'decouvrir': {
      const offre = j.decouvertes[0];
      if (!offre || !offre[i]) return refus('introuvable');
      if (j.main.length >= MAIN_MAX) return refus('main');
      const u = offre[i];
      for (const x of offre) if (x !== u) rendre(etat, x);
      j.decouvertes.shift();
      prendre(etat, j, u);
      return { ok: true };
    }

    case 'quete': {
      const offre = j.offreQuete;
      if (!offre || !offre[i]) return refus('introuvable');
      j.quete = { id: offre[i].id, recompense: offre[i].recompense, progres: 0, faite: false };
      j.offreQuete = null;
      return { ok: true };
    }

    case 'lancer':
      return lancer(etat, j, i);

    case 'pret':
      j.pret = typeof a.valeur === 'boolean' ? a.valeur : !j.pret;
      return { ok: true };

    default:
      return refus('action');
  }
}

function pouvoir(etat, j) {
  const p = getHeros(j.heros)?.pouvoir;
  if (!p) return refus('héros');
  if (p.passif) return refus('passif');
  if (j.pouvoirUtilise) return refus('déjà utilisé');
  const cout = coutPouvoir(etat, j);
  if (j.or < cout) return refus('or');

  const gauche = j.plateau[0];
  const droite = j.plateau[j.plateau.length - 1];
  switch (p.type) {
    case 'renfortProvoc': {
      if (!j.plateau.length) return refus('aucune cible');
      const t = piocher(j.plateau, etat.rng);
      t.atk += 1; t.pv += 1;
      if (!aMot(t, 'provocation')) t.mots.push('provocation');
      break;
    }
    case 'attaqueDroite':
      if (!droite) return refus('aucune cible');
      droite.atk += 2;
      break;
    case 'placement':
      j.orBonus += 2;
      break;
    case 'forgeRouages': {
      const rouages = j.plateau.filter((u) => deTribu(u.id, 'rouage'));
      if (!rouages.length) return refus('aucune cible');
      for (const u of rouages) u.atk += 2;
      break;
    }
    case 'reincarneGauche':
      if (!gauche) return refus('aucune cible');
      if (aMot(gauche, 'reincarnation')) return refus('déjà');
      gauche.mots.push('reincarnation');
      break;
    case 'bouclierGauche':
      if (!gauche) return refus('aucune cible');
      if (aMot(gauche, 'bouclier')) return refus('déjà');
      gauche.mots.push('bouclier');
      break;
    case 'invoqueChaton':
      if (j.plateau.length >= PLATEAU_MAX) return refus('plein');
      j.plateau.push(creer('chaton', nouvelUid(etat)));
      break;
    case 'decouverte': {
      const offre = offreDecouverte(etat, j.taverne);
      if (!offre.length) return refus('réserve vide');
      j.decouvertes.push(offre);
      break;
    }
    case 'souffleTaverne':
      if (!j.boutique.length) return refus('aucune cible');
      for (const u of j.boutique) { u.atk += 1; u.pv += 1; }
      break;
    default:
      return refus('pouvoir');
  }
  j.or -= cout;
  progresser(etat, j, 'or', cout);
  j.pouvoirUtilise = true;
  return { ok: true };
}

/** Tous les humains encore en vie ont-ils cliqué « Prêt » ? */
export const humainsPrets = (etat) =>
  vivants(etat).filter((j) => !j.isBot).every((j) => j.pret);

/* ------------------------------------------------------------------ */
/* Combats                                                             */
/* ------------------------------------------------------------------ */

/**
 * Clôt le recrutement : les découvertes en suspens se règlent d'office, les
 * effets de fin de tour s'appliquent, puis les combats se jouent.
 */
export function terminerRecrutement(etat) {
  if (etat.phase !== PHASE.RECRUTEMENT) return { ok: false, error: 'phase' };
  for (const j of vivants(etat)) {
    // Une quête offerte et pas choisie : la première, d'office.
    if (j.offreQuete) action(etat, j, { type: 'quete', i: 0 });
    while (j.decouvertes.length) {
      const offre = j.decouvertes.shift();
      if (j.main.length < MAIN_MAX) {
        prendre(etat, j, offre[0]);
        for (const x of offre.slice(1)) rendre(etat, x);
      } else {
        for (const x of offre) rendre(etat, x);
      }
    }
    // Thadéus : ce qu'on garde en main nourrit le serviteur de gauche.
    if (getHeros(j.heros)?.pouvoir.type === 'collection' && j.plateau[0]) {
      const k = Math.min(3, j.main.length);
      j.plateau[0].atk += k; j.plateau[0].pv += k;
    }
    for (const u of [...j.plateau]) {
      const e = effetDe(u, 'fin');
      if (e && j.plateau.includes(u)) appliquer(etat, j, u, e);
    }
    mesurerQuete(etat, j);
  }
  lancerCombats(etat);
  return { ok: true };
}

/** Le plateau qui part au combat : une copie, avec les passifs de héros et les anomalies. */
function preparer(j, etat) {
  const p = j.plateau.map((u) => ({ ...u, mots: [...u.mots] }));
  if (getHeros(j.heros)?.pouvoir.type === 'colosse' && p[0]) {
    p[0].atk += 2; p[0].pv += 2;
  }
  if (etat && anomalie(etat, 'aube') && p[0] && !aMot(p[0], 'bouclier')) p[0].mots.push('bouclier');
  return p;
}

/**
 * Appariements : on évite de rejouer le même adversaire qu'au tour
 * précédent quand c'est possible. Un nombre impair laisse quelqu'un face au
 * fantôme du dernier éliminé — ou, à défaut, au reflet d'un autre plateau.
 */
function apparier(etat, liste) {
  let meilleur = null;
  let moinsDeRedites = Infinity;
  for (let essai = 0; essai < 24; essai++) {
    const m = melanger([...liste], etat.rng);
    const paires = [];
    for (let k = 0; k + 1 < m.length; k += 2) paires.push([m[k], m[k + 1]]);
    if (m.length % 2) paires.push([m[m.length - 1], null]);
    const redites = paires.filter(([a, b]) => b && a.dernierAdversaire === b.id).length;
    if (redites < moinsDeRedites) { meilleur = paires; moinsDeRedites = redites; }
    if (!redites) break;
  }
  return meilleur || [];
}

function lancerCombats(etat) {
  const encore = vivants(etat);
  const paires = apparier(etat, encore);
  etat.combats = [];

  for (const [A, B] of paires) {
    let adverse;
    let fantome = null;
    if (B) {
      adverse = { plateau: preparer(B, etat), taverne: B.taverne };
    } else {
      const reflet = etat.fantome
        || (() => {
          const autre = piocher(encore.filter((x) => x !== A), etat.rng) || A;
          return { name: `Reflet de ${autre.name}`, heros: autre.heros, plateau: preparer(autre, etat), taverne: autre.taverne };
        })();
      fantome = { name: reflet.name, heros: reflet.heros };
      adverse = { plateau: reflet.plateau.map((u) => ({ ...u, mots: [...u.mots] })), taverne: reflet.taverne };
    }

    const r = simulerCombat([preparer(A, etat), adverse.plateau], { rng: etat.rng });
    let degats = 0;
    if (r.gagnant !== null) {
      const rang = r.gagnant === 0 ? A.taverne : adverse.taverne;
      const etoiles = r.survivants.reduce((s, u) => s + getServiteur(u.id).tier, 0);
      degats = Math.min(rang + etoiles, plafondDegats(etat.tour));
      if (anomalie(etat, 'sang-chaud')) degats += 3;
    }
    if (r.gagnant === 1) A.pv -= degats;
    if (r.gagnant === 0 && B) B.pv -= degats;

    if (r.gagnant === 0) progresser(etat, A, 'victoire');
    if (r.gagnant === 1 && B) progresser(etat, B, 'victoire');
    A.resultat = r.gagnant === 0 ? 'victoire' : r.gagnant === 1 ? 'defaite' : 'nul';
    if (B) {
      B.resultat = r.gagnant === 1 ? 'victoire' : r.gagnant === 0 ? 'defaite' : 'nul';
      A.dernierAdversaire = B.id;
      B.dernierAdversaire = A.id;
    }
    etat.combats.push({
      a: A.id, b: B ? B.id : null, fantome, events: r.events, gagnant: r.gagnant, degats,
    });
  }

  // Les éliminés du tour : le plus bas en PV prend la plus mauvaise place.
  const tombes = encore.filter((j) => j.pv <= 0).sort((x, y) => x.pv - y.pv);
  let place = encore.length;
  for (const j of tombes) {
    j.mort = true;
    j.place = place--;
    etat.fantome = { name: `Fantôme de ${j.name}`, heros: j.heros, plateau: preparer(j, etat), taverne: j.taverne };
    for (const u of [...j.plateau, ...j.main, ...j.boutique]) rendre(etat, u);
    for (const offre of j.decouvertes) for (const u of offre) rendre(etat, u);
    j.plateau = []; j.main = []; j.boutique = []; j.decouvertes = []; j.sorts = []; j.offreQuete = null;
  }

  etat.phase = PHASE.COMBAT;
}

/** Après la rediffusion des combats : tour suivant, ou fin de partie. */
export function finirCombats(etat) {
  if (etat.phase !== PHASE.COMBAT) return { ok: false, error: 'phase' };
  const restants = vivants(etat);
  if (restants.length <= 1 || etat.tour >= TOUR_MAX) {
    // Au-delà du tour maximal, les PV départagent.
    const ordre = [...restants].sort((a, b) => b.pv - a.pv);
    ordre.forEach((j, k) => { j.place = k + 1; if (k > 0) j.mort = true; });
    etat.vainqueur = ordre[0] ? ordre[0].id : null;
    etat.phase = PHASE.FIN;
    return { ok: true, fini: true };
  }
  debutTour(etat);
  return { ok: true, fini: false };
}

/* ------------------------------------------------------------------ */
/* Vue                                                                 */
/* ------------------------------------------------------------------ */

const copie = (u) => ({ uid: u.uid, id: u.id, atk: u.atk, pv: u.pv, mots: [...u.mots], dore: !!u.dore, recompense: !!u.recompense });

/** Tribu la plus représentée d'un plateau : l'information qui se voit de loin. */
export function tribuDominante(plateau) {
  const n = {};
  for (const u of plateau) {
    const t = getServiteur(u.id).tribu;
    if (t !== 'neutre' && t !== 'tous') n[t] = (n[t] || 0) + 1;
  }
  const [t] = Object.entries(n).sort((a, b) => b[1] - a[1])[0] || [null];
  return t;
}

/**
 * Ce qu'un joueur a le droit de voir : tout de lui-même ; des autres, leur
 * héros, leurs PV, leur rang de taverne et leur tribu — jamais leur taverne
 * ni leur plateau pendant le recrutement. Le plateau adverse ne se découvre
 * qu'au combat.
 */
export function viewFor(etat, id) {
  const j = joueurDe(etat, id);
  const combat = etat.phase === PHASE.COMBAT && j
    ? etat.combats.find((c) => c.a === id || c.b === id) || null : null;

  let monCombat = null;
  if (combat) {
    const camp = combat.a === id ? 0 : 1;
    const autreId = camp === 0 ? combat.b : combat.a;
    const autre = autreId ? joueurDe(etat, autreId) : null;
    monCombat = {
      camp,
      adversaire: autre
        ? { id: autre.id, name: autre.name, heros: autre.heros }
        : { id: null, name: combat.fantome.name, heros: combat.fantome.heros },
      events: combat.events,
      gagnant: combat.gagnant,
      degats: combat.degats,
    };
  }

  return {
    phase: etat.phase,
    tour: etat.tour,
    vainqueur: etat.vainqueur,
    mode: etat.mode || 'classique',
    anomalies: etat.anomalies || [],
    tribuHonneur: etat.tribuHonneur || null,
    moi: j ? {
      id: j.id,
      heros: j.heros,
      offre: etat.phase === PHASE.HEROS ? j.offre : null,
      pv: j.pv,
      or: j.or,
      orMax: j.orMax,
      orBonus: j.orBonus,
      taverne: j.taverne,
      coutRang: coutAmelioration(etat, j),
      coutPouvoir: coutPouvoir(etat, j),
      orQuete: j.orQuete,
      quete: j.quete ? { ...j.quete } : null,
      offreQuete: j.offreQuete,
      sorts: j.sorts.map((c) => ({ ...c })),
      boutique: j.boutique.map(copie),
      gel: j.gel,
      plateau: j.plateau.map(copie),
      main: j.main.map(copie),
      decouverte: j.decouvertes[0] ? j.decouvertes[0].map(copie) : null,
      pouvoirUtilise: j.pouvoirUtilise,
      rafraichiGratuit: j.rafraichiGratuit,
      pret: j.pret,
      mort: j.mort,
      place: j.place,
    } : null,
    joueurs: etat.joueurs.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      heros: p.heros,
      aChoisi: !!p.heros,
      pv: p.pv,
      taverne: p.taverne,
      mort: p.mort,
      place: p.place,
      pret: p.pret,
      triples: p.triples,
      queteFaite: !!(p.quete && p.quete.faite),
      resultat: p.resultat,
      tribu: tribuDominante(p.plateau),
    })),
    combat: monCombat,
    combats: etat.phase === PHASE.COMBAT
      ? etat.combats.map((c) => ({ a: c.a, b: c.b, gagnant: c.gagnant, degats: c.degats }))
      : [],
  };
}
