/**
 * ÉCHO — partie en ligne.
 *
 * Le serveur mène : il annonce la phase, on obéit. La seule chose que ce
 * client décide, c'est ce qu'il enregistre — et il transmet sa prise en même
 * temps que sa note, pour que les autres puissent l'entendre.
 *
 * En mode « chacun son tour », le serveur désigne qui enregistre ; les autres
 * se taisent et regardent son bonhomme chanter.
 */

import { PHASE, SABOTAGES, TOUR } from '../../../shared/mimic/partie.js';
import { getSon, rendre } from '../../../shared/mimic/sons.js';
import { analyserPrise, noter } from '../../../shared/mimic/analyse.js';
import * as audio from './audio.js';
import * as karaoke from './karaoke.js';
import * as ui from './ui.js';

const URL_WS = () =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;

let ws = null;
let monId = null;
let salon = null;
let vueCourante = null;
let reconnexions = 0;
let voulu = false;
let identite = { name: 'Voix', photo: null };

const auditeurs = { statut: [], salon: [], erreur: [], parti: [] };
export function ecouter(quoi, fn) { (auditeurs[quoi] = auditeurs[quoi] || []).push(fn); }
const dire = (quoi, ...a) => (auditeurs[quoi] || []).forEach((f) => f(...a));

export const moi = () => monId;

/* ------------------------------------------------------------------ */

export function connecter({ name, photo } = {}) {
  voulu = true;
  identite = { name: name || 'Voix', photo: photo || null };
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  dire('statut', 'connexion');
  try { ws = new WebSocket(URL_WS()); }
  catch { return dire('statut', 'injoignable'); }

  ws.addEventListener('open', () => {
    reconnexions = 0;
    dire('statut', 'connecte');
    envoyer({ t: 'hello', name: identite.name, photo: identite.photo });
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
    setTimeout(() => { if (voulu) connecter(identite); }, attente);
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

export const creer = (name, photo, reglages) => envoyer({ t: 'create', name, photo, reglages });
export const rejoindre = (code, name, photo) => envoyer({ t: 'join', code, name, photo });
export const lancer = () => envoyer({ t: 'start' });
export const quitterSalon = () => envoyer({ t: 'leave' });
export const reglages = (r) => envoyer({ t: 'reglages', ...r });
export function changerPhoto(photo) {
  identite.photo = photo;
  envoyer({ t: 'photo', photo });
}

/* ------------------------------------------------------------------ */

function traiter(m) {
  switch (m.t) {
    case 'e:bonjour': monId = m.id; return;
    case 'e:hello': return;
    case 'e:salon':
      salon = m;
      ui.definirVisages(m.joueurs);
      return dire('salon', m);
    case 'e:debut':
      mancheEnregistree = 0;
      mancheEcoutee = 0;
      ui.fermerFin();
      ui.vedette(null);
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

  switch (v.phase) {
    case PHASE.ECOUTE: return ecoute(v, m.sonId);
    case PHASE.ENREGISTREMENT: return enregistrement(v);
    case PHASE.NOTES: return notes(v);
    case PHASE.ROUE: return roue(v);
    case PHASE.FIN: return fin(v);
    default: return undefined;
  }
}

let sonManche = null;
let mancheEcoutee = 0;

async function ecoute(v, sonId) {
  const son = getSon(sonId || v.sonId);
  if (!son || mancheEcoutee === v.manche) return;
  mancheEcoutee = v.manche;
  sonManche = son;
  ui.consigne(son);
  ui.phase(v, 'Écoutez');
  ui.vedette(null);
  ui.scene('Le son ne passe qu\'une fois.', 'doux');
  ui.actions([]);
  karaoke.preparer(son);
  karaoke.lecture();
  await audio.jouer(rendre(son, audio.SR), audio.SR);
}

/** Dernière manche pour laquelle ce client a déjà enregistré. */
let mancheEnregistree = 0;

async function enregistrement(v) {
  const chacun = v.tourPar === TOUR.CHACUN;
  const aMoi = !chacun || v.enregistreur === v.viewer;

  if (!aMoi) {
    // Quelqu'un d'autre est en scène : on se tait et on le regarde.
    const j = v.joueurs[v.enregistreur];
    ui.phase(v, j ? `Au tour de ${j.name}` : 'Chacun son tour');
    if (mancheEnregistree === v.manche) {
      ui.scene(j ? `${j.name} imite… chut !` : 'On attend…', 'doux');
    } else {
      ui.scene(j ? `${j.name} imite… chut ! Votre tour arrive.` : 'On attend…', 'doux');
    }
    ui.vedette(v, v.enregistreur, 'chante');
    return;
  }

  if (mancheEnregistree === v.manche) return;
  mancheEnregistree = v.manche;
  ui.phase(v, chacun ? 'À vous !' : 'À vous');
  ui.vedette(null);   // le compte à rebours s'affiche en grand, au même endroit
  ui.actions([]);
  ui.scene(chacun ? 'C\'est votre tour. Les autres se taisent.' : 'Préparez-vous.', 'doux');
  await ui.compteARebours(3);

  ui.scene('Imitez !', 'gros vif');
  ui.vedette(v, v.viewer, 'chante');
  ui.vumetre(true);
  karaoke.demarrerPrise();

  let mien = null;
  try { mien = await audio.enregistrer(v.duree, ui.niveau, karaoke.ajouter); }
  catch (e) { ui.toast(e.message || 'Micro indisponible.', 3200); }

  ui.vumetre(false);
  karaoke.figer();
  ui.vedette(null);
  ui.scene(chacun ? 'Envoyé. Au suivant !' : 'Envoyé. On écoute tout le monde.', 'doux');

  if (mien && sonManche) {
    const ref = analyserPrise(rendre(sonManche, audio.SR), audio.SR);
    const note = noter(ref, analyserPrise(mien, audio.SR));
    envoyer({ t: 'prise', note, audio: audio.enBase64(audio.comprimer(mien)) });
  } else {
    envoyer({ t: 'prise', note: { total: 0, melodie: 0, rythme: 0, attaques: 0 }, audio: null });
  }
}

async function restituer(v, r) {
  const j = v.joueurs[r.index];
  if (!j) return;
  karaoke.montrer(false);
  ui.phase(v, 'On réécoute');
  const sab = r.sabotage ? SABOTAGES[r.sabotage] : null;
  ui.tableau(v, { surligne: r.index, chante: true });
  ui.vedette(v, r.index, `chante${sab ? ' sabote' : ''}`);
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
  ui.vedette(null);
  karaoke.montrer(false);
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
  ui.actions([]);
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
  ui.fermerRoue();
  ui.vedette(null);
  karaoke.montrer(false);
  ui.phase(v, 'Terminé');
  ui.actions([]);
  ui.fin(v, {
    onMenu: () => { ui.fermerFin(); quitterSalon(); ui.montrer('online'); },
    onAgain: () => { ui.fermerFin(); ui.montrer('online'); },
  });
}
