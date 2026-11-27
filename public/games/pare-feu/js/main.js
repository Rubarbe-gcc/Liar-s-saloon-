/**
 * PARE-FEU — les écrans, la partie contre l'ordinateur, les commandes et le HUD.
 *
 * Une partie en cours est une « session » : { E, moi, envoyer(c), enligne }.
 * Contre l'ordinateur, le moteur tourne ici ; en ligne, js/enligne.js reçoit
 * les états du serveur et prédit entre deux.
 */

import {
  DT, PROGRAMMES, DEFENSES, BRECHE, COULEURS, NOEUDS, LISTE_PROGRAMMES, LISTE_DEFENSES,
  TECHS, LISTE_TECHS, AMELIORATIONS, LISTE_AMELIORATIONS, NIV_MAX, EVENEMENTS,
} from '../../../shared/parefeu/donnees.js';
import { creerPartie, pas, verifier, commande } from '../../../shared/parefeu/partie.js';
import { ami, frontiere, recharge, voit, allies, action, source, coutDe, rechargeDe, prixUp, prixTech, up, tech, evenement } from '../../../shared/parefeu/regles.js';
import { creerRendu } from './rendu.js';
import * as son from './sons.js';
import * as enligne from './enligne.js';
import { creerDefis } from './defi.js';
import * as perso from './perso.js';
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
const evSolo = choix('solo-ev');
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
  derniereConf = { mode: modeSolo(), niveau: niveauSolo(), nom, evenements: evSolo() !== 'non' };
  lancerSolo(derniereConf);
});

function lancerSolo({ mode, niveau, nom, evenements = true }) {
  const n = mode === 'ffa3' ? 3 : (mode === 'ffa4' || mode === '2v2') ? 4 : 2;
  const joueurs = [{ nom }];
  for (let k = 1; k < n; k++) joueurs.push({ ia: niveau });
  const E = creerPartie({ joueurs, mode: mode === '2v2' ? '2v2' : 'ffa', evenements, graine: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
  demarrer({ E, moi: 0, enligne: false, envoyer: (c) => commande(E, 0, c) });
}

/* ---------------------------- Personnaliser ---------------------------- */

function annoncerDeblocages(liste) {
  liste.forEach((x, i) => setTimeout(() => { toast(`🔓 Débloqué : ${x.quoi} « ${x.nom} »`, 2600); son.jouer('capture'); }, i * 2700));
  majInfoPerso();
}

function majInfoPerso() {
  const { stats } = perso.profil();
  const tout = [...perso.COULEURS_PERSO, ...perso.FORMES, ...perso.TRAINEES];
  $('perso-info').textContent = `${tout.filter((x) => perso.debloque(x, stats)).length} / ${tout.length} styles débloqués`;
}

/** Un petit aperçu dessiné pour chaque tuile. */
function apercu(cv, type, item, couleur) {
  const g = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = 64 * dpr; cv.height = 40 * dpr;
  g.scale(dpr, dpr);
  g.clearRect(0, 0, 64, 40);
  g.lineJoin = 'round';
  if (type === 'couleur') {
    g.shadowColor = item.c; g.shadowBlur = 12;
    g.fillStyle = item.c;
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; g.lineTo(32 + 14 * Math.cos(a), 20 + 14 * Math.sin(a)); } g.closePath(); g.fill();
    return;
  }
  if (type === 'forme') {
    g.strokeStyle = couleur; g.lineWidth = 2; g.shadowColor = couleur; g.shadowBlur = 10;
    const r = 13, x = 32, y = 20;
    g.beginPath();
    const poly = (n, rot, k = 1) => { for (let i = 0; i < n; i++) { const a = rot + (i * Math.PI * 2) / n; g.lineTo(x + r * k * Math.cos(a), y + r * k * Math.sin(a)); } g.closePath(); };
    switch (item.id) {
      case 'cercle': g.arc(x, y, r, 0, Math.PI * 2); break;
      case 'losange': poly(4, 0, 1.1); break;
      case 'octo': poly(8, Math.PI / 8); break;
      case 'triangle': poly(3, -Math.PI / 2, 1.15); break;
      case 'etoile': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.55 : r * 1.12; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); break;
      case 'oeil': g.moveTo(x - r * 1.3, y); g.quadraticCurveTo(x, y - r * 1.3, x + r * 1.3, y); g.quadraticCurveTo(x, y + r * 1.3, x - r * 1.3, y); g.closePath(); break;
      default: poly(6, Math.PI / 6);
    }
    g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
    return;
  }
  // Traînée
  const y = 20;
  const ligne = (c, w, dash = [], dy = 0) => { const gr = g.createLinearGradient(52, 0, 6, 0); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.strokeStyle = gr; g.lineWidth = w; g.setLineDash(dash); g.beginPath(); g.moveTo(52, y + dy); g.lineTo(6, y + dy); g.stroke(); g.setLineDash([]); };
  switch (item.id) {
    case 'pointilles': ligne(couleur, 3, [4, 4]); break;
    case 'double': ligne(couleur, 2.5, [], -3); ligne(couleur, 2.5, [], 3); break;
    case 'etincelles': ligne(couleur, 3); g.fillStyle = couleur; for (let i = 0; i < 6; i++) g.fillRect(12 + i * 6, y - 6 + ((i * 7) % 12), 2, 2); break;
    case 'comete': ligne(couleur, 6); break;
    case 'arcenciel': ['#ff3b5c', '#ffb02e', '#ffd54a', '#39ff7a', '#2ef2ff', '#9b5cff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(8 + i * 7, y - 2, 7, 4); }); break;
    default: ligne(couleur, 3);
  }
  g.fillStyle = '#fff'; g.shadowColor = couleur; g.shadowBlur = 10;
  g.beginPath(); g.arc(54, y, 4, 0, Math.PI * 2); g.fill();
}

function rendrePerso() {
  const { stats, choix } = perso.profil();
  const st = perso.style();
  $('perso-stats').textContent = `${stats.parties} parties · ${stats.victoires} victoires · ${stats.parfaits} combinaisons parfaites · ${stats.difficile} victoires en difficile`;
  const box = $('perso');
  box.innerHTML = '';
  const section = (titre, type, liste, cle) => {
    const h = document.createElement('h3'); h.textContent = titre; box.appendChild(h);
    const grille = document.createElement('div'); grille.className = 'tuiles'; box.appendChild(grille);
    for (const item of liste) {
      const ok = perso.debloque(item, stats);
      const t = document.createElement('button');
      t.type = 'button';
      t.className = `tuile ${ok ? '' : 'verrou'} ${choix[cle] === item.id || (!choix[cle] && item === liste[0]) ? 'choisie' : ''}`;
      const cv = document.createElement('canvas');
      t.appendChild(cv);
      const nom = document.createElement('span'); nom.textContent = item.nom; t.appendChild(nom);
      if (!ok) { const sm = document.createElement('small'); sm.textContent = `🔒 ${perso.condition(item)}`; t.appendChild(sm); }
      apercu(cv, type, item, st.couleur);
      t.addEventListener('click', () => {
        if (!ok) { son.jouer('refus'); toast(`À débloquer : ${perso.condition(item)}`, 1800); return; }
        perso.choisir(cle, item.id);
        son.jouer('clic');
        rendrePerso();
      });
      grille.appendChild(t);
    }
  };
  section('> Couleur de ton réseau', 'couleur', perso.COULEURS_PERSO, 'couleur');
  section('> Forme de ton Noyau', 'forme', perso.FORMES, 'forme');
  section('> Traînée de tes programmes', 'trainee', perso.TRAINEES, 'trainee');
}
$('b-perso').addEventListener('click', () => { son.jouer('clic'); rendrePerso(); aller('s-perso'); });
majInfoPerso();

function remplirAide() {
  const carte = (A) => `<div class="carte"><span class="g">${A.glyphe}</span><b>${A.nom}</b> · ${A.cout} cycles<small>${A.aide} Recharge ${A.recharge} s.${A.defi ? ` Combinaison de ${A.defi + 1}.` : ''}</small></div>`;
  $('aide').innerHTML = `
    <p>Chaque joueur tient un <b>réseau</b> : un <b>Noyau</b> et trois serveurs. Si ton Noyau tombe, tu es éliminé. En 2 contre 2, l’équipe perd quand ses deux Noyaux sont tombés. Tout est inventé : des programmes imaginaires sur un réseau imaginaire.</p>
    <h3>&gt; Les cycles</h3>
    <p>Ta ressource monte toute seule (3 par seconde), et plus vite avec chaque nœud que tu tiens : serveur +${NOEUDS.serveur.revenu}, relais +${NOEUDS.relais.revenu}, Nexus (au centre) +${NOEUDS.nexus.revenu}.</p>
    <h3>&gt; Les mini-défis</h3>
    <p>Chaque action se gagne : une <b>combinaison</b> à reproduire, soit que des flèches, soit que des lettres, soit que des chiffres. Plus l’action est forte, plus elle est longue (3 symboles pour un ver, 6 pour une saturation). Le temps passé, l’action ne part pas (et ne coûte rien). Sans aucune faute, elle est <b>parfaite</b> : +25 % de dégâts ou de durée, +1 charge de pare-feu. La partie continue pendant le défi !</p>
    <h3>&gt; Attaquer</h3>
    <p>Touche un nœud <b>voisin</b> d’un des tiens (les cibles possibles ont un cercle pointillé) : les programmes s’ouvrent en cercle autour de lui, touches-en un. Il voyage le long du lien. Quand un nœud n’a plus de PV, il passe à toi. Le Noyau ne touche que ses serveurs : prends d’abord un serveur.</p>
    <div class="cartes">${LISTE_PROGRAMMES.map((k) => carte(PROGRAMMES[k])).join('')}${carte(BRECHE)}</div>
    <h3>&gt; Défendre</h3>
    <p>Touche un de tes nœuds (ou un de ton allié) : les défenses s’ouvrent autour de lui. Les défenses adverses sont cachées (<b>?</b>) tant qu’une sonde ne les a pas révélées.</p>
    <div class="cartes">${LISTE_DEFENSES.map((k) => carte(DEFENSES[k])).join('')}</div>
    <h3>&gt; Le Laboratoire</h3>
    <p>Le bouton <b>⬆ LABO</b> (touche <kbd>U</kbd>) ouvre le Laboratoire : quinze technologies à trois niveaux, payées en cycles, pour tout ton réseau. En attaque : vers et chevaux plus forts, saturation plus longue, rançon plus gourmande, sonde plus longue, brèche plus forte, programmes plus rapides, recharges plus courtes. En défense : pare-feu renforcé, antivirus plus rapide, leurre vorace, chiffrement quantique, correctif express, auto-réparation. Et l’Overclock, qui augmente tes revenus.</p>
    <h3>&gt; Améliorer un nœud</h3>
    <p>Touche un de tes nœuds puis <b>⬆</b> dans son menu : <b>Blindage</b> (plus de PV), <b>Rendement</b> (plus de cycles), <b>Tourelle</b> (détruit seule les programmes), <b>Bouclier</b> (regagne seul ses charges de pare-feu), <b>Propulseur</b> (les programmes qui en partent vont plus vite et frappent plus fort). Trois niveaux chacun ; tout est perdu si le nœud est pris.</p>
    <h3>&gt; Les événements</h3>
    <p>Toutes les 35 à 60 secondes, il se passe quelque chose : <b>panne de courant</b> (plus aucune défense), <b>surtension</b> (revenus doublés), <b>tempête de données</b> (programmes plus rapides), <b>marché noir</b> (actions moins chères), <b>fuite de données</b> (toutes les défenses visibles), <b>cache de données</b> (un nœud neutre rapporte 60 cycles au premier qui le prend).</p>
    <h3>&gt; Personnaliser</h3>
    <p>En jouant, tu débloques des couleurs pour ton réseau, des formes pour ton Noyau et des traînées pour tes programmes (parties, victoires, combinaisons parfaites, victoires en difficile).</p>
    <h3>&gt; La surchauffe</h3>
    <p>Au bout de 3 minutes tout frappe 1,5 fois plus fort, puis 2 fois (5 min) et 3 fois (7 min). À 10 minutes, l’équipe qui tient le plus de nœuds gagne.</p>
    <h3>&gt; Touches</h3>
    <p><kbd>1</kbd>–<kbd>5</kbd> : programmes (sur une cible) ou défenses (sur un nœud à toi) · <kbd>B</kbd> : brèche · dans une combinaison : flèches (ou <kbd>ZQSD</kbd>), lettres ou chiffres, <kbd>Échap</kbd> pour renoncer · <kbd>Espace</kbd> : ton Noyau · <kbd>U</kbd> : Laboratoire · <kbd>6</kbd> : améliorer le nœud · <kbd>Tab</kbd> : cible suivante · <kbd>Échap</kbd> : pause.</p>`;
}
remplirAide();

/* ------------------------------------------------------------------ */
/* La partie                                                           */
/* ------------------------------------------------------------------ */

/** @type {{E:any, moi:number, enligne:boolean, envoyer:(c:any)=>any, pause?:boolean, vitesse?:number, finie?:boolean, elimineVu?:boolean, avancer?:(dt:number)=>any[]}|null} */
let S = null;
/** Les couleurs des joueurs de la partie (la mienne personnalisée). */
let palette = [...COULEURS];
const couleurDe = (j) => (j >= 0 ? palette[j] : '#6b7a99');
let selection = -1;
let acc = 0;
let demo = null;

function nouvelleDemo() {
  demo = creerPartie({ joueurs: [{ ia: 'normal' }, { ia: 'normal' }, { ia: 'difficile' }, { ia: 'normal' }], graine: (Math.random() * 1e9) >>> 0 });
}
nouvelleDemo();

function demarrer(session) {
  S = { pause: false, vitesse: 1, finie: false, elimineVu: false, ...session };
  palette = perso.palette(S.moi);
  rendu.style(palette, { j: S.moi, ...perso.style() });
  laboOuvert(false);
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
  rendu.style(null, null);
  palette = [...COULEURS];
  laboOuvert(false);
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
      case 'tourelle': if (chezMoi) son.jouer('zap', 0.05); break;
      case 'up': if (e.j === moi) son.jouer('correctif'); break;
      case 'tech': if (e.j === moi) son.jouer('correctif'); break;
      case 'tresor': son.jouer('vol'); break;
      case 'evenement': son.jouer(e.ev === 'panne' ? 'perte' : 'alarme', 0.5); break;
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
  rendu.dessiner(E, moi, { now: t / 1000, dt, selection, attaquables, danger, zone });
  placerMenu(E);
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
  document.querySelector('.cycles').style.setProperty('--c', couleurDe(moi));
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
    return `<span class="puce ${K.vivant ? '' : 'mort'} ${k === moi ? 'moi' : ''}" style="color:${couleurDe(k)}"><b>${esc(K.nom)}</b>${K.vivant ? `◈${n}` : '✕'}${k === moi ? '' : eq}</span>`;
  }).join('');
  // L'alerte : mon Noyau est visé.
  const visé = J.vivant && E.progs.some((p) => p.vers === J.noyau && !allies(E, p.j, moi));
  const al = $('h-alerte');
  if (visé) {
    al.hidden = false;
    al.textContent = '⚠ NOYAU ATTAQUÉ';
    if (t - alerteVue > 2500) { son.jouer('alarme'); alerteVue = t; }
  } else al.hidden = true;
  const bandeau = $('h-ev');
  if (E.ev && E.ev.fin > E.temps) {
    const V = EVENEMENTS[E.ev.k];
    bandeau.hidden = false;
    bandeau.innerHTML = `<b>${V.glyphe} ${V.nom}</b>${V.aide}<i>${Math.ceil(E.ev.fin - E.temps)} s</i>`;
  } else bandeau.hidden = true;
  $('b-labo').classList.toggle('peut', J.vivant && LISTE_TECHS.some((k) => J.res >= prixTech(E, moi, k)));
  $('b-labo').hidden = !J.vivant || E.fini;
  if (!$('ov-labo').hidden) majLabo(E, moi);
  info(E, moi);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function info(E, moi) {
  const el = $('h-info');
  const J = E.joueurs[moi];
  if (!J.vivant) { el.innerHTML = E.fini ? 'Partie terminée.' : 'Tu regardes la fin de la partie.'; return; }
  if (selection < 0) { el.innerHTML = 'Touche un nœud <b>voisin</b> pour l’attaquer, ou un des tiens pour le défendre : les actions s’ouvrent autour.'; return; }
  const nd = E.noeuds[selection];
  const type = nd.eteint ? 'NOYAU ÉTEINT' : NOEUDS[nd.type].nom.toUpperCase();
  const qui = nd.proprio < 0 ? 'neutre' : nd.proprio === moi ? 'à toi' : esc(E.joueurs[nd.proprio].nom);
  const col = couleurDe(nd.proprio);
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

/* ---------------------------- Laboratoire ---------------------------- */

let ongletLabo = 'att';
let cartesLabo = [];

function laboOuvert(oui) {
  $('ov-labo').hidden = !oui;
  if (oui) construireLabo();
}
function basculerLabo() {
  if (!S || !S.E.joueurs[S.moi]?.vivant) return;
  son.jouer('clic');
  laboOuvert($('ov-labo').hidden);
}
function construireLabo() {
  const box = $('labo-techs');
  box.innerHTML = '';
  cartesLabo = LISTE_TECHS.filter((k) => TECHS[k].cote === ongletLabo).map((k) => {
    const T = TECHS[k];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tech';
    b.innerHTML = `<span class="g">${T.glyphe}</span><span><b>${T.nom}</b><small></small><span class="niv"></span></span><span class="prix"></span>`;
    b.addEventListener('click', () => {
      if (!S) return;
      const c = { t: 'tech', k };
      const v = verifier(S.E, S.moi, c);
      if (!v.ok) { son.jouer('refus'); toast(v.raison, 1300); return; }
      S.envoyer(c);
    });
    box.appendChild(b);
    return { k, b, small: b.querySelector('small'), niv: b.querySelector('.niv'), prix: b.querySelector('.prix'), cle: '' };
  });
  if (S) majLabo(S.E, S.moi);
}
function majLabo(E, moi) {
  const J = E.joueurs[moi];
  $('labo-res').textContent = `${Math.floor(J.res)} cycles`;
  for (const x of cartesLabo) {
    const n = tech(E, moi, x.k);
    const prix = prixTech(E, moi, x.k);
    const cle = `${n}|${prix}|${J.res >= prix}`;
    if (cle === x.cle) continue;
    x.cle = cle;
    const T = TECHS[x.k];
    x.small.textContent = n >= NIV_MAX ? `Au maximum : ${T.effets[NIV_MAX - 1]}` : `Niveau ${n + 1} : ${T.effets[n]}`;
    x.niv.textContent = pips(n);
    x.prix.textContent = prix === Infinity ? 'MAX' : prix;
    x.b.className = `tech ${prix === Infinity ? 'max' : J.res >= prix ? 'pret' : 'pauvre'}`;
  }
}
$('b-labo').addEventListener('click', basculerLabo);
$('labo-fermer').addEventListener('click', () => { son.jouer('clic'); laboOuvert(false); });
$('labo-onglets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  ongletLabo = b.dataset.v;
  $('labo-onglets').querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
  son.jouer('clic');
  construireLabo();
});

/** Le menu suit son nœud, sans sortir de l'écran. */
function placerMenu(E) {
  const cache = defis.actif() ? 'none' : '';
  if ($('h-actions').style.display !== cache) $('h-actions').style.display = cache;
  if (!boutons.length || selection < 0) return;
  const W = innerWidth, H = innerHeight;
  const R = W < 560 ? 64 : 74;
  const p = rendu.ecran(E.noeuds[selection].x, E.noeuds[selection].y);
  const m = R + 32;
  const cx = Math.max(m, Math.min(W - m, p.x));
  const cy = Math.max(m, Math.min(H - m, p.y));
  for (const x of boutons) {
    const l = `${Math.round(cx + x.dx * R)}px`, t = `${Math.round(cy + x.dy * R)}px`;
    if (x.b.style.left !== l) x.b.style.left = l;
    if (x.b.style.top !== t) x.b.style.top = t;
  }
}

/** Le menu des améliorations du nœud choisi est-il ouvert (au lieu des défenses) ? */
let menuUp = false;
const pips = (n) => '●'.repeat(n) + '○'.repeat(NIV_MAX - n);

function majActions(E, moi) {
  const J = E.joueurs[moi];
  let mode = null;
  // Le menu ne s'ouvre que là où l'on peut agir : ses nœuds, ou une cible à portée.
  if (J.vivant && !E.fini && selection >= 0) {
    const nd = E.noeuds[selection];
    mode = ami(E, moi, selection) ? (menuUp && nd.proprio === moi ? 'up' : 'def') : source(E, moi, selection) >= 0 ? 'att' : null;
    if (mode === 'def' && nd.proprio === moi) mode = 'def+';
  }
  if (mode !== modeActions) {
    modeActions = mode;
    const liste = mode === 'att' ? [...LISTE_PROGRAMMES, 'breche']
      : mode === 'def' ? LISTE_DEFENSES
      : mode === 'def+' ? [...LISTE_DEFENSES, '⬆']
      : mode === 'up' ? [...LISTE_AMELIORATIONS, '↩'] : [];
    const box = $('h-actions');
    box.innerHTML = '';
    boutons = liste.map((k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.t = k;
      let A, c;
      if (k === '⬆') { A = { glyphe: '⬆', court: 'Améliorer', touche: '6' }; c = '#ffd54a'; }
      else if (k === '↩') { A = { glyphe: '↩', court: 'Défenses', touche: '6' }; c = '#9fb3cc'; }
      else if (mode === 'up') { A = { ...AMELIORATIONS[k], court: AMELIORATIONS[k].nom, touche: String(LISTE_AMELIORATIONS.indexOf(k) + 1) }; c = '#ffd54a'; }
      else { A = action(k); c = k === 'breche' ? '#ffb02e' : mode === 'att' ? couleurDe(moi) : '#7dff9b'; }
      b.className = 'act';
      b.style.setProperty('--c', c);
      b.innerHTML = `<span class="k">${A.touche}</span><span class="g">${A.glyphe}</span><span class="n">${A.court || A.nom}</span><span class="p"></span><span class="cd"></span>`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); agir(k); });
      box.appendChild(b);
      return { b, k, A, cd: b.querySelector('.cd'), p: b.querySelector('.p'), etat: '', texte: '' };
    });
    // En cercle, en partant du haut.
    boutons.forEach((x, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / boutons.length;
      x.dx = Math.cos(a); x.dy = Math.sin(a);
      x.b.style.setProperty('--dx0', `${-x.dx * 60}px`);
      x.b.style.setProperty('--dy0', `${-x.dy * 60}px`);
    });
  }
  for (const x of boutons) {
    let etat, texte, angle = 0;
    if (x.k === '⬆' || x.k === '↩') { etat = 'pret'; texte = ''; }
    else if (mode === 'up') {
      const nd = E.noeuds[selection];
      const prix = prixUp(nd, x.k);
      const ok = verifier(E, moi, { t: 'up', k: x.k, cible: selection }).ok;
      texte = prix === Infinity ? `${pips(NIV_MAX)}` : `${pips(up(nd, x.k))} ${prix}`;
      etat = `${ok ? 'pret' : ''} ${prix !== Infinity && J.res < prix ? 'pauvre' : ''} ${prix === Infinity ? 'max' : ''}`;
    } else {
      const r = recharge(E, moi, x.k);
      const pret = r === 0;
      const cout = coutDe(E, moi, x.k);
      const assez = J.res >= cout;
      const v = x.k === 'breche' ? verifier(E, moi, { t: 'breche', cible: selection, score: 0 }) : verifier(E, moi, { t: x.k, cible: selection });
      etat = `${pret && assez && v.ok ? 'pret' : ''} ${assez ? '' : 'pauvre'} ${v.ok || !pret || !assez ? '' : 'off'} ${cout < x.A.cout ? 'solde' : ''}`;
      texte = String(cout);
      angle = pret ? 0 : (r / rechargeDe(E, moi, x.k)) * 360;
    }
    if (etat !== x.etat) { x.b.className = `act ${etat}`; x.etat = etat; }
    if (texte !== x.texte) { x.p.textContent = texte; x.texte = texte; }
    x.cd.style.setProperty('--a', `${angle}deg`);
  }
}

/**
 * Une action : d'abord son mini-défi (plus long pour une action forte).
 * Réussi, l'ordre part (« parfait » sans faute) ; le temps écoulé, rien ne part.
 */
function agir(k) {
  if (!S || selection < 0 || defis.actif()) return;
  const { E, moi } = S;
  if (k === '⬆' || k === '↩') { menuUp = k === '⬆'; son.jouer('clic'); return; }
  if (AMELIORATIONS[k]) {
    const c = { t: 'up', k, cible: selection };
    const v = verifier(E, moi, c);
    if (!v.ok) { son.jouer('refus'); toast(v.raison, 1400); return; }
    S.envoyer(c);
    son.jouer('capture', 0.1);
    return;
  }
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
    couleur: breche ? '#ffb02e' : DEFENSES[k] ? '#7dff9b' : couleurDe(moi),
    fin: (r) => {
      if (!S || !r.reussi) { if (S && !r.reussi) toast('Défi raté : l’action ne part pas.', 1300); return; }
      const c = breche ? { t: k, cible, score: r.score } : { t: k, cible, parfait: r.parfait };
      const w = verifier(S.E, S.moi, c);
      if (!w.ok) { son.jouer('refus'); toast(w.raison, 1400); return; }
      S.envoyer(c);
      if (r.parfait && !breche) { toast('★ PARFAIT : action renforcée', 900); son.jouer('capture', 0.2); annoncerDeblocages(perso.compter({ parfaits: 1 })); }
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
  if (n !== selection) { son.jouer('clic'); menuUp = false; }
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
  if (k === 'Escape') { e.preventDefault(); if (!$('ov-labo').hidden) laboOuvert(false); else basculerPause(); return; }
  if (k === ' ') { e.preventDefault(); selection = S.E.joueurs[S.moi].noyau; son.jouer('clic'); return; }
  if (k === 'Tab') { e.preventDefault(); cibleSuivante(); return; }
  if (k === 'b') { agir('breche'); return; }
  if (/^[1-6]$/.test(k)) {
    const x = boutons[Number(k) - 1];
    if (x && x.k !== 'breche') agir(x.k);
  }
  if (k === 'u') basculerLabo();
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
  $('fin-bilan').innerHTML = `<tr><th>Joueur</th><th>Prises</th><th>Lancés</th><th>Bloqués</th><th>Dégâts</th><th>Volés</th></tr>${E.joueurs.map((K, k) => `<tr class="${K.equipe === E.gagnant ? 'gagne' : ''}" style="color:${couleurDe(k)}"><td>${esc(K.nom)}</td><td>${K.stats.captures}</td><td>${K.stats.lances}</td><td>${K.stats.bloques}</td><td>${Math.round(K.stats.degats)}</td><td>${K.stats.vols}</td></tr>`).join('')}`;
  $('fin-rejouer').hidden = S.enligne && !enligne.estHote();
  ouvrir('ov-fin');
  son.jouer(gagne ? 'victoire' : 'defaite');
  const difficile = gagne && !S.enligne && derniereConf?.niveau === 'difficile';
  setTimeout(() => annoncerDeblocages(perso.compter({ parties: 1, victoires: gagne ? 1 : 0, difficile: difficile ? 1 : 0 })), 900);
  rendu.eclairer(gagne ? couleurDe(moi) : '#ff3b5c', 0.4);
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
