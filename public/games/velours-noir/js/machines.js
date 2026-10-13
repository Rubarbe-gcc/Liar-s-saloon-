/**
 * LE VELOURS NOIR — la salle des machines à sous (en solo).
 *
 * Trois machines (shared/casino/machines.js). Le tirage est fait avant que
 * les rouleaux ne tournent ; l'écran se contente de le mettre en scène :
 * rouleaux qui démarrent l'un après l'autre avec du flou, s'arrêtent de
 * gauche à droite avec un rebond, suspense sur le dernier quand un gros
 * gain se profile, lignes gagnantes en lumière, compteur qui défile,
 * écrans « BIG WIN », « MEGA WIN » et « JACKPOT ».
 */

import * as MS from '../../../shared/casino/machines.js';
import { makeRng } from '../../../shared/hasard.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const $ = (id) => document.getElementById(id);
const COULEURS_LIGNES = ['#f3dc9a', '#ff6b7a', '#5ab4e8', '#7be85a', '#e85a9b', '#ffb03a', '#b38bff', '#4ce8d0', '#ffffff'];
const PLEIN = 22;                      // symboles qui défilent avant l'arrêt (en plus des trois visibles)

export function monterMachines(app) {
  const rng = makeRng(Date.now() ^ 0x5107);
  let m = null;                        // la machine choisie
  let grille = null;
  let mise = 1, lignes = 1;
  let occupe = false, auto = 0;

  /* ---------- la rangée de machines ---------- */
  function dessinerChoix() {
    $('mc-choix').innerHTML = Object.values(MS.MACHINES).map((x, k) => `
      <button class="carte-machine m-${x.id}" data-machine="${x.id}" style="--i:${k}">
        <span class="mini-rouleaux">${x.bandes.slice(0, 3).map((b) => `<i>${afficher(x, b[3 * k + 1])}</i>`).join('')}</span>
        <b>${x.nom}</b><span>${x.sous}</span>
        <em>${x.id === 'jackpot' ? `Jackpot : ${fx.nombre(app.jackpot())}` : `Mise de ${x.mises[0]} à ${x.mises.at(-1) * x.lignesMax}`}</em>
      </button>`).join('');
  }
  $('mc-choix').addEventListener('click', (e) => {
    const b = e.target.closest('[data-machine]');
    if (b) { sfx.clic(); ouvrir(b.dataset.machine); }
  });

  const afficher = (x, s) => {
    const g = x.symboles[s];
    if (g === 'BAR') return '<span class="sym-bar">BAR</span>';
    if (g === '7') return '<span class="sym-sept">7</span>';
    return g;
  };

  /* ---------- une machine ---------- */
  function ouvrir(id) {
    m = MS.MACHINES[id];
    mise = m.mises[0];
    lignes = m.lignesMax;
    grille = MS.tirer(m, rng).grille;
    $('mc-choix').hidden = true;
    $('mc-cabinet').hidden = false;
    $('mc-cabinet').className = `cabinet m-${m.id}`;
    $('mc-nom').textContent = m.nom;
    $('mc-titre').textContent = m.nom;
    $('mc-jackpot').hidden = !m.jackpot;
    majJackpot();
    // les ampoules du fronton
    $('mc-ampoules').innerHTML = '<i></i>'.repeat(18);
    // les rouleaux
    $('mc-rouleaux').style.setProperty('--n', m.rouleaux);
    $('mc-rouleaux').innerHTML = Array.from({ length: m.rouleaux }, (_, r) => `<div class="rouleau" data-r="${r}"><div class="bande"></div></div>`).join('');
    for (let r = 0; r < m.rouleaux; r++) poserBande(r, grille[r]);
    $('mc-lignes').setAttribute('viewBox', `0 0 ${m.rouleaux * 100} 300`);
    $('mc-lignes').innerHTML = '';
    $('mc-gain').innerHTML = '';
    $('mc-commandes').hidden = false;
    majCommandes();
  }

  function poserBande(r, syms) {
    const b = $('mc-rouleaux').children[r].querySelector('.bande');
    b.getAnimations().forEach((a) => a.cancel());
    b.style.setProperty('--cases', syms.length);
    b.innerHTML = syms.map((s, k) => `<div class="sym" data-rang="${k}">${afficher(m, s)}</div>`).join('');
    b.style.transform = 'none';
  }

  function majJackpot() {
    if (m?.jackpot) $('mc-jackpot').querySelector('b').textContent = fx.nombre(app.jackpot());
  }

  /* ---------- la mise ---------- */
  const total = () => MS.miseTotale(m, mise, lignes);
  function majCommandes() {
    if (!m) return;
    $('mc-mise').textContent = fx.nombre(mise);
    $('mc-lignes-val').textContent = lignes;
    $('mc-lignes-bloc').hidden = !!m.lignesFixes || m.lignesMax === 1;
    $('mc-total').textContent = fx.nombre(total());
    $('mc-lancer').disabled = occupe || total() > app.solde();
    $('mc-auto').textContent = auto ? `Stop (${auto})` : 'Auto ×10';
  }
  $('mc-commandes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mc]');
    if (!b || !m) return;
    const a = b.dataset.mc;
    if (a === 'auto') { if (auto) { auto = 0; majCommandes(); } else { auto = 10; lancer(); } return; }
    if (occupe) return;
    sfx.clic();
    const i = m.mises.indexOf(mise);
    if (a === 'mise-') mise = m.mises[Math.max(0, i - 1)];
    if (a === 'mise+') mise = m.mises[Math.min(m.mises.length - 1, i + 1)];
    if (a === 'lignes-') lignes = Math.max(1, lignes - 1);
    if (a === 'lignes+') lignes = Math.min(m.lignesMax, lignes + 1);
    if (a === 'max') { mise = m.mises.at(-1); lignes = m.lignesMax; while (total() > app.solde() && m.mises.indexOf(mise) > 0) mise = m.mises[m.mises.indexOf(mise) - 1]; }
    if (a === 'gains') return ouvrirGains();
    if (a === 'lancer') return lancer();
    majCommandes();
  });
  $('mc-retour').addEventListener('click', () => {
    if (occupe) return;
    if (m) { m = null; auto = 0; $('mc-cabinet').hidden = true; $('mc-choix').hidden = false; $('mc-commandes').hidden = true; $('mc-titre').textContent = 'Les Machines'; dessinerChoix(); return; }
    app.hall();
  });

  /* ---------- le levier : on le tire vers le bas, ou on clique ---------- */
  const levier = $('mc-levier');
  let tire = null;
  levier.addEventListener('pointerdown', (e) => { if (occupe || !m) return; tire = { y: e.clientY, d: 0 }; levier.setPointerCapture(e.pointerId); });
  levier.addEventListener('pointermove', (e) => {
    if (!tire) return;
    tire.d = Math.max(0, Math.min(90, e.clientY - tire.y));
    levier.style.setProperty('--tire', `${tire.d}px`);
  });
  const lacher = () => {
    if (!tire) return;
    const fort = tire.d > 45 || tire.d < 4;   // un vrai coup de levier, ou un simple clic
    tire = null;
    levier.style.setProperty('--tire', '0px');
    if (fort) lancer();
  };
  levier.addEventListener('pointerup', lacher);
  levier.addEventListener('pointercancel', () => { tire = null; levier.style.setProperty('--tire', '0px'); });

  /* ---------- un tour ---------- */
  async function lancer() {
    if (occupe || !m) return;
    const mt = total();
    if (mt > app.solde() || !app.debiter(mt)) { auto = 0; majCommandes(); fx.secouer($('mc-cabinet'), 5); $('mc-gain').innerHTML = '<em>Pas assez de jetons</em>'; return; }
    occupe = true;
    majCommandes();
    $('mc-lignes').innerHTML = '';
    $('mc-gain').innerHTML = '';
    $('mc-cabinet').classList.remove('fete', 'gagne');
    $('mc-rouleaux').querySelectorAll('.sym.gagnant').forEach((s) => s.classList.remove('gagnant'));
    if (m.jackpot) { app.ajouterJackpot(mt * m.jackpot.part); majJackpot(); }
    app.stat('tours');
    sfx.levier();
    levier.classList.add('tire');
    setTimeout(() => levier.classList.remove('tire'), 400);

    const { arrets, grille: fin } = MS.tirer(m, rng);
    const res = MS.evaluer(m, fin, mise, lignes);
    const tension = MS.suspense(m, fin, lignes);
    const base = fx.reduit() ? 300 : 900;
    const durees = Array.from({ length: m.rouleaux }, (_, r) => base + r * 280 + (tension && r === m.rouleaux - 1 ? 1500 : 0));
    sfx.rouleaux(durees.at(-1) / 1000);
    if (tension) setTimeout(() => { sfx.tambour(1.4); $('mc-rouleaux').children[m.rouleaux - 1].classList.add('suspense'); }, durees.at(-2));

    await Promise.all(Array.from({ length: m.rouleaux }, (_, r) => tourner(r, arrets[r], durees[r])));
    $('mc-rouleaux').querySelectorAll('.suspense').forEach((x) => x.classList.remove('suspense'));
    grille = fin;
    await gains(res, mt);
    occupe = false;
    majCommandes();
    if (auto > 0) {
      auto--;
      const gros = res.jackpot || MS.palier(res.total, mt);
      if (gros) auto = 0;
      majCommandes();
      if (auto > 0) { await fx.attendre(450); lancer(); }
    }
  }

  /** Un rouleau tourne, puis s'arrête sur `arret` avec un petit rebond. */
  async function tourner(r, arret, duree) {
    const el = $('mc-rouleaux').children[r];
    const bandeM = m.bandes[r];
    const vus = [0, 1, 2].map((k) => grille[r][k]);
    // la bande qui défile : ce qu'on voyait, des symboles du rouleau, puis l'arrêt
    const defile = [];
    for (let k = PLEIN; k > 0; k--) defile.push(bandeM[(arret - 1 - k + bandeM.length * 10) % bandeM.length]);
    const finaux = [0, 1, 2].map((k) => bandeM[(arret + k - 1 + bandeM.length) % bandeM.length]);
    const tout = [...vus, ...defile, ...finaux];
    poserBande(r, tout);
    const b = el.querySelector('.bande');
    const n = tout.length;
    const finY = -((n - 3) / n) * 100;
    const rebond = -((n - 3 + 0.18) / n) * 100;
    el.classList.add('tourne');
    const anim = b.animate([
      { transform: 'translateY(0)', easing: 'cubic-bezier(.45,.05,.55,.95)' },
      { transform: `translateY(${-((3) / n) * 100}%)`, offset: 0.12, easing: 'linear' },
      { transform: `translateY(${rebond}%)`, offset: 0.9, easing: 'ease-out' },
      { transform: `translateY(${finY}%)` },
    ], { duration: duree, fill: 'forwards' });
    setTimeout(() => el.classList.remove('tourne'), duree * 0.82);
    await fx.fini(anim);
    poserBande(r, finaux);
    sfx.arret(r);
    fx.pop(el, 1.02);
  }

  /** Les gains : lignes en lumière, symboles qui s'animent, compteur, grands écrans. */
  async function gains(res, mt) {
    if (!res.gains.length) { $('mc-gain').innerHTML = '<em>Pas de chance…</em>'; return; }
    const svg = $('mc-lignes');
    svg.innerHTML = res.gains.map((g) => {
      const pts = m.lignes[g.ligne].map((rang, r) => `${r * 100 + 50},${rang * 100 + 50}`).join(' ');
      return `<polyline points="${pts}" stroke="${COULEURS_LIGNES[g.ligne % COULEURS_LIGNES.length]}" class="trace"/>`;
    }).join('');
    for (const g of res.gains) for (const [r, rang] of g.cases) $('mc-rouleaux').children[r].querySelector(`.sym[data-rang="${rang}"]`)?.classList.add('gagnant');
    $('mc-cabinet').classList.add('gagne');

    if (res.jackpot) return jackpot(mt);
    const p = MS.palier(res.total, mt);
    $('mc-gain').innerHTML = `<b data-n="0">0</b><small>${res.gains.length > 1 ? `${res.gains.length} lignes` : `${res.gains[0].n} × ${afficher(m, res.gains[0].symbole)}`}</small>`;
    fx.compter($('mc-gain').querySelector('b'), res.total, p ? 1600 : 700);
    if (p) await grosGain(p, res.total);
    else { sfx.gain(res.total >= mt * 5); sfx.jetons(Math.min(10, 2 + Math.round(res.total / mt))); await fx.attendre(700); }
    app.crediter(res.total);
    if (res.total > mt) app.gainNet(res.total - mt);
  }

  async function grosGain(p, montant) {
    $('mc-cabinet').classList.add('fete');
    const ov = $('mc-grosgain');
    ov.className = `grosgain ${p}`;
    ov.querySelector('.gg-titre').textContent = p === 'mega' ? 'MEGA WIN' : 'BIG WIN';
    ov.hidden = false;
    const b = ov.querySelector('.gg-montant');
    b.dataset.n = 0;
    fx.compter(b, montant, 2200);
    sfx.gain(true);
    fx.pluieDeJetons(p === 'mega' ? 120 : 60);
    if (p === 'mega') { fx.flash(); app.succes('velours-megawin'); }
    await fx.attendre(2800);
    ov.hidden = true;
  }

  async function jackpot(mt) {
    const montant = app.jackpot();
    $('mc-cabinet').classList.add('fete');
    const ov = $('mc-grosgain');
    ov.className = 'grosgain jackpot';
    ov.querySelector('.gg-titre').textContent = 'JACKPOT';
    ov.hidden = false;
    const b = ov.querySelector('.gg-montant');
    b.dataset.n = 0;
    fx.compter(b, montant, 3000);
    sfx.sirene();
    sfx.dire('Jackpot ! Mesdames et messieurs, nous avons un gagnant !');
    fx.flash('rgba(255,230,160,.6)', 500);
    fx.pluieDeJetons(160);
    fx.confettis(innerWidth / 2, innerHeight * 0.75, 140);
    app.succes('velours-jackpot');
    app.stat('jackpots');
    await fx.attendre(4200);
    ov.hidden = true;
    app.crediter(montant);
    app.gainNet(montant - mt);
    app.majJackpot(MS.MACHINES.jackpot.jackpot.depart);
    majJackpot();
    $('mc-gain').innerHTML = `<b>${fx.nombre(montant)}</b><small>JACKPOT</small>`;
  }

  /* ---------- le tableau des gains ---------- */
  function ouvrirGains() {
    const lignesTxt = m.lignesFixes ? `${m.lignesMax} lignes, toujours jouées` : m.lignesMax > 1 ? `jusqu’à ${m.lignesMax} lignes` : 'une ligne (celle du milieu)';
    $('mc-table').innerHTML = `<p class="note">${lignesTxt} · gains en multiples de la mise ${m.lignesMax > 1 ? 'par ligne' : ''}, de gauche à droite</p>
      <table>${Object.entries(m.gains).map(([s, t]) => `<tr><td class="sym-table">${afficher(m, s)}</td>${Object.entries(t).map(([n, v]) => `<td>${n === '1' ? '1 à gauche' : n === '2' && s === 'cerise' ? '2 à gauche' : `×${n}`} : <b>${fx.nombre(v)}</b></td>`).join('')}</tr>`).join('')}</table>
      ${m.joker ? `<p>${afficher(m, m.joker)} <b>L’étoile</b> remplace n’importe quel symbole.</p>` : ''}
      ${m.jackpot ? `<p>${afficher(m, m.jackpot.symbole)} ×5 sur une ligne : <b>le jackpot</b> (${fx.nombre(app.jackpot())} en ce moment). Chaque mise l’alimente.</p>` : ''}
      <p class="note">Retour moyen aux joueurs : environ 95 % des mises.</p>`;
    $('ov-gains').hidden = false;
  }

  return {
    entrer() {
      if (!m) { dessinerChoix(); $('mc-choix').hidden = false; $('mc-cabinet').hidden = true; $('mc-commandes').hidden = true; $('mc-titre').textContent = 'Les Machines'; }
      majCommandes();
    },
    sortir() { auto = 0; },
  };
}
