/**
 * LE VELOURS NOIR — « Croupier d'un soir » (réservé au modérateur).
 *
 * On passe de l'autre côté de la table, vu à la première personne : le
 * feutre en perspective, ses propres bras en bas de l'écran, les clients
 * (des habitués) en face. Au blackjack, on distribue dans le bon ordre, on
 * donne les cartes demandées, on joue la main du croupier selon la règle,
 * puis on paie au bon montant. À la roulette, on annonce, on lance, on dit
 * « Rien ne va plus » au bon moment, on pose la marque, on ramasse et on
 * paie. Les clients contents laissent des pourboires ; chaque erreur se voit.
 *
 * Les règles (ce qu'il faut faire, ce qu'il faut payer) sont dans
 * shared/casino/service.js ; ici, on dessine et on compare les gestes.
 */

import * as SV from '../../../shared/casino/service.js';
import * as BJ from '../../../shared/casino/blackjack.js';
import * as R from '../../../shared/casino/roulette.js';
import { sabot as nouveauSabot } from '../../../shared/casino/cartes.js';
import { makeRng } from '../../../shared/hasard.js';
import { ROUE_DESSIN } from './roulette.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';
import * as RX from './reactions.js';

const $ = (id) => document.getElementById(id);
const TOURS = 10;
const CLIENTS = [
  { nom: 'Lucienne', avatar: '👒', style: 'prudent' }, { nom: 'Le Baron', avatar: '🎩', style: 'requin' },
  { nom: 'Tony', avatar: '🕶️', style: 'flambeur' }, { nom: 'Mme Irma', avatar: '🔮', style: 'bluffeur' },
  { nom: 'Kevin', avatar: '🧢', style: 'touriste' }, { nom: 'Dolores', avatar: '💃', style: 'flambeur' },
  { nom: 'Gaston', avatar: '🥖', style: 'touriste' }, { nom: 'Vera', avatar: '🦊', style: 'bluffeur' },
];
const COULEURS = ['#e8c35a', '#5ab4e8', '#e85a9b', '#7be85a'];
const PLAINTES = ['Hé, ce n’est pas ça !', 'Vous êtes sûr ?', 'Le patron va entendre parler de vous.', 'Concentrez-vous, croupier !', 'Ce n’est pas le bon compte !'];

export function monterService(app, aller) {
  const rng = makeRng(Date.now() ^ 0x5e41);
  let sv = null;                 // le service en cours
  let clients = [];
  let attente = null;            // le geste attendu : { type, cible?, ... }
  let choix = null;              // la mise sélectionnée pour un paiement
  let paiement = 0;

  const ecran = $('s-service');
  RX.brancher('s-service', { ancre: () => ecran.querySelector('.bras-d') });
  const plateau = $('sv-plateau');

  /* ---------- le tableau de bord ---------- */
  function majScore() {
    $('sv-tour').textContent = `${sv.jeu === 'bj' ? 'Donne' : 'Tour'} ${Math.min(sv.tour, TOURS)} / ${TOURS}`;
    $('sv-pourboires').textContent = fx.nombre(sv.pourboires);
    $('sv-erreurs').textContent = sv.erreurs;
  }
  function consigne(t) { $('sv-consigne').textContent = t; fx.pop($('sv-consigne'), 1.04); }
  function dire(k, texte, humeur = '') {
    const b = $(`sv-client-${k}`)?.querySelector('.dit');
    if (!b) return;
    b.textContent = texte;
    b.className = `dit vue ${humeur}`;
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('vue'), 2400);
  }
  function bon() { sv.gestes++; majScore(); }
  function erreur(k, cible, texte) {
    sv.gestes++;
    sv.erreurs++;
    if (k >= 0 && sv.fautes) sv.fautes[k] = (sv.fautes[k] || 0) + 1;
    if (k >= 0) dire(k, texte || PLAINTES[Math.floor(rng() * PLAINTES.length)], 'fache');
    if (cible) { fx.secouer(cible, 6); cible.classList.add('faute'); setTimeout(() => cible.classList.remove('faute'), 600); }
    sfx.perte();
    majScore();
  }

  /** Le bras du croupier se tend vers une cible. */
  function geste(cible, bras = 'd') {
    const el = ecran.querySelector(`.bras-${bras}`);
    if (!el || !cible) return;
    const a = el.getBoundingClientRect(), b = cible.getBoundingClientRect();
    const dx = (b.left + b.width / 2 - (a.left + a.width / 2)) * 0.45;
    const dy = (b.top + b.height / 2 - a.top) * 0.4;
    el.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) rotate(${bras === 'd' ? -8 : 8}deg)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)' });
  }

  /* ---------- les commandes du bas ---------- */
  function boutons(liste) {
    const f = $('sv-commandes');
    f.innerHTML = '';
    const r = document.createElement('div');
    r.className = 'rangee';
    for (const [id, texte, classe = ''] of liste) {
      const b = document.createElement('button');
      b.className = `btn ${classe}`;
      b.dataset.action = id;
      b.innerHTML = texte;
      r.appendChild(b);
    }
    f.appendChild(r);
  }
  /** Le plateau de jetons pour composer un paiement. */
  function caisse(extra = []) {
    paiement = 0;
    const f = $('sv-commandes');
    f.innerHTML = `<div class="rangee"><span class="sv-choix" id="sv-choix">${choix ? `Mise de ${choix.nom} : <b>${fx.nombre(choix.mise)}</b>` : 'Cliquez une mise à régler'}</span></div>
      <div class="rangee"><div class="plateau-jetons" id="sv-jetons"></div><span class="sv-paie">Paiement : <b id="sv-paie">0</b></span></div>
      <div class="rangee"><button class="btn" data-action="effacer">Effacer</button>${extra.map(([id, t, cl = '']) => `<button class="btn ${cl}" data-action="${id}">${t}</button>`).join('')}<button class="btn or" data-action="payer">Payer</button></div>`;
    for (const v of SV.JETONS_CROUPIER) {
      const j = fx.elJeton(v);
      j.setAttribute('role', 'button');
      j.addEventListener('click', () => { paiement += v; $('sv-paie').textContent = fx.nombre(paiement); sfx.jeton(); fx.pop(j, 1.15); });
      $('sv-jetons').appendChild(j);
    }
  }
  $('sv-commandes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || !sv) return;
    action(b.dataset.action, b);
  });

  /* ---------- les clients ---------- */
  function dessinerClients() {
    $('sv-clients').innerHTML = clients.map((c, k) => `<div class="client-fp" id="sv-client-${k}" style="--c:${COULEURS[k]}">
      <span class="buste">${c.avatar}</span><b>${c.nom}</b><span class="dit"></span></div>`).join('');
  }

  /* ================================================================== */
  /* Blackjack                                                          */
  /* ================================================================== */

  function plateauBJ() {
    plateau.className = 'plateau-fp bj';
    plateau.innerHTML = `
      <div class="places-fp">${clients.map((c, k) => `<div class="place-fp" data-k="${k}" style="--c:${COULEURS[k]}">
        <div class="cartes"></div><span class="total" hidden></span><div class="mise-fp"></div></div>`).join('')}</div>
      <div class="zone-moi" id="sv-moi"><div class="cartes"></div><span class="total" hidden></span></div>
      <div class="sabot sabot-fp" id="sv-sabot"><i></i></div>
      <div class="ratelier ratelier-fp" id="sv-ratelier"><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
  }
  const placeEl = (k) => plateau.querySelector(`.place-fp[data-k="${k}"]`);

  function totalBJ(el, cartes) {
    const t = el.querySelector(':scope > .total');
    if (!cartes.length) { t.hidden = true; return; }
    const v = BJ.valeur(cartes);
    t.hidden = false;
    t.className = `total${v.total > 21 ? ' brule' : ''}${BJ.estBlackjack(cartes) ? ' bj' : ''}`;
    t.textContent = v.souple && v.total < 21 ? `${v.total - 10} / ${v.total}` : String(v.total);
  }

  async function carteVers(el, c, { cachee = false } = {}) {
    const ce = fx.elCarte(null);
    el.querySelector('.cartes').appendChild(ce);
    geste(el);
    sfx.carte();
    await fx.arriver(ce, $('sv-sabot'), { duree: 340, tour: -20, echelle: 0.7 });
    if (!cachee) { sfx.retourne(); await fx.retourner(ce, c); }
    return ce;
  }

  async function donneBJ() {
    sv.tour++;
    sv.fautes = {};
    if (!sv.sabot || sv.sabot.length < 60) sv.sabot = nouveauSabot(rng, 6);
    plateauBJ();
    sv.mains = clients.map((c) => ({ cartes: [], mise: SV.miseClient(rng, c.style), double: false, fini: false }));
    sv.croupier = [];
    sv.cachee = null;
    majScore();
    sv.mains.forEach((m, k) => {
      const z = placeEl(k).querySelector('.mise-fp');
      z.appendChild(fx.pile(m.mise));
      fx.arriver(z.firstChild, $(`sv-client-${k}`), { duree: 400, delai: k * 80, echelle: 1 });
    });
    sfx.jetons(6);
    boutons([]);
    sv.ordre = [0, 1, 2, 3, 'moi', 0, 1, 2, 3, 'cachee'];
    sv.pas = 0;
    attente = { type: 'donne' };
    consigne('Distribuez : une carte à chaque client de gauche à droite, une pour vous, puis le second tour (votre seconde carte face cachée). Cliquez la place qui reçoit la carte.');
  }

  async function donnerA(cible, k) {
    const c = sv.sabot.pop();
    if (cible === 'moi' || cible === 'cachee') {
      const el = await carteVers($('sv-moi'), c, { cachee: cible === 'cachee' });
      sv.croupier.push(c);
      if (cible === 'cachee') { sv.cachee = el; el.classList.add('a-retourner'); }
      else totalBJ($('sv-moi'), sv.croupier.filter((_, i) => i !== 1 || !sv.cachee));
    } else {
      await carteVers(placeEl(k), c);
      sv.mains[k].cartes.push(c);
      totalBJ(placeEl(k), sv.mains[k].cartes);
    }
  }

  /** Un clic sur une place de client, ou sur sa propre zone. */
  async function clicBJ(cible, el) {
    if (!attente || sv.occupe) return;
    sv.occupe = true;
    try {
      if (attente.type === 'donne') {
        const voulu = sv.ordre[sv.pas];
        const vise = cible === 'moi' ? (voulu === 'cachee' ? 'cachee' : 'moi') : cible;
        if (vise !== voulu) erreur(typeof voulu === 'number' ? voulu : -1, el, typeof voulu === 'number' ? `C’est à moi, ${clients[voulu].nom} !` : 'C’est votre carte, croupier.');
        else bon();
        await donnerA(voulu, voulu);
        sv.pas++;
        if (sv.pas >= sv.ordre.length) await finDonne();
      } else if (attente.type === 'client') {
        const k = attente.k;
        if (cible !== k) { erreur(k, el, cible === 'moi' ? 'Et moi alors ?' : 'Je vous parle, là !'); return; }
        if (attente.veut === 'reste') { erreur(k, el, 'J’ai dit que je restais !'); return; }
        bon();
        await donnerA(k, k);
        await apresCarte(k);
      } else if (attente.type === 'retourner') {
        if (cible !== 'moi') { erreur(cible, el, 'Votre carte cachée d’abord !'); return; }
        bon();
        sfx.retourne();
        await fx.retourner(sv.cachee, sv.croupier[1]);
        sv.cachee.classList.remove('a-retourner');
        sv.cachee = null;
        totalBJ($('sv-moi'), sv.croupier);
        tourCroupier();
      } else if (attente.type === 'croupier') {
        if (cible !== 'moi') { erreur(cible, el, 'C’est votre main qu’il faut jouer.'); return; }
        if (!SV.croupierTire(sv.croupier) || attente.tousBrules) { erreur(-1, el); consigne('Le croupier reste à 17 et plus. Cliquez « Je reste ».'); return; }
        bon();
        await donnerA('moi');
        totalBJ($('sv-moi'), sv.croupier);
        tourCroupier();
      } else if (attente.type === 'reglement') {
        if (typeof cible !== 'number' || sv.regle[cible]) return;
        choix = { k: cible, nom: clients[cible].nom, mise: sv.mains[cible].mise * (sv.mains[cible].double ? 2 : 1) };
        plateau.querySelectorAll('.place-fp').forEach((p) => p.classList.toggle('choisie', p === el));
        caisse([['egalite', 'Égalité'], ['ramasser', 'Ramasser', 'rouge']]);
      }
    } finally { sv.occupe = false; }
  }

  async function finDonne() {
    const haut = BJ.valeurCarte(sv.croupier[0].r);
    if (haut >= 10 && BJ.estBlackjack(sv.croupier)) {
      consigne('Le croupier a blackjack ! On retourne la carte et on règle.');
      await fx.attendre(600);
      sfx.retourne();
      await fx.retourner(sv.cachee, sv.croupier[1]);
      sv.cachee.classList.remove('a-retourner');
      sv.cachee = null;
      totalBJ($('sv-moi'), sv.croupier);
      return reglementBJ();
    }
    sv.k = -1;
    clientSuivant();
  }

  function clientSuivant() {
    sv.k++;
    while (sv.k < clients.length && sv.mains[sv.k].fini) sv.k++;
    if (sv.k >= clients.length) {
      attente = { type: 'retourner' };
      boutons([]);
      consigne('Tous les clients ont joué. Retournez votre carte cachée.');
      return;
    }
    demander(sv.k);
  }

  function demander(k) {
    const m = sv.mains[k];
    plateau.querySelectorAll('.place-fp').forEach((p) => p.classList.toggle('active', Number(p.dataset.k) === k));
    if (BJ.valeur(m.cartes).total >= 21) {
      m.fini = true;
      dire(k, BJ.estBlackjack(m.cartes) ? 'Blackjack !' : 'Vingt-et-un !', 'content');
      attente = { type: 'client', k, veut: 'reste' };
      boutons([['suivant', 'Client suivant ›', 'or']]);
      consigne(`${clients[k].nom} a 21. Passez au client suivant.`);
      return;
    }
    const d = SV.decisionClient(m.cartes, sv.croupier[0]);
    if (d === 'double') {
      m.double = true;
      const z = placeEl(k).querySelector('.mise-fp');
      z.innerHTML = '';
      z.appendChild(fx.pile(m.mise * 2));
      sfx.jetons(4);
      dire(k, 'Je double !', 'content');
    } else dire(k, d === 'carte' ? 'Carte, s’il vous plaît.' : 'Je reste.');
    attente = { type: 'client', k, veut: d };
    boutons([['suivant', 'Client suivant ›', 'or']]);
    consigne(d === 'reste' ? `${clients[k].nom} reste. Passez au suivant.` : `${clients[k].nom} demande ${d === 'double' ? 'une seule carte (double)' : 'une carte'}. Donnez-la-lui.`);
  }

  async function apresCarte(k) {
    const m = sv.mains[k];
    const v = BJ.valeur(m.cartes).total;
    if (v > 21) { m.fini = true; dire(k, 'Brûlé…', 'triste'); await fx.attendre(500); return clientSuivant(); }
    if (m.double || v === 21) { m.fini = true; await fx.attendre(300); return clientSuivant(); }
    demander(k);
  }

  function tourCroupier() {
    const tousBrules = sv.mains.every((m) => BJ.valeur(m.cartes).total > 21);
    attente = { type: 'croupier', tousBrules };
    boutons([['jereste', 'Je reste', 'or']]);
    const v = BJ.valeur(sv.croupier).total;
    consigne(tousBrules ? 'Tous les clients ont brûlé : inutile de tirer. Cliquez « Je reste ».' : `Votre main fait ${v}. Le croupier tire jusqu’à 16 et reste à 17 : tirez une carte (cliquez votre zone) ou restez.`);
  }

  function reglementBJ() {
    attente = { type: 'reglement' };
    sv.regle = {};
    choix = null;
    plateau.querySelectorAll('.place-fp').forEach((p) => p.classList.remove('active'));
    consigne('Réglez chaque client : cliquez sa mise, puis payez le bon montant (3 pour 2 sur un blackjack), rendez l’égalité, ou ramassez.');
    caisse([['egalite', 'Égalité'], ['ramasser', 'Ramasser', 'rouge']]);
  }

  async function reglerBJ(geste1) {
    if (!choix) { consigne('Cliquez d’abord la mise du client à régler.'); return; }
    const k = choix.k;
    const m = sv.mains[k];
    const mise = choix.mise;
    const attendu = SV.reglementBJ(m.cartes, mise, sv.croupier);
    const el = placeEl(k);
    const ok = geste1 === attendu.geste && (geste1 !== 'payer' || paiement === attendu.gain);
    if (ok) bon();
    else erreur(k, el, attendu.geste === 'payer' ? `On me doit ${fx.nombre(attendu.gain)} !` : attendu.geste === 'egalite' ? 'C’est une égalité, rendez-moi ma mise.' : 'Euh… j’ai perdu, en fait.');
    sv.regle[k] = attendu;
    // le client réagit : ravi d'un blackjack, fâché d'une erreur, parfois dépité
    const r = !ok ? '😡' : attendu.res === 'blackjack' ? '🔥' : attendu.geste === 'payer' && Math.random() < 0.4 ? '🤑' : attendu.geste === 'ramasser' && Math.random() < 0.5 ? '😭' : null;
    if (r) RX.montrer(r, $(`sv-client-${k}`)?.querySelector('.buste'), { delai: 400 });
    el.classList.remove('choisie');
    el.classList.add('reglee');
    const pile = el.querySelector('.mise-fp');
    geste(el, 'g');
    if (attendu.geste === 'payer') { fx.volerJetons(attendu.gain, $('sv-ratelier'), pile, { max: 6 }); sfx.jetons(6); dire(k, attendu.res === 'blackjack' ? 'Merci !' : 'Parfait.', 'content'); }
    else if (attendu.geste === 'ramasser') { fx.volerJetons(mise, pile, $('sv-ratelier'), { max: 4 }); pile.innerHTML = ''; sfx.jetons(3); }
    else dire(k, 'Égalité, d’accord.');
    choix = null;
    $('sv-choix').innerHTML = 'Cliquez une mise à régler';
    paiement = 0; $('sv-paie').textContent = '0';
    if (Object.keys(sv.regle).length === clients.length) {
      await fx.attendre(500);
      finTour(clients.map((_, i) => ({ k: i, base: sv.mains[i].mise })));
    }
  }

  /* ================================================================== */
  /* Roulette                                                           */
  /* ================================================================== */

  const RD = ROUE_DESSIN;
  let roueG = null, angle = 0;

  function plateauRL() {
    plateau.className = 'plateau-fp rl';
    plateau.innerHTML = `<div class="tapis tapis-fp" id="sv-tapis"></div>`;
    const tapis = $('sv-tapis');
    for (const z of R.ZONES) {
      const el = document.createElement('div');
      el.className = `z ${z.point ? 'point' : z.type === 'plein' ? `case ${R.couleurDe(z.nums[0])}` : z.type}`;
      el.style.cssText = `--i:${z.i};--j:${z.j};--w:${z.w};--h:${z.h}`;
      el.dataset.id = z.id;
      if (z.type === 'plein') el.innerHTML = `<span class="num">${z.nums[0]}</span>`;
      else if (z.type === 'douzaine') el.innerHTML = `<span>${['1re 12', '2e 12', '3e 12'][Number(z.id[1]) - 1]}</span>`;
      else if (z.type === 'colonne') el.innerHTML = '<span>2:1</span>';
      else if (z.id === 'rouge' || z.id === 'noir') el.innerHTML = `<i class="losange ${z.id}"></i>`;
      else if (z.type === 'simple') el.innerHTML = `<span>${{ manque: '1-18', passe: '19-36', pair: 'Pair', impair: 'Impair' }[z.id]}</span>`;
      tapis.appendChild(el);
    }
    const cv = $('sv-roue');
    if (cv.width !== RD.T) cv.width = cv.height = RD.T;
    roueG = cv.getContext('2d');
    RD.dessiner(roueG, angle, null);
  }

  async function tourRL() {
    sv.tour++;
    sv.fautes = {};
    plateauRL();
    sv.paris = [];
    majScore();
    attente = { type: 'annonce' };
    boutons([['jeux', 'Faites vos jeux !', 'or']]);
    consigne('Ouvrez les mises : annoncez « Faites vos jeux ».');
  }

  function poserParis() {
    const tapis = $('sv-tapis');
    clients.forEach((c, k) => {
      for (const [id, mise] of Object.entries(SV.parisClient(rng, c.style))) {
        sv.paris.push({ k, id, mise, paye: false });
        const z = tapis.querySelector(`[data-id="${id}"]`);
        const n = z.querySelectorAll('.autre').length;
        const el = document.createElement('span');
        el.className = 'autre';
        el.dataset.k = k;
        el.dataset.id = id;
        el.style.cssText = `--c:${COULEURS[k]};--k:${n}`;
        el.textContent = mise;
        z.appendChild(el);
        fx.arriver(el, $(`sv-client-${k}`), { duree: 450, delai: k * 120, echelle: 1.5 });
      }
    });
    sfx.jetons(10, 0.8);
  }

  function lancerRL() {
    const numero = R.tirer(rng);
    sv.numero = numero;
    sv.annonce = null;
    attente = { type: 'tourne' };
    boutons([['rnvp', 'Rien ne va plus !', 'or']]);
    consigne('La bille tourne… Annoncez « Rien ne va plus » avant qu’elle ne tombe.');
    sfx.bille(6.5);
    geste($('sv-roue'), 'g');
    const D = fx.reduit() ? 1500 : 6500;
    const W0 = angle, Wtot = Math.PI * 2 * 1.5;
    const r0 = -Math.PI / 2 + 0.3 - W0;
    const theta = -Math.PI / 2 + R.ROUE.indexOf(numero) * RD.PAS;
    const cible = r0 - Math.PI * 2 * 8;
    const rFin = theta + Math.PI * 2 * Math.round((cible - theta) / (Math.PI * 2));
    const t0 = performance.now();
    sv.lancee = t0; sv.dureeLancer = D;
    return new Promise((fin) => {
      let fini = false;
      const terminer = () => { if (fini) return; fini = true; angle = W0 + Wtot; RD.dessiner(roueG, angle, { a: angle + rFin, r: RD.RAYON_CASE }); fin(); };
      setTimeout(terminer, D + 300);
      const pas = (t) => {
        if (fini) return;
        const u = Math.min(1, (t - t0) / D);
        const a = W0 + Wtot * RD.easeOut2(u);
        let r = r0 + (rFin - r0) * RD.easeOut3(Math.min(1, u / 0.84));
        let rayon = RD.RAYON_PISTE;
        if (u > 0.5) {
          const v = Math.min(1, (u - 0.5) / 0.34);
          rayon = RD.RAYON_PISTE + (RD.RAYON_CASE - RD.RAYON_PISTE) * RD.easeOut2(v) + Math.abs(Math.sin(v * Math.PI * 5)) * 26 * (1 - v) ** 1.5;
          r += Math.sin(v * Math.PI * 7) * 0.08 * (1 - v) ** 2;
        }
        angle = a;
        RD.dessiner(roueG, a, { a: a + r, r: rayon });
        if (u < 1) requestAnimationFrame(pas); else terminer();
      };
      requestAnimationFrame(pas);
    });
  }

  async function action(id, b) {
    if (!sv || sv.occupe) return;
    if (sv.jeu === 'bj') {
      if (id === 'suivant' && attente?.type === 'client') {
        const k = attente.k;
        if (attente.veut !== 'reste' && !sv.mains[k].fini) { erreur(k, placeEl(k), 'Hé ! J’ai demandé une carte.'); return; }
        bon();
        sv.mains[k].fini = true;
        return clientSuivant();
      }
      if (id === 'jereste' && attente?.type === 'croupier') {
        if (SV.croupierTire(sv.croupier) && !attente.tousBrules) { erreur(-1, b); consigne('Moins de 17 : le croupier doit tirer.'); return; }
        bon();
        return reglementBJ();
      }
      if (attente?.type === 'reglement') {
        if (id === 'effacer') { paiement = 0; $('sv-paie').textContent = '0'; return; }
        if (id === 'payer' || id === 'egalite' || id === 'ramasser') return reglerBJ(id);
      }
      return;
    }
    // roulette
    if (id === 'jeux' && attente?.type === 'annonce') {
      bon();
      sfx.dire('Faites vos jeux.');
      poserParis();
      await fx.attendre(900);
      attente = { type: 'lancer' };
      boutons([['lancer', 'Lancer la bille', 'or']]);
      consigne('Les clients ont misé. Lancez la roue et la bille.');
      return;
    }
    if (id === 'lancer' && attente?.type === 'lancer') {
      bon();
      sv.occupe = true;
      const fin = lancerRL();
      sv.occupe = false;
      await fin;
      if (!sv.annonce) erreur(0, $('sv-roue'), 'Vous n’avez pas annoncé « Rien ne va plus » !');
      attente = { type: 'marque' };
      boutons([]);
      consigne(`La bille est tombée. Posez la marque sur le numéro gagnant (cliquez-le sur le tapis).`);
      return;
    }
    if (id === 'rnvp' && attente?.type === 'tourne' && !sv.annonce) {
      const u = (performance.now() - sv.lancee) / sv.dureeLancer;
      sv.annonce = true;
      sfx.dire('Rien ne va plus.');
      if (u < 0.15) erreur(0, b, 'Déjà ? J’allais encore miser !');
      else if (u > 0.62) erreur(1, b, 'Trop tard, la bille tombait déjà !');
      else { bon(); fx.texte('Rien ne va plus', b); }
      b.disabled = true;
      return;
    }
    if (id === 'ramasser' && attente?.type === 'ramasser') {
      bon();
      for (const p of sv.paris) {
        if (SV.gainRoulette(p.id, p.mise, sv.numero) > 0) continue;
        const el = $('sv-tapis').querySelector(`.autre[data-k="${p.k}"][data-id="${p.id}"]`);
        if (el) fx.volerJetons(p.mise, el, $('sv-roue'), { max: 2 }).then(() => el.remove());
        p.paye = true;
      }
      geste($('sv-tapis'), 'g');
      sfx.jetons(8);
      const gagnants = sv.paris.filter((p) => !p.paye);
      if (!gagnants.length) { consigne('Aucune mise gagnante : la maison prend tout.'); await fx.attendre(900); return finTour([]); }
      attente = { type: 'payer' };
      choix = null;
      consigne('Payez chaque mise gagnante : cliquez-la (pastille de couleur), puis composez le gain exact.');
      caisse();
      return;
    }
    if (attente?.type === 'payer') {
      if (id === 'effacer') { paiement = 0; $('sv-paie').textContent = '0'; return; }
      if (id === 'payer') {
        if (!choix) { consigne('Cliquez d’abord une mise gagnante.'); return; }
        const p = choix.pari;
        const gain = SV.gainRoulette(p.id, p.mise, sv.numero);
        const el = choix.el;
        if (paiement === gain) { bon(); dire(p.k, 'Merci, croupier.', 'content'); } else erreur(p.k, el, `Il me revient ${fx.nombre(gain)} !`);
        fx.volerJetons(gain, $('sv-roue'), el, { max: 5 });
        sfx.jetons(6);
        p.paye = true;
        el.classList.add('payee');
        choix = null;
        $('sv-choix').innerHTML = 'Cliquez une mise gagnante';
        paiement = 0; $('sv-paie').textContent = '0';
        if (sv.paris.every((x) => x.paye)) {
          await fx.attendre(600);
          finTour(sv.paris.filter((x) => SV.gainRoulette(x.id, x.mise, sv.numero) > 0).map((x) => ({ k: x.k, base: SV.gainRoulette(x.id, x.mise, sv.numero) })));
        }
      }
    }
  }

  /* les clics sur la table */
  plateau.addEventListener('click', (e) => {
    if (!sv) return;
    if (sv.jeu === 'bj') {
      const p = e.target.closest('.place-fp');
      if (p) return clicBJ(Number(p.dataset.k), p);
      const moi = e.target.closest('#sv-moi');
      if (moi) return clicBJ('moi', moi);
      return;
    }
    if (attente?.type === 'marque') {
      const z = e.target.closest('.z.case, .z.vert');
      if (!z) return;
      const bonne = $('sv-tapis').querySelector(`[data-id="p${sv.numero}"]`);
      if (z !== bonne) erreur(2, z, `Mais non, c’est le ${sv.numero} !`); else bon();
      const d = document.createElement('i');
      d.className = 'dolly';
      bonne.appendChild(d);
      bonne.classList.add('gagnante');
      sfx.retourne();
      sfx.dire(R.annonce(sv.numero));
      attente = { type: 'ramasser' };
      boutons([['ramasser', 'Ramasser les perdants', 'or']]);
      consigne(`${R.annonce(sv.numero)}. Ramassez d’abord les mises perdantes.`);
      return;
    }
    if (attente?.type === 'payer') {
      const m = e.target.closest('.autre:not(.payee)');
      if (!m) return;
      const pari = sv.paris.find((p) => p.k === Number(m.dataset.k) && p.id === m.dataset.id && !p.paye);
      if (!pari) return;
      choix = { pari, el: m, nom: clients[pari.k].nom, mise: pari.mise };
      $('sv-tapis').querySelectorAll('.autre').forEach((x) => x.classList.toggle('choisie', x === m));
      $('sv-choix').innerHTML = `${clients[pari.k].nom} : <b>${fx.nombre(pari.mise)}</b> sur ${R.PAR_ID[pari.id].nom}`;
    }
  });

  /* ================================================================== */
  /* Le service                                                         */
  /* ================================================================== */

  /** Fin d'une donne ou d'un tour : les pourboires des clients contents. */
  async function finTour(bases) {
    attente = null;
    let total = 0;
    for (const { k, base } of bases) {
      const tip = SV.pourboire(rng, base, !sv.fautes[k]);
      if (!tip) continue;
      total += tip;
      dire(k, `Pour vous, croupier : ${tip}`, 'content');
      fx.volerJetons(tip, $(`sv-client-${k}`), ecran.querySelector('.bras-d'), { max: 3 });
    }
    // un tour sans aucune erreur : un petit bonus de la direction
    if (!Object.keys(sv.fautes).length && bases.length) total += 5;
    sv.pourboires += total;
    if (total) { sfx.jetons(6); fx.texte(`+${total} de pourboires`, $('sv-consigne')); }
    majScore();
    await fx.attendre(1600);
    if (sv.tour >= TOURS) return bilan();
    return sv.jeu === 'bj' ? donneBJ() : tourRL();
  }

  function bilan() {
    const secondes = Math.round((Date.now() - sv.debut) / 1000);
    const n = SV.etoiles({ gestes: sv.gestes, erreurs: sv.erreurs, secondes });
    $('sb-etoiles').textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    $('sb-details').innerHTML = `${sv.gestes} gestes · ${sv.erreurs} erreur${sv.erreurs > 1 ? 's' : ''} · ${Math.floor(secondes / 60)} min ${secondes % 60} s<br>Pourboires : <b>${fx.nombre(sv.pourboires)}</b> jetons, versés dans votre caisse.`;
    $('ov-service-bilan').hidden = false;
    if (sv.pourboires) app.crediter(sv.pourboires);
    if (n === 5) { sfx.gain(true); fx.pluieDeJetons(50); }
    sv = null;
  }

  function demarrer(jeu) {
    const pris = [...CLIENTS].sort(() => rng() - 0.5).slice(0, 4);
    clients = pris;
    sv = { jeu, tour: 0, erreurs: 0, gestes: 0, pourboires: 0, debut: Date.now() };
    ecran.classList.toggle('service-bj', jeu === 'bj');
    ecran.classList.toggle('service-rl', jeu === 'rl');
    $('sv-titre').textContent = jeu === 'bj' ? 'Croupier · Blackjack' : 'Croupier · Roulette';
    $('sv-roue-place').hidden = jeu !== 'rl';
    dessinerClients();
    return jeu === 'bj' ? donneBJ() : tourRL();
  }

  $('sv-quitter').addEventListener('click', () => { if (sv && sv.tour > 1) bilan(); else { sv = null; aller('s-hall'); } });
  $('ov-service-bilan').addEventListener('click', (e) => { if (e.target.closest('[data-ferme]')) aller('s-hall'); });

  return {
    preparer(jeu) { sv = null; ecran.dataset.prochain = jeu; },
    entrer() { demarrer(ecran.dataset.prochain || 'bj'); },
    sortir() { attente = null; },
  };
}
