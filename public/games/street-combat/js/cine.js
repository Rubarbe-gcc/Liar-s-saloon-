/**
 * STREET COMBAT — les cinématiques : une scène qui bouge (l'arène, les
 * combattants qui entrent, sautent, apparaissent, des effets), des
 * dialogues avec portrait et texte qui s'écrit, des cartons de chapitre,
 * des choix.
 *
 * Une cinématique est une liste d'étapes, jouées l'une après l'autre :
 *   { decor: 'dojo', fondu }                            change l'arène (fondu : au noir, la scène se vide)
 *   { vide: true }                                      tout le monde sort, d'un coup
 *   { titre: 'CHAPITRE 1', sous: '…', sur: '…' }        un carton
 *   { lieu: 'NÉON CITY — 23 h 47' }                     le lieu, en haut à gauche (sans attendre)
 *   { narre: '…' }                                      une voix off
 *   { entre: 'hero'|id, cote: 'g'|'d'|'c'|'gg'|'dd', comment: 'marche'|'saut'|'chute'|'apparait'|'teleport'|'place', p, ombre, corrompu }
 *   { dit: 'hero'|id, texte: '…', p, nom, ombre }       une réplique (nom : « ??? » pour un inconnu)
 *   { pose: 'hero'|id, p: 'garde' }                     change une pose
 *   { devoile: id }                                     une silhouette se révèle
 *   { purifie: id }                                     l'éclat de la Fracture sort de lui : il redevient lui-même
 *   { effet: 'fracture'|'eclair'|'flash'|'secousse'|'gel'|'aube'|'nuit', duree }
 *   { sort: 'hero'|id, comment: 'teleport'|'marche' }  quelqu'un s'en va
 *   { attendre: 40 }                                    une pause (en images)
 *   { choix: [{ texte, drapeau, suite: [...] }], question }   le joueur décide
 *   { si: 'drapeau'|'!drapeau', alors: [...], sinon: [...] }  selon ses choix d'avant
 *   { marque: 'drapeau' }                               lève un drapeau
 *
 * Pour les grands moments (les fins de boss) :
 *   { camera: { zoom, x, y, duree, attendre } }         la caméra zoome, se déplace (sans attendre, par défaut)
 *   { ralenti: 0.3 }                                    tout ralentit (1 : vitesse normale)
 *   { bandes: 90 }                                      des bandes de cinéma plus larges (46 : normales)
 *   { auraSur: id, v: 1 }                               une aura autour de lui (entre: … aura: 1 aussi)
 *   { retire: [ids] }                                   ils disparaissent d'un coup
 *   { calme: true }                                     tous les effets s'arrêtent
 *   { musique: 'triste' | null }                        la musique change (null : le silence)
 *
 * Pour jouer dans les cinématiques :
 *   { qte: { texte, duree, reussi: [...], rate: [...], drapeau } }   appuyer à temps (rater lève le drapeau)
 *   { choix: [...], chrono: 5, defaut: 1 }                          un choix à faire vite (sinon, le défaut)
 *   { choix: [{ …, affinite: { ryuken: 2 } }] }                     un choix qui rapproche d'un allié (« aff_ryuken »)
 *   { si: 'aff_ryuken>=2' }                                         une condition sur l'affinité
 *   { infiltration: { garde, drapeau, reussi: [...], rate: [...] } } avancer sans se faire voir
 *   effet 'souvenir' : un flashback (sépia, vignette), jusqu'au prochain { calme }
 *   { titre, film: true }                               un titre façon générique de film
 *   auto: n (sur narre, dit, titre)                     passe tout seul au bout de n images
 *   effets : onde, debris, horloge-brisee, rayons, pilier, braises, eclairs, confettis,
 *            fondu-blanc, fracture-ferme, souvenirs (decors: [...]) — avec x, y, c (couleur), n
 *   { debloque: id }                                    un combattant rejoint le roster
 *   { croise: id, indice }                              on le rencontre… on le débloquera plus tard
 *
 * 'hero' désigne le combattant du joueur ; « {hero} » dans un texte, son nom ;
 * « {e} » s'accorde à son genre (« fort{e} »), « {h:il|elle} » aussi.
 * Les rôles (`roles`) : qui joue qui, quand le héros tient déjà un rôle ;
 * « {id} » dans un texte donne le nom de celui qui le joue.
 */

import { PERSO } from '../../../shared/street/persos.js';
import { dessinerCombattant, dessinerPortrait, rgba } from './dessin.js';
import { ARENE, fondArene, animerArene } from './arenes.js';
import { jouer as son } from './son.js';
import { dire, taire, parleEncore, voixDe, genreDe } from './voix.js';

const $ = (id) => document.getElementById(id);
const L = 1000;
const H = 600;
const SOL = 470;
const POS = { g: 300, d: 700, gg: 160, dd: 840, c: 500 };
const TAU = Math.PI * 2;
/** Un hasard qui donne toujours la même chose pour le même n. */
const hf = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const CAMERA = { z: 1, x: L / 2, y: H / 2 };

let scene = null;

/**
 * Joue une cinématique. Rend une promesse, résolue à la fin ('fin'), ou
 * quand on la quitte ('quitte'). Les choix faits s'écrivent dans `drapeaux`.
 */
/** La musique du moment (ce que la dernière cinématique a demandé). */
let musique = 'calme';
export const musiqueCine = () => musique;

export function jouerCine(etapes, { hero, roles = {}, drapeaux = {}, debloquer = () => {}, croiser = () => {}, quittable = false, musique: m, vu = () => {}, aide = false } = {}) {
  if (m !== undefined) musique = m;
  return new Promise((fini) => {
    if (scene) terminer('quitte');
    scene = {
      etapes: [...etapes], i: 0, hero, roles, drapeaux, debloquer, croiser, fini, vu, infil: null, aide,
      decor: 'dojo', acteurs: new Map(), effets: [], t: 0, attente: null, secousse: 0, rapide: false, fondu: null,
      cam: { ...CAMERA, anim: null }, vitesse: 1, bandes: 46, bandesCible: 46,
    };
    for (const id of ['cine-boite', 'cine-titre', 'cine-debloque', 'cine-choix', 'cine-qte', 'cine-infil']) $(id).hidden = true;
    $('cine-lieu').hidden = true;
    $('cine-quitter').hidden = !quittable;
    dimensionner();
    cancelAnimationFrame(raf);
    boucle();
    suivante();
  });
}

const qui = (w) => (w === 'hero' ? scene.hero : scene.roles[w] || w);
const feminin = () => genreDe(PERSO[scene.hero]) === 'f';
const remplir = (texte) => texte
  .replace(/\{h:([^|}]*)\|([^}]*)\}/g, (m, masc, fem) => (feminin() ? fem : masc))
  .replace(/\{e\}/g, () => (feminin() ? 'e' : ''))
  .replace(/\{(\w+)\}/g, (m, id) => (id === 'hero' ? PERSO[scene.hero]?.nom || 'toi' : PERSO[qui(id)]?.nom || m));
/** Une condition : 'drapeau', '!drapeau', 'aff_ryuken>=2'… plusieurs avec « & ». */
export function vrai(cond, d) {
  return String(cond).split('&').every((c) => {
    const m = c.trim().match(/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d+)$/);
    if (m) { const v = Number(d[m[1]] || 0); const n = Number(m[3]); return { '>=': v >= n, '<=': v <= n, '>': v > n, '<': v < n, '==': v === n }[m[2]]; }
    const x = c.trim();
    return x.startsWith('!') ? !d[x.slice(1)] : !!d[x];
  });
}

/* ------------------------------------------------------------------ */
/* Les étapes                                                          */
/* ------------------------------------------------------------------ */

function suivante() {
  const S = scene;
  if (!S) return;
  if (S.i >= S.etapes.length) { terminer('fin'); return; }
  const e = S.etapes[S.i++];
  if (e.decor) {
    // Un fondu au noir : on change de lieu, la scène se vide.
    if (e.fondu && !S.rapide && S.t > 1) { S.fondu = { t: 0, decor: e.decor }; S.attente = { fondu: true }; son('tic'); return; }
    S.decor = e.decor;
    if (e.fondu) S.acteurs.clear();
    suivante();
    return;
  }
  if (e.vide) { S.acteurs.clear(); suivante(); return; }
  if (e.musique !== undefined) { musique = e.musique; suivante(); return; }
  if (e.camera) {
    const c = e.camera;
    const duree = S.rapide ? 1 : c.duree || 40;
    S.cam.anim = { de: { z: S.cam.z, x: S.cam.x, y: S.cam.y }, a: { z: c.zoom ?? 1, x: c.x ?? L / 2, y: c.y ?? H / 2 }, t: 0, duree };
    if (c.attendre && !S.rapide) { S.attente = { fin: S.t + duree }; return; }
    suivante();
    return;
  }
  if (e.ralenti !== undefined) { S.vitesse = S.rapide ? 1 : e.ralenti; suivante(); return; }
  if (e.bandes !== undefined) { S.bandesCible = e.bandes; suivante(); return; }
  if (e.auraSur) { const a = S.acteurs.get(qui(e.auraSur)); if (a) a.aura = e.v ?? 1; suivante(); return; }
  if (e.retire) { for (const id of e.retire) S.acteurs.delete(qui(id)); suivante(); return; }
  if (e.calme) { S.effets = S.effets.filter((x) => x.nom === 'fondu-blanc'); suivante(); return; }
  if (e.marque) { S.drapeaux[e.marque] = true; suivante(); return; }
  if (e.pose) { const a = S.acteurs.get(qui(e.pose)); if (a) a.pose = e.p; suivante(); return; }
  if (e.si) { S.etapes.splice(S.i, 0, ...((vrai(e.si, S.drapeaux) ? e.alors : e.sinon) || [])); suivante(); return; }
  if (e.lieu) { if (!S.rapide) montrerLieu(e.lieu); suivante(); return; }
  if (e.devoile) {
    const a = S.acteurs.get(qui(e.devoile));
    if (a) a.ombre = false;
    if (S.rapide) { suivante(); return; }
    S.effets.push({ nom: 'flash', t: 0, duree: 30 });
    son('impact-lourd');
    S.attente = { fin: S.t + 30 };
    return;
  }
  if (e.purifie) {
    const a = S.acteurs.get(qui(e.purifie));
    if (!a || !a.corrompu) { suivante(); return; }
    a.corrompu = false;
    if (S.rapide) { suivante(); return; }
    S.effets.push({ nom: 'purif', t: 0, duree: 60, x: a.x, y: a.y - 95 });
    son('ulti');
    S.attente = { fin: S.t + 50 };
    return;
  }
  if (e.qte) { montrerQte(e.qte); return; }
  if (e.infiltration) { commencerInfiltration(e.infiltration); return; }
  if (e.choix) { montrerChoix(e); return; }
  if (e.debloque) { montrerCarte(e.debloque, 'debloque'); return; }
  if (e.croise) { montrerCarte(e.croise, 'croise', e.indice); return; }
  // En avance rapide : le reste s'applique sans attendre.
  if (S.rapide) { appliquer(e); suivante(); return; }
  if (e.attendre) { S.attente = { fin: S.t + e.attendre }; return; }
  if (e.effet) {
    if (e.effet === 'fracture-ferme') S.effets = S.effets.filter((x) => x.nom !== 'fracture');
    S.effets.push({ ...e, nom: e.effet, t: 0, duree: e.duree || 70 });
    if (['onde', 'debris', 'horloge-brisee', 'fracture-ferme'].includes(e.effet)) son('ulti');
    if (e.effet === 'confettis') son('victoire');
    if (e.effet === 'eclair' || e.effet === 'flash') son('impact-lourd');
    if (e.effet === 'fracture') son('ulti');
    if (e.effet === 'secousse') { S.secousse = 14; son('boum'); }
    if (e.effet === 'gel') son('contre');
    S.attente = e.attendre === false ? null : { fin: S.t + Math.min(e.duree || 70, 60) };
    if (!S.attente) suivante();
    return;
  }
  if (e.entre) {
    const a = nouvelActeur(e);
    if (a.comment === 'teleport') son('combo');
    // « place » : il est déjà là, sans entrée.
    if (a.comment === 'place') { a.entree = 1; suivante(); return; }
    S.attente = { acteur: a };
    return;
  }
  if (e.sort) {
    const a = S.acteurs.get(qui(e.sort));
    if (!a) { suivante(); return; }
    a.sortie = e.comment || 'teleport';
    a.entree = 0;
    S.attente = { sortie: a };
    return;
  }
  if (e.titre) { montrerTitre(e); return; }
  if (e.narre) { parler(null, e.narre, e); return; }
  if (e.dit) {
    const a = S.acteurs.get(qui(e.dit));
    if (a && e.p) a.pose = e.p;
    parler(e.dit, e.texte, e);
    return;
  }
  suivante();
}

function nouvelActeur(e) {
  const S = scene;
  const id = qui(e.entre);
  const cote = e.cote || 'd';
  const x = e.x ?? POS[cote];
  const dir = e.dir ?? (x < L / 2 ? 1 : -1);
  const comment = e.comment || 'marche';
  const a = { id, x, y: SOL, dir, pose: e.p || 'repos', alpha: 1, t: 0, comment, cible: x, entree: 0, ombre: !!e.ombre, corrompu: !!e.corrompu, aura: e.aura || 0 };
  if (comment === 'marche') { a.x = x < L / 2 ? -80 : L + 80; a.pose = 'marche'; }
  if (comment === 'saut') { a.depart = x < L / 2 ? -80 : L + 80; }
  if (comment === 'chute') a.y = -200;
  if (comment === 'apparait' || comment === 'teleport') a.alpha = 0;
  a.poseFinale = e.p || 'repos';
  S.acteurs.set(id, a);
  if (!a.ombre) S.vu(id);
  return a;
}

/** En avance rapide : l'état que l'étape aurait laissé. */
function appliquer(e) {
  const S = scene;
  if (e.entre) { const a = nouvelActeur(e); a.x = a.cible; a.y = SOL; a.alpha = 1; a.entree = 1; a.pose = a.poseFinale; }
  if (e.sort) S.acteurs.delete(qui(e.sort));
  if (e.dit) { const a = S.acteurs.get(qui(e.dit)); if (a && e.p) a.pose = e.p; }
  if (e.effet && ['gel', 'nuit', 'aube', 'fracture'].includes(e.effet)) S.effets.push({ nom: e.effet, t: 99, duree: 1 });
  if (e.effet === 'fracture-ferme') S.effets = S.effets.filter((x) => x.nom !== 'fracture');
}

function terminer(comment) {
  const S = scene;
  taire();
  scene = null;
  cancelAnimationFrame(raf);
  for (const id of ['cine-boite', 'cine-titre', 'cine-debloque', 'cine-choix', 'cine-lieu', 'cine-qte', 'cine-infil']) $(id).hidden = true;
  if (S) S.fini(comment);
}

/** Toucher l'écran : finir d'écrire la réplique, ou passer à la suivante. */
export function avancerCine() {
  const S = scene;
  if (!S) return;
  if (S.attente?.qte) { finirQte(true); return; }
  if (S.attente?.infil) return;
  if (S.ecrit && S.ecrit.n < S.ecrit.texte.length) { S.ecrit.n = S.ecrit.texte.length; return; }
  if (S.attente?.tap) {
    S.attente = null;
    $('cine-boite').hidden = true;
    $('cine-titre').hidden = true;
    $('cine-debloque').hidden = true;
    S.ecrit = null;
    son('tic');
    suivante();
  }
}

/** Passer : on saute les dialogues, mais pas les choix ni les combattants rencontrés. */
export function passerCine() {
  const S = scene;
  if (!S || S.attente?.choix || S.attente?.qte || S.attente?.infil) return;
  S.rapide = true;
  taire();
  S.fondu = null;
  S.vitesse = 1;
  S.cam = { ...CAMERA, anim: null };
  S.bandesCible = 46;
  if (S.attente?.tap && !$('cine-debloque').hidden) return;
  // Celui qui entrait ou sortait arrive tout de suite.
  for (const a of S.acteurs.values()) {
    if (a.sortie) S.acteurs.delete(a.id);
    else { a.x = a.cible; a.y = SOL; a.alpha = 1; a.entree = 1; a.pose = a.poseFinale; }
  }
  S.attente = null;
  S.ecrit = null;
  $('cine-boite').hidden = true;
  $('cine-titre').hidden = true;
  suivante();
}

/** Quitter en pleine scène (la partie est sauvegardée au début de la scène). */
export function quitterCine() {
  if (scene) terminer('quitte');
}

/** Choisir une réponse au clavier (1, 2, 3). */
export function choisirCine(n) {
  const b = $('cine-choix').querySelectorAll('button')[n];
  if (b && scene?.attente?.choix) b.click();
}

function parler(w, texte, e = {}) {
  const S = scene;
  const boite = $('cine-boite');
  boite.hidden = false;
  boite.classList.toggle('narration', !w);
  const pc = $('cine-portrait');
  pc.hidden = !w;
  const nom = $('cine-nom');
  if (w) {
    const p = PERSO[qui(w)];
    const a = S.acteurs.get(p.id);
    const ombre = e.ombre ?? a?.ombre ?? false;
    const g = pc.getContext('2d');
    g.clearRect(0, 0, pc.width, pc.height);
    dessinerPortrait(g, p, pc.width, { t: 8, dir: 1, ombre, corrompu: !ombre && a?.corrompu });
    nom.textContent = e.nom || (ombre ? '???' : p.nom);
    const c = ombre ? '#a898c8' : p.c.c1;
    nom.style.color = c;
    boite.style.setProperty('--c', c);
  } else {
    nom.textContent = '';
    boite.style.setProperty('--c', '#b9a8d6');
  }
  S.ecrit = { texte: remplir(texte), n: 0, qui: w ? qui(w) : null };
  const parleur = w ? S.acteurs.get(qui(w)) : null;
  dire(S.ecrit.texte, voixDe(w ? PERSO[qui(w)] : { id: 'narrateur' }), { corrompu: !!(parleur?.corrompu || (w && (e.ombre ?? parleur?.ombre))) });
  $('cine-texte').textContent = '';
  S.attente = { tap: true, auto: e.auto ? S.t + e.auto : undefined };
}

function montrerTitre(e) {
  const S = scene;
  $('cine-titre-sur').textContent = e.sur || '';
  $('cine-titre-texte').textContent = remplir(e.titre);
  $('cine-titre-sous').textContent = remplir(e.sous || '');
  const c = $('cine-titre');
  c.hidden = false;
  c.classList.toggle('film', !!e.film);
  c.classList.remove('entre'); void c.offsetWidth; c.classList.add('entre');
  son(e.film ? 'victoire' : 'annonce');
  if (e.film) dire(`${remplir(e.titre).replace(/[^\p{L}\p{N}’' -]/gu, ' ')}. ${remplir(e.sous || '')}`, voixDe({ id: 'narrateur' }));
  S.attente = { tap: true, auto: e.auto ? S.t + e.auto : undefined };
}

let lieuT = 0;
function montrerLieu(texte) {
  const l = $('cine-lieu');
  l.textContent = remplir(texte);
  l.hidden = false;
  l.classList.remove('entre'); void l.offsetWidth; l.classList.add('entre');
  clearTimeout(lieuT);
  lieuT = setTimeout(() => { l.hidden = true; }, 4200);
}

/* ---- Les QTE : appuyer à temps ---- */

function montrerQte(q) {
  const S = scene;
  if (S.rapide) { S.etapes.splice(S.i, 0, ...(q.reussi || [])); suivante(); return; }
  const d = $('cine-qte');
  // Le mode Récit laisse plus de temps.
  const duree = (q.duree || 70) * (S.aide ? 1.8 : 1);
  d.innerHTML = `<b>${remplir(q.texte || 'MAINTENANT !')}</b><span>Touchez l’écran ou appuyez sur ESPACE</span><div class="chrono"><i style="animation-duration:${duree / 60}s"></i></div>`;
  d.hidden = false;
  son('annonce');
  S.vitesse = 0.3;
  S.attente = { qte: q, fin: S.t + duree };
}

function finirQte(reussi) {
  const S = scene;
  const q = S.attente.qte;
  $('cine-qte').hidden = true;
  S.vitesse = 1;
  S.attente = null;
  if (!reussi && q.drapeau) S.drapeaux[q.drapeau] = true;
  son(reussi ? 'valide' : 'ko');
  if (reussi) S.effets.push({ nom: 'flash', t: 0, duree: 16 });
  S.etapes.splice(S.i, 0, ...((reussi ? q.reussi : q.rate) || []));
  suivante();
}

/* ---- L'infiltration : avancer quand le garde ne regarde pas ---- */

function commencerInfiltration(o) {
  const S = scene;
  if (S.rapide) { S.etapes.splice(S.i, 0, ...(o.reussi || [])); suivante(); return; }
  const h = S.acteurs.get(S.hero);
  if (h) { h.x = 110; h.cible = 110; h.dir = 1; h.entree = 1; }
  S.infil = { o, tenu: false, t0: S.t, vu: 0 };
  $('cine-infil').hidden = false;
  S.attente = { infil: true };
}

/** Tenir pour avancer (la barre d'espace, ou le doigt sur l'écran). */
export function tenirInfiltration(v) {
  if (scene?.infil) scene.infil.tenu = v;
}
export const infiltrationEnCours = () => !!scene?.infil;

/** Où tombe la lumière du garde, en ce moment. */
const lumiere = (S) => 430 + Math.sin((S.t - S.infil.t0) / 48) * 300;

function avancerInfiltration(S) {
  const I = S.infil;
  const h = S.acteurs.get(S.hero);
  if (!h) return;
  const cx = lumiere(S);
  if (I.tenu) { h.x += 2.2; h.cible = h.x; h.pose = 'marche'; } else h.pose = 'accroupi';
  // Bouger dans la lumière : repéré.
  if (I.tenu && Math.abs(h.x - cx) < 85) I.vu += 1; else I.vu = Math.max(0, I.vu - 1);
  const fin = (reussi) => {
    S.infil = null;
    $('cine-infil').hidden = true;
    S.attente = null;
    h.pose = 'repos';
    if (!reussi && I.o.drapeau) S.drapeaux[I.o.drapeau] = true;
    son(reussi ? 'valide' : 'ko');
    S.etapes.splice(S.i, 0, ...((reussi ? I.o.reussi : I.o.rate) || []));
    suivante();
  };
  if (I.vu > (S.aide ? 16 : 6)) fin(false);
  else if (h.x >= 640) fin(true);
}

function montrerChoix(e) {
  const S = scene;
  const boite = $('cine-choix');
  boite.innerHTML = `${e.question ? `<p>${remplir(e.question)}</p>` : ''}${e.choix.map((c, k) => `<button class="btn${k === 0 ? ' rouge' : ' bleu'}" data-k="${k}"><kbd>${k + 1}</kbd> ${remplir(c.texte)}</button>`).join('')}`;
  boite.hidden = false;
  $('cine-boite').hidden = true;
  son('annonce');
  const chrono = e.chrono ? e.chrono * (S.aide ? 1.6 : 1) : 0;
  S.attente = { choix: true, fin: chrono && !S.rapide ? S.t + chrono * 60 : undefined, defaut: e.defaut ?? e.choix.length - 1 };
  if (chrono && !S.rapide) boite.insertAdjacentHTML('afterbegin', `<div class="chrono"><i style="animation-duration:${chrono}s"></i></div>`);
  boite.onclick = (ev) => {
    const b = ev.target.closest('[data-k]');
    if (!b || scene !== S) return;
    ev.stopPropagation();
    const c = e.choix[Number(b.dataset.k)];
    if (c.drapeau) S.drapeaux[c.drapeau] = true;
    for (const [id, n] of Object.entries(c.affinite || {})) S.drapeaux[`aff_${id}`] = (S.drapeaux[`aff_${id}`] || 0) + n;
    boite.hidden = true;
    son('valide');
    S.attente = null;
    S.etapes.splice(S.i, 0, ...(c.suite || []));
    suivante();
  };
}

/** Un combattant débloqué, ou seulement rencontré (on saura où le gagner). */
function montrerCarte(id, sorte, indice = '') {
  const S = scene;
  const p = PERSO[qui(id)];
  const debloque = sorte === 'debloque';
  if (debloque) S.debloquer(p.id); else S.croiser(p.id);
  const d = $('cine-debloque');
  d.classList.toggle('croise', !debloque);
  d.innerHTML = debloque
    ? `<small>NOUVEAU COMBATTANT DÉBLOQUÉ</small><canvas width="260" height="260"></canvas><b style="color:${p.c.c1}">${p.nom}</b><span>${p.style}</span>`
    : `<small>NOUVELLE RENCONTRE</small><canvas width="260" height="260"></canvas><b style="color:${p.c.c1}">${p.nom}</b><span>${p.style}</span><em>🔒 ${remplir(indice)}</em>`;
  dessinerPortrait(d.querySelector('canvas').getContext('2d'), p, 260, { aura: debloque ? 1 : 0.4, t: 10, pose: 'repos' });
  d.hidden = false;
  son(debloque ? 'victoire' : 'annonce');
  S.attente = { tap: true };
}

/* ------------------------------------------------------------------ */
/* L'image                                                             */
/* ------------------------------------------------------------------ */

let raf = 0;

export function dimensionner() {
  const cv = $('cine-canvas');
  const r = Math.min(2, window.devicePixelRatio || 1);
  const e = Math.min(innerWidth / L, innerHeight / H);
  cv.style.width = `${L * e}px`;
  cv.style.height = `${H * e}px`;
  cv.width = Math.round(L * e * r);
  cv.height = Math.round(H * e * r);
}

function boucle() {
  raf = requestAnimationFrame(boucle);
  const S = scene;
  if (!S) return;
  S.t += 1;
  avancer(S);
  dessiner(S);
}

function avancer(S) {
  // Le texte s'écrit, lettre par lettre.
  if (S.ecrit && S.ecrit.n < S.ecrit.texte.length) {
    S.ecrit.n = Math.min(S.ecrit.texte.length, S.ecrit.n + 1.2);
    $('cine-texte').textContent = S.ecrit.texte.slice(0, Math.floor(S.ecrit.n));
    if (Math.floor(S.ecrit.n) % 3 === 0) son('tic');
  }
  // Le fondu au noir : à mi-chemin, on change de lieu.
  if (S.fondu) {
    S.fondu.t += 1;
    if (S.fondu.t === 22) { S.decor = S.fondu.decor; S.acteurs.clear(); S.effets = []; }
    if (S.fondu.t >= 44) { S.fondu = null; S.attente = null; suivante(); }
  }
  // La caméra glisse vers sa cible ; les bandes s'élargissent ou se resserrent.
  if (S.cam.anim) {
    const an = S.cam.anim;
    an.t += 1;
    const p = Math.min(1, an.t / an.duree);
    const e = p * p * (3 - 2 * p);
    S.cam.z = an.de.z + (an.a.z - an.de.z) * e; S.cam.x = an.de.x + (an.a.x - an.de.x) * e; S.cam.y = an.de.y + (an.a.y - an.de.y) * e;
    if (p >= 1) S.cam.anim = null;
  }
  S.bandes += (S.bandesCible - S.bandes) * 0.08;
  for (const a of S.acteurs.values()) {
    a.t += S.vitesse;
    if (a.sortie) {
      a.entree += 1;
      if (a.sortie === 'marche') { a.pose = 'marche'; a.dir = a.x < L / 2 ? -1 : 1; a.x += a.dir * 9; }
      else a.alpha = Math.max(0, 1 - a.entree / 20);
      if (a.entree > 40) S.acteurs.delete(a.id);
      continue;
    }
    if (a.entree >= 1) continue;
    const p = Math.min(1, a.t / 45);
    if (a.comment === 'marche') { a.x = a.x + (a.cible - a.x) * 0.09; if (Math.abs(a.x - a.cible) < 2) { a.x = a.cible; a.entree = 1; } }
    else if (a.comment === 'saut') { a.x = a.depart + (a.cible - a.depart) * p; a.y = SOL - Math.sin(p * Math.PI) * 220; a.pose = p < 1 ? 'saut' : a.poseFinale; if (p >= 1) { a.entree = 1; son('chute'); S.secousse = 6; } }
    else if (a.comment === 'chute') { a.y = Math.min(SOL, -200 + (SOL + 200) * p * p); a.pose = p < 1 ? 'saut' : a.poseFinale; if (p >= 1) { a.entree = 1; S.secousse = 10; son('chute'); } }
    else { a.alpha = p; if (p >= 1) a.entree = 1; }
    if (a.entree === 1) a.pose = a.poseFinale;
  }
  for (const f of S.effets) f.t += S.vitesse;
  S.effets = S.effets.filter((f) => f.t < f.duree || ['gel', 'nuit', 'aube', 'fracture', 'souvenir'].includes(f.nom));
  S.secousse *= 0.88;
  // Ce qu'on attend est fini : la suite.
  const at = S.attente;
  if (at?.qte && S.t >= at.fin) { finirQte(false); return; }
  if (at?.choix && at.fin !== undefined && S.t >= at.fin) { const b = $('cine-choix').querySelectorAll('[data-k]')[at.defaut]; at.fin = undefined; b?.click(); return; }
  if (S.infil) avancerInfiltration(S);
  if (at && at.tap && at.auto !== undefined && S.t >= at.auto && !(S.ecrit && S.ecrit.n < S.ecrit.texte.length) && !parleEncore()) { avancerCine(); return; }
  if (at && !at.tap && !at.choix && !at.fondu) {
    const fini = (at.fin !== undefined && S.t >= at.fin) || (at.acteur && at.acteur.entree >= 1) || (at.sortie && !S.acteurs.has(at.sortie.id));
    if (fini) { S.attente = null; suivante(); }
  }
}

function dessiner(S) {
  if (S.infil) S.infil.dessine = false;
  const cv = $('cine-canvas');
  const g = cv.getContext('2d');
  const e = cv.width / L;
  g.setTransform(e, 0, 0, e, 0, 0);
  g.save();
  const cam = S.cam;
  if (cam.z !== 1 || cam.x !== L / 2 || cam.y !== H / 2) { g.translate(L / 2, H / 2); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y); }
  if (S.secousse > 0.3) g.translate((Math.random() - 0.5) * S.secousse, (Math.random() - 0.5) * S.secousse);
  const arene = ARENE[S.decor] || ARENE.dojo;
  g.drawImage(fondArene(arene), 0, 0, L, H);
  animerArene(g, arene, S.t);
  for (const f of S.effets) effetFond(g, f, S);
  // Les combattants, celui qui parle un peu mis en avant.
  for (const a of S.acteurs.values()) {
    if (S.infil && a.id === S.hero && !S.infil.dessine) {
      const cx = lumiere(S);
      S.infil.dessine = true;
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(0, 300, 0, SOL);
      gr.addColorStop(0, 'rgba(255,240,150,0.05)'); gr.addColorStop(1, `rgba(255,240,150,${S.infil.vu ? 0.5 : 0.28})`);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(780, 300); g.lineTo(cx - 85, SOL + 6); g.lineTo(cx + 85, SOL + 6); g.closePath(); g.fill();
      g.restore();
    }
    const parle = S.ecrit && S.ecrit.qui === a.id && S.ecrit.n < S.ecrit.texte.length;
    dessinerCombattant(g, PERSO[a.id], {
      x: a.x, y: a.y, dir: a.dir, pose: a.pose, t: a.t + (parle ? Math.floor(S.t / 4) : 0), p: 1, alpha: a.alpha,
      aura: Math.max(a.aura || 0, a.comment === 'apparait' && a.entree < 1 ? 1 - a.alpha : 0), echelle: 1.15, enLAir: a.y < SOL - 2, ombre: a.ombre, corrompu: a.corrompu,
    });
    if ((a.comment === 'teleport' || a.comment === 'apparait') && a.alpha < 1 && !a.sortie) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(a.x, a.y - 90, 0, a.x, a.y - 90, 140);
      gr.addColorStop(0, rgba(a.ombre ? '#8a7aa8' : PERSO[a.id].c.c1, 0.7 * (1 - a.alpha))); gr.addColorStop(1, rgba('#000000', 0));
      g.fillStyle = gr; g.beginPath(); g.arc(a.x, a.y - 90, 140, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
  for (const f of S.effets) effetDevant(g, f, S);
  g.restore();
  for (const f of S.effets) if (f.nom === 'fondu-blanc') { const m = f.duree / 2; g.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - Math.abs(f.t - m) / m)})`; g.fillRect(0, 0, L, H); }
  if (S.fondu) { g.fillStyle = `rgba(0,0,0,${1 - Math.abs(S.fondu.t - 22) / 22})`; g.fillRect(0, 0, L, H); }
  // Les bandes de cinéma.
  g.fillStyle = '#000';
  g.fillRect(0, 0, L, S.bandes); g.fillRect(0, H - S.bandes, L, S.bandes);
}

/** Entrée et sortie en douceur d'un effet (0 → 1 → 0). */
const vie = (f, entree = 20, sortie = 30) => Math.max(0, Math.min(1, f.t / entree, (f.duree - f.t) / sortie));

/** Les effets derrière les combattants (le ciel qui se fend, la nuit, l'aube). */
function effetFond(g, f, S) {
  if (f.nom === 'rayons') {
    // Des rayons de lumière qui tournent lentement.
    const a = vie(f, 30, 40);
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(f.x ?? L / 2, f.y ?? 80);
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * TAU + f.t / 140;
      g.fillStyle = rgba(f.c || '#ffffff', 0.13 * a);
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1300, an, an + 0.11); g.closePath(); g.fill();
    }
    const h = g.createRadialGradient(0, 0, 0, 0, 0, 160);
    h.addColorStop(0, rgba(f.c || '#ffffff', 0.6 * a)); h.addColorStop(1, rgba(f.c || '#ffffff', 0));
    g.fillStyle = h; g.beginPath(); g.arc(0, 0, 160, 0, TAU); g.fill();
    g.restore();
  }
  if (f.nom === 'horloge-brisee') {
    // L'horloge géante : elle se fend, ses aiguilles s'affolent puis s'envolent.
    const p = Math.min(1, f.t / f.duree);
    const cx = L / 2; const cy = 175; const r = 150;
    g.save(); g.globalAlpha = vie(f, 20, 30);
    g.fillStyle = 'rgba(6,32,42,0.75)'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.strokeStyle = '#ffd23f'; g.lineWidth = 10; g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; g.beginPath(); g.moveTo(cx + Math.cos(an) * (r - 26), cy + Math.sin(an) * (r - 26)); g.lineTo(cx + Math.cos(an) * (r - 8), cy + Math.sin(an) * (r - 8)); g.stroke(); }
    const va = (f.t * f.t) / 300;
    const vol = Math.max(0, p - 0.5) * 900;
    g.lineCap = 'round';
    for (const [an, long, ep, sens] of [[va, r - 30, 9, -1], [va / 12, r - 60, 12, 1]]) {
      g.save(); g.translate(cx + sens * vol, cy - vol * 0.4); g.rotate(an + vol / 60);
      g.strokeStyle = '#ffe6a0'; g.lineWidth = ep; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -long); g.stroke();
      g.restore();
    }
    // Les fissures, de plus en plus longues, qui brillent.
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.shadowColor = '#4fe0d0'; g.shadowBlur = 16;
    for (let i = 0; i < 8; i++) {
      const an = i * 0.8 + 0.3; const lg = r * Math.min(1, p * 1.8);
      g.beginPath(); g.moveTo(cx, cy);
      for (let k = 1; k <= 5; k++) { const d = (lg * k) / 5; g.lineTo(cx + Math.cos(an + (hf(i * 9 + k) - 0.5) * 0.4) * d, cy + Math.sin(an + (hf(i * 7 + k) - 0.5) * 0.4) * d); }
      g.stroke();
    }
    g.restore();
  }
  if (f.nom === 'souvenirs') {
    // Les souvenirs de l'aventure, comme des photos, qui défilent dans le ciel.
    const decors = f.decors || [];
    const w = 230; const h = 138; const pas = w + 34;
    const v = (decors.length * pas + L) / f.duree;
    g.save(); g.globalAlpha = vie(f, 30, 30) * 0.9;
    decors.forEach((id, i) => {
      const x = L + 20 - f.t * v + i * pas;
      if (x < -w - 20 || x > L + 20) return;
      g.save(); g.translate(x, 108 + Math.sin(i * 1.7) * 16); g.rotate(Math.sin(i * 2.1) * 0.07);
      g.fillStyle = '#f4ecd8'; g.fillRect(-7, -7, w + 14, h + 14);
      g.drawImage(fondArene(ARENE[id] || ARENE.dojo), 0, 0, w, h);
      g.fillStyle = 'rgba(255,220,160,0.22)'; g.fillRect(0, 0, w, h);
      g.restore();
    });
    g.restore();
  }
  if (f.nom === 'fracture-ferme') {
    // La Fracture se referme : la blessure du ciel rétrécit, puis une immense lumière.
    const p = Math.min(1, f.t / f.duree);
    const reste = Math.max(0, 1 - p * 1.4);
    g.save(); g.globalCompositeOperation = 'lighter';
    if (reste > 0) {
      g.strokeStyle = rgba('#ff50ff', 0.9); g.lineWidth = 6 * reste + 1; g.shadowColor = '#c814ff'; g.shadowBlur = 30;
      const pts = [[500, 40], [470, 90], [530, 140], [480, 200], [540, 250], [500, 300]];
      const milieu = 170;
      g.beginPath();
      pts.forEach(([x, y], i) => { const yy = milieu + (y - milieu) * reste; if (i) g.lineTo(500 + (x - 500) * reste, yy); else g.moveTo(500 + (x - 500) * reste, yy); });
      g.stroke();
    }
    const eclat = Math.max(0, p - 0.55) / 0.45;
    if (eclat > 0) {
      const gr = g.createRadialGradient(500, 170, 0, 500, 170, 700 * eclat);
      gr.addColorStop(0, rgba('#ffffff', 1 - eclat * 0.6)); gr.addColorStop(0.4, rgba('#ffe6ff', 0.5 * (1 - eclat))); gr.addColorStop(1, rgba('#ffffff', 0));
      g.fillStyle = gr; g.fillRect(0, 0, L, H);
    }
    g.restore();
  }
  if (f.nom === 'fracture') {
    const p = Math.min(1, f.t / 50);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba('#ff50ff', 0.8); g.lineWidth = 6 + Math.sin(S.t / 4) * 2;
    g.shadowColor = '#c814ff'; g.shadowBlur = 30;
    g.beginPath(); g.moveTo(500, 40);
    const pts = [[470, 90], [530, 140], [480, 200], [540, 250], [500, 300]];
    for (let i = 0; i < pts.length * p; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
    const gr = g.createRadialGradient(500, 170, 10, 500, 170, 260 * p);
    gr.addColorStop(0, 'rgba(200,20,255,0.35)'); gr.addColorStop(1, 'rgba(200,20,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, L, SOL);
    g.restore();
  }
  if (f.nom === 'nuit') { g.fillStyle = `rgba(0,0,20,${Math.min(0.5, f.t / 60)})`; g.fillRect(0, 0, L, H); }
  if (f.nom === 'aube') {
    const gr = g.createLinearGradient(0, 0, 0, SOL);
    gr.addColorStop(0, `rgba(255,170,90,${Math.min(0.45, f.t / 80)})`); gr.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, L, H);
  }
}

/** Les effets devant (l'éclair, le flash, le temps figé). */
function effetDevant(g, f, S) {
  const v = 1 - f.t / f.duree;
  if (f.nom === 'souvenir') {
    // Un souvenir : sans couleurs, sépia, les bords dans l'ombre, un grain qui scintille.
    const a = Math.min(1, f.t / 30);
    g.save();
    g.globalAlpha = a;
    g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(-L, -H, L * 3, H * 3);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = '#e8c890'; g.fillRect(-L, -H, L * 3, H * 3);
    g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(L / 2, H / 2, 200, L / 2, H / 2, 620);
    vg.addColorStop(0, 'rgba(40,24,8,0)'); vg.addColorStop(1, 'rgba(40,24,8,0.7)');
    g.fillStyle = vg; g.fillRect(0, 0, L, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = rgba('#fff4e0', 0.12); g.fillRect(hf(i + Math.floor(S.t / 3) * 7) * L, hf(i * 3 + Math.floor(S.t / 3)) * H, 2, 2); }
    g.restore();
  }
  if (f.nom === 'onde') {
    // L'onde de choc : des anneaux qui s'élargissent, un éclair blanc.
    const x = f.x ?? L / 2; const y = f.y ?? 380;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const q = f.t - k * 8;
      if (q < 0) continue;
      g.strokeStyle = rgba(k === 1 ? '#ffffff' : f.c || '#ffffff', Math.max(0, 1 - q / f.duree) * 0.9);
      g.lineWidth = Math.max(1, 14 - q / 4);
      g.beginPath(); g.ellipse(x, y, q * 14, q * 8, 0, 0, TAU); g.stroke();
    }
    g.restore();
    if (f.t < 8) { g.fillStyle = rgba('#ffffff', 0.7 * (1 - f.t / 8)); g.fillRect(-L, -H, L * 3, H * 3); }
  }
  if (f.nom === 'debris') {
    // Des débris qui tombent en tournoyant (des morceaux d'horloge, de trône, de miroir…).
    const n = f.n || 30;
    g.save(); g.globalAlpha = vie(f, 1, 30);
    for (let i = 0; i < n; i++) {
      const t = f.t - hf(i + 3) * 40;
      if (t < 0) continue;
      const x0 = (f.x ?? L / 2) + (hf(i) - 0.5) * (f.large ?? 500);
      const y0 = (f.y ?? 160) + (hf(i + 1) - 0.5) * 100;
      const vx = (hf(i + 2) - 0.5) * 6;
      const vy = -3 - hf(i + 4) * 4;
      const x = x0 + vx * t; const y = y0 + vy * t + 0.18 * t * t;
      if (y > H + 30) continue;
      const taille = 5 + hf(i + 5) * 12;
      g.save(); g.translate(x, y); g.rotate(t / (8 + hf(i + 6) * 10) * (i % 2 ? 1 : -1));
      g.fillStyle = i % 4 === 0 ? '#ffffff' : f.c || '#ffd23f';
      g.beginPath(); g.moveTo(0, -taille); g.lineTo(taille * 0.8, taille * 0.4); g.lineTo(-taille * 0.6, taille * 0.7); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
  }
  if (f.nom === 'pilier') {
    // Un pilier de lumière qui monte du combattant jusqu'au ciel.
    const a = vie(f, 20, 40);
    const x = f.x ?? L / 2; const larg = 50 + Math.sin(f.t / 5) * 8;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(x - larg, 0, x + larg, 0);
    gr.addColorStop(0, rgba(f.c || '#ffffff', 0)); gr.addColorStop(0.5, rgba(f.c || '#ffffff', 0.75 * a)); gr.addColorStop(1, rgba(f.c || '#ffffff', 0));
    g.fillStyle = gr; g.fillRect(x - larg, -H, larg * 2, SOL + H);
    for (let i = 0; i < 18; i++) {
      const y = SOL - ((f.t * (3 + hf(i) * 4) + hf(i + 2) * 600) % 600);
      g.fillStyle = rgba('#ffffff', a * 0.8); g.fillRect(x + (hf(i + 1) - 0.5) * larg * 1.6, y, 2.5, 7);
    }
    g.restore();
  }
  if (f.nom === 'braises' || f.nom === 'confettis') {
    const a = vie(f, 30, 40);
    const n = f.n || 70;
    g.save();
    if (f.nom === 'braises') g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      if (f.nom === 'braises') {
        // Des braises (ou des secondes d'or) qui montent.
        const x = hf(i) * L + Math.sin(f.t / 30 + i) * 30;
        const y = H - ((f.t * (1.4 + hf(i + 9) * 2) + hf(i + 3) * H) % (H + 40));
        g.fillStyle = rgba(f.c || '#ff7a1a', a * (0.4 + hf(i + 5) * 0.5));
        g.beginPath(); g.arc(x, y, 1.5 + hf(i + 7) * 2.5, 0, TAU); g.fill();
      } else {
        // Des confettis qui tombent.
        const x = hf(i) * L + Math.sin(f.t / 20 + i) * 20;
        const y = -20 + ((f.t * (1.6 + hf(i + 9) * 1.6) + hf(i + 3) * H) % (H + 40));
        g.save(); g.translate(x, y); g.rotate(f.t / 10 + i);
        g.fillStyle = rgba(['#ff3a4a', '#ffd23f', '#3a8aff', '#36d46a', '#ff5ab4', '#ffffff'][i % 6], a);
        g.fillRect(-4, -2, 8, 4 * Math.abs(Math.sin(f.t / 8 + i)) + 1);
        g.restore();
      }
    }
    g.restore();
  }
  if (f.nom === 'eclairs' && Math.floor(f.t) % 14 < 3) {
    // Des éclairs qui tombent au hasard.
    const k = Math.floor(f.t / 14);
    const x = 80 + hf(k * 7) * (L - 160);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = f.c || '#ffffff'; g.lineWidth = 4; g.shadowColor = f.c || '#c8c8ff'; g.shadowBlur = 24;
    g.beginPath(); g.moveTo(x + 30, 0);
    for (let y = 0; y < SOL; y += 50) g.lineTo(x + (hf(k + y) - 0.5) * 80, y);
    g.lineTo(x, SOL); g.stroke();
    g.fillStyle = rgba(f.c || '#ffffff', 0.18); g.fillRect(-L, -H, L * 3, H * 3);
    g.restore();
  }
  if (f.nom === 'flash') { g.fillStyle = `rgba(255,255,255,${Math.max(0, v)})`; g.fillRect(0, 0, L, H); }
  if (f.nom === 'purif') {
    // L'éclat jaillit de sa poitrine, monte et se brise ; une onde violette, puis blanche.
    const p = f.t / f.duree;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [r, c] of [[p * 260, '#c814ff'], [p * 180, '#ffffff']]) {
      g.strokeStyle = rgba(c, Math.max(0, 1 - p)); g.lineWidth = 8 * (1 - p) + 1;
      g.beginPath(); g.ellipse(f.x, f.y, r, r * 0.6, 0, 0, Math.PI * 2); g.stroke();
    }
    const y = f.y - p * 220;
    const gr = g.createRadialGradient(f.x, y, 0, f.x, y, 40);
    gr.addColorStop(0, rgba('#ff9aff', 1 - p)); gr.addColorStop(1, rgba('#c814ff', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(f.x, y, 40, 0, Math.PI * 2); g.fill();
    if (p < 0.7) { g.fillStyle = '#f0a0ff'; g.beginPath(); g.moveTo(f.x, y - 14); g.lineTo(f.x + 7, y); g.lineTo(f.x, y + 14); g.lineTo(f.x - 7, y); g.closePath(); g.fill(); }
    else for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const d = (p - 0.7) * 300; g.fillStyle = rgba('#f0a0ff', 1 - p); g.fillRect(f.x + Math.cos(a) * d, y + Math.sin(a) * d, 4, 4); }
    g.restore();
    if (f.t < 8) { g.fillStyle = `rgba(255,230,255,${0.6 * (1 - f.t / 8)})`; g.fillRect(0, 0, L, H); }
  }
  if (f.nom === 'eclair' && f.t < 20) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.shadowColor = '#c8c8ff'; g.shadowBlur = 24;
    const x = f.x ?? 500;
    g.beginPath(); g.moveTo(x + 40, 0);
    for (let y = 0; y < SOL; y += 60) g.lineTo(x + (Math.sin(y * 13.1) * 40), y);
    g.lineTo(x, SOL); g.stroke();
    g.fillStyle = `rgba(255,255,255,${0.5 * (1 - f.t / 20)})`; g.fillRect(0, 0, L, H);
    g.restore();
  }
  if (f.nom === 'gel') {
    // Le temps s'arrête : tout pâlit, une horloge apparaît.
    g.fillStyle = `rgba(150,220,210,${Math.min(0.35, f.t / 40)})`; g.fillRect(0, 0, L, H);
    g.save(); g.globalAlpha = Math.min(0.6, f.t / 40);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 5;
    g.beginPath(); g.arc(500, 220, 140, 0, Math.PI * 2); g.stroke();
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(500, 220); g.lineTo(500, 120); g.moveTo(500, 220); g.lineTo(560, 220); g.stroke();
    g.restore();
  }
}
