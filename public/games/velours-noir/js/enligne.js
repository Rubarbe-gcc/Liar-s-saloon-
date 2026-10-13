/**
 * LE VELOURS NOIR — la connexion aux tables en ligne.
 *
 * Une seule connexion pour les trois jeux (serveur Render, champ g =
 * 'velours'). La place occupée (code de table + jeton de place) est notée :
 * si la page se recharge ou si le réseau saute, on la redemande au serveur
 * (`revenir`), qui renvoie tout l'état de la table.
 */

import { creerConnexion } from '../../../shared/connexion.js';
import * as succes from '../../../shared/succes.js';

const CLE = 'velours.enligne';
/** Au-delà, la place est forcément perdue (le serveur la garde 2 minutes). */
const VIEILLE = 10 * 60 * 1000;

const ecouteurs = new Set();
let cx = null;
let statut = 'hors';
/** Ce qu'on a demandé avant que la connexion soit ouverte. */
let enAttente = [];

const lire = () => { try { return JSON.parse(sessionStorage.getItem(CLE)); } catch { return null; } };
const noter = (o) => { try { sessionStorage.setItem(CLE, JSON.stringify({ ...o, t: Date.now() })); } catch { /* ignore */ } };
export const oublier = () => { try { sessionStorage.removeItem(CLE); } catch { /* ignore */ } };
/** La place notée, si elle peut encore exister. */
export function placeNotee() {
  const p = lire();
  return p && Date.now() - p.t < VIEILLE ? p : null;
}

function emettre(m) { for (const f of ecouteurs) { try { f(m); } catch (err) { console.error(err); } } }

function recevoir(m) {
  if (!m || m.g !== 'velours') return;
  if (m.t === 'entre') noter({ code: m.code, jeton: m.jeton, jeu: m.jeu });
  if (m.t === 'parti' || m.t === 'perdu') oublier();
  emettre(m);
}

/** Ouvre la connexion (si besoin). */
export function connecter() {
  if (!cx) {
    cx = creerConnexion({
      jeu: 'velours',
      g: 'velours',
      session: false,
      message: recevoir,
      statut: (s) => { statut = s; emettre({ t: 'statut', s }); },
      ouverte: () => {
        const p = placeNotee();
        if (p) cx.envoyer({ t: 'revenir', code: p.code, jeton: p.jeton });
        const a = enAttente; enAttente = [];
        for (const m of a) cx.envoyer(m);
        emettre({ t: 'ouverte' });
      },
    });
  }
  cx.ouvrir();
  return cx;
}

export const connecte = () => !!cx?.ouverte();
export const etatConnexion = () => statut;
export function envoyer(m) { return !!cx?.envoyer(m); }
/** Envoie dès que possible (la connexion peut être en train de s'ouvrir, le serveur de se réveiller). */
function demander(m) {
  connecter();
  if (cx.ouverte()) cx.envoyer(m);
  else { enAttente = enAttente.filter((x) => x.t !== m.t); enAttente.push(m); }
  return true;
}
export function ecouter(f) { ecouteurs.add(f); return () => ecouteurs.delete(f); }

export function identite() {
  const p = succes.profil();
  return { nom: p.pseudo || 'Joueur', avatar: p.avatar || '🙂' };
}
const nouveauJeton = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function creer(jeu, o = {}) { return demander({ t: 'creer', jeu, ...identite(), ...o, jeton: nouveauJeton() }); }
export function rejoindre(code, o = {}) { return demander({ t: 'rejoindre', code, ...identite(), ...o, jeton: nouveauJeton() }); }
export function info(code) { return demander({ t: 'info', code }); }
export function lister(jeu) { return demander({ t: 'tables', jeu }); }
export function quitter() { envoyer({ t: 'quitter' }); oublier(); }
