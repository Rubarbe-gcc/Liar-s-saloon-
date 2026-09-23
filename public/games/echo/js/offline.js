/**
 * ÉCHO — partie contre la machine.
 *
 * La boucle suit les six étapes d'une manche. Les bots enregistrent leur
 * prise en même temps que vous — au sens propre : on rend leur imitation en
 * échantillons, on la passe au même barème, et on la joue à la restitution.
 */

import {
  creerPartie, sonDeLaManche, lancerEnregistrement, deposerPrise,
  lancerRestitution, restitutionSuivante, encaisserNotes, tournerRoue,
  passerRoue, viser, finirOuContinuer, viewFor, makeRng,
  PHASE, DUREE_PRISE, MANCHE_ROUE, CASES, SABOTAGES,
} from '../../../shared/mimic/partie.js';
import { rendre, dureeDe } from '../../../shared/mimic/sons.js';
import { analyser, noter } from '../../../shared/mimic/analyse.js';
import { prise as prisebot, adversaires } from '../../../shared/mimic/bots.js';
import * as audio from './audio.js';
import * as ui from './ui.js';

let etat = null;
let rng = null;
let prises = new Map();     // joueurId -> échantillons de la manche
let sortie = () => {};
let rejouer = () => {};
let stop = false;

export function arreter() { stop = true; etat = null; prises.clear(); }
export const enCours = () => !!etat;

export async function demarrer({ nb, niveau, onExit, onAgain }) {
  stop = false;
  sortie = onExit;
  rejouer = onAgain;

  rng = makeRng(Date.now());
  const bots = adversaires(nb, niveau, rng);
  etat = creerPartie([{ id: 'moi', name: 'Vous' }, ...bots], { seed: Math.floor(rng() * 2 ** 31) });
  etat.bots = new Map(bots.map((b) => [b.id, b.niveau]));

  ui.fermerFin();
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
  const v = viewFor(etat, 'moi');
  ui.consigne(son);
  ui.phase(v, 'Écoutez');
  ui.tableau(v);
  ui.scene('Le son ne passe qu\'une fois.', 'doux');
  ui.actions([{ id: 'ecouter', label: '🔊 Jouer le son' }]);

  await attendre('ecouter');
  if (stop) return;

  ui.actions([]);
  ui.onde(true, 'var(--vif)');
  ui.scene('…', 'gros');
  await audio.jouer(rendre(son, audio.SR), audio.SR);
  ui.onde(false);
  await ui.sleep(250);
}

async function phaseEnregistrement() {
  const son = sonDeLaManche(etat);
  lancerEnregistrement(etat);
  let v = viewFor(etat, 'moi');
  ui.phase(v, 'À vous');
  ui.tableau(v);
  ui.scene('Préparez-vous.', 'doux');
  ui.actions([]);

  await ui.compteARebours(3);
  if (stop) return;

  // Les bots enregistrent pendant le même temps que vous. Leur prise est
  // calculée ici pour pouvoir être jouée ensuite.
  const ref = analyser(rendre(son, audio.SR), audio.SR);
  for (const [id, niv] of etat.bots) {
    const p = prisebot(son, niv, audio.SR, rng);
    prises.set(id, p.samples);
    deposerPrise(etat, id, noter(ref, analyser(p.samples, audio.SR)));
  }

  ui.scene('Imitez !', 'gros vif');
  ui.onde(true, 'var(--chaud)');
  ui.vumetre(true);

  let mien = null;
  let panne = null;
  try {
    mien = await audio.enregistrer(DUREE_PRISE, ui.niveau);
  } catch (e) {
    panne = e.message || 'Micro indisponible.';
  }
  ui.onde(false);
  ui.vumetre(false);

  // Un micro absent doit se dire une bonne fois, pas se répéter en silence à
  // chaque manche pendant qu'on encaisse des zéros sans comprendre.
  if (panne) {
    ui.scene(panne, 'gros chaud');
    ui.actions([
      { id: 'reessayer', label: '🎤 Réessayer' },
      { id: 'quitter', label: 'Quitter', cls: 'btn-ghost' },
    ]);
    const quoi = await attendre(['reessayer', 'quitter']);
    if (quoi === 'quitter') { arreter(); sortie(); return; }
    ui.actions([]);
    ui.scene('Imitez !', 'gros vif');
    ui.onde(true, 'var(--chaud)');
    ui.vumetre(true);
    try { mien = await audio.enregistrer(DUREE_PRISE, ui.niveau); }
    catch { ui.toast('Toujours pas de micro. La manche compte pour zéro.', 3200); }
    ui.onde(false);
    ui.vumetre(false);
  }

  if (mien) {
    prises.set('moi', mien);
    deposerPrise(etat, 'moi', noter(ref, analyser(mien, audio.SR)));
  }
  v = viewFor(etat, 'moi');
  ui.tableau(v);
  await ui.sleep(300);
}

async function phaseRestitution() {
  lancerRestitution(etat);
  let v = viewFor(etat, 'moi');
  ui.phase(v, 'On réécoute');

  let i = 0;
  do {
    v = viewFor(etat, 'moi');
    const j = v.joueurs[i];
    if (!j) break;
    ui.tableau(v, { surligne: i });
    const sab = j.sabotage ? SABOTAGES[j.sabotage] : null;
    ui.scene(sab ? `${esc(j.name)} — ${sab.glyph} ${sab.label} !` : `${esc(j.name)}`, sab ? 'gros chaud' : 'gros');

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
  while (etat.phase === PHASE.RESTITUTION) restitutionSuivante(etat);
}

const esc = ui.esc;

async function phaseNotes() {
  let v = viewFor(etat, 'moi');
  ui.phase(v, 'Les notes');
  ui.tableau(v);
  const moi = v.joueurs[v.viewer];
  ui.scene(moi.prise && !moi.prise.absente ? `${moi.prise.note} / 100` : 'Pas de prise', 'gros');
  document.getElementById('scene-txt').insertAdjacentHTML('afterend',
    `<div class="detail" id="detail">${ui.detailNote(moi.prise)}</div>`);
  ui.actions([{ id: 'suite', label: 'Continuer' }]);
  await attendre('suite');
  const d = document.getElementById('detail');
  if (d) d.remove();
  encaisserNotes(etat);
  ui.tableau(viewFor(etat, 'moi'));
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

  let v = viewFor(etat, 'moi');
  ui.phase(v, 'La roue');
  ui.tableau(v);
  ui.actions([]);          // les boutons de la phase précédente n'ont plus cours
  ui.ouvrirRoue('La roue', 'Tourner, ou passer. La roue ne doit rien à personne.');
  ui.roueActions([
    { id: 'tourner', label: '🎡 Tourner' },
    { id: 'passer', label: 'Passer', cls: 'btn-ghost' },
  ]);

  const choix = await attendre(['tourner', 'passer']);
  if (stop) return;

  if (choix === 'passer') {
    passerRoue(etat, 'moi');
  } else {
    ui.roueActions([]);
    const r = tournerRoue(etat, 'moi');
    if (r.ok && r.case) {
      await ui.tournerRoue(r.case);
      ui.ouvrirRoue(`${r.case.glyph} ${r.case.label}`, r.case.blurb);
      if (r.viser) {
        ui.choisirCible(viewFor(etat, 'moi'), r.case.sabotage);
        const cible = await attendre(null, (a) => a.startsWith('cible:'));
        if (stop) return;
        viser(etat, 'moi', cible.slice('cible:'.length));
      }
    }
    ui.roueActions([{ id: 'fini', label: 'Suite' }]);
    await attendre('fini');
  }

  ui.fermerRoue();
  ui.tableau(viewFor(etat, 'moi'));
}

function terminer() {
  const v = viewFor(etat, 'moi');
  ui.phase(v, 'Terminé');
  ui.tableau(v);
  ui.fin(v, {
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
