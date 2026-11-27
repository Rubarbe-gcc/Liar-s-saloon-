/**
 * PARE-FEU — les écrans, la partie contre l'ordinateur, les commandes et le HUD.
 *
 * Une partie en cours est une « session » : { E, moi, envoyer(c), enligne }.
 * Contre l'ordinateur, le moteur tourne ici ; en ligne, js/enligne.js reçoit
 * les états du serveur et prédit entre deux.
 */

import { DT, PROGRAMMES, DEFENSES, BRECHE, COULEURS, NOEUDS, LISTE_PROGRAMMES, LISTE_DEFENSES } from '../../../shared/parefeu/donnees.js';
import { creerPartie, pas, verifier, commande } from '../../../shared/parefeu/partie.js';
import { ami, frontiere, recharge, voit, allies, action } from '../../../shared/parefeu/regles.js';
import { creerRendu } from './rendu.js';
import * as son from './sons.js';
import * as enligne from './enligne.js';
import { creerDefis } from './defi.js';
import * as succes from '../../../shared/succes.js';

const $ = (id) => document.getElementById(id);
const rendu = creerRendu($('scene'));
const CLE_NOM = 'parefeu.nom';

/* ------------------------------------------------------------------ */
/* Écrans                                                              */
/* ------------------------------------------------------------------ */

let ecran = 's-menu';
const pile = [];
function aller(id, empiler = true) {
  if (empiler && ecran !== id) pile.push(ecran);
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id));
  ecran = id;
}
function retour() { aller(pile.pop() || 's-menu', false); }
document.querySelectorAll('[data-retour]').forEach((b) => b.addEventListener('click', () => { son.jouer('clic'); if (ecran === 's-enligne') enligne.quitterPorte(); retour(); }));

let minuteurToast = 0;
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { t.hidden = true; }, ms);
}
const ouvrir = (id) => { $(id).hidden = false; };
const fermer = (id) => { $(id).hidden = true; };

function choix(id, rappel) {
  const el = $(id);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    el.querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
    son.jouer('clic');
    rappel?.(b.dataset.v);
  });
  return () => el.querySelector('.is-active')?.dataset.v;
}

const nomPrefere = () => (localStorage.getItem(CLE_NOM) || succes.pseudo() || '').slice(0, 14);
function retenirNom(n) { if (n) localStorage.setItem(CLE_NOM, n.slice(0, 14)); }

/* ------------------------------------------------------------------ */
/* Menu, solo, aide                                                    */
/* ------------------------------------------------------------------ */

const NOTES_MODE = {
  ffa2: 'Toi contre un ordinateur.',
  ffa3: 'Trois réseaux, chacun pour soi.',
  ffa4: 'Quatre réseaux, chacun pour soi : le dernier Noyau debout gagne.',
  '2v2': 'Toi et un allié de l’ordinateur contre deux ordinateurs. Tu peux poser tes défenses chez ton allié.',
};
const modeSolo = choix('solo-mode', (v) => { $('solo-mode-note').textContent = NOTES_MODE[v]; });
const niveauSolo = choix('solo-niveau');
let derniereConf = null;

$('b-solo').addEventListener('click', () => { son.debloquer(); son.jouer('clic'); $('solo-nom').value = nomPrefere(); aller('s-solo'); });
$('b-enligne').addEventListener('click', () => { son.debloquer(); son.jouer('clic'); aller('s-enligne'); enligne.entrer(); });
$('b-aide').addEventListener('click', () => { son.jouer('clic'); aller('s-aide'); });
$('b-son').addEventListener('click', () => { const a = son.basculer(); $('b-son').setAttribute('aria-pressed', String(a)); $('b-son').textContent = a ? '♪ Sons' : '♪ Muet'; });
if (!son.estActif()) { $('b-son').setAttribute('aria-pressed', 'false'); $('b-son').textContent = '♪ Muet'; }

$('b-lancer').addEventListener('click', () => {
  son.debloquer();
  const nom = $('solo-nom').value.trim() || nomPrefere() || 'ROOT';
  retenirNom(nom);
  derniereConf = { mode: modeSolo(), niveau: niveauSolo(), nom };
  lancerSolo(derniereConf);
});

function lancerSolo({ mode, niveau, nom }) {
  const n = mode === 'ffa3' ? 3 : (mode === 'ffa4' || mode === '2v2') ? 4 : 2;
  const joueurs = [{ nom }];
  for (let k = 1; k < n; k++) joueurs.push({ ia: niveau });
  const E = creerPartie({ joueurs, mode: mode === '2v2' ? '2v2' : 'ffa', graine: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
  demarrer({ E, moi: 0, enligne: false, envoyer: (c) => commande(E, 0, c) });
}

function remplirAide() {
  const carte = (A) => `<div class="carte"><span class="g">${A.glyphe}</span><b>${A.nom}</b> · ${A.cout} cycles<small>${A.aide} Recharge ${A.recharge} s.${A.defi ? ` Combinaison de ${A.defi + 1}.` : ''}</small></div>`;
  $('aide').innerHTML = `
    <p>Chaque joueur tient un <b>réseau</b> : un <b>Noyau</b> et trois serveurs. Si ton Noyau tombe, tu es éliminé. En 2 contre 2, l’équipe perd quand ses deux Noyaux sont tombés. Tout est inventé : des programmes imaginaires sur un réseau imaginaire.</p>
    <h3>&gt; Les cycles</h3>
    <p>Ta ressource monte toute seule (3 par seconde), et plus vite avec chaque nœud que tu tiens : serveur +${NOEUDS.serveur.revenu}, relais +${NOEUDS.relais.revenu}, Nexus (au centre) +${NOEUDS.nexus.revenu}.</p>
    <h3>&gt; Les mini-défis</h3>
    <p>Chaque action se gagne : une <b>combinaison</b> de flèches, de lettres et de chiffres à reproduire. Plus l’action est forte, plus elle est longue (3 symboles pour un ver, 6 pour une saturation). Le temps passé, l’action ne part pas (et ne coûte rien). Sans aucune faute, elle est <b>parfaite</b> : +25 % de dégâts ou de durée, +1 charge de pare-feu. La partie continue pendant le défi !</p>
    <h3>&gt; Attaquer</h3>
    <p>Touche un nœud <b>voisin</b> d’un des tiens (les cibles possibles ont un cercle pointillé), puis un programme. Il voyage le long du lien. Quand un nœud n’a plus de PV, il passe à toi. Le Noyau ne touche que ses serveurs : prends d’abord un serveur.</p>
    <div class="cartes">${LISTE_PROGRAMMES.map((k) => carte(PROGRAMMES[k])).join('')}${carte(BRECHE)}</div>
    <h3>&gt; Défendre</h3>
    <p>Touche un de tes nœuds (ou un de ton allié), puis une défense. Les défenses adverses sont cachées (<b>?</b>) tant qu’une sonde ne les a pas révélées.</p>
    <div class="cartes">${LISTE_DEFENSES.map((k) => carte(DEFENSES[k])).join('')}</div>
    <h3>&gt; La surchauffe</h3>
    <p>Au bout de 3 minutes tout frappe 1,5 fois plus fort, puis 2 fois (5 min) et 3 fois (7 min). À 10 minutes, l’équipe qui tient le plus de nœuds gagne.</p>
    <h3>&gt; Touches</h3>
    <p><kbd>1</kbd>–<kbd>5</kbd> : programmes (sur une cible) ou défenses (sur un nœud à toi) · <kbd>B</kbd> : brèche · dans une combinaison : flèches (ou <kbd>ZQSD</kbd>), lettres et chiffres, <kbd>Échap</kbd> pour renoncer · <kbd>Espace</kbd> : ton Noyau · <kbd>Tab</kbd> : cible suivante · <kbd>Échap</kbd> : pause.</p>`;
}
remplirAide();

/* ------------------------------------------------------------------ */
/* La partie                                                           */
/* ------------------------------------------------------------------ */

/** @type {{E:any, moi:number, enligne:boolean, envoyer:(c:any)=>any, pause?:boolean, vitesse?:number, finie?:boolean, elimineVu?:boolean, avancer?:(dt:number)=>any[]}|null} */
let S = null;
let selection = -1;
let acc = 0;
let demo = null;

function nouvelleDemo() {
  demo = creerPartie({ joueurs: [{ ia: 'normal' }, { ia: 'normal' }, { ia: 'difficile' }, { ia: 'normal' }], graine: (Math.random() * 1e9) >>> 0 });
}
nouvelleDemo();

function demarrer(session) {
  S = { pause: false, vitesse: 1, finie: false, elimineVu: false, ...session };
  selection = -1;
  acc = 0;
  modeActions = null;
  ['ov-fin', 'ov-pause', 'ov-elimine'].forEach(fermer);
  defis.fermer();
  aller('s-jeu', false);
  pile.length = 0;
  pile.push('s-menu');
  son.lancerNappe();
}
function quitterPartie() {
  if (S?.enligne) enligne.quitterPartie();
  S = null;
  defis.fermer();
  son.arreterNappe();
  ['ov-fin', 'ov-pause', 'ov-elimine'].forEach(fermer);
  aller('s-menu', false);
  pile.length = 0;
}

/** Les événements d'une image : effets et sons. */
function evenements(E, moi, evts) {
  rendu.effets(evts, E, moi);
  for (const e of evts) {
    const nd = E.noeuds[e.n];
    const chezMoi = nd && moi >= 0 && allies(E, moi, nd.proprio);
    switch (e.k) {
      case 'lance': if (e.j === moi) son.jouer(e.type === 'ver' ? 'lance' : e.type); break;
      case 'defense': if (e.j === moi) son.jouer(e.type === 'correctif' ? 'correctif' : 'defense'); break;
      case 'bloque': if (chezMoi || e.j === moi) son.jouer('bloque', 0.06); break;
      case 'impact': if (chezMoi) son.jouer('touche', 0.08); else if (e.j === moi) son.jouer('impact', 0.05); break;
      case 'zap': if (chezMoi || e.j === moi) son.jouer('zap', 0.05); break;
      case 'capture':
        if (moi >= 0 && allies(E, moi, e.j)) son.jouer('capture');
        else if (moi >= 0 && allies(E, moi, e.ancien)) son.jouer('perte');
        break;
      case 'elimine': son.jouer('noyau'); break;
      case 'vol': if (e.j === moi || e.p === moi) son.jouer('vol'); break;
      case 'sonde': if (e.j === moi) son.jouer('sonde'); break;
      case 'breche': if (e.j === moi) son.jouer('breche'); break;
      case 'sature': if (chezMoi) son.jouer('saturation', 0.2); break;
      default:
    }
  }
}

/** Reçu du serveur (en ligne) : un nouvel état et ses événements. */
export function recevoir(E, evts) {
  if (!S || !S.enligne) return;
  S.E = E;
  if (evts?.length) evenements(E, S.moi, evts);
}

let avant = performance.now();
function boucle(t) {
  requestAnimationFrame(boucle);
// Pour vérifier en local (aperçu, tests à la main).
if (/^(localhost|127.0.0.1)$/.test(location.hostname)) window.__parefeu = () => S;
  const dt = Math.min(0.1, (t - avant) / 1000);
  avant = t;

  if (!S) {
    // Le menu : une partie de démonstration tourne derrière.
    acc += dt;
    while (acc >= DT) { pas(demo); rendu.effets(demo.evts, demo, -1); acc -= DT; }
    if (demo.fini && demo.temps > 0) { if (!demo.finA) demo.finA = t; if (t - demo.finA > 4000) nouvelleDemo(); }
    rendu.dessiner(demo, -1, { now: t / 1000, dt, zone: { haut: 0, bas: 0 } });
    return;
  }

  const { moi } = S;
  if (S.enligne) {
    S.avancer?.(S.E, dt);
  } else if (!S.pause) {
    acc += dt * S.vitesse;
    let n = 0;
    while (acc >= DT && n++ < 12) {
      pas(S.E);
      if (S.E.evts.length) evenements(S.E, moi, S.E.evts);
      acc -= DT;
    }
  }
  const E = S.E;
  const J = E.joueurs[moi];
  const vivant = J && J.vivant && !E.fini;
  const attaquables = vivant ? new Set(frontiere(E, moi)) : new Set();
  const coeur = J ? E.noeuds[J.noyau] : null;
  const danger = vivant && coeur && coeur.proprio === moi ? Math.max(0, 1 - coeur.pv / coeur.max / 0.45) : 0;
  const zone = zoneHud();
  rendu.dessiner(E, vivant || !J ? moi : moi, { now: t / 1000, dt, selection, attaquables, danger, zone });
  hud(E, moi, t);
  defis.maj(t);

  if (J && !J.vivant && !E.fini && !S.elimineVu) {
    S.elimineVu = true;
    const allie = E.mode === '2v2' && E.joueurs.some((K, k) => k !== moi && K.vivant && allies(E, k, moi));
    $('el-texte').textContent = allie ? 'Ton Noyau est tombé. Ton allié se bat encore.' : 'Ton Noyau est tombé. La partie continue sans toi.';
    $('el-regarder').querySelector('b').textContent = S.enligne ? '◉ Regarder la fin' : '◉ Regarder la fin (en accéléré)';
    setTimeout(() => { if (S && !S.E.fini) ouvrir('ov-elimine'); }, 1200);
    son.jouer('defaite');
  }
  if (E.fini && !S.finie) {
    S.finie = true;
    setTimeout(() => montrerFin(), 1600);
  }
}

function zoneHud() {
  const h = document.querySelector('.hud-haut')?.offsetHeight || 60;
  const b = document.querySelector('.hud-bas')?.offsetHeight || 120;
  return { haut: h + 4, bas: b + 2 };
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let dernierHud = 0;
let modeActions = null;
let boutons = [];
let alerteVue = 0;

function hud(E, moi, t) {
  const J = E.joueurs[moi];
  if (!J) return;
  $('h-res').textContent = Math.floor(J.res);
  $('h-jauge').style.width = `${Math.min(100, (J.res / 160) * 100)}%`;
  const c = COULEURS[moi];
  document.querySelector('.cycles').style.setProperty('--c', c);
  majActions(E, moi);
  if (t - dernierHud < 150) return;
  dernierHud = t;
  $('h-rev').textContent = J.vivant ? `+${J.revenu.toFixed(1)}/s` : '';
  $('h-chrono').textContent = fmt(E.temps);
  const sur = $('h-surchauffe');
  sur.hidden = E.mult <= 1;
  if (E.mult > 1) sur.textContent = `SURCHAUFFE ×${E.mult}`;
  son.tension(E.mult);
  $('h-joueurs').innerHTML = E.joueurs.map((K, k) => {
    const n = E.noeuds.filter((nd) => nd.proprio === k).length;
    const eq = E.mode === '2v2' ? (K.equipe === J.equipe ? ' ·allié' : '') : '';
    return `<span class="puce ${K.vivant ? '' : 'mort'} ${k === moi ? 'moi' : ''}" style="color:${COULEURS[k]}"><b>${esc(K.nom)}</b>${K.vivant ? `◈${n}` : '✕'}${k === moi ? '' : eq}</span>`;
  }).join('');
  // L'alerte : mon Noyau est visé.
  const visé = J.vivant && E.progs.some((p) => p.vers === J.noyau && !allies(E, p.j, moi));
  const al = $('h-alerte');
  if (visé) {
    al.hidden = false;
    al.textContent = '⚠ NOYAU ATTAQUÉ';
    if (t - alerteVue > 2500) { son.jouer('alarme'); alerteVue = t; }
  } else al.hidden = true;
  info(E, moi);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function info(E, moi) {
  const el = $('h-info');
  const J = E.joueurs[moi];
  if (!J.vivant) { el.innerHTML = E.fini ? 'Partie terminée.' : 'Tu regardes la fin de la partie.'; return; }
  if (selection < 0) { el.innerHTML = 'Touche un nœud <b>voisin</b> pour l’attaquer, ou un des tiens pour le défendre.'; return; }
  const nd = E.noeuds[selection];
  const type = nd.eteint ? 'NOYAU ÉTEINT' : NOEUDS[nd.type].nom.toUpperCase();
  const qui = nd.proprio < 0 ? 'neutre' : nd.proprio === moi ? 'à toi' : esc(E.joueurs[nd.proprio].nom);
  const col = nd.proprio < 0 ? '#6b7a99' : COULEURS[nd.proprio];
  let def = '';
  if (voit(E, moi, nd.id)) {
    const d = [];
    if (nd.pf > 0) d.push(`▦×${nd.pf}`);
    if (nd.av > E.temps) d.push('✚');
    if (nd.leurre > E.temps && nd.leurreReste > 0) d.push('◌');
    if (nd.chiffre > E.temps) d.push('⌬');
    def = d.length ? ` · ${d.join(' ')}` : (nd.proprio >= 0 ? ' · sans défense' : '');
  } else def = ' · défenses ? (sonde)';
  if (nd.sature > E.temps) def += ' · <span style="color:#ff3b5c">SATURÉ</span>';
  const rev = NOEUDS[nd.eteint ? 'eteint' : nd.type].revenu;
  const portee = !ami(E, moi, nd.id) && !frontiere(E, moi).includes(nd.id) ? ' · <span style="color:#ff3b5c">hors de portée</span>' : '';
  el.innerHTML = `<b style="color:${col}">${type}</b> ${qui} · PV ${Math.ceil(nd.pv)}/${nd.max}${def}${rev ? ` · +${rev}/s` : ''}${portee}`;
}

function majActions(E, moi) {
  const J = E.joueurs[moi];
  let mode = null;
  if (J.vivant && !E.fini && selection >= 0) mode = ami(E, moi, selection) ? 'def' : 'att';
  if (mode !== modeActions) {
    modeActions = mode;
    const liste = mode === 'att' ? [...LISTE_PROGRAMMES, 'breche'] : mode === 'def' ? LISTE_DEFENSES : [];
    const box = $('h-actions');
    box.innerHTML = '';
    boutons = liste.map((k) => {
      const A = action(k);
      const b = document.createElement('button');
      b.className = 'act';
      b.type = 'button';
      b.dataset.t = k;
      const c = k === 'breche' ? '#ffb02e' : mode === 'att' ? COULEURS[moi] : '#7dff9b';
      b.style.setProperty('--c', c);
      b.innerHTML = `<span class="k">${A.touche}</span><span class="g">${A.glyphe}</span><span class="n">${A.court || A.nom}</span><span class="p">${A.cout}</span><span class="cd"></span>`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); agir(k); });
      box.appendChild(b);
      return { b, k, A, cd: b.querySelector('.cd'), etat: '' };
    });
  }
  for (const x of boutons) {
    const r = recharge(E, moi, x.k);
    const pret = r === 0;
    const assez = J.res >= x.A.cout;
    const v = x.k === 'breche' ? verifier(E, moi, { t: 'breche', cible: selection, score: 0 }) : verifier(E, moi, { t: x.k, cible: selection });
    const etat = `${pret && assez && v.ok ? 'pret' : ''} ${assez ? '' : 'pauvre'} ${v.ok || !pret || !assez ? '' : 'off'}`;
    if (etat !== x.etat) { x.b.className = `act ${etat}`; x.etat = etat; }
    x.cd.style.setProperty('--a', `${pret ? 0 : (r / x.A.recharge) * 360}deg`);
  }
}

/**
 * Une action : d'abord son mini-défi (plus long pour une action forte).
 * Réussi, l'ordre part (« parfait » sans faute) ; le temps écoulé, rien ne part.
 */
function agir(k) {
  if (!S || selection < 0 || defis.actif()) return;
  const { E, moi } = S;
  const cible = selection;
  const breche = k === 'breche';
  const v = verifier(E, moi, breche ? { t: k, cible, score: 0 } : { t: k, cible });
  if (!v.ok) { son.jouer('refus'); toast(v.raison, 1400); return; }
  const A = action(k);
  const x = boutons.find((b) => b.k === k);
  if (x) { x.b.classList.remove('flash'); void x.b.offsetWidth; x.b.classList.add('flash'); }
  defis.ouvrir({
    titre: `${A.glyphe} ${A.nom.toUpperCase()}`,
    n: breche ? BRECHE.longueur : A.defi + 1,
    temps: BRECHE.temps,
    breche,
    couleur: breche ? '#ffb02e' : DEFENSES[k] ? '#7dff9b' : COULEURS[moi],
    fin: (r) => {
      if (!S || !r.reussi) { if (S && !r.reussi) toast('Défi raté : l’action ne part pas.', 1300); return; }
      const c = breche ? { t: k, cible, score: r.score } : { t: k, cible, parfait: r.parfait };
      const w = verifier(S.E, S.moi, c);
      if (!w.ok) { son.jouer('refus'); toast(w.raison, 1400); return; }
      S.envoyer(c);
      if (r.parfait && !breche) { toast('★ PARFAIT : action renforcée', 900); son.jouer('capture', 0.2); }
    },
  });
}

const defis = creerDefis({ son: (n, e) => son.jouer(n, e) });

/* ------------------------------------------------------------------ */
/* Entrées                                                             */
/* ------------------------------------------------------------------ */

$('scene').addEventListener('pointerdown', (e) => {
  if (!S || ecran !== 's-jeu') return;
  son.debloquer();
  if (defis.actif()) return;
  const n = rendu.noeudSous(S.E, e.clientX, e.clientY);
  if (n !== selection) son.jouer('clic');
  selection = n;
});

function cibleSuivante() {
  if (!S) return;
  const f = frontiere(S.E, S.moi);
  if (!f.length) return;
  const i = f.indexOf(selection);
  selection = f[(i + 1) % f.length];
  son.jouer('clic');
}

addEventListener('keydown', (e) => {
  if (!S || ecran !== 's-jeu') return;
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (defis.actif()) {
    if (!e.repeat && defis.touche(k)) e.preventDefault();
    return;
  }
  if (k === 'Escape') { e.preventDefault(); basculerPause(); return; }
  if (k === ' ') { e.preventDefault(); selection = S.E.joueurs[S.moi].noyau; son.jouer('clic'); return; }
  if (k === 'Tab') { e.preventDefault(); cibleSuivante(); return; }
  if (k === 'b') { agir('breche'); return; }
  if (/^[1-5]$/.test(k)) {
    const x = boutons[Number(k) - 1];
    if (x && x.k !== 'breche') agir(x.k);
  }
});

function basculerPause() {
  if (!S) return;
  if ($('ov-pause').hidden) {
    if (!S.enligne) S.pause = true;
    $('p-reprendre').querySelector('b').textContent = S.enligne ? '▶ Retour à la partie' : '▶ Reprendre';
    $('p-quitter').querySelector('b').textContent = S.enligne ? '✕ Quitter la partie' : '✕ Abandonner';
    ouvrir('ov-pause');
  } else {
    S.pause = false;
    fermer('ov-pause');
  }
}
$('b-pause').addEventListener('click', () => { son.jouer('clic'); basculerPause(); });
$('p-reprendre').addEventListener('click', () => { son.jouer('clic'); basculerPause(); });
$('p-aide').addEventListener('click', () => { son.jouer('clic'); fermer('ov-pause'); aller('s-aide'); });
$('p-quitter').addEventListener('click', () => { son.jouer('clic'); quitterPartie(); });
// Revenir de l'aide pendant une partie : on retrouve la pause.
$('s-aide').querySelector('[data-retour]').addEventListener('click', () => { if (S) { aller('s-jeu', false); ouvrir('ov-pause'); } });

$('el-regarder').addEventListener('click', () => { son.jouer('clic'); fermer('ov-elimine'); if (S && !S.enligne) S.vitesse = 3; selection = -1; });
$('el-menu').addEventListener('click', () => { son.jouer('clic'); quitterPartie(); });

/* ------------------------------------------------------------------ */
/* Fin                                                                 */
/* ------------------------------------------------------------------ */

function montrerFin() {
  if (!S) return;
  const { E, moi } = S;
  fermer('ov-elimine'); fermer('ov-pause'); defis.fermer();
  const J = E.joueurs[moi];
  const gagne = J && J.equipe === E.gagnant;
  const titre = $('fin-titre');
  titre.textContent = gagne ? 'ACCÈS TOTAL' : 'CONNEXION PERDUE';
  titre.dataset.texte = titre.textContent;
  titre.classList.toggle('rouge', !gagne);
  const vainqueurs = E.joueurs.filter((K) => K.equipe === E.gagnant).map((K) => K.nom);
  $('fin-texte').textContent = gagne
    ? (E.mode === '2v2' ? 'Ton équipe a pris le réseau.' : 'Tous les Noyaux adverses sont tombés. Le réseau est à toi.')
    : (vainqueurs.length ? `Le réseau appartient à ${vainqueurs.join(' et ')}.` : 'Personne ne tient le réseau.');
  $('fin-bilan').innerHTML = `<tr><th>Joueur</th><th>Prises</th><th>Lancés</th><th>Bloqués</th><th>Dégâts</th><th>Volés</th></tr>${E.joueurs.map((K, k) => `<tr class="${K.equipe === E.gagnant ? 'gagne' : ''}" style="color:${COULEURS[k]}"><td>${esc(K.nom)}</td><td>${K.stats.captures}</td><td>${K.stats.lances}</td><td>${K.stats.bloques}</td><td>${Math.round(K.stats.degats)}</td><td>${K.stats.vols}</td></tr>`).join('')}`;
  $('fin-rejouer').hidden = S.enligne && !enligne.estHote();
  ouvrir('ov-fin');
  son.jouer(gagne ? 'victoire' : 'defaite');
  rendu.eclairer(gagne ? COULEURS[moi] : '#ff3b5c', 0.4);
  if (!S.enligne) S.vitesse = 1;
}
$('fin-rejouer').addEventListener('click', () => {
  son.jouer('clic');
  fermer('ov-fin');
  if (S?.enligne) { enligne.rejouer(); return; }
  if (derniereConf) lancerSolo(derniereConf);
});
$('fin-menu').addEventListener('click', () => { son.jouer('clic'); quitterPartie(); });

/* ------------------------------------------------------------------ */
/* En ligne                                                            */
/* ------------------------------------------------------------------ */

enligne.init({
  aller, toast, nomPrefere, retenirNom,
  demarrer: (session) => demarrer(session),
  recevoir,
  enJeu: () => !!S && S.enligne,
  fin: () => { if (S && S.enligne) S.finie = false; },
  quitter: () => { if (S?.enligne) { S = null; son.arreterNappe(); ['ov-fin', 'ov-pause', 'ov-elimine'].forEach(fermer); defis.fermer(); } },
  ecran: () => ecran,
});

requestAnimationFrame(boucle);
