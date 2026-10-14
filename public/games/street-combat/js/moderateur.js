/**
 * STREET COMBAT — le mode modérateur (secret) : tous les combattants, leurs
 * arènes et leurs tenues, sans avoir à les gagner.
 *
 * L'entrée : cinq clics rapides sur le logo du menu ouvrent une petite
 * fenêtre où l'on donne le code. Comme au Velours Noir, le code n'est
 * vérifié que par le serveur (MODERATEUR_CODE, et seulement sur le compte de
 * la direction : MODERATEUR_PROFIL) ; il rend un jeton signé, lié au profil
 * de l'arcade, que le serveur revérifie à chaque visite. C'est le même jeton
 * qu'au Velours Noir : modérateur là-bas, modérateur ici.
 *
 * Ce que le mode ouvre n'est pas enregistré : en le quittant, on retrouve sa
 * vraie progression, et il ne donne aucun succès.
 */

import { creerConnexion } from '../../../shared/connexion.js';
import * as succes from '../../../shared/succes.js';

const CLE = 'velours.moderateur';
const lireJeton = () => { try { return JSON.parse(localStorage.getItem(CLE)); } catch { return null; } };
const ecrireJeton = (j) => { try { if (j) localStorage.setItem(CLE, JSON.stringify(j)); else localStorage.removeItem(CLE); } catch { /* ignore */ } };

let actif = false;
let cx = null;
let file = [];
let attente = null;
const ecouteurs = new Set();

export const estModerateur = () => actif;
/** Appelé quand le mode s'allume ou s'éteint. */
export const surChangement = (f) => ecouteurs.add(f);

function changer(oui) {
  if (oui === actif) return;
  actif = oui;
  for (const f of ecouteurs) f(actif);
}

/** Une connexion au serveur, le temps d'une vérification (pas de connexion pour les autres joueurs). */
function envoyer(m) {
  if (!cx) {
    cx = creerConnexion({
      jeu: 'velours', g: 'velours', session: false,
      message: recevoir,
      statut: () => {},
      ouverte: () => { const a = file; file = []; for (const x of a) cx.envoyer(x); },
    });
  }
  cx.ouvrir();
  if (cx.ouverte()) cx.envoyer(m); else file.push(m);
}
function fermerBientot() { setTimeout(() => { if (!attente && !file.length) cx?.fermer(); }, 800); }

function recevoir(m) {
  if (!m || m.g !== 'velours' || m.t !== 'moderateur') return;
  if (m.verif) {
    if (!m.ok) ecrireJeton(null);
    changer(!!m.ok);
  } else {
    if (m.ok && m.jeton) { ecrireJeton(m.jeton); changer(true); }
    attente?.(m);
    attente = null;
  }
  fermerBientot();
}

/** Au démarrage : s'il y a un jeton gardé, le serveur le revérifie. */
export function verifier() {
  const jeton = lireJeton();
  if (jeton) envoyer({ t: 'moderateur', jeton, profil: succes.codeProfil() });
}

/** Le code donné dans la fenêtre secrète. Rend { ok, msg }. */
export function essayer(code) {
  return new Promise((fin) => {
    const r = (m) => fin({ ok: !!m.ok, msg: m.msg || '' });
    attente = r;
    envoyer({ t: 'moderateur', code, profil: succes.codeProfil() });
    setTimeout(() => { if (attente === r) { attente = null; fin({ ok: false, msg: 'Le serveur ne répond pas. Réessayez dans un instant.' }); } }, 20000);
  });
}

/** Quitter le mode pour cette visite (le jeton reste : il reviendra à la prochaine). */
export function quitter() { changer(false); }
