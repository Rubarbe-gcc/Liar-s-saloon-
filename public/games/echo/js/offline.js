/**
 * ÉCHO — partie sur un seul appareil.
 *
 * Deux façons d'y jouer, sur la même boucle :
 *
 *   · contre la machine : vous, et des bots qui enregistrent leur prise en
 *     même temps que vous — au sens propre : on rend leur imitation en
 *     échantillons, on la passe au même barème, et on la joue à la
 *     restitution ;
 *   · en soirée : plusieurs joueurs se passent le téléphone, et chacun
 *     enregistre à son tour pendant que les autres se taisent.
 */

import {
  creerPartie, sonDeLaManche, lancerEnregistrement, deposerPrise,
  lancerRestitution, restitutionSuivante, encaisserNotes, tournerRoue,
  passerRoue, viser, finirOuContinuer, viewFor, makeRng, enregistreurSuivant,
  dureeManche, PHASE, SABOTAGES, TOUR,
} from '../../../shared/mimic/partie.js';
import { rendre } from '../../../shared/mimic/sons.js';
import { analyserPrise, noter } from '../../../shared/mimic/analyse.js';
import { prise as prisebot, adversaires } from '../../../shared/mimic/bots.js';
import * as audio from './audio.js';
import * as karaoke from './karaoke.js';
import * as ui from './ui.js';
import * as succes from '../../../shared/succes.js';

let etat = null;
let rng = null;
let prises = new Map();     // joueurId -> échantillons de la manche
let humains = [];           // identifiants des joueurs en chair et en os
let sortie = () => {};
let rejouer = () => {};
let stop = false;

export function arreter() { stop = true; etat = null; prises.clear(); karaoke.montrer(false); }
export const enCours = () => !!etat;

/** Plusieurs humains sur le même appareil : il n'y a pas de « vous ». */
const soiree = () => humains.length > 1;
/** Vue du point de vue d'un joueur humain (le premier, par défaut). */
const vue = (id = humains[0]) => viewFor(etat, id);
const opts = (o = {}) => ({ sansMoi: soiree(), ...o });

/**
 * @param {{
 *   joueurs: Array<{name:string, photo?:string|null}>,
 *   nb?: number, niveau?: string,
 *   reglages: {manches:number, duree:number},
 *   onExit: Function, onAgain: Function,
 * }} o
 */
export async function demarrer({ joueurs, nb = 0, niveau = 'correct', reglages, onExit, onAgain }) {
  stop = false;
  sortie = onExit;
  rejouer = onAgain;
  prises.clear();

  rng = makeRng(Date.now());
  const bots = adversaires(nb, niveau, rng);
  const gens = joueurs.map((j, i) => ({
    id: joueurs.length === 1 ? 'moi' : `j${i}`,
    name: joueurs.length === 1 ? 'Vous' : j.name,
    photo: j.photo || null,
  }));
  humains = gens.map((j) => j.id);

  etat = creerPartie([...gens, ...bots], {
    seed: Math.floor(rng() * 2 ** 31),
    manches: reglages.manches,
    duree: reglages.duree,
    tour: gens.length > 1 ? TOUR.CHACUN : TOUR.ENSEMBLE,
  });
  etat.bots = new Map(bots.map((b) => [b.id, b.niveau]));
  ui.definirVisages([...gens, ...bots]);

  ui.fermerFin();
  ui.vedette(null);
  ui.montrer('jeu');
  ui.bindActions(action);
  await boucle();
}

/* ------------------------------------------------------------------ */

async function boucle() {
  while (etat && !stop && etat.phase !== PHASE.FIN) {
    await phaseEcoute();
    if (stop || !etat) return;
    await phaseEnregistrement();
    if (stop || !etat) return;
    await phaseRestitution();
    if (stop || !etat) return;
    await phaseNotes();
    if (stop || !etat) return;
    if (etat.phase === PHASE.ROUE) await phaseRoue();
    if (stop || !etat) return;
    finirOuContinuer(etat);
  }
  if (etat && etat.phase === PHASE.FIN) terminer();
}

async function phaseEcoute() {
  const son = sonDeLaManche(etat);
  const v = vue();
  ui.consigne(son);
  ui.phase(v, 'Écoutez');
  ui.tableau(v, opts());
  ui.vedette(null);
  karaoke.preparer(son);
  ui.scene(soiree() ? 'Tout le monde écoute. Le son ne passe qu\'une fois.' : 'Le son ne passe qu\'une fois.', 'doux');
  ui.actions([{ id: 'ecouter', label: '🔊 Jouer le son' }]);

  await attendre('ecouter');
  if (stop) return;

  ui.actions([]);
  ui.scene('…', 'gros');
  karaoke.lecture();
  await audio.jouer(rendre(son, audio.SR), audio.SR);
  await ui.sleep(250);
}

async function phaseEnregistrement() {
  const son = sonDeLaManche(etat);
  lancerEnregistrement(etat);
  const ref = analyserPrise(rendre(son, audio.SR), audio.SR);

  // Les bots enregistrent pendant le même temps que vous. Leur prise est
  // calculée ici pour pouvoir être jouée ensuite.
  for (const [id, niv] of etat.bots) {
    const p = prisebot(son, niv, audio.SR, rng);
    prises.set(id, p.samples);
    deposerPrise(etat, id, noter(ref, analyserPrise(p.samples, audio.SR)));
  }

  if (!soiree()) {
    await unePrise(humains[0], ref, { annonce: false });
  } else {
    // Chacun son tour : le téléphone passe de main en main.
    while (etat && !stop && etat.enregistreur !== null) {
      const j = etat.joueurs[etat.enregistreur];
      await unePrise(j.id, ref, { annonce: true });
      if (stop || !etat) return;
      enregistreurSuivant(etat);
    }
  }
  if (stop || !etat) return;
  ui.vedette(null);
  ui.tableau(vue(), opts());
  await ui.sleep(300);
}

/** Une prise, pour un joueur humain : annonce, compte à rebours, micro. */
async function unePrise(id, ref, { annonce }) {
  const i = etat.joueurs.findIndex((j) => j.id === id);
  const j = etat.joueurs[i];
  let v = vue(id);
  const duree = dureeManche(etat);
  ui.phase(v, annonce ? 'Les autres : chut 🤫' : 'À vous');
  ui.tableau(v, opts());

  if (annonce) {
    ui.vedette(v, i);
    ui.scene(`À ${j.name} !`, 'gros vif');
    karaoke.montrer(false);
    ui.actions([{ id: 'pret', label: `🎤 C'est moi, ${j.name}` }]);
    await attendre('pret');
    if (stop) return;
    karaoke.montrer(true);
  }

  ui.scene('Préparez-vous.', 'doux');
  ui.actions([]);
  ui.vedette(null);   // le compte à rebours s'affiche en grand, au même endroit
  await ui.compteARebours(3);
  if (stop) return;

  const mien = await enregistrerAvecRetry(v, i, duree);
  if (stop || !etat) return;
  if (mien) {
    prises.set(id, mien);
    deposerPrise(etat, id, noter(ref, analyserPrise(mien, audio.SR)));
  }
  v = vue(id);
  ui.tableau(v, opts());
}

async function enregistrerAvecRetry(v, i, duree) {
  const lancer = async () => {
    ui.scene('Imitez !', 'gros vif');
    ui.vedette(v, i, 'chante');
    ui.vumetre(true);
    karaoke.demarrerPrise();
    try {
      return await audio.enregistrer(duree, ui.niveau, karaoke.ajouter);
    } finally {
      ui.vumetre(false);
      karaoke.figer();
    }
  };

  try {
    return await lancer();
  } catch (e) {
    // Un micro absent doit se dire une bonne fois, pas se répéter en silence à
    // chaque manche pendant qu'on encaisse des zéros sans comprendre.
    ui.scene(e.message || 'Micro indisponible.', 'gros chaud');
    ui.actions([
      { id: 'reessayer', label: '🎤 Réessayer' },
      { id: 'quitter', label: 'Quitter', cls: 'btn-ghost' },
    ]);
    const quoi = await attendre(['reessayer', 'quitter']);
    if (quoi === 'quitter') { arreter(); sortie(); return null; }
    ui.actions([]);
    try { return await lancer(); } catch {
      ui.toast('Toujours pas de micro. La manche compte pour zéro.', 3200);
      return null;
    }
  }
}

async function phaseRestitution() {
  lancerRestitution(etat);
  karaoke.montrer(false);
  let v = vue();
  ui.phase(v, 'On réécoute');

  let i = 0;
  do {
    v = vue();
    const j = v.joueurs[i];
    if (!j) break;
    const sab = j.sabotage ? SABOTAGES[j.sabotage] : null;
    ui.tableau(v, opts({ surligne: i, chante: true }));
    ui.vedette(v, i, `chante${sab ? ' sabote' : ''}`);
    ui.scene(sab ? `${j.name} — ${sab.glyph} ${sab.label} !` : j.name, sab ? 'gros chaud' : 'gros');

    const brut = prises.get(j.id);
    if (brut) {
      ui.onde(true, sab ? 'var(--chaud)' : 'var(--vif)');
      await audio.jouer(audio.saboter(brut, j.sabotage), audio.SR);
      ui.onde(false);
    } else {
      await ui.sleep(700);
    }
    await ui.sleep(320);
    i++;
  } while (restitutionSuivante(etat) && !stop);

  // La boucle s'arrête quand il n'y a plus de prise ; la phase a basculé.
  while (etat && etat.phase === PHASE.RESTITUTION) restitutionSuivante(etat);
  ui.vedette(null);
}

async function phaseNotes() {
  const v = vue();
  ui.phase(v, 'Les notes');
  ui.tableau(v, opts());
  if (soiree()) {
    ui.scene('Les notes de la manche', 'doux');
    document.getElementById('scene-txt').insertAdjacentHTML('afterend',
      `<div class="detail" id="detail">${ui.notesManche(v)}</div>`);
  } else {
    const moi = v.joueurs[v.viewer];
    if (moi.prise && !moi.prise.absente && moi.prise.note >= 90) succes.debloquer('echo-90');
    ui.scene(moi.prise && !moi.prise.absente ? `${moi.prise.note} / 100` : 'Pas de prise', 'gros');
    document.getElementById('scene-txt').insertAdjacentHTML('afterend',
      `<div class="detail" id="detail">${ui.detailNote(moi.prise)}</div>`);
  }
  ui.actions([{ id: 'suite', label: 'Continuer' }]);
  await attendre('suite');
  const d = document.getElementById('detail');
  if (d) d.remove();
  encaisserNotes(etat);
  ui.tableau(vue(), opts());
}

async function phaseRoue() {
  // Les bots tournent d'abord, pour qu'on voie venir les sabotages.
  for (const [id] of etat.bots) {
    const r = tournerRoue(etat, id);
    if (r.ok && r.viser) {
      const proies = etat.joueurs.filter((j) => j.id !== id);
      viser(etat, id, proies[Math.floor(rng() * proies.length)].id);
    }
  }

  ui.actions([]);          // les boutons de la phase précédente n'ont plus cours
  for (const id of humains) {
    if (stop || !etat) return;
    await roueDe(id);
  }
  ui.tableau(vue(), opts());
}

async function roueDe(id) {
  const i = etat.joueurs.findIndex((j) => j.id === id);
  const j = etat.joueurs[i];
  let v = vue(id);
  ui.phase(v, 'La roue');
  ui.tableau(v, opts());
  ui.ouvrirRoue(soiree() ? `La roue — ${j.name}` : 'La roue',
    'Tourner, ou passer. La roue ne doit rien à personne.');
  ui.roueActions([
    { id: 'tourner', label: '🎡 Tourner' },
    { id: 'passer', label: 'Passer', cls: 'btn-ghost' },
  ]);

  const choix = await attendre(['tourner', 'passer']);
  if (stop) return;

  if (choix === 'passer') {
    passerRoue(etat, id);
  } else {
    ui.roueActions([]);
    const r = tournerRoue(etat, id);
    if (r.ok && r.case) {
      await ui.tournerRoue(r.case);
      ui.ouvrirRoue(`${r.case.glyph} ${r.case.label}`, r.case.blurb);
      if (r.viser) {
        v = vue(id);
        ui.choisirCible(v, r.case.sabotage);
        const cible = await attendre(null, (a) => a.startsWith('cible:'));
        if (stop) return;
        viser(etat, id, cible.slice('cible:'.length));
      }
    }
    ui.roueActions([{ id: 'fini', label: 'Suite' }]);
    await attendre('fini');
  }
  ui.fermerRoue();
}

function terminer() {
  const v = vue();
  ui.phase(v, 'Terminé');
  ui.tableau(v, opts());
  ui.vedette(null);
  ui.fin(v, {
    sansMoi: soiree(),
    onMenu: () => { ui.fermerFin(); arreter(); sortie(); },
    onAgain: () => { ui.fermerFin(); arreter(); rejouer(); },
  });
}

/* ------------------------------------------------------------------ */

/** Attend une action de l'interface. */
function attendre(attendu, filtre) {
  const liste = attendu === null ? null : [].concat(attendu);
  return new Promise((resolve) => {
    ui.bindActions((a) => {
      if (filtre ? filtre(a) : liste.includes(a)) {
        ui.bindActions(action);
        resolve(a);
      }
    });
  });
}

/** Actions hors phase : rien à faire, mais le bouton ne doit pas rester mort. */
function action() { /* chaque phase installe son propre écouteur */ }
