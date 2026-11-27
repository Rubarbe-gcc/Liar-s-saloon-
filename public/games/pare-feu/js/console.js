/**
 * PARE-FEU — le mode réel, côté navigateur : un terminal où l'on tape de
 * vraies commandes (ping, curl, scp, ssh, ufw, apt…). L'interprétation vit
 * dans shared/parefeu/terminal.js ; ici, la saisie, l'historique (↑/↓), la
 * complétion (Tab) et l'affichage.
 */

import { interpreter, completer, adresses, COMMANDES } from '../../../shared/parefeu/terminal.js';
import { NOEUDS, AMELIORATIONS } from '../../../shared/parefeu/donnees.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function creerConsole(o) {
  const sortie = $('term-sortie');
  const saisie = $('term-saisie');
  const histo = [];
  let curseurH = 0;
  let courant = -1;

  function ligne(t, c = '') { const d = document.createElement('span'); d.className = `l ${c}`; d.textContent = t; sortie.appendChild(d); }
  function vider() { sortie.innerHTML = ''; }
  function defiler() { sortie.scrollTop = sortie.scrollHeight; }

  function invite() {
    const E = o.etat();
    if (!E) return;
    const nd = courant >= 0 ? E.noeuds[courant] : null;
    const nom = nd ? (nd.type === 'noyau' ? 'noyau' : NOEUDS[nd.type].nom.toLowerCase().replace(/[^a-z]/g, '')) : '~';
    const ip = nd ? adresses(E)[courant] : '~';
    $('term-prompt').textContent = `${o.pseudo().toLowerCase().replace(/[^a-z0-9]/g, '') || 'root'}@${nom}:${ip === '~' ? '~' : ip}$`;
  }

  function accueil() {
    vider();
    ligne('PARE-FEU — mode réel. De vraies commandes, expliquées à chaque fois.', 'info');
    ligne('Tape help pour la liste, arp -a pour voir les cibles, man ping pour comprendre une commande.', 'vrai');
    invite();
  }

  function executer(texte) {
    const E = o.etat();
    if (!E) return;
    const l = document.createElement('span');
    l.className = 'l cmd';
    l.textContent = texte;
    sortie.appendChild(l);
    const r = interpreter(E, o.moi(), texte, courant);
    if (r.effacer) vider();
    for (const x of r.sortie) ligne(x.t, x.c);
    if (r.courant != null) courant = r.courant;
    if (r.action) o.envoyer(r.action);
    if (texte.trim() && histo[histo.length - 1] !== texte.trim()) histo.push(texte.trim());
    curseurH = histo.length;
    invite();
    defiler();
  }

  saisie.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = saisie.value; saisie.value = ''; if (v.trim()) executer(v); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (curseurH > 0) saisie.value = histo[--curseurH]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (curseurH < histo.length - 1) saisie.value = histo[++curseurH]; else { curseurH = histo.length; saisie.value = ''; } }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const E = o.etat();
      if (!E) return;
      const r = completer(E, saisie.value);
      if (r.choix.length === 1) saisie.value = r.ligne;
      else if (r.choix.length > 1) { ligne(r.choix.join('   '), 'info'); defiler(); }
    }
    e.stopPropagation();
  });
  $('term-help').addEventListener('click', () => { executer('help'); saisie.focus(); });

  return {
    /** On démarre une partie en mode réel : on choisit son Noyau au départ. */
    demarrer(E, moi) {
      courant = E.joueurs[moi].noyau;
      accueil();
      setTimeout(() => saisie.focus(), 50);
    },
    /** Un clic sur un nœud à soi choisit la machine courante. */
    choisir(E, n) {
      if (n < 0) return;
      courant = n;
      ligne(`— machine ${adresses(E)[n]} —`, 'info');
      invite();
      defiler();
      saisie.focus();
    },
    /**
     * Pré-remplit l'invite avec la vraie commande d'une action (sans la lancer) :
     * on la lit, puis on la valide. k = clé d'action (ver, parefeu…) ou
     * d'amélioration (tourelle…). `cible` : le nœud visé, pour y mettre son IP.
     */
    proposer(k, cible) {
      const E = o.etat();
      if (!E) return;
      if (AMELIORATIONS[k]) { saisie.value = `sudo apt install ${k}`; saisie.focus(); return; }
      const C = COMMANDES[k];
      if (!C) return;
      let ex = C.exemple;
      if (cible != null && cible >= 0) ex = ex.replace(/10\.0\.\d+\.\d+/, adresses(E)[cible]);
      saisie.value = ex;
      saisie.focus();
      saisie.setSelectionRange(ex.length, ex.length);
      ligne(`↳ ${C.cmd} : ${C.vrai}`, 'vrai');
      defiler();
    },
    focus() { saisie.focus(); },
    sortieEl: sortie,
  };
}
