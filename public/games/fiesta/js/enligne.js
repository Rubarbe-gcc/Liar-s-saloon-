/**
 * FIESTA — la partie en ligne : la connexion et le salon.
 *
 * Le serveur (server/fiesta.js) tient la partie. Ce module tient la
 * connexion, le salon où l'on se retrouve avec un code, et passe à l'écran
 * de jeu (main.js) tout ce qui concerne la partie elle-même : chaque état,
 * chaque lancer de dés.
 *
 * Une coupure en pleine partie n'est pas un départ : on se reconnecte avec la
 * même clé de session, et le serveur rend la place (voir shared/connexion.js
 * et shared/reprise.js).
 */

import * as P from '../../../shared/fiesta/partie.js';
import * as reprise from '../../../shared/reprise.js';
import { creerConnexion } from '../../../shared/connexion.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const JEU = 'fiesta';

let o = null;               // { aller, toast, recevoir, finir, nomPrefere, avatarPrefere, retenirNom }
let monId = null;
let salon = null;           // le dernier salon reçu
let enJeu = false;          // une partie est en cours à cette table
let attendReprise = false;  // on revient d'une partie interrompue
let codeVoulu = null;       // un code d'invitation à rejoindre dès la connexion

export const actif = () => enJeu;
export const monIdentifiant = () => monId;

/* ------------------------------------------------------------------ */
/* Connexion                                                          */
/* ------------------------------------------------------------------ */

function statut(m, cls = '') {
  const e = $('en-statut');
  e.textContent = m;
  e.className = `en-statut ${cls}`;
}

const net = creerConnexion({
  jeu: JEU,
  g: JEU,
  ouverte: () => envoyer({ t: 'hello', name: nom(), av: o.avatarPrefere() }),
  message: (m) => traiter(m),
  enPartie: () => enJeu,
  code: () => salon?.code,
  statut: (s) => {
    if (s === 'connexion') statut('Connexion…');
    else if (s === 'connecte') statut('Connecté ! Créez une partie, ou rejoignez celle d’un ami avec son code.', 'ok');
    else {
      if (enJeu) o.toast('Connexion perdue — on se reconnecte, votre place vous attend…', 3500);
      statut(s === 'injoignable' ? 'Le serveur ne répond pas. On réessaie…' : 'Connexion perdue. Nouvelle tentative…', 'ko');
    }
  },
});

export const envoyer = (msg) => net.envoyer(msg);
const nom = () => ($('en-nom').value.trim() || o.nomPrefere() || 'Joueur').slice(0, 12);

/** Ouvre l'écran en ligne et se connecte (ou retourne dans la partie en cours). */
export function ouvrir() {
  if (!$('en-nom').value) $('en-nom').value = o.nomPrefere() || '';
  if (!net.voulue() && !salon) attendReprise = reprise.adopter(JEU);
  if (!enJeu) {
    porte(!salon);
    if (salon) rendreSalon();
    o.aller('s-enligne');
  }
  net.ouvrir();
}

/** Quitter la table (et la partie). */
export function quitter() {
  envoyer({ t: 'leave' });
  salon = null;
  finirLocal();
  net.fermer();
}

/* ------------------------------------------------------------------ */
/* Messages du serveur                                                */
/* ------------------------------------------------------------------ */

function traiter(m) {
  switch (m.t) {
    case 'fi:bienvenue': monId = m.id; return;

    case 'session':
      if (m.repris) { attendReprise = false; o.toast('✅ Vous revoilà dans la partie !', 2400); return; }
      if (attendReprise) {
        attendReprise = false;
        reprise.oublier(JEU);
        o.toast('Cette partie n’existe plus : elle est finie, ou l’attente a dépassé 5 minutes.', 3800);
      }
      if (enJeu) {
        // La place n'a pas été gardée.
        finirLocal();
        salon = null;
        porte(true);
        o.aller('s-enligne');
        o.toast('La partie a continué sans vous.', 3200);
      } else if (salon) {
        // Au salon, une coupure libère la chaise : on la reprend.
        envoyer({ t: 'join', code: salon.code, name: nom(), av: o.avatarPrefere() });
      } else if (codeVoulu) {
        envoyer({ t: 'join', code: codeVoulu, name: nom(), av: o.avatarPrefere() });
        codeVoulu = null;
      }
      return;

    case 'fi:salon':
      salon = m;
      if (!m.enPartie) {
        if (enJeu) finirLocal();
        rendreSalon();
        if (!$('s-enligne').classList.contains('is-active')) o.aller('s-enligne');
      }
      return;

    case 'fi:debut':
      enJeu = true;
      reprise.enPartie(JEU, { code: salon?.code });
      o.recevoir(m);
      return;

    case 'fi:etat':
    case 'fi:lance':
    case 'fi:roule':
      if (!enJeu) { enJeu = true; reprise.enPartie(JEU, { code: salon?.code }); o.recevoir({ t: 'fi:debut', reprise: true }); }
      // Une partie finie ne se reprend plus.
      if (m.t === 'fi:etat' && m.vue.p.phase === 'fin') reprise.oublier(JEU);
      o.recevoir(m);
      return;

    case 'fi:notice': o.toast(m.msg, 3400); return;
    case 'fi:erreur': o.toast(m.msg, 3200); if (enJeu) o.recevoir(m); return;
    case 'fi:parti':
      salon = null;
      finirLocal();
      return;
    default:
  }
}

function finirLocal() {
  const etait = enJeu;
  enJeu = false;
  reprise.oublier(JEU);
  if (etait) o.finir();
}

/* ------------------------------------------------------------------ */
/* Le salon                                                           */
/* ------------------------------------------------------------------ */

function porte(ouverte) {
  $('en-porte').hidden = !ouverte;
  $('en-salon').hidden = ouverte;
}

function rendreSalon() {
  porte(false);
  const hote = salon.hostId === monId;
  $('en-code-table').textContent = salon.code;
  const vides = Array.from({ length: salon.max - salon.joueurs.length }, () => '<div class="place vide"><span class="av">·</span><span class="sous" style="margin:0">Place libre</span></div>');
  $('en-joueurs').innerHTML = salon.joueurs.map((j) => `<div class="place${j.id === monId ? ' moi' : ''}" style="--pc:${j.couleur}">
      <button class="av" ${j.id === monId ? 'data-avatar title="Changer d’avatar"' : 'disabled'}>${j.av}</button>
      <b>${esc(j.name)}</b>
      <span class="etiquettes">${j.id === salon.hostId ? '<i class="etiq">hôte</i>' : ''}${j.bot ? '<i class="etiq">ordi</i>' : ''}${j.id === monId ? '<i class="etiq vous">vous</i>' : ''}</span>
    </div>`).join('') + vides.join('');
  const n = salon.joueurs.length;
  const bots = salon.joueurs.filter((j) => j.bot).length;
  $('en-bots').hidden = !hote;
  $('en-nb-bots').textContent = bots;
  $('en-moins').disabled = bots === 0;
  $('en-plus').disabled = n >= salon.max;
  for (const k of ['niveau', 'longueur', 'modes']) {
    $(`en-${k}`).value = salon.options[k];
    $(`en-${k}`).disabled = !hote;
  }
  $('en-lancer').hidden = !hote;
  $('en-lancer').disabled = n < 2;
  $('en-note').textContent = hote
    ? (n < 2 ? 'Partagez le code, ou ajoutez un ordi : il faut au moins deux joueurs.' : `${n} joueurs. Lancez quand tout le monde est là !`)
    : 'L’hôte lance la partie.';
}

/* ------------------------------------------------------------------ */
/* Branchements                                                       */
/* ------------------------------------------------------------------ */

export function init(opts) {
  o = opts;
  const code = new URLSearchParams(location.search).get('table');
  if (code) {
    codeVoulu = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    history.replaceState(null, '', location.pathname);
    setTimeout(ouvrir, 0);
  }

  $('en-creer').addEventListener('click', () => {
    o.retenirNom(nom());
    if (!envoyer({ t: 'create', name: nom(), av: o.avatarPrefere() })) o.toast('Pas encore connecté…');
  });
  const rejoindre = () => {
    const c = $('en-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (c.length < 4) { o.toast('Le code fait 4 caractères.'); return; }
    o.retenirNom(nom());
    if (!envoyer({ t: 'join', code: c, name: nom(), av: o.avatarPrefere() })) o.toast('Pas encore connecté…');
  };
  $('en-rejoindre').addEventListener('click', rejoindre);
  $('en-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') rejoindre(); });
  $('en-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
  $('en-plus').addEventListener('click', () => envoyer({ t: 'bot', delta: 1 }));
  $('en-moins').addEventListener('click', () => envoyer({ t: 'bot', delta: -1 }));
  $('en-lancer').addEventListener('click', () => envoyer({ t: 'start' }));
  $('en-joueurs').addEventListener('click', (e) => { if (e.target.closest('[data-avatar]')) envoyer({ t: 'avatar' }); });
  for (const k of ['niveau', 'longueur', 'modes']) {
    $(`en-${k}`).addEventListener('change', () => envoyer({
      t: 'options', options: { niveau: $('en-niveau').value, longueur: $('en-longueur').value, modes: $('en-modes').value },
    }));
  }
  $('en-quitter').addEventListener('click', () => { quitter(); porte(true); });
  $('en-retour').addEventListener('click', () => {
    // Au salon, revenir au menu, c'est quitter la table.
    if (salon) quitter(); else net.fermer();
    o.aller('s-menu');
  });
  $('en-code-table').addEventListener('click', async () => {
    if (!salon) return;
    const lien = `${location.origin}/games/fiesta/?table=${salon.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Fiesta', text: `Viens jouer à FIESTA ! Code ${salon.code}`, url: lien });
      else { await navigator.clipboard.writeText(lien); o.toast('Lien d’invitation copié.'); }
    } catch { /* partage annulé */ }
  });
  reprise.surveiller(JEU);
}

