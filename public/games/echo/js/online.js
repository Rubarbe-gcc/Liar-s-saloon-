/**
 * ÉCHO — partie en ligne.
 *
 * Le serveur mène : il annonce la phase, on obéit. La seule chose que ce
 * client décide, c'est ce qu'il enregistre — et il transmet sa prise en même
 * temps que sa note, pour que les autres puissent l'entendre.
 */

import {
  PHASE, DUREE_PRISE, SABOTAGES, CASES,
} from '../../../shared/mimic/partie.js';
import { getSon, rendre } from '../../../shared/mimic/sons.js';
import { analyser, noter } from '../../../shared/mimic/analyse.js';
import * as audio from './audio.js';
import * as ui from './ui.js';

const URL_WS = () =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;

let ws = null;
let monId = null;
let salon = null;
let vueCourante = null;
let phaseVue = null;
let reconnexions = 0;
let voulu = false;

const auditeurs = { statut: [], salon: [], erreur: [], parti: [] };
export function ecouter(quoi, fn) { (auditeurs[quoi] = auditeurs[quoi] || []).push(fn); }
const dire = (quoi, ...a) => (auditeurs[quoi] || []).forEach((f) => f(...a));

export const moi = () => monId;

/* ------------------------------------------------------------------ */

export function connecter({ name } = {}) {
  voulu = true;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  dire('statut', 'connexion');
  try { ws = new WebSocket(URL_WS()); }
  catch { return dire('statut', 'injoignable'); }

  ws.addEventListener('open', () => {
    reconnexions = 0;
    dire('statut', 'connecte');
    envoyer({ t: 'hello', name });
  });
  ws.addEventListener('message', (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    traiter(m);
  });
  ws.addEventListener('close', () => {
    if (!voulu) return;
    dire('statut', reconnexions > 4 ? 'injoignable' : 'perdu');
    if (reconnexions > 4) return;
    const attente = Math.min(8000, 700 * 2 ** reconnexions);
    reconnexions += 1;
    setTimeout(() => { if (voulu) connecter({ name }); }, attente);
  });
  ws.addEventListener('error', () => { /* le close suivra */ });
}

export function deconnecter() {
  voulu = false;
  try { ws && ws.close(); } catch { /* déjà fermée */ }
  ws = null;
}

function envoyer(o) {
  if (!ws || ws.readyState !== 1) return false;
  ws.send(JSON.stringify({ g: 'echo', ...o }));
  return true;
}

export const creer = (name) => envoyer({ t: 'create', name });
export const rejoindre = (code, name) => envoyer({ t: 'join', code, name });
export const lancer = () => envoyer({ t: 'start' });
export const quitterSalon = () => envoyer({ t: 'leave' });

/* ------------------------------------------------------------------ */

function traiter(m) {
  switch (m.t) {
    case 'e:bonjour': monId = m.id; return;
    case 'e:hello': return;
    case 'e:salon': salon = m; return dire('salon', m);
    case 'e:debut':
      phaseVue = null;
      ui.fermerFin();
      ui.bindActions(() => {});
      ui.montrer('jeu');
      return;
    case 'e:etat': return majEtat(m);
    case 'e:roue': return surRoue(m);
    case 'e:abandon':
      ui.toast('Il ne reste plus assez de monde.', 3000);
      return;
    case 'e:parti': salon = null; return dire('parti');
    case 'e:erreur': return dire('erreur', m.msg || 'Erreur inconnue.');
    default: return undefined;
  }
}

/* ------------------------------------------------------------------ */

async function majEtat(m) {
  const v = m.vue;
  vueCourante = v;

  // Une restitution arrive avec sa prise : on la joue, puis on se tait.
  if (m.restitution) return restituer(v, m.restitution);

  ui.tableau(v);

  if (v.phase !== phaseVue || v.manche !== (phaseVue && phaseVue.manche)) {
    phaseVue = v.phase;
  }

  switch (v.phase) {
    case PHASE.ECOUTE: return ecoute(v, m.sonId);
    case PHASE.ENREGISTREMENT: return enregistrer(v);
    case PHASE.NOTES: return notes(v);
    case PHASE.ROUE: return roue(v);
    case PHASE.FIN: return fin(v);
    default: return undefined;
  }
}

let sonManche = null;

async function ecoute(v, sonId) {
  const son = getSon(sonId || v.sonId);
  if (!son) return;
  sonManche = son;
  ui.consigne(son);
  ui.phase(v, 'Écoutez');
  ui.scene('Le son ne passe qu\'une fois.', 'doux');
  ui.actions([]);
  ui.onde(true, 'var(--vif)');
  await audio.jouer(rendre(son, audio.SR), audio.SR);
  ui.onde(false);
}

let dejaDepose = false;

async function enregistrer(v) {
  if (dejaDepose) return;
  dejaDepose = true;
  ui.phase(v, 'À vous');
  ui.actions([]);
  await ui.compteARebours(3);

  ui.scene('Imitez !', 'gros vif');
  ui.onde(true, 'var(--chaud)');
  ui.vumetre(true);

  let mien = null;
  try { mien = await audio.enregistrer(DUREE_PRISE, ui.niveau); }
  catch (e) { ui.toast(e.message || 'Micro indisponible.', 3200); }

  ui.onde(false);
  ui.vumetre(false);
  ui.scene('Envoyé. On écoute tout le monde.', 'doux');

  if (mien && sonManche) {
    const ref = analyser(rendre(sonManche, audio.SR), audio.SR);
    const note = noter(ref, analyser(mien, audio.SR));
    envoyer({ t: 'prise', note, audio: audio.enBase64(audio.comprimer(mien)) });
  } else {
    envoyer({ t: 'prise', note: { total: 0, melodie: 0, rythme: 0, attaques: 0 }, audio: null });
  }
}

async function restituer(v, r) {
  dejaDepose = false;
  const j = v.joueurs[r.index];
  if (!j) return;
  ui.phase(v, 'On réécoute');
  ui.tableau(v, { surligne: r.index });
  const sab = r.sabotage ? SABOTAGES[r.sabotage] : null;
  ui.scene(sab ? `${j.name} — ${sab.glyph} ${sab.label} !` : j.name, sab ? 'gros chaud' : 'gros');
  ui.actions([]);

  if (!r.audio) { ui.scene(`${j.name} n'a rien envoyé.`, 'doux'); return; }
  const brut = audio.decomprimer(audio.depuisBase64(r.audio));
  ui.onde(true, sab ? 'var(--chaud)' : 'var(--vif)');
  await audio.jouer(audio.saboter(brut, r.sabotage), audio.SR);
  ui.onde(false);
}

function notes(v) {
  const moiJ = v.joueurs[v.viewer];
  ui.phase(v, 'Les notes');
  ui.scene(moiJ && moiJ.prise && !moiJ.prise.absente ? `${moiJ.prise.note} / 100` : 'Pas de prise', 'gros');
  const host = document.getElementById('actions');
  host.innerHTML = `<div class="detail">${ui.detailNote(moiJ && moiJ.prise)}</div>`;
}

let roueOuverte = false;

function roue(v) {
  ui.phase(v, 'La roue');
  const moiJ = v.joueurs[v.viewer];
  if (!moiJ || moiJ.aTourne || roueOuverte) return;
  roueOuverte = true;
  ui.ouvrirRoue('La roue', 'Tourner, ou passer.');
  ui.roueActions([
    { id: 'tourner', label: '🎡 Tourner' },
    { id: 'passer', label: 'Passer', cls: 'btn-ghost' },
  ]);
  ui.bindActions((a) => {
    if (a === 'tourner') { ui.roueActions([]); envoyer({ t: 'roue', quoi: 'tourner' }); }
    else if (a === 'passer') { roueOuverte = false; ui.fermerRoue(); envoyer({ t: 'roue', quoi: 'passer' }); }
    else if (a.startsWith('cible:')) {
      roueOuverte = false;
      ui.fermerRoue();
      envoyer({ t: 'roue', quoi: 'viser', cible: a.slice('cible:'.length) });
    } else if (a === 'fini') { roueOuverte = false; ui.fermerRoue(); }
  });
}

async function surRoue(m) {
  if (!m.case) { roueOuverte = false; return ui.fermerRoue(); }
  await ui.tournerRoue(m.case);
  ui.ouvrirRoue(`${m.case.glyph} ${m.case.label}`, m.case.blurb);
  if (m.viser && vueCourante) {
    ui.choisirCible(vueCourante, m.case.sabotage);
  } else {
    ui.roueActions([{ id: 'fini', label: 'Suite' }]);
  }
}

function fin(v) {
  roueOuverte = false;
  dejaDepose = false;
  ui.fermerRoue();
  ui.phase(v, 'Terminé');
  ui.actions([]);
  ui.fin(v, {
    onMenu: () => { ui.fermerFin(); quitterSalon(); ui.montrer('online'); },
    onAgain: () => { ui.fermerFin(); ui.montrer('online'); },
  });
}
