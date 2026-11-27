/**
 * PARE-FEU — le jeu en ligne, côté navigateur.
 *
 * Le serveur (server/parefeu.js) fait tourner la partie et envoie l'état vu
 * par ce joueur environ 7 fois par seconde. Entre deux états, on prédit :
 * le moteur avance en mode `prediction` (les programmes avancent, rien
 * n'arrive) jusqu'à l'image où le serveur doit en être, d'après l'horloge
 * des états reçus. Les ordres partent au serveur, qui les vérifie.
 *
 * Une coupure en pleine partie n'est pas un départ : on se reconnecte avec la
 * même clé de session et le serveur rend la place (shared/connexion.js,
 * shared/reprise.js).
 */

import { DT, COULEURS, NIVEAUX } from '../../../shared/parefeu/donnees.js';
import { pas } from '../../../shared/parefeu/partie.js';
import * as reprise from '../../../shared/reprise.js';
import { creerConnexion } from '../../../shared/connexion.js';

const $ = (id) => document.getElementById(id);
const JEU = 'parefeu';

let o = null;
let monId = null;
let salon = null;
let moi = -1;
let enJeu = false;
let attendReprise = false;
let codeVoulu = null;
let demarre = false;
let decalage = Infinity;
let niveauBots = 'normal';

export const estHote = () => !!salon && salon.hostId === monId;

function statut(m, cls = '') {
  const e = $('en-statut');
  e.textContent = m;
  e.className = `note ${cls}`;
}

const net = creerConnexion({
  jeu: JEU,
  g: JEU,
  ouverte: () => envoyer({ t: 'hello', name: nom() }),
  message: (m) => traiter(m),
  enPartie: () => enJeu,
  code: () => salon?.code,
  statut: (s) => {
    if (s === 'connexion') statut('Connexion au serveur…');
    else if (s === 'connecte') statut('Connecté. Ouvre une salle, ou entre un code.', 'ok');
    else {
      if (enJeu) o.toast('Connexion perdue : on se reconnecte, ta place t’attend…', 3500);
      statut(s === 'injoignable' ? 'Le serveur ne répond pas (il se réveille peut-être). On réessaie…' : 'Connexion perdue. Nouvelle tentative…', 'ko');
    }
  },
});

const envoyer = (msg) => net.envoyer(msg);
const nom = () => ($('en-nom').value.trim() || o.nomPrefere() || 'ROOT').slice(0, 14);

function connecter() {
  if (!net.voulue() && !salon) attendReprise = reprise.adopter(JEU);
  net.ouvrir();
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function traiter(m) {
  switch (m.t) {
    case 'pf:bienvenue': monId = m.id; return;

    case 'session':
      if (m.repris) { attendReprise = false; o.toast('✅ Te revoilà dans la partie.', 2400); return; }
      if (attendReprise) {
        attendReprise = false;
        reprise.oublier(JEU);
        if (!enJeu) o.toast('Cette partie n’existe plus : elle est finie, ou l’attente a dépassé 5 minutes.', 3800);
      }
      if (enJeu) {
        finirLocal();
        o.quitter();
        o.aller('s-enligne');
        porte(true);
        o.toast('La partie a continué sans toi.', 3200);
      } else if (salon) {
        envoyer({ t: 'join', code: salon.code, name: nom() });
      } else if (codeVoulu) {
        envoyer({ t: 'join', code: codeVoulu, name: nom() });
        codeVoulu = null;
      }
      return;

    case 'pf:salon':
      salon = m;
      if (!m.enPartie && enJeu && !o.enJeu()) finirLocal();
      if (!o.enJeu()) {
        rendreSalon();
        if (o.ecran() !== 's-enligne') o.aller('s-enligne');
      }
      return;

    case 'pf:debut':
      moi = m.moi;
      enJeu = true;
      demarre = false;
      decalage = Infinity;
      reprise.enPartie(JEU, { code: salon?.code });
      return;

    case 'pf:etat': {
      const E = m.e;
      const now = performance.now() / 1000;
      const d = now - E.tick * DT;
      // L'horloge du serveur : le plus petit décalage vu, qui remonte doucement (dérive, gigue).
      decalage = Math.min(decalage + 0.002, d);
      if (!enJeu) { enJeu = true; reprise.enPartie(JEU, { code: salon?.code }); }
      if (!demarre || !o.enJeu()) {
        demarre = true;
        o.demarrer({ E, moi, enligne: true, envoyer: (c) => envoyer({ t: 'cmd', c }), avancer });
        if (m.ev?.length) o.recevoir(E, m.ev);
      } else o.recevoir(E, m.ev);
      if (E.fini) { enJeu = false; reprise.oublier(JEU); }
      return;
    }

    case 'pf:notice': o.toast(m.msg, 3200); return;
    case 'pf:erreur': o.toast(m.msg, 3200); return;
    case 'pf:parti':
      salon = null;
      finirLocal();
      porte(true);
      return;
    default:
  }
}

/** Entre deux états : le moteur avance seul jusqu'à l'image du serveur. */
function avancer(E) {
  if (!E || E.fini || !isFinite(decalage)) return;
  const cible = Math.floor((performance.now() / 1000 - decalage) / DT);
  let n = 0;
  while (E.tick < cible && n++ < 8) pas(E, { prediction: true });
}

function finirLocal() {
  enJeu = false;
  demarre = false;
  reprise.oublier(JEU);
}

/* ------------------------------------------------------------------ */
/* Le vestiaire                                                        */
/* ------------------------------------------------------------------ */

function porte(ouverte) {
  $('en-porte').hidden = !ouverte;
  $('en-salon').hidden = ouverte;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function rendreSalon() {
  if (!salon) { porte(true); return; }
  porte(false);
  const hote = estHote();
  $('en-code-salle').textContent = salon.code;
  const n = salon.joueurs.length;
  $('en-joueurs').innerHTML = salon.joueurs.map((j, k) => {
    const eq = salon.mode === '2v2' ? `<span class="equipe">Équipe ${k < 2 ? 'A' : 'B'}</span>` : '';
    return `<li style="color:${COULEURS[k]}"><span class="pastille"></span><b style="color:#fff">${esc(j.name)}</b>
      ${j.id === salon.hostId ? '<i class="etiq">hôte</i>' : ''}${j.bot ? `<i class="etiq">bot ${NIVEAUX[j.niveau]?.nom.toLowerCase() || ''}</i>` : ''}${j.id === monId ? '<i class="etiq">toi</i>' : ''}${j.absent ? '<i class="etiq">absent</i>' : ''}${eq}</li>`;
  }).join('') + (salon.mode === '2v2' && n < 4 ? `<li style="color:#6b7a99">${4 - n} place${4 - n > 1 ? 's' : ''} libre${4 - n > 1 ? 's' : ''} : des bots les prendront</li>` : '');
  $('en-hote').hidden = !hote;
  $('en-mode').querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.v === salon.mode));
  const bots = salon.joueurs.filter((j) => j.bot).length;
  $('en-nb-bots').textContent = bots;
  $('en-moins').disabled = bots === 0;
  $('en-plus').disabled = n >= salon.max;
  $('en-lancer').hidden = !hote;
  $('en-lancer').disabled = salon.mode !== '2v2' && n < 2;
  $('en-note').textContent = hote
    ? (salon.mode !== '2v2' && n < 2 ? 'Partage le code, ou ajoute un bot : il faut au moins deux joueurs.' : `${n} joueur${n > 1 ? 's' : ''} dans la salle. Lance quand tout le monde est là.`)
    : 'L’hôte de la salle lance la partie.';
}

/* ------------------------------------------------------------------ */
/* Pour main.js                                                        */
/* ------------------------------------------------------------------ */

export function init(api) {
  o = api;
  $('en-creer').addEventListener('click', () => {
    const n = nom(); o.retenirNom(n);
    if (!net.ouverte()) { o.toast('Pas encore connecté…'); return; }
    envoyer({ t: 'create', name: n });
  });
  const rejoindre = () => {
    const code = $('en-code').value.trim().toUpperCase();
    if (code.length < 4) { o.toast('Le code fait 4 caractères.'); return; }
    const n = nom(); o.retenirNom(n);
    if (!net.ouverte()) { codeVoulu = code; connecter(); return; }
    envoyer({ t: 'join', code, name: n });
  };
  $('en-rejoindre').addEventListener('click', rejoindre);
  $('en-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') rejoindre(); });
  $('en-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) envoyer({ t: 'mode', mode: b.dataset.v }); });
  $('en-niveau').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    niveauBots = b.dataset.v;
    $('en-niveau').querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
  });
  $('en-plus').addEventListener('click', () => envoyer({ t: 'bot', delta: 1, niveau: niveauBots }));
  $('en-moins').addEventListener('click', () => envoyer({ t: 'bot', delta: -1 }));
  $('en-lancer').addEventListener('click', () => envoyer({ t: 'start' }));
  $('en-quitter').addEventListener('click', () => { envoyer({ t: 'leave' }); salon = null; porte(true); });
  $('en-copier').addEventListener('click', async () => {
    const url = `${location.origin}/games/pare-feu/?salle=${salon?.code || ''}`;
    try { await navigator.clipboard.writeText(url); o.toast('Lien copié.'); } catch { o.toast(url, 5000); }
  });

  reprise.surveiller(JEU);
  reprise.bandeau(JEU, {
    visible: () => !o.enJeu() && ['s-menu', 's-enligne'].includes(o.ecran()),
    rejoindre: () => { o.aller('s-enligne'); entrer(); },
  });
  const code = new URLSearchParams(location.search).get('salle');
  if (code) {
    codeVoulu = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setTimeout(() => { o.aller('s-enligne'); entrer(); }, 50);
  }
}

/** On arrive sur l'écran en ligne. */
export function entrer() {
  if (!$('en-nom').value) $('en-nom').value = o.nomPrefere();
  if (!salon) porte(true); else rendreSalon();
  connecter();
}

/** On quitte l'écran en ligne par la flèche. */
export function quitterPorte() {
  if (salon && !enJeu) { envoyer({ t: 'leave' }); salon = null; }
  if (!enJeu) net.fermer();
}

/** On quitte une partie en cours (ou finie). */
export function quitterPartie() {
  if (enJeu || salon) envoyer({ t: 'leave' });
  salon = null;
  finirLocal();
  porte(true);
}

export function rejouer() { envoyer({ t: 'rejouer' }); }
